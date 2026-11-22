import { NextRequest, NextResponse } from 'next/server';
import { upsertOrToggleMohAlertRecord } from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const condition = String(body.condition || '').trim();
    if (!condition) {
      return NextResponse.json({ ok: false, error: 'Alert condition name is required.' }, { status: 400 });
    }
    const alert = await upsertOrToggleMohAlertRecord({
      condition,
      icd10Category: String(body.icd10Category || ''),
      detectedCases: Number(body.detectedCases || 1),
      rateOfIncrease: Number(body.rateOfIncrease || 0),
      affectedDistricts: Array.isArray(body.affectedDistricts) ? body.affectedDistricts.map(String) : undefined,
      severity: (body.severity as any) || 'warning',
      reportingFacilities: Number(body.reportingFacilities || 1),
      notes: String(body.notes || ''),
    });
    return NextResponse.json({ ok: true, alert });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to issue epidemiological alert.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Alert id is required.' }, { status: 400 });
    }
    const alert = await upsertOrToggleMohAlertRecord({
      id,
      toggleContainment: true,
    });
    if (!alert) {
      return NextResponse.json({ ok: false, error: 'Alert not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, alert });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to update alert containment status.' }, { status: 500 });
  }
}
