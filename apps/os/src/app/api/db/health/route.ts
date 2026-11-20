import { NextResponse } from 'next/server';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';

export const runtime = 'nodejs';

export async function GET() {
  if (!isPostgresConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Cloud database is not configured.',
    });
  }
  try {
    await ensureSchema();
    const r = await withTenantClient('HEALTH-CHECK', (c) =>
      c.query<{ now: string; tenant: string }>(
        "SELECT NOW()::text AS now, current_setting('app.current_facility_id', true) AS tenant"
      )
    );
    return NextResponse.json({
      ok: true,
      configured: true,
      now: r.rows[0]?.now,
      message: 'Database connected · schema ready',
    });
  } catch (e) {
    console.error('[api/db/health]', e);
    const errorMsg = (e as Error).message || 'connection failed';
    const isPam = errorMsg.includes('PAM authentication failed');
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: isPam
          ? 'Database authentication failed. Contact your system administrator.'
          : 'Database connection failed.',
      },
      { status: 500 }
    );
  }
}
