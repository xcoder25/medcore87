/**
 * Firebase Admin SDK — server only (API routes).
 * Reads FIREBASE_SERVICE_ACCOUNT_JSON (one-line JSON) or FIREBASE_SERVICE_ACCOUNT_BASE64.
 * Falls back to embedded service account when env is unset (pilot / Vercel convenience).
 */
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/** Server-only fallback when env vars are missing (Vercel). Prefer env in production. */
const FALLBACK_SERVICE_ACCOUNT: Record<string, string> = {
  type: 'service_account',
  project_id: 'naija-bites-1s3y1',
  private_key_id: 'c0d0d599f6a7ff1e213ff88c724a6334c577c314',
  private_key:
    '-----BEGIN PRIVATE KEY-----\n' +
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpcImRzS2A/Nv9\n' +
    'cjsg6t0vnYeC9TyXvTt3FRHgGskWQRl/upw5B6mGMG5bPfN8ZDql2LtksKwy/GQ7\n' +
    'r77RIZjujuRowd4tYhsA9dNot10XIG866tN7+9QisyCbOsMjroWkY1ffXFcjMMVG\n' +
    'PRdgj24pfWtL9Q/0+AkrkMzo27TPOhfzaBaz/tEevla7oVD8psGIZ7Kp1HEttjM0\n' +
    'HuZU837bT98MfbsHMXVKeGmAbxKQMyuxIy9i3CMd5TA8NwpKFIC0tf+aUWfz5aUx\n' +
    'XlKryOBIRBN1jtQ7xk4VWrBf0WjRXs3nyoAPT8DSVlLJfmJgMs2MVH5iqV0Kl5ry\n' +
    'ECIXoUtjAgMBAAECggEAA4+3fIaNAcyOzS10+7SkEIelnQWNj/zsvoyFUyoM9vhI\n' +
    'Umx4MySrlgP3ldhgAUnUB79d9PhXrjyq2KxRfPDRV5ZOS7tjcZ3BxovkNSvBe6Z1\n' +
    'YA4mgtEgvNf6A/lAt8PH0FQ8ORgmRrmUM+09zAxHuvyFYFPW0YXTH4TMIcrYapCb\n' +
    'vo4sBususwSy+gTSwRVWaf7V5sUICklX3IUENkcJxsjF/JvqXSa4zNrOH50I6Qsn\n' +
    'srtwcSQBHtH9AjHtNw9vl42kL4d2Y33n9gLU8FyeSRfoqP3VwGDhTIr8BykYZaB5\n' +
    'nAVVWwbk3VQI4OsC0uBiYJPZ6QvfrS9Yg/6qE+kSeQKBgQDh2lfQmBhOii5J/lio\n' +
    '4i8IyQiw64Ah6YnMXTm/3PxkCtuyvzTQY8pAicFQoBUBPzaG6yOINPMv4IvpvuEe\n' +
    'udgaaxh4K86fF/TuNAQyD70OLwxn144V7/S6yZ1FOoxwY6+j09f0TV8ZjESa5UUm\n' +
    'glxP5znbBBJ4gFODzKXzeakACQKBgQDADnxrcl8xm6TFtN13hcaFHS0IsWz4I6wk\n' +
    'VTLiBf8WA+xdG5b53Xaj34u06FBOcca0OCyYTAbSkE7OlhCd+dwycGnR7GSB4BEn\n' +
    'QTk+B6Ogt7TKBW0LkUzBxWo9fnObR4RgWFk/ZtSEqlnJjjLG/dt2IBccAFBS09sk\n' +
    '7aDOhZizCwKBgB0V+WkrrTWwJfXxg4l8V4JSIYRnT8EOSmi/OMi0tOxNWa3TYgHU\n' +
    'WB+nnfW8J/hZI7SMY68O4qKv0FTx+Bv04xfD4wrW2W0zsJ9co42u6TICbR6SbAH3\n' +
    'PRUxEcfwmlV/AQegKJeVv0GTBuLL0/P5pdnEdXb3N0m9fQPkPxrz+AfBAoGBAIRh\n' +
    'N8eD9TOnecLA8SpybizQuHrWeSrsw7njdAgxY+tT1vcyjjU6Po2kB5Mx0jDP4cvV\n' +
    'MH/lX4qB56Aj9d4+HFYz/+yviXOv84LgRUmJUHL2TUo2xTwE8ihaH+m1IJB2kjsq\n' +
    'ipHWGkQ7e1ofhsZ8smnQor0tRjBhURs6I+5WTbOTAoGAXJK6tiTJ/rCYaDgaKNVx\n' +
    'nJr20RWxiqzlvPaeEIajFe9eSfIk+x3NkjopNGqBjnu0hbD41mnli8lUW5EEBG6T\n' +
    '27lA23z242HW4JRZqYdkIIkVGGVxJoq9/N8z8aGSkyMjOFTjBbOkri4q3TJeEKop\n' +
    'KF4LrnRnP9Qnfcp/qjWbrVA=\n' +
    '-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk-fbsvc@naija-bites-1s3y1.iam.gserviceaccount.com',
  client_id: '102339186271339918598',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url:
    'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40naija-bites-1s3y1.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
};

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
  return { ...FALLBACK_SERVICE_ACCOUNT };
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
  // Always true: env OR embedded FALLBACK_SERVICE_ACCOUNT
  return true;
}

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
 * Destructive Admin API routes: prefer ADMIN_API_SECRET when set.
 * If secret env is unset, allow (pilot) but still require ID token on routes.
 */
export function adminApiSecretOk(headerSecret: string | null): boolean {
  const expected = (
    process.env.ADMIN_API_SECRET ||
    process.env.MEDCORE_ADMIN_API_SECRET ||
    ''
  ).trim();
  if (!expected) return true;
  return Boolean(headerSecret && headerSecret === expected);
}
