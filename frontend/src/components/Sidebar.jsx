import React from 'react';
import {
  LayoutGrid, Eye, Code2, Trophy, Sparkles, Lock, Target,
  Settings, LogOut,
} from 'lucide-react';
import styles from '../styles/App.module.css';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// Screen ids stay English — they key the router, `canAccess` and the screen map
// in App.jsx. Only the visible label is translated, via `labelKey`.
const NAV_ITEMS = [
  { id: 'Modules', icon: LayoutGrid, labelKey: 'nav.modules' },
  { id: 'Visualiser', icon: Eye, labelKey: 'nav.visualiser' },
  { id: 'Code Space', icon: Code2, labelKey: 'nav.codeSpace' },
  { id: 'Challenges', icon: Target, labelKey: 'nav.challenges' },
  { id: 'Leaderboard', icon: Trophy, labelKey: 'nav.leaderboard' },
];

export function Sidebar({ screen, setScreen }) {
  const { isGuest, canAccess, signOut } = useAuth();
  const { t } = useLanguage();

  return (
    <aside className={styles.sidebar}>
      {isGuest && (
        <div className={styles.sideStreakBanner}>
          <div className={styles.sideStreakLabel}>
            <Sparkles size={12} /> {t('nav.guestMode')}
          </div>
          <p className={styles.sideStreakText}>{t('nav.guestBlurb')}</p>
          <button className={styles.sideUnlockBtn} onClick={signOut}>
            {t('nav.signInToUnlock')}
          </button>
        </div>
      )}

      {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => {
        const locked = !canAccess(id);
        return (
          <button
            key={id}
            className={`${screen === id ? styles.sideActive : ''} ${locked ? styles.sideLocked : ''}`}
            onClick={() => (locked ? signOut() : setScreen(id))}
            title={locked ? t('nav.signInToUnlock') : undefined}
          >
            {Icon && <Icon size={17} />}
            {t(labelKey)}
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
          {t('nav.settings')}
        </button>

        <button
          className={styles.sideSignOutBtn}
          onClick={signOut}
          title={isGuest ? t('nav.signIn') : t('nav.signOut')}
        >
          <LogOut size={15} />
          {isGuest ? t('nav.signIn') : t('nav.signOut')}
        </button>
      </div>
    </aside>
  );
}
