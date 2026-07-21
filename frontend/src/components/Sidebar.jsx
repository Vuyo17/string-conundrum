import React from 'react';
import {
  LayoutGrid, Eye, Code2, Trophy, Sparkles, Lock, Target,
} from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';

const NAV_ICONS = {
  Modules: LayoutGrid,
  Visualiser: Eye,
  'Code Space': Code2,
  Challenges: Target,
  Leaderboard: Trophy,
};

export function Sidebar({ screen, setScreen }) {
  const { isGuest, canAccess, signOut } = useAuth();
  const items = ['Modules', 'Visualiser', 'Code Space', 'Challenges', 'Leaderboard'];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideStreakBanner}>
        <div className={styles.sideStreakLabel}>
          <Sparkles size={12} /> {isGuest ? 'Guest mode' : 'Student portal'}
        </div>
        <p className={styles.sideStreakText}>
          {isGuest
            ? 'Sign in to unlock modules, exercises and the leaderboard.'
            : "You're on a 7-day streak 🔥 Keep it up!"}
        </p>
        {isGuest && (
          <button className={styles.sideUnlockBtn} onClick={signOut}>
            Sign in to unlock
          </button>
        )}
      </div>

      {items.map((item) => {
        const Icon = NAV_ICONS[item];
        const locked = !canAccess(item);
        return (
          <button
            key={item}
            className={`${screen === item ? styles.sideActive : ''} ${locked ? styles.sideLocked : ''}`}
            onClick={() => (locked ? signOut() : setScreen(item))}
            title={locked ? 'Sign in to unlock' : undefined}
          >
            {Icon && <Icon size={17} />}
            {item}
            {locked && <Lock size={13} className={styles.sideLockIcon} />}
          </button>
        );
      })}
    </aside>
  );
}
