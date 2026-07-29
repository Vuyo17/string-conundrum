import React, { useState } from 'react';
import { Loader2, Lock, Mail, UserRound } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { authErrorKey, validateEmailShape } from './authErrors';
import { useLanguage } from '../../context/LanguageContext';

export function SignInForm({ onForgotPassword, onCreateAccount, onGuest }) {
  const { login, continueAsGuest } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Errors are held as translation keys and resolved on render, so switching
  // language re-renders a message that is already on screen.
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null); // 'signin' | 'guest' | null

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const emailError = validateEmailShape(email);
    const passwordError = password ? '' : 'auth.enterPassword';
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setBusy('signin');
    try {
      await login(email.trim(), password);
    } catch (error) {
      setFormError(authErrorKey(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleGuest() {
    setFormError('');
    setBusy('guest');
    try {
      await continueAsGuest();
      onGuest?.();
    } catch (error) {
      setFormError(authErrorKey(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>{t('auth.signInTitle')}</h2>
      <p className={s.subheading}>{t('auth.signInSubtitle')}</p>

      <AuthError>{formError && t(formError)}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="signin-email"
            label={t("auth.studentEmail")}
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder="you@myuct.ac.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email && t(fieldErrors.email)}
          />

          <AuthField
            id="signin-password"
            label={t("auth.password")}
            type="password"
            icon={Lock}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password && t(fieldErrors.password)}
            action={
              <button type="button" className={s.linkButton} onClick={onForgotPassword}>
                {t('auth.forgotPassword')}
              </button>
            }
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy !== null}>
          {busy === 'signin' ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> {t('auth.signingIn')}
            </>
          ) : (
            t('auth.signInTitle')
          )}
        </button>
      </form>

      <div className={s.divider}>{t('auth.or')}</div>

      <button
        type="button"
        className={s.secondary}
        onClick={handleGuest}
        disabled={busy !== null}
      >
        {busy === 'guest' ? (
          <>
            <Loader2 size={16} className={s.spin} aria-hidden="true" /> {t('auth.settingUp')}
          </>
        ) : (
          <>
            <UserRound size={16} aria-hidden="true" /> {t('auth.continueAsGuest')}
          </>
        )}
      </button>
      <p className={s.guestNote}>
        {t('auth.guestNote')}
      </p>

      <p className={s.footerNote}>
        {t('auth.newHere')}{' '}
        <button type="button" className={s.inlineLink} onClick={onCreateAccount}>
          {t('auth.createAccount')}
        </button>
      </p>
    </div>
  );
}
