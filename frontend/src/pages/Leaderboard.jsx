import React, { useEffect, useState } from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

export function Leaderboard() {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl('/api/leaderboard'))
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLeaders(data.leaders ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Cannot reach the server. Is the backend running?');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const myRank = user ? leaders.findIndex((leader) => leader.uid === user.uid) : -1;

  return (
    <div className={styles.leaderboardLayout}>
      <section className={styles.card}>
        <ScreenHeader title="Leaderboard" subtitle="Friendly competition to keep you motivated." />
        {loading && <p className={styles.muted}>Loading leaderboard…</p>}
        {loadError && <p className={styles.muted}>{loadError}</p>}
        {!loading && !loadError && leaders.length === 0 && (
          <p className={styles.muted}>No scores yet. Complete an exercise or challenge to appear here.</p>
        )}
        {leaders.map((leader, i) => (
          <div
            key={leader.uid}
            className={`${styles.leaderRow} ${user && leader.uid === user.uid ? styles.highlightRow : ''}`}
          >
            <span>{i + 1}</span>
            <strong>{leader.name}</strong>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{leader.stars} ⭐</span>
            <span />
          </div>
        ))}
      </section>

      <aside className={styles.card} style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '4px' }}>Your Rank</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>All time</p>
        <div className={styles.trophy}>🏆</div>
        <h1 style={{ fontSize: '52px', margin: '0', color: 'var(--primary)' }}>
          {myRank >= 0 ? `#${myRank + 1}` : '—'}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>
          {myRank >= 0
            ? 'Great work! Keep learning and climb the leaderboard.'
            : 'Complete an exercise or challenge to get on the board.'}
        </p>
      </aside>
    </div>
  );
}
