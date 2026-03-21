"""
Multi-voice TTS synthesis using Kokoro-82M via MLX.
Parses ALEX:/SARAH: speaker markers and generates audio with different voices.
Usage: python3 tts.py <input_text_file> <output_mp3_path>
"""
import sys
import subprocess
import os
import re
import numpy as np


VOICES = {
    "ALEX": "am_adam",
    "SARAH": "af_sarah",
}
DEFAULT_VOICE = "am_adam"
SAMPLE_RATE = 24000


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
            # Save previous segment
            if current_speaker and current_text:
                segments.append((current_speaker, " ".join(t for t in current_text if t)))
            current_speaker = match.group(1)
            current_text = [match.group(2)]
        else:
            # Continuation of current speaker
            if current_speaker:
                current_text.append(line)
            else:
                # No speaker marker yet — use default
                current_speaker = "ALEX"
                current_text.append(line)

    # Save last segment
    if current_speaker and current_text:
        segments.append((current_speaker, " ".join(t for t in current_text if t)))

    return segments


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

    from kokoro_mlx import KokoroTTS
    import soundfile as sf

    tts = KokoroTTS.from_pretrained("mlx-community/Kokoro-82M-bf16")

    all_audio = []
    # Small silence between speakers (0.3s)
    silence = np.zeros(int(SAMPLE_RATE * 0.3), dtype=np.float32)

    for i, (speaker, text_segment) in enumerate(segments):
        if not text_segment.strip():
            continue
        voice = VOICES.get(speaker, DEFAULT_VOICE)
        print(f"  [{i+1}/{len(segments)}] {speaker} ({voice}): {text_segment[:60]}...", file=sys.stderr)

        result = tts.generate(text_segment, voice=voice, sample_rate=SAMPLE_RATE)
        audio_array = np.array(result.audio, dtype=np.float32)
        all_audio.append(audio_array)
        all_audio.append(silence)

    if not all_audio:
        print("Error: no audio generated", file=sys.stderr)
        sys.exit(1)

    # Concatenate all segments
    combined = np.concatenate(all_audio)

    wav_path = output_mp3.rsplit(".", 1)[0] + ".wav"
    sf.write(wav_path, combined, SAMPLE_RATE)

    subprocess.run(
        ["ffmpeg", "-i", wav_path, "-b:a", "128k", "-y", output_mp3],
        check=True,
        capture_output=True,
    )

    os.remove(wav_path)
    print(f"Saved {output_mp3} ({len(segments)} segments, {len(combined)/SAMPLE_RATE:.1f}s)")


if __name__ == "__main__":
    main()
