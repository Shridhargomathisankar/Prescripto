/* =========================================================
   PRESCRIPTO VOICE SERVICE V4 — CROSS-BROWSER STABILITY LAYER
   Safe, recoverable SpeechRecognition + MediaRecorder abstraction
   Protects Chrome, Microsoft Edge, Brave, & Incognito from dead-end states
   ========================================================= */

import { api } from '../config/api';

const getSpeechRecognitionClass = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const VOICE_ERROR_MESSAGES = {
  OFFLINE: "You're offline. Please check your internet connection.",
  MICROPHONE_DENIED: 'Microphone permission is required.',
  BROWSER_UNSUPPORTED: "Voice recognition isn't available in this browser.",
  SERVICE_UNAVAILABLE: 'Voice service is temporarily unavailable. Try again.',
  NO_SPEECH: "I couldn't hear you. Tap the mic and try again.",
  TIMEOUT: "I couldn't hear anything. Tap the mic and try again.",
  UNKNOWN: 'Voice recognition failed. Please try again.',
};

class VoiceService {
  constructor() {
    this.activeProvider = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.recognition = null;
    this.fallbackCount = 0;
    this.autoStopTimer = null;
    this.hardTimeoutTimer = null;
    this.sessionId = 0;
  }

  isBrowserSupported() {
    return !!getSpeechRecognitionClass();
  }

  mapLangCode(lang) {
    switch (lang) {
      case 'ta':
        return 'ta-IN';
      case 'hi':
        return 'hi-IN';
      case 'ml':
        return 'ml-IN';
      case 'te':
        return 'te-IN';
      default:
        return 'en-IN';
    }
  }

  /* =========================================================
     Primary Entry Point: Start Listening (Session Guarded)
     ========================================================= */
  async start({ lang = 'en', onStart, onResult, onError, onEnd }) {
    this.stop(); // Safe abort & release previous session

    const currentSessionId = ++this.sessionId;
    console.log(`[VOICE:STT] Session #${currentSessionId} starting...`);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn(`[VOICE:STT] Session #${currentSessionId} client offline`);
      if (onError) onError({ code: 'OFFLINE', message: VOICE_ERROR_MESSAGES.OFFLINE });
      if (onEnd) onEnd();
      return;
    }

    // 8-Second Hard Recognition Safety Timeout
    this.hardTimeoutTimer = setTimeout(() => {
      if (this.sessionId === currentSessionId) {
        console.warn(`[VOICE:STT] Session #${currentSessionId} 8-second hard timeout triggered. Recovering...`);
        this.stop();
        if (onError) onError({ code: 'TIMEOUT', message: VOICE_ERROR_MESSAGES.TIMEOUT });
        if (onEnd) onEnd();
      }
    }, 8000);

    const SpeechRecClass = getSpeechRecognitionClass();

