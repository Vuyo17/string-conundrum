import React from 'react';
import { Bell, Search, BookOpen, LogOut } from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';

export function TopBar({ setScreen }) {
  const { user, isGuest, canAccess, signOut } = useAuth();

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

      <div className={styles.topSearch}>
        <Search className={styles.topSearchIcon} />
        <input
          className={styles.topSearchInput}
          placeholder="Search modules, topics…"
        />
      </div>

      <div className={styles.topActions}>
        {isGuest
          ? <span className={styles.guestChip}>Guest</span>
          : <span className={styles.streak}>🔥 7 days</span>}
        {!isGuest && (
          <button className={styles.notifBtn}>
            <Bell size={17} />
            <span className={styles.notifDot} />
          </button>
        )}
        <div className={styles.avatar} title={user?.name}>
          {user?.initials ?? '?'}
        </div>
        <button
          className={styles.signOutBtn}
          onClick={signOut}
          title={isGuest ? 'Sign in' : 'Sign out'}
        >
          <LogOut size={15} />
          {isGuest ? 'Sign in' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
