import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createMohTransferRecord,
  updateMohTransferRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await buildLiveMohSnapshot();
    return NextResponse.json({ ok: true, transfers: snap.transfers });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to load transfers.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const staffName = String(body.staffName || '').trim();
    const fromFacilityId = String(body.fromFacilityId || '').trim();
    const toFacilityId = String(body.toFacilityId || '').trim();
    if (!staffName || !fromFacilityId || !toFacilityId) {
      return NextResponse.json(
        { ok: false, error: 'staffName, fromFacilityId, and toFacilityId are required.' },
        { status: 400 }
      );
    }

    const transfer = await createMohTransferRecord({
      staffBadge: String(body.staffBadge || ''),
      staffName,
      cadre: String(body.cadre || 'Clinical Staff'),
      fromFacilityId,
      fromFacilityName: String(body.fromFacilityName || fromFacilityId),
      toFacilityId,
      toFacilityName: String(body.toFacilityName || toFacilityId),
      transferType: body.transferType as any,
      urgency: body.urgency as any,
      reason: String(body.reason || 'Regional staffing mutual aid'),
      requestedBy: String(body.requestedBy || 'MOH Workforce Desk'),
    });
    return NextResponse.json({ ok: true, transfer });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to create transfer.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim() as 'pending' | 'approved' | 'declined' | 'completed';
    const decidedBy = String(body.decidedBy || 'Commissioner for Health').trim();
    if (!id || !['pending', 'approved', 'declined', 'completed'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Valid transfer id and status are required.' }, { status: 400 });
    }
    const transfer = await updateMohTransferRecord(id, status, decidedBy);
    if (!transfer) {
      return NextResponse.json({ ok: false, error: 'Transfer record not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, transfer });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to update transfer.' }, { status: 500 });
  }
}
