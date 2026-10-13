/**
 * Firebase Admin SDK — server only (API routes).
 * Reads FIREBASE_SERVICE_ACCOUNT_JSON (one-line JSON) or FIREBASE_SERVICE_ACCOUNT_BASE64.
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
    console.warn(
      '[firebaseAdmin] No service account. Set FIREBASE_SERVICE_ACCOUNT_JSON on the server.'
    );
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
 * Does not need the staff PIN — Admin privilege.
 */
export async function adminDeleteAuthUsers(emails: string[]): Promise<{
  deleted: string[];
  missing: string[];
  errors: string[];
}> {
  const app = getFirebaseAdminApp();
  const deleted: string[] = [];
  const missing: string[] = [];
  const errors: string[] = [];
  if (!app) {
    errors.push('Admin SDK not configured');
    return { deleted, missing, errors };
  }
  const auth = getAuth(app);
  const unique = [
    ...new Set(
      emails
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.includes('@'))
    ),
  ];
  for (const email of unique) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      deleted.push(email);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        missing.push(email);
      } else {
        errors.push(`${email}: ${(e as Error)?.message || code || 'error'}`);
      }
    }
  }
  return { deleted, missing, errors };
}

/**
 * List all Firebase Auth users (paginated).
 */
export async function adminListAllAuthUsers(max = 1000): Promise<{
  users: Array<{ uid: string; email?: string; displayName?: string; disabled: boolean }>;
  errors: string[];
}> {
  const app = getFirebaseAdminApp();
  const users: Array<{ uid: string; email?: string; displayName?: string; disabled: boolean }> = [];
  const errors: string[] = [];
  if (!app) {
    errors.push('Admin SDK not configured');
    return { users, errors };
  }
  const auth = getAuth(app);
  let pageToken: string | undefined;
  try {
    do {
      const page = await auth.listUsers(1000, pageToken);
      for (const u of page.users) {
        users.push({
          uid: u.uid,
          email: u.email || undefined,
          displayName: u.displayName || undefined,
          disabled: !!u.disabled,
        });
        if (users.length >= max) return { users, errors };
      }
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (e) {
    errors.push((e as Error)?.message || 'listUsers failed');
  }
  return { users, errors };
}

/**
 * Delete every Firebase Auth user in the project (dangerous).
 * Uses deleteUsers in batches of 1000.
 */
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
      // deleteUsers supports up to 1000
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

/**
 * Verify a client Firebase ID token. Returns decoded claims or null.
 */
export async function adminVerifyIdToken(idToken: string): Promise<{
  uid: string;
  email?: string;
} | null> {
  const app = getFirebaseAdminApp();
  if (!app || !idToken) return null;
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Authorize destructive admin API: valid ID token AND (optional) shared secret.
 * Set ADMIN_API_SECRET on Vercel; clients send x-admin-secret header.
 */
export function adminApiSecretOk(headerSecret: string | null): boolean {
  const expected = (process.env.ADMIN_API_SECRET || process.env.MEDCORE_ADMIN_API_SECRET || '').trim();
  if (!expected) {
    // If no secret configured, rely on ID token only (still required by routes)
    return true;
  }
  return Boolean(headerSecret && headerSecret === expected);
}
