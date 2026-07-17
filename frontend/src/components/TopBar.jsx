import React from 'react';
import { Bell, Search, BookOpen } from 'lucide-react';
import styles from '../styles/App.module.css';

export function TopBar({ screen, setScreen }) {
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
        <div className={styles.avatar}>HK</div>
      </div>
    </header>
  );
}
