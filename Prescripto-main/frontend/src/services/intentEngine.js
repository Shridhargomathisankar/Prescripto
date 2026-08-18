/* =========================================================
   PRESCRIPTO UNIVERSAL MULTILINGUAL INTENT ENGINE
   100% Client-side matching in <10ms with Universal Cross-Language Mode
   UI Language is completely independent of Spoken Voice Command Language.
   Supports: English, Tamil, Tanglish, Hindi, Telugu, Malayalam
   ========================================================= */

const NEGATION_PATTERNS = [
  'don\'t',
  'dont',
  'do not',
  'no',
  'not',
  'never',
  'வேண்டாம்',
  'வேண்டா',
  'மத்',
  'नहीं',
  'വേണ്ട',
  'വേണ്ടാം',
  'వద్దు',
];

const MEDICAL_QUESTION_PATTERNS = [
  'what is',
  'what are',
  'why should',
  'how to',
  'side effects',
  'medicine for',
  'use of',
  'dosage',
  'missed my medicine',
  'dawai kis kaam',
  'kya kaam',
  'kya hai',
  'kya kare',
  'மருந்து பயன்பாடு',
  'எதற்காக',
  'என்ன செய்ய வேண்டும்',
  'എന്തിനാണ്',
  'ഉപയോഗം',
  'ഏമിటి',
  'ఎందుకు',
];

const FILLER_WORDS = [
  'please', 'can you', 'could you', 'i want to', 'i need to', 'show me', 'open', 'take me to',
  'go to', 'view', 'check', 'give me', 'would you', 'can', 'could', 'should', 'i', 'want', 'need',
  'my', 'me', 'the', 'to', 'a', 'an', 'page', 'ku', 'po', 'kholo', 'karo', 'dikhao', 'chahiye',
  'enakku', 'venum', 'kaatu', 'kaattu', 'tharunga', 'poganum', 'paakanum', 'open pannu', 'pannu', 'pannunga', 'paaka', 'pannanum',
  'naaku', 'kaavali', 'chupinchandi', 'chupinchu', 'teruvu', 'vellali', 'cheyyi',
  'enikku', 'venam', 'kaanikkuka', 'kaanikku', 'thurakku', 'ente', 'naa', 'en', 'ennotte',
  'ennudaiya', 'meri', 'mera', 'mujhe', 'ko', 'per', 'pe', 'ennoda', 'bro', 'konjam'
];

