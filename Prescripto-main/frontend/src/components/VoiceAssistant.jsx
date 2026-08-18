import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { voiceService } from '../services/voiceService';
import { detectLocalIntent } from '../services/intentEngine';
import { api } from '../config/api';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

export default function VoiceAssistant({ onNavigateView, voiceRef }) {
  const navigate = useNavigate();
  const { lang, setLanguage } = useLanguage();
  const { user, logout, getToken } = useAuth();
  const userRole = user?.role || 'patient';

  // 5-State Voice UX: 'ready' | 'listening' | 'processing' | 'speaking' | 'error'
  const [voiceState, setVoiceState] = useState('ready');
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Session duplicate protection lock & safety timers
  const sessionLockRef = useRef(null);
  const processingTimerRef = useRef(null);

  const clearProcessingTimer = () => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  };

  /* =========================
     Speak (Native Web Speech TTS synced with lang)
  ========================= */
  const speak = useCallback(
    (text, forceLang) => {
      if (!synth) {
        setVoiceState('ready');
        setStatusMessage('');
        return;
      }
      const targetLang = forceLang || lang;
      const langCode =
        targetLang === 'ta'
          ? 'ta-IN'
          : targetLang === 'hi'
          ? 'hi-IN'
          : targetLang === 'ml'
          ? 'ml-IN'
          : targetLang === 'te'
          ? 'te-IN'
          : 'en-IN';

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 1.0;

      utterance.onstart = () => {
        setVoiceState('speaking');
        setStatusMessage(text);
      };

      utterance.onend = () => {
        setVoiceState('ready');
        setStatusMessage('');
      };

      utterance.onerror = () => {
        setVoiceState('ready');
        setStatusMessage('');
      };

      synth.cancel();
      synth.speak(utterance);
    },
    [lang]
  );

  /* =========================
     Execute Approved Intent Navigation
  ========================= */
  const executeIntentAction = useCallback(
    (matched) => {
      clearProcessingTimer();
      setPendingConfirmation(null);
      speak(matched.spoken);

      if (matched.isAction && matched.target === 'logout') {
        logout();
        navigate('/', { replace: true });
        return;
      }

      if (matched.isView) {
        if (userRole === 'doctor') {
          navigate('/doctor/dashboard');
        } else if (userRole === 'pharmacy') {
          navigate('/pharmacy/dashboard');
        } else {
          navigate('/patient/dashboard');
        }

        if (onNavigateView) {
          onNavigateView(matched.target);
        }
      } else {
        navigate(matched.target);
      }
    },
    [userRole, speak, navigate, onNavigateView, logout]
  );

  /* =========================
     Universal Multi-Language Voice Pipeline Dispatcher
     UI Language is Independent of Spoken Language
  ========================= */
  const processVoiceCommand = useCallback(
    async (spokenText) => {
      const cleanText = String(spokenText || '').trim();
      if (!cleanText) return;

      // Duplicate Session Lock Protection
      if (sessionLockRef.current === cleanText) {
        console.log('[VOICE DEBUG] Session lock active: duplicate command ignored');
        return;
      }
      sessionLockRef.current = cleanText;

      setVoiceState('processing');
      setStatusMessage('Understanding...');
      setPendingConfirmation(null);

      // 5-Second Processing Safety Timeout
      clearProcessingTimer();
      processingTimerRef.current = setTimeout(() => {
        console.warn('[VOICE DEBUG] 5-second processing timeout triggered. Resetting to READY.');
        setVoiceState('ready');
        setStatusMessage('');
        setError("I couldn't hear that. Tap the mic and try again.");
      }, 5000);

      // Detect Intent across ALL language dictionaries simultaneously (Universal Multi-Language Mode)
      const matched = detectLocalIntent(cleanText, lang, userRole);

      // Console Development Logging
      console.log(`[VOICE DEBUG]
UI Language: ${lang}
Voice Recognition Locale: en-IN
Transcript: "${cleanText}"
Normalized Transcript: "${matched?.normalized || ''}"
Detected Language/Style: ${matched?.detectedStyle || 'Tanglish'}
Matched Dictionary: ${matched?.matchedDictionary || 'Tanglish'}
Matched Intent: ${matched?.intent || (matched?.isAiQuestion ? 'ai_question' : 'none')}
Confidence: ${matched?.confidence || 0}
Action: ${matched?.confidenceLevel === 'high' ? `navigate('/patient/dashboard?view=${matched.target}')` : matched?.confidenceLevel === 'medium' ? 'SHOW_CONFIRMATION_PILL' : matched?.isAiQuestion ? 'AI_FALLBACK' : 'RETRY_PROMPT'}`);

      // LAYER 3: General AI Health Question Fallback -> POST /api/voice/chat
      if (matched && matched.isAiQuestion) {
        try {
          const token = await getToken();
          const chatRes = await api.voice.chat(token, { text: matched.query, lang });
          clearProcessingTimer();
          if (chatRes && (chatRes.response || chatRes.answer)) {
            const answerText = chatRes.response || chatRes.answer;
            speak(answerText);
            return;
          }
        } catch (_) {
          clearProcessingTimer();
        }

        speak(
          lang === 'ta'
            ? 'மருத்துவ கேள்விகளுக்கு தயவுசெய்து உங்கள் மருத்துவரை அணுகவும்.'
            : 'Please consult your doctor for detailed medical advice.'
        );
        return;
      }

      // LAYER 2: Medium Confidence (3.5 - 4.9) -> Ask Confirmation
      if (matched && matched.confidenceLevel === 'medium') {
        clearProcessingTimer();
        setVoiceState('ready');
        setStatusMessage('');
        setPendingConfirmation(matched);
        speak(
          lang === 'ta'
            ? `${matched.target} பக்கத்திற்கு செல்ல விரும்புகிறீர்களா?`
            : `Did you mean ${matched.intent}?`
        );
        return;
      }

      // LAYER 1: High Confidence (>= 5.0) -> Execute Navigation Immediately
      if (matched && matched.confidenceLevel === 'high') {
        executeIntentAction(matched);
        return;
      }

      // Unrecognized / Negation / Low Confidence
      clearProcessingTimer();
      speak(
        lang === 'ta'
          ? 'கட்டளையை புரியவில்லை. மீண்டும் சொல்லுங்கள்'
          : lang === 'hi'
          ? 'कमांड समझ नहीं आई। कृपया पुनः प्रयास करें।'
          : lang === 'ml'
          ? 'കമാൻഡ് മനസ്സിലായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.'
          : lang === 'te'
          ? 'కమాండ్ అర్థం కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.'
          : 'Sorry, I didn\'t understand. Please try again.'
      );
    },
    [lang, userRole, speak, executeIntentAction, getToken]
  );

  /* =========================
     Mic Toggle Handler via VoiceService Abstraction
  ========================= */
  const toggleMic = useCallback(() => {
    clearProcessingTimer();
    setError(null);
    setPendingConfirmation(null);
    sessionLockRef.current = null; // Reset duplicate session lock

    if (voiceState === 'listening') {
      voiceService.stop();
      setVoiceState('ready');
      setStatusMessage('');
      return;
    }

    voiceService.start({
      lang,
      onStart: () => {
        setVoiceState('listening');
        setError(null);
        setStatusMessage('Listening... Speak now');
      },
      onResult: ({ transcript }) => {
        processVoiceCommand(transcript);
      },
      onError: ({ message }) => {
        clearProcessingTimer();
        setVoiceState('ready');
        setError(message || "I couldn't hear that. Tap the mic and try again.");
        setStatusMessage('');
      },
      onEnd: () => {
        clearProcessingTimer();
        setVoiceState((prev) => (prev === 'listening' ? 'ready' : prev));
      },
    });
  }, [lang, voiceState, processVoiceCommand]);

  useEffect(() => {
    if (voiceRef) {
      voiceRef.current = { toggleMic };
    }
    return () => {
      clearProcessingTimer();
    };
  }, [voiceRef, toggleMic]);

  const currentLangObj = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';
  const isSpeaking = voiceState === 'speaking';

  return (
    <div className="flex fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 items-center gap-2.5 sm:gap-3">
      {/* LAYER 2: Medium Confidence Confirmation UI Pill */}
      {pendingConfirmation && (
        <div className="bg-white/95 border border-blue-200 text-slate-800 p-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <span>Did you mean <strong>{pendingConfirmation.intent}</strong>?</span>
          <button
            type="button"
            onClick={() => executeIntentAction(pendingConfirmation)}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setPendingConfirmation(null)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition"
          >
            No
          </button>
        </div>
      )}

      {/* Voice Status / Error Banner */}
      {!pendingConfirmation && (error || statusMessage) && (
        <div
          className={`px-3 py-2 rounded-2xl text-xs font-semibold shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 ${
            error
              ? 'bg-amber-100/95 text-amber-800 border border-amber-300'
              : isListening
              ? 'bg-red-500/95 text-white animate-pulse'
              : isProcessing
              ? 'bg-sky-500/95 text-white'
              : isSpeaking
              ? 'bg-emerald-600/95 text-white'
              : 'bg-slate-800/95 text-white'
          }`}
        >
          {error || statusMessage}
        </div>
      )}

      {/* UI Language Selector Pill */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setLangDropdownOpen((o) => !o)}
          className="px-3.5 py-2 rounded-full bg-white/95 border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-md hover:bg-slate-50 transition flex items-center gap-1.5 min-h-[48px]"
        >
          <span>🌐</span>
          <span>{currentLangObj.native}</span>
          <span className="text-[10px] text-slate-400">▼</span>
        </button>

        {langDropdownOpen && (
          <div className="absolute bottom-12 left-0 w-36 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setLangDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-blue-50 hover:text-blue-600 transition min-h-[44px] ${
                  lang === l.code ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                }`}
              >
                <span>{l.native}</span>
                <span className="text-[10px] text-slate-400">({l.label})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Microphone Button */}
      <button
        type="button"
        onClick={toggleMic}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all border-2 border-white/60 min-h-[48px] min-w-[48px] ${
          isListening
            ? 'bg-red-500 text-white animate-pulse scale-110 ring-4 ring-red-400/40'
            : isProcessing
            ? 'bg-sky-500 text-white animate-bounce ring-4 ring-sky-400/40'
            : isSpeaking
            ? 'bg-emerald-500 text-white ring-4 ring-emerald-400/40'
            : 'bg-gradient-to-tr from-blue-600 to-teal-500 text-white hover:shadow-2xl hover:scale-105 active:scale-95'
        }`}
        aria-label="Voice assistant"
        title="Click to speak navigation command"
      >
        <MicIcon listening={isListening} processing={isProcessing} speaking={isSpeaking} />
      </button>
    </div>
  );
}

function MicIcon({ listening, processing, speaking }) {
  if (processing) {
    return (
      <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  }

  if (speaking) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M13.5 4.06c0-.84-.96-1.3-1.61-.76l-4.5 3.7H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h3.39l4.5 3.7c.65.54 1.61.08 1.61-.76V4.06zM17.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      </svg>
    );
  }

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
