// API Configuration
// Prefer explicit env override, otherwise use same-origin relative paths.
// This works well when Nginx serves frontend and proxies /api to Flask.

const envApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = envApiBase.replace(/\/+$/, '');

export const getApiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

export default API_BASE_URL;
