import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { modules } from '../data/modules';
import { getModuleSectionIds } from '../utils/moduleSections';

// Real per-module section progress for the signed-in user, backing sequential
// module unlocking, the module card's progress bar, and the Challenges gate.
// Guests never have server-side progress, so they get an empty (fully-locked-
// past-module-1) result. `refresh` lets callers pull fresh state immediately
// after marking a section complete, rather than waiting for a reload.
export function useProgress() {
  const { user, isGuest } = useAuth();
  const [sectionsByModule, setSectionsByModule] = useState({});
  const [bypassUnlocks, setBypassUnlocksState] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user || isGuest) {
      setSectionsByModule({});
      setBypassUnlocksState(false);
      setLoading(false);
      return Promise.resolve();
    }

    setLoading(true);
    return apiFetch(getApiUrl(`/api/progress/${user.uid}`))
      .then((res) => res.json())
      .then((data) => {
        const byId = {};
        (data.modules ?? []).forEach((m) => {
          byId[m.module_id] = m.sections_completed ?? [];
        });
        setSectionsByModule(byId);
        setBypassUnlocksState(Boolean(data.bypass_unlocks));
      })
      .catch(() => {
        setSectionsByModule({});
        setBypassUnlocksState(false);
      })
      .finally(() => setLoading(false));
  }, [user, isGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byModuleId = Object.fromEntries(
    modules.map((mod) => {
      const total = getModuleSectionIds(mod.id).length;
      const done = (sectionsByModule[mod.id] ?? []).length;
      const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      return [mod.id, { percent, completed: total > 0 && done >= total }];
    }),
  );

  const allCompleted = bypassUnlocks
    || (modules.length > 0 && modules.every((mod) => byModuleId[mod.id]?.completed));

  async function setBypassUnlocks(next) {
    setBypassUnlocksState(next); // optimistic; refresh() reconciles on failure
    try {
      await apiFetch(getApiUrl('/api/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypass_unlocks: next }),
      });
    } catch {
      refresh();
    }
  }

  return { byModuleId, allCompleted, loading, bypassUnlocks, setBypassUnlocks, refresh };
}
