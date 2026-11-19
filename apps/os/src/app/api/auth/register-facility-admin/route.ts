import { NextRequest, NextResponse } from 'next/server';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { upsertStaff } from '../../../../lib/db/staffRepo';
import { hasExistingFacilityAdmin } from '../../../../lib/facilityAdminCheck';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FACILITY_ID_RE = /^[A-Z0-9-]{2,32}$/;
const BADGE_ID_RE = /^[A-Z0-9-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{6}$/;

function badgeAuthEmail(badgeId: string): string {
  const id = (badgeId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

async function firebaseUserExists(
  adminAuth: NonNullable<ReturnType<typeof getAdminAuth>>,
  email: string
): Promise<boolean> {
  try {
    await adminAuth.getUserByEmail(email);
    return true;
  } catch (err: any) {
    const code = String(err?.code || '');
    if (code.includes('user-not-found')) return false;
    throw err;
  }
}

/**
 * POST /api/auth/register-facility-admin
 * Public self-onboarding endpoint strictly restricted to unclaimed facilities (0 active L5 admins).
 * Rejects with 409 Conflict if the facility already has an admin or if badge/email already exists.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(
    `register-facility-admin:${getClientIp(request.headers)}`,
    5,
    15 * 60_000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many enrollment attempts. Please wait and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fId = String(body.facilityId || '').trim().toUpperCase();
    const bId = String(body.badgeId || '').trim().toUpperCase();
    const name = String(body.fullName || '').trim();
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const cleanPin = String(body.pin || '').trim();
    const facilityName = String(body.facilityName || fId).trim() || fId;

    if (!FACILITY_ID_RE.test(fId)) {
      return NextResponse.json(
        { success: false, error: 'Valid facilityId is required.' },
        { status: 400 }
      );
    }
    if (!BADGE_ID_RE.test(bId)) {
      return NextResponse.json(
        { success: false, error: 'Valid badgeId is required.' },
        { status: 400 }
      );
    }
    if (name.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Full name must be at least 3 characters.' },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'A valid official work email is required.' },
        { status: 400 }
      );
    }
    if (!PIN_RE.test(cleanPin)) {
      return NextResponse.json(
        { success: false, error: 'PIN must be exactly 6 digits.' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin Auth is not initialized' },
        { status: 503 }
      );
    }

    // Security gate 1: facility must still be unclaimed
    const { hasAdmin } = await hasExistingFacilityAdmin(fId);
    if (hasAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This facility already has a registered Hospital Administrator. Please sign in as an administrator to manage staff.',
        },
        { status: 409 }
      );
    }

    // Security gate 2: never overwrite existing Firebase Auth badge or email users
    const badgeEmail = badgeAuthEmail(bId);
    const [badgeTaken, emailTaken] = await Promise.all([
      firebaseUserExists(adminAuth, badgeEmail),
      firebaseUserExists(adminAuth, cleanEmail),
    ]);
    if (badgeTaken || emailTaken) {
      return NextResponse.json(
        {
          success: false,
          error:
            'An account with this work email or badge ID already exists. Sign in or choose another work email.',
        },
        { status: 409 }
      );
    }

    const claims = {
      facility_id: fId,
      role: 'hospital_admin',
      badgeId: bId,
      clearanceLevel: 5,
      workEmail: cleanEmail,
    };

    const badgeUserRecord = await adminAuth.createUser({
      email: badgeEmail,
      password: cleanPin,
      displayName: name,
    });
    await adminAuth.setCustomUserClaims(badgeUserRecord.uid, claims);

    let emailUserRecord;
    try {
      emailUserRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: cleanPin,
        displayName: name,
      });
      await adminAuth.setCustomUserClaims(emailUserRecord.uid, claims);
    } catch (emailErr) {
      await adminAuth.deleteUser(badgeUserRecord.uid).catch(() => {});
      console.error('[api/auth/register-facility-admin] Failed creating email user:', emailErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create administrator email account. Please try again.',
        },
        { status: 500 }
      );
    }

    const primaryUid = badgeUserRecord.uid || emailUserRecord.uid || bId;
    const initials =
      name
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'AD';

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const staffRecord: StaffCardRecord = {
      badgeId: bId,
      fullName: name,
      role: 'Hospital Administrator',
      roleKey: 'hospital_admin',
      title: 'Hospital Administrator',
      department: 'Hospital Management',
      facilityId: fId,
      facilityName,
      clearanceLevel: 5,
      clearanceLabel: 'Administrator',
      templateKey: 'TPL_CLINICAL' as StaffCardTemplate,
      status: 'ACTIVE',
      issuedAt,
      expiresAt,
      photoUrl: undefined,
      initials,
      qrPayload: JSON.stringify({
        badgeId: bId,
        uid: primaryUid,
        facilityId: fId,
        issuedAt,
      }),
    };

    if (isPostgresConfigured()) {
      try {
        await upsertStaff({
          badgeId: bId,
          facilityId: fId,
          fullName: name,
          role: 'Hospital Administrator',
          roleKey: 'hospital_admin',
          title: 'Hospital Administrator',
          department: 'Hospital Management',
          email: cleanEmail,
          clearanceLevel: 5,
          clearanceLabel: 'Administrator',
          permissions: ['*'],
          pin: cleanPin,
          authEmail: badgeEmail,
          facilityName,
        });
      } catch (pgErr) {
        console.warn('[api/auth/register-facility-admin] Postgres persistence error:', pgErr);
      }
    }

    try {
      const { dispatchStaffRegisteredEvent } = await import('../../../../lib/aws/domainEvents');
      await dispatchStaffRegisteredEvent(fId, {
        badgeId: bId,
        fullName: name,
        role: 'Hospital Administrator',
        department: 'Hospital Management',
        timestamp: issuedAt,
      });
    } catch {
      /* non-blocking */
    }

    return NextResponse.json(
      {
        success: true,
        uid: primaryUid,
        badgeId: bId,
        staff: staffRecord,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[api/auth/register-facility-admin] failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Enrollment failed' },
      { status: 500 }
    );
  }
}
