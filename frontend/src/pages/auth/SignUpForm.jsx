import React, { useState } from 'react';
import { GraduationCap, Loader2, Mail } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { UCT_DOMAIN, friendlyAuthError, validateUctEmail } from './authErrors';
import { useLanguage } from '../../context/LanguageContext';

export function SignUpForm({ initialEmail = '', onSent, onSignIn }) {
  const { sendSignUpLink } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const error = validateUctEmail(email);
    setFieldError(error);
    if (error) return;

    const address = email.trim();
    setBusy(true);
    try {
      await sendSignUpLink(address);
      onSent(address);
    } catch (err) {
      setFormError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>{t('auth.createAccountTitle')}</h2>
      <p className={s.subheading}>
        {t('auth.createAccountSubtitle')}
      </p>

      <AuthError tone="info">
        {t('auth.uctOnlyNote', { domain: UCT_DOMAIN })}
      </AuthError>

      <AuthError>{formError}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="signup-email"
            label={t("auth.uctEmail")}
            type="email"
            icon={GraduationCap}
            autoComplete="email"
            placeholder={`you${UCT_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
            hint={t("auth.inboxHint")}
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> {t('auth.sendingLink')}
            </>
          ) : (
            <>
              <Mail size={16} aria-hidden="true" /> {t('auth.sendLink')}
            </>
          )}
        </button>
      </form>

      <p className={s.footerNote}>
        {t('auth.alreadyHaveAccount')}{' '}
        <button type="button" className={s.inlineLink} onClick={onSignIn}>
          {t('auth.signInTitle')}
        </button>
      </p>
    </div>
  );
}
