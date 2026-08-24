import React, { useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, Languages, Moon, Sun } from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlobalSearch } from './GlobalSearch';
import { displayNameFor, initialsFor } from '../utils/profile';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

export function TopBar({ setScreen, onSearchSelect }) {
  const { user, isGuest, canAccess } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, languages, t } = useLanguage();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Clicking anywhere else closes the panel, same pattern as GlobalSearch.
  useEffect(() => {
    if (!notifOpen) return undefined;
    function onPointerDown(event) {
      if (!notifRef.current?.contains(event.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notifOpen]);

  function toggleNotifications() {
    // Both setters called directly here, not one nested inside the other's
    // updater — a state updater has to stay pure, and calling a different
    // component's setState (markAllRead) from inside one trips React's
    // "Cannot update a component while rendering a different component"
    // warning.
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) markAllRead();
  }

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
        title={t('nav.goHome')}
        aria-label={t('nav.goHome')}
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
          <div className={styles.notifWrap} ref={notifRef}>
            <button
              type="button"
              className={styles.notifBtn}
              aria-label={t('topbar.notifications')}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              onClick={toggleNotifications}
            >
              <Bell size={17} />
              {unreadCount > 0 && <span className={styles.notifDot} />}
            </button>
            {notifOpen && (
              <div className={styles.notifPanel} role="menu">
                <p className={styles.notifPanelTitle}>{t('notifications.panelTitle')}</p>
                {notifications.length === 0 ? (
                  <p className={styles.notifEmpty}>{t('notifications.empty')}</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={styles.notifItem}>
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
