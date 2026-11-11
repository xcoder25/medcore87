import { NextRequest, NextResponse } from 'next/server';
import {
  isFirebaseAdminConfigured,
  adminVerifyIdToken,
  adminApiSecretOk,
} from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured, query } from '../../../../lib/db/postgres';

export const runtime = 'nodejs';

/**
 * POST /api/staff/flush-facility
 * Body: { facilityId: string, confirm: "FLUSH_FACILITY_STAFF" }
 * Clears staff records for a facility in Aurora PostgreSQL.
 */
export async function POST(req: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' },
      { status: 503 }
    );
  }

  const secret = req.headers.get('x-admin-secret');
  if (!adminApiSecretOk(secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid admin secret' }, { status: 401 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const who = token ? await adminVerifyIdToken(token) : null;
  if (!who) {
    return NextResponse.json({ ok: false, error: 'Valid ID token required' }, { status: 401 });
  }

  let body: { facilityId?: string; confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (String(body.confirm || '') !== 'FLUSH_FACILITY_STAFF') {
    return NextResponse.json(
      { ok: false, error: 'Send { confirm: "FLUSH_FACILITY_STAFF", facilityId }' },
      { status: 400 }
    );
  }

  const facilityId = String(body.facilityId || 'IGH-EKT').trim();

  try {
    if (isPostgresConfigured()) {
      await query(
        `DELETE FROM staff WHERE facility_id = $1 AND badge_id NOT LIKE 'ADM-%'`,
        [facilityId]
      );
    }

    return NextResponse.json({
      ok: true,
      facilityId,
      flushedBy: who.email || who.uid,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'flush failed' },
      { status: 500 }
    );
  }
}
