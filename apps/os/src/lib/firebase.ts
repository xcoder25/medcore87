/**
 * Firebase client — Auth + Firestore for Hospital OS.
 * Prefer NEXT_PUBLIC_FIREBASE_* env on Vercel.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  enableIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAOLWLpM0vzIljUeXOnSQbppzuaHhfmXyI',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'naija-bites-1s3y1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'naija-bites-1s3y1',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'naija-bites-1s3y1.firebasestorage.app',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '667802678337',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:667802678337:web:2018efd10f6ca9dbe742c0',
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let persistenceEnabled = false;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirestore(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

/** Offline cache on device — reads/writes work offline, sync when online */
export async function enableFirestoreOffline(): Promise<void> {
  if (persistenceEnabled || typeof window === 'undefined') return;
  try {
    await enableIndexedDbPersistence(getFirestore());
    persistenceEnabled = true;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    // multi-tab or already enabled — safe to ignore
    if (code !== 'failed-precondition' && code !== 'unimplemented') {
      console.warn('[Firestore] persistence:', code || err);
    }
    persistenceEnabled = true;
  }
}

export async function firebaseSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

export async function firebaseSignUp(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

export async function firebaseSignOut(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function isEmailCredential(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Path: facilities/{facilityId}/store/shared */
export function facilityStoreRef(facilityId: string) {
  const id = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
  return doc(getFirestore(), 'facilities', id, 'store', 'shared');
}

export async function firestoreWriteFacility(
  facilityId: string,
  partial: Record<string, unknown>
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const ref = facilityStoreRef(facilityId);
    await setDoc(
      ref,
      {
        ...partial,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn('[Firestore] write failed', e);
    return false;
  }
}

export async function firestoreReadFacility(
  facilityId: string
): Promise<Record<string, unknown> | null> {
  try {
    await enableFirestoreOffline();
    const snap = await getDoc(facilityStoreRef(facilityId));
    if (!snap.exists()) return null;
    return snap.data() as Record<string, unknown>;
  } catch (e) {
    console.warn('[Firestore] read failed', e);
    return null;
  }
}

/** Live multi-user listener for the facility document */
export function firestoreSubscribeFacility(
  facilityId: string,
  onData: (data: Record<string, unknown>) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    try {
      await enableFirestoreOffline();
      unsub = onSnapshot(
        facilityStoreRef(facilityId),
        (snap) => {
          if (snap.exists()) onData(snap.data() as Record<string, unknown>);
        },
        (err) => console.warn('[Firestore] snapshot', err)
      );
    } catch (e) {
      console.warn('[Firestore] subscribe failed', e);
    }
  })();
  return () => unsub();
}

export { doc, setDoc, getDoc, onSnapshot };
