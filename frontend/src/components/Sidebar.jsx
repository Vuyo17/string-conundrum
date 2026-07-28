import React from 'react';
import {
  LayoutGrid, Eye, Code2, Trophy, Sparkles, Lock, Target,
  Settings, LogOut,
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

export function Sidebar({ screen, setScreen, modulesComplete }) {
  const { isGuest, canAccess, signOut } = useAuth();
  const items = ['Modules', 'Visualiser', 'Code Space', 'Challenges', 'Leaderboard'];

  return (
    <aside className={styles.sidebar}>
      {isGuest && (
        <div className={styles.sideStreakBanner}>
          <div className={styles.sideStreakLabel}>
            <Sparkles size={12} /> Guest mode
          </div>
          <p className={styles.sideStreakText}>
            Sign in to unlock modules, exercises and the leaderboard.
          </p>
          <button className={styles.sideUnlockBtn} onClick={signOut}>
            Sign in to unlock
          </button>
        </div>
      )}

      {items.map((item) => {
        const Icon = NAV_ICONS[item];
        const signedInOnly = !canAccess(item);
        const needsModules = item === 'Challenges' && !modulesComplete;
        const locked = signedInOnly || needsModules;
        const lockMessage = signedInOnly
          ? 'Sign in to unlock'
          : needsModules
          ? 'Complete all modules to unlock'
          : undefined;
        return (
          <button
            key={item}
            className={`${screen === item ? styles.sideActive : ''} ${locked ? styles.sideLocked : ''}`}
            onClick={() => {
              if (signedInOnly) return signOut();
              if (needsModules) return;
              setScreen(item);
            }}
            title={lockMessage}
          >
            {Icon && <Icon size={17} />}
            {item}
            {locked && <Lock size={13} className={styles.sideLockIcon} />}
          </button>
        );
      })}

      <div className={styles.sideBottomSection}>
        <button
          className={screen === 'Settings' ? styles.sideActive : ''}
          onClick={() => setScreen('Settings')}
        >
          <Settings size={17} />
          Settings
        </button>

        <button
          className={styles.sideSignOutBtn}
          onClick={signOut}
          title={isGuest ? 'Sign in' : 'Sign out'}
        >
          <LogOut size={15} />
          {isGuest ? 'Sign in' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
