import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { getStaff } from '../../../../lib/db/staffRepo';

export const runtime = 'nodejs';

/**
 * GET /api/staff/lookup?facilityId=IGH-EKT&badgeId=AKS-ADM-001
 * Efficient single-badge Aurora PostgreSQL lookup for the login flow.
 * Returns the staff row (without pin_hash) or null if not found.
 * Multi-tenant RLS is enforced via withTenantClient inside getStaff().
 */
export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  const badgeId = (req.nextUrl.searchParams.get('badgeId') || '').trim().toUpperCase();

  if (!facilityId || !badgeId) {
    return NextResponse.json(
      { ok: false, error: 'facilityId and badgeId are required' },
      { status: 400 }
    );
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({ ok: true, configured: false, staff: null });
  }

  try {
    const row = await getStaff(facilityId, badgeId);
    if (!row) {
      return NextResponse.json({ ok: true, staff: null });
    }
    // Strip pin_hash from the response — PINs are verified via Firebase Auth only
    const { pin_hash: _pinHash, ...safeRow } = row as typeof row & { pin_hash?: string };
    return NextResponse.json({ ok: true, staff: safeRow });
  } catch (e) {
    console.error('[api/staff/lookup]', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'lookup failed' },
      { status: 500 }
    );
  }
}
