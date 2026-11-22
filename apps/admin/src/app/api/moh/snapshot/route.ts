import { NextRequest, NextResponse } from 'next/server';
import { buildLiveMohSnapshot } from '../../../../lib/mohSyncEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const district = req.nextUrl.searchParams.get('district') || undefined;
    const facilityId = req.nextUrl.searchParams.get('facilityId') || undefined;
    const snapshot = await buildLiveMohSnapshot({ district, facilityId });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to build MOH telemetry snapshot.' },
      { status: 500 }
    );
  }
}
