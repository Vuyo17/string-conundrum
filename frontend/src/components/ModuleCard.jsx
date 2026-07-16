import React from 'react';
import { ArrowRight, CheckCircle2, Lock, PlayCircle } from 'lucide-react';
import styles from '../styles/App.module.css';
import { Progress } from './Progress';

export function ModuleCard({ module, number, onOpen }) {
  const locked = module.status === 'Locked';

  const statusClass = {
    Completed: styles.statusCompleted,
    'In progress': styles.statusInProgress,
    Locked: styles.statusLocked,
  }[module.status];

  const StatusIcon = module.status === 'Completed'
    ? CheckCircle2
    : locked
    ? Lock
    : PlayCircle;

  return (
    <article
      className={`${styles.moduleCard} ${locked ? styles.locked : ''}`}
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      onClick={locked ? undefined : onOpen}
      onKeyDown={locked ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.();
        }
      }}
      aria-label={locked ? `${module.title} (locked)` : `Open module: ${module.title}`}
      style={locked ? undefined : { cursor: 'pointer' }}
    >
      <div className={styles.moduleNumber}>{number}</div>
      <h3>{module.title}</h3>
      <p>{module.desc}</p>
      <span className={`${styles.statusBadge} ${statusClass}`}>
        <StatusIcon size={11} />
        {module.status}
      </span>
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
        {module.time}
        {!locked && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '10px', color: 'var(--primary)', fontWeight: 700 }}>
            Start learning <ArrowRight size={12} />
          </span>
        )}
      </p>
      <Progress value={module.progress} />
    </article>
  );
}
