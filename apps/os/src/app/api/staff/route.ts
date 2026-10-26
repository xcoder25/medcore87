import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../lib/db/postgres';
import { deleteStaff, listStaff, upsertStaff } from '../../../lib/db/staffRepo';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Postgres not configured', configured: false, staff: [] },
      { status: 503 }
    );
  }
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  if (!facilityId) {
    return NextResponse.json({ ok: false, error: 'facilityId required' }, { status: 400 });
  }
  try {
    const staff = await listStaff(facilityId);
    return NextResponse.json({ ok: true, configured: true, staff });
  } catch (e) {
    console.error('[api/staff GET]', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'list failed' },
      { status: 500 }
    );
  }
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
