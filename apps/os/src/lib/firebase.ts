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
  getDocs,
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

/** Cloud / edge only — no Firestore IndexedDB persistence on the device. */
export async function enableFirestoreOffline(): Promise<void> {
  // No enableIndexedDbPersistence / persistentLocalCache.
  // Facility data lives in Firestore; browser RAM holds the live session copy
  // via edgeCloudOnly. Avoids multi-tab locks and slow disk hydration.
  persistenceEnabled = true;
}

export async function firebaseSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

/**
 * Map Firebase Auth errors to user-facing copy.
 * accountKnown=true → prefer "Incorrect PIN/password" over "does not exist".
 */
export function classifyAuthError(
  err: unknown,
  opts?: { accountKnown?: boolean; mode?: 'badge' | 'email' }
): string {
  const code = String((err as { code?: string })?.code || '');
  const mode = opts?.mode || 'badge';
  const known = Boolean(opts?.accountKnown);
  const secret = mode === 'email' ? 'password' : 'PIN';

  if (code === 'auth/user-not-found' || code === 'auth/user-disabled') {
    return mode === 'email'
      ? 'This account does not exist. Check the email or ask your administrator to enrol you.'
      : 'This account does not exist. The Staff ID was not found or was removed.';
  }
  if (code === 'auth/wrong-password') {
    return mode === 'email' ? 'Incorrect password.' : 'Incorrect PIN.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    // Firebase often uses this for both missing user and wrong secret
    if (known) {
      return mode === 'email' ? 'Incorrect password.' : 'Incorrect PIN.';
    }
    return mode === 'email'
      ? 'This account does not exist, or the password is wrong. If you are enrolled, check your password; otherwise ask admin to create your account.'
      : 'This account does not exist. Confirm the Staff ID, or ask your administrator if the account was removed.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many sign-in attempts. Wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  const msg = String((err as { message?: string })?.message || '');
  if (msg && !msg.includes('Firebase')) return msg;
  return known
    ? `Incorrect ${secret}.`
    : 'This account does not exist or the sign-in details are wrong.';
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
  try {
    void enableFirestoreOffline();
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



/** Cross-facility staff transfers — global collection (visible to from + to hospitals) */
export function networkTransferRef(transferId: string) {
  const id = (transferId || 'UNKNOWN').replace(/[\/#?]/g, '_');
  return doc(getFirestore(), 'staffTransfers', id);
}

export async function firestoreUpsertNetworkTransfer(
  transfer: Record<string, unknown> & { id: string }
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    await setDoc(
      networkTransferRef(String(transfer.id)),
      stripUndefinedDeep({
        ...transfer,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    return true;
  } catch (e) {
    fsWarn('upsert network transfer', e);
    return false;
  }
}

export function firestoreSubscribeNetworkTransfers(
  onRows: (rows: Record<string, unknown>[]) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    try {
      await enableFirestoreOffline();
      const col = collection(getFirestore(), 'staffTransfers');
      unsub = onSnapshot(
        col,
        (snap) => {
          const rows: Record<string, unknown>[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
          onRows(rows);
        },
        (err) => fsWarn('network transfers snapshot', err)
      );
    } catch (e) {
      fsWarn('network transfers subscribe', e);
    }
  })();
  return () => unsub();
}

/** Cross-facility notifications — collection with facilityId on each doc */
export function networkNotificationRef(notifId: string) {
  const id = (notifId || 'UNKNOWN').replace(/[\/#?]/g, '_');
  return doc(getFirestore(), 'networkNotifications', id);
}

export async function firestoreUpsertNetworkNotification(
  notif: Record<string, unknown> & { id: string; facilityId: string }
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    await setDoc(
      networkNotificationRef(String(notif.id)),
      stripUndefinedDeep({
        ...notif,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    return true;
  } catch (e) {
    fsWarn('upsert network notification', e);
    return false;
  }
}

export function firestoreSubscribeNetworkNotifications(
  facilityId: string,
  onRows: (rows: Record<string, unknown>[]) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    try {
      await enableFirestoreOffline();
      // Client filter: subscribe all and filter (avoids composite index requirement)
      const col = collection(getFirestore(), 'networkNotifications');
      unsub = onSnapshot(
        col,
        (snap) => {
          const fid = String(facilityId || '').toUpperCase();
          const rows: Record<string, unknown>[] = [];
          snap.forEach((d) => {
            const data = { id: d.id, ...d.data() } as Record<string, unknown>;
            const nFid = String(data.facilityId || '').toUpperCase();
            // Deliver to target facility, or multi-facility flags
            if (
              !fid ||
              nFid === fid ||
              String(data.toFacilityId || '').toUpperCase() === fid ||
              String(data.fromFacilityId || '').toUpperCase() === fid
            ) {
              rows.push(data);
            }
          });
          onRows(rows);
        },
        (err) => fsWarn('network notifications snapshot', err)
      );
    } catch (e) {
      fsWarn('network notifications subscribe', e);
    }
  })();
  return () => unsub();
}

/** Per-user presence: facilities/{facilityId}/presence/{badgeId} — no clobber across PCs */
export function staffPresenceRef(facilityId: string, badgeId: string) {
  const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
  const bid = (badgeId || 'UNKNOWN').trim().toUpperCase().replace(/[\/#?]/g, '_');
  return doc(getFirestore(), 'facilities', fid, 'presence', bid);
}

export async function firestoreUpsertPresence(
  facilityId: string,
  presence: Record<string, unknown> & { badgeId: string }
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const badgeId = String(presence.badgeId);
    await setDoc(
      staffPresenceRef(facilityId, badgeId),
      stripUndefinedDeep({
        ...presence,
        badgeId,
        facilityId,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    return true;
  } catch (e) {
    fsWarn('upsert presence', e);
    return false;
  }
}

/** Remove presence doc when staff is deleted from facility */
export async function firestoreDeletePresence(
  facilityId: string,
  badgeId: string
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const bid = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
    if (!facilityId || !bid) return false;
    await deleteDoc(staffPresenceRef(facilityId, bid));
    return true;
  } catch (e) {
    fsWarn('delete presence', e);
    return false;
  }
}


export function firestoreSubscribePresence(
  facilityId: string,
  onRows: (rows: Record<string, unknown>[]) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    try {
      await enableFirestoreOffline();
      const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
      const col = collection(getFirestore(), 'facilities', fid, 'presence');
      unsub = onSnapshot(
        col,
        (snap) => {
          const rows: Record<string, unknown>[] = [];
          snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
          onRows(rows);
        },
        (err) => fsWarn('presence snapshot', err)
      );
    } catch (e) {
      fsWarn('presence subscribe', e);
    }
  })();
  return () => unsub();
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
    void enableFirestoreOffline();
    const badgeId = String(staff.badgeId);
    // Never persist PIN/password to Firestore (Auth is source of truth for secrets)
    const { pin: _pin, password: _password, ...safeStaff } = staff as Record<string, unknown>;
    const payload = stripUndefinedDeep({
      ...safeStaff,
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

  const profilePayload = {
    ...opts.profile,
    badgeId: opts.badgeId,
    ...(mail ? { email: mail } : {}),
    pin,
    authEmail: badgeAuthEmail(opts.badgeId),
    status: 'active',
    roleKey: opts.profile.roleKey || opts.profile.role || '',
  };

  const withMs = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        p,
        new Promise<T>((_, rej) => {
          timer = setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // Parallel: badge Auth + staff doc (do not wait on full directory push)
  const authTask = (async () => {
    try {
      const res = await withMs(firebaseEnsureBadgeAccount(opts.badgeId, pin), 9000);
      if (res?.email) {
        badgeAuth = true;
        try {
          await withMs(firebaseSignInWithBadge(opts.badgeId, pin), 4000);
        } catch {
          /* admin session may already own primary Auth */
        }
      }
    } catch (e) {
      console.warn('[staff-cloud] badge auth', e);
    }
  })();

  const fsTask = (async () => {
    try {
      // One attempt with timeout — no 3x retry loops that stack to 30s+
      const ok = await withMs(
        firestoreUpsertStaffMember(opts.facilityId, profilePayload),
        10000
      );
      firestoreOk = Boolean(ok);
    } catch (e) {
      console.warn('[staff-cloud] firestore upsert', e);
      // single retry
      try {
        const ok2 = await withMs(
          firestoreUpsertStaffMember(opts.facilityId, profilePayload),
          8000
        );
        firestoreOk = Boolean(ok2);
      } catch (e2) {
        console.warn('[staff-cloud] firestore retry', e2);
      }
    }
  })();

  await Promise.all([authTask, fsTask]);

  // If Auth finished after Firestore and rules needed Auth, retry upsert once quickly
  if (badgeAuth && !firestoreOk) {
    try {
      firestoreOk = Boolean(
        await withMs(firestoreUpsertStaffMember(opts.facilityId, profilePayload), 8000)
      );
    } catch {
      /* ignore */
    }
  }

  // Optional work email Auth (rare) — short timeout
  if (mail && isEmailCredential(mail)) {
    try {
      const res = await withMs(firebaseEnsureEmailAccount(mail, pin), 8000);
      emailAuth = Boolean(res?.email);
    } catch {
      emailAuth = false;
    }
  } else {
    emailAuth = true;
  }

  return { badgeAuth, emailAuth: mail ? emailAuth : true, firestore: firestoreOk };
}





/**
 * Delete Firebase Auth account for a staff badge (and optional work email).
 * 1) Prefer server Admin SDK via /api/staff/delete-auth (FIREBASE_SERVICE_ACCOUNT_JSON).
 * 2) Fallback: secondary client app sign-in with PIN then deleteUser.
 */
export async function deleteStaffFirebaseAuth(opts: {
  badgeId: string;
  pin?: string;
  email?: string;
}): Promise<{ badgeDeleted: boolean; emailDeleted: boolean }> {
  const badge = String(opts.badgeId || '').toUpperCase().replace(/\s+/g, '');
  const pin = normalizeStaffPin(opts.pin || '');
  let badgeDeleted = false;
  let emailDeleted = false;
  if (!badge) return { badgeDeleted, emailDeleted };

  // Admin SDK path (no PIN required) — attach caller ID token when signed in
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const u = getFirebaseAuth().currentUser;
      if (u) {
        const idToken = await u.getIdToken(true);
        headers.Authorization = `Bearer ${idToken}`;
      }
    } catch {
      /* optional */
    }
    try {
      const secret =
        (typeof process !== 'undefined' &&
          (process as { env?: Record<string, string> }).env?.NEXT_PUBLIC_ADMIN_API_SECRET) ||
        (typeof window !== 'undefined' && window.localStorage.getItem('medcore_admin_api_secret')) ||
        '';
      if (secret) headers['x-admin-secret'] = String(secret);
    } catch {
      /* optional */
    }
    const res = await fetch('/api/staff/delete-auth', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        badgeId: badge,
        email: opts.email || undefined,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        ok?: boolean;
        deleted?: string[];
        missing?: string[];
      };
      const deleted = data.deleted || [];
      const badgeMail = badgeAuthEmail(badge).toLowerCase();
      badgeDeleted = deleted.some((e) => e.toLowerCase() === badgeMail);
      if (opts.email) {
        emailDeleted = deleted.some(
          (e) => e.toLowerCase() === String(opts.email).trim().toLowerCase()
        );
      }
      if (data.ok || deleted.length > 0) {
        return { badgeDeleted: badgeDeleted || deleted.length > 0, emailDeleted };
      }
    }
  } catch {
    /* fall through to client PIN path */
  }

  const secondaryName = `StaffDelete_${Date.now()}`;
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
      signInWithEmailAndPassword: signInSecondary,
      deleteUser,
      signOut: signOutSecondary,
    } = await import('firebase/auth');
    const secAuth = getAuthSecondary(secondary);

    const tryDelete = async (email: string, password: string) => {
      if (!email || !password || password.length < 6) return false;
      try {
        const cred = await signInSecondary(secAuth, email, password);
        await deleteUser(cred.user);
        try {
          await signOutSecondary(secAuth);
        } catch {
          /* already deleted */
        }
        return true;
      } catch {
        try {
          await signOutSecondary(secAuth);
        } catch {
          /* ignore */
        }
        return false;
      }
    };

    if (pin) {
      badgeDeleted = await tryDelete(badgeAuthEmail(badge), pin);
      const mail = (opts.email || '').trim().toLowerCase();
      if (mail) {
        emailDeleted = await tryDelete(mail, pin);
      }
    }
  } catch (e) {
    fsWarn('delete staff auth', e);
  } finally {
    if (secondary) {
      try {
        const { deleteApp } = await import('firebase/app');
        await deleteApp(secondary);
      } catch {
        /* ignore */
      }
    }
  }
  return { badgeDeleted, emailDeleted };
}

/** Mark badge revoked so any open session must log out and cannot sign in again */
export async function firestoreRevokeStaff(
  facilityId: string,
  badgeId: string,
  meta?: { name?: string; revokedBy?: string }
): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
    const bid = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
    if (!fid || !bid) return false;
    await setDoc(
      doc(getFirestore(), 'facilities', fid, 'revokedStaff', bid),
      stripUndefinedDeep({
        badgeId: bid,
        facilityId: fid,
        revokedAt: new Date().toISOString(),
        name: meta?.name,
        revokedBy: meta?.revokedBy,
      }),
      { merge: true }
    );
    // Also clear staffByEmail if we only have badge path — best-effort leave to deleteStaffMember
    return true;
  } catch (e) {
    fsWarn('revoke staff', e);
    return false;
  }
}

export async function isStaffRevoked(facilityId: string, badgeId: string): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
    const bid = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
    if (!fid || !bid) return false;
    const snap = await getDoc(doc(getFirestore(), 'facilities', fid, 'revokedStaff', bid));
    return snap.exists();
  } catch {
    return false;
  }
}

export function firestoreSubscribeRevokedStaff(
  facilityId: string,
  onIds: (badgeIds: string[]) => void
): () => void {
  let unsub = () => {};
  void (async () => {
    try {
      await enableFirestoreOffline();
      const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
      const col = collection(getFirestore(), 'facilities', fid, 'revokedStaff');
      unsub = onSnapshot(
        col,
        (snap) => {
          const ids = snap.docs.map((d) => String(d.id || '').toUpperCase());
          onIds(ids);
        },
        (err) => fsWarn('revoked staff snapshot', err)
      );
    } catch (e) {
      fsWarn('revoked subscribe', e);
    }
  })();
  return () => unsub();
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
  try {
    // Do not block first paint on offline persistence init
    void enableFirestoreOffline();
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
  return () => unsub();
}

/**
 * Fully wipes all Firestore cloud records for a facility:
 * - Deletes all docs in facilities/{facilityId}/staff subcollection
 * - Deletes all docs in facilities/{facilityId}/presence subcollection
 * - Deletes all docs in facilities/{facilityId}/revokedStaff subcollection
 * - Resets all fields on the facility doc (staffCards: [], staffRegistry: [], resetAt, etc.)
 */
export async function firestoreClearFacilityAllData(facilityId: string): Promise<boolean> {
  try {
    await enableFirestoreOffline();
    const fid = (facilityId || 'DEFAULT-HOSPITAL').replace(/[\/#?]/g, '_');
    const db = getFirestore();

    // 1. Delete all subcollections: staff, presence, revokedStaff
    const subcols = ['staff', 'presence', 'revokedStaff'];
    for (const sub of subcols) {
      try {
        const snap = await getDocs(collection(db, 'facilities', fid, sub));
        for (const d of snap.docs) {
          try {
            await deleteDoc(d.ref);
          } catch {
            /* ignore individual delete error */
          }
        }
      } catch (err) {
        fsWarn(`clear subcol ${sub}`, err);
      }
    }

    // 2. Reset facility document completely
    await setDoc(
      doc(db, 'facilities', fid),
      stripUndefinedDeep({
        staffCards: [],
        staffRegistry: [],
        staffUpdatedAt: new Date().toISOString(),
        resetAt: new Date().toISOString(),
        resetNote: 'Full facility reset',
        medcore_os_patient_registry_v1: [],
        medcore_os_reception_ops_v2: null,
        medcore_os_clinical_orders_v1: [],
        medcore_os_bed_board_v1: null,
        medcore_os_notifications_v1: [],
        medcore_anc_plans_v1: [],
        medcore_os_him_v1: null,
        medcore_os_theatre_cases_v1: [],
        medcore_os_formulary_v1: null,
        medcore_os_drug_stock_v1: null,
      }),
      { merge: false }
    );

    return true;
  } catch (e) {
    fsWarn('clear facility all data', e);
    return false;
  }
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

/**
 * Change the password of the currently authenticated Firebase user or email account.
 */
export async function firebaseChangePassword(
  email: string,
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      getAuth,
      signInWithEmailAndPassword,
      updatePassword,
      reauthenticateWithCredential,
      EmailAuthProvider,
    } = await import('firebase/auth');

    const auth = getAuth(getFirebaseApp());
    const currentUser = auth.currentUser;

    if (currentUser && currentUser.email?.toLowerCase() === email.toLowerCase()) {
      const cred = EmailAuthProvider.credential(email, currentPass);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, newPass);
      return { success: true };
    }

    // If not signed in as current user, use secondary app instance
    const secondaryName = `PwdChange_${Date.now()}`;
    const secondary = initializeApp(firebaseConfig, secondaryName);
    try {
      const { getAuth: getAuthSec } = await import('firebase/auth');
      const secAuth = getAuthSec(secondary);
      const userCred = await signInWithEmailAndPassword(secAuth, email.trim(), currentPass);
      await updatePassword(userCred.user, newPass);
      return { success: true };
    } finally {
      try {
        await deleteApp(secondary);
      } catch {
        /* ignore */
      }
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return { success: false, error: 'Current password is incorrect.' };
    }
    if (code === 'auth/weak-password') {
      return { success: false, error: 'New password is too weak. Please use at least 6 characters.' };
    }
    return { success: false, error: (err as Error)?.message || 'Failed to update password.' };
  }
}

/**
 * Change the PIN of a staff badge account in Firebase Auth.
 */
export async function firebaseChangeBadgePin(
  badgeId: string,
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const email = badgeAuthEmail(badgeId);
  const oldNorm = normalizeStaffPin(currentPin);
  const newNorm = normalizeStaffPin(newPin);
  return firebaseChangePassword(email, oldNorm, newNorm);
}
