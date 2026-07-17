import React, { useState } from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleCard } from '../components/ModuleCard';
import { ModulePage } from './ModulePage';
import { modules } from '../data/modules';

export function Modules() {
  // Which module is open, if any. Null shows the card grid.
  const [openModule, setOpenModule] = useState(null);

  if (openModule) {
    const number = modules.findIndex((mod) => mod.id === openModule.id) + 1;
    return (
      <ModulePage
        moduleId={openModule.id}
        moduleNumber={number}
        onBack={() => setOpenModule(null)}
      />
    );
  }

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
            onOpen={setOpenModule}
          />
        ))}
      </div>
    </div>
  );
}
