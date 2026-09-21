import { apiFetch } from '../../api';
import { getApiUrl } from '../../config/api';

// Thin wrapper over the /api/admin/* endpoints.
//
// Unlike the student-facing calls elsewhere in the app, these throw on
// failure rather than degrading quietly. A student whose progress ping fails
// should carry on learning; a lecturer looking at a marks table that silently
// rendered stale or empty data would draw conclusions from it. Loud failure
// is the safer default here.

async function request(path, options = {}) {
  const response = await apiFetch(getApiUrl(`/api/admin${path}`), options);

  if (response.status === 403) {
    throw new Error('Your account does not have lecturer access.');
  }
  if (response.status === 401) {
    throw new Error('Your session has expired. Sign in again.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

const query = (params) => {
  const search = new URLSearchParams(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== ''),
  ).toString();
  return search ? `?${search}` : '';
};

export const adminApi = {
  overview: (params) => request(`/overview${query(params)}`),
  students: (params) => request(`/students${query(params)}`),
  student: (uid) => request(`/students/${encodeURIComponent(uid)}`),
  marks: (params) => request(`/marks${query(params)}`),
  misconceptions: (params) => request(`/misconceptions${query(params)}`),
  questions: (params) => request(`/questions${query(params)}`),

  modules: () => request('/modules'),
  createModule: (body) => request('/modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  updateModule: (id, body) => request(`/modules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  updateModuleContent: (id, body) => request(`/modules/${encodeURIComponent(id)}/content`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  reorderModules: (order) => request('/modules/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  }),
  archiveModule: (id) => request(`/modules/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  exercises: (moduleId) => request(`/modules/${encodeURIComponent(moduleId)}/exercises`),
  saveExercise: (moduleId, questionId, body) => request(
    `/modules/${encodeURIComponent(moduleId)}/exercises/${encodeURIComponent(questionId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  ),
  deleteExercise: (moduleId, questionId) => request(
    `/modules/${encodeURIComponent(moduleId)}/exercises/${encodeURIComponent(questionId)}`,
    { method: 'DELETE' },
  ),

  setRole: (uid, role) => request(`/users/${encodeURIComponent(uid)}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  }),
};

// The CSV download is the one endpoint that does not return JSON. It also
// cannot be a plain <a href>: the route is behind require_admin, and a link
// navigation carries no Authorization header. So the file is fetched with the
// token attached and handed to the browser as a blob.
export async function downloadMarksCsv(params) {
  const response = await apiFetch(getApiUrl(`/api/admin/marks.csv${query(params)}`));
  if (!response.ok) {
    throw new Error('Could not export marks.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'string-conundrum-marks.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers, so this
  // waits a beat rather than freeing the object URL synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
