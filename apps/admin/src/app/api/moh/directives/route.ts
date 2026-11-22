import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createMohDirectiveRecord,
  updateMohDirectiveRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await buildLiveMohSnapshot();
    return NextResponse.json({ ok: true, directives: snap.directives });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to load directives.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const summary = String(body.summary || '').trim();
    if (!title || !summary) {
      return NextResponse.json({ ok: false, error: 'Directive title and summary are required.' }, { status: 400 });
    }
    const directive = await createMohDirectiveRecord({
      title,
      summary,
      category: String(body.category || 'clinical_governance'),
      severity: body.severity as any,
      targetDistricts: Array.isArray(body.targetDistricts) ? body.targetDistricts.map(String) : undefined,
      targetTiers: Array.isArray(body.targetTiers) ? body.targetTiers.map(String) : undefined,
      mandatoryActions: Array.isArray(body.mandatoryActions) ? body.mandatoryActions.map(String) : undefined,
      effectiveUntil: String(body.effectiveUntil || ''),
      issuedBy: String(body.issuedBy || 'Commissioner for Health'),
    });
    return NextResponse.json({ ok: true, directive });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to broadcast directive.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim() as 'active' | 'completed';
    if (!id || !['active', 'completed'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Valid directive id and status are required.' }, { status: 400 });
    }
    const directive = await updateMohDirectiveRecord(id, status);
    if (!directive) {
      return NextResponse.json({ ok: false, error: 'Directive not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, directive });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to update directive.' }, { status: 500 });
  }
}
