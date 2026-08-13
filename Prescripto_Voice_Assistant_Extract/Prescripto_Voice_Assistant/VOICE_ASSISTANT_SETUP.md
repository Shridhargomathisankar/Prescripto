# Prescripto Voice Assistant — Extracted Files

This package contains the voice-assistant-related source files extracted from the uploaded Prescripto project.

## What is included
- `frontend/src/components/VoiceAssistant.jsx` — main voice UI, browser speech recognition, speech synthesis, 5-language commands, navigation, Gemini chat integration.
- `frontend/src/contexts/LanguageContext.jsx` — English/Tamil/Hindi/Telugu/Malayalam language state used by the assistant.
- `frontend/src/contexts/AuthContext.jsx` — included because the assistant uses the existing `logout()` action.
- `frontend/src/config/api.js` — included because the assistant calls `/api/voice/chat`.
- `frontend/src/config/firebase.js` — dependency of the existing API/Auth setup.
- `frontend/src/i18n/translations.js` — dependency of `LanguageContext`.
- `backend/src/routes/voice.js` — Gemini-backed `/api/voice/chat` endpoint.
- `frontend/package.json` and `backend/package.json` — required package references.

## Important
No `.env` file or secret/API key is included. The Gemini key must be configured in the friend's backend environment as `GEMINI_API_KEY`. Firebase frontend variables must be configured if the original Auth/API setup is reused.

## Voice processing used by this version
The uploaded project uses the browser Web Speech API for speech-to-text (`SpeechRecognition` / `webkitSpeechRecognition`) and browser `speechSynthesis` for spoken responses. Gemini is used by the backend for non-navigation medical questions through `/api/voice/chat`.

## Integration
Render `<VoiceAssistant />` inside the authenticated page/layout. If the parent supplies `onNavigateView`, map these view names to the friend's routes/views:
- `prescriptions`
- `reports`
- `home`
- `medicines`
- `consult-again`
- `profile`
- `settings`
- `logout`

The assistant supports: English (`en`), Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Malayalam (`ml`).

## Backend
Mount the extracted voice router as:
`app.use('/api/voice', voiceRoutes)`

The backend must have the `@google/generative-ai` package and `GEMINI_API_KEY` configured.

## Do not copy
Do not copy the original project's `node_modules`, `.git`, or `.env` files.
