/**
 * Shared PostgreSQL connector for the Ministry of Health (MOH) Portal.
 * Connects to the same transactional database cluster as MedCore OS to aggregate
 * statewide de-identified hospital telemetry, directives, audits, and transfers.
 */

export interface QueryResultRow {
  [column: string]: any;
}
export interface QueryResult<R extends QueryResultRow = any> {
  rows: R[];
  rowCount: number | null;
  command: string;
  oid: number;
  fields: any[];
}
export interface PoolClient {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(err?: Error | boolean): void;
}
export interface Pool {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  connect(): Promise<PoolClient>;
  on(event: string, listener: (...args: any[]) => void): this;
}

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function env(name: string): string {
  let val = (process.env[name] || '').trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function envPrefixed(suffixes: string[]): string {
  for (const s of suffixes) {
    const exact = env(`MEDCORE_AWS_${s}`);
    if (exact) return exact;
  }

  const keys = Object.keys(process.env)
    .filter((k) => k.startsWith('MEDCORE_AWS') && !k.includes('_S3_'))
    .sort();
  for (const s of suffixes) {
    const tail = `_${s}`;
    for (const k of keys) {
      if (k.endsWith(tail)) {
        const val = env(k);
        if (val) return val;
      }
    }
  }

  for (const s of suffixes) {
    const unprefixed = env(s);
    if (unprefixed) return unprefixed;
  }
  return '';
}

const PRIMARY_RDS_HOST = 'database-1-instance-1.cnmi6kca2r4k.eu-north-1.rds.amazonaws.com';
const PRIMARY_RDS_PORT = 5432;
const PRIMARY_RDS_DATABASE = 'postgres';
const PRIMARY_RDS_USER = 'postgres';
const PRIMARY_RDS_REGION = 'eu-north-1';

function inferRegionFromRdsHost(host: string): string {
  const m = host.match(/\.([a-z]{2}-[a-z]+-\d+)\.rds\.amazonaws\.com$/i);
  return m ? m[1].toLowerCase() : '';
}

function readRdsConnectionParams() {
  const host = envPrefixed(['PGHOST', 'RDS_HOST']) || env('AWS_RDS_HOST') || PRIMARY_RDS_HOST;
  const port = Number(envPrefixed(['PGPORT']) || String(PRIMARY_RDS_PORT)) || PRIMARY_RDS_PORT;
  const database = envPrefixed(['PGDATABASE']) || PRIMARY_RDS_DATABASE;
  const user = envPrefixed(['PGUSER', 'USER']) || PRIMARY_RDS_USER;
  const region =
    inferRegionFromRdsHost(host) ||
    envPrefixed(['AWS_REGION', 'REGION']) ||
    env('AWS_RDS_REGION') ||
    env('AWS_DEFAULT_REGION') ||
    PRIMARY_RDS_REGION;
  return { host, port, database, user, region };
}

function resolvePgTarget() {
  const roleArn = envPrefixed(['AWS_ROLE_ARN', 'ROLE_ARN']);
  const accessKeyId = env('AWS_ACCESS_KEY_ID') || envPrefixed(['AWS_ACCESS_KEY_ID', 'ACCESS_KEY_ID']);
  const secretAccessKey =
    env('AWS_SECRET_ACCESS_KEY') || envPrefixed(['AWS_SECRET_ACCESS_KEY', 'SECRET_ACCESS_KEY']);
  const explicitRdsPassword = env('AWS_RDS_PASSWORD');

  if (roleArn && !explicitRdsPassword) {
    return {
      kind: 'rds' as const,
      authMethod: 'oidc_role' as const,
      ...readRdsConnectionParams(),
      roleArn,
      accessKeyId: '',
      secretAccessKey: '',
      explicitRdsPassword: '',
    };
  }

  if (explicitRdsPassword) {
    return {
      kind: 'rds' as const,
      authMethod: 'rds_password' as const,
      ...readRdsConnectionParams(),
      roleArn: '',
      accessKeyId: '',
      secretAccessKey: '',
      explicitRdsPassword,
    };
  }

  const url =
    envPrefixed(['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'URL']) ||
    env('MEDCORE_DATABASE_URL');
  if (url) {
    return { kind: 'legacy_url' as const, authMethod: 'legacy_url' as const, url };
  }

  const host = envPrefixed(['PGHOST']);
  const password = envPrefixed(['PGPASSWORD', 'PASSWORD', 'POSTGRES_PASSWORD']);
  if (host && password) {
    return { kind: 'legacy_env' as const, authMethod: 'legacy_env' as const, host, password };
  }

  if (accessKeyId && secretAccessKey) {
    return {
      kind: 'rds' as const,
      authMethod: 'iam_keys' as const,
      ...readRdsConnectionParams(),
      roleArn: '',
      accessKeyId,
      secretAccessKey,
      explicitRdsPassword: '',
    };
  }

  return { kind: 'none' as const, authMethod: 'none' as const };
}

export function getPgConfig():
  | { connectionString: string; ssl?: boolean | { rejectUnauthorized: boolean } }
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string | (() => Promise<string>);
      ssl: boolean | { rejectUnauthorized: boolean };
    }
  | null {
  const target = resolvePgTarget();

  if (target.kind === 'rds') {
    const {
      authMethod,
      host,
      port,
      database,
      user,
      region,
      roleArn,
      accessKeyId,
      secretAccessKey,
      explicitRdsPassword,
    } = target;
    let cachedSigner: any = null;

    return {
      host,
      port,
      database,
      user,
      password: explicitRdsPassword
        ? explicitRdsPassword
        : async () => {
            if (!cachedSigner) {
              const { Signer } = await import('@aws-sdk/rds-signer');
              let credentials: any;
              if (authMethod === 'oidc_role') {
                const { awsCredentialsProvider } = await import('@vercel/functions/oidc');
                credentials = awsCredentialsProvider({
                  roleArn,
                  clientConfig: { region },
                });
              } else {
                credentials = { accessKeyId, secretAccessKey };
              }
              cachedSigner = new Signer({
                hostname: host,
                port,
                username: user,
                region,
                credentials,
              });
            }
            return cachedSigner.getAuthToken();
          },
      ssl: { rejectUnauthorized: false },
    };
  }

  if (target.kind === 'legacy_url') {
    return {
      connectionString: target.url,
      ssl: { rejectUnauthorized: false },
    };
  }

  if (target.kind === 'legacy_env') {
    const port = parseInt(envPrefixed(['PGPORT']) || '5432', 10);
    const database = envPrefixed(['PGDATABASE']) || 'postgres';
    const user = envPrefixed(['PGUSER', 'USER']) || 'postgres';
    const sslMode = (envPrefixed(['PGSSLMODE']) || 'require').toLowerCase();
    const ssl =
      sslMode === 'disable' || sslMode === 'false' ? false : { rejectUnauthorized: false };
    return { host: target.host, port, database, user, password: target.password, ssl };
  }

  return null;
}

export function isPostgresConfigured(): boolean {
  return getPgConfig() != null;
}

export function getPool(): Pool {
  if (pool) return pool;
  const cfg = getPgConfig();
  if (!cfg) {
    throw new Error('Database connection is not configured for MOH command portal.');
  }
  const pg = require('pg');
  const PgPoolClass = pg.Pool;
  pool = new PgPoolClass({
    ...cfg,
    max: 12,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  });
  try {
    const { attachDatabasePool } = require('@vercel/functions');
    if (typeof attachDatabasePool === 'function') {
      attachDatabasePool(pool);
    }
  } catch {
    /* optional outside managed runtime */
  }
  pool!.on('error', (err: Error) => {
    console.error('[moh-postgres] pool error', err.message);
  });
  return pool!;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function safeTableExists(tableName: string): Promise<boolean> {
  if (!isPostgresConfigured()) return false;
  try {
    const res = await query<{ reg: string | null }>(`SELECT to_regclass($1) AS reg`, [
      `public.${tableName}`,
    ]);
    return Boolean(res.rows[0]?.reg);
  } catch {
    return false;
  }
}

export async function ensureMohSchema(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS moh_directives (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          severity TEXT DEFAULT 'mandatory_order',
          summary TEXT DEFAULT '',
          target_districts JSONB DEFAULT '[]'::jsonb,
          target_tiers JSONB DEFAULT '[]'::jsonb,
          mandatory_actions JSONB DEFAULT '[]'::jsonb,
          issued_by TEXT DEFAULT 'Commissioner for Health',
          issued_at TIMESTAMPTZ DEFAULT NOW(),
          effective_until TEXT DEFAULT '',
          status TEXT DEFAULT 'active',
          acknowledged_facilities JSONB DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS moh_audits (
          id TEXT PRIMARY KEY,
          facility_id TEXT NOT NULL,
          facility_name TEXT NOT NULL,
          audit_date TEXT NOT NULL,
          auditor_name TEXT NOT NULL,
          category TEXT NOT NULL,
          findings_count INT DEFAULT 0,
          critical_violations INT DEFAULT 0,
          resolution_deadline TEXT DEFAULT '',
          status TEXT DEFAULT 'scheduled',
          notes TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS moh_staff_transfers (
          id TEXT PRIMARY KEY,
          staff_badge TEXT DEFAULT '',
          staff_name TEXT NOT NULL,
          cadre TEXT DEFAULT '',
          from_facility_id TEXT NOT NULL,
          from_facility_name TEXT NOT NULL,
          to_facility_id TEXT NOT NULL,
          to_facility_name TEXT NOT NULL,
          transfer_type TEXT DEFAULT 'temporary_surge',
          urgency TEXT DEFAULT 'routine',
          reason TEXT DEFAULT '',
          status TEXT DEFAULT 'pending',
          requested_by TEXT DEFAULT 'MOH Workforce Desk',
          decided_by TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS moh_facility_overrides (
          facility_id TEXT PRIMARY KEY,
          emergency_status TEXT DEFAULT 'normal',
          accreditation_status TEXT DEFAULT 'pending',
          notes TEXT DEFAULT '',
          updated_by TEXT DEFAULT '',
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS moh_alerts (
          id TEXT PRIMARY KEY,
          condition TEXT NOT NULL,
          icd10_category TEXT DEFAULT '',
          detected_cases INT DEFAULT 0,
          rate_of_increase NUMERIC DEFAULT 0,
          affected_districts JSONB DEFAULT '[]'::jsonb,
          severity TEXT DEFAULT 'advisory',
          reporting_facilities INT DEFAULT 1,
          containment_active BOOLEAN DEFAULT FALSE,
          notes TEXT DEFAULT '',
          first_identified TEXT DEFAULT '',
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  await schemaReady;
}
