import React from 'react';
import { Award, Flame, Lightbulb, Medal, Rocket, Star, Trophy } from 'lucide-react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';

// Demo standings. Badges are icon components (no emojis, per the app's
// design language) — each represents an achievement earned in practice.
const rows = [
  { name: 'Ava Johnson', stars: '482', badges: [Trophy, Star] },
  { name: 'Sarah Williams', stars: '421', badges: [Medal, Rocket] },
  { name: 'Hlomla Kuhlane', stars: '390', badges: [Medal, Star] },
  { name: 'Michael Chen', stars: '345', badges: [Flame] },
  { name: 'Luvuyo Matomela', stars: '312', badges: [Lightbulb] },
];

export function Leaderboard() {
  return (
    <div className={styles.leaderboardLayout}>
      <section className={styles.card}>
        <ScreenHeader title="Leaderboard" subtitle="Friendly competition to keep you motivated." />
        {rows.map((row, i) => (
          <div
            key={row.name}
            className={`${styles.leaderRow} ${i === 2 ? styles.highlightRow : ''}`}
          >
            <span>{i + 1}</span>
            <strong>{row.name}</strong>
            <span style={{ color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {row.stars} <Star size={13} />
            </span>
            <span style={{ display: 'inline-flex', gap: '6px', color: 'var(--accent, #b45309)' }}>
              {row.badges.map((Badge, bi) => <Badge key={bi} size={15} />)}
            </span>
          </div>
        ))}
      </section>

      <aside className={styles.card} style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '4px' }}>Your Rank</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>This week</p>
        <div className={styles.trophy}><Award size={44} /></div>
        <h1 style={{ fontSize: '52px', margin: '0', color: 'var(--primary)' }}>#3</h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>
          Great work! Keep learning and climb the leaderboard.
        </p>
        <div style={{ marginTop: '16px' }}>
          <button className={styles.primaryButton} style={{ width: '100%', justifyContent: 'center' }}>
            <Star size={14} /> Earn More Stars
          </button>
        </div>
      </aside>
    </div>
  );
}
