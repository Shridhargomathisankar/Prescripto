import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

const LANG_NAME_MAP = {
  en: 'English',
  ta: 'Tamil (தமிழ்)',
  hi: 'Hindi (हिन्दी)',
  te: 'Telugu (తెలుగు)',
  ml: 'Malayalam (മലയാളം)',
};

const BASE_SYSTEM_INSTRUCTION = `You are Prescripto's expert multilingual medical voice assistant.
Your job is to provide warm, clear, and accurate advice to patients, doctors, and elderly users on prescriptions, medicines, symptoms, diet, exercise, water intake, appointment reminders, and navigating the Prescripto healthcare app.

IMPORTANT ETHICAL & MEDICAL SAFETY RULES:
1. DO NOT diagnose serious medical conditions or alter verified prescription dosages independently.
2. DO NOT append "Consult your doctor" to every single response. Only recommend consulting a doctor when user reports severe/emergency symptoms (e.g. chest pain, severe breathlessness) or requests unverified medication changes.
3. Explain medicine usage, dosage times (morning, evening, night), storage, diet, and hydration in simple, encouraging language.
4. VOICE OPTIMIZATION: Keep answers concise (1 to 3 sentences maximum), natural, and clear for Text-To-Speech. Avoid markdown tables, asterisks, bullet points, or special characters.`;

// Helper delay
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Retry helper with exponential backoff
 */
async function retryOperation(operation, retries = 2, delayMs = 500) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(delayMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

/**
 * Smart contextual fallback supporting 5 languages (en, ta, hi, te, ml)
 */
function generateContextualFallback(userText, lang = 'en') {
  const fallbacks = {
    ta: 'உங்கள் மருந்துகளை நேரத்திற்கு சாப்பாட்டிற்குப் பிறகு தண்ணீருடன் உட்கொள்ளவும்.',
    hi: 'कृपया अपनी दवाएं भोजन के बाद पानी के साथ निर्धारित समय पर लें।',
    te: 'దయచేసి మీ మందులను భోజనం తర్వాత నిర్ణీత సమయానికి నీటితో తీసుకోండి.',
    ml: 'നിങ്ങളുടെ മരുന്നുകൾ സമയത്തിന് ഭക്ഷണത്തിന് ശേഷം വെള്ളത്തോടൊപ്പം കഴിക്കുക.',
    en: 'Please take your medicines at the prescribed timings with water after food.',
  };
  return fallbacks[lang] || fallbacks.en;
}

/**
 * Primary function to query Gemini API with model fallback chain & target language mandate
 */
async function generateGeminiReply(userText, history = [], targetLang = 'en') {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const langName = LANG_NAME_MAP[targetLang] || 'English';

  const systemInstruction = `${BASE_SYSTEM_INSTRUCTION}

CRITICAL LANGUAGE REQUIREMENT: The user's active application language is ${langName}. You MUST respond STRICTLY in ${langName}. Do NOT reply in any other language unless explicitly asked.`;

  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY is not set in backend/.env');
    return generateContextualFallback(userText, targetLang);
  }

  const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  // Format past history for multi-turn chat if available
  const formattedHistory = Array.isArray(history)
    ? history
        .slice(-6)
        .map((h) => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.text || h.content || '') }],
        }))
        .filter((h) => h.parts[0].text.trim().length > 0)
    : [];

  // 1. Try SDK call with retries across models
  for (const modelName of modelsToTry) {
    try {
      const reply = await retryOperation(async () => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
        });

        if (formattedHistory.length > 0) {
          const chat = model.startChat({ history: formattedHistory });
          const result = await chat.sendMessage(userText);
          const response = await result.response;
          return response.text()?.trim();
        } else {
          const result = await model.generateContent(userText);
          const response = await result.response;
          return response.text()?.trim();
        }
      }, 1, 400);

      if (reply) return reply;
    } catch (sdkError) {
      console.warn(`Model ${modelName} attempt error:`, sdkError.message);
    }
  }

  // 2. Direct REST API fallback
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: userText }],
      },
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    }
  } catch (restError) {
    console.error('Gemini REST API fallback error:', restError.message);
  }

  // 3. Smart contextual fallback
  return generateContextualFallback(userText, targetLang);
}

/**
 * ==========================================
 * POST /api/voice/chat
 * Request:  { "text": "...", "history": [...], "lang": "en|ta|hi|te|ml" }
 * Response: { "text": "...", "status": "ok" }
 * ==========================================
 */
router.post('/chat', async (req, res) => {
  try {
    const { text, history, lang } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text field is required' });
    }

    const aiReply = await generateGeminiReply(text.trim(), history, lang || 'en');

    return res.json({
      text: aiReply,
      status: 'ok',
    });
  } catch (err) {
    console.error('voice/chat handler error:', err.message);
    return res.status(200).json({
      text: generateContextualFallback(req.body?.text, req.body?.lang),
      status: 'fallback',
    });
  }
});

export default router;
