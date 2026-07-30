import React from 'react';
import { User, Palette, LogOut, Moon, Sun, Languages, Unlock } from 'lucide-react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { displayNameFor, initialsFor } from '../utils/profile';

export function Settings({ progress }) {
  const { user, isGuest, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, languages, t } = useLanguage();
  const bypassUnlocks = progress?.bypassUnlocks ?? false;

  // ThemeContext only exposes a toggle, so only flip when the pick differs.
  function chooseTheme(wantDark) {
    if (wantDark !== isDark) toggleTheme();
  }

  return (
    <div className={styles.screenStack}>
      <ScreenHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <User size={15} /> {t('settings.profile')}
        </div>
        <div className={styles.settingsProfile}>
          <div className={styles.profileAvatar}>{initialsFor(user)}</div>
          <div>
            <strong className={styles.settingsProfileName}>{displayNameFor(user)}</strong>
            <p className={styles.settingsRowHint}>
              {isGuest ? t('settings.guestHint') : user?.email}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <Palette size={15} /> {t('settings.appearance')}
        </div>
        <div className={styles.settingsRow}>
          <div>
            <strong>{t('settings.theme')}</strong>
            <p className={styles.settingsRowHint}>{t('settings.themeHint')}</p>
          </div>
          <div className={styles.settingsChoice}>
            <button
              type="button"
              className={isDark ? '' : styles.settingsChoiceActive}
              aria-pressed={!isDark}
              onClick={() => chooseTheme(false)}
            >
              <Sun size={14} /> {t('settings.light')}
            </button>
            <button
              type="button"
              className={isDark ? styles.settingsChoiceActive : ''}
              aria-pressed={isDark}
              onClick={() => chooseTheme(true)}
            >
              <Moon size={14} /> {t('settings.dark')}
            </button>
          </div>
        </div>

        <div className={styles.settingsRow}>
          <div>
            <strong>{t('settings.language')}</strong>
            <p className={styles.settingsRowHint}>{t('settings.languageHint')}</p>
          </div>
          <div className={styles.settingsChoice}>
            {languages.map((option) => (
              <button
                key={option.code}
                type="button"
                className={lang === option.code ? styles.settingsChoiceActive : ''}
                aria-pressed={lang === option.code}
                onClick={() => setLang(option.code)}
              >
                <Languages size={14} /> {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!isGuest && (
        <section className={styles.card}>
          <div className={styles.settingsSectionTitle}>
            <Unlock size={15} /> {t('settings.learning')}
          </div>
          <div className={styles.settingsRow}>
            <div>
              <strong>{t('settings.unlockAll')}</strong>
              <p className={styles.settingsRowHint}>{t('settings.unlockAllHint')}</p>
            </div>
            <div className={styles.settingsChoice}>
              <button
                type="button"
                className={!bypassUnlocks ? styles.settingsChoiceActive : ''}
                aria-pressed={!bypassUnlocks}
                onClick={() => progress?.setBypassUnlocks(false)}
              >
                {t('settings.unlockAllOff')}
              </button>
              <button
                type="button"
                className={bypassUnlocks ? styles.settingsChoiceActive : ''}
                aria-pressed={bypassUnlocks}
                onClick={() => progress?.setBypassUnlocks(true)}
              >
                {t('settings.unlockAllOn')}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.settingsSectionTitle}>
          <LogOut size={15} /> {t('settings.account')}
        </div>
        <div className={styles.settingsRow}>
          <div>
            <strong>{isGuest ? t('nav.signIn') : t('nav.signOut')}</strong>
            <p className={styles.settingsRowHint}>
              {isGuest ? t('settings.signInHint') : t('settings.signOutHint')}
            </p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={signOut}>
            <LogOut size={14} /> {isGuest ? t('nav.signIn') : t('nav.signOut')}
          </button>
        </div>
      </section>
    </div>
  );
}
