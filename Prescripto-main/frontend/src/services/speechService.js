/* =========================================================
   PRESCRIPTO SPEECH RECOGNITION SERVICE (COMPATIBILITY WRAPPER)
   Re-exports VoiceService V3
   ========================================================= */

import { voiceService, VOICE_ERROR_MESSAGES } from './voiceService';

export { voiceService, VOICE_ERROR_MESSAGES };
export const speechService = voiceService;
export const SPEECH_ERROR_TYPES = VOICE_ERROR_MESSAGES;
export default voiceService;
