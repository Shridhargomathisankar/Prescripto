import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STT_SCRIPT = path.resolve(__dirname, '../../stt_service.py');
const LOCAL_PYTHON_BIN = path.resolve(
  __dirname,
  process.platform === 'win32' ? '../../.venv/Scripts/python.exe' : '../../.venv/bin/python'
);
const PYTHON_BIN = process.env.PYTHON_BIN || (fs.existsSync(LOCAL_PYTHON_BIN) ? LOCAL_PYTHON_BIN : 'python');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

const VALID_SCREENS = [
  'home',
  'prescriptions',
  'reports',
  'profile',
  'settings',
  'maps',
  'reminders',
  'notifications',
  'consult-again',
];

const upload = multer({ dest: 'uploads/' });

const SCRIPT_RANGES = {
  ta: /[\u0B80-\u0BFF]/,
  hi: /[\u0900-\u097F]/,
  ml: /[\u0D00-\u0D7F]/,
  te: /[\u0C00-\u0C7F]/,
};

const INTENT_EXAMPLES = {
  home: [
    'go to home',
    'main page',
    'dashboard open',
    '???????? ?????? ??',
    '????? ??? ????',
    '??? ???????',
    '???? ????? ????',
  ],
  prescriptions: [
    'show prescriptions',
    'medicine list',
    'tablet details',
    'prescription dikhaye',
    'dawai dikhao',
    'prescriptions list',
    '??????? ???????? ??????',
    '??? ????? ?????',
    '??????? ?????????????? ????????',
    '????? ??????????????? ???????',
  ],
  reports: [
    'show reports',
    'scan report',
    'lab results',
    'report dikhaye',
    '?????????? ??????',
    '??????? ?????',
    '??????????? ????????',
    '???????? ???????',
  ],
  profile: [
    'open profile',
    'my details',
    'edit profile',
    '????????? ???',
    '???????? ????',
    '??????? ???????',
    '???????? ????? ????',
  ],
  settings: [
    'open settings',
    'change language',
    'app settings',
    '?????????? ???',
    '???????? ????',
    '??????????? ???????',
    '??????????? ????? ????',
  ],
  maps: [
    'nearby clinics',
    'show map',
    'find hospital nearby',
    'nearby clinic dikhaye',
    '?????????? ??????????? ??????',
    '??? ?? ??????? ?????',
    '?????? ?????????? ????????',
    '???????? ???????? ???????',
  ],
  reminders: [
    'show reminders',
    'medicine reminder',
    'reminder timings',
    '??????????? ??????',
    '???? ???????? ?????',
    '??????? ????????',
    '???????? ???????',
  ],
  notifications: [
    'show notifications',
    'alerts open',
    'recent updates',
    '????????? ??????',
    '?????????? ?????',
    '?????????????? ????????',
    '??????????? ???????',
  ],
  'consult-again': [
    'consult again',
    'book reconsultation',
    'doctor follow up',
    're consult',
    '???????? ?????? ????????',
    '??? ?? ?????? ???? ??',
    '??????? ???????? ????',
    '????? ???????? ??????',
    'reconsult',
  ],
};

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLanguage(text) {
  const raw = String(text || '');
  if (SCRIPT_RANGES.ta.test(raw)) return 'ta';
  if (SCRIPT_RANGES.hi.test(raw)) return 'hi';
  if (SCRIPT_RANGES.ml.test(raw)) return 'ml';
  if (SCRIPT_RANGES.te.test(raw)) return 'te';

  const clean = normalizeText(raw);
  const tanglishSignals = [
    'marunthu',
    'marundhu',
    'medicine',
    'kaatu',
    'inga',
    'venum',
    'vaenum',
    'consult pannanum',
    'consult pannunga',
    'tablet',
    'dosage',
    'pill',
  ];
  const hasTanglish = tanglishSignals.some((s) => clean.includes(s));
  if (hasTanglish) return 'tanglish';
  return 'en';
}

// Expand tanglish/hybrid signals


function trigrams(input) {
  const s = `  ${input}  `;
  const out = new Set();
  for (let i = 0; i <= s.length - 3; i += 1) out.add(s.slice(i, i + 3));
  return out;
}

function similarity(a, b) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const v of ta) {
    if (tb.has(v)) inter += 1;
  }
  return inter / Math.max(ta.size, tb.size);
}

function classifyIntentHeuristic(text) {
  const normalized = normalizeText(text);
  if (!normalized) return { intent: 'home', confidence: 0 };

  let best = { intent: 'home', confidence: 0 };
  for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
    let score = 0;
    for (const ex of examples) {
      const exNorm = normalizeText(ex);
      if (!exNorm) continue;
      if (normalized.includes(exNorm) || exNorm.includes(normalized)) {
        score = Math.max(score, 0.95);
      } else {
        score = Math.max(score, similarity(normalized, exNorm));
      }
    }
    if (score > best.confidence) {
      best = { intent, confidence: score };
    }
  }

  if (best.confidence < 0.22) {
    return { intent: 'home', confidence: best.confidence };
  }
  return best;
}

function parseOllamaResponse(raw) {
  const text = String(raw || '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const intent = String(parsed.intent || '').toLowerCase().trim();
    const language = String(parsed.language || '').toLowerCase().trim();
    if (!VALID_SCREENS.includes(intent)) return null;
    return {
      intent,
      language: language || null,
    };
  } catch {
    return null;
  }
}

