"""
Multi-voice TTS synthesis using ElevenLabs Text-to-Dialogue API.
Parses ALEX:/SARAH: speaker markers, sends to ElevenLabs for natural
conversational synthesis with different voices.
Falls back to Kokoro-82M if ELEVENLABS_API_KEY is not set.
Usage: python3 tts.py <input_text_file> <output_mp3_path>
"""
import sys
import os
import re
import json


# ElevenLabs voice IDs — pre-built voices
VOICES = {
    "ALEX": "TX3LPaxmHKxFdv7VOQHJ",   # Liam - young male, conversational
    "SARAH": "pFZP5JQG7iQjIQuC4Bku",   # Lily - velvety, confident, British
}

# Audio tags that Kokoro can't handle but ElevenLabs can
ELEVENLABS_AUDIO_TAGS = re.compile(
    r"\[(?:laughs?|chuckles?|sighs?|gasps?|clears? throat|pause|excited|whisper(?:ing)?|sarcastic|rushed)\]",
    re.IGNORECASE,
)


def parse_segments(text):
    """Parse script into (speaker, text) segments."""
    segments = []
    current_speaker = None
    current_text = []

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            if current_text:
                current_text.append("")
            continue

        match = re.match(r"^(ALEX|SARAH):\s*(.*)", line)
        if match:
            if current_speaker and current_text:
                segments.append((current_speaker, " ".join(t for t in current_text if t)))
            current_speaker = match.group(1)
            current_text = [match.group(2)]
        else:
            if current_speaker:
                current_text.append(line)
            else:
                current_speaker = "ALEX"
                current_text.append(line)

    if current_speaker and current_text:
        segments.append((current_speaker, " ".join(t for t in current_text if t)))

    return segments


def synthesize_elevenlabs(segments, output_mp3):
    """Use ElevenLabs Text-to-Dialogue API."""
    from elevenlabs.client import ElevenLabs
    from elevenlabs.types import DialogueInput

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not set")

    client = ElevenLabs(api_key=api_key)

    # Build dialogue inputs
    inputs = []
    for speaker, text in segments:
        if not text.strip():
            continue
        voice_id = VOICES.get(speaker, VOICES["ALEX"])
        inputs.append(DialogueInput(voice_id=voice_id, text=text))

    print(f"Sending {len(inputs)} segments to ElevenLabs...", file=sys.stderr)

    from elevenlabs.types import ModelSettingsResponseModel

    response = client.text_to_dialogue.convert(
        inputs=inputs,
        model_id="eleven_v3",
        settings=ModelSettingsResponseModel(
            stability=0.3,          # more expressive, less robotic
            similarity_boost=0.75,  # balanced voice consistency
        ),
    )

    # Response is an iterator of audio bytes
    with open(output_mp3, "wb") as f:
        for chunk in response:
            f.write(chunk)

    print(f"Saved {output_mp3} ({len(inputs)} segments)", file=sys.stderr)


def synthesize_kokoro(segments, output_mp3):
    """Fallback: use Kokoro-82M locally."""
    import numpy as np
    import subprocess

    SAMPLE_RATE = 24000
    KOKORO_VOICES = {"ALEX": "am_adam", "SARAH": "af_sarah"}

    from kokoro_mlx import KokoroTTS
    import soundfile as sf

    tts = KokoroTTS.from_pretrained("mlx-community/Kokoro-82M-bf16")

    all_audio = []
    silence = np.zeros((int(SAMPLE_RATE * 0.05), 2), dtype=np.float32)

    for i, (speaker, text_segment) in enumerate(segments):
        if not text_segment.strip():
            continue

        # Strip audio tags Kokoro can't handle
        clean_text = ELEVENLABS_AUDIO_TAGS.sub("...", text_segment)
        if not clean_text.strip() or clean_text.strip() == "...":
            all_audio.append(silence)
            continue

        voice = KOKORO_VOICES.get(speaker, "am_adam")
        print(f"  [{i+1}/{len(segments)}] {speaker} ({voice}): {clean_text[:60]}...", file=sys.stderr)

        result = tts.generate(clean_text, voice=voice, sample_rate=SAMPLE_RATE)
        mono = np.array(result.audio, dtype=np.float32)

        # Simple stereo panning
        left_gain = 0.7 if speaker == "ALEX" else 0.3
        right_gain = 0.3 if speaker == "ALEX" else 0.7
        stereo = np.column_stack([mono * left_gain, mono * right_gain])
        all_audio.append(stereo)
        all_audio.append(silence)

    if not all_audio:
        raise RuntimeError("No audio generated")

    combined = np.concatenate(all_audio)
    wav_path = output_mp3.rsplit(".", 1)[0] + ".wav"
    sf.write(wav_path, combined, SAMPLE_RATE)

    subprocess.run(
        ["ffmpeg", "-i", wav_path, "-b:a", "128k", "-y", output_mp3],
        check=True,
        capture_output=True,
    )
    os.remove(wav_path)
    print(f"Saved {output_mp3} ({len(segments)} segments, {len(combined)/SAMPLE_RATE:.1f}s)", file=sys.stderr)


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 tts.py <input_text_file> <output_mp3_path>", file=sys.stderr)
        sys.exit(1)

    text_file = sys.argv[1]
    output_mp3 = sys.argv[2]

    with open(text_file, "r") as f:
        text = f.read()

    if not text.strip():
        print("Error: input text is empty", file=sys.stderr)
        sys.exit(1)

    segments = parse_segments(text)
    if not segments:
        print("Error: no speaker segments found", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(segments)} segments", file=sys.stderr)

    # Try ElevenLabs first, fall back to Kokoro
    if os.environ.get("ELEVENLABS_API_KEY"):
        try:
            synthesize_elevenlabs(segments, output_mp3)
            return
        except Exception as e:
            print(f"ElevenLabs failed: {e}, falling back to Kokoro", file=sys.stderr)

    synthesize_kokoro(segments, output_mp3)


if __name__ == "__main__":
    main()
