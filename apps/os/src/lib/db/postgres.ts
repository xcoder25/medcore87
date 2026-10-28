/**
 * Aurora Postgres connection for MedCore OS (system of record).
 * Supports Vercel AWS RDS integration env (MEDCORE_AWS_DB_*) and standard DATABASE_URL.
 */
import { createHash } from 'crypto';

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
  return (process.env[name] || '').trim();
}

/** Build connection config from Vercel/AWS integration or DATABASE_URL */
export function getPgConfig():
  | { connectionString: string; ssl?: boolean | { rejectUnauthorized: boolean } }
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl: boolean | { rejectUnauthorized: boolean };
    }
  | null {
  const url =
    env('DATABASE_URL') ||
    env('POSTGRES_URL') ||
    env('POSTGRES_PRISMA_URL') ||
    env('MEDCORE_AWS_DB_URL') ||
    env('MEDCORE_DATABASE_URL');
  if (url) {
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    };
  }

  const host = env('MEDCORE_AWS_DB_PGHOST') || env('PGHOST');
  const port = parseInt(env('MEDCORE_AWS_DB_PGPORT') || env('PGPORT') || '5432', 10);
  const database = env('MEDCORE_AWS_DB_PGDATABASE') || env('PGDATABASE') || 'postgres';
  const user =
    env('MEDCORE_AWS_DB_PGUSER') ||
    env('PGUSER') ||
    env('MEDCORE_AWS_DB_USER') ||
    'postgres';
  const password =
    env('MEDCORE_AWS_DB_PGPASSWORD') ||
    env('PGPASSWORD') ||
    env('MEDCORE_AWS_DB_PASSWORD') ||
    env('POSTGRES_PASSWORD');

  if (!host || !password) return null;

  const sslMode = (env('MEDCORE_AWS_DB_PGSSLMODE') || env('PGSSLMODE') || 'require').toLowerCase();
  const ssl =
    sslMode === 'disable' || sslMode === 'false'
      ? false
      : { rejectUnauthorized: false };

  return { host, port, database, user, password, ssl };
}

export function isPostgresConfigured(): boolean {
  return getPgConfig() != null;
}

export function getPool(): Pool {
  if (pool) return pool;
  const cfg = getPgConfig();
  if (!cfg) {
    throw new Error(
      'Postgres not configured. Set MEDCORE_AWS_DB_PGHOST + MEDCORE_AWS_DB_PGPASSWORD (or DATABASE_URL) on Vercel.'
    );
  }
  let PgPoolClass: any;
  try {
    const pg = require('pg');
    PgPoolClass = pg.Pool;
  } catch (err) {
    throw new Error('Postgres client package ("pg") is not installed: ' + (err as Error).message);
  }
  pool = new PgPoolClass({
    ...cfg,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  });
  pool!.on('error', (err: Error) => {
    console.error('[postgres] pool error', err.message);
  });
  return pool!;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const p = getPool();
  return p.query<T>(text, params);
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await getPool().connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}

/** Create core tables if missing (idempotent). */
export async function ensureSchema(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS facilities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          state TEXT,
          country TEXT DEFAULT 'NG',
          config JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS staff (
          badge_id TEXT NOT NULL,
          facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL,
          role TEXT,
          role_key TEXT,
          title TEXT,
          department TEXT,
          email TEXT,
          phone TEXT,
          status TEXT DEFAULT 'active',
          clearance_level INT DEFAULT 1,
          clearance_label TEXT,
          permissions JSONB DEFAULT '[]'::jsonb,
          photo_url TEXT,
          pin_hash TEXT,
          auth_email TEXT,
          meta JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, badge_id)
        );

        CREATE INDEX IF NOT EXISTS idx_staff_facility_status ON staff (facility_id, status);
        CREATE INDEX IF NOT EXISTS idx_staff_email ON staff (facility_id, lower(email));
        CREATE INDEX IF NOT EXISTS idx_staff_role ON staff (facility_id, role_key);

        CREATE TABLE IF NOT EXISTS patients (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
          hospital_number TEXT,
          full_name TEXT NOT NULL,
          sex TEXT,
          date_of_birth DATE,
          phone TEXT,
          email TEXT,
          address TEXT,
          status TEXT DEFAULT 'active',
          meta JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );

        CREATE INDEX IF NOT EXISTS idx_patients_facility_name ON patients (facility_id, lower(full_name));
        CREATE INDEX IF NOT EXISTS idx_patients_hn ON patients (facility_id, hospital_number);

        CREATE TABLE IF NOT EXISTS clinical_orders (
          id TEXT PRIMARY KEY,
          facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
          patient_id TEXT,
          order_type TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'routine',
          ordered_by TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_orders_facility_status ON clinical_orders (facility_id, status, created_at DESC);

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          facility_id TEXT NOT NULL,
          level TEXT DEFAULT 'info',
          title TEXT NOT NULL,
          body TEXT,
          role_hint TEXT,
          target_staff TEXT,
          read BOOLEAN DEFAULT FALSE,
          meta JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_notif_facility ON notifications (facility_id, created_at DESC);
      `);
      console.info('[postgres] schema ready');
    })().catch((e) => {
      schemaReady = null;
      console.error('[postgres] schema failed', e);
      throw e;
    });
  }
  await schemaReady;
}

/** Simple PIN hash — not for high-security alone; Firebase Auth is primary login. */
export function hashPin(pin: string): string {
  const salt = 'medcore-pilot-v1';
  return createHash('sha256').update(`${salt}:${String(pin)}`).digest('hex');
}
