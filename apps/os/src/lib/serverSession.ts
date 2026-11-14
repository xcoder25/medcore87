/**
 * Cryptographic Server Session & RBAC Token Verification (Edge + Node compatible).
 * Uses Web Crypto API (HMAC-SHA256) to issue and verify HttpOnly session cookies
 * enforcing facilityId tenant isolation and role clearance on the server.
 */

export const SESSION_COOKIE_NAME = 'medcore_session_token';

export interface VerifiedServerSession {
  badgeId: string;
  name: string;
  roleKey: string;
  role: string;
  facilityId: string;
  clearanceLevel: number;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const envSecret =
    (typeof process !== 'undefined' &&
      (process.env.MEDCORE_SESSION_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        process.env.MEDCORE_API_SECRET)) ||
    '';
  return envSecret.trim() || 'medcore-os-aks-hmac-tenant-isolation-key-v1';
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  if (typeof atob === 'function') {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

export async function signSessionToken(
  payload: Omit<VerifiedServerSession, 'iat' | 'exp'>,
  ttlSeconds = 12 * 3600
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: VerifiedServerSession = {
    ...payload,
    facilityId: String(payload.facilityId || 'IGH-EKT').trim().toUpperCase(),
    roleKey: String(payload.roleKey || 'staff').trim().toLowerCase(),
    clearanceLevel: Number(payload.clearanceLevel || 1),
    iat: now,
    exp: now + ttlSeconds,
  };
  const bodyB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(full)));
  const sigB64 = await hmacSha256(bodyB64, getSecret());
  return `${bodyB64}.${sigB64}`;
}

export async function verifySessionToken(token?: string | null): Promise<VerifiedServerSession | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [bodyB64, sigB64] = parts;
  if (!bodyB64 || !sigB64) return null;

  try {
    const expectedSig = await hmacSha256(bodyB64, getSecret());
    if (expectedSig !== sigB64) return null;

    const jsonStr = new TextDecoder().decode(base64UrlDecodeToBytes(bodyB64));
    const parsed = JSON.parse(jsonStr) as VerifiedServerSession;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed || typeof parsed !== 'object' || (parsed.exp && parsed.exp < now)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
