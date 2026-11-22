import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureSchema, isPostgresConfigured, withTenantClient } from './db/postgres';
import {
  normalizeBiometricVault,
  type FaceBiometricDescriptor,
  type UnifiedBiometricVault,
} from './biometricVault';
import { getS3ObjectBuffer, isS3Configured, uploadBufferToS3 } from './s3Server';

const BIO_VAULT_FILE = path.join(os.tmpdir(), 'medcore-staff-biometrics-vault.json');
export const MAX_FACE_IMAGE_BYTES = 5 * 1024 * 1024;

function getBiometricSigningSecret(): string {
  return (
    process.env.MEDCORE_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MEDCORE_API_SECRET ||
    'medcore-os-biometric-challenge-secret-v1'
  ).trim();
}

type LocalVaultEntry = UnifiedBiometricVault & {
  badgeId: string;
  facilityId: string;
  staffName?: string;
};

function readLocalVault(): Record<string, Record<string, unknown>> {
  try {
    if (fs.existsSync(BIO_VAULT_FILE)) {
      return JSON.parse(fs.readFileSync(BIO_VAULT_FILE, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeLocalVault(map: Record<string, Record<string, unknown>>): void {
  try {
    fs.writeFileSync(BIO_VAULT_FILE, JSON.stringify(map), 'utf8');
  } catch {
    /* ignore */
  }
}

function bioKey(facilityId: string, badgeId: string): string {
  return `${facilityId.trim().toUpperCase()}::${badgeId.trim().toUpperCase()}`;
}

export function decodeBase64Image(raw: unknown): Buffer | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const cleaned = text.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
  if (!cleaned) return null;
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length < 1024 || buf.length > MAX_FACE_IMAGE_BYTES) return null;
  return buf;
}

export async function getStoredBiometric(
  facilityId: string,
  badgeId: string
): Promise<UnifiedBiometricVault | null> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      const row = await withTenantClient(fid, async (c) => {
        const res = await c.query<{ descriptor: unknown }>(
          `SELECT descriptor FROM staff_biometrics WHERE facility_id = $1 AND badge_id = $2`,
          [fid, bid]
        );
        return res.rows[0]?.descriptor || null;
      });
      const normalized = normalizeBiometricVault(row);
      if (normalized) return normalized;
    } catch {
      /* fallback to local vault */
    }
  }
  const v = readLocalVault();
  return normalizeBiometricVault(v[bioKey(fid, bid)]);
}

export async function saveStoredBiometric(
  facilityId: string,
  badgeId: string,
  staffName: string,
  vault: UnifiedBiometricVault
): Promise<void> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  const v = readLocalVault();
  const entry: LocalVaultEntry = {
    ...vault,
    version: 2,
    badgeId: bid,
    facilityId: fid,
    staffName,
  };
  v[bioKey(fid, bid)] = entry as unknown as Record<string, unknown>;
  writeLocalVault(v);

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(fid, async (c) => {
        await c.query(
          `INSERT INTO staff_biometrics (badge_id, facility_id, staff_name, descriptor, version, enrolled_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, 2, NOW(), NOW())
           ON CONFLICT (facility_id, badge_id)
           DO UPDATE SET staff_name = EXCLUDED.staff_name,
                         descriptor = EXCLUDED.descriptor,
                         version = staff_biometrics.version + 1,
                         updated_at = NOW()`,
          [bid, fid, staffName || bid, JSON.stringify({ ...vault, version: 2 })]
        );
      });
    } catch {
      /* fallback persisted */
    }
  }
}

export async function deleteStoredBiometric(
  facilityId: string,
  badgeId: string
): Promise<void> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  const v = readLocalVault();
  delete v[bioKey(fid, bid)];
  writeLocalVault(v);

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(fid, async (c) => {
        await c.query(
          `DELETE FROM staff_biometrics WHERE facility_id = $1 AND badge_id = $2`,
          [fid, bid]
        );
      });
    } catch {
      /* ignore */
    }
  }
}

