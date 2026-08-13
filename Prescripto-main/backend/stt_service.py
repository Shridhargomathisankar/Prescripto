import sys

try:
    from faster_whisper import WhisperModel
except ModuleNotFoundError:
    print(
        "Missing Python package: faster-whisper. "
        "Install it with: python -m pip install -r backend/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python stt_service.py <audio-file>", file=sys.stderr)
    sys.exit(2)

audio_path = sys.argv[1]

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

segments, info = model.transcribe(
    audio_path,
    language="ta",          # Tanglish handled as Tamil base
    task="transcribe",
    beam_size=5,
    vad_filter=True,
    initial_prompt=(
        "Tamil-English mixed Tanglish speech. "
        "Medical app commands like dentist, hospital, clinic, reminder, prescription."
    )
)

text = " ".join([s.text.strip() for s in segments])
print(text)
