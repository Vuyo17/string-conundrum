import React, { useEffect, useState } from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleCard } from '../components/ModuleCard';
import { ModulePage } from './ModulePage';
import { modules } from '../data/modules';
import { useLanguage } from '../context/LanguageContext';

export function Modules({ target, progress, setScreen }) {
  const { t } = useLanguage();
  // Which module is open, if any. Null shows the card grid.
  const [openModule, setOpenModule] = useState(null);
  // Where inside that module to land, when a search result sent us here.
  const [entry, setEntry] = useState(null);

  // Merge real per-module section progress into the static module metadata,
  // and lock every module until the one before it is complete. While progress
  // is still loading, default everything past the first to locked so the UI
  // never flashes an unlock it has to immediately take back. The Settings
  // "unlock everything" toggle bypasses all of this.
  const byModuleId = progress?.byModuleId ?? {};
  const progressLoading = progress?.loading ?? true;
  const bypassUnlocks = progress?.bypassUnlocks ?? false;

  const enrichedModules = modules.map((mod, i) => {
    const p = byModuleId[mod.id];
    const completed = p?.completed ?? false;
    const percent = p?.percent ?? 0;

    const prevId = modules[i - 1]?.id;
    const prevCompleted = i === 0 || (byModuleId[prevId]?.completed ?? false);
    const locked = bypassUnlocks ? false : progressLoading ? i > 0 : !prevCompleted;

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
  //
  // A target with no moduleId (the sidebar's "Modules" click sends a bare
  // `{ nonce }`) means "go back to the overview" — cycle-1 usability
  // feedback reported the sidebar's Modules button doing nothing while a
  // module was open, because nothing here ever cleared `openModule` back to
  // null. `target` is `null` only on first mount (before any navigation),
  // when there is nothing to close, so that case is still a no-op.
  useEffect(() => {
    if (!target) return;
    if (!target.moduleId) {
      closeModule();
      return;
    }
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
        onProgressChange={progress?.refresh}
      />
    );
  }

  return (
    <div className={styles.screenStack}>
      <ScreenHeader title={t('modules.title')} subtitle={t('modules.subtitle')} />
      <div className={styles.cardTopLine}>
        <span>{t('modules.allModules')}</span>
        <span>{t('modules.overallProgress')} <strong>{overallProgress}%</strong></span>
      </div>
      {/* cycle-1 usability feedback: one participant wanted free navigation
          between modules rather than the sequential 80%-to-advance gate —
          that's exactly what Settings' "Unlock everything" already does, it
          just wasn't discoverable. Only shown while it'd actually change
          something: some module still locked, and not already turned on. */}
      {!bypassUnlocks && enrichedModules.some((mod) => mod.status === 'Locked') && (
        <p className={styles.cardTopHint}>
          {t('modules.unlockHintPrefix')}{' '}
          <button type="button" className={styles.linkButton} onClick={() => setScreen?.('Settings')}>
            {t('modules.unlockHintLink')}
          </button>
        </p>
      )}
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
