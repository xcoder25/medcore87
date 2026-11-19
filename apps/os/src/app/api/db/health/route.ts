import { NextResponse } from 'next/server';
import { ensureSchema, getPgDiagnostics, isPostgresConfigured, query } from '../../../../lib/db/postgres';

export const runtime = 'nodejs';

export async function GET() {
  const diag = getPgDiagnostics();

  if (!isPostgresConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      authMethod: diag.authMethod,
      region: diag.region,
      message: 'Set MEDCORE_AWS_DB_PGHOST + MEDCORE_AWS_DB_PGPASSWORD (or AWS IAM credentials / DATABASE_URL)',
    });
  }
  try {
    await ensureSchema();
    const r = await query<{ now: string }>('SELECT NOW()::text AS now');
    return NextResponse.json({
      ok: true,
      configured: true,
      authMethod: diag.authMethod,
      region: diag.region,
      now: r.rows[0]?.now,
      message: 'Aurora Postgres connected · schema ready',
    });
  } catch (e) {
    const errorMsg = (e as Error).message || 'connection failed';
    const isPam = errorMsg.includes('PAM authentication failed');
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        authMethod: diag.authMethod,
        region: diag.region,
        error: errorMsg,
        ...(isPam
          ? {
              hint: 'AWS RDS PAM rejected the IAM auth token. Ensure IAM DB auth is enabled on the cluster, GRANT rds_iam TO postgres was applied, and the IAM user for AWS_ACCESS_KEY_ID has an explicit rds-db:connect policy (AmazonRDSFullAccess does not include rds-db:connect).',
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
