import React from 'react';
import { Bell, LogOut, Search, BookOpen } from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';

function initialsFor(user) {
  const source = user?.displayName || user?.email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function TopBar({ screen, setScreen }) {
  const { user, logout } = useAuth();

  return (
    <header className={styles.topbar}>
      <button className={styles.brandButton} onClick={() => setScreen('Modules')}>
        <span className={styles.logo}>
          <BookOpen size={18} />
        </span>
        <span>
          <strong>String Conundrum</strong>
          <small>Master Python Strings</small>
        </span>
      </button>

      <div className={styles.topSearch}>
        <Search className={styles.topSearchIcon} />
        <input
          className={styles.topSearchInput}
          placeholder="Search modules, topics…"
        />
      </div>

      <div className={styles.topActions}>
        <span className={styles.streak}>🔥 7 days</span>
        <button className={styles.notifBtn}>
          <Bell size={17} />
          <span className={styles.notifDot} />
        </button>
        <div className={styles.avatar} title={user?.email ?? ''}>{initialsFor(user)}</div>
        <button className={styles.notifBtn} onClick={logout} title="Log out" aria-label="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
