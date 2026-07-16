// API Configuration
// Automatically determines the correct API base URL based on environment
// Note: Production uses CORS proxy due to mixed content (HTTPS frontend -> HTTP backend) restrictions

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

let API_BASE_URL;

if (isDevelopment) {
  // Local development - direct connection to backend
  API_BASE_URL = 'http://137.158.61.235';
} else if (isProduction) {
  // Production: Use allorigins CORS proxy to work around HTTPS->HTTP mixed content issue
  // This allows https://stringscon.netlify.app to request from http://137.158.61.235
  API_BASE_URL = 'https://api.allorigins.win/raw?url=http://137.158.61.235';
} else {
  // Fallback to same-origin
  API_BASE_URL = `${window.location.protocol}//${window.location.host}`;
}

export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

export default API_BASE_URL;
