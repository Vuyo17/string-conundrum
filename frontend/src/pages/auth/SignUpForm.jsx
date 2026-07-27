import React, { useState } from 'react';
import { GraduationCap, Loader2, Mail } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { UCT_DOMAIN, friendlyAuthError, validateUctEmail } from './authErrors';

export function SignUpForm({ initialEmail = '', onSent, onSignIn }) {
  const { sendSignUpLink } = useAuth();

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
      <h2 className={s.heading}>Create your account</h2>
      <p className={s.subheading}>
        Registration is currently open to UCT students only.
      </p>

      <AuthError tone="info">
        Use your university address ending in <strong>{UCT_DOMAIN}</strong>. We
        will email you a secure link to finish setting up.
      </AuthError>

      <AuthError>{formError}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="signup-email"
            label="UCT student email"
            type="email"
            icon={GraduationCap}
            autoComplete="email"
            placeholder={`you${UCT_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
            hint="You will need to open the link from your UCT inbox."
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> Sending link...
            </>
          ) : (
            <>
              <Mail size={16} aria-hidden="true" /> Send verification link
            </>
          )}
        </button>
      </form>

      <p className={s.footerNote}>
        Already have an account?{' '}
        <button type="button" className={s.inlineLink} onClick={onSignIn}>
          Sign in
        </button>
      </p>
    </div>
  );
}
