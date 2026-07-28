import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

// Real per-module completion for the signed-in user, backing sequential
// module unlocking and the Challenges gate. Guests never have server-side
// progress, so they get an empty (fully-locked-past-module-1) result.
export function useProgress() {
  const { user, isGuest } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || isGuest) {
      setModules([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    apiFetch(getApiUrl(`/api/progress/${user.uid}`))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setModules(data.modules ?? []);
      })
      .catch(() => {
        if (!cancelled) setModules([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, isGuest]);

  const byModuleId = Object.fromEntries(modules.map((m) => [m.module_id, m]));
  const allCompleted = modules.length > 0 && modules.every((m) => m.completed);

  return { modules, byModuleId, allCompleted, loading };
}
