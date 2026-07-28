import React, { useEffect, useState } from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleCard } from '../components/ModuleCard';
import { ModulePage } from './ModulePage';
import { modules } from '../data/modules';

export function Modules({ target, progress }) {
  // Which module is open, if any. Null shows the card grid.
  const [openModule, setOpenModule] = useState(null);
  // Where inside that module to land, when a search result sent us here.
  const [entry, setEntry] = useState(null);

  // Merge real per-module completion into the static module metadata, and
  // lock every module until the one before it is complete. While progress
  // is still loading, default everything past the first to locked so the UI
  // never flashes an unlock it has to immediately take back.
  const byModuleId = progress?.byModuleId ?? {};
  const progressLoading = progress?.loading ?? true;

  const enrichedModules = modules.map((mod, i) => {
    const p = byModuleId[mod.id];
    const completed = p?.completed ?? false;
    const total = p?.total_questions ?? 0;
    const answered = p?.answered_questions ?? 0;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

    const prevId = modules[i - 1]?.id;
    const prevCompleted = i === 0 || (byModuleId[prevId]?.completed ?? false);
    const locked = progressLoading ? i > 0 : !prevCompleted;

    const status = locked
      ? 'Locked'
      : completed
      ? 'Completed'
      : percent > 0
      ? 'In progress'
      : 'Not started';

    return { ...mod, progress: percent, status };
  });

  const overallProgress = Math.round(
    enrichedModules.reduce((sum, mod) => sum + mod.progress, 0) / enrichedModules.length,
  );

  // A search hit on a module, topic, example or practice section opens it —
  // unless that module is still locked, in which case search can't bypass it.
  useEffect(() => {
    if (!target?.moduleId) return;
    const mod = enrichedModules.find((m) => m.id === target.moduleId);
    if (!mod || mod.status === 'Locked') return;
    setOpenModule(mod);
    setEntry({ section: target.section, anchor: target.anchor, nonce: target.nonce });
  }, [target]);

  function closeModule() {
    setOpenModule(null);
    setEntry(null);
  }

  if (openModule) {
    const number = modules.findIndex((mod) => mod.id === openModule.id) + 1;
    return (
      <ModulePage
        key={openModule.id}
        moduleId={openModule.id}
        moduleNumber={number}
        onBack={closeModule}
        initialSection={entry?.section}
        anchor={entry?.anchor}
        entryKey={entry?.nonce}
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
        <span>Overall Progress <strong>{overallProgress}%</strong></span>
      </div>
      <div className={styles.moduleGrid}>
        {enrichedModules.map((mod, i) => (
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
