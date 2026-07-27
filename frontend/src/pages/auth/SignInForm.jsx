import React, { useState } from 'react';
import { Loader2, Lock, Mail, UserRound } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { useAuth } from '../../context/AuthContext';
import { friendlyAuthError, validateEmailShape } from './authErrors';

export function SignInForm({ onForgotPassword, onCreateAccount, onGuest }) {
  const { login, continueAsGuest } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null); // 'signin' | 'guest' | null

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const emailError = validateEmailShape(email);
    const passwordError = password ? '' : 'Please enter your password.';
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setBusy('signin');
    try {
      await login(email.trim(), password);
    } catch (error) {
      setFormError(friendlyAuthError(error));
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
      setFormError(friendlyAuthError(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>Sign in</h2>
      <p className={s.subheading}>Pick up where you left off.</p>

      <AuthError>{formError}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="signin-email"
            label="Student email"
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder="you@myuct.ac.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />

          <AuthField
            id="signin-password"
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            action={
              <button type="button" className={s.linkButton} onClick={onForgotPassword}>
                Forgot password?
              </button>
            }
          />
        </div>

        <button type="submit" className={s.submit} disabled={busy !== null}>
          {busy === 'signin' ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className={s.divider}>or</div>

      <button
        type="button"
        className={s.secondary}
        onClick={handleGuest}
        disabled={busy !== null}
      >
        {busy === 'guest' ? (
          <>
            <Loader2 size={16} className={s.spin} aria-hidden="true" /> Setting up...
          </>
        ) : (
          <>
            <UserRound size={16} aria-hidden="true" /> Continue as guest
          </>
        )}
      </button>
      <p className={s.guestNote}>
        Explore the platform without an account. Guest progress is not linked to
        your UCT account and will be lost when you sign out.
      </p>

      <p className={s.footerNote}>
        New here?{' '}
        <button type="button" className={s.inlineLink} onClick={onCreateAccount}>
          Create an account
        </button>
      </p>
    </div>
  );
}
