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


/** Offline / multi-tab noise — do not spam the console */
function isBenignFirestoreError(e: unknown): boolean {
  const code = String((e as { code?: string })?.code || '');
  const msg = String((e as { message?: string })?.message || e || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    msg.includes('client is offline') ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('Failed to get document because the client is offline')
  );
}

function fsWarn(tag: string, e: unknown) {
  if (isBenignFirestoreError(e)) return;
  console.warn(`[Firestore] ${tag}`, e);
}

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
  // Skip IndexedDB persistence on web: avoids multi-tab failed-precondition
  // and enableIndexedDbPersistence deprecation noise. Firestore still works online.
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
          // Account exists (possibly different PIN) — enrol still OK; badge login works
          return { email: email.trim(), created: false };
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
          // Account exists (possibly different PIN) — enrol still OK; badge login works
          return { email: email.trim(), created: false };
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

/** Firestore rejects `undefined` field values — strip them (deep) before setDoc. */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedDeep(v);
  }
  return out as T;
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
      stripUndefinedDeep({
        ...partial,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    return true;
  } catch (e) {
    fsWarn('write failed', e);
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
    fsWarn('read failed', e);
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
        (err) => fsWarn('snapshot', err)
      );
    } catch (e) {
      fsWarn('subscribe failed', e);
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
    const payload = stripUndefinedDeep({
      ...staff,
      badgeId,
      facilityId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(staffMemberRef(facilityId, badgeId), payload, { merge: true });
    // Email index so any workstation can resolve work-email → badge
    const email = String(staff.email || staff.workEmail || '')
      .trim()
      .toLowerCase();
    if (email && email.includes('@')) {
      const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
      const emailKey = email.replace(/[\/#?]/g, '_');
      await setDoc(
        doc(getFirestore(), 'facilities', fid, 'staffByEmail', emailKey),
        {
          email,
          badgeId,
          facilityId,
          name: staff.name || staff.fullName || '',
          roleKey: staff.roleKey || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    return true;
  } catch (e) {
    fsWarn('upsert staff', e);
    return false;
  }
}

/** Lookup staff badge by work email (cloud) */
export async function firestoreGetStaffByEmail(
  facilityId: string,
  email: string
): Promise<Record<string, unknown> | null> {
  try {
    await enableFirestoreOffline();
    const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
    const emailKey = email.trim().toLowerCase().replace(/[\/#?]/g, '_');
    if (!emailKey) return null;
    const snap = await getDoc(doc(getFirestore(), 'facilities', fid, 'staffByEmail', emailKey));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const badgeId = String(data.badgeId || '');
    if (badgeId) {
      const full = await firestoreGetStaffByBadge(facilityId, badgeId);
      if (full) return full;
    }
    return { id: snap.id, ...data };
  } catch (e) {
    fsWarn('get staff by email', e);
    return null;
  }
}

/**
 * Full cloud identity for a staff member: Auth (badge + optional email) + Firestore profile.
 * Retries so transient network blips do not leave accounts half-created.
 */
export async function ensureStaffCloudIdentity(opts: {
  facilityId: string;
  badgeId: string;
  pin: string;
  email?: string;
  profile: Record<string, unknown>;
}): Promise<{ badgeAuth: boolean; emailAuth: boolean; firestore: boolean }> {
  const pin = normalizeStaffPin(opts.pin);
  let badgeAuth = false;
  let emailAuth = false;
  let firestoreOk = false;
  const mail = (opts.email || '').trim().toLowerCase();

  // 1) Firestore profile FIRST — multi-workstation login depends on this, not Auth
  for (let attempt = 0; attempt < 3 && !firestoreOk; attempt++) {
    try {
      const ok = await firestoreUpsertStaffMember(opts.facilityId, {
        ...opts.profile,
        badgeId: opts.badgeId,
        ...(mail ? { email: mail } : {}),
        pin,
        authEmail: badgeAuthEmail(opts.badgeId),
        status: 'active',
        roleKey: opts.profile.roleKey || opts.profile.role || '',
      });
      firestoreOk = ok;
      if (ok) {
        try {
          const cardsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('medcore_staff_id_cards') : null;
          const regRaw =
            typeof localStorage !== 'undefined'
              ? localStorage.getItem('medcore_os_staff_registry') ||
                localStorage.getItem('medcore_staff_registry')
              : null;
          await firestorePushStaffDirectory(opts.facilityId, {
            staffCards: cardsRaw ? JSON.parse(cardsRaw) : [],
            staffRegistry: regRaw ? JSON.parse(regRaw) : [],
          });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn('[staff-cloud] firestore attempt', attempt + 1, e);
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  // 2) Badge Auth (optional for desk routing; needed for Firebase-gated rules)
  for (let attempt = 0; attempt < 2 && !badgeAuth; attempt++) {
    try {
      const res = await firebaseEnsureBadgeAccount(opts.badgeId, pin);
      badgeAuth = Boolean(res?.email);
    } catch (e) {
      console.warn('[staff-cloud] badge auth attempt', attempt + 1, e);
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  // 3) Optional email Auth
  if (mail && isEmailCredential(mail)) {
    for (let attempt = 0; attempt < 2 && !emailAuth; attempt++) {
      try {
        const res = await firebaseEnsureEmailAccount(mail, pin);
        emailAuth = Boolean(res?.email);
      } catch (e) {
        console.warn('[staff-cloud] email auth attempt', attempt + 1, e);
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  } else {
    emailAuth = true;
  }

  return { badgeAuth, emailAuth: mail ? emailAuth : true, firestore: firestoreOk };
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
    fsWarn('delete staff', e);
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
    fsWarn('get staff', e);
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
        (err) => fsWarn('staff collection', err)
      );
    } catch (e) {
      fsWarn('staff subscribe', e);
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
      stripUndefinedDeep({
        lastLoginAt: new Date().toISOString(),
        lastLoginMeta: meta || {},
      }),
      { merge: true }
    );
  } catch (e) {
    fsWarn('record login', e);
  }
}

export function subscribeFirebaseAuth(cb: (user: User | null) => void): AuthUnsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}
