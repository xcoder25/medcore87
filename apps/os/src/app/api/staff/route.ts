import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../lib/db/postgres';
import { deleteStaff, listStaff, upsertStaff } from '../../../lib/db/staffRepo';
import { getAdminAuth } from '../../../lib/firebaseAdmin';
import { uploadDataUrlToS3IfNeeded } from '../../../lib/s3Server';
import { extractStaffCredentials } from '../../../lib/publicHospitalCompliance';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  if (!facilityId) {
    return NextResponse.json({ ok: false, error: 'facilityId required' }, { status: 400 });
  }

  // 1. Query Aurora PostgreSQL (single source of truth with multi-tenant RLS)
  if (isPostgresConfigured()) {
    try {
      const staff = await listStaff(facilityId);
      if (staff && staff.length > 0) {
        const enriched = staff.map((row) => ({
          ...row,
          ...extractStaffCredentials(row),
        }));
        return NextResponse.json({ ok: true, configured: true, staff: enriched });
      }
    } catch (e) {
      console.warn('[api/staff GET] Postgres error:', e);
    }
  }

  // 2. Fallback to Firebase Admin Auth so staff enrolled in Firebase Auth never disappear
  try {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      const listUsersRes = await adminAuth.listUsers(1000);
      const authStaff: any[] = [];
      const seenBadges = new Set<string>();

      for (const u of listUsersRes.users) {
        const claims = (u.customClaims || {}) as Record<string, unknown>;
        const uFacility = String(claims.facility_id || '').trim().toUpperCase();
        const fNorm = facilityId.toUpperCase();

        // If facilityId specified and user belongs to a different facility, skip
        if (uFacility && fNorm && uFacility !== fNorm) {
          continue;
        }

        // Determine badgeId from claims, email, or uid
        let badgeId = String(claims.badgeId || '').trim().toUpperCase();
        if (!badgeId && u.email?.startsWith('badge.')) {
          badgeId = u.email.replace(/^badge\./, '').replace(/@.*$/, '').toUpperCase();
        }
        if (!badgeId) {
          // If not a badge user, only include if explicitly tagged with staff claims
          if (!claims.role && !claims.facility_id) continue;
          badgeId = u.uid.slice(0, 12).toUpperCase();
        }
        if (!badgeId || seenBadges.has(badgeId)) continue;
        seenBadges.add(badgeId);

        const displayName = u.displayName || badgeId;
        const role = String(claims.role || 'Staff');
        const clearanceLevel = Number(claims.clearanceLevel) || 2;

        authStaff.push({
          badgeId,
          badge_id: badgeId,
          id: badgeId,
          fullName: displayName,
          full_name: displayName,
          name: displayName,
          role,
          roleKey: role.toLowerCase().replace(/\s+/g, '_'),
          title: role,
          department: 'Clinical Operations',
          clearanceLevel,
          clearance_level: clearanceLevel,
          clearanceLabel: `Level ${clearanceLevel} Clearance`,
          status: u.disabled ? 'suspended' : 'active',
          facilityId: uFacility || facilityId,
          hospitalId: uFacility || facilityId,
          email: u.email && !u.email.includes('firebaseapp.com') ? u.email : undefined,
          lastLogin: u.metadata?.lastSignInTime || '—',
          createdAt: u.metadata?.creationTime,
        });
      }

      if (authStaff.length > 0) {
        return NextResponse.json({
          ok: true,
          configured: isPostgresConfigured(),
          source: 'firebase_auth',
          staff: authStaff,
        });
      }
    }
  } catch (authErr) {
    console.warn('[api/staff GET] Firebase Auth fallback error:', authErr);
  }

  return NextResponse.json({ ok: true, configured: isPostgresConfigured(), staff: [] });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const badgeId = String(body.badgeId || '').trim().toUpperCase();
  const facilityId = String(body.facilityId || '').trim();
  const fullName = String(body.fullName || body.name || '').trim();
  const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : undefined;
  const rawPin = body.pin !== undefined && body.pin !== null ? String(body.pin).trim() : undefined;
  if (!badgeId || !facilityId || !fullName) {
    return NextResponse.json(
      { ok: false, error: 'badgeId, facilityId, fullName required' },
      { status: 400 }
    );
  }
  if (fullName.length < 3) {
    return NextResponse.json(
      { ok: false, error: 'Full name must be at least 3 characters.' },
      { status: 400 }
    );
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid work email address.' },
      { status: 400 }
    );
  }
  if (rawPin !== undefined && rawPin !== '' && !/^\d{6}$/.test(rawPin)) {
    return NextResponse.json(
      { ok: false, error: 'PIN must be an exact 6-digit numeric code.' },
      { status: 400 }
    );
  }

  const credMeta: Record<string, unknown> = {};
  if (body.employmentScheme !== undefined) {
    const es = String(body.employmentScheme || '').trim();
    credMeta.employmentScheme = es || null;
  }
  if (body.civilServiceId !== undefined) {
    const csId = String(body.civilServiceId || '').trim().toUpperCase();
    if (csId && csId.length < 4) {
      return NextResponse.json(
        { ok: false, error: 'Civil Service / IPPIS Staff ID must be at least 4 characters.' },
        { status: 400 }
      );
    }
    credMeta.civilServiceId = csId || null;
  }
  if (body.regulatoryBody !== undefined) {
    const rb = String(body.regulatoryBody || '').trim().toUpperCase();
    credMeta.regulatoryBody = rb || null;
  }
  if (body.practicingLicenseNo !== undefined) {
    const lic = String(body.practicingLicenseNo || '').trim().toUpperCase();
    if (lic && lic.length < 4) {
      return NextResponse.json(
        { ok: false, error: 'Practicing license number must be at least 4 characters.' },
        { status: 400 }
      );
    }
    credMeta.practicingLicenseNo = lic || null;
  }
  if (body.licenseExpiry !== undefined) {
    const exp = String(body.licenseExpiry || '').trim();
    if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      return NextResponse.json(
        { ok: false, error: 'License expiry date must use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }
    credMeta.licenseExpiry = exp || null;
  }

  let resolvedPhotoUrl: string | undefined = undefined;
  if (typeof body.photoUrl === 'string') {
    if (body.photoUrl.trim() === '') {
      resolvedPhotoUrl = '';
    } else {
      try {
        resolvedPhotoUrl = await uploadDataUrlToS3IfNeeded(body.photoUrl, {
          folder: 'staff',
          facilityId,
          filename: `${badgeId}-headshot.jpg`,
        });
      } catch (s3Err) {
        console.warn('[api/staff POST] S3 photo upload warning:', s3Err);
        resolvedPhotoUrl = body.photoUrl;
      }
    }
  }

  // Sync updated workEmail & displayName to Firebase Auth so OTP lookup works immediately
  try {
    const adminAuth = getAdminAuth();
    if (adminAuth && cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const idSlug = badgeId.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const badgeEmail = `badge.${idSlug}@naija-bites-1s3y1.firebaseapp.com`;
      const badgeUser = await adminAuth.getUserByEmail(badgeEmail).catch(() => null);
      if (badgeUser) {
        const prevClaims = (badgeUser.customClaims || {}) as Record<string, unknown>;
        await adminAuth.updateUser(badgeUser.uid, { displayName: fullName }).catch(() => {});
        await adminAuth.setCustomUserClaims(badgeUser.uid, {
          ...prevClaims,
          facility_id: prevClaims.facility_id || facilityId,
          badgeId,
          workEmail: cleanEmail,
        });
      }
      const emailUser = await adminAuth.getUserByEmail(cleanEmail).catch(() => null);
      if (emailUser) {
        const prevClaims = (emailUser.customClaims || {}) as Record<string, unknown>;
        await adminAuth.setCustomUserClaims(emailUser.uid, {
          ...prevClaims,
          facility_id: prevClaims.facility_id || facilityId,
          badgeId,
          workEmail: cleanEmail,
        });
      }
    }
  } catch (fbErr) {
    console.warn('[api/staff POST] Firebase claim sync warning:', fbErr);
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      syncedFirebase: true,
      photoUrl: resolvedPhotoUrl,
    });
  }

  try {
    const row = await upsertStaff({
      badgeId,
      facilityId,
      fullName,
      role: body.role ? String(body.role) : undefined,
      roleKey: body.roleKey ? String(body.roleKey) : undefined,
      title: body.title ? String(body.title) : undefined,
      department: body.department ? String(body.department) : undefined,
      email: cleanEmail,
      phone: body.phone ? String(body.phone) : undefined,
      status: body.status ? String(body.status) : 'active',
      clearanceLevel: typeof body.clearanceLevel === 'number' ? body.clearanceLevel : undefined,
      clearanceLabel: body.clearanceLabel ? String(body.clearanceLabel) : undefined,
      permissions: Array.isArray(body.permissions) ? (body.permissions as string[]) : undefined,
      photoUrl: resolvedPhotoUrl,
      pin: rawPin || undefined,
      authEmail: body.authEmail ? String(body.authEmail) : undefined,
      meta: Object.keys(credMeta).length > 0 ? credMeta : undefined,
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
    });
    return NextResponse.json({
      ok: true,
      staff: { ...row, ...extractStaffCredentials(row) },
    });
  } catch (e) {
    console.error('[api/staff POST]', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'upsert failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ ok: false, error: 'Postgres not configured' }, { status: 503 });
  }
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  const badgeId = (req.nextUrl.searchParams.get('badgeId') || '').trim().toUpperCase();
  if (!facilityId || !badgeId) {
    return NextResponse.json({ ok: false, error: 'facilityId and badgeId required' }, { status: 400 });
  }
  try {
    const deleted = await deleteStaff(facilityId, badgeId);
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'delete failed' },
      { status: 500 }
    );
  }
}
