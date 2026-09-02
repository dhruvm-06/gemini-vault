import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoPlaceholderKey',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gemini-vault-507219.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gemini-vault-507219',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gemini-vault-507219.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Safe diagnostic summary (never prints API keys or secrets)
export const firebaseDiagnostics = {
  projectId: firebaseConfig.projectId,
  databaseId: 'default',
  authDomain: firebaseConfig.authDomain,
  hasApiKey: Boolean(import.meta.env.VITE_FIREBASE_API_KEY),
  hasAuthDomain: Boolean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  hasProjectId: Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  hasStorageBucket: Boolean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  hasMessagingSenderId: Boolean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  hasAppId: Boolean(import.meta.env.VITE_FIREBASE_APP_ID),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  transport: 'long-polling (experimentalForceLongPolling enabled)',
};

console.log('[Firebase Diagnostics] Environment availability & configuration:', {
  VITE_FIREBASE_API_KEY: firebaseDiagnostics.hasApiKey ? 'PRESENT' : 'FALLBACK_USED',
  VITE_FIREBASE_AUTH_DOMAIN: firebaseDiagnostics.hasAuthDomain ? 'PRESENT' : 'DEFAULT_USED',
  VITE_FIREBASE_PROJECT_ID: firebaseDiagnostics.hasProjectId ? 'PRESENT' : 'DEFAULT_USED',
  VITE_FIREBASE_STORAGE_BUCKET: firebaseDiagnostics.hasStorageBucket ? 'PRESENT' : 'DEFAULT_USED',
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseDiagnostics.hasMessagingSenderId ? 'PRESENT' : 'MISSING',
  VITE_FIREBASE_APP_ID: firebaseDiagnostics.hasAppId ? 'PRESENT' : 'MISSING',
  projectId: firebaseDiagnostics.projectId,
  databaseId: firebaseDiagnostics.databaseId,
  authDomain: firebaseDiagnostics.authDomain,
  isOnline: firebaseDiagnostics.isOnline,
  transport: firebaseDiagnostics.transport,
});

// Initialize Firebase client instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use initializeFirestore explicitly targeting database ID "default" for Firestore Enterprise Native instances
// and experimentalForceLongPolling to eliminate WebChannel streaming failures behind reverse proxies / iframes.
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  'default'
);

export const googleProvider = new GoogleAuthProvider();

// Configure Google provider options
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

