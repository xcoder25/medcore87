import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { upsertStaff } from '../../../../lib/db/staffRepo';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      badgeId,
      facilityId,
      fullName,
      email,
      password,
      pin,
      role = 'Staff',
      roleKey = 'general_staff',
      title = 'Clinical Personnel',
      department = 'General Operations',
      facilityName = 'Hospital Facility',
      clearanceLevel = 1,
      clearanceLabel = 'Level 1 Personnel',
      templateKey = 'TPL_CLINICAL',
      photoUrl,
    } = body;

    const bId = String(badgeId || '').trim().toUpperCase();
    const fId = String(facilityId || 'DEFAULT-HOSPITAL').trim();
    const name = String(fullName || '').trim();

    if (!bId || !name) {
      return NextResponse.json(
        { success: false, error: 'badgeId and fullName are required' },
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

    // Determine primary auth email and password
    const authEmail = (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ? email.trim().toLowerCase()
      : `${bId.toLowerCase()}@medcore.internal`;
    const authPassword = String(password || pin || '123456');

    // 1. Create or update Auth User in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(authEmail);
      await adminAuth.updateUser(userRecord.uid, {
        displayName: name,
        password: authPassword,
      });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: authEmail,
          password: authPassword,
          displayName: name,
        });
      } else {
        throw e;
      }
    }

    // Multi-tenant facility isolation: Inject facility_id permanently as a Firebase Custom Claim
    // This allows AWS AppSync, API Gateway, and Aurora RLS to securely identify the tenant
    try {
      await adminAuth.setCustomUserClaims(userRecord.uid, {
        facility_id: fId,
        role: String(roleKey),
        badgeId: bId,
        clearanceLevel: Number(clearanceLevel) || 1,
      });
    } catch (claimsErr) {
      console.warn('[api/staff/create] Custom claims injection note:', claimsErr);
    }

    const initials = name
      .split(' ')
      .map((n: string) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'ST';

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const staffRecord: StaffCardRecord = {
      badgeId: bId,
      fullName: name,
      role: String(role),
      roleKey: String(roleKey),
      title: String(title),
      department: String(department),
      facilityId: fId,
      facilityName: String(facilityName),
      clearanceLevel: Number(clearanceLevel) || 1,
      clearanceLabel: String(clearanceLabel),
      templateKey: (templateKey as StaffCardTemplate) || 'TPL_CLINICAL',
      status: 'ACTIVE',
      issuedAt,
      expiresAt,
      photoUrl: photoUrl || null,
      initials,
      qrPayload: JSON.stringify({
        badgeId: bId,
        uid: userRecord.uid,
        facilityId: fId,
        issuedAt,
      }),
    };

    // 2. Persist to Aurora PostgreSQL (single source of truth with multi-tenant RLS)
    if (isPostgresConfigured()) {
      try {
        await upsertStaff({
          badgeId: bId,
          facilityId: fId,
          fullName: name,
          role: String(role),
          roleKey: String(roleKey),
          title: String(title),
          department: String(department),
          email: authEmail,
          clearanceLevel: Number(clearanceLevel) || 1,
          clearanceLabel: String(clearanceLabel),
          photoUrl: photoUrl || null,
          authEmail,
          pin: String(pin || authPassword),
          facilityName: String(facilityName),
        });
      } catch (pgErr) {
        console.warn('[api/staff/create] Postgres persistence error:', pgErr);
      }
    }

    // 3. Dispatch Staff Registered domain event (Database-First, Event-Second)
    try {
      const { dispatchStaffRegisteredEvent } = await import('../../../../lib/aws/domainEvents');
      await dispatchStaffRegisteredEvent(fId, {
        badgeId: bId,
        fullName: name,
        role: String(role),
        department: String(department),
        timestamp: issuedAt,
      });
    } catch {
      /* non-blocking */
    }

    return NextResponse.json(
      {
        success: true,
        uid: userRecord.uid,
        badgeId: bId,
        staff: staffRecord,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[api/staff/create] Staff creation failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Staff creation failed' },
      { status: 500 }
    );
  }
}
