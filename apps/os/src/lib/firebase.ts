/**
 * Firebase Client — Authentication for MedCore OS.
 * Restriced strictly to Firebase Auth (users, tokens, custom claims).
 * All structured persistence is handled by Aurora PostgreSQL, media by AWS S3,
 * and live sync by AWS EventBridge & AppSync.
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

/** Legacy stub: Firestore is decommissioned in favor of Aurora PostgreSQL Serverless v2 */
export function getFirestore(): any {
  return null;
}

export async function enableFirestoreOffline(): Promise<void> {
  // No-op: Data lives in Aurora PostgreSQL & S3
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
    if (known) {
      return mode === 'email' ? 'Incorrect password.' : 'Incorrect PIN.';
    }
    return mode === 'email'
      ? 'This account does not exist. Check the email or ask your administrator to enrol you.'
      : 'This account does not exist. The Staff ID was not found or was removed.';
  }
  if (code === 'auth/wrong-password') {
    return mode === 'email' ? 'Incorrect password.' : 'Incorrect PIN.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
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
  pin: string,
  displayName?: string
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
    const {
      getAuth: getAuthSecondary,
      createUserWithEmailAndPassword: createSecondary,
      updateProfile: updateProfileSecondary,
      signOut: signOutSecondary,
    } = await import('firebase/auth');
    const secAuth = getAuthSecondary(secondary);
    try {
      const cred = await createSecondary(secAuth, email, password);
      if (displayName) {
        try {
          await updateProfileSecondary(cred.user, { displayName });
        } catch {
          /* ignore */
        }
      }
      await signOutSecondary(secAuth);
      return { email, uid: cred.user.uid, created: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        return { email, created: false };
      }
      throw err;
    }
  } finally {
    if (secondary) {
      try {
        await deleteApp(secondary);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Create email/password user without replacing current admin session */
export async function firebaseEnsureEmailAccount(
  email: string,
  password: string,
  displayName?: string
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
      updateProfile: updateProfileSecondary,
      signOut: signOutSecondary,
    } = await import('firebase/auth');
    const secAuth = getAuthSecondary(secondary);
    try {
      const cred = await createSecondary(secAuth, email.trim(), passwordNorm);
      if (displayName) {
        try {
          await updateProfileSecondary(cred.user, { displayName });
        } catch {
          /* ignore */
        }
      }
      await signOutSecondary(secAuth);
      return { email: email.trim(), uid: cred.user.uid, created: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        try {
          await signInSecondary(secAuth, email.trim(), passwordNorm);
          await signOutSecondary(secAuth);
          return { email: email.trim(), created: false };
        } catch {
          return { email: email.trim(), created: false };
        }
      }
      throw err;
    }
  } finally {
    if (secondary) {
      try {
        await deleteApp(secondary);
      } catch {
        /* ignore */
      }
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
  return firebaseSignIn(email, password);
}

/** Deep clone / sanitize object */
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

// ----------------------------------------------------------------------
// Decommissioned Firestore Stubs (Retained for Zero-Downtime Clean Linkage)
// ----------------------------------------------------------------------

export function facilityStoreRef(..._args: any[]): any {
  return {};
}

export async function firestoreWriteFacility(..._args: any[]): Promise<boolean> {
  return true;
}

export async function firestoreReadFacility(..._args: any[]): Promise<Record<string, unknown> | null> {
  return null;
}

export function firestoreSubscribeFacility(
  _facilityId?: any,
  _cb?: (data: any) => void
): () => void {
  return () => {};
}

export async function firestorePushStaffDirectory(..._args: any[]): Promise<boolean> {
  return true;
}

export function firestoreSubscribeStaffDirectory(
  _facilityId?: any,
  _cb?: (data: { staffCards?: any[]; staffRegistry?: any[] }) => void
): () => void {
  return () => {};
}

export function networkTransferRef(..._args: any[]): any {
  return {};
}

export async function firestoreUpsertNetworkTransfer(..._args: any[]): Promise<boolean> {
  return true;
}

export function firestoreSubscribeNetworkTransfers(
  _cb?: (transfers: any[]) => void
): () => void {
  return () => {};
}

export function networkNotificationRef(..._args: any[]): any {
  return {};
}

export async function firestoreUpsertNetworkNotification(..._args: any[]): Promise<boolean> {
  return true;
}

export function firestoreSubscribeNetworkNotifications(
  _facilityId?: any,
  _cb?: (notifications: any[]) => void
): () => void {
  return () => {};
}

export function staffPresenceRef(..._args: any[]): any {
  return {};
}

export async function firestoreUpsertPresence(..._args: any[]): Promise<boolean> {
  return true;
}

export async function firestoreDeletePresence(..._args: any[]): Promise<boolean> {
  return true;
}

export function firestoreSubscribePresence(
  _facilityId?: any,
  _cb?: (presenceMap: any) => void
): () => void {
  return () => {};
}

export function staffMemberRef(..._args: any[]): any {
  return {};
}

export async function firestoreUpsertStaffMember(..._args: any[]): Promise<boolean> {
  return true;
}

export async function firestoreGetStaffByEmail(..._args: any[]): Promise<Record<string, unknown> | null> {
  return null;
}

export async function ensureStaffCloudIdentity(opts: {
  facilityId: string;
  badgeId: string;
  pin: string;
  email?: string;
  displayName?: string;
  profile?: Record<string, unknown>;
}): Promise<{ badgeAuth: boolean; emailAuth: boolean; firestore: boolean }> {
  const pin = normalizeStaffPin(opts.pin);
  let badgeAuth = false;
  let emailAuth = false;
  try {
    const res = await firebaseEnsureBadgeAccount(opts.badgeId, pin, opts.displayName);
    if (res?.email) badgeAuth = true;
  } catch {
    /* ignore */
  }
  if (opts.email && isEmailCredential(opts.email)) {
    try {
      const res = await firebaseEnsureEmailAccount(opts.email, pin, opts.displayName);
      if (res?.email) emailAuth = true;
    } catch {
      /* ignore */
    }
  }
  return { badgeAuth, emailAuth, firestore: true };
}

export async function deleteStaffFirebaseAuth(opts: {
  badgeId: string;
  pin?: string;
  email?: string;
  facilityId?: string;
}): Promise<{ badgeDeleted: boolean; emailDeleted: boolean }> {
  const badge = String(opts.badgeId || '').toUpperCase().replace(/\s+/g, '');
  let badgeDeleted = false;
  let emailDeleted = false;
  if (!badge) return { badgeDeleted, emailDeleted };

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
    const res = await fetch('/api/staff/delete-auth', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        badgeId: badge,
        email: opts.email,
        facilityId: opts.facilityId,
      }),
    });
    if (res.ok) {
      badgeDeleted = true;
      if (opts.email) emailDeleted = true;
    }
  } catch {
    /* ignore */
  }
  return { badgeDeleted, emailDeleted };
}

