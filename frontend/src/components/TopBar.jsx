import React from 'react';
import { Bell, BookOpen, Moon, Sun } from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlobalSearch } from './GlobalSearch';
import { displayNameFor, initialsFor } from '../utils/profile';

export function TopBar({ setScreen, onSearchSelect }) {
  const { user, isGuest, canAccess } = useAuth();
  const { isDark, toggleTheme } = useTheme();

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
          <strong>String Conundrum</strong>
          <small>Master Python Strings</small>
        </span>
      </button>

      <GlobalSearch onSelect={onSearchSelect} />

      <div className={styles.topActions}>
        {isGuest && <span className={styles.guestChip}>Guest</span>}
        {!isGuest && (
          <button className={styles.notifBtn}>
            <Bell size={17} />
            <span className={styles.notifDot} />
          </button>
        )}
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className={styles.avatar} title={user?.email || displayNameFor(user)}>
          {initialsFor(user)}
        </div>
      </div>
    </header>
  );
}
