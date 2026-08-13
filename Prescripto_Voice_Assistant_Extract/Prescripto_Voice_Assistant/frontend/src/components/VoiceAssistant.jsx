import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../config/api';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/**
 * 🎯 5-Language Command Rules (English, Tamil, Hindi, Telugu, Malayalam)
 */
const COMMAND_RULES = [
  {
    screen: 'prescriptions',
    spokenResponse: {
      en: 'Opening Prescription',
      ta: 'பிரிஸ்கிரிப்ஷன் திறக்கிறேன்',
      hi: 'प्रिस्क्रिप्शन खोल रहा हूँ',
      te: 'ప్రిస్క్రిప్షన్ తెరుస్తున్నాను',
      ml: 'പ്രിസ്ക്രിപ്ഷൻ തുറക്കുന്നു',
    },
    keywords: [
      'prescription',
      'prescriptions',
      'show prescription',
      'open prescription',
      'prescription page',
      'medicine list',
      'prescription kaatu',
      'prescription open',
      'மாத்திரை',
      'மருந்து',
      'பிரிஸ்கிரிப்ஷன்',
      'பிரிஸ்கிரிப்ஷன் காட்டு',
      'प्रिस्क्रिप्शन दिखाओ',
      'प्रिस्क्रिप्शन खोलो',
      'पॉस्क्रिप्शन',
      'ప్రిస్క్రిప్షన్ చూపించండి',
      'ప్రిస్క్రిప్షన్ తెరవండి',
      'പ്രിസ്ക്രിപ്ഷൻ കാണിക്കുക',
      'പ്രിസ്ക്രിപ്ഷൻ തുറക്കുക',
    ],
  },
  {
    screen: 'reports',
    spokenResponse: {
      en: 'Opening Reports',
      ta: 'அறிக்கைகளை திறக்கிறேன்',
      hi: 'रिपोर्ट खोल रहा हूँ',
      te: 'రిపోర్టులు తెరుస్తున్నాను',
      ml: 'റിപ്പോർട്ടുകൾ തുറക്കുന്നു',
    },
    keywords: [
      'show reports',
      'open reports',
      'report',
      'reports',
      'report kaatu',
      'scan report',
      'lab results',
      'அறிக்கை',
      'ரிப்போர்ட் காட்டு',
      'रिपोर्ट खोलो',
      'रिपोर्ट दिखाओ',
      'రిపోర్ట్ తెరవండి',
      'రిపోర్ట్ చూపించండి',
      'റിപ്പോർട്ട് തുറക്കുക',
      'റിപ്പോർട്ട് കാണിക്കുക',
    ],
  },
  {
    screen: 'home',
    spokenResponse: {
      en: 'Opening Dashboard',
      ta: 'டாஷ்போர்டு திறக்கிறேன்',
      hi: 'डैशबोर्ड खोल रहा हूँ',
      te: 'డాష్‌బోర్డ్ తెరుస్తున్నాను',
      ml: 'ഡാഷ്‌ബോർഡ് തുറക്കുന്നു',
    },
    keywords: [
      'go home',
      'open dashboard',
      'go to home',
      'home po',
      'dashboard open',
      'home page',
      'main page',
      'home',
      'dashboard',
      'முகப்பு',
      'டாஷ்போர்டு திற',
      'डैशबोर्ड खोलो',
      'होम पर जाओ',
      'होम',
      'డాష్బోర్డ్ తెరవండి',
      'హోమ్కు వెళ్లండి',
      'హోమ్',
      'ഡാഷ്ബോർഡ് തുറക്കുക',
      'ഹോം തുറക്കുക',
      'ഹോം',
    ],
  },
  {
    screen: 'medicines',
    spokenResponse: {
      en: 'Opening Medicines',
      ta: 'மருந்துகளை காட்டுகிறேன்',
      hi: 'दवाइयाँ खोल रहा हूँ',
      te: 'మందులు తెరుస్తున్నాను',
      ml: 'മരുന്നുകൾ തുറക്കുന്നു',
    },
    keywords: [
      'open medicines',
      'show medicines',
      'medicines',
      'medicine kaatu',
      'marundhu kaatu',
      'medicine list',
      'மருந்து காட்டு',
      'दवाइयाँ दिखाओ',
      'दवाइयाँ खोलो',
      'మందులు చూపించండి',
      'మందులు తెరవండి',
      'മരുന്നുകൾ കാണിക്കുക',
      'മരുന്നുകൾ തുറക്കുക',
    ],
  },
  {
    screen: 'consult-again',
    spokenResponse: {
      en: 'Opening Appointments',
      ta: 'சந்திப்புகளை திறக்கிறேன்',
      hi: 'अपॉइंटमेंट खोल रहा हूँ',
      te: 'అపాయింట్‌మెంట్‌లు తెరుస్తున్నాను',
      ml: 'അപ്പോയിന്റ്മെന്റുകൾ തുറക്കുന്നു',
    },
    keywords: [
      'open appointments',
      'show appointments',
      'appointments',
      'consult again',
      'naan doctor paakanum',
      'consult doctor',
      'appointment',
      'book consultation',
      'மருத்துவரைப் பார்க்க',
      'अपॉइंटमेंट खोलो',
      'डॉक्टर से परामर्श',
      'అపాయింట్‌మెంట్‌లు తెరవండి',
      'അപ്പോയിന്റ്മെന്റുകൾ തുറക്കുക',
    ],
  },
  {
    screen: 'profile',
    spokenResponse: {
      en: 'Opening Profile',
      ta: 'சுயவிவரம் திறக்கிறேன்',
      hi: 'प्रोफ़ाइल खोल रहा हूँ',
      te: 'ప్రొఫైల్ తెరుస్తున్నాను',
      ml: 'പ്രൊഫൈൽ തുറക്കുന്നു',
    },
    keywords: [
      'show profile',
      'open profile',
      'profile',
      'profile kaatu',
      'patient profile',
      'doctor profile',
      'my details',
      'account',
      'சுயவிவரம்',
      'புரொபைல் திற',
      'प्रोफाइल खोलो',
      'प्रोफाइल दिखाओ',
      'ప్రొఫైల్ తెరవండి',
      'ప్రൊഫൈൽ തുറക്കുക',
    ],
  },
  {
    screen: 'settings',
    spokenResponse: {
      en: 'Opening Settings',
      ta: 'அமைப்புகள் திறக்கிறேன்',
      hi: 'सेटिंग्स खोल रहा हूँ',
      te: 'సెట్టింగ్‌లు తెరుస్తున్నాను',
      ml: 'സെറ്റിംഗ്സ് തുറക്കുന്നു',
    },
    keywords: [
      'open settings',
      'show settings',
      'settings',
      'app settings',
      'change language',
      'அமைப்புகள்',
      'सेटिंग्स खोलो',
      'సెట్టింగ్స్ తెరవండి',
      'സെറ്റിംഗ്സ് തുറക്കുക',
    ],
  },
  {
    screen: 'logout',
    spokenResponse: {
      en: 'Logging Out',
      ta: 'வெளியேறுகிறேன்',
      hi: 'लॉग आउट हो रहा है',
      te: 'లాగౌట్ అవుతోంది',
      ml: 'ലോഗ് ഔട്ട് ചെയ്യുന്നു',
    },
    keywords: [
      'logout',
      'log out',
      'sign out',
      'logout pannu',
      'வெளியேறு',
      'लॉगआउट करो',
      'लॉग आउट',
      'లాగౌట్ చేయండి',
      'ലോഗ്ഔട്ട് ചെയ്യുക',
    ],
  },
];

