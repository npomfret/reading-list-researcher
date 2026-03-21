# Task 14: Text-to-Voice Research and Recommendation

## Research Summary
Research was conducted to identify the best Text-to-Speech (TTS) solution for Apple Silicon (M1-M4) in 2024-2025. The goal was to find a balance between high-fidelity natural speech, low latency, and efficient use of local hardware (Neural Engine/GPU).

### 1. Primary Recommendation: Kokoro-82M (MLX Optimized)
**Kokoro-82M** is a state-of-the-art, lightweight (82M parameter) neural TTS model. When run using the **MLX** framework (Apple's native machine learning framework), it is the most performant and high-quality local option available.

- **Quality:** Human-like prosody, comparable to cloud services like ElevenLabs.
- **Performance:** Generates audio at ~20x real-time speed on M-series chips.
- **Privacy:** 100% offline; no data leaves the device.
- **Efficiency:** Small memory footprint (~300MB VRAM).

#### Implementation Steps:
1. **Install Dependencies:**
   ```bash
   pip install kokoro-mlx mlx-audio
   ```
2. **Usage Example:**
   ```python
   from kokoro_mlx import KokoroTTS
   tts = KokoroTTS.from_pretrained("mlx-community/Kokoro-82M-bf16")
   audio = tts.speak("Hello! This is Kokoro running locally on Apple Silicon.", voice="af_bella")
   audio.save("output.wav")
   ```

---

### 2. Alternative Options

#### A. Native macOS (AVSpeechSynthesizer)
- **Best for:** Zero-dependency, lightweight system utilities.
- **Note:** Requires manual download of "Premium" voices in System Settings (Accessibility > Spoken Content).
- **Pros:** Built-in, zero latency, supports "Personal Voice".
- **Cons:** Less expressive than Kokoro-82M.

#### B. Piper TTS (ONNX)
- **Best for:** Ultra-low latency, real-time UI feedback.
- **Pros:** Extremely fast, works on base 8GB Mac models with minimal impact.
- **Cons:** More "robotic" than neural models like Kokoro.

#### C. Cloud APIs (ElevenLabs / Cartesia)
- **Best for:** Production-scale multi-user apps, complex emotional requirements.
- **Pros:** State-of-the-art quality, no local hardware requirements.
- **Cons:** Cost per character, requires internet, privacy concerns.

---

## Final Recommendation
For developers building on Apple Silicon, **Kokoro-82M via MLX** is the clear winner for 2025. It provides "cloud-level" quality with the speed and privacy of local execution.

**Next Steps:**
- Integrate `kokoro-mlx` into the `reading-list-researcher` as an optional output processor.
- Store synthesized audio files alongside the HTML reports for a "listenable" reading list experience.
