import { auth } from './firebase';

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(path, { ...options, headers });
}