const ERROR_MESSAGES = {
  en: "I couldn't understand. Please try again.",
  ta: 'எனக்கு புரியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
  hi: 'मुझे समझ नहीं आया। कृपया पुनः प्रयास करें।',
  te: 'నాకు అర్థం కాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  ml: 'എനിക്ക് മനസ്സിലായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
};

export default function VoiceAssistant({ onNavigateView }) {
  const navigate = useNavigate();
  const { lang, setLanguage } = useLanguage();
  const { logout } = useAuth();

  // Status: 'closed' | 'listening' | 'recognizing' | 'navigating' | 'thinking' | 'speaking' | 'error'
  const [status, setStatus] = useState('closed');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [targetViewName, setTargetViewName] = useState('');

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const voicesRef = useRef([]);

  /* Load Voices for Speech Synthesis */
  const loadVoices = useCallback(() => {
    if (!synth) return;
    voicesRef.current = synth.getVoices();
  }, []);

  useEffect(() => {
    loadVoices();
    if (synth && synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
  }, [loadVoices]);

  const getBestVoice = useCallback((detectedLang) => {
    const voices = voicesRef.current.length > 0 ? voicesRef.current : synth ? synth.getVoices() : [];
    if (!voices || voices.length === 0) return null;

    const langCodes = {
      ta: 'ta-IN',
      hi: 'hi-IN',
      te: 'te-IN',
      ml: 'ml-IN',
      en: 'en-IN',
    };

    const targetCode = langCodes[detectedLang] || 'en-IN';
    const exactVoice = voices.find((v) => v.lang === targetCode || v.lang.startsWith(detectedLang));
    if (exactVoice) return exactVoice;

    const inEngVoice = voices.find(
      (v) => v.lang === 'en-IN' || (v.lang.includes('en') && v.name.includes('India'))
    );
    if (inEngVoice) return inEngVoice;

    return voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synth) {
      synth.cancel();
    }
  }, []);

  const speakText = useCallback(
    (text, textLang = 'en', onDone) => {
      if (!synth) {
        if (onDone) onDone();
        return;
      }

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getBestVoice(textLang);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        const langCodes = { ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN', ml: 'ml-IN', en: 'en-IN' };
        utterance.lang = langCodes[textLang] || 'en-IN';
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (status !== 'navigating') setStatus('speaking');
      };

      utterance.onend = () => {
        if (onDone) onDone();
      };

      utterance.onerror = () => {
        if (onDone) onDone();
      };

      synth.speak(utterance);
    },
    [getBestVoice, stopSpeaking, status]
  );

  /* Local Command Analysis (Instant Execution <200ms) */
  const analyzeCommand = useCallback((text) => {
    const clean = text.toLowerCase().trim();
    for (const rule of COMMAND_RULES) {
      if (rule.keywords.some((kw) => clean.includes(kw))) {
        return rule;
      }
    }
    return null;
  }, []);

  /* Process Recognized Speech */
  const handleFinalSpeech = useCallback(
    async (text) => {
      const cleanText = text.trim();
      if (!cleanText) {
        setStatus('error');
        setErrorMessage(ERROR_MESSAGES[lang] || ERROR_MESSAGES.en);
        return;
      }

      setFinalTranscript(cleanText);

      // Check Local Instant Navigation Commands (<200ms latency)
      const matchedRule = analyzeCommand(cleanText);

      if (matchedRule) {
        const spokenMsg = matchedRule.spokenResponse[lang] || matchedRule.spokenResponse.en;

        if (matchedRule.screen === 'logout') {
          setStatus('navigating');
          setTargetViewName(spokenMsg);
          speakText(spokenMsg, lang, () => {
            logout();
            navigate('/', { replace: true });
            setStatus('closed');
          });
          return;
        }

        setStatus('navigating');
        setTargetViewName(spokenMsg);

        // Execute local navigation immediately
        if (onNavigateView) {
          onNavigateView(matchedRule.screen);
        } else {
          navigate('/patient/dashboard');
        }

        speakText(spokenMsg, lang, () => {
          setTimeout(() => {
            setStatus('closed');
          }, 400);
        });
        return;
      }

      // Non-navigation Medical Queries -> Send to Gemini AI in selected language
      setStatus('thinking');
      try {
        const response = await api.voice.chat(cleanText, chatHistory, lang);
        const reply = response?.text || 'I am here to assist with your medical questions.';
        setAiReply(reply);

        setChatHistory((prev) => [
          ...prev.slice(-8),
          { role: 'user', text: cleanText },
          { role: 'model', text: reply },
        ]);

        speakText(reply, lang, () => {
          setTimeout(() => {
            setStatus('closed');
          }, 3000);
        });
      } catch (err) {
        console.error('Gemini query error:', err);
        const fallbackMsg = ERROR_MESSAGES[lang] || ERROR_MESSAGES.en;
        setAiReply(fallbackMsg);
        speakText(fallbackMsg, lang, () => {
          setTimeout(() => {
            setStatus('closed');
          }, 2000);
        });
      }
    },
    [analyzeCommand, chatHistory, lang, logout, navigate, onNavigateView, speakText]
  );

  /* Start Microphone (Live Speech Recognition) */
  const startListening = useCallback(() => {
    stopSpeaking();
    setLiveTranscript('');
    setFinalTranscript('');
    setAiReply('');
    setErrorMessage('');
    setTargetViewName('');

    if (!SpeechRecognition) {
      setStatus('error');
      setErrorMessage('Browser Speech Recognition is not supported. Please try Chrome or Edge.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true; // 🔴 LIVE Speech Updates
      
      const langCodes = { ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN', ml: 'ml-IN', en: 'en-IN' };
      recognition.lang = langCodes[lang] || 'en-IN';

      isListeningRef.current = true;

      recognition.onstart = () => {
        setStatus('listening');
      };

      recognition.onresult = (event) => {
        let interimStr = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += trans;
          } else {
            interimStr += trans;
          }
        }

        const currentLive = finalStr || interimStr;
        if (currentLive.trim()) {
          setLiveTranscript(currentLive.trim());
        }

        if (event.results[event.results.length - 1].isFinal) {
          isListeningRef.current = false;
          handleFinalSpeech(currentLive.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListeningRef.current = false;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setStatus('error');
          setErrorMessage('Microphone permission denied. Please enable mic access.');
        } else {
          setStatus('error');
          setErrorMessage(ERROR_MESSAGES[lang] || ERROR_MESSAGES.en);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          isListeningRef.current = false;
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Mic start error:', err);
      isListeningRef.current = false;
      setStatus('error');
      setErrorMessage(ERROR_MESSAGES[lang] || ERROR_MESSAGES.en);
    }
  }, [handleFinalSpeech, lang, stopSpeaking]);

  const closeAssistant = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    stopSpeaking();
    setStatus('closed');
    setLiveTranscript('');
    setFinalTranscript('');
    setAiReply('');
    setErrorMessage('');
  }, [stopSpeaking]);

  const handleMicClick = () => {
    if (status === 'closed') {
      startListening();
    } else {
      closeAssistant();
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return (
    <>
      {/* 🔴 GOOGLE VOICE SEARCH STYLE OVERLAY (CENTERED) */}
      {status !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn transition-all duration-300">
          
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center overflow-hidden border border-slate-100">
            
            {/* Top Bar: Close & Language Indicator */}
            <div className="w-full flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={() => {
                  const nexts = { en: 'ta', ta: 'hi', hi: 'te', te: 'ml', ml: 'en' };
                  setLanguage(nexts[lang] || 'en');
                }}
                className="px-3.5 py-1.5 rounded-full bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors uppercase tracking-wider"
              >
                🌐 {lang}
              </button>

              <button
                type="button"
                onClick={closeAssistant}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 text-sm transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* 🎤 Animated Google Voice Style Pulsing Mic Icon */}
            <div className="relative my-4 flex items-center justify-center">
              {status === 'listening' && (
                <>
                  <div className="absolute inset-0 w-28 h-28 -translate-x-2 -translate-y-2 rounded-full bg-red-400/30 animate-ping" />
                  <div className="absolute inset-0 w-32 h-32 -translate-x-4 -translate-y-4 rounded-full bg-blue-400/20 animate-pulse" />
                </>
              )}
              {status === 'thinking' && (
                <div className="absolute inset-0 w-28 h-28 -translate-x-2 -translate-y-2 rounded-full bg-teal-400/30 animate-spin border-2 border-teal-500 border-t-transparent" />
              )}

              <button
                type="button"
                onClick={status === 'listening' ? closeAssistant : startListening}
                className={`relative z-10 w-24 h-24 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
                  status === 'listening'
                    ? 'bg-gradient-to-tr from-red-500 to-rose-600 text-white scale-105 shadow-red-500/40'
                    : status === 'navigating'
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/40'
                    : status === 'thinking'
                    ? 'bg-gradient-to-tr from-teal-600 to-blue-600 text-white shadow-teal-500/40'
                    : 'bg-gradient-to-tr from-blue-600 to-teal-500 text-white hover:scale-105 shadow-blue-500/40'
                }`}
              >
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
            </div>

            {/* 🌊 Equalizer */}
            {status === 'listening' && (
              <div className="flex items-center justify-center gap-1.5 h-8 my-3">
                <span className="w-1.5 bg-blue-500 rounded-full h-4 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 bg-red-500 rounded-full h-8 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 bg-yellow-500 rounded-full h-5 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="w-1.5 bg-green-500 rounded-full h-9 animate-bounce" style={{ animationDelay: '450ms' }} />
                <span className="w-1.5 bg-blue-600 rounded-full h-4 animate-bounce" style={{ animationDelay: '600ms' }} />
              </div>
            )}

            {/* Status Label */}
            <div className="my-2">
              {status === 'listening' && (
                <p className="text-slate-800 text-lg font-bold tracking-tight">🎤 Listening...</p>
              )}
              {status === 'navigating' && (
                <p className="text-emerald-700 text-lg font-bold tracking-tight animate-bounce">
                  🧭 {targetViewName}
                </p>
              )}
              {status === 'thinking' && (
                <p className="text-teal-700 text-sm font-semibold tracking-tight animate-pulse">
                  ⚡ Thinking...
                </p>
              )}
              {status === 'speaking' && (
                <p className="text-blue-700 text-sm font-semibold tracking-tight">
                  🔊 Prescripto Assistant
                </p>
              )}
            </div>

            {/* 🔴 LIVE RECOGNIZED TRANSCRIPT */}
            {(liveTranscript || finalTranscript) && (
              <div className="w-full my-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-800 text-base font-medium shadow-inner">
                "{liveTranscript || finalTranscript}"
              </div>
            )}

            {/* 🤖 GEMINI AI RESPONSE */}
            {aiReply && status !== 'thinking' && (
              <div className="w-full my-3 p-4 rounded-2xl bg-teal-50 border border-teal-100 text-slate-700 text-sm text-left font-normal leading-relaxed">
                {aiReply}
              </div>
            )}

            {/* ⚠️ ERROR NOTICE */}
            {errorMessage && (
              <div className="w-full my-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={startListening}
                  className="px-3 py-1 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-colors ml-2"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔴 FLOATING MIC BUTTON */}
      <button
        type="button"
        onClick={handleMicClick}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl bg-gradient-to-tr from-teal-600 to-blue-600 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 shadow-teal-600/40 ring-4 ring-white"
        aria-label="Google Voice Assistant"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
    </>
  );
}
