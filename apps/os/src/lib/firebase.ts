/**
 * Firebase client — Auth + Firestore for Hospital OS.
 * Prefer NEXT_PUBLIC_FIREBASE_* env on Vercel.
 */
import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
  type Unsubscribe as AuthUnsubscribe,
} from 'firebase/auth';
import {
  getFirestore as getFirestoreSdk,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  enableIndexedDbPersistence,
  deleteDoc,
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
    db = getFirestoreSdk(getFirebaseApp());
  }
  return db;
}

/** Offline cache on device — reads/writes work offline, sync when online */
export async function enableFirestoreOffline(): Promise<void> {
  if (persistenceEnabled || typeof window === 'undefined') return;
  try {
    // Legacy API — still works; multi-tab may fall back to memory (safe)
    await enableIndexedDbPersistence(getFirestore());
  } catch {
    // failed-precondition (multi-tab) / unimplemented — memory cache is fine
  }
  persistenceEnabled = true;
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

/** Deterministic Firebase Auth email for staff badge + PIN (same project as email login). */
export function badgeAuthEmail(badgeId: string): string {
  const id = (badgeId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

/** Firebase requires password length >= 6 */
export function normalizeStaffPin(pin: string): string {
  const p = (pin || '').trim();
  if (p.length >= 6) return p;
  return (p + '000000').slice(0, 6);
}

/**
 * Create Firebase Auth for a staff badge without signing the admin out.
 * Uses a secondary Firebase app instance (createUser signs into that app only).
 */
export async function firebaseEnsureBadgeAccount(
  badgeId: string,
  pin: string
): Promise<{ email: string; uid?: string; created: boolean }> {
  const email = badgeAuthEmail(badgeId);
  const password = normalizeStaffPin(pin);
  const secondaryName = `StaffEnrol_${Date.now()}`;
  let secondary: FirebaseApp | undefined;
  try {
    secondary = initializeApp(
      {
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
      },
      secondaryName
    );
    const { getAuth: getAuthSecondary, createUserWithEmailAndPassword: createSecondary, signInWithEmailAndPassword: signInSecondary, signOut: signOutSecondary } = await import('firebase/auth');
    const secAuth = getAuthSecondary(secondary);
    try {
      const cred = await createSecondary(secAuth, email, password);
      await signOutSecondary(secAuth);
      return { email, uid: cred.user.uid, created: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        // Verify PIN matches existing account (on secondary only)
        try {
          const cred = await signInSecondary(secAuth, email, password);
          await signOutSecondary(secAuth);
          return { email, uid: cred.user.uid, created: false };
        } catch {
          throw err;
        }
      }
      throw err;
    }
  } finally {
    if (secondary) {
      try {
        await deleteApp(secondary);
      } catch { /* ignore */ }
    }
  }
}

/** Create email/password user without replacing current admin session */
export async function firebaseEnsureEmailAccount(
  email: string,
  password: string
): Promise<{ email: string; uid?: string; created: boolean }> {
  const passwordNorm = normalizeStaffPin(password);
  const secondaryName = `EmailEnrol_${Date.now()}`;
  let secondary: FirebaseApp | undefined;
  try {
    secondary = initializeApp(
      {
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
      },
      secondaryName
    );
    const {
      getAuth: getAuthSecondary,
      createUserWithEmailAndPassword: createSecondary,
      signInWithEmailAndPassword: signInSecondary,
      signOut: signOutSecondary,
    } = await import('firebase/auth');
    const secAuth = getAuthSecondary(secondary);
    try {
      const cred = await createSecondary(secAuth, email.trim(), passwordNorm);
      await signOutSecondary(secAuth);
      return { email: email.trim(), uid: cred.user.uid, created: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        try {
          const cred = await signInSecondary(secAuth, email.trim(), passwordNorm);
          await signOutSecondary(secAuth);
          return { email: email.trim(), uid: cred.user.uid, created: false };
        } catch {
          throw err;
        }
      }
      throw err;
    }
  } finally {
    if (secondary) {
      try {
        await deleteApp(secondary);
      } catch { /* ignore */ }
    }
  }
}

/** Sign in with badge ID + PIN via Firebase Auth (parity with email/password) */
export async function firebaseSignInWithBadge(
  badgeId: string,
  pin: string
): Promise<User> {
  const email = badgeAuthEmail(badgeId);
  const password = normalizeStaffPin(pin);
  try {
    return await firebaseSignIn(email, password);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    // First login after enrol on another device — try create then sign-in is enrol's job;
    // if account missing, surface clear error
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      throw err;
    }
    throw err;
  }
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

/** Staff directory on the facility shared doc (realtime for all workstations). */
export async function firestorePushStaffDirectory(
  facilityId: string,
  payload: { staffCards?: unknown[]; staffRegistry?: unknown[] }
): Promise<boolean> {
  return firestoreWriteFacility(facilityId, {
    staffCards: payload.staffCards ?? [],
    staffRegistry: payload.staffRegistry ?? [],
    staffUpdatedAt: new Date().toISOString(),
  });
}

export function firestoreSubscribeStaffDirectory(
  facilityId: string,
  onData: (data: { staffCards?: unknown[]; staffRegistry?: unknown[] }) => void
): () => void {
  return firestoreSubscribeFacility(facilityId, (data) => {
    onData({
      staffCards: Array.isArray(data.staffCards) ? data.staffCards : undefined,
      staffRegistry: Array.isArray(data.staffRegistry) ? data.staffRegistry : undefined,
    });
  });
}

/** Per-staff doc: facilities/{facilityId}/staff/{badgeId} */
export function staffMemberRef(facilityId: string, badgeId: string) {
  const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
  const bid = (badgeId || 'UNKNOWN').trim().toUpperCase().replace(/[\/#?]/g, '_');
  return doc(getFirestore(), 'facilities', fid, 'staff', bid);
}

export async function firestoreUpsertStaffMember(
  facilityId: string,
  staff: Record<string, unknown> & { badgeId: string }
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const badgeId = String(staff.badgeId);
    await setDoc(
      staffMemberRef(facilityId, badgeId),
      {
        ...staff,
        badgeId,
        facilityId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn('[Firestore] upsert staff', e);
    return false;
  }
}


export async function firestoreDeleteStaffMember(
  facilityId: string,
  badgeId: string
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const bid = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
    if (!facilityId || !bid) return false;
    await deleteDoc(staffMemberRef(facilityId, bid));
    return true;
  } catch (e) {
    console.warn('[Firestore] delete staff', e);
    return false;
  }
}

export async function firestoreGetStaffByBadge(
  facilityId: string,
  badgeId: string
): Promise<Record<string, unknown> | null> {
  try {
    await enableFirestoreOffline();
    const snap = await getDoc(staffMemberRef(facilityId, badgeId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    console.warn('[Firestore] get staff', e);
    return null;
  }
}

/** Live list of all staff for a facility (realtime enrolment → auth) */
export function firestoreSubscribeStaffCollection(
  facilityId: string,
  onData: (staff: Record<string, unknown>[]) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    try {
      await enableFirestoreOffline();
      const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
      const col = collection(getFirestore(), 'facilities', fid, 'staff');
      unsub = onSnapshot(
        col,
        (snap) => {
          const rows = snap.docs.map((d) => ({ badgeId: d.id, ...d.data() }));
          onData(rows);
        },
        (err) => console.warn('[Firestore] staff collection', err)
      );
    } catch (e) {
      console.warn('[Firestore] staff subscribe', e);
    }
  })();
  return () => unsub();
}

export async function firestoreRecordLogin(
  facilityId: string,
  badgeId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await enableFirestoreOffline();
    await setDoc(
      staffMemberRef(facilityId, badgeId),
      {
        lastLoginAt: new Date().toISOString(),
        lastLoginMeta: meta || {},
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[Firestore] record login', e);
  }
}

export function subscribeFirebaseAuth(cb: (user: User | null) => void): AuthUnsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}
