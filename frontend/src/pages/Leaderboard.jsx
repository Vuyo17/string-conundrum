import React, { useEffect, useState } from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function Leaderboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  // A translation key, resolved on render so the language toggle reaches it.
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
        if (!cancelled) setLoadError('leaderboard.serverUnreachable');
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
        <ScreenHeader title={t('leaderboard.title')} subtitle={t('leaderboard.subtitle')} />
        {loading && <p className={styles.muted}>{t('leaderboard.loading')}</p>}
        {loadError && <p className={styles.muted}>{t(loadError)}</p>}
        {!loading && !loadError && leaders.length === 0 && (
          <p className={styles.muted}>{t('leaderboard.empty')}</p>
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
        <h2 style={{ marginBottom: '4px' }}>{t('leaderboard.yourRank')}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{t('leaderboard.allTime')}</p>
        <div className={styles.trophy}>🏆</div>
        <h1 style={{ fontSize: '52px', margin: '0', color: 'var(--primary)' }}>
          {myRank >= 0 ? `#${myRank + 1}` : '—'}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>
          {myRank >= 0 ? t('leaderboard.ranked') : t('leaderboard.unranked')}
        </p>
      </aside>
    </div>
  );
}
