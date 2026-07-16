// API Configuration
// Automatically determines the correct API base URL based on environment

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

let API_BASE_URL;

if (isDevelopment) {
  // Local development - backend on remote server with HTTPS
  API_BASE_URL = 'https://137.158.61.235';
} else if (isProduction) {
  // Production on Netlify - backend on remote server with HTTPS
  API_BASE_URL = 'https://137.158.61.235';
} else {
  // Fallback
  API_BASE_URL = `${window.location.protocol}//${window.location.host}`;
}

export const getApiUrl = (path) => {
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export default API_BASE_URL;
