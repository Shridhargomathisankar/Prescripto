import { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);
const SUPPORTED_LANGUAGES = ['en', 'ta', 'hi', 'te', 'ml'];

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('prescripto_lang');
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en';
  });

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.en[key] ?? key,
    [lang]
  );

  const setLanguage = useCallback((newLang) => {
    const l = SUPPORTED_LANGUAGES.includes(newLang) ? newLang : 'en';
    setLang(l);
    localStorage.setItem('prescripto_lang', l);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t, SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
