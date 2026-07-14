from faster_whisper import WhisperModel

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

segments, info = model.transcribe(
    "test.wav",
    language="ta",              # 🔴 FORCE Tamil
    task="transcribe",          # 🔴 DO NOT translate
    beam_size=5,                # 🔴 Better accuracy
    vad_filter=True,            # 🔴 Ignore noise
    initial_prompt=(
        "Tamil-English mixed Tanglish speech. "
        "Medical app commands like dentist, hospital, clinic, reminder, prescription."
    )
)

print("Detected language:", info.language)
for s in segments:
    print(s.text)
