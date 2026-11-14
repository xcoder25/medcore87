import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../lib/db/postgres';
import { deleteStaff, listStaff, upsertStaff } from '../../../lib/db/staffRepo';
import { getAdminAuth } from '../../../lib/firebaseAdmin';

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
        return NextResponse.json({ ok: true, configured: true, staff: staff || [] });
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
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Postgres not configured', configured: false },
      { status: 503 }
    );
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const badgeId = String(body.badgeId || '').trim().toUpperCase();
  const facilityId = String(body.facilityId || '').trim();
  const fullName = String(body.fullName || body.name || '').trim();
  if (!badgeId || !facilityId || !fullName) {
    return NextResponse.json(
      { ok: false, error: 'badgeId, facilityId, fullName required' },
      { status: 400 }
    );
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
      email: body.email ? String(body.email) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      status: body.status ? String(body.status) : 'active',
      clearanceLevel: typeof body.clearanceLevel === 'number' ? body.clearanceLevel : undefined,
      clearanceLabel: body.clearanceLabel ? String(body.clearanceLabel) : undefined,
      permissions: Array.isArray(body.permissions) ? (body.permissions as string[]) : undefined,
      photoUrl: body.photoUrl ? String(body.photoUrl) : undefined,
      pin: body.pin ? String(body.pin) : undefined,
      authEmail: body.authEmail ? String(body.authEmail) : undefined,
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
    });
    return NextResponse.json({ ok: true, staff: row });
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
