import { NextRequest, NextResponse } from 'next/server';
import {
  createFaceLivenessSession,
  getRekognitionConfig,
  getTemporaryLivenessCredentials,
  isRekognitionAuthError,
  toSafeBiometricError,
} from '../../../../../../lib/aws/rekognitionServer';
import {
  getStoredBiometric,
  issueSignedLivenessToken,
  verifySignedLivenessToken,
} from '../../../../../../lib/biometricVaultServer';
import { checkRateLimit, getClientIp } from '../../../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create a live camera anti-spoofing session (`CreateFaceLivenessSession`) when
 * cloud liveness is enabled and STS role credentials can be minted.
 * Returns `{ available: false }` gracefully when running locally or unconfigured.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const rawMode = String(body.mode || 'verify').trim();
    const mode: 'enroll' | 'verify' = rawMode === 'enroll' ? 'enroll' : 'verify';

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'badgeId is required.' }, { status: 400 });
    }

    const rl = checkRateLimit(`liveness-sess:${ip}:${badgeId}`, 20, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: `Too many live camera verification sessions. Wait ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    if (mode === 'verify') {
      const existing = await getStoredBiometric(facilityId, badgeId);
      if (!existing?.face) {
        return NextResponse.json(
          { ok: false, error: 'No facial biometric is enrolled for this staff member.' },
          { status: 404 }
        );
      }
    }

    const cfg = getRekognitionConfig();
    if (!cfg.isConfigured || !cfg.livenessSessionEnabled || !cfg.canMintLivenessCredentials) {
      return NextResponse.json({ ok: true, available: false });
    }

    try {
      const sess = await createFaceLivenessSession();
      if (!sess.sessionId) {
        return NextResponse.json({ ok: true, available: false });
      }
      const livenessToken = issueSignedLivenessToken({
        sessionId: sess.sessionId,
        badgeId,
        facilityId,
        mode,
      });
      return NextResponse.json({
        ok: true,
        available: true,
        sessionId: sess.sessionId,
        region: sess.region,
        livenessToken,
      });
    } catch (err) {
      if (isRekognitionAuthError(err)) {
        return NextResponse.json({ ok: true, available: false });
      }
      return NextResponse.json(
        { ok: false, error: toSafeBiometricError(err) },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not initialize live camera verification session.' },
      { status: 500 }
    );
  }
}

/**
 * Exchange a signed `livenessToken` for short-lived STS credentials scoped solely
 * to starting the live camera anti-spoofing stream (no Cognito pool required).
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const livenessToken = String(req.nextUrl.searchParams.get('livenessToken') || '').trim();
  const parsed = verifySignedLivenessToken(livenessToken);
  if (!parsed.ok || !parsed.badgeId) {
    return NextResponse.json(
      { ok: false, error: parsed.error || 'Invalid or expired live liveness token.' },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`liveness-creds:${ip}:${parsed.badgeId}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many temporary credential requests. Wait ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    const creds = await getTemporaryLivenessCredentials();
    return NextResponse.json(
      { ok: true, ...creds },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toSafeBiometricError(err) },
      { status: 502 }
    );
  }
}
