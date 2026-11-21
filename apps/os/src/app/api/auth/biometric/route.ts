import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';
import { signMfaToken } from '../../../../lib/serverSession';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';
import {
  assessFaceQuality,
  compareFaceWithReference,
  createFaceLivenessSession,
  FACE_LIVENESS_PROMPTS,
  getRekognitionConfig,
  isRekognitionConfigured,
  toSafeBiometricError,
  verifyActiveLiveness,
  type FaceLivenessPrompt,
} from '../../../../lib/aws/rekognitionServer';
import { getS3ObjectBuffer, isS3Configured, uploadBufferToS3 } from '../../../../lib/s3Server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PasskeyDescriptor {
  credentialId: string;
  publicKeySpkiB64: string;
  alg?: number;
  deviceLabel?: string;
  counter: number;
  createdAt: string;
  lastUsedAt?: string;
}

export interface FaceBiometricDescriptor {
  storageMode: 'object_storage' | 'inline_vault';
  objectKey?: string;
  referenceImageB64?: string;
  enrolledAt: string;
  qualityScore?: number;
  lastUsedAt?: string;
}

export interface UnifiedBiometricVault {
  version: 2;
  passkey?: PasskeyDescriptor;
  face?: FaceBiometricDescriptor;
}

const BIO_VAULT_FILE = path.join(os.tmpdir(), 'medcore-staff-biometrics-vault.json');
const MAX_FACE_IMAGE_BYTES = 5 * 1024 * 1024;
const LIVENESS_PROMPTS: FaceLivenessPrompt[] = ['smile', 'turn_left', 'turn_right'];

function getChallengeSecret(): string {
  return (
    process.env.MEDCORE_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MEDCORE_API_SECRET ||
    'medcore-os-biometric-challenge-secret-v1'
  ).trim();
}

/**
 * Normalize both legacy flat passkey descriptors and unified v2 (passkey + face) vaults.
 */
export function normalizeBiometricVault(raw: unknown): UnifiedBiometricVault | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version === 2 || 'passkey' in obj || 'face' in obj) {
    const passkey = obj.passkey && typeof obj.passkey === 'object' ? (obj.passkey as PasskeyDescriptor) : undefined;
    const face = obj.face && typeof obj.face === 'object' ? (obj.face as FaceBiometricDescriptor) : undefined;
    if (!passkey && !face) return null;
    return {
      version: 2,
      ...(passkey ? { passkey } : {}),
      ...(face ? { face } : {}),
    };
  }

  // Legacy flat WebAuthn passkey row
  if (typeof obj.credentialId === 'string' && typeof obj.publicKeySpkiB64 === 'string') {
    const passkey: PasskeyDescriptor = {
      credentialId: obj.credentialId,
      publicKeySpkiB64: obj.publicKeySpkiB64,
      alg: typeof obj.alg === 'number' ? obj.alg : -7,
      deviceLabel: typeof obj.deviceLabel === 'string' ? obj.deviceLabel : undefined,
      counter: typeof obj.counter === 'number' ? obj.counter : 0,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
      lastUsedAt: typeof obj.lastUsedAt === 'string' ? obj.lastUsedAt : undefined,
    };
    return { version: 2, passkey };
  }

  return null;
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

