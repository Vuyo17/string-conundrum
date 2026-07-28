import React, { useState } from 'react';
import { CheckCircle2, Inbox, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import s from './Auth.module.css';
import { AuthLayout } from './AuthLayout';
import { AuthStatusPanel } from './AuthStatusPanel';
import { AuthError } from './AuthError';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { PasswordSetupForm } from './PasswordSetupForm';
import { useAuth } from '../../context/AuthContext';
import { friendlyAuthError } from './authErrors';
import { useLanguage } from '../../context/LanguageContext';

/**
 * One container, many steps. Every authentication state renders inside the same
 * layout so moving between them swaps only the panel content, never the page.
 */
export function AuthPage() {
  const { user, emailLinkPending, storedSignUpEmail, sendSignUpLink, logout, finishEmailLinkFlow } =
    useAuth();
  const { t } = useLanguage();

  // Whether a session already existed when this page mounted. Redeeming a link
  // signs the student in part-way through setup, so the "already signed in"
  // guard below has to test arrival state rather than the live user.
  const [arrivedSignedIn] = useState(() => Boolean(user));

  // Opening the emailed link drops the student straight into password setup.
  const [view, setView] = useState(() =>
    emailLinkPending && !user ? 'passwordSetup' : 'signIn',
  );
  const [email, setEmail] = useState(() => (emailLinkPending ? storedSignUpEmail() : ''));
  const [resendState, setResendState] = useState({ busy: false, sent: false, error: '' });

  function go(nextView) {
    setResendState({ busy: false, sent: false, error: '' });
    setView(nextView);
  }

  async function resendSignUpLink() {
    setResendState({ busy: true, sent: false, error: '' });
    try {
      await sendSignUpLink(email);
      setResendState({ busy: false, sent: true, error: '' });
    } catch (error) {
      setResendState({ busy: false, sent: false, error: friendlyAuthError(error) });
    }
  }

  // Reached by re-opening an email link on a session that is already signed in.
  if (arrivedSignedIn) {
    return (
      <AuthLayout>
        <AuthStatusPanel
          icon={ShieldCheck}
          title={t('auth.alreadySignedIn')}
          actions={
            <>
              <button type="button" className={s.submit} onClick={finishEmailLinkFlow}>
                {t('auth.continueToApp')}
              </button>
              <button
                type="button"
                className={s.secondary}
                onClick={async () => {
                  await logout();
                  finishEmailLinkFlow();
                }}
              >
                {t('auth.differentAccount')}
              </button>
            </>
          }
        >
          {t('auth.signedInAs', { email: user?.email ?? t('common.guest') })}
        </AuthStatusPanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {view === 'signIn' && (
        <SignInForm
          onForgotPassword={() => go('forgotPassword')}
          onCreateAccount={() => go('signUp')}
        />
      )}

      {view === 'signUp' && (
        <SignUpForm
          initialEmail={email}
          onSignIn={() => go('signIn')}
          onSent={(address) => {
            setEmail(address);
            go('emailSent');
          }}
        />
      )}

      {view === 'emailSent' && (
        <AuthStatusPanel
          icon={Inbox}
          title={t('auth.checkInbox')}
          actions={
            <>
              {resendState.sent && (
                <AuthError tone="success">
                  {t('auth.linkSentAgain')}
                </AuthError>
              )}
              {resendState.error && <AuthError>{resendState.error}</AuthError>}
              <button
                type="button"
                className={s.secondary}
                onClick={resendSignUpLink}
                disabled={resendState.busy}
              >
                {resendState.busy ? (
                  <>
                    <Loader2 size={16} className={s.spin} aria-hidden="true" /> {t('auth.resending')}
                  </>
                ) : (
                  t('auth.resendEmail')
                )}
              </button>
            </>
          }
          footer={
            <>
              <button type="button" className={s.inlineLink} onClick={() => go('signUp')}>
                {t('auth.changeEmail')}
              </button>
              <button type="button" className={s.inlineLink} onClick={() => go('signIn')}>
                {t('auth.backToSignIn')}
              </button>
            </>
          }
        >
          {t('auth.verificationSent', { email })}
          <div className={s.statusSteps}>
            <ol>
              <li>{t('auth.step1')}</li>
              <li>{t('auth.step2')}</li>
              <li>{t('auth.step3')}</li>
            </ol>
          </div>
        </AuthStatusPanel>
      )}

      {view === 'passwordSetup' && (
        <PasswordSetupForm
          email={email}
          needsEmail={!email}
          onEmailConfirmed={setEmail}
          onComplete={() => setView('accountReady')}
          onRestart={() => {
            finishEmailLinkFlow();
            go('signUp');
          }}
        />
      )}

      {view === 'accountReady' && (
        <AuthStatusPanel
          icon={CheckCircle2}
          tone="success"
          title={t('auth.accountReady')}
          actions={
            <button type="button" className={s.submit} onClick={finishEmailLinkFlow}>
              {t('auth.continueToApp')}
            </button>
          }
        >
          {t('auth.accountReadyBlurb', { email })}
        </AuthStatusPanel>
      )}

      {view === 'forgotPassword' && (
        <ForgotPasswordForm
          initialEmail={email}
          onBack={() => go('signIn')}
          onSent={(address) => {
            setEmail(address);
            go('resetSent');
          }}
        />
      )}

      {view === 'resetSent' && (
        <AuthStatusPanel
          icon={MailCheck}
          title={t('auth.checkInboxShort')}
          actions={
            <button type="button" className={s.secondary} onClick={() => go('forgotPassword')}>
              {t('auth.resendReset')}
            </button>
          }
          footer={
            <button type="button" className={s.inlineLink} onClick={() => go('signIn')}>
              Back to sign in
            </button>
          }
        >
          If an account exists for{' '}
          <span className={s.statusAddress}>{email}</span>, we have sent
          instructions to reset your password.
        </AuthStatusPanel>
      )}
    </AuthLayout>
  );
}
