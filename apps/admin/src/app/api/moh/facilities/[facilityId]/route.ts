import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveFacilityDossier,
  sendDirectFacilityNotice,
} from '../../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ facilityId: string }> }
) {
  try {
    const { facilityId } = await context.params;
    const fid = decodeURIComponent(String(facilityId || '')).trim().toUpperCase();
    if (!fid) {
      return NextResponse.json({ ok: false, error: 'facilityId is required.' }, { status: 400 });
    }
    const dossier = await buildLiveFacilityDossier(fid);
    return NextResponse.json({ ok: true, dossier });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to load facility dossier.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ facilityId: string }> }
) {
  try {
    const { facilityId } = await context.params;
    const fid = decodeURIComponent(String(facilityId || '')).trim().toUpperCase();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const message = String(body.body || '').trim();
    const rawLevel = String(body.level || 'warning').trim();
    const level: 'info' | 'warning' | 'alert' =
      rawLevel === 'info' || rawLevel === 'alert' ? rawLevel : 'warning';
    const sentBy = String(body.sentBy || 'MOH Oversight').trim();

    if (!fid) {
      return NextResponse.json({ ok: false, error: 'facilityId is required.' }, { status: 400 });
    }
    if (!title || !message) {
      return NextResponse.json(
        { ok: false, error: 'Notice title and message body are required.' },
        { status: 400 }
      );
    }

    const result = await sendDirectFacilityNotice({
      facilityId: fid,
      title,
      body: message,
      level,
      sentBy,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to dispatch facility notice.' },
      { status: 500 }
    );
  }
}
