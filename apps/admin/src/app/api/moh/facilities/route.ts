import { NextRequest, NextResponse } from 'next/server';
import { updateMohFacilityOverrideRecord } from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const facilityId = String(body.facilityId || '').trim();
    if (!facilityId) {
      return NextResponse.json({ ok: false, error: 'facilityId is required.' }, { status: 400 });
    }
    await updateMohFacilityOverrideRecord({
      facilityId,
      emergencyStatus: body.emergencyStatus as any,
      accreditationStatus: body.accreditationStatus as any,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy : undefined,
    });
    return NextResponse.json({ ok: true, facilityId: facilityId.toUpperCase() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to update facility status.' }, { status: 500 });
  }
}
