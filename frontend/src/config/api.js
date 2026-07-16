// API Configuration
// Automatically determines the correct API base URL based on environment

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

let API_BASE_URL;

if (isDevelopment) {
  // Local development - backend directly
  API_BASE_URL = 'http://137.158.61.235';
} else if (isProduction) {
  // Production on Netlify - use allorigins CORS proxy for HTTP backend
  API_BASE_URL = 'https://api.allorigins.win/raw?url=http://137.158.61.235';
} else {
  // Fallback
  API_BASE_URL = `${window.location.protocol}//${window.location.host}`;
}

export const getApiUrl = (path) => {
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If using allorigins proxy, append path as query param
  if (API_BASE_URL.includes('allorigins')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  // Otherwise use direct URL
  return `${API_BASE_URL}/${cleanPath}`;
};

export default API_BASE_URL;
