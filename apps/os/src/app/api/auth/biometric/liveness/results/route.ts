import { NextRequest, NextResponse } from 'next/server';
import {
  assessFaceQuality,
  compareFaceWithReference,
  getFaceLivenessSessionResult,
  getRekognitionConfig,
  toSafeBiometricError,
} from '../../../../../../lib/aws/rekognitionServer';
import {
  getStoredBiometric,
  loadFacePortraitBuffer,
  saveStoredBiometric,
  storeFacePortrait,
  verifySignedLivenessToken,
} from '../../../../../../lib/biometricVaultServer';
import { checkRateLimit, getClientIp } from '../../../../../../lib/rateLimit';
import { signMfaToken } from '../../../../../../lib/serverSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Evaluate `GetFaceLivenessSessionResults` after live camera streaming finishes,
 * enforcing confidence threshold and enrolling or 1:1 matching the returned reference portrait.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = String(body.sessionId || '').trim();
    const livenessToken = String(body.livenessToken || '').trim();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const staffName = String(body.staffName || badgeId).trim();
    const rawMode = String(body.mode || 'verify').trim();
    const mode: 'enroll' | 'verify' = rawMode === 'enroll' ? 'enroll' : 'verify';

    if (!badgeId || !sessionId || !livenessToken) {
      return NextResponse.json(
        { ok: false, error: 'badgeId, sessionId, and livenessToken are required.' },
        { status: 400 }
      );
    }

    const rl = checkRateLimit(`liveness-res:${ip}:${badgeId}`, 20, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: `Too many liveness verification attempts. Wait ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const tokenCheck = verifySignedLivenessToken(livenessToken, {
      sessionId,
      badgeId,
      facilityId,
    });
    if (!tokenCheck.ok) {
      return NextResponse.json(
        { ok: false, error: tokenCheck.error || 'Invalid live liveness session token.' },
        { status: 401 }
      );
    }

    const minConfidence = getRekognitionConfig().livenessMinConfidence;
    let result: Awaited<ReturnType<typeof getFaceLivenessSessionResult>>;
    try {
      result = await getFaceLivenessSessionResult(sessionId);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: toSafeBiometricError(err) },
        { status: 502 }
      );
    }

    if (
      result.status !== 'SUCCEEDED' ||
      result.confidence < minConfidence ||
      !result.referenceBytes ||
      result.referenceBytes.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          livenessConfidence: Math.round(result.confidence * 10) / 10,
          error:
            'Live camera anti-spoofing check did not pass. Ensure bright even lighting, look directly at the oval, and try again.',
        },
        { status: 401 }
      );
    }

    const referenceBuffer = Buffer.from(result.referenceBytes);
    const livenessConfidence = Math.round(result.confidence * 10) / 10;

    if (mode === 'enroll') {
      let qualityScore = 95;
      try {
        const quality = await assessFaceQuality(referenceBuffer);
        if (!quality.ok) {
          return NextResponse.json({ ok: false, error: quality.reason }, { status: 400 });
        }
        qualityScore = quality.qualityScore ?? 95;
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: toSafeBiometricError(err) },
          { status: 502 }
        );
      }

      const enrolledAt = new Date().toISOString();
      const descriptor = await storeFacePortrait(facilityId, badgeId, referenceBuffer, {
        enrolledAt,
        qualityScore,
        verificationEngine: 'cloud_vision',
      });

      await saveStoredBiometric(facilityId, badgeId, staffName, {
        version: 2,
        face: descriptor,
      });

      return NextResponse.json({
        ok: true,
        enrolled: true,
        faceEnrolled: true,
        enrolledAt,
        qualityScore,
        livenessConfidence,
      });
    }

    // mode === 'verify'
    const existing = await getStoredBiometric(facilityId, badgeId);
    if (!existing?.face) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'No facial biometric profile found for this staff member.' },
        { status: 404 }
      );
    }

    const enrolledReference = await loadFacePortraitBuffer(existing.face);
    if (!enrolledReference) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: 'Enrolled reference portrait could not be retrieved. Please re-enroll Face ID in Settings.',
        },
        { status: 409 }
      );
    }

    let cmp: { matched: boolean; similarity: number };
    try {
      cmp = await compareFaceWithReference(referenceBuffer, enrolledReference, 92);
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
          livenessConfidence,
          error:
            'Facial identity did not match the enrolled staff profile. Try again in clear lighting or use Email OTP.',
        },
        { status: 401 }
      );
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
      method: 'face_liveness',
      similarity: Math.round(cmp.similarity * 10) / 10,
      livenessConfidence,
      mfaToken,
    });
  } catch {
    return NextResponse.json(
      { ok: false, verified: false, error: 'Live camera verification encountered an unexpected error.' },
      { status: 500 }
    );
  }
}
