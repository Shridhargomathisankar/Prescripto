import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../config/api';

const synth = window.speechSynthesis;

/**
 * Voice assistant (Patient side)
 * Flow:
 * Mic → MediaRecorder → /api/voice/stt (Whisper)
 * → text → /api/voice/intent (Ollama)
 * → navigate
 */
export default function VoiceAssistant({ onNavigateView }) {
  const navigate = useNavigate();
  const { lang, setLanguage, t } = useLanguage();

  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  /* =========================
     Speak (TTS)
  ========================= */
  const speak = useCallback(
    (text, forceLang) => {
      if (!synth) return;
      const langCode =
        forceLang === 'ta'
          ? 'ta-IN'
          : forceLang === 'en'
          ? 'en-IN'
          : lang === 'ta'
          ? 'ta-IN'
          : 'en-IN';

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 0.9;
      synth.cancel();
      synth.speak(utterance);
    },
    [lang]
  );

  /* =========================
     Navigate after intent
  ========================= */
  const navigateToScreen = useCallback(
    (screen) => {
      navigate('/patient/dashboard');
      if (onNavigateView) {
        const view = screen === 'consult-again' ? 'prescriptions' : screen;
        onNavigateView(view);
      }

      const messages = {
        home: lang === 'ta' ? 'முகப்பிற்கு செல்கிறேன்' : 'Going to home',
        prescriptions:
          lang === 'ta'
            ? 'மருந்து பட்டியல் காட்டுகிறேன்'
            : 'Showing prescriptions',
        reports:
          lang === 'ta'
            ? 'ஸ்கேன் அறிக்கைகளை காட்டுகிறேன்'
            : 'Showing reports',
        profile: lang === 'ta' ? 'சுயவிவரம்' : 'Profile',
        settings: lang === 'ta' ? 'அமைப்புகள்' : 'Settings',
        maps:
          lang === 'ta'
            ? 'அருகிலுள்ள மருத்துவமனைகளை காட்டுகிறேன்'
            : 'Showing nearby clinics',
        reminders:
          lang === 'ta'
            ? 'மருந்து நினைவூட்டல்கள்'
            : 'Opening reminders',
        'consult-again':
          lang === 'ta'
            ? 'மீண்டும் மருத்துவரைப் பார்க்க வேண்டாம்'
            : 'Opening consult requests',
        notifications:
          lang === 'ta'
            ? 'அறிவிப்புகள்'
            : 'Showing notifications',
      };

      speak(messages[screen] || messages.home);
    },
    [navigate, onNavigateView, lang, speak]
  );

  /* =========================
     Handle final text
  ========================= */
  const handleText = useCallback(
    async (text) => {
      const clean = (text || '').trim();
      if (!clean) {
        speak(
          lang === 'ta'
            ? 'கட்டளையை புரியவில்லை'
            : 'Command not understood'
        );
        return;
      }

      try {
        const res = await api.voice.intent(null, clean);

        if (res?.screen && !res.fallback) {
          navigateToScreen(res.screen);
          return;
        }
      } catch (e) {
        // ignore – fallback handled below
      }

      speak(
        lang === 'ta'
          ? 'கட்டளையை புரியவில்லை. மீண்டும் சொல்லுங்கள்'
          : 'Command not understood. Please try again.'
      );
    },
    [lang, speak, navigateToScreen]
  );

  /* =========================
     Start Recording (Mic)
  ========================= */
  const startListening = async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Mic not supported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setListening(false);

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        try {
          const sttRes = await api.voice.stt(formData);
          handleText(sttRes.text);
        } catch (err) {
          setError('Voice processing failed');
        }
      };

      mediaRecorder.start();
      setListening(true);

      // Auto stop after 4 seconds
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 4000);
    } catch (err) {
      setError('Mic permission denied');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setListening(false);
  };

  const handleMicClick = () => {
    if (listening) stopListening();
    else startListening();
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Language toggle */}
      <button
        type="button"
        onClick={() => setLanguage(lang === 'ta' ? 'en' : 'ta')}
        className="px-3 py-1 rounded-full bg-white/90 border border-teal-100 text-xs font-medium text-teal-700 shadow-sm backdrop-blur"
      >
        {lang === 'ta' ? 'தமிழ்' : 'EN'}
      </button>

      {error && (
        <div className="w-48 p-2 rounded-lg bg-amber-100 text-amber-800 text-xs shadow">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleMicClick}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          listening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        }`}
        aria-label="Voice assistant"
      >
        <MicIcon listening={listening} />
      </button>
    </div>
  );
}

/* =========================
   Mic Icon
========================= */
function MicIcon({ listening }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6"
    >
      {listening ? (
        <path d="M6 19h4v2H6v-2zm10 0h4v2h-4v-2zm-5-3v2h2v-2h-2zm-5-10h2v6H6V6zm10 0h2v6h-2V6zm-5 4h2v6h-2v-6z" />
      ) : (
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      )}
    </svg>
  );
}
