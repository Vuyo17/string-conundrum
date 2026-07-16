import React from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleCard } from '../components/ModuleCard';
import { modules } from '../data/modules';

export function Modules({ openModule }) {
  return (
    <div className={styles.screenStack}>
      <ScreenHeader
        title="Learning Modules"
        subtitle="Master all string concepts step by step. Complete each module to unlock the next."
      />
      <div className={styles.cardTopLine}>
        <span>All Modules</span>
        <span>Overall Progress <strong>72%</strong></span>
      </div>
      <div className={styles.moduleGrid}>
        {modules.map((mod, i) => (
          <ModuleCard
            key={mod.id}
            module={mod}
            number={i + 1}
            onOpen={() => openModule?.(mod.id, i + 1)}
          />
        ))}
      </div>
    </div>
  );
}
