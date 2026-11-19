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

export type PgAuthMethod =
  | 'rds_password'
  | 'iam_keys'
  | 'oidc_role'
  | 'legacy_url'
  | 'legacy_env'
  | 'none';

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

  // Priority 1: Vercel AWS RDS OIDC integration (MEDCORE_AWS* / AWS_ROLE_ARN + PGHOST/PGPORT/PGUSER/PGDATABASE)
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

  // Priority 2: Explicit password override
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

  // Priority 3: Standard URL connection string
  const url =
    envPrefixed(['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'URL']) ||
    env('MEDCORE_DATABASE_URL');
  if (url) {
    return { kind: 'legacy_url' as const, authMethod: 'legacy_url' as const, region: null, url };
  }

  // Priority 4: Legacy host + static password env vars
  const host = envPrefixed(['PGHOST']);
  const password = envPrefixed(['PGPASSWORD', 'PASSWORD', 'POSTGRES_PASSWORD']);
  if (host && password) {
    return { kind: 'legacy_env' as const, authMethod: 'legacy_env' as const, region: null, host, password };
  }

  // Priority 5: IAM access keys RDS IAM Auth fallback
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

  return { kind: 'none' as const, authMethod: 'none' as const, region: null };
}

/**
 * Build connection config prioritizing Vercel's AWS RDS OIDC integration (`AWS_ROLE_ARN` +
 * `PGHOST`/`PGPORT`/`PGUSER`/`PGDATABASE`) via `@aws-sdk/rds-signer`, with URL, password, and
 * IAM-key fallbacks.
 */
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
    const { authMethod, host, port, database, user, region, roleArn, accessKeyId, secretAccessKey, explicitRdsPassword } = target;
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
      sslMode === 'disable' || sslMode === 'false'
        ? false
        : { rejectUnauthorized: false };

    return { host: target.host, port, database, user, password: target.password, ssl };
  }

  return null;
}

export function isPostgresConfigured(): boolean {
  return getPgConfig() != null;
}

export function getPgDiagnostics(): {
  authMethod: PgAuthMethod;
  region: string | null;
} {
  const target = resolvePgTarget();
  return {
    authMethod: target.authMethod,
    region: target.region,
  };
}

