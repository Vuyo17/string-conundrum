import React, { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { authErrorKey, validateEmailShape } from './authErrors';
import { useLanguage } from '../../context/LanguageContext';

export function ForgotPasswordForm({ initialEmail = '', onSent, onBack }) {
  const { sendPasswordReset } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState(initialEmail);
  // Translation keys, resolved on render so the language toggle reaches them.
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const error = validateEmailShape(email);
    setFieldError(error);
    if (error) return;

    const address = email.trim();
    setBusy(true);
    try {
      await sendPasswordReset(address);
      onSent(address);
    } catch (err) {
      // Never confirm or deny that an address is registered: an unknown account
      // resolves to the same neutral confirmation screen as a known one.
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
        onSent(address);
        return;
      }
      setFormError(authErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>{t('auth.resetTitle')}</h2>
      <p className={s.subheading}>{t('auth.resetSubtitle')}</p>

      <AuthError>{formError && t(formError)}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="reset-email"
            label={t('auth.emailAddress')}
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder="you@myuct.ac.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError && t(fieldError)}
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> {t('auth.sending')}
            </>
          ) : (
            t('auth.sendResetInstructions')
          )}
        </button>
      </form>

      <p className={s.footerNote}>
        <button type="button" className={s.inlineLink} onClick={onBack}>
          {t('auth.backToSignIn')}
        </button>
      </p>
    </div>
  );
}
