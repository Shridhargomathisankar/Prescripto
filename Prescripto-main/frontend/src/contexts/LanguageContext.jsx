import { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('prescripto_lang');
    return ['en', 'ta', 'hi', 'ml', 'te'].includes(saved) ? saved : 'en';
  });

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.en[key] ?? key,
    [lang]
  );

  const setLanguage = useCallback((newLang) => {
    const valid = ['en', 'ta', 'hi', 'ml', 'te'].includes(newLang) ? newLang : 'en';
    setLang(valid);
    localStorage.setItem('prescripto_lang', valid);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
