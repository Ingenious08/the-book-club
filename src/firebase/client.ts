import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

/** Lazily initialised so nothing touches Firebase during server rendering. */
export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
  if (!app || !auth || !db) {
    app = getApps().length ? getApp() : initializeApp(config);
    auth = getAuth(app);
    try {
      // Default memory cache on purpose: a stale persisted cache must never say "ready".
      db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(app);
    }
  }
  return { app, auth, db };
}
