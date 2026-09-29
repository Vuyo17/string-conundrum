import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useModuleCatalog } from '../context/ModuleCatalogContext';
import { getModuleContent } from '../data/moduleContent';
import { modulePageContent, moduleProgress } from '../utils/moduleCatalog';

// Content shape doesn't vary by language, so 'en' is always safe here.
const contentFor = (module) => modulePageContent(module, getModuleContent(module.id, 'en'));

// Real per-module section progress for the signed-in user, backing sequential
// module unlocking, the module card's progress bar, and the Challenges gate.
// Guests never have server-side progress, so they get an empty (fully-locked-
// past-module-1) result. `refresh` lets callers pull fresh state immediately
// after marking a section complete, rather than waiting for a reload.
export function useProgress() {
  const { user, isGuest } = useAuth();
  const { modules, loading: catalogLoading } = useModuleCatalog();
  const [sectionsByModule, setSectionsByModule] = useState({});
  const [bypassUnlocks, setBypassUnlocksState] = useState(false);
  // Leaderboard participation defaults to on (matching how every account
  // behaved before these settings existed) so a fetch failure or a guest
  // session degrades to "visible", not "silently opted out".
  const [leaderboardOptIn, setLeaderboardOptInState] = useState(true);
  const [leaderboardAnonymous, setLeaderboardAnonymousState] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user || isGuest) {
      setSectionsByModule({});
      setBypassUnlocksState(false);
      setLeaderboardOptInState(true);
      setLeaderboardAnonymousState(false);
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
        setLeaderboardOptInState(data.leaderboard_optin ?? true);
        setLeaderboardAnonymousState(Boolean(data.leaderboard_anonymous));
      })
      .catch(() => {
        setSectionsByModule({});
        setBypassUnlocksState(false);
        setLeaderboardOptInState(true);
        setLeaderboardAnonymousState(false);
      })
      .finally(() => setLoading(false));
  }, [user, isGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byModuleId = useMemo(
    () => moduleProgress(modules, sectionsByModule, contentFor),
    [modules, sectionsByModule],
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

  async function setLeaderboardOptIn(next) {
    setLeaderboardOptInState(next); // optimistic; refresh() reconciles on failure
    try {
      await apiFetch(getApiUrl('/api/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderboard_optin: next }),
      });
    } catch {
      refresh();
    }
  }

  async function setLeaderboardAnonymous(next) {
    setLeaderboardAnonymousState(next); // optimistic; refresh() reconciles on failure
    try {
      await apiFetch(getApiUrl('/api/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaderboard_anonymous: next }),
      });
    } catch {
      refresh();
    }
  }

  return {
    byModuleId,
    allCompleted,
    loading: loading || catalogLoading,
    bypassUnlocks,
    setBypassUnlocks,
    leaderboardOptIn,
    setLeaderboardOptIn,
    leaderboardAnonymous,
    setLeaderboardAnonymous,
    refresh,
  };
}
