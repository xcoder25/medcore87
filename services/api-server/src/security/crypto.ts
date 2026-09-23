import crypto from 'crypto';
import { EncryptedPayload } from '@medcore/types';
export { EncryptedPayload };

// System master encryption key (derived from secure environment or standard fallback)
const SYSTEM_KEY_SEED = process.env.MEDCORE_ENCRYPTION_MASTER_KEY || 'medcore-m87-enterprise-security-2026-master-key-seed-009';
const MASTER_KEY = crypto.createHash('sha256').update(SYSTEM_KEY_SEED).digest();
const JWT_SECRET = process.env.MEDCORE_JWT_SECRET || 'medcore-jwt-secret-secure-commissioner-audit-bus-2026';

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
 * Signs data using HMAC-SHA256 with government/MOH security signature
 */
export function signAuditRecord(hash: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(hash).digest('hex');
}

/**
 * Verifies signature
 */
export function verifyAuditSignature(hash: string, signature: string): boolean {
  const expected = signAuditRecord(hash);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
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
export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: string;
  facilityId: string;
  scopes: string[];
  iat: number;
  exp: number;
}

export function createToken(
  user: { id: string; name: string; email: string; role: string; facilityId: string; scopes: string[] },
  expiresInSeconds = 3600 * 24
): string {
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

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
