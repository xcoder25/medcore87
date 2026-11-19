import { NextRequest, NextResponse } from 'next/server';
import { hasExistingFacilityAdmin } from '../../../../lib/facilityAdminCheck';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FACILITY_ID_RE = /^[A-Z0-9-]{2,32}$/;

/**
 * GET /api/auth/facility-status?facilityId=IGH-EKT
 * Public unclaimed-facility check for `/reg` onboarding. Returns only a boolean (`hasAdmin`)
 * with zero staff PII so `/reg` never calls protected `/api/staff`.
 */
export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`facility-status:${getClientIp(req.headers)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please wait a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      }
    );
  }

  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim().toUpperCase();
  if (!FACILITY_ID_RE.test(facilityId)) {
    return NextResponse.json(
      { ok: false, error: 'Valid facilityId is required (2–32 alphanumeric/hyphen characters).' },
      { status: 400 }
    );
  }

  try {
    const { hasAdmin } = await hasExistingFacilityAdmin(facilityId);
    return NextResponse.json({
      ok: true,
      facilityId,
      hasAdmin,
    });
  } catch (err) {
    console.error('[api/auth/facility-status] failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Unable to verify facility status.' },
      { status: 500 }
    );
  }
}
