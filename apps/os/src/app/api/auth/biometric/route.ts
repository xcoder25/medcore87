import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { signMfaToken } from '../../../../lib/serverSession';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';
import {
  assessFaceQuality,
  compareFaceWithReference,
  createFaceLivenessSession,
  FACE_LIVENESS_PROMPTS,
  getRekognitionConfig,
  isRekognitionAuthError,
  isRekognitionConfigured,
  probeFaceFrame,
  toSafeBiometricError,
  verifyActiveLiveness,
  type FaceLivenessPrompt,
} from '../../../../lib/aws/rekognitionServer';
import {
  decodeBase64Image,
  deleteStoredBiometric,
  getStoredBiometric,
  loadFacePortraitBuffer,
  saveStoredBiometric,
  storeFacePortrait,
} from '../../../../lib/biometricVaultServer';
import { type UnifiedBiometricVault } from '../../../../lib/biometricVault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIVENESS_PROMPTS: FaceLivenessPrompt[] = ['smile', 'turn_left', 'turn_right'];

function getChallengeSecret(): string {
  return (
    process.env.MEDCORE_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MEDCORE_API_SECRET ||
    'medcore-os-biometric-challenge-secret-v1'
  ).trim();
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

    if (action === 'face_probe') {
      const rl = checkRateLimit(`face-probe:${ip}:${badgeId}`, 180, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, error: `Too many live camera scans. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const imgBuf = decodeBase64Image(body.imageBase64);
      if (!imgBuf) {
        return NextResponse.json(
          { ok: false, error: 'Camera frame could not be read.' },
          { status: 400 }
        );
      }

      const rawStage = String(body.stage || 'neutral').trim();
      const stage: 'enroll' | 'neutral' | 'liveness' =
        rawStage === 'enroll' || rawStage === 'liveness' ? rawStage : 'neutral';
      const rawPrompt = String(body.prompt || 'smile').trim() as FaceLivenessPrompt;
      const prompt: FaceLivenessPrompt = LIVENESS_PROMPTS.includes(rawPrompt) ? rawPrompt : 'smile';
      const neutralPoseYaw = Number(body.neutralPoseYaw ?? 0);
      const neutralSmileConfidence = Number(body.neutralSmileConfidence ?? 0);

      const runStandardProbe = () => {
        const currentVec = validateFaceVector(body.faceVector);
        if (!currentVec) {
          return {
            ok: true,
            faceDetected: false,
            readyForNeutral: false,
            livenessMatched: false,
            guidance: 'Position your face inside the oval in clear lighting.',
            engine: 'standard' as const,
          };
        }
        if (stage === 'enroll' || stage === 'neutral') {
          return {
            ok: true,
            faceDetected: true,
            readyForNeutral: true,
            livenessMatched: false,
            guidance:
              stage === 'enroll'
                ? 'Face aligned — enrolling automatically…'
                : 'Front view aligned — capturing automatically…',
            qualityScore: 90,
            pose: { yaw: 0, pitch: 0, roll: 0 },
            smiling: false,
            smileConfidence: 0,
            engine: 'standard' as const,
          };
        }

        const neutralVec = validateFaceVector(body.neutralFaceVector);
        if (!neutralVec) {
          return {
            ok: true,
            faceDetected: true,
            readyForNeutral: true,
            livenessMatched: false,
            guidance: FACE_LIVENESS_PROMPTS[prompt],
            engine: 'standard' as const,
          };
        }

        const moveSim = cosineSimilarity(neutralVec, currentVec);
        if (moveSim < 0.998 && moveSim >= 0.55) {
          return {
            ok: true,
            faceDetected: true,
            readyForNeutral: true,
            livenessMatched: true,
            guidance: 'Live movement confirmed — verifying identity…',
            engine: 'standard' as const,
          };
        }
        if (moveSim < 0.55) {
          return {
            ok: true,
            faceDetected: true,
            readyForNeutral: true,
            livenessMatched: false,
            guidance: 'Keep your face centered inside the oval while completing the movement.',
            engine: 'standard' as const,
          };
        }
        return {
          ok: true,
          faceDetected: true,
          readyForNeutral: true,
          livenessMatched: false,
          guidance: FACE_LIVENESS_PROMPTS[prompt],
          engine: 'standard' as const,
        };
      };

      if (isRekognitionConfigured()) {
        try {
          const probe = await probeFaceFrame(imgBuf, {
            stage,
            prompt,
            neutralPoseYaw,
            neutralSmileConfidence,
          });
          return NextResponse.json(probe);
        } catch (err) {
          if (isRekognitionAuthError(err)) {
            return NextResponse.json(runStandardProbe());
          }
          return NextResponse.json({ ok: false, error: toSafeBiometricError(err) }, { status: 502 });
        }
      }

      return NextResponse.json(runStandardProbe());
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
      const faceDescriptor = await storeFacePortrait(facilityId, badgeId, imgBuf, {
        enrolledAt,
        qualityScore,
        verificationEngine,
        faceVector,
      });

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
          { ok: false, notEnrolled: true, error: 'No facial biometric is enrolled for this staff member.' },
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
          { ok: false, verified: false, notEnrolled: true, error: 'No facial biometric profile found for this staff member.' },
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
      const shouldTryCloud = isRekognitionConfigured();

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
          const referenceBuf = await loadFacePortraitBuffer(existing.face);

          if (!referenceBuf) {
            if (hasVectors) {
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
                {
                  ok: false,
                  verified: false,
                  error: 'Enrolled reference portrait could not be retrieved. Please re-enroll facial biometric in your profile.',
                },
                { status: 409 }
              );
            }
          } else {
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