async function getStoredBiometric(
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

async function saveStoredBiometric(
  facilityId: string,
  badgeId: string,
  staffName: string,
  vault: UnifiedBiometricVault
): Promise<void> {
  const fid = facilityId.trim().toUpperCase();
  const bid = badgeId.trim().toUpperCase();
  const v = readLocalVault();
  const entry: LocalVaultEntry = { ...vault, version: 2, badgeId: bid, facilityId: fid, staffName };
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

async function deleteStoredBiometric(facilityId: string, badgeId: string): Promise<void> {
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

function issueSignedChallenge(
  badgeId: string,
  facilityId: string,
  purpose: 'register' | 'auth' | 'face_auth',
  prompt?: FaceLivenessPrompt
) {
  const challenge = crypto.randomBytes(32).toString('base64url');
  const ttlMs = purpose === 'face_auth' ? 2 * 60 * 1000 : 5 * 60 * 1000;
  const payload = {
    challenge,
    badgeId: badgeId.trim().toUpperCase(),
    facilityId: facilityId.trim().toUpperCase(),
    purpose,
    ...(prompt ? { prompt } : {}),
    exp: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getChallengeSecret())
    .update(body)
    .digest('base64url');
  return { challenge, challengeToken: `${body}.${sig}` };
}

function verifySignedChallenge(
  token: string,
  expectedBadgeId: string,
  expectedFacilityId: string,
  expectedPurpose: 'register' | 'auth' | 'face_auth'
): { ok: boolean; challenge?: string; prompt?: FaceLivenessPrompt; error?: string } {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { ok: false, error: 'Malformed biometric challenge token.' };
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getChallengeSecret())
    .update(body)
    .digest('base64url');
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return { ok: false, error: 'Biometric challenge signature mismatch.' };
  }
  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    challenge: string;
    badgeId: string;
    facilityId: string;
    purpose: string;
    prompt?: FaceLivenessPrompt;
    exp: number;
  };
  if (Date.now() > decoded.exp) return { ok: false, error: 'Biometric prompt expired. Try again.' };
  if (decoded.purpose !== expectedPurpose) return { ok: false, error: 'Challenge purpose mismatch.' };
  if (decoded.badgeId !== expectedBadgeId.trim().toUpperCase()) return { ok: false, error: 'Badge mismatch.' };
  if (decoded.facilityId !== expectedFacilityId.trim().toUpperCase()) return { ok: false, error: 'Facility mismatch.' };
  return { ok: true, challenge: decoded.challenge, prompt: decoded.prompt };
}

function verifyAssertionSignature(
  publicKeySpkiB64: string,
  authenticatorDataB64u: string,
  clientDataJSONB64u: string,
  signatureB64u: string
): boolean {
  const spkiDer = Buffer.from(publicKeySpkiB64, 'base64');
  const pubKey = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
  const authData = Buffer.from(authenticatorDataB64u, 'base64url');
  const clientDataRaw = Buffer.from(clientDataJSONB64u, 'base64url');
  const clientHash = crypto.createHash('sha256').update(clientDataRaw).digest();
  const signedBytes = Buffer.concat([authData, clientHash]);
  const signature = Buffer.from(signatureB64u, 'base64url');
  return crypto.createVerify('SHA256').update(signedBytes).verify(pubKey, signature);
}

function decodeBase64Image(raw: unknown): Buffer | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const cleaned = text.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, '');
  if (!cleaned) return null;
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length < 1024 || buf.length > MAX_FACE_IMAGE_BYTES) return null;
  return buf;
}

function buildStatusPayload(vault: UnifiedBiometricVault | null) {
  const passkeyEnrolled = Boolean(vault?.passkey);
  const faceEnrolled = Boolean(vault?.face);
  const lastUsedAt = [vault?.face?.lastUsedAt, vault?.passkey?.lastUsedAt]
    .filter((x): x is string => Boolean(x))
    .sort()
    .pop() || null;

  return {
    ok: true,
    enrolled: passkeyEnrolled || faceEnrolled,
    passkeyEnrolled,
    faceEnrolled,
    faceServiceAvailable: isRekognitionConfigured(),
    deviceLabel: vault?.passkey?.deviceLabel || null,
    enrolledAt: vault?.passkey?.createdAt || vault?.face?.enrolledAt || null,
    faceEnrolledAt: vault?.face?.enrolledAt || null,
    lastUsedAt,
  };
}

