import crypto from 'crypto';
import { EncryptedPayload } from '@medcore/types';
import { getJwtKeyPair, getPublicJwks } from './jwtKeys';
export { EncryptedPayload, getPublicJwks };

// ─── AES-256-GCM Master Key ───────────────────────────────────────────────────
// Derived from a secure environment seed. In production, set MEDCORE_ENCRYPTION_MASTER_KEY
// to a cryptographically random 256-bit (32-byte) base64 or hex string.
const SYSTEM_KEY_SEED = process.env.MEDCORE_ENCRYPTION_MASTER_KEY || 'medcore-m87-enterprise-security-2026-master-key-seed-009';
const MASTER_KEY = crypto.createHash('sha256').update(SYSTEM_KEY_SEED).digest();

// ─── HMAC-SHA256 Key for Audit Block Signatures ──────────────────────────────
// This is separate from JWT signing — used exclusively for the audit ledger chain.
const AUDIT_HMAC_SECRET = process.env.MEDCORE_AUDIT_HMAC_SECRET || 'medcore-audit-hmac-secret-secure-ledger-2026-m87';

/**
 * AES-256-GCM Field-Level Authenticated Encryption
 * Encrypts sensitive PHI/PII fields at rest with a random 12-byte IV and 16-byte authentication tag.
 */
export function encryptField(plaintext: string, customKey?: Buffer): EncryptedPayload {
  const key = customKey || MASTER_KEY;
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    tag,
    ciphertext: encrypted,
    keyVersion: 'v1-2026',
    algorithm: 'AES-256-GCM',
  };
}

/**
 * AES-256-GCM Field-Level Authenticated Decryption
 * Verifies the authentication tag before returning plaintext. Throws if tampered.
 */
export function decryptField(payload: EncryptedPayload, customKey?: Buffer): string {
  const key = customKey || MASTER_KEY;
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(tag);
  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Cryptographic SHA-256 Hash Chaining for Tamper-Evident Audit Blocks
 */
export function computeBlockHash(
  blockNumber: number,
  timestamp: string,
  actorId: string,
  action: string,
  resourceId: string,
  previousHash: string,
  metadata?: Record<string, unknown>
): string {
  const payload = JSON.stringify({
    blockNumber,
    timestamp,
    actorId,
    action,
    resourceId,
    previousHash,
    metadata: metadata || {},
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Signs an audit block hash with HMAC-SHA256.
 * The audit ledger uses a separate HMAC key (not the JWT RSA private key) so
 * that signing is deterministic and the ledger can be batch-verified offline
 * without the RSA private key.
 */
export function signAuditRecord(hash: string): string {
  return crypto.createHmac('sha256', AUDIT_HMAC_SECRET).update(hash).digest('hex');
}

/**
 * Verifies an audit block signature using timing-safe comparison.
 */
export function verifyAuditSignature(hash: string, signature: string): boolean {
  const expected = signAuditRecord(hash);
  // Both strings are 64 hex chars (HMAC-SHA256) — same length, safe to compare
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

/**
 * Masking utilities for Safe Harbor / De-identification
 */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0][0] + '***';
  return `${parts[0][0]}*** ${parts[parts.length - 1][0]}***`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***-***';
  return phone.slice(0, 3) + '***' + phone.slice(-4);
}

export function maskMRN(mrn: string): string {
  return mrn.slice(0, 4) + '****' + mrn.slice(-2);
}

/**
 * Built-in Scoped JWT Token Issuer and Verifier
 */
// ─── RS256 JWT — RFC 7518 §3.3 ───────────────────────────────────────────────
//
// Algorithm : RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
// Key size  : RSA-2048 minimum (RSA-4096 for classified data)
// Key source: getJwtKeyPair() → env vars → PEM files → ephemeral (dev only)
//
// The JWT header includes a `kid` (Key ID) that matches the JWKS endpoint so
// client-side verifiers can select the correct public key during key rotation.

export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: string;
  facilityId: string;
  scopes: string[];
  /** Issued-at (seconds since epoch) */
  iat: number;
  /** Expiry (seconds since epoch) */
  exp: number;
}

/**
 * Issues a cryptographically signed RS256 JWT.
 *
 * @param user       - Principal identity and access scopes
 * @param expiresInSeconds - Token TTL (default 24 h; use shorter for sensitive ops)
 * @returns Compact serialized JWT: base64url(header).base64url(payload).base64url(sig)
 */
export function createToken(
  user: { id: string; name: string; email: string; role: string; facilityId: string; scopes: string[] },
  expiresInSeconds = 3600 * 24
): string {
  const { privateKey, kid } = getJwtKeyPair();

  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    facilityId: user.facilityId,
    scopes: user.scopes,
    iat: now,
    exp: now + expiresInSeconds,
  };

  // RFC 7515 §3 — header MUST include alg; kid enables JWKS key rotation
  const header = Buffer
    .from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))
    .toString('base64url');
  const body = Buffer
    .from(JSON.stringify(payload))
    .toString('base64url');

  const signingInput = `${header}.${body}`;

  // RS256 = RSASSA-PKCS1-v1_5 with SHA-256 (RFC 7518 §3.3)
  const signature = crypto
    .sign('SHA256', Buffer.from(signingInput), privateKey)
    .toString('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Verifies an RS256 JWT and returns its payload, or null if invalid / expired.
 *
 * Verification steps:
 *   1. Structural check — exactly 3 segments
 *   2. Algorithm guard — header `alg` MUST be `RS256` (prevents alg-confusion attack)
 *   3. RSA signature verification against the current public key
 *   4. Expiry check
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [rawHeader, body, signature] = parts;

    // 1. Decode and validate header claims
    const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8')) as {
      alg?: string; typ?: string; kid?: string;
    };

    // 2. Algorithm confusion guard — reject anything that is not RS256
    if (header.alg !== 'RS256') {
      console.warn(`[verifyToken] Rejected token with unexpected alg: ${header.alg}`);
      return null;
    }

    // 3. RSA-PKCS1v15-SHA256 signature verification
    const { publicKey } = getJwtKeyPair();
    const signingInput = `${rawHeader}.${body}`;
    const isValid = crypto.verify(
      'SHA256',
      Buffer.from(signingInput),
      publicKey,
      Buffer.from(signature, 'base64url')
    );
    if (!isValid) return null;

    // 4. Decode payload and check expiry
    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
