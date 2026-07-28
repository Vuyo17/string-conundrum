import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from '../locales/en.json';
import xh from '../locales/xh.json';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'sc-lang';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'xh', label: 'isiXhosa' },
];

const BUNDLES = { en, xh };

function readInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && BUNDLES[stored]) return stored;
  } catch {
    // storage unavailable, fall through to the browser's preference
  }
  // navigator.language is "xh-ZA" on an isiXhosa device; match on the prefix.
  return navigator.language?.toLowerCase().startsWith('xh') ? 'xh' : 'en';
}

// Dotted lookup so callers can write t('settings.themeHint') against nested JSON.
function lookup(bundle, key) {
  return key.split('.').reduce((node, part) => (
    node && typeof node === 'object' ? node[part] : undefined
  ), bundle);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readInitialLanguage);

  useEffect(() => {
    // Screen readers and `lang`-scoped CSS both key off this attribute.
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage unavailable, the choice just won't persist
    }
  }, [lang]);

  const value = useMemo(() => {
    const bundle = BUNDLES[lang] ?? en;

    // Falls back to English, then to the key itself, so a missing isiXhosa
    // string degrades to readable English rather than blanking the UI.
    function t(key, vars) {
      const raw = lookup(bundle, key) ?? lookup(en, key) ?? key;
      if (typeof raw !== 'string') return key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name) => (
        name in vars ? String(vars[name]) : match
      ));
    }

    return { lang, setLang, t, languages: LANGUAGES };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