export function getPool(): Pool {
  if (pool) return pool;
  const cfg = getPgConfig();
  if (!cfg) {
    throw new Error(
      'Postgres not configured. Set AWS_ROLE_ARN + PGHOST (Vercel RDS OIDC) or DATABASE_URL on Vercel.'
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
    max: 20,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  });
  try {
    const { attachDatabasePool } = require('@vercel/functions');
    if (typeof attachDatabasePool === 'function') {
      attachDatabasePool(pool);
    }
  } catch {
    // Optional outside Vercel Fluid runtime
  }
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

/**
 * Executes a callback within a transactional connection block with PostgreSQL Row-Level Security (RLS)
 * scoped to the active facility.
 * Enforces: SET LOCAL app.current_facility_id = '<facilityId>';
 * Guaranteeing that users at Facility A can NEVER read or modify patient records from Facility B.
 */
export async function withTenantClient<T>(
  facilityId: string,
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const fid = String(facilityId || '').trim();
  return withClient(async (c) => {
    await c.query('BEGIN;');
    try {
      if (fid) {
        await c.query('SET LOCAL app.current_facility_id = $1;', [fid]);
      }
      const result = await fn(c);
      await c.query('COMMIT;');
      return result;
    } catch (err) {
      await c.query('ROLLBACK;').catch(() => {});
      throw err;
    }
  });
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

        CREATE TABLE IF NOT EXISTS facility_kv (
          facility_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, key)
        );

        CREATE INDEX IF NOT EXISTS idx_facility_kv_updated ON facility_kv (facility_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS form_drafts (
          facility_id TEXT NOT NULL,
          form_type TEXT NOT NULL,
          draft_id TEXT NOT NULL,
          staff_badge TEXT,
          step INT DEFAULT 1,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
          PRIMARY KEY (facility_id, form_type, draft_id)
        );

        CREATE INDEX IF NOT EXISTS idx_form_drafts_lookup ON form_drafts (facility_id, form_type, updated_at DESC);

        CREATE TABLE IF NOT EXISTS vital_signs (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          patient_id TEXT,
          hospital_number TEXT,
          encounter_id TEXT,
          bp TEXT,
          pulse INT,
          temp NUMERIC(5,2),
          spo2 INT,
          weight NUMERIC(6,2),
          urgency TEXT DEFAULT 'routine',
          recorded_by TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          recorded_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_vital_signs_patient ON vital_signs (facility_id, patient_id, recorded_at DESC);

        CREATE TABLE IF NOT EXISTS prescriptions (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          patient_id TEXT,
          hospital_number TEXT,
          patient_name TEXT,
          drug_name TEXT NOT NULL,
          dose TEXT,
          frequency TEXT,
          route TEXT,
          duration TEXT,
          status TEXT DEFAULT 'pending',
          prescribed_by TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_prescriptions_facility_status ON prescriptions (facility_id, status, created_at DESC);

        CREATE TABLE IF NOT EXISTS lab_results (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          patient_id TEXT,
          hospital_number TEXT,
          patient_name TEXT,
          order_id TEXT,
          test_name TEXT NOT NULL,
          result_summary TEXT,
          flag TEXT DEFAULT 'NORMAL',
          status TEXT DEFAULT 'pending',
          validated_by TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_lab_results_facility_status ON lab_results (facility_id, status, created_at DESC);

        CREATE TABLE IF NOT EXISTS invoices_receipts (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          patient_id TEXT,
          hospital_number TEXT,
          patient_name TEXT,
          source TEXT DEFAULT 'billing',
          description TEXT,
          amount_ngn NUMERIC(14,2) DEFAULT 0,
          status TEXT DEFAULT 'unpaid',
          order_id TEXT,
          paid_via TEXT,
          payment_ref TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_receipts_facility ON invoices_receipts (facility_id, status, created_at DESC);

        CREATE TABLE IF NOT EXISTS inpatient_beds (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          ward TEXT NOT NULL,
          bed_no TEXT NOT NULL,
          status TEXT DEFAULT 'available',
          patient_id TEXT,
          patient_name TEXT,
          hospital_number TEXT,
          diagnosis TEXT,
          doctor TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_inpatient_beds_ward ON inpatient_beds (facility_id, ward, status);

        CREATE TABLE IF NOT EXISTS reception_visits (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          patient_id TEXT,
          hospital_number TEXT,
          patient_name TEXT,
          queue_number TEXT,
          department TEXT,
          doctor TEXT,
          status TEXT DEFAULT 'waiting',
          payment_status TEXT DEFAULT 'unpaid',
          visit_type TEXT DEFAULT 'walkin',
          payload JSONB DEFAULT '{}'::jsonb,
          checked_in_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_reception_visits_status ON reception_visits (facility_id, status, checked_in_at DESC);

        CREATE TABLE IF NOT EXISTS accounts_requests (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          patient_id TEXT,
          hospital_number TEXT,
          patient_name TEXT,
          amount_ngn NUMERIC(14,2) DEFAULT 0,
          purpose TEXT,
          status TEXT DEFAULT 'awaiting_payment',
          invoice_number TEXT,
          paid_reference TEXT,
          paid_via TEXT,
          payload JSONB DEFAULT '{}'::jsonb,
          sent_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_requests_status ON accounts_requests (facility_id, status, sent_at DESC);

        CREATE TABLE IF NOT EXISTS staff_biometrics (
          badge_id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          staff_name TEXT,
          descriptor JSONB NOT NULL DEFAULT '[]'::jsonb,
          version INT DEFAULT 1,
          enrolled_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, badge_id)
        );
        CREATE INDEX IF NOT EXISTS idx_staff_biometrics_lookup ON staff_biometrics (facility_id, badge_id);

        CREATE TABLE IF NOT EXISTS staff_otp_challenges (
          facility_id TEXT NOT NULL,
          badge_id TEXT NOT NULL,
          email TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          expires_at BIGINT NOT NULL,
          attempts INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, badge_id)
        );
        CREATE INDEX IF NOT EXISTS idx_staff_otp_expires ON staff_otp_challenges (expires_at);

        CREATE TABLE IF NOT EXISTS clinical_audit_ledger (
          id TEXT NOT NULL,
          facility_id TEXT NOT NULL,
          actor TEXT NOT NULL,
          actor_badge TEXT,
          category TEXT DEFAULT 'clinical',
          severity TEXT DEFAULT 'normal',
          action TEXT NOT NULL,
          entity TEXT,
          entity_id TEXT,
          detail TEXT,
          prev_hash TEXT NOT NULL,
          row_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (facility_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_audit_ledger_facility ON clinical_audit_ledger (facility_id, created_at DESC);

        -- Multi-Tenant Security Layer: PostgreSQL Row-Level Security (RLS)
        -- Guarantees that users at Facility A can never see patient or staff data from Facility B
        ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
        ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
        ALTER TABLE clinical_orders ENABLE ROW LEVEL SECURITY;
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
        ALTER TABLE facility_kv ENABLE ROW LEVEL SECURITY;
        ALTER TABLE form_drafts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
        ALTER TABLE invoices_receipts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE inpatient_beds ENABLE ROW LEVEL SECURITY;
        ALTER TABLE reception_visits ENABLE ROW LEVEL SECURITY;
        ALTER TABLE accounts_requests ENABLE ROW LEVEL SECURITY;
        ALTER TABLE staff_biometrics ENABLE ROW LEVEL SECURITY;
        ALTER TABLE staff_otp_challenges ENABLE ROW LEVEL SECURITY;
        ALTER TABLE clinical_audit_ledger ENABLE ROW LEVEL SECURITY;

        DO $$
        DECLARE
          t TEXT;
        BEGIN
          FOREACH t IN ARRAY ARRAY[
            'patients', 'staff', 'clinical_orders', 'notifications',
            'facility_kv', 'form_drafts', 'vital_signs', 'prescriptions',
            'lab_results', 'invoices_receipts', 'inpatient_beds',
            'reception_visits', 'accounts_requests', 'staff_biometrics',
            'staff_otp_challenges', 'clinical_audit_ledger'
          ]
          LOOP
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'facility_isolation_policy'
            ) THEN
              EXECUTE format(
                'CREATE POLICY facility_isolation_policy ON %I USING (facility_id = COALESCE(NULLIF(current_setting(''app.current_facility_id'', true), ''''), facility_id))',
                t
              );
            END IF;
          END LOOP;
        END $$;
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

/**
 * Computes a deterministic SHA-256 tamper-evident hash for a clinical audit ledger row.
 */
export function computeAuditRowHash(input: {
  prevHash: string;
  at: string;
  facilityId: string;
  actor: string;
  actorBadge?: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
}): string {
  const canonical = [
    input.prevHash || 'GENESIS',
    input.at || '',
    input.facilityId || '',
    input.actor || '',
    input.actorBadge || '',
    input.action || '',
    input.entity || '',
    input.entityId || '',
    input.detail || '',
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Projects facility_kv keys into first-class relational Postgres tables inside a tenant-scoped transaction.
 */
export async function projectKeyToRelationalTables(
  c: PoolClient,
  facilityId: string,
  key: string,
  value: unknown
): Promise<void> {
  if (!value) return;

  // Ensure parent facility exists for foreign keys
  await c.query(
    `INSERT INTO facilities (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
    [facilityId]
  );

  // 1) Clinical Orders, Prescriptions & Lab Results
  if (key === 'medcore_os_clinical_orders_v1' && Array.isArray(value)) {
    for (const raw of value.slice(0, 200)) {
      if (!raw || typeof raw !== 'object') continue;
      const o = raw as Record<string, any>;
      const id = String(o.id || '').trim();
      if (!id) continue;
      const orderType = String(o.type || o.orderType || 'lab').toLowerCase();
      const status = String(o.status || 'pending');
      const priority = String(o.priority || 'routine');
      const patientId = String(o.patientId || '');
      const hospitalNumber = String(o.hospitalNumber || '');
      const patientName = String(o.patientName || '');
      const orderedBy = String(o.orderedBy || '');
      const name = String(o.name || o.testName || o.drugName || 'Order');

      await c.query(
        `INSERT INTO clinical_orders (id, facility_id, patient_id, order_type, status, priority, ordered_by, payload, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           priority = EXCLUDED.priority,
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [id, facilityId, patientId, orderType, status, priority, orderedBy, JSON.stringify(o)]
      );

      if (orderType === 'rx' || orderType === 'pharmacy') {
        await c.query(
          `INSERT INTO prescriptions (id, facility_id, patient_id, hospital_number, patient_name, drug_name, dose, status, prescribed_by, payload, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
           ON CONFLICT (facility_id, id) DO UPDATE SET
             status = EXCLUDED.status,
             payload = EXCLUDED.payload,
             updated_at = NOW()`,
          [id, facilityId, patientId, hospitalNumber, patientName, name, String(o.notes || ''), status, orderedBy, JSON.stringify(o)]
        );
      } else if (orderType === 'lab' || orderType === 'laboratory') {
        await c.query(
          `INSERT INTO lab_results (id, facility_id, patient_id, hospital_number, patient_name, order_id, test_name, result_summary, flag, status, validated_by, payload, updated_at)
           VALUES ($1, $2, $3, $4, $5, $1, $6, $7, $8, $9, $10, $11::jsonb, NOW())
           ON CONFLICT (facility_id, id) DO UPDATE SET
             result_summary = EXCLUDED.result_summary,
             flag = EXCLUDED.flag,
             status = EXCLUDED.status,
             validated_by = EXCLUDED.validated_by,
             payload = EXCLUDED.payload,
             updated_at = NOW()`,
          [
            id,
            facilityId,
            patientId,
            hospitalNumber,
            patientName,
            name,
            String(o.result || o.resultSummary || o.notes || ''),
            String(o.flag || (priority === 'stat' ? 'CRITICAL' : 'NORMAL')),
            status,
            String(o.completedBy || o.validatedBy || ''),
            JSON.stringify(o),
          ]
        );
      }
    }
  }

  // 2) Patient Bill Lines & Receipts
  if (key === 'medcore_os_patient_bills_v1' && Array.isArray(value)) {
    for (const raw of value.slice(0, 250)) {
      if (!raw || typeof raw !== 'object') continue;
      const b = raw as Record<string, any>;
      const id = String(b.id || '').trim();
      if (!id) continue;
      await c.query(
        `INSERT INTO invoices_receipts (
           id, facility_id, patient_id, hospital_number, patient_name, source,
           description, amount_ngn, status, order_id, paid_via, payment_ref, payload, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW())
         ON CONFLICT (facility_id, id) DO UPDATE SET
           status = EXCLUDED.status,
           amount_ngn = EXCLUDED.amount_ngn,
           paid_via = EXCLUDED.paid_via,
           payment_ref = EXCLUDED.payment_ref,
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [
          id,
          facilityId,
          String(b.patientId || ''),
          String(b.hospitalNumber || ''),
          String(b.patientName || ''),
          String(b.source || 'billing'),
          String(b.description || ''),
          Number(b.amountNgn || 0),
          String(b.status || 'unpaid'),
          String(b.orderId || ''),
          String(b.paidVia || ''),
          String(b.paymentRef || ''),
          JSON.stringify(b),
        ]
      );
    }
  }

  // 3) Inpatient Bed Board
  if (key === 'medcore_os_bed_board_v1' && typeof value === 'object') {
    const beds = Array.isArray((value as any).beds) ? (value as any).beds : Array.isArray(value) ? value : [];
    for (const raw of beds.slice(0, 200)) {
      if (!raw || typeof raw !== 'object') continue;
      const b = raw as Record<string, any>;
      const id = String(b.id || `${b.ward || 'WARD'}-${b.bedNo || '1'}`).trim();
      await c.query(
        `INSERT INTO inpatient_beds (
           id, facility_id, ward, bed_no, status, patient_id, patient_name, hospital_number, diagnosis, doctor, payload, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
         ON CONFLICT (facility_id, id) DO UPDATE SET
           status = EXCLUDED.status,
           patient_id = EXCLUDED.patient_id,
           patient_name = EXCLUDED.patient_name,
           hospital_number = EXCLUDED.hospital_number,
           diagnosis = EXCLUDED.diagnosis,
           doctor = EXCLUDED.doctor,
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [
          id,
          facilityId,
          String(b.ward || 'General'),
          String(b.bedNo || id),
          String(b.status || 'available'),
          String(b.patientId || ''),
          String(b.patient || ''),
          String(b.hospitalNumber || ''),
          String(b.diagnosis || ''),
          String(b.doctor || ''),
          JSON.stringify(b),
        ]
      );
    }
  }

  // 4) Vital Signs
  if ((key === 'medcore_os_vitals_v1' || key === 'clinical_vitals') && Array.isArray(value)) {
    for (const raw of value.slice(0, 150)) {
      if (!raw || typeof raw !== 'object') continue;
      const v = raw as Record<string, any>;
      const id = String(v.id || `VIT-${v.patientId || 'PT'}-${v.recordedAt || Date.now()}`).trim();
      await c.query(
        `INSERT INTO vital_signs (
           id, facility_id, patient_id, hospital_number, encounter_id, bp, pulse, temp, spo2, weight, urgency, recorded_by, payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
         ON CONFLICT (facility_id, id) DO UPDATE SET
           bp = EXCLUDED.bp,
           pulse = EXCLUDED.pulse,
           temp = EXCLUDED.temp,
           spo2 = EXCLUDED.spo2,
           weight = EXCLUDED.weight,
           urgency = EXCLUDED.urgency,
           payload = EXCLUDED.payload`,
        [
          id,
          facilityId,
          String(v.patientId || ''),
          String(v.hospitalNumber || ''),
          String(v.encounterId || ''),
          String(v.bp || v.bloodPressure || ''),
          Number(v.pulse || v.heartRate || 0) || null,
          Number(v.temp || v.temperature || 0) || null,
          Number(v.spo2 || 0) || null,
          Number(v.weight || 0) || null,
          String(v.urgency || 'routine'),
          String(v.recordedBy || v.triagedBy || ''),
          JSON.stringify(v),
        ]
      );
    }
  }

  // 5) Reception Visits & Queue
  if (key === 'medcore_os_reception_ops_v2' && value && typeof value === 'object') {
    const visits = Array.isArray((value as any).visits) ? (value as any).visits : [];
    for (const raw of visits.slice(0, 250)) {
      if (!raw || typeof raw !== 'object') continue;
      const v = raw as Record<string, any>;
      const id = String(v.id || '').trim();
      if (!id) continue;
      await c.query(
        `INSERT INTO reception_visits (
           id, facility_id, patient_id, hospital_number, patient_name, queue_number,
           department, doctor, status, payment_status, visit_type, payload, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW())
         ON CONFLICT (facility_id, id) DO UPDATE SET
           status = EXCLUDED.status,
           payment_status = EXCLUDED.payment_status,
           department = EXCLUDED.department,
           doctor = EXCLUDED.doctor,
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [
          id,
          facilityId,
          String(v.patientId || ''),
          String(v.hospitalNumber || ''),
          String(v.patientName || ''),
          String(v.queueNumber || ''),
          String(v.department || ''),
          String(v.doctor || ''),
          String(v.status || 'waiting'),
          String(v.paymentStatus || 'unpaid'),
          String(v.visitType || 'walkin'),
          JSON.stringify(v),
        ]
      );
    }
  }

  // 6) Front Desk <-> Accounts Pending Payment Requests
  if (key === 'medcore_os_fd_accounts_requests_v1' && Array.isArray(value)) {
    for (const raw of value.slice(0, 250)) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, any>;
      const id = String(r.id || '').trim();
      if (!id) continue;
      await c.query(
        `INSERT INTO accounts_requests (
           id, facility_id, patient_id, hospital_number, patient_name, amount_ngn,
           purpose, status, invoice_number, paid_reference, paid_via, payload, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW())
         ON CONFLICT (facility_id, id) DO UPDATE SET
           status = EXCLUDED.status,
           paid_reference = EXCLUDED.paid_reference,
           paid_via = EXCLUDED.paid_via,
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [
          id,
          facilityId,
          String(r.patientId || ''),
          String(r.hospitalNumber || ''),
          String(r.patientName || ''),
          Number(r.amountNgn || 0),
          String(r.purpose || ''),
          String(r.status || 'awaiting_payment'),
          String(r.invoiceNumber || ''),
          String(r.paidReference || ''),
          String(r.paidVia || ''),
          JSON.stringify(r),
        ]
      );
    }
  }

  // 7) Notifications
  if (key === 'medcore_os_notifications_v1' && Array.isArray(value)) {
    for (const raw of value.slice(0, 200)) {
      if (!raw || typeof raw !== 'object') continue;
      const n = raw as Record<string, any>;
      const id = String(n.id || '').trim();
      if (!id) continue;
      await c.query(
        `INSERT INTO notifications (
           id, facility_id, level, title, body, module, patient_id, role_hint, target_staff, read, payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           read = EXCLUDED.read,
           payload = EXCLUDED.payload`,
        [
          id,
          facilityId,
          String(n.level || 'info'),
          String(n.title || ''),
          String(n.body || ''),
          String(n.module || ''),
          String(n.patientId || ''),
          String(n.roleHint || ''),
          String(n.targetStaff || ''),
          Boolean(n.read),
          JSON.stringify(n),
        ]
      );
    }
  }

  // 8) Staff Face Biometric Templates
  if (key === 'medcore_staff_face_biometrics_v1' && value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [badgeKey, raw] of Object.entries(value as Record<string, any>).slice(0, 200)) {
      if (!raw || typeof raw !== 'object') continue;
      const badgeId = String(raw.badgeId || badgeKey || '').trim().toUpperCase();
      if (!badgeId) continue;
      await c.query(
        `INSERT INTO staff_biometrics (
           badge_id, facility_id, staff_name, descriptor, version, updated_at
         ) VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
         ON CONFLICT (facility_id, badge_id) DO UPDATE SET
           staff_name = EXCLUDED.staff_name,
           descriptor = EXCLUDED.descriptor,
           version = EXCLUDED.version,
           updated_at = NOW()`,
        [
          badgeId,
          facilityId,
          String(raw.staffName || ''),
          JSON.stringify(Array.isArray(raw.descriptor) ? raw.descriptor : []),
          Number(raw.version || 1),
        ]
      );
    }
  }
}
