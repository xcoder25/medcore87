import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createCitizenGrievanceRecord,
  updateCitizenGrievanceRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get('district') || undefined;
    const snap = await buildLiveMohSnapshot({ district });
    return NextResponse.json({ ok: true, grievances: snap.grievances });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to load citizen grievances.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const facilityId = String(body.facilityId || '').trim();
    const summary = String(body.summary || '').trim();
    if (!facilityId || !summary) {
      return NextResponse.json(
        { ok: false, error: 'facilityId and summary are required.' },
        { status: 400 }
      );
    }
    const grievance = await createCitizenGrievanceRecord({
      facilityId,
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
      lga: body.lga ? String(body.lga) : undefined,
      channel: body.channel || 'qr',
      category: body.category || 'service_quality',
      rating: Number(body.rating ?? 3),
      summary,
      anonymous: body.anonymous !== false,
    });
    return NextResponse.json({ ok: true, grievance });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to submit feedback.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id is required.' }, { status: 400 });
    }
    const updated = await updateCitizenGrievanceRecord(id, {
      status: body.status,
      assignedTo: typeof body.assignedTo === 'string' ? body.assignedTo : undefined,
      resolutionNotes: typeof body.resolutionNotes === 'string' ? body.resolutionNotes : undefined,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Grievance ticket not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, grievance: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to update grievance status.' },
      { status: 500 }
    );
  }
}
