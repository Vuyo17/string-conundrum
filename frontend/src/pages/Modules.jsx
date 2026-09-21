import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles/App.module.css';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleCard } from '../components/ModuleCard';
import { ModulePage } from './ModulePage';
import { useModuleCatalog } from '../context/ModuleCatalogContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function Modules({ target, progress }) {
  const { t } = useLanguage();
  const { modules, loading, error, refresh } = useModuleCatalog();
  const { isAdmin } = useAuth();
  useEffect(() => { refresh(); }, [refresh, target]);
  // Which module is open, if any. Null shows the card grid.
  const [openModuleId, setOpenModuleId] = useState(null);
  // Where inside that module to land, when a search result sent us here.
  const [entry, setEntry] = useState(null);
  const handledTarget = useRef(null);

  // Merge progress into the published catalogue,
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
    const locked = (isAdmin || bypassUnlocks) ? false : progressLoading ? i > 0 : !prevCompleted;

    const status = locked
      ? 'Locked'
      : completed
      ? 'Completed'
      : percent > 0
      ? 'In progress'
      : 'Not started';

    return { ...mod, progress: percent, status };
  });

  const openModule = enrichedModules.find(mod => mod.id === openModuleId);
  const overallProgress = enrichedModules.length ? Math.round(
    enrichedModules.reduce((sum, mod) => sum + mod.progress, 0) / enrichedModules.length,
  ) : 0;

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
    if (!target || handledTarget.current === target) return;
    if (!target.moduleId) {
      handledTarget.current = target;
      closeModule();
      return;
    }
    const mod = enrichedModules.find((m) => m.id === target.moduleId);
    if (!mod || mod.status === 'Locked') return;
    handledTarget.current = target;
    setOpenModuleId(mod.id);
    setEntry({ section: target.section, anchor: target.anchor, nonce: target.nonce });
  }, [target, modules, progressLoading, bypassUnlocks, isAdmin]);

  function closeModule() {
    setOpenModuleId(null);
    setEntry(null);
  }

  if (openModule) {
    const number = modules.findIndex((mod) => mod.id === openModule.id) + 1;
    return (
      <ModulePage
        key={openModule.id}
        moduleId={openModule.id}
        moduleMetadata={openModule}
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
      {error && (
        <p role="alert">
          {t('modules.loadError')}{' '}
          <button type="button" onClick={refresh}>{t('modules.retry')}</button>
        </p>
      )}
      {loading && modules.length === 0 && <p role="status">{t('common.loading')}</p>}
      {!loading && !error && modules.length === 0 && <p>{t('modules.nonePublished')}</p>}
      <div className={styles.moduleGrid}>
        {enrichedModules.map((mod, i) => (
          <ModuleCard
            key={mod.id}
            module={mod}
            number={i + 1}
            onOpen={(mod) => setOpenModuleId(mod.id)}
          />
        ))}
      </div>
    </div>
  );
}
