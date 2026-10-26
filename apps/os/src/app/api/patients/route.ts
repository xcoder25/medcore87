import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../lib/db/postgres';
import { listPatients, upsertPatient } from '../../../lib/db/patientRepo';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, patients: [], error: 'Postgres not configured' },
      { status: 503 }
    );
  }
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  const q = req.nextUrl.searchParams.get('q') || undefined;
  if (!facilityId) {
    return NextResponse.json({ ok: false, error: 'facilityId required' }, { status: 400 });
  }
  try {
    const patients = await listPatients(facilityId, { q, limit: 100 });
    return NextResponse.json({ ok: true, configured: true, patients });
  } catch (e) {
    console.error('[api/patients GET]', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'list failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ ok: false, error: 'Postgres not configured' }, { status: 503 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const id = String(body.id || body.patientId || '').trim();
  const facilityId = String(body.facilityId || '').trim();
  const fullName = String(body.fullName || body.name || '').trim();
  if (!id || !facilityId || !fullName) {
    return NextResponse.json(
      { ok: false, error: 'id, facilityId, fullName required' },
      { status: 400 }
    );
  }
  try {
    const patient = await upsertPatient({
      id,
      facilityId,
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
      hospitalNumber: body.hospitalNumber ? String(body.hospitalNumber) : undefined,
      fullName,
      sex: body.sex ? String(body.sex) : undefined,
      dateOfBirth: body.dateOfBirth ? String(body.dateOfBirth) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      email: body.email ? String(body.email) : undefined,
      address: body.address ? String(body.address) : undefined,
      status: body.status ? String(body.status) : 'active',
      meta: typeof body.meta === 'object' && body.meta ? (body.meta as Record<string, unknown>) : undefined,
    });
    return NextResponse.json({ ok: true, patient });
  } catch (e) {
    console.error('[api/patients POST]', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'upsert failed' },
      { status: 500 }
    );
  }
}
