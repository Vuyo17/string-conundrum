import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, Code2, Eye, Loader2, Lock, LogIn, Mail,
  Sparkles, User, UserPlus,
} from 'lucide-react';
import styles from '../styles/Auth.module.css';
import { useAuth } from '../context/AuthContext';

const DEMO_TEXT = 'conundrum';

// Little scripted show for the left panel: the product demos itself.
const DEMO_SCENES = [
  { code: 'word[0]', highlight: [0], result: "'c'" },
  { code: 'word[2:5]', highlight: [2, 3, 4], result: "'nun'" },
  { code: 'word[-1]', highlight: [8], result: "'m'" },
  { code: 'word[::2]', highlight: [0, 2, 4, 6, 8], result: "'cnnrm'" },
  { code: 'for c in word:', highlight: 'sweep', result: 'c = …' },
];

function useDemo() {
  const [scene, setScene] = useState(0);
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setScene(s => (s + 1) % DEMO_SCENES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const current = DEMO_SCENES[scene];
  const sweeping = current.highlight === 'sweep';

  useEffect(() => {
    if (!sweeping) return undefined;
    setSweep(0);
    const t = setInterval(() => setSweep(i => (i + 1) % DEMO_TEXT.length), 320);
    return () => clearInterval(t);
  }, [sweeping, scene]);

  const highlight = sweeping ? [sweep] : current.highlight;
  const result = sweeping ? `c = '${DEMO_TEXT[sweep]}'` : current.result;
  return { code: current.code, highlight, result };
}

export function Auth() {
  const { signIn, signUp, continueAsGuest } = useAuth();
  const [tab, setTab] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const demo = useDemo();

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!email.trim() || !password) return false;
    if (tab === 'signup' && !name.trim()) return false;
    return true;
  }, [busy, email, password, name, tab]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setError('');
    setBusy(true);
    try {
      if (tab === 'signin') await signIn(email, password);
      else await signUp(name, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchTab(next) {
    setTab(next);
    setError('');
  }

  return (
    <div className={styles.page}>
      {/* ── left: brand stage ── */}
      <aside className={styles.stage}>
        <div className={styles.brandRow}>
          <span className={styles.logo}><BookOpen size={20} /></span>
          <div>
            <strong>String Conundrum</strong>
            <small>Master Python Strings</small>
          </div>
        </div>

        <div className={styles.demoBlock}>
          <p className={styles.kicker}><Sparkles size={13} /> Watch strings come alive</p>
          <h1 className={styles.headline}>
            Every character<br />has an <em>address.</em>
          </h1>

          <div className={styles.demoCode}>
            <span className={styles.demoPrompt}>&gt;&gt;&gt;</span> {demo.code}
          </div>

          <div className={styles.strip}>
            {DEMO_TEXT.split('').map((ch, i) => (
              <span
                key={i}
                className={`${styles.tile} ${demo.highlight.includes(i) ? styles.tileOn : ''}`}
              >
                <small>{i}</small>
                {ch}
              </span>
            ))}
          </div>

          <div className={styles.demoResult} key={demo.result}>
            <span>→</span> {demo.result}
          </div>
        </div>

        <ul className={styles.featureList}>
          <li><Eye size={15} /> Visualise indexing, slicing and loops step by step</li>
          <li><Code2 size={15} /> Run real Python with a built-in visual debugger</li>
          <li><Lock size={15} /> Sign in to unlock modules, exercises and the leaderboard</li>
        </ul>
      </aside>

      {/* ── right: form card ── */}
      <main className={styles.formSide}>
        <section className={styles.card}>
          <div className={styles.tabs} role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'signin'}
              className={tab === 'signin' ? styles.tabActive : ''}
              onClick={() => switchTab('signin')}
            >
              <LogIn size={15} /> Sign in
            </button>
            <button
              role="tab"
              aria-selected={tab === 'signup'}
              className={tab === 'signup' ? styles.tabActive : ''}
              onClick={() => switchTab('signup')}
            >
              <UserPlus size={15} /> Create account
            </button>
            <span
              className={styles.tabGlider}
              style={{ transform: tab === 'signin' ? 'translateX(0)' : 'translateX(100%)' }}
            />
          </div>

          <h2 className={styles.cardTitle}>
            {tab === 'signin' ? 'Welcome back' : 'Start learning'}
          </h2>
          <p className={styles.cardSub}>
            {tab === 'signin'
              ? 'Pick up your modules, streak and progress where you left off.'
              : 'Create a free account to track progress across all 9 modules.'}
          </p>

          {tab === 'signup' && (
            <label className={styles.field}>
              <span>Name</span>
              <div className={styles.inputWrap}>
                <User size={16} />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            </label>
          )}

          <label className={styles.field}>
            <span>Email</span>
            <div className={styles.inputWrap}>
              <Mail size={16} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@myuct.ac.za"
                autoComplete="email"
              />
            </div>
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <div className={styles.inputWrap}>
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button className={styles.submit} onClick={handleSubmit} disabled={!canSubmit}>
            {busy
              ? <><Loader2 size={17} className={styles.spin} /> Please wait…</>
              : <>{tab === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></>}
          </button>

          <div className={styles.divider}><span>or</span></div>

          <button className={styles.guest} onClick={continueAsGuest}>
            Continue as guest
          </button>
          <p className={styles.guestNote}>
            Guests can explore the <strong>Visualiser</strong> and <strong>Code Space</strong>.
            Sign in for modules, exercises and the leaderboard.
          </p>
        </section>
      </main>
    </div>
  );
}
