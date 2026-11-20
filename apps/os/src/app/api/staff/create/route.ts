import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { upsertStaff } from '../../../../lib/db/staffRepo';
import { uploadDataUrlToS3IfNeeded } from '../../../../lib/s3Server';
import { extractStaffCredentials } from '../../../../lib/publicHospitalCompliance';
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
      employmentScheme,
      civilServiceId,
      regulatoryBody,
      practicingLicenseNo,
      licenseExpiry,
    } = body;

    const bId = String(badgeId || '').trim().toUpperCase();
    const fId = String(facilityId || 'DEFAULT-HOSPITAL').trim();
    const name = String(fullName || '').trim();
    const rawPin = String(pin || password || '').trim();
    const cleanWorkEmail = email ? String(email).trim().toLowerCase() : undefined;

    if (!bId || !name) {
      return NextResponse.json(
        { success: false, error: 'badgeId and fullName are required' },
        { status: 400 }
      );
    }
    if (name.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Full name must be at least 3 characters.' },
        { status: 400 }
      );
    }
    if (!cleanWorkEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanWorkEmail)) {
      return NextResponse.json(
        { success: false, error: 'A valid official work email is required.' },
        { status: 400 }
      );
    }
    if (!/^\d{6}$/.test(rawPin)) {
      return NextResponse.json(
        { success: false, error: 'Sign-in PIN must be an exact 6-digit numeric code.' },
        { status: 400 }
      );
    }

    const cleanScheme = employmentScheme ? String(employmentScheme).trim() : undefined;
    const cleanCivilId = civilServiceId ? String(civilServiceId).trim().toUpperCase() : undefined;
    const cleanRegBody = regulatoryBody ? String(regulatoryBody).trim().toUpperCase() : undefined;
    const cleanLicenseNo = practicingLicenseNo ? String(practicingLicenseNo).trim().toUpperCase() : undefined;
    const cleanLicenseExpiry = licenseExpiry ? String(licenseExpiry).trim() : undefined;

    if (cleanCivilId && cleanCivilId.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Civil Service / IPPIS Staff ID must be at least 4 characters.' },
        { status: 400 }
      );
    }
    if (cleanLicenseNo && cleanLicenseNo.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Practicing license number must be at least 4 characters.' },
        { status: 400 }
      );
    }
    if (cleanLicenseExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(cleanLicenseExpiry)) {
      return NextResponse.json(
        { success: false, error: 'License expiry date must use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    const credMeta: Record<string, unknown> = {
      ...(cleanScheme ? { employmentScheme: cleanScheme } : {}),
      ...(cleanCivilId ? { civilServiceId: cleanCivilId } : {}),
      ...(cleanRegBody ? { regulatoryBody: cleanRegBody } : {}),
      ...(cleanLicenseNo ? { practicingLicenseNo: cleanLicenseNo } : {}),
      ...(cleanLicenseExpiry ? { licenseExpiry: cleanLicenseExpiry } : {}),
    };

    let resolvedPhotoUrl: string | undefined;
    try {
      resolvedPhotoUrl = await uploadDataUrlToS3IfNeeded(
        typeof photoUrl === 'string' ? photoUrl : undefined,
        { folder: 'staff', facilityId: fId, filename: `${bId}-headshot.jpg` }
      );
    } catch (s3Err) {
      console.warn('[api/staff/create] S3 photo upload warning:', s3Err);
      resolvedPhotoUrl = typeof photoUrl === 'string' && photoUrl ? photoUrl : undefined;
    }

    const adminAuth = getAdminAuth();

    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: 'Authentication service is not initialized.' },
        { status: 503 }
      );
    }

    // 1. Create or update Badge Auth User in Firebase Auth (for Staff ID + PIN sign in)
    const badgeEmail = badgeAuthEmail(bId);
    const badgePin = rawPin;
    let badgeUserRecord;
    try {
      badgeUserRecord = await adminAuth.getUserByEmail(badgeEmail);
      await adminAuth.updateUser(badgeUserRecord.uid, {
        displayName: name,
        password: badgePin,
      });
    } catch (e: any) {
      const code = String(e?.code || '');
      if (code.includes('user-not-found') || !badgeUserRecord) {
        try {
          badgeUserRecord = await adminAuth.createUser({
            email: badgeEmail,
            password: badgePin,
            displayName: name,
          });
        } catch (createErr: any) {
          const cCode = String(createErr?.code || '');
          if (cCode.includes('email-already-exists')) {
            try {
              badgeUserRecord = await adminAuth.getUserByEmail(badgeEmail);
              await adminAuth.updateUser(badgeUserRecord.uid, {
                displayName: name,
                password: badgePin,
              });
            } catch (upErr) {
              console.warn('[api/staff/create] Could not update existing badge user:', upErr);
            }
          } else {
            console.warn('[api/staff/create] Badge account create error:', createErr);
          }
        }
      } else {
        console.warn('[api/staff/create] Badge account create warning:', e);
      }
    }

    const hasWorkEmail = Boolean(cleanWorkEmail);

    if (badgeUserRecord) {
      try {
        await adminAuth.setCustomUserClaims(badgeUserRecord.uid, {
          facility_id: fId,
          role: String(roleKey),
          badgeId: bId,
          clearanceLevel: Number(clearanceLevel) || 1,
          ...(cleanWorkEmail ? { workEmail: cleanWorkEmail } : {}),
        });
      } catch (claimsErr) {
        console.warn('[api/staff/create] Badge custom claims error:', claimsErr);
      }
    }

    // 2. If valid email provided, create/update Email Auth User in Firebase Auth (for Email + Password sign in)
    let emailUserRecord;
    if (hasWorkEmail) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = badgePin;
      try {
        emailUserRecord = await adminAuth.getUserByEmail(cleanEmail);
        await adminAuth.updateUser(emailUserRecord.uid, {
          displayName: name,
          password: cleanPassword,
        });
      } catch (e: any) {
        const code = String(e?.code || '');
        if (code.includes('user-not-found') || !emailUserRecord) {
          try {
            emailUserRecord = await adminAuth.createUser({
              email: cleanEmail,
              password: cleanPassword,
              displayName: name,
            });
          } catch (createErr: any) {
            const cCode = String(createErr?.code || '');
            if (cCode.includes('email-already-exists')) {
              try {
                emailUserRecord = await adminAuth.getUserByEmail(cleanEmail);
                await adminAuth.updateUser(emailUserRecord.uid, {
                  displayName: name,
                  password: cleanPassword,
                });
              } catch (upErr) {
                console.warn('[api/staff/create] Could not update existing email user:', upErr);
              }
            } else {
              console.warn('[api/staff/create] Email account create error:', createErr);
            }
          }
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
      photoUrl: resolvedPhotoUrl || undefined,
      ...(cleanScheme ? { employmentScheme: cleanScheme } : {}),
      ...(cleanCivilId ? { civilServiceId: cleanCivilId } : {}),
      ...(cleanRegBody ? { regulatoryBody: cleanRegBody } : {}),
      ...(cleanLicenseNo ? { practicingLicenseNo: cleanLicenseNo } : {}),
      ...(cleanLicenseExpiry ? { licenseExpiry: cleanLicenseExpiry } : {}),
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
          email: cleanWorkEmail,
          clearanceLevel: Number(clearanceLevel) || 1,
          clearanceLabel: String(clearanceLabel),
          photoUrl: resolvedPhotoUrl,
          authEmail: badgeEmail,
          pin: rawPin,
          meta: Object.keys(credMeta).length > 0 ? credMeta : undefined,
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
        staff: { ...staffRecord, ...extractStaffCredentials({ ...staffRecord, meta: credMeta }) },
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
