import React from 'react';
import { BookOpen } from 'lucide-react';
import s from './Auth.module.css';
import { AuthLanguageToggle } from './AuthLanguageToggle';
import { useLanguage } from '../../context/LanguageContext';

const SPECIMEN = 'STRINGS';
const HIGHLIGHT = [2, 3, 4];

// `variant` only controls where the wordmark is allowed to show: the aside copy
// on wide screens, the panel copy once the aside drops away. Typography is
// shared so both render identically.
function Wordmark({ variant }) {
  const { t } = useLanguage();

  return (
    <div className={`${s.wordmark} ${variant === 'panel' ? s.panelWordmark : ''}`}>
      <span className={s.wordmarkBadge}>
        <BookOpen size={17} aria-hidden="true" />
      </span>
      <span>
        <strong>{t('common.appName')}</strong>
        <small>{t('common.tagline')}</small>
      </span>
    </div>
  );
}

/**
 * Split shell: a quiet context column on the left, the active auth step on the
 * right. Below 860px the left column drops away entirely and the form becomes
 * the whole page.
 */
export function AuthLayout({ children }) {
  const { t } = useLanguage();

  return (
    <div className={s.shell}>
      <aside className={s.aside}>
        <Wordmark variant="aside" />

        <div className={s.asideBody}>
          <span className={s.eyebrow}>{t('auth.asideEyebrow')}</span>
          <h1>{t('auth.asideTitle')}</h1>
          <p>{t('auth.asideBlurb')}</p>

          <figure className={s.specimen}>
            <div className={s.specimenRow}>
              {SPECIMEN.split('').map((char, i) => (
                <span
                  key={char + i}
                  className={`${s.specimenCell} ${HIGHLIGHT.includes(i) ? s.specimenHighlight : ''}`}
                >
                  <span className={s.specimenChar}>{char}</span>
                  <span className={s.specimenTick} />
                </span>
              ))}
            </div>
            <div className={s.specimenRule} />
            <div className={s.specimenRow}>
              {SPECIMEN.split('').map((char, i) => (
                <span
                  key={char + i}
                  className={`${s.specimenCell} ${HIGHLIGHT.includes(i) ? s.specimenHighlight : ''}`}
                >
                  <span className={s.specimenIndex}>{i}</span>
                </span>
              ))}
            </div>
            <figcaption className={s.specimenCaption}>
              {t('auth.asideCaption')}
            </figcaption>
          </figure>
        </div>

        <p className={s.asideFoot}>{t('auth.asideFoot')}</p>
      </aside>

      <main className={s.panel}>
        {/* Anchored to the panel rather than a step, so the switch stays in the
            same place across every view the shell wraps. */}
        <AuthLanguageToggle />
        <Wordmark variant="panel" />
        {children}
      </main>
    </div>
  );
}
