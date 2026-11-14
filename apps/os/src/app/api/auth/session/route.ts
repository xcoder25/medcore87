import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
} from '../../../../lib/serverSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session — Verify current HttpOnly session cookie.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false, session: null });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    session,
  });
}

/**
 * POST /api/auth/session — Issue a cryptographically signed HttpOnly session cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const badgeId = String(body.badgeId || body.id || '').trim();
    const name = String(body.name || 'Staff').trim();
    const roleKey = String(body.roleKey || 'staff').trim().toLowerCase();
    const role = String(body.role || 'Staff').trim();
    const facilityId = String(body.facilityId || body.hospitalId || 'IGH-EKT').trim().toUpperCase();
    const clearanceLevel = Number(body.clearanceLevel || 1);

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'badgeId required' }, { status: 400 });
    }

    const token = await signSessionToken({
      badgeId,
      name,
      roleKey,
      role,
      facilityId,
      clearanceLevel,
    });

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      facilityId,
      roleKey,
      clearanceLevel,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 3600,
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

/**
 * DELETE /api/auth/session — Clear the HttpOnly session cookie on logout.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true, authenticated: false });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
