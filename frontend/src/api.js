import { auth } from './firebase';
import { getApiUrl } from './config/api';

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(path, { ...options, headers });
}

// Best-effort: a student reaching a section is not worth blocking navigation
// over, so a failed ping is swallowed rather than surfaced.
export async function markSectionComplete(moduleId, sectionId) {
  try {
    await apiFetch(getApiUrl(`/api/modules/${moduleId}/sections/${sectionId}/complete`), {
      method: 'POST',
    });
  } catch {
    // ignored — see comment above
  }
}
