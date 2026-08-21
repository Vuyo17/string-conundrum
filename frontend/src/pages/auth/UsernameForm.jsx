import React, { useState } from 'react';
import { ArrowRight, Loader2, UserRound } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { validateUsername } from './authErrors';
import { useLanguage } from '../../context/LanguageContext';

/**
 * The default way in: a name, nothing else. No address to verify, so nothing
 * here can be blocked by mail delivery or a sending quota.
 *
 * The name doubles as the account key — the backend hashes it into a stable
 * uid — which is why the hint tells students to reuse it rather than treating
 * it as a throwaway label.
 */
export function UsernameForm({ onSignIn, onDone }) {
  const { signInWithUsername } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const error = validateUsername(username);
    setFieldError(error);
    if (error) return;

    setBusy(true);
    try {
      await signInWithUsername(username.trim());
      onDone?.();
    } catch (err) {
      // The backend applies the same rules, so a rejection here means the two
      // validators disagreed — show it against the field, not as a server fault.
      if (err?.message === 'invalid_username') {
        setFieldError('auth.errors.usernameInvalid');
      } else {
        setFormError('auth.errors.network');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>{t('auth.usernameTitle')}</h2>
      <p className={s.subheading}>{t('auth.usernameSubtitle')}</p>

      <AuthError>{formError && t(formError)}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="username"
            label={t('auth.usernameLabel')}
            icon={UserRound}
            autoComplete="nickname"
            autoFocus
            maxLength={24}
            placeholder={t('auth.usernamePlaceholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={fieldError && t(fieldError)}
            hint={t('auth.usernameHint')}
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> {t('auth.settingUp')}
            </>
          ) : (
            <>
              <ArrowRight size={16} aria-hidden="true" /> {t('auth.usernameContinue')}
            </>
          )}
        </button>
      </form>

      <p className={s.guestNote}>{t('auth.usernameNote')}</p>

      <div className={s.divider}>{t('auth.or')}</div>

      <p className={s.footerNote}>
        {t('auth.haveEmailAccount')}{' '}
        <button type="button" className={s.inlineLink} onClick={onSignIn}>
          {t('auth.signInWithEmail')}
        </button>
      </p>
    </div>
  );
}
