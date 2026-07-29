import React from 'react';
import { ArrowRight, CheckCircle2, Lock, PlayCircle } from 'lucide-react';
import styles from '../styles/App.module.css';
import { Progress } from './Progress';
import { useLanguage } from '../context/LanguageContext';

// `module.status` stays an English code so the lock/style logic never depends
// on the display language; only the label below it is translated.
const STATUS_KEY = {
  Completed: 'modules.status.completed',
  'In progress': 'modules.status.inProgress',
  'Not started': 'modules.status.notStarted',
  Locked: 'modules.status.locked',
};

export function ModuleCard({ module, number, onOpen }) {
  const { t } = useLanguage();
  const locked = module.status === 'Locked';

  const title = t(`modules.items.${module.id}.title`);

  const statusClass = {
    Completed: styles.statusCompleted,
    'In progress': styles.statusInProgress,
    'Not started': styles.statusLocked,
    Locked: styles.statusLocked,
  }[module.status];

  const StatusIcon = module.status === 'Completed'
    ? CheckCircle2
    : locked
    ? Lock
    : PlayCircle;

  return (
    <article
      className={`${styles.moduleCard} ${locked ? styles.locked : styles.moduleCardOpenable}`}
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      aria-label={
        locked ? t('modules.lockedModule', { title }) : t('modules.openModule', { title })
      }
      onClick={locked ? undefined : () => onOpen?.(module)}
      onKeyDown={
        locked
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen?.(module);
              }
            }
      }
    >
      <div className={styles.moduleNumber}>{number}</div>
      <h3>{title}</h3>
      <p>{t(`modules.items.${module.id}.desc`)}</p>
      <span className={`${styles.statusBadge} ${statusClass}`}>
        <StatusIcon size={11} />
        {t(STATUS_KEY[module.status])}
      </span>
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
        {t('modules.minutes', { count: module.minutes })}
      </p>
      <Progress value={module.progress} />
      {!locked && (
        <span className={styles.moduleOpenHint} aria-hidden="true">
          {t('modules.open')} <ArrowRight size={13} />
        </span>
      )}
    </article>
  );
}