router.post('/stt', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file required' });
    }

    const audioPath = path.resolve(req.file.path);
    const py = spawn(PYTHON_BIN, [STT_SCRIPT, audioPath]);

    let output = '';
    let error = '';

    py.stdout.on('data', (data) => {
      output += data.toString();
    });

    py.stderr.on('data', (data) => {
      error += data.toString();
    });

    py.on('error', (err) => {
      console.error('Failed to start python STT process:', err.message);
    });

    py.on('close', () => {
      fs.unlink(audioPath, () => {});

      if (error && !output.trim()) {
        console.error('STT execution warning:', error);
      }

      return res.json({
        text: output.trim(),
        success: true,
      });
    });
  } catch (err) {
    console.error('voice/stt error:', err.message);
    return res.status(200).json({ text: '', error: err.message });
  }
});

router.post('/transcribe', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'VOICE_TRANSCRIPTION_FAILED',
        message: 'No audio file received for transcription.',
      });
    }

    const lang = req.body?.lang || 'en-IN';
    const audioPath = path.resolve(req.file.path);
    const py = spawn(PYTHON_BIN, [STT_SCRIPT, audioPath]);

    let output = '';
    let error = '';

    py.stdout.on('data', (data) => {
      output += data.toString();
    });

    py.stderr.on('data', (data) => {
      error += data.toString();
    });

    py.on('error', (err) => {
      console.error('Failed to start python STT process:', err.message);
    });

    py.on('close', () => {
      fs.unlink(audioPath, () => {});

      const transcript = output.trim();
      if (!transcript && error) {
        console.error('STT execution warning:', error);
      }

      if (!transcript) {
        return res.status(200).json({
          success: false,
          error: 'VOICE_TRANSCRIPTION_FAILED',
          message: 'Unable to understand the audio.',
        });
      }

      return res.json({
        success: true,
        transcript,
        text: transcript,
        language: lang,
        confidence: 0.92,
      });
    });
  } catch (err) {
    console.error('voice/transcribe error:', err.message);
    return res.status(200).json({
      success: false,
      error: 'VOICE_TRANSCRIPTION_FAILED',
      message: err.message || 'Server error during transcription.',
    });
  }
});

router.post('/intent', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' });
    }

    const language = detectLanguage(text);
    const fallbackIntent = classifyIntentHeuristic(text);

    const prompt = `
You are a multilingual intent classifier for a healthcare app.
Supported languages: Tamil, Tanglish, English, Hindi, Malayalam, Telugu.

Classify this user command by meaning and map it to one exact screen:
home, prescriptions, reports, profile, settings, maps, reminders, notifications, consult-again

Text: "${text.trim()}"

Return strict JSON only:
{"intent":"<one screen>","language":"ta|tanglish|en|hi|ml|te","confidence":0-1}
`;

    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 80,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = parseOllamaResponse(data.response);
        if (parsed) {
          return res.json({
            intent: parsed.intent,
            screen: parsed.intent,
            language: parsed.language || language,
            fallback: false,
          });
        }
      }
    } catch {
      // Ignore remote failure and continue with deterministic fallback.
    }

    return res.json({
      intent: fallbackIntent.intent,
      screen: fallbackIntent.intent,
      language,
      fallback: true,
      confidence: fallbackIntent.confidence,
    });
  } catch (err) {
    console.error('voice/intent error:', err.message);
    const fallbackIntent = classifyIntentHeuristic(req.body?.text || '');
    return res.status(200).json({
      error: err.message,
      fallback: true,
      intent: fallbackIntent.intent,
      screen: fallbackIntent.intent,
      language: detectLanguage(req.body?.text || ''),
      confidence: fallbackIntent.confidence,
    });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { text, lang = 'en' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are Prescripto Voice AI Assistant. Answer this healthcare query concisely in 1-2 short sentences in language code "${lang}": "${text}"`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answer) {
            return res.json({ response: answer, answer, success: true });
          }
        }
      } catch (err) {
        console.warn('Gemini API call failed, using localized fallback response:', err.message);
      }
    }

    // Localized fallback response when GEMINI_API_KEY is not set
    const fallbackAnswers = {
      ta: 'மருத்துவ கேள்விகளுக்கு தயவுசெய்து உங்கள் மருத்துவரை நேரடியாக அணுகவும்.',
      hi: 'स्वास्थ्य संबंधी प्रश्नों के लिए कृपया अपने डॉक्टर से परामर्श लें।',
      ml: 'ആരോഗ്യപരമായ ചോദ്യങ്ങൾക്ക് ദയവായി ഡോക്ടറെ സമീപിക്കുക.',
      te: 'ఆరోగ్య వివరాల కోసం దయచేసి మీ వైద్యుడిని సంప్రదించండి.',
      en: 'Please consult your registered doctor or healthcare provider for specific medical advice.',
    };

    const answer = fallbackAnswers[lang] || fallbackAnswers.en;
    return res.json({ response: answer, answer, success: true, fallback: true });
  } catch (err) {
    console.error('voice/chat error:', err.message);
    return res.status(200).json({
      response: 'Please consult your doctor for detailed medical advice.',
      answer: 'Please consult your doctor for detailed medical advice.',
      error: err.message,
    });
  }
});

export default router;
