import { NextRequest, NextResponse } from 'next/server';
import {
  buildLiveMohSnapshot,
  createHrhRecruitmentRecord,
  updateHrhRecruitmentRecord,
} from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get('district') || undefined;
    const snap = await buildLiveMohSnapshot({ district });
    return NextResponse.json({ ok: true, hrh: snap.hrh });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to load HRH telemetry.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (!String(body.title || '').trim() || !String(body.cadre || '').trim() || !String(body.facilityId || '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'title, cadre, and facilityId are required.' },
        { status: 400 }
      );
    }
    const recruitment = await createHrhRecruitmentRecord({
      title: String(body.title),
      cadre: String(body.cadre),
      facilityId: String(body.facilityId),
      facilityName: body.facilityName ? String(body.facilityName) : undefined,
      lga: body.lga ? String(body.lga) : undefined,
      vacanciesCount: Number(body.vacanciesCount || 1),
      applicantsCount: Number(body.applicantsCount || 0),
      shortlistedCount: Number(body.shortlistedCount || 0),
      deployedCount: Number(body.deployedCount || 0),
      stage: body.stage || 'open',
      postedBy: body.postedBy ? String(body.postedBy) : undefined,
    });
    return NextResponse.json({ ok: true, recruitment });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to create recruitment posting.' },
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
    const updated = await updateHrhRecruitmentRecord(id, {
      stage: body.stage,
      applicantsCount: typeof body.applicantsCount === 'number' ? body.applicantsCount : undefined,
      shortlistedCount: typeof body.shortlistedCount === 'number' ? body.shortlistedCount : undefined,
      deployedCount: typeof body.deployedCount === 'number' ? body.deployedCount : undefined,
    });
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Recruitment posting not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, recruitment: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to update recruitment posting.' },
      { status: 500 }
    );
  }
}