export async function firestoreRevokeStaff(..._args: any[]): Promise<boolean> {
  return true;
}

export async function isStaffRevoked(..._args: any[]): Promise<boolean> {
  return false;
}

export function firestoreSubscribeRevokedStaff(
  _facilityId?: any,
  _cb?: (revokedBadgeIds: string[]) => void
): () => void {
  return () => {};
}

export async function firestoreDeleteStaffMember(..._args: any[]): Promise<boolean> {
  return true;
}

export async function firestoreGetStaffByBadge(..._args: any[]): Promise<Record<string, unknown> | null> {
  return null;
}

export function firestoreSubscribeStaffCollection(
  _facilityId?: any,
  _cb?: (staffRows: any[]) => void
): () => void {
  return () => {};
}

export async function firestoreClearFacilityAllData(..._args: any[]): Promise<boolean> {
  return true;
}

export async function firestoreRecordLogin(..._args: any[]): Promise<void> {}

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

/**
 * Send an official password reset link to a verified email address via Firebase Auth.
 */
export async function firebaseSendPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sendPasswordResetEmail, getAuth } = await import('firebase/auth');
    const auth = getAuth(getFirebaseApp());
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/user-not-found') {
      return { success: false, error: 'No account registered with this email address.' };
    }
    if (code === 'auth/invalid-email') {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    return { success: false, error: (err as Error)?.message || 'Failed to dispatch password reset email.' };
  }
}
