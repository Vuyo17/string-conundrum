import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Temporary fallback for environments where Vite env vars are not configured.
const fallbackConfig = {
  apiKey: 'AIzaSyDzK73Mq10lyMLBMYpl_ZhkBiZa14vdDOg',
  authDomain: 'string-conundrum.firebaseapp.com',
  projectId: 'string-conundrum',
  storageBucket: 'string-conundrum.firebasestorage.app',
  messagingSenderId: '738328461291',
  appId: '1:738328461291:web:3dd39dcc27f2ea850a63ae',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
