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

// Store a completed exam paper as a mark.
//
// Best-effort, for the same reason markSectionComplete above is: a student who
// has just finished an exam is looking at their results screen, and a failed
// analytics write must not turn that into an error. The cost of swallowing it
// is one missing row in the lecturer's marks table, which is the right side to
// fail on.
//
// Counts go up, not the percentage -- the server computes the mark and the
// pass/fail flag from the counts, so a stored mark is always the server's
// arithmetic over its own grading rather than whatever the browser said.
export async function recordExamResult({
  moduleId, correctCount, totalCount, stars = 0, durationSeconds,
}) {
  try {
    await apiFetch(getApiUrl('/api/exams/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module_id: moduleId,
        correct_count: correctCount,
        total_count: totalCount,
        stars_awarded: stars,
        duration_seconds: durationSeconds,
      }),
    });
  } catch {
    // ignored — see comment above
  }
}
