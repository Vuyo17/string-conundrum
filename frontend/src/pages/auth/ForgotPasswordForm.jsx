import React, { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { friendlyAuthError, validateEmailShape } from './authErrors';

export function ForgotPasswordForm({ initialEmail = '', onSent, onBack }) {
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState(initialEmail);
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
      setFormError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>Reset your password</h2>
      <p className={s.subheading}>
        Enter your email address and we will send you instructions to set a new
        password.
      </p>

      <AuthError>{formError}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="reset-email"
            label="Email address"
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder="you@myuct.ac.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> Sending...
            </>
          ) : (
            'Send reset instructions'
          )}
        </button>
      </form>

      <p className={s.footerNote}>
        <button type="button" className={s.inlineLink} onClick={onBack}>
          Back to sign in
        </button>
      </p>
    </div>
  );
}
