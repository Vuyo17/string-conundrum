import React from 'react';
import { Check } from 'lucide-react';
import s from './Auth.module.css';
import { PASSWORD_RULES, STRENGTH_LABEL_KEYS, passwordScore } from './passwordPolicy';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Four-segment meter plus a progressive requirements checklist. Every met rule
 * is marked with a tick as well as a colour change, and the whole block is a
 * polite live region so screen readers hear progress without interruption.
 */
export function PasswordStrengthIndicator({ value }) {
  const { t } = useLanguage();
  const score = passwordScore(value);

  return (
    <div className={s.strength}>
      <div className={s.strengthTop}>
        <span className={s.strengthLabel}>{t('auth.passwordStrength')}</span>
        <span className={s.strengthValue} aria-live="polite">
          {value ? t(STRENGTH_LABEL_KEYS[score]) : ''}
        </span>
      </div>

      <div
        className={s.strengthTrack}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={PASSWORD_RULES.length}
        aria-label={t('auth.passwordStrength')}
      >
        {PASSWORD_RULES.map((rule, i) => (
          <span
            key={rule.id}
            className={`${s.strengthSegment} ${i < score ? s[`strengthOn${score}`] : ''}`}
          />
        ))}
      </div>

      <ul className={s.rules}>
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.id} className={`${s.rule} ${met ? s.ruleMet : ''}`}>
              <span className={s.ruleIcon} aria-hidden="true">
                <Check size={10} strokeWidth={3.5} />
              </span>
              <span>{t(rule.labelKey)}</span>
              <span className={s.srOnly}>{met ? t('auth.ruleMet') : t('auth.ruleNotMet')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
