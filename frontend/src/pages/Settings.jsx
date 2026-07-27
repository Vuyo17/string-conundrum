import React from 'react';
import { User, Palette, LogOut, Moon, Sun } from 'lucide-react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Settings() {
  const { user, isGuest, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // ThemeContext only exposes a toggle, so only flip when the pick differs.
  function chooseTheme(wantDark) {
    if (wantDark !== isDark) toggleTheme();
  }

  return (
    <div className={styles.screenStack}>
      <ScreenHeader title="Settings" subtitle="Your profile, appearance and account options." />

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <User size={15} /> Profile
        </div>
        <div className={styles.settingsProfile}>
          <div className={styles.profileAvatar}>{user?.initials ?? '?'}</div>
          <div>
            <strong className={styles.settingsProfileName}>{user?.name ?? 'Unknown'}</strong>
            <p className={styles.settingsRowHint}>
              {isGuest
                ? 'Browsing as a guest — your progress is not saved.'
                : user?.email}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <Palette size={15} /> Appearance
        </div>
        <div className={styles.settingsRow}>
          <div>
            <strong>Theme</strong>
            <p className={styles.settingsRowHint}>Choose how String Conundrum looks.</p>
          </div>
          <div className={styles.settingsChoice}>
            <button
              type="button"
              className={isDark ? '' : styles.settingsChoiceActive}
              aria-pressed={!isDark}
              onClick={() => chooseTheme(false)}
            >
              <Sun size={14} /> Light
            </button>
            <button
              type="button"
              className={isDark ? styles.settingsChoiceActive : ''}
              aria-pressed={isDark}
              onClick={() => chooseTheme(true)}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <LogOut size={15} /> Account
        </div>
        <div className={styles.settingsRow}>
          <div>
            <strong>{isGuest ? 'Sign in' : 'Sign out'}</strong>
            <p className={styles.settingsRowHint}>
              {isGuest
                ? 'Sign in to unlock modules, exercises and the leaderboard.'
                : 'End your session on this device.'}
            </p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={signOut}>
            <LogOut size={14} /> {isGuest ? 'Sign in' : 'Sign out'}
          </button>
        </div>
      </section>
    </div>
  );
}
