import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../lib/db/postgres';
import { deleteStaff, listStaff, upsertStaff } from '../../../lib/db/staffRepo';
import { getAdminFirestore } from '../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  if (!facilityId) {
    return NextResponse.json({ ok: false, error: 'facilityId required' }, { status: 400 });
  }

  // 1. Check Postgres if configured
  if (isPostgresConfigured()) {
    try {
      const staff = await listStaff(facilityId);
      if (staff && staff.length > 0) {
        return NextResponse.json({ ok: true, configured: true, staff });
      }
    } catch (e) {
      console.warn('[api/staff GET] Postgres error:', e);
    }
  }

  // 2. Fallback to Firestore Admin
  try {
    const adminDb = getAdminFirestore();
    if (adminDb) {
      const fidNormalized = facilityId.replace(/[\/#?]/g, '_');
      const snap = await adminDb
        .collection('facilities')
        .doc(fidNormalized)
        .collection('staff')
        .get();

      if (!snap.empty) {
        const staff = snap.docs.map((d) => ({ badgeId: d.id, ...d.data() }));
        return NextResponse.json({ ok: true, configured: false, staff });
      }

      // Check facility root doc for staffCards
      const facSnap = await adminDb.collection('facilities').doc(fidNormalized).get();
      if (facSnap.exists) {
        const d = facSnap.data() || {};
        const staff = Array.isArray(d.staffCards) ? d.staffCards : [];
        return NextResponse.json({ ok: true, configured: false, staff });
      }
    }
  } catch (fsErr) {
    console.warn('[api/staff GET] Firestore fallback error:', fsErr);
  }

  return NextResponse.json({ ok: true, configured: false, staff: [] });
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