    // Path A: Browser STT if supported & fallback count low; else Path B: Backend STT
    if (SpeechRecClass && this.fallbackCount < 2) {
      this.activeProvider = 'browser';
      console.log(`[VOICE:STT] Session #${currentSessionId} Path A: Web Speech API active`);
      this.startBrowserSTT({ SpeechRecClass, currentSessionId, lang, onStart, onResult, onError, onEnd });
    } else {
      this.activeProvider = 'backend';
      console.log(`[VOICE:FALLBACK] Session #${currentSessionId} Path B: Backend STT active`);
      this.startBackendSTT({ currentSessionId, lang, onStart, onResult, onError, onEnd });
    }
  }

  /* =========================================================
     Path A: Web Speech API (Edge / Brave / Chrome Tolerant)
     ========================================================= */
  startBrowserSTT({ SpeechRecClass, currentSessionId, lang, onStart, onResult, onError, onEnd }) {
    try {
      const recognition = new SpeechRecClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = this.mapLangCode(lang);

      recognition.onstart = () => {
        if (this.sessionId !== currentSessionId) return;
        console.log(`[VOICE:STT] Session #${currentSessionId} Browser STT listening (${recognition.lang})`);
        if (onStart) onStart({ provider: 'browser' });
      };

      recognition.onresult = (event) => {
        if (this.sessionId !== currentSessionId) return;
        this.clearHardTimeout();

        const transcript = event.results?.[0]?.[0]?.transcript || '';
        console.log(`[VOICE:STT] Session #${currentSessionId} Transcript: "${transcript}"`);

        if (transcript.trim()) {
          this.fallbackCount = 0; // Reset fallback count on success
          if (onResult) onResult({ transcript, provider: 'browser' });
        } else {
          console.warn(`[VOICE:FALLBACK] Session #${currentSessionId} Empty transcript. Switching to Backend STT...`);
          this.fallbackCount += 1;
          this.startBackendSTT({ currentSessionId, lang, onStart, onResult, onError, onEnd });
        }
      };

      recognition.onerror = (event) => {
        if (this.sessionId !== currentSessionId) return;
        this.clearHardTimeout();

        const errType = event.error;
        console.warn(`[VOICE:STT] Session #${currentSessionId} Recognition error: ${errType}`);

        if (errType === 'no-speech') {
          if (onError) onError({ code: 'NO_SPEECH', message: VOICE_ERROR_MESSAGES.NO_SPEECH });
          this.cleanupSession(onEnd);
          return;
        }

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          if (onError) onError({ code: 'MICROPHONE_DENIED', message: VOICE_ERROR_MESSAGES.MICROPHONE_DENIED });
          this.cleanupSession(onEnd);
          return;
        }

        // Network / Aborted / Browser Service error -> Fallback to Backend STT or Recover to READY
        if (errType === 'network' || errType === 'aborted' || errType === 'audio-capture') {
          this.fallbackCount += 1;
          if (this.fallbackCount <= 2) {
            console.warn(`[VOICE:FALLBACK] Session #${currentSessionId} Retrying with Backend STT...`);
            this.startBackendSTT({ currentSessionId, lang, onStart, onResult, onError, onEnd });
          } else {
            if (onError) onError({ code: 'SERVICE_UNAVAILABLE', message: VOICE_ERROR_MESSAGES.SERVICE_UNAVAILABLE });
            this.cleanupSession(onEnd);
          }
          return;
        }

        if (onError) onError({ code: 'UNKNOWN', message: VOICE_ERROR_MESSAGES.UNKNOWN });
        this.cleanupSession(onEnd);
      };

      recognition.onend = () => {
        if (this.sessionId !== currentSessionId) return;
        this.clearHardTimeout();
        if (this.activeProvider === 'browser') {
          this.cleanupSession(onEnd);
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch (err) {
      console.error(`[VOICE:STT] Session #${currentSessionId} SpeechRecognition init failed:`, err);
      this.fallbackCount += 1;
      this.startBackendSTT({ currentSessionId, lang, onStart, onResult, onError, onEnd });
    }
  }

  /* =========================================================
     Path B: MediaRecorder + Backend STT (Edge/Brave Recoverable)
     ========================================================= */
  async startBackendSTT({ currentSessionId, lang, onStart, onResult, onError, onEnd }) {
    if (this.sessionId !== currentSessionId) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error(`[VOICE:FALLBACK] Session #${currentSessionId} getUserMedia unavailable`);
      this.clearHardTimeout();
      if (onError) onError({ code: 'BROWSER_UNSUPPORTED', message: VOICE_ERROR_MESSAGES.BROWSER_UNSUPPORTED });
      this.cleanupSession(onEnd);
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.sessionId !== currentSessionId) {
        this.cleanupStream();
        return;
      }

      this.audioChunks = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else if (MediaRecorder.isTypeSupported('audio/wav')) mimeType = 'audio/wav';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (this.sessionId === currentSessionId && event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        if (this.sessionId !== currentSessionId) return;
        console.log(`[VOICE:STT] Session #${currentSessionId} MediaRecorder started`);
        if (onStart) onStart({ provider: 'backend' });
      };

      this.mediaRecorder.onstop = async () => {
        if (this.sessionId !== currentSessionId) return;
        this.clearHardTimeout();

        try {
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          if (audioBlob.size < 100) {
            console.warn(`[VOICE:STT] Session #${currentSessionId} Audio blob empty`);
            if (onError) onError({ code: 'NO_SPEECH', message: VOICE_ERROR_MESSAGES.NO_SPEECH });
            return;
          }

          console.log(`[VOICE:API] Session #${currentSessionId} Posting audio Blob to /api/voice/transcribe...`);
          const langLocale = this.mapLangCode(lang);
          const data = await api.voice.transcribe(audioBlob, langLocale);

          const transcript = data.transcript || data.text || '';
          if (data.success && transcript) {
            console.log(`[VOICE:API] Session #${currentSessionId} Backend transcript: "${transcript}"`);
            this.fallbackCount = 0;
            if (onResult) onResult({ transcript, provider: 'backend' });
          } else {
            console.warn(`[VOICE:API] Session #${currentSessionId} Backend STT no transcript`);
            if (onError) onError({ code: 'NO_SPEECH', message: VOICE_ERROR_MESSAGES.NO_SPEECH });
          }
        } catch (err) {
          console.error(`[VOICE:API] Session #${currentSessionId} Backend STT request error:`, err);
          if (onError) onError({ code: 'SERVICE_UNAVAILABLE', message: VOICE_ERROR_MESSAGES.SERVICE_UNAVAILABLE });
        } finally {
          this.cleanupSession(onEnd);
        }
      };

      this.mediaRecorder.start();

      // Auto-stop MediaRecorder after 4 seconds
      this.autoStopTimer = setTimeout(() => {
        if (this.sessionId === currentSessionId) {
          this.stopBackendRecording();
        }
      }, 4000);
    } catch (err) {
      console.error(`[VOICE:FALLBACK] Session #${currentSessionId} getUserMedia failed:`, err);
      this.clearHardTimeout();
      if (onError) onError({ code: 'MICROPHONE_DENIED', message: VOICE_ERROR_MESSAGES.MICROPHONE_DENIED });
      this.cleanupSession(onEnd);
    }
  }

  stopBackendRecording() {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
    }
  }

  clearHardTimeout() {
    if (this.hardTimeoutTimer) {
      clearTimeout(this.hardTimeoutTimer);
      this.hardTimeoutTimer = null;
    }
  }

  cleanupSession(onEnd) {
    this.clearHardTimeout();
    this.cleanupStream();
    this.activeProvider = null;
    if (onEnd) onEnd();
  }

  stop() {
    this.sessionId++; // Invalidate active session
    this.clearHardTimeout();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }

    this.stopBackendRecording();
    this.cleanupStream();
    this.activeProvider = null;
  }

  cleanupStream() {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.stream = null;
    }
  }
}

export const voiceService = new VoiceService();
