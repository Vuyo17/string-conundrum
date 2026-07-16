import React from 'react';
import { CheckCircle2, Lock, PlayCircle } from 'lucide-react';
import styles from '../styles/App.module.css';
import { Progress } from './Progress';

export function ModuleCard({ module, number }) {
  const statusClass = {
    Completed: styles.statusCompleted,
    'In progress': styles.statusInProgress,
    Locked: styles.statusLocked,
  }[module.status];

  const StatusIcon = module.status === 'Completed'
    ? CheckCircle2
    : module.status === 'Locked'
    ? Lock
    : PlayCircle;

  return (
    <article className={`${styles.moduleCard} ${module.status === 'Locked' ? styles.locked : ''}`}>
      <div className={styles.moduleNumber}>{number}</div>
      <h3>{module.title}</h3>
      <p>{module.desc}</p>
      <span className={`${styles.statusBadge} ${statusClass}`}>
        <StatusIcon size={11} />
        {module.status}
      </span>
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{module.time}</p>
      <Progress value={module.progress} />
    </article>
  );
}