const INTENT_DICTIONARY = [
  {
    intent: 'home',
    target: 'home',
    isView: true,
    spoken: {
      en: 'Opening Dashboard',
      ta: 'டாஷ்போர்டு திறக்கப்படுகிறது',
      hi: 'डैशबोर्ड खोला जा रहा है',
      ml: 'ഡാഷ്ബോർഡ് തുറക്കുന്നു',
      te: 'డాష్‌బోర్డ్ తెరుస్తోంది',
    },
    phrases: [
      'home', 'dashboard', 'main page', 'open dashboard', 'go home', 'go to dashboard', 'home page', 'show dashboard',
      'முகப்பு', 'டாஷ்போர்டு', 'முகப்பு பக்கம்', 'டாஷ்போர்டு திற', 'முகப்புக்கு செல்', 'முகப்பு போ',
      'home po', 'home ponga', 'home ku po', 'home page ku po', 'dashboard kholo', 'main page kaatu',
      'डैशबोर्ड', 'मुख्य पृष्ठ', 'होम', 'डैशबोर्ड खोलो', 'होम पर जाओ', 'मुख्य पेज दिखाओ', 'होम पेज',
      'മുഖപ്പു', 'ഡാഷ്ബോർഡ്', 'പ്രധാന പേജ്', 'ഡാഷ്ബോർഡ് തുറക്കുക', 'ഹോം പോകൂ',
      'హోమ్', 'డాష్‌బోర్డ్', 'ప్రధాన పేజీ', 'డాష్‌బోర్డ్ తెరువు', 'హోమ్‌కు వెళ్ళు'
    ],
  },
  {
    intent: 'prescriptions',
    target: 'prescriptions',
    isView: true,
    spoken: {
      en: 'Showing Prescriptions',
      ta: 'மருந்து பட்டியல் காட்டுகிறேன்',
      hi: 'प्रिस्क्रिप्शन दिखाए जा रहे हैं',
      ml: 'മരുന്ന് കുറിപ്പുകൾ കാണിക്കുന്നു',
      te: 'మందుల వివరాలు చూపిస్తోంది',
    },
    phrases: [
      'prescription', 'prescriptions', 'rx', 'medicine list', 'tablet details', 'my prescriptions', 'show prescriptions', 'doctor prescription', 'prescription history', 'view prescription',
      'மருந்து சீட்டு', 'மருந்துகள்', 'மருந்து பட்டியல்', 'பிரிஸ்கிரிப்ஷன்', 'மருந்து சீட்டு பார்க்க', 'மருந்து காட்டு', 'பிரிஸ்கிரிப்ஷன் பார்க்க', 'என் மருந்து சீட்டு காட்டு',
      'marundhu', 'marundhu seetu', 'prescription paakanum', 'prescription kaatu', 'en prescription kaatu', 'en prescription', 'prescription open pannu', 'marundhu kaatu', 'dawai', 'bro prescription konjam kaatu', 'enakku prescription open pannanum', 'meri prescription open pannu', 'prescription kaatu please',
      'प्रिस्क्रिप्शन', 'दवाइयां', 'दवा की पर्ची', 'दवाई', 'प्रिस्क्रिप्शन दिखाओ', 'मेरी दवाइयां', 'दवा की पर्ची खोलो', 'meri prescription kholo',
      'പ്രിസ്ക്രിപ്ഷൻ', 'മരുന്ന് കുറിപ്പ്', 'മരുന്നുകൾ', 'എന്റെ പ്രിസ്ക്രിപ്ഷൻ', 'മരുന്ന് കാണിക്കൂ', 'പ്രിസ്ക്രിപ്ഷൻ തുറക്കൂ', 'ente prescription thurakku',
      'ప్రిస్క్రిప్షన్', 'మందుల చీటీ', 'మందులు', 'నా ప్రిస్క్రిప్షన్', 'ప్రిస్క్రిప్షన్ చూపించు', 'మందుల వివరాలు', 'naa prescription open cheyyi', 'naa prescription chupinchu'
    ],
  },
  {
    intent: 'reports',
    target: 'reports',
    isView: true,
    spoken: {
      en: 'Opening Reports',
      ta: 'ஸ்கேன் அறிக்கைகளை காட்டுகிறேன்',
      hi: 'रिपोर्ट्स खोली जा रही हैं',
      ml: 'റിപ്പോർട്ടുകൾ തുറക്കുന്നു',
      te: 'నివేదికలు తెరుస్తోంది',
    },
    phrases: [
      'reports', 'report', 'scan report', 'lab report', 'test results', 'blood report', 'medical reports', 'show reports', 'open reports', 'scan results',
      'அறிக்கை', 'அறிக்கைகள்', 'ஸ்கேன் அறிக்கை', 'லேப் ரிப்போர்ட்', 'அறிக்கை பார்க்க', 'ரிப்போர்ட் காட்டு', 'அறிக்கைகள் பார்க்க', 'என் ரிப்போர்ட்ஸ் காட்டு',
      'scan report open pannu', 'reports open pannu', 'reports konjam kaatu', 'report paakanum', 'report kaatu', 'en report kaatu', 'enakku reports venum',
      'रिपोर्ट', 'रिपोर्ट्स', 'स्कैन रिपोर्ट', 'लैब रिपोर्ट', 'मेरी रिपोर्ट दिखाओ', 'रिपोर्ट्स खोलो', 'जांच रिपोर्ट',
      'റിപ്പോർട്ട്', 'റിപ്പോർട്ടുകൾ', 'സ്കാൻ റിപ്പോർട്ട്', 'ലാബ് റിപ്പോർട്ട്', 'എന്റെ റിപ്പോർട്ട് കാണിക്കൂ', 'റിപ്പോർട്ടുകൾ തുറക്കൂ', 'ente report thurakku',
      'రిపోర్ట్', 'రిపోర్టులు', 'స్కాన్ రిపోర్ట్', 'లాబ్ రిపోర్ట్', 'నా రిపోర్ట్ చూపించు', 'రిపోర్టులు తెరువు', 'naa report chupinchu'
    ],
  },
  {
    intent: 'reminders',
    target: 'reminders',
    isView: true,
    spoken: {
      en: 'Opening Medicine Reminders',
      ta: 'மருந்து நினைவூட்டல்கள்',
      hi: 'दवा रिमाइंडर खोले जा रहे हैं',
      ml: 'മരുന്ന് ഓർമ്മപ്പെടുത്തലുകൾ തുറക്കുന്നു',
      te: 'మందుల రిమైండర్లు తెరుస్తోంది',
    },
    phrases: [
      'reminder', 'reminders', 'medicine reminder', 'medicine reminders', 'open medicine reminder', 'open medicine reminders', 'show medicine reminder', 'show my medicine reminders', 'my medicine reminder', 'medication reminder', 'medication reminders', 'medicine schedule', 'my medicine schedule', 'show my medicine schedule', 'pill reminder', 'reminder timings', 'alarm', 'dosage timing', 'show reminders',
      'நினைவூட்டல்', 'மருந்து நினைவூட்டல்', 'மருந்து நினைவூட்டல்கள்', 'மருந்து reminder', 'மருந்து நினைவூட்டலை காட்டு', 'மருந்து நினைவூட்டல் காட்டு', 'நினைவூட்டல்கள்', 'நினைவூட்டல் காட்டு',
      'marundhu reminder', 'marundhu reminders', 'marundhu reminder kaatu', 'medicine reminder kaatu', 'medicine reminder open pannu', 'en medicine reminder kaatu', 'marundhu ninaivootral', 'marundhu schedule', 'reminder kaatu', 'reminder timing', 'reminder paakanum',
      'दवा रिमाइंडर', 'दवाई रिमाइंडर', 'दवा की याद दिलाओ', 'मेरी दवा की रिमाइंडर दिखाओ', 'दवा रिमाइंडर खोलो', 'मेरी दवा रिमाइंडर दिखाओ', 'रिमाइंडर', 'रिमाइंडर दिखाओ', 'अलार्म', 'दवा का समय', 'meri medicine reminder kholo', 'dawai reminder',
      'മരുന്ന് റിമൈൻഡർ', 'മരുന്ന് റിമൈൻഡറുകൾ', 'എന്റെ മരുന്ന് റിമൈൻഡർ കാണിക്കുക', 'മരുന്ന് റിമൈൻഡർ തുറക്കുക', 'ഓർമ്മപ്പെടുത്തൽ', 'മരുന്ന് ഓർമ്മപ്പെടുത്തൽ', 'ഓർമ്മപ്പെടുത്തലുകൾ', 'ഓർമ്മപ്പെടുത്തൽ കാണിക്കൂ', 'ente medicine reminder thurakku',
      'మందుల రిమైండర్', 'మందుల రిమైండర్లు', 'నా మందుల రిమైండర్ చూపించు', 'మందుల రిమైండర్ ఓపెన్ చేయి', 'రిమైండర్', 'మందుల రిమైండర్', 'రిమైండర్లు', 'రిమైండర్ చూపించు', 'naa medicine reminder chupinchu'
    ],
  },
  {
    intent: 'maps',
    target: 'maps',
    isView: true,
    spoken: {
      en: 'Showing Nearby Hospitals Map',
      ta: 'அருகிலுள்ள மருத்துவமனைகள்',
      hi: 'पास के अस्पतालों का नक्शा दिखाया जा रहा है',
      ml: 'അടുത്തുള്ള ആശുപത്രികൾ കാണിക്കുന്നു',
      te: 'సమీప ఆసుపత్రుల పటాన్ని చూపిస్తోంది',
    },
    phrases: [
      'hospitals', 'hospital', 'nearby hospital', 'nearby clinic', 'clinic map', 'find hospital', 'maps', 'show map', 'clinics',
      'மருத்துவமனை', 'அருகிலுள்ள மருத்துவமனை', 'கிளினிக்', 'வரைபடம்', 'மருத்துவமனை காட்டு',
      'hospital dikhao', 'hospital kaatu', 'clinic map', 'map kaatu',
      'अस्पताल', 'पास के अस्पताल', 'क्लीनिक', 'नक्शा', 'अस्पताल दिखाओ', 'नक्शा दिखाओ',
      'ആശുപത്രി', 'അടുത്തുള്ള ക്ലിനിക്', 'മാപ്പ്', 'ആശുപത്രി കാണിക്കുക',
      'ఆసుపత్రి', 'సమీప ఆసుపత్రులు', 'క్లినిక్', 'మ్యాప్', 'ఆసుపత్రి చూపించు'
    ],
  },
  {
    intent: 'requests',
    target: 'requests',
    isView: true,
    spoken: {
      en: 'Opening Requests',
      ta: 'கோரிக்கைகள் திறக்கப்படுகிறது',
      hi: 'अनुरोध खोले जा रहे हैं',
      ml: 'അപേക്ഷകൾ തുറക്കുന്നു',
      te: 'அభ్యర్థனలు తెరుస్తోంది',
    },
    phrases: [
      'requests', 'request', 'access requests', 'pending requests', 'medicine requests', 'show requests', 'open requests',
      'கோரிக்கைகள்', 'கோரிக்கை', 'கோரிக்கைகள் காட்டு', 'அனுமதி கோரிக்கை',
      'access request', 'request paakanum', 'requests kaatu', 'request check pannu', 'pending request check pannu', 'access request check pannu', 'pending request',
      'अनुरोध', 'रिक्वेस्ट', 'अनुरोध दिखाओ', 'पेंडिंग रिक्वेस्ट',
      'അപേക്ഷകൾ', 'റിക്വസ്റ്റ്', 'അപേക്ഷകൾ കാണിക്കുക', 'റിക്വസ്റ്റ് തുറക്കൂ',
      'అభ్యర్థనలు', 'రిక్వెస్ట్', 'అభ్యర్థనలు చూపించు', 'రిక్వెస్టులు తెరువు'
    ],
  },
  {
    intent: 'profile',
    target: 'profile',
    isView: true,
    spoken: {
      en: 'Opening Profile',
      ta: 'சுயவிவரம் திறக்கப்படுகிறது',
      hi: 'प्रोफ़ाइल खोली जा रही है',
      ml: 'പ്രൊഫൈൽ തുറക്കുന്നു',
      te: 'ప్రొఫైల్ తెరుస్తోంది',
    },
    phrases: [
      'profile', 'my profile', 'account', 'my details', 'user profile', 'open profile', 'show profile',
      'சுயவிவரம்', 'என் சுயவிவரம்', 'சுயவிவரம் காட்டு', 'சுயவிவரம் திற',
      'profile kaatu', 'profile open pannu', 'en profile open pannu', 'profile dikhao',
      'प्रोफाइल', 'मेरी प्रोफाइल', 'प्रोफ़ाइल खोलो', 'मेरा विवरण',
      'പ്രൊഫൈൽ', 'എന്റെ പ്രൊഫൈൽ', 'പ്രൊഫൈൽ കാണിക്കൂ', 'പ്രൊഫൈൽ തുറക്കൂ',
      'ప్రొఫైల్', 'నా ప్రొఫైల్', 'ప్రొఫైల్ చూపించు', 'ప్రొఫైల్ తెరువు'
    ],
  },
  {
    intent: 'logout',
    target: 'logout',
    isView: false,
    isAction: true,
    spoken: {
      en: 'Logging out',
      ta: 'வெளியேறுகிறது',
      hi: 'लॉग आउट किया जा रहा है',
      ml: 'ലോഗ് ഔട്ട് ചെയ്യുന്നു',
      te: 'లాగ్ అవుట్ అవుతోంది',
    },
    phrases: [
      'logout', 'log out', 'sign out', 'exit',
      'வெளியேறு', 'லாக் அவுட்',
      'log out', 'exit',
      'लॉग आउट', 'बाहर निकलो',
      'ലോഗ് ഔട്ട്', 'പുറത്തുകടക്കുക',
      'లాగ్ అవుట్', 'నిష్క్రమించు'
    ],
  },
];

