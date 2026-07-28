import React from 'react';
import { Bell, BookOpen, Languages, Moon, Sun } from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlobalSearch } from './GlobalSearch';
import { displayNameFor, initialsFor } from '../utils/profile';
import { useLanguage } from '../context/LanguageContext';

export function TopBar({ setScreen, onSearchSelect }) {
  const { user, isGuest, canAccess } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, languages, t } = useLanguage();

  // Cycle rather than hard-code a pair, so adding a third language to
  // LANGUAGES keeps this button working with no change here.
  const nextLanguage = languages[
    (languages.findIndex((l) => l.code === lang) + 1) % languages.length
  ];

  return (
    <header className={styles.topbar}>
      <button
        className={styles.brandButton}
        onClick={() => setScreen(canAccess('Modules') ? 'Modules' : 'Visualiser')}
      >
        <span className={styles.logo}>
          <BookOpen size={18} />
        </span>
        <span>
          <strong>{t('common.appName')}</strong>
          <small>{t('common.tagline')}</small>
        </span>
      </button>

      <GlobalSearch onSelect={onSearchSelect} />

      <div className={styles.topActions}>
        {isGuest && <span className={styles.guestChip}>{t('common.guest')}</span>}
        {!isGuest && (
          <button className={styles.notifBtn} aria-label={t('topbar.notifications')}>
            <Bell size={17} />
            <span className={styles.notifDot} />
          </button>
        )}
        <button
          type="button"
          className={styles.langToggle}
          onClick={() => setLang(nextLanguage.code)}
          title={t('topbar.switchLanguage', { language: nextLanguage.label })}
          aria-label={t('topbar.switchLanguage', { language: nextLanguage.label })}
        >
          <Languages size={14} aria-hidden="true" />
          <span>{lang.toUpperCase()}</span>
        </button>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          title={isDark ? t('topbar.switchToLight') : t('topbar.switchToDark')}
          aria-label={isDark ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          type="button"
          className={styles.avatar}
          onClick={() => setScreen('Settings')}
          title={user?.email || displayNameFor(user)}
          aria-label={t('topbar.openProfile')}
        >
          {initialsFor(user)}
        </button>
      </div>
    </header>
  );
}
