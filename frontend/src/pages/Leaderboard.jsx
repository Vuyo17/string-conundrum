import React from 'react';
import { Zap } from 'lucide-react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';

const rows = [
  ['Ava Johnson', '4,820', '🏆 🦊 ⭐'],
  ['Sarah Williams', '4,210', '🏅 🚀'],
  ['Hlomla Kuhlane', '3,900', '🥉 ⭐'],
  ['Michael Chen', '3,450', '🔥'],
  ['Luvuyo Matomela', '3,120', '💡'],
];

export function Leaderboard() {
  return (
    <div className={styles.leaderboardLayout}>
      <section className={styles.card}>
        <ScreenHeader title="Leaderboard" subtitle="Friendly competition to keep you motivated." />
        {rows.map((row, i) => (
          <div
            key={row[0]}
            className={`${styles.leaderRow} ${i === 2 ? styles.highlightRow : ''}`}
          >
            <span>{i + 1}</span>
            <strong>{row[0]}</strong>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{row[1]} XP</span>
            <span>{row[2]}</span>
          </div>
        ))}
      </section>

      <aside className={styles.card} style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '4px' }}>Your Rank</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>This week</p>
        <div className={styles.trophy}>🏆</div>
        <h1 style={{ fontSize: '52px', margin: '0', color: 'var(--primary)' }}>#3</h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>
          Great work! Keep learning and climb the leaderboard.
        </p>
        <div style={{ marginTop: '16px' }}>
          <button className={styles.primaryButton} style={{ width: '100%', justifyContent: 'center' }}>
            <Zap size={14} /> Earn More XP
          </button>
        </div>
      </aside>
    </div>
  );
}
