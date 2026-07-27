import React, { useState } from 'react';
import { AlertCircle, Check, Loader2, Lock, Mail } from 'lucide-react';
import s from './Auth.module.css';
import { AuthField } from './AuthField';
import { AuthError } from './AuthError';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { useAuth } from '../../context/AuthContext';
import { friendlyAuthError, validateEmailShape } from './authErrors';
import { meetsPolicy } from './passwordPolicy';

/**
 * Reached by opening the emailed link. Firebase needs the address back to
 * redeem the link; it is normally in localStorage, but if the student opens
 * the link on another device we ask for it first.
 */
export function PasswordSetupForm({ email, needsEmail, onEmailConfirmed, onComplete, onRestart }) {
  const { completeSignUpLink, setAccountPassword } = useAuth();

  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const strongEnough = meetsPolicy(password);
  const matches = password.length > 0 && password === confirm;

  async function handleEmailSubmit(event) {
    event.preventDefault();
    const error = validateEmailShape(emailInput);
    setEmailError(error);
    if (error) return;
    onEmailConfirmed(emailInput.trim());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setTouchedConfirm(true);
    if (!strongEnough || !matches) return;

    setBusy(true);
    try {
      // Redeeming the link signs the student in; the password is then set on
      // that freshly authenticated account.
      await completeSignUpLink(email);
      await setAccountPassword(password);
      onComplete();
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  if (needsEmail) {
    return (
      <div className={s.panelInner}>
        <h2 className={s.heading}>Confirm your email</h2>
        <p className={s.subheading}>
          You opened this link on a different device. Enter the UCT email address
          you signed up with to continue.
        </p>

        <form onSubmit={handleEmailSubmit} noValidate>
          <div className={s.fields}>
            <AuthField
              id="confirm-email"
              label="UCT student email"
              type="email"
              icon={Mail}
              autoComplete="email"
              placeholder="you@myuct.ac.za"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              error={emailError}
            />
          </div>
          <button type="submit" className={s.submit}>Continue</button>
        </form>

        <p className={s.footerNote}>
          <button type="button" className={s.inlineLink} onClick={onRestart}>
            Start over
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={s.panelInner}>
      <h2 className={s.heading}>Choose a password</h2>
      <p className={s.subheading}>
        Setting up <span className={s.statusAddress}>{email}</span>
      </p>

      <AuthError>{formError}</AuthError>

      <form onSubmit={handleSubmit} noValidate>
        <div className={s.fields}>
          <AuthField
            id="new-password"
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <PasswordStrengthIndicator value={password} />

        <div className={s.fields} style={{ marginTop: 18 }}>
          <AuthField
            id="confirm-password"
            label="Confirm password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setTouchedConfirm(true)}
            error={touchedConfirm && confirm && !matches ? 'Passwords do not match.' : ''}
          />
        </div>

        {confirm.length > 0 && matches && (
          <p className={`${s.matchRow} ${s.matchOk}`}>
            <Check size={14} aria-hidden="true" /> Passwords match
          </p>
        )}
        {confirm.length > 0 && !matches && !touchedConfirm && (
          <p className={`${s.matchRow} ${s.matchNo}`}>
            <AlertCircle size={14} aria-hidden="true" /> Passwords do not match yet
          </p>
        )}

        <button
          type="submit"
          className={s.submit}
          disabled={busy || !strongEnough || !matches}
        >
          {busy ? (
            <>
              <Loader2 size={16} className={s.spin} aria-hidden="true" /> Creating account...
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </div>
  );
}
