import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  browserPopupRedirectResolver, GoogleAuthProvider,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
// initializeAuth (not getAuth) so we can pin the session to IndexedDB.
// Inside an installed iOS PWA, localStorage is wiped aggressively by
// Safari's ITP — so a barber who installs the app to the home screen
// gets logged out constantly. IndexedDB survives. Order = try-first:
// IndexedDB → localStorage → in-memory.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export async function getMessagingIfSupported() {
  try {
    if (await isSupported()) return getMessaging(app);
  } catch {}
  return null;
}

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
