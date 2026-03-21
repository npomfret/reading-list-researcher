"""
Multi-voice TTS synthesis using ElevenLabs Text-to-Dialogue API.
Parses ALEX:/SARAH: speaker markers, chunks to stay under the 5000-char
limit, and concatenates the resulting audio.
Usage: python3 tts.py <input_text_file> <output_mp3_path>
"""
import sys
import os
import re
import io
import subprocess

MAX_CHARS = 4500  # stay safely under ElevenLabs' 5000-char limit

# ElevenLabs voice IDs
VOICES = {
    "ALEX": "TX3LPaxmHKxFdv7VOQHJ",   # Liam - young male, conversational
    "SARAH": "pFZP5JQG7iQjIQuC4Bku",   # Lily - velvety, confident, British
}


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


def chunk_inputs(inputs, max_chars):
    """Split dialogue inputs into chunks that fit within the char limit."""
    chunks = []
    current_chunk = []
    current_chars = 0

    for inp in inputs:
        text_len = len(inp.text)
        if current_chunk and current_chars + text_len > max_chars:
            chunks.append(current_chunk)
            current_chunk = []
            current_chars = 0
        current_chunk.append(inp)
        current_chars += text_len

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def synthesize_elevenlabs(segments, output_mp3):
    """Use ElevenLabs Text-to-Dialogue API, chunking to stay under char limit."""
    from elevenlabs.client import ElevenLabs
    from elevenlabs.types import DialogueInput, ModelSettingsResponseModel

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

    total_chars = sum(len(i.text) for i in inputs)
    chunks = chunk_inputs(inputs, MAX_CHARS)
    print(f"ElevenLabs: {len(inputs)} segments, {total_chars} chars, {len(chunks)} chunk(s)", file=sys.stderr)

    settings = ModelSettingsResponseModel(
        stability=0.3,
        similarity_boost=0.75,
    )

    if len(chunks) == 1:
        # Single chunk — write directly
        response = client.text_to_dialogue.convert(
            inputs=chunks[0], model_id="eleven_v3", settings=settings,
        )
        with open(output_mp3, "wb") as f:
            for data in response:
                f.write(data)
    else:
        # Multiple chunks — synthesize each, then concatenate with ffmpeg
        tmp_files = []
        for i, chunk in enumerate(chunks):
            print(f"  Chunk {i+1}/{len(chunks)} ({sum(len(x.text) for x in chunk)} chars, {len(chunk)} segments)", file=sys.stderr)
            response = client.text_to_dialogue.convert(
                inputs=chunk, model_id="eleven_v3", settings=settings,
            )
            tmp_path = output_mp3.replace(".mp3", f".part{i}.mp3")
            with open(tmp_path, "wb") as f:
                for data in response:
                    f.write(data)
            tmp_files.append(tmp_path)

        # Concatenate with ffmpeg
        concat_list = output_mp3.replace(".mp3", ".concat.txt")
        with open(concat_list, "w") as f:
            for tmp in tmp_files:
                f.write(f"file '{tmp}'\n")

        subprocess.run(
            ["ffmpeg", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", "-y", output_mp3],
            check=True, capture_output=True,
        )

        # Clean up temp files
        os.remove(concat_list)
        for tmp in tmp_files:
            os.remove(tmp)

    print(f"Saved {output_mp3}", file=sys.stderr)


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

    synthesize_elevenlabs(segments, output_mp3)


if __name__ == "__main__":
    main()
