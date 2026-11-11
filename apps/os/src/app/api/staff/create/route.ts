import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { upsertStaff } from '../../../../lib/db/staffRepo';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

export const runtime = 'nodejs';

function badgeAuthEmail(badgeId: string): string {
  const id = (badgeId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

function normalizeStaffPin(pin: string): string {
  const p = (pin || '').trim();
  if (p.length >= 6) return p;
  return (p + '000000').slice(0, 6);
}

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

    // 1. Create or update Badge Auth User in Firebase Auth (for Staff ID + PIN sign in)
    const badgeEmail = badgeAuthEmail(bId);
    const badgePin = normalizeStaffPin(String(pin || password || '123456'));
    let badgeUserRecord;
    try {
      badgeUserRecord = await adminAuth.getUserByEmail(badgeEmail);
      await adminAuth.updateUser(badgeUserRecord.uid, {
        displayName: name,
        password: badgePin,
      });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        badgeUserRecord = await adminAuth.createUser({
          email: badgeEmail,
          password: badgePin,
          displayName: name,
        });
      } else {
        console.warn('[api/staff/create] Badge account create warning:', e);
      }
    }

    if (badgeUserRecord) {
      try {
        await adminAuth.setCustomUserClaims(badgeUserRecord.uid, {
          facility_id: fId,
          role: String(roleKey),
          badgeId: bId,
          clearanceLevel: Number(clearanceLevel) || 1,
        });
      } catch (claimsErr) {
        console.warn('[api/staff/create] Badge custom claims error:', claimsErr);
      }
    }

    // 2. If valid email provided, create/update Email Auth User in Firebase Auth (for Email + Password sign in)
    let emailUserRecord;
    const hasWorkEmail = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (hasWorkEmail) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = String(password || pin || '123456');
      try {
        emailUserRecord = await adminAuth.getUserByEmail(cleanEmail);
        await adminAuth.updateUser(emailUserRecord.uid, {
          displayName: name,
          password: cleanPassword,
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          emailUserRecord = await adminAuth.createUser({
            email: cleanEmail,
            password: cleanPassword,
            displayName: name,
          });
        } else {
          console.warn('[api/staff/create] Email account create warning:', e);
        }
      }

      if (emailUserRecord) {
        try {
          await adminAuth.setCustomUserClaims(emailUserRecord.uid, {
            facility_id: fId,
            role: String(roleKey),
            badgeId: bId,
            clearanceLevel: Number(clearanceLevel) || 1,
          });
        } catch (claimsErr) {
          console.warn('[api/staff/create] Email custom claims error:', claimsErr);
        }
      }
    }

    const primaryUid = badgeUserRecord?.uid || emailUserRecord?.uid || bId;

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
        uid: primaryUid,
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
          email: hasWorkEmail ? email.trim().toLowerCase() : undefined,
          clearanceLevel: Number(clearanceLevel) || 1,
          clearanceLabel: String(clearanceLabel),
          photoUrl: photoUrl || null,
          authEmail: badgeEmail,
          pin: String(pin || password || '1234'),
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
        uid: primaryUid,
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
