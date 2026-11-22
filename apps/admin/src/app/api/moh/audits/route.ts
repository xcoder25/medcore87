import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createMohAuditRecord,
  updateMohAuditRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await buildLiveMohSnapshot();
    return NextResponse.json({ ok: true, audits: snap.audits });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to load audits.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const facilityId = String(body.facilityId || '').trim();
    const facilityName = String(body.facilityName || facilityId).trim();
    const auditDate = String(body.auditDate || '').trim();
    const auditorName = String(body.auditorName || '').trim();
    const category = String(body.category || 'clinical_safety').trim();

    if (!facilityId || !auditDate || !auditorName) {
      return NextResponse.json(
        { ok: false, error: 'facilityId, auditDate, and auditorName are required.' },
        { status: 400 }
      );
    }

    const audit = await createMohAuditRecord({
      facilityId,
      facilityName,
      auditDate,
      auditorName,
      category,
      resolutionDeadline: String(body.resolutionDeadline || ''),
      notes: String(body.notes || ''),
    });
    return NextResponse.json({ ok: true, audit });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to schedule audit.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Audit id is required.' }, { status: 400 });
    }
    const audit = await updateMohAuditRecord(id, {
      status: body.status as any,
      findingsCount: typeof body.findingsCount === 'number' ? body.findingsCount : undefined,
      criticalViolations: typeof body.criticalViolations === 'number' ? body.criticalViolations : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    if (!audit) {
      return NextResponse.json({ ok: false, error: 'Audit record not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, audit });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error)?.message || 'Failed to update audit.' }, { status: 500 });
  }
}
