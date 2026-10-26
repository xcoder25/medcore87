import { NextResponse } from 'next/server';
import { ensureSchema, isPostgresConfigured, query } from '../../../../lib/db/postgres';

export const runtime = 'nodejs';

export async function GET() {
  if (!isPostgresConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Set MEDCORE_AWS_DB_PGHOST + MEDCORE_AWS_DB_PGPASSWORD (or DATABASE_URL)',
    });
  }
  try {
    await ensureSchema();
    const r = await query<{ now: string }>('SELECT NOW()::text AS now');
    return NextResponse.json({
      ok: true,
      configured: true,
      now: r.rows[0]?.now,
      message: 'Aurora Postgres connected · schema ready',
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: (e as Error).message || 'connection failed',
      },
      { status: 500 }
    );
  }
}