export async function storeFacePortrait(
  facilityId: string,
  badgeId: string,
  imgBuf: Buffer,
  meta: {
    enrolledAt: string;
    qualityScore: number;
    verificationEngine: 'cloud_vision' | 'standard';
    faceVector?: number[] | null;
  }
): Promise<FaceBiometricDescriptor> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();

  if (isS3Configured()) {
    try {
      const objectKey = `biometrics/${fid.toLowerCase()}/${bid.toLowerCase()}-face-${Date.now()}.jpg`;
      await uploadBufferToS3(imgBuf, objectKey, 'image/jpeg', {
        facilityId: fid,
        badgeId: bid,
        kind: 'face_biometric',
      });
      return {
        storageMode: 'object_storage',
        objectKey,
        enrolledAt: meta.enrolledAt,
        qualityScore: meta.qualityScore,
        verificationEngine: meta.verificationEngine,
        ...(meta.faceVector ? { faceVector: meta.faceVector } : {}),
      };
    } catch {
      /* fallback to inline encrypted DB vault */
    }
  }

  return {
    storageMode: 'inline_vault',
    referenceImageB64: imgBuf.toString('base64'),
    enrolledAt: meta.enrolledAt,
    qualityScore: meta.qualityScore,
    verificationEngine: meta.verificationEngine,
    ...(meta.faceVector ? { faceVector: meta.faceVector } : {}),
  };
}

export async function loadFacePortraitBuffer(
  face: FaceBiometricDescriptor
): Promise<Buffer | null> {
  if (face.storageMode === 'object_storage' && face.objectKey) {
    try {
      const obj = await getS3ObjectBuffer(face.objectKey);
      return obj.buffer;
    } catch {
      return null;
    }
  }
  if (face.referenceImageB64) {
    return decodeBase64Image(face.referenceImageB64);
  }
  return null;
}

export function issueSignedLivenessToken(params: {
  sessionId: string;
  badgeId: string;
  facilityId: string;
  mode: 'enroll' | 'verify';
}): string {
  const payload = {
    purpose: 'face_liveness' as const,
    sessionId: params.sessionId,
    badgeId: params.badgeId.trim().toUpperCase(),
    facilityId: params.facilityId.trim().toUpperCase(),
    mode: params.mode,
    exp: Date.now() + 5 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getBiometricSigningSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySignedLivenessToken(
  token: string,
  expected?: { sessionId?: string; badgeId?: string; facilityId?: string }
): {
  ok: boolean;
  sessionId?: string;
  badgeId?: string;
  facilityId?: string;
  mode?: 'enroll' | 'verify';
  error?: string;
} {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'Malformed live liveness token.' };
  }
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getBiometricSigningSecret())
    .update(body)
    .digest('base64url');
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return { ok: false, error: 'Live liveness token signature mismatch.' };
  }
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      purpose: string;
      sessionId: string;
      badgeId: string;
      facilityId: string;
      mode: 'enroll' | 'verify';
      exp: number;
    };
    if (decoded.purpose !== 'face_liveness') {
      return { ok: false, error: 'Liveness token purpose mismatch.' };
    }
    if (Date.now() > decoded.exp) {
      return { ok: false, error: 'Live liveness session expired. Restart verification.' };
    }
    if (expected?.sessionId && decoded.sessionId !== expected.sessionId) {
      return { ok: false, error: 'Liveness session mismatch.' };
    }
    if (expected?.badgeId && decoded.badgeId !== expected.badgeId.trim().toUpperCase()) {
      return { ok: false, error: 'Badge mismatch.' };
    }
    if (expected?.facilityId && decoded.facilityId !== expected.facilityId.trim().toUpperCase()) {
      return { ok: false, error: 'Facility mismatch.' };
    }
    return {
      ok: true,
      sessionId: decoded.sessionId,
      badgeId: decoded.badgeId,
      facilityId: decoded.facilityId,
      mode: decoded.mode,
    };
  } catch {
    return { ok: false, error: 'Invalid live liveness token.' };
  }
}