/* =========================================================
   1. Normalization Utility & Filler Word Stripping
   ========================================================= */
export function normalizeTranscript(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function stripFillerWords(normText) {
  let result = normText;

  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, ' ');
  }

  return result.replace(/\s+/g, ' ').trim() || normText;
}

export function detectLanguageStyle(normText) {
  if (/[\u0B80-\u0BFF]/.test(normText)) return { detectedStyle: 'Tamil', matchedDictionary: 'Tamil' };
  if (/[\u0900-\u097F]/.test(normText)) return { detectedStyle: 'Hindi', matchedDictionary: 'Hindi' };
  if (/[\u0D00-\u0D7F]/.test(normText)) return { detectedStyle: 'Malayalam', matchedDictionary: 'Malayalam' };
  if (/[\u0C00-\u0C7F]/.test(normText)) return { detectedStyle: 'Telugu', matchedDictionary: 'Telugu' };

  const tanglishKeywords = [
    'kaatu', 'kaattu', 'pannu', 'pannanum', 'venum', 'po', 'konjam', 'enakku', 'en',
    'paakanum', 'seetu', 'kattunga', 'ennoda', 'ponga', 'paaka', 'dikhao', 'kholo'
  ];
  const words = normText.toLowerCase().split(/\s+/);
  if (words.some((w) => tanglishKeywords.includes(w))) {
    return { detectedStyle: 'Tanglish', matchedDictionary: 'Tanglish' };
  }

  return { detectedStyle: 'English', matchedDictionary: 'English' };
}

