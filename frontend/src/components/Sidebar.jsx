import React from 'react';
import {
  LayoutGrid, Eye, Code2, Target, Trophy, Sparkles,
} from 'lucide-react';
import styles from '../styles/App.module.css';

const NAV_ICONS = {
  Modules: LayoutGrid,
  Visualiser: Eye,
  'Code Space': Code2,
  Challenges: Target,
  Leaderboard: Trophy,
};

export function Sidebar({ screen, setScreen }) {
  const items = ['Modules', 'Visualiser', 'Code Space', 'Challenges', 'Leaderboard'];
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideStreakBanner}>
        <div className={styles.sideStreakLabel}>
          <Sparkles size={12} /> Student portal
        </div>
        <p className={styles.sideStreakText}>You're on a 7-day streak 🔥 Keep it up!</p>
      </div>

      {items.map((item) => {
        const Icon = NAV_ICONS[item];
        return (
          <button
            key={item}
            className={screen === item ? styles.sideActive : ''}
            onClick={() => setScreen(item)}
          >
            {Icon && <Icon size={17} />}
            {item}
          </button>
        );
      })}
    </aside>
  );
}
