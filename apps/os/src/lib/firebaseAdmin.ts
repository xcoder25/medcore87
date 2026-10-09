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