/* =========================================================
   2. Negation & Medical Question Detectors
   ========================================================= */
export function containsNegation(normalizedText) {
  const words = normalizedText.split(' ');
  return NEGATION_PATTERNS.some((neg) => words.includes(neg) || normalizedText.includes(neg));
}

export function isMedicalQuestion(normalizedText) {
  return MEDICAL_QUESTION_PATTERNS.some((pattern) => normalizedText.includes(pattern));
}

/* =========================================================
   3. Universal Multilingual Intent Classifier & Scorer
   UI Language is INDEPENDENT of Spoken Command Language
   ========================================================= */
export function detectLocalIntent(rawTranscript, currentLang = 'en', userRole = 'patient') {
  const norm = normalizeTranscript(rawTranscript);
  if (!norm) return null;

  const { detectedStyle, matchedDictionary } = detectLanguageStyle(norm);

  // Negation Safeguard
  if (containsNegation(norm)) {
    return { unrecognized: true, reason: 'negation', normalized: norm, detectedStyle, matchedDictionary };
  }

  // Layer 3 Check: General AI Health Question Fallback
  if (isMedicalQuestion(norm)) {
    return { isAiQuestion: true, query: rawTranscript, normalized: norm, detectedStyle, matchedDictionary };
  }

  const strippedNorm = stripFillerWords(norm);

  let bestMatch = null;
  let maxScore = 0;

  for (const item of INTENT_DICTIONARY) {
    // Role Isolation Filter
    if (userRole === 'doctor' && !['home', 'dashboard', 'search', 'requests', 'profile', 'logout'].includes(item.target)) {
      continue;
    }
    if (userRole === 'pharmacy' && !['home', 'dashboard', 'stock', 'requests', 'profile', 'logout'].includes(item.target)) {
      continue;
    }

    let score = 0;

    for (const phrase of item.phrases) {
      const normPhrase = normalizeTranscript(phrase);
      if (!normPhrase) continue;

      if (norm === normPhrase || strippedNorm === normPhrase) {
        score = Math.max(score, 10.0);
      } else if (norm.includes(normPhrase) || strippedNorm.includes(normPhrase)) {
        score = Math.max(score, 8.5);
      } else if (normPhrase.includes(strippedNorm) && strippedNorm.length >= 3) {
        score = Math.max(score, 6.5);
      } else {
        // Token subset match
        const phraseTokens = normPhrase.split(' ');
        const inputTokens = strippedNorm.split(' ');
        const matchedTokens = phraseTokens.filter((t) => inputTokens.includes(t));
        if (matchedTokens.length > 0) {
          const tokenRatio = matchedTokens.length / phraseTokens.length;
          score = Math.max(score, tokenRatio * 6.0);
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }

  // Score >= 5.0 -> High Confidence (Immediate Execution)
  if (bestMatch && maxScore >= 5.0) {
    return {
      confidenceLevel: 'high',
      intent: bestMatch.intent,
      target: bestMatch.target,
      isView: bestMatch.isView,
      isAction: bestMatch.isAction,
      spoken: bestMatch.spoken[currentLang] || bestMatch.spoken.en,
      confidence: maxScore,
      normalized: strippedNorm,
      detectedStyle,
      matchedDictionary,
    };
  }

  // Score 3.5 - 4.9 -> Medium Confidence (Ask Confirmation)
  if (bestMatch && maxScore >= 3.5) {
    return {
      confidenceLevel: 'medium',
      intent: bestMatch.intent,
      target: bestMatch.target,
      isView: bestMatch.isView,
      isAction: bestMatch.isAction,
      spoken: bestMatch.spoken[currentLang] || matchedSpokenForLang(bestMatch, currentLang),
      confidence: maxScore,
      normalized: strippedNorm,
      detectedStyle,
      matchedDictionary,
    };
  }

  return {
    unrecognized: true,
    confidence: maxScore,
    normalized: strippedNorm,
    detectedStyle,
    matchedDictionary
  };
}

function matchedSpokenForLang(item, lang) {
  return item.spoken[lang] || item.spoken.en;
}
