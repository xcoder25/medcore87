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
import {
  normalizeBiometricVault,
  type FaceBiometricDescriptor,
  type UnifiedBiometricVault,
} from '../../../../lib/biometricVault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  prompt: FaceLivenessPrompt
) {
  const challenge = crypto.randomBytes(32).toString('base64url');
  const ttlMs = 2 * 60 * 1000;
  const payload = {
    challenge,
    badgeId: badgeId.trim().toUpperCase(),
    facilityId: facilityId.trim().toUpperCase(),
    purpose: 'face_auth' as const,
    prompt,
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
  expectedFacilityId: string
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
  if (decoded.purpose !== 'face_auth') return { ok: false, error: 'Challenge purpose mismatch.' };
  if (decoded.badgeId !== expectedBadgeId.trim().toUpperCase()) return { ok: false, error: 'Badge mismatch.' };
  if (decoded.facilityId !== expectedFacilityId.trim().toUpperCase()) return { ok: false, error: 'Facility mismatch.' };
  return { ok: true, challenge: decoded.challenge, prompt: decoded.prompt };
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

function isRekognitionAuthError(err: unknown): boolean {
  const e = err as { name?: string; Code?: string; message?: string } | undefined;
  const code = String(e?.name || e?.Code || '').toLowerCase();
  const msg = String(e?.message || '').toLowerCase();
  return (
    code.includes('accessdenied') ||
    code.includes('unrecognizedclient') ||
    code.includes('invalidsignature') ||
    code.includes('expiredtoken') ||
    code.includes('credentialsprovider') ||
    code.includes('notauthorized') ||
    code.includes('optinrequired') ||
    code.includes('subscriptionrequired') ||
    code.includes('endpointconnection') ||
    msg.includes('security token') ||
    msg.includes('credentials') ||
    msg.includes('not authorized') ||
    msg.includes('could not load credentials')
  );
}

function validateFaceVector(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 64 || raw.length > 512) return null;
  const nums: number[] = [];
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return null;
    nums.push(item);
  }
  let sumSq = 0;
  for (const v of nums) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (!Number.isFinite(norm) || norm < 1e-4) return null;
  const unit = nums.map((v) => v / norm);
  const mean = unit.reduce((acc, v) => acc + v, 0) / unit.length;
  const variance = unit.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / unit.length;
  if (variance < 1e-4) return null;
  return unit;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

function evaluateVectorVerification(
  refVec: number[] | null,
  neutralVec: number[] | null,
  challengeVec: number[] | null
): { ok: true; similarityPct: number } | { ok: false; status: number; error: string } {
  if (!refVec) {
    return {
      ok: false,
      status: 409,
      error: 'Facial profile needs re-enrollment for verification. Please re-enroll Face ID in Settings or Profile.',
    };
  }
  if (!neutralVec || !challengeVec) {
    return {
      ok: false,
      status: 400,
      error: 'Could not extract clear facial frames from the camera. Center your face in clear lighting and retry.',
    };
  }

  const moveSim = cosineSimilarity(neutralVec, challengeVec);
  if (moveSim >= 0.999) {
    return {
      ok: false,
      status: 401,
      error: 'No live movement detected between captures. Look straight first, then clearly smile or turn your head and retry.',
    };
  }
  if (moveSim < 0.55) {
    return {
      ok: false,
      status: 401,
      error: 'The same person must remain centered in front of the camera for both captures.',
    };
  }

  const idSim = cosineSimilarity(neutralVec, refVec);
  if (idSim < 0.78) {
    return {
      ok: false,
      status: 401,
      error: 'Facial identity did not match the enrolled staff profile. Please try again in clear lighting or use Email OTP.',
    };
  }

  return { ok: true, similarityPct: Math.round(idSim * 1000) / 10 };
}

function buildStatusPayload(vault: UnifiedBiometricVault | null) {
  const faceEnrolled = Boolean(vault?.face);
  return {
    ok: true,
    enrolled: faceEnrolled,
    faceEnrolled,
    faceServiceAvailable: true,
    enrolledAt: vault?.face?.enrolledAt || null,
    faceEnrolledAt: vault?.face?.enrolledAt || null,
    lastUsedAt: vault?.face?.lastUsedAt || null,
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

    if (action === 'face_enroll') {
      const rl = checkRateLimit(`face-enroll:${ip}:${badgeId}`, 10, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, error: `Too many facial enrollment attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const imgBuf = decodeBase64Image(body.imageBase64);
      if (!imgBuf) {
        return NextResponse.json(
          { ok: false, error: 'Invalid or oversized camera image. Please capture a clear portrait (max 5 MB).' },
          { status: 400 }
        );
      }

      const faceVector = body.faceVector !== undefined ? validateFaceVector(body.faceVector) : null;
      if (body.faceVector !== undefined && !faceVector && !isRekognitionConfigured()) {
        return NextResponse.json(
          { ok: false, error: 'Camera frame appears blank or too dim. Ensure good lighting and center your face.' },
          { status: 400 }
        );
      }

      let qualityScore = 88;
      let verificationEngine: 'cloud_vision' | 'standard' = 'standard';

      if (isRekognitionConfigured()) {
        try {
          const quality = await assessFaceQuality(imgBuf);
          if (!quality.ok) {
            return NextResponse.json({ ok: false, error: quality.reason }, { status: 400 });
          }
          qualityScore = quality.qualityScore ?? 92;
          verificationEngine = 'cloud_vision';
        } catch (err) {
          if (!isRekognitionAuthError(err)) {
            return NextResponse.json({ ok: false, error: toSafeBiometricError(err) }, { status: 502 });
          }
          verificationEngine = 'standard';
          qualityScore = 88;
        }
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
            qualityScore,
            verificationEngine,
            ...(faceVector ? { faceVector } : {}),
          };
        } catch {
          faceDescriptor = {
            storageMode: 'inline_vault',
            referenceImageB64: imgBuf.toString('base64'),
            enrolledAt,
            qualityScore,
            verificationEngine,
            ...(faceVector ? { faceVector } : {}),
          };
        }
      } else {
        faceDescriptor = {
          storageMode: 'inline_vault',
          referenceImageB64: imgBuf.toString('base64'),
          enrolledAt,
          qualityScore,
          verificationEngine,
          ...(faceVector ? { faceVector } : {}),
        };
      }

      await saveStoredBiometric(facilityId, badgeId, staffName, {
        version: 2,
        face: faceDescriptor,
      });

      return NextResponse.json({
        ok: true,
        enrolled: true,
        faceEnrolled: true,
        enrolledAt,
        qualityScore,
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

      const prompt = LIVENESS_PROMPTS[crypto.randomInt(LIVENESS_PROMPTS.length)];
      const { challengeToken } = issueSignedChallenge(badgeId, facilityId, prompt);

      let livenessSessionId: string | null = null;
      if (isRekognitionConfigured() && getRekognitionConfig().livenessSessionEnabled) {
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

      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing?.face) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'No facial biometric profile found for this staff member.' },
          { status: 404 }
        );
      }

      const challengeToken = String(body.challengeToken || '');
      const check = verifySignedChallenge(challengeToken, badgeId, facilityId);
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

      if (Buffer.compare(neutralBuf, challengeBuf) === 0) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error: 'Liveness requires two distinct frames. Complete the requested camera movement and try again.',
          },
          { status: 401 }
        );
      }

      const refVec = validateFaceVector(existing.face.faceVector);
      const neutralVec = validateFaceVector(body.neutralFaceVector);
      const challengeVec = validateFaceVector(body.challengeFaceVector);
      const hasVectors = Boolean(refVec && neutralVec && challengeVec);

      let similarityPct: number | null = null;
      const shouldTryCloud = isRekognitionConfigured() && existing.face.verificationEngine !== 'standard';

      if (shouldTryCloud) {
        let fellBackToVector = false;

        try {
          const liveness = await verifyActiveLiveness(neutralBuf, challengeBuf, check.prompt);
          if (!liveness.ok) {
            return NextResponse.json({ ok: false, verified: false, error: liveness.reason }, { status: 401 });
          }
        } catch (err) {
          if (isRekognitionAuthError(err) && hasVectors) {
            const vecRes = evaluateVectorVerification(refVec, neutralVec, challengeVec);
            if (!vecRes.ok) {
              return NextResponse.json(
                { ok: false, verified: false, error: vecRes.error },
                { status: vecRes.status }
              );
            }
            similarityPct = vecRes.similarityPct;
            fellBackToVector = true;
          } else {
            return NextResponse.json(
              { ok: false, verified: false, error: toSafeBiometricError(err) },
              { status: 502 }
            );
          }
        }

        if (!fellBackToVector) {
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

          try {
            const cmp = await compareFaceWithReference(neutralBuf, referenceBuf, 92);
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
            similarityPct = Math.round(cmp.similarity * 10) / 10;
          } catch (err) {
            if (isRekognitionAuthError(err) && hasVectors) {
              const vecRes = evaluateVectorVerification(refVec, neutralVec, challengeVec);
              if (!vecRes.ok) {
                return NextResponse.json(
                  { ok: false, verified: false, error: vecRes.error },
                  { status: vecRes.status }
                );
              }
              similarityPct = vecRes.similarityPct;
            } else {
              return NextResponse.json(
                { ok: false, verified: false, error: toSafeBiometricError(err) },
                { status: 502 }
              );
            }
          }
        }
      } else {
        const vecRes = evaluateVectorVerification(refVec, neutralVec, challengeVec);
        if (!vecRes.ok) {
          return NextResponse.json(
            { ok: false, verified: false, error: vecRes.error },
            { status: vecRes.status }
          );
        }
        similarityPct = vecRes.similarityPct;
      }

      await saveStoredBiometric(facilityId, badgeId, staffName, {
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
        similarity: similarityPct ?? 95,
        mfaToken,
      });
    }

    if (action === 'revoke') {
      const target = String(body.target || 'all').trim();
      await deleteStoredBiometric(facilityId, badgeId);
      return NextResponse.json({ ok: true, revoked: true, target });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported biometric action.' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Biometric verification encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
