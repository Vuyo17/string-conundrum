import React from 'react';
import { Languages } from 'lucide-react';
import s from './Auth.module.css';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Segmented language switch for the auth shell. Both languages are named in
 * full rather than cycled behind one button: a student who cannot read the
 * English page needs to see "isiXhosa" on screen to know the option exists.
 *
 * Built from LANGUAGES, so adding a third language needs no change here.
 */
export function AuthLanguageToggle() {
  const { lang, setLang, languages, t } = useLanguage();

  return (
    <div className={s.langSwitch} role="group" aria-label={t('auth.chooseLanguage')}>
      <Languages size={14} aria-hidden="true" className={s.langSwitchIcon} />
      {languages.map((language) => (
        <button
          key={language.code}
          type="button"
          lang={language.code}
          className={`${s.langOption} ${language.code === lang ? s.langOptionActive : ''}`}
          onClick={() => setLang(language.code)}
          aria-pressed={language.code === lang}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
