/**
 * Firebase Admin SDK — server only (API routes).
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64.
 * No embedded private keys in source.
 */
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function loadServiceAccount(): Record<string, string> | null {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, string>;
      if (parsed.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e) {
      console.error('[firebaseAdmin] Invalid FIREBASE_SERVICE_ACCOUNT_JSON', e);
      return null;
    }
  }
  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (b64) {
    try {
      const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<
        string,
        string
      >;
      if (parsed.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e) {
      console.error('[firebaseAdmin] Invalid FIREBASE_SERVICE_ACCOUNT_BASE64', e);
      return null;
    }
  }
  return null;
}

let adminApp: App | null = null;

export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length) {
    adminApp = existing[0]!;
    return adminApp;
  }
  const sa = loadServiceAccount();
  if (!sa?.client_email || !sa?.private_key) {
    return null;
  }
  adminApp = initializeApp({
    credential: cert({
      projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'naija-bites-1s3y1',
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'naija-bites-1s3y1',
  });
  return adminApp;
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
      (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()
  );
}

/**
 * Delete Auth users by email (badge synthetic + work email).
 */
export async function adminDeleteAuthUsersByEmail(emails: string[]): Promise<{
  deleted: string[];
  missing: string[];
  errors: string[];
}> {
  const deleted: string[] = [];
  const missing: string[] = [];
  const errors: string[] = [];
  const app = getFirebaseAdminApp();
  if (!app) {
    errors.push('Admin SDK not configured');
    return { deleted, missing, errors };
  }
  const auth = getAuth(app);
  for (const email of emails) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) continue;
    try {
      const user = await auth.getUserByEmail(e);
      await auth.deleteUser(user.uid);
      deleted.push(e);
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || '');
      if (code.includes('user-not-found')) missing.push(e);
      else errors.push(`${e}: ${(err as Error)?.message || 'delete failed'}`);
    }
  }
  return { deleted, missing, errors };
}

export async function adminListAllAuthUsers(max = 500): Promise<{
  users: Array<{ uid: string; email?: string; disabled?: boolean }>;
  errors: string[];
}> {
  const users: Array<{ uid: string; email?: string; disabled?: boolean }> = [];
  const errors: string[] = [];
  const app = getFirebaseAdminApp();
  if (!app) {
    errors.push('Admin SDK not configured');
    return { users, errors };
  }
  const auth = getAuth(app);
  let pageToken: string | undefined;
  try {
    do {
      const page = await auth.listUsers(Math.min(1000, max - users.length), pageToken);
      for (const u of page.users) {
        users.push({ uid: u.uid, email: u.email, disabled: u.disabled });
        if (users.length >= max) break;
      }
      pageToken = page.pageToken;
    } while (pageToken && users.length < max);
  } catch (e) {
    errors.push((e as Error)?.message || 'list failed');
  }
  return { users, errors };
}

export async function adminDeleteAllAuthUsers(): Promise<{
  deleted: number;
  uids: string[];
  errors: string[];
}> {
  const app = getFirebaseAdminApp();
  const uids: string[] = [];
  const errors: string[] = [];
  let deleted = 0;
  if (!app) {
    errors.push('Admin SDK not configured');
    return { deleted, uids, errors };
  }
  const auth = getAuth(app);
  let pageToken: string | undefined;
  try {
    do {
      const page = await auth.listUsers(1000, pageToken);
      const batch = page.users.map((u) => u.uid);
      pageToken = page.pageToken;
      if (batch.length === 0) break;
      for (let i = 0; i < batch.length; i += 1000) {
        const chunk = batch.slice(i, i + 1000);
        const result = await auth.deleteUsers(chunk);
        deleted += result.successCount;
        uids.push(...chunk);
        if (result.failureCount > 0) {
          for (const err of result.errors || []) {
            errors.push(`${err.index}: ${err.error?.message || 'delete failed'}`);
          }
        }
      }
    } while (pageToken);
  } catch (e) {
    errors.push((e as Error)?.message || 'deleteAll failed');
  }
  return { deleted, uids, errors };
}

export async function adminVerifyIdToken(
  idToken: string
): Promise<{ uid: string; email?: string } | null> {
  const app = getFirebaseAdminApp();
  if (!app || !idToken) return null;
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Destructive Admin API routes require BOTH:
 * - ADMIN_API_SECRET (or MEDCORE_ADMIN_API_SECRET) header match
 * - Valid Firebase ID token (caller identity)
 * If secret env is unset, all destructive calls are denied.
 */
export function adminApiSecretOk(headerSecret: string | null): boolean {
  const expected = (
    process.env.ADMIN_API_SECRET ||
    process.env.MEDCORE_ADMIN_API_SECRET ||
    ''
  ).trim();
  if (!expected) return false;
  return Boolean(headerSecret && headerSecret === expected);
}
