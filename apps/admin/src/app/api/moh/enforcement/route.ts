import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createEnforcementActionRecord,
  registerPrivateFacilityRecord,
  updateEnforcementActionRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get('district') || undefined;
    const snap = await buildLiveMohSnapshot({ district });
    return NextResponse.json({ ok: true, enforcement: snap.enforcement });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to load enforcement log.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (body.action === 'register_private') {
      if (!String(body.facilityName || '').trim() || !String(body.lga || '').trim()) {
        return NextResponse.json(
          { ok: false, error: 'facilityName and lga are required.' },
          { status: 400 }
        );
      }
      const facility = await registerPrivateFacilityRecord({
        facilityId: body.facilityId ? String(body.facilityId) : undefined,
        facilityName: String(body.facilityName),
        lga: String(body.lga),
        district: body.district,
        ownership: body.ownership,
        facilityType: body.facilityType ? String(body.facilityType) : undefined,
        licenseNo: body.licenseNo ? String(body.licenseNo) : undefined,
        licenseExpiry: body.licenseExpiry ? String(body.licenseExpiry) : undefined,
        approvedServices: Array.isArray(body.approvedServices)
          ? body.approvedServices.map((s: unknown) => String(s).trim()).filter(Boolean)
          : undefined,
        latitude: typeof body.latitude === 'number' ? body.latitude : undefined,
        longitude: typeof body.longitude === 'number' ? body.longitude : undefined,
        registeredBy: body.registeredBy ? String(body.registeredBy) : undefined,
      });
      return NextResponse.json({ ok: true, facility });
    }

    if (!String(body.facilityId || '').trim() || !String(body.reason || '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'facilityId and reason are required.' },
        { status: 400 }
      );
    }

    const record = await createEnforcementActionRecord({
      facilityId: String(body.facilityId),
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
      lga: body.lga ? String(body.lga) : undefined,
      district: body.district,
      actionType: body.actionType || 'inspection',
      reason: String(body.reason),
      checklist: Array.isArray(body.checklist) ? body.checklist : [],
      evidencePhotoData: body.evidencePhotoData ? String(body.evidencePhotoData) : undefined,
      officerName: String(body.officerName || 'MOH Enforcement Desk'),
      followUpDate: body.followUpDate ? String(body.followUpDate) : undefined,
    });

    return NextResponse.json({ ok: true, actionRecord: record });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to save enforcement action.' },
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
    const updated = await updateEnforcementActionRecord(id, {
      status: body.status,
      followUpDate: typeof body.followUpDate === 'string' ? body.followUpDate : undefined,
      resolutionNotes: typeof body.resolutionNotes === 'string' ? body.resolutionNotes : undefined,
      unsealFacility: Boolean(body.unsealFacility),
      updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy : undefined,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Enforcement action not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, actionRecord: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to update enforcement action.' },
      { status: 500 }
    );
  }
}