export async function GET(req: NextRequest) {
  const badgeId = req.nextUrl.searchParams.get('badgeId') || '';
  const facilityId = req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT';
  if (!badgeId.trim()) {
    return NextResponse.json({ ok: false, enrolled: false, error: 'badgeId required' }, { status: 400 });
  }
  const existing = await getStoredBiometric(facilityId, badgeId);
  return NextResponse.json(buildStatusPayload(existing));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '').trim();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const staffName = String(body.staffName || badgeId).trim();

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'badgeId is required.' }, { status: 400 });
    }

    if (action === 'status') {
      const existing = await getStoredBiometric(facilityId, badgeId);
      return NextResponse.json(buildStatusPayload(existing));
    }

    if (action === 'register_options') {
      const { challenge, challengeToken } = issueSignedChallenge(badgeId, facilityId, 'register');
      return NextResponse.json({
        ok: true,
        challenge,
        challengeToken,
        user: {
          id: Buffer.from(`${facilityId}:${badgeId}`).toString('base64url'),
          name: `${badgeId} · MedCore`,
          displayName: staffName,
        },
      });
    }

    if (action === 'register_verify') {
      const challengeToken = String(body.challengeToken || '');
      const check = verifySignedChallenge(challengeToken, badgeId, facilityId, 'register');
      if (!check.ok || !check.challenge) {
        return NextResponse.json({ ok: false, error: check.error }, { status: 401 });
      }
      const credentialId = String(body.credentialId || '').trim();
      const publicKeySpkiB64 = String(body.publicKeySpkiB64 || '').trim();
      const clientDataJSON = String(body.clientDataJSON || '').trim();
      const deviceLabel = String(body.deviceLabel || 'Platform Biometric Passkey').trim();
      const alg = typeof body.alg === 'number' ? body.alg : -7;

      if (!credentialId || !publicKeySpkiB64 || !clientDataJSON) {
        return NextResponse.json(
          { ok: false, error: 'Incomplete passkey attestation from device.' },
          { status: 400 }
        );
      }

      const clientObj = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
        type?: string;
        challenge?: string;
      };
      if (clientObj.type !== 'webauthn.create' || clientObj.challenge !== check.challenge) {
        return NextResponse.json(
          { ok: false, error: 'Biometric registration challenge verification failed.' },
          { status: 401 }
        );
      }

      crypto.createPublicKey({
        key: Buffer.from(publicKeySpkiB64, 'base64'),
        format: 'der',
        type: 'spki',
      });

      const existing = await getStoredBiometric(facilityId, badgeId);
      const passkey: PasskeyDescriptor = {
        credentialId,
        publicKeySpkiB64,
        alg,
        deviceLabel,
        counter: 0,
        createdAt: new Date().toISOString(),
      };
      await saveStoredBiometric(facilityId, badgeId, staffName, {
        version: 2,
        ...(existing || {}),
        passkey,
      });
      return NextResponse.json({ ok: true, enrolled: true, passkeyEnrolled: true, deviceLabel });
    }

    if (action === 'auth_options') {
      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing?.passkey) {
        return NextResponse.json(
          { ok: false, error: 'No biometric passkey enrolled for this staff member.' },
          { status: 404 }
        );
      }
      const { challenge, challengeToken } = issueSignedChallenge(badgeId, facilityId, 'auth');
      return NextResponse.json({
        ok: true,
        challenge,
        challengeToken,
        credentialId: existing.passkey.credentialId,
      });
    }

    if (action === 'auth_verify') {
      const rl = checkRateLimit(`bio-verify:${ip}:${badgeId}`, 15, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, verified: false, error: `Too many biometric attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing?.passkey) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'No biometric credential found.' },
          { status: 404 }
        );
      }

      const challengeToken = String(body.challengeToken || '');
      const check = verifySignedChallenge(challengeToken, badgeId, facilityId, 'auth');
      if (!check.ok || !check.challenge) {
        return NextResponse.json({ ok: false, verified: false, error: check.error }, { status: 401 });
      }

      const credentialId = String(body.credentialId || '').trim();
      const authenticatorData = String(body.authenticatorData || '').trim();
      const clientDataJSON = String(body.clientDataJSON || '').trim();
      const signature = String(body.signature || '').trim();

      if (credentialId !== existing.passkey.credentialId) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Unrecognized passkey credential for this account.' },
          { status: 401 }
        );
      }

      const clientObj = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
        type?: string;
        challenge?: string;
      };
      if (clientObj.type !== 'webauthn.get' || clientObj.challenge !== check.challenge) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Biometric assertion challenge failed.' },
          { status: 401 }
        );
      }

      const sigValid = verifyAssertionSignature(
        existing.passkey.publicKeySpkiB64,
        authenticatorData,
        clientDataJSON,
        signature
      );
      if (!sigValid) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Biometric cryptographic signature could not be verified.' },
          { status: 401 }
        );
      }

      await saveStoredBiometric(facilityId, badgeId, staffName, {
        ...existing,
        version: 2,
        passkey: {
          ...existing.passkey,
          counter: (existing.passkey.counter || 0) + 1,
          lastUsedAt: new Date().toISOString(),
        },
      });

      const mfaToken = await signMfaToken(badgeId, facilityId, 'biometric');
      return NextResponse.json({
        ok: true,
        verified: true,
        method: 'biometric',
        mfaToken,
      });
    }

    if (action === 'face_enroll') {
      const rl = checkRateLimit(`face-enroll:${ip}:${badgeId}`, 10, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, error: `Too many facial enrollment attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }
      if (!isRekognitionConfigured()) {
        return NextResponse.json(
          { ok: false, error: 'Facial biometric verification service is not yet configured on this server.' },
          { status: 503 }
        );
      }

      const imgBuf = decodeBase64Image(body.imageBase64);
      if (!imgBuf) {
        return NextResponse.json(
          { ok: false, error: 'Invalid or oversized camera image. Please capture a clear portrait (max 5 MB).' },
          { status: 400 }
        );
      }

      let quality;
      try {
        quality = await assessFaceQuality(imgBuf);
      } catch (err) {
        return NextResponse.json({ ok: false, error: toSafeBiometricError(err) }, { status: 502 });
      }

      if (!quality.ok) {
        return NextResponse.json({ ok: false, error: quality.reason }, { status: 400 });
      }

      const enrolledAt = new Date().toISOString();
      let faceDescriptor: FaceBiometricDescriptor;

      if (isS3Configured()) {
        try {
          const objectKey = `biometrics/${facilityId.toLowerCase()}/${badgeId.toLowerCase()}-face-${Date.now()}.jpg`;
          await uploadBufferToS3(imgBuf, objectKey, 'image/jpeg', {
            facilityId,
            badgeId,
            kind: 'face_biometric',
          });
          faceDescriptor = {
            storageMode: 'object_storage',
            objectKey,
            enrolledAt,
            qualityScore: quality.qualityScore,
          };
        } catch {
          faceDescriptor = {
            storageMode: 'inline_vault',
            referenceImageB64: imgBuf.toString('base64'),
            enrolledAt,
            qualityScore: quality.qualityScore,
          };
        }
      } else {
        faceDescriptor = {
          storageMode: 'inline_vault',
          referenceImageB64: imgBuf.toString('base64'),
          enrolledAt,
          qualityScore: quality.qualityScore,
        };
      }

      const existing = await getStoredBiometric(facilityId, badgeId);
      await saveStoredBiometric(facilityId, badgeId, staffName, {
        version: 2,
        ...(existing || {}),
        face: faceDescriptor,
      });

      return NextResponse.json({
        ok: true,
        enrolled: true,
        faceEnrolled: true,
        enrolledAt,
        qualityScore: quality.qualityScore,
      });
    }

    if (action === 'face_challenge') {
      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing?.face) {
        return NextResponse.json(
          { ok: false, error: 'No facial biometric is enrolled for this staff member.' },
          { status: 404 }
        );
      }
      if (!isRekognitionConfigured()) {
        return NextResponse.json(
          { ok: false, error: 'Facial biometric verification service is not yet configured on this server.' },
          { status: 503 }
        );
      }

      const prompt = LIVENESS_PROMPTS[crypto.randomInt(LIVENESS_PROMPTS.length)];
      const { challengeToken } = issueSignedChallenge(badgeId, facilityId, 'face_auth', prompt);

      let livenessSessionId: string | null = null;
      if (getRekognitionConfig().livenessSessionEnabled) {
        try {
          const sess = await createFaceLivenessSession();
          livenessSessionId = sess.sessionId;
        } catch {
          /* continue with active multi-frame liveness */
        }
      }

      return NextResponse.json({
        ok: true,
        challengeToken,
        prompt,
        promptLabel: FACE_LIVENESS_PROMPTS[prompt],
        livenessSessionId,
      });
    }

    if (action === 'face_verify') {
      const rl = checkRateLimit(`face-verify:${ip}:${badgeId}`, 12, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, verified: false, error: `Too many facial verification attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      if (!isRekognitionConfigured()) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Facial biometric verification service is not yet configured on this server.' },
          { status: 503 }
        );
      }

      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing?.face) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'No facial biometric profile found for this staff member.' },
          { status: 404 }
        );
      }

      const challengeToken = String(body.challengeToken || '');
      const check = verifySignedChallenge(challengeToken, badgeId, facilityId, 'face_auth');
      if (!check.ok || !check.prompt) {
        return NextResponse.json({ ok: false, verified: false, error: check.error }, { status: 401 });
      }

      const neutralBuf = decodeBase64Image(body.neutralImageBase64);
      const challengeBuf = decodeBase64Image(body.challengeImageBase64);
      if (!neutralBuf || !challengeBuf) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Both neutral and liveness camera frames are required.' },
          { status: 400 }
        );
      }

      let liveness;
      try {
        liveness = await verifyActiveLiveness(neutralBuf, challengeBuf, check.prompt);
      } catch (err) {
        return NextResponse.json(
          { ok: false, verified: false, error: toSafeBiometricError(err) },
          { status: 502 }
        );
      }
      if (!liveness.ok) {
        return NextResponse.json({ ok: false, verified: false, error: liveness.reason }, { status: 401 });
      }

      let referenceBuf: Buffer | null = null;
      if (existing.face.storageMode === 'object_storage' && existing.face.objectKey) {
        try {
          const obj = await getS3ObjectBuffer(existing.face.objectKey);
          referenceBuf = obj.buffer;
        } catch {
          referenceBuf = null;
        }
      } else if (existing.face.referenceImageB64) {
        referenceBuf = decodeBase64Image(existing.face.referenceImageB64);
      }

      if (!referenceBuf) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error: 'Enrolled reference portrait could not be retrieved. Please re-enroll facial biometric in your profile.',
          },
          { status: 409 }
        );
      }

      let cmp;
      try {
        cmp = await compareFaceWithReference(neutralBuf, referenceBuf, 92);
      } catch (err) {
        return NextResponse.json(
          { ok: false, verified: false, error: toSafeBiometricError(err) },
          { status: 502 }
        );
      }

      if (!cmp.matched) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error: 'Facial identity did not match the enrolled staff profile. Please try again in clear lighting or use Email OTP.',
          },
          { status: 401 }
        );
      }

      await saveStoredBiometric(facilityId, badgeId, staffName, {
        ...existing,
        version: 2,
        face: {
          ...existing.face,
          lastUsedAt: new Date().toISOString(),
        },
      });

      const mfaToken = await signMfaToken(badgeId, facilityId, 'biometric');
      return NextResponse.json({
        ok: true,
        verified: true,
        method: 'face_biometric',
        similarity: Math.round(cmp.similarity * 10) / 10,
        mfaToken,
      });
    }

    if (action === 'revoke') {
      const target = String(body.target || 'all').trim();
      if (target === 'passkey' || target === 'face') {
        const existing = await getStoredBiometric(facilityId, badgeId);
        if (!existing) {
          return NextResponse.json({ ok: true, revoked: true });
        }
        const updated: UnifiedBiometricVault = { version: 2 };
        if (target === 'passkey' && existing.face) updated.face = existing.face;
        if (target === 'face' && existing.passkey) updated.passkey = existing.passkey;
        if (!updated.passkey && !updated.face) {
          await deleteStoredBiometric(facilityId, badgeId);
        } else {
          await saveStoredBiometric(facilityId, badgeId, staffName, updated);
        }
        return NextResponse.json({ ok: true, revoked: true, target });
      }
      await deleteStoredBiometric(facilityId, badgeId);
      return NextResponse.json({ ok: true, revoked: true, target: 'all' });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported biometric action.' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Biometric verification encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
