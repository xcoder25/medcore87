import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createIdsrReportRecord,
  updateIdsrReportRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get('district') || undefined;
    const snap = await buildLiveMohSnapshot({ district });
    return NextResponse.json({ ok: true, idsr: snap.idsr });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to load IDSR & service metrics.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const reportKind = body.reportKind === 'service_utilization' ? 'service_utilization' : 'dsno_outbreak';
    if (!String(body.lga || '').trim() && !String(body.facilityId || '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'lga or facilityId is required.' },
        { status: 400 }
      );
    }
    if (reportKind === 'dsno_outbreak' && !String(body.disease || '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'disease is required for DSNO outbreak alerts.' },
        { status: 400 }
      );
    }
    const report = await createIdsrReportRecord({
      reportKind,
      facilityId: body.facilityId ? String(body.facilityId) : undefined,
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
      lga: String(body.lga || 'Uyo'),
      district: body.district,
      periodLabel: body.periodLabel ? String(body.periodLabel) : undefined,
      disease: body.disease ? String(body.disease) : undefined,
      suspectedCases: Number(body.suspectedCases || 0),
      confirmedCases: Number(body.confirmedCases || 0),
      deaths: Number(body.deaths || 0),
      ancVisits: Number(body.ancVisits || 0),
      skilledDeliveries: Number(body.skilledDeliveries || 0),
      immunizationDoses: Number(body.immunizationDoses || 0),
      emergencyReferrals: Number(body.emergencyReferrals || 0),
      maternalDeaths: Number(body.maternalDeaths || 0),
      under5Deaths: Number(body.under5Deaths || 0),
      dsnoOfficer: body.dsnoOfficer ? String(body.dsnoOfficer) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to save IDSR/service report.' },
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
    const updated = await updateIdsrReportRecord(id, {
      status: body.status,
      confirmedCases: typeof body.confirmedCases === 'number' ? body.confirmedCases : undefined,
      deaths: typeof body.deaths === 'number' ? body.deaths : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'IDSR report not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, report: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to update IDSR report.' },
      { status: 500 }
    );
  }
}
