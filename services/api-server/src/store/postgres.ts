/**
 * Optional durable Postgres pool (AWS RDS / docker-compose).
 * When DATABASE_URL is unset, API continues on in-memory dataStore.
 */
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;
let initAttempted = false;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.MEDCORE_DATABASE_URL || undefined;
}

export function isPostgresEnabled(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getPool(): Pool | null {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) return null;
  if (initAttempted && !pool) return null;
  initAttempted = true;
  try {
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
    });
    pool.on('error', (err) => {
      console.error('[postgres] pool error', err.message);
    });
    console.log('[postgres] pool configured (DATABASE_URL set)');
    return pool;
  } catch (e: any) {
    console.error('[postgres] failed to init pool', e?.message);
    pool = null;
    return null;
  }
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T> | null> {
  const p = getPool();
  if (!p) return null;
  return p.query<T>(text, params);
}

export async function pingPostgres(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await pgQuery<{ ok: number }>('SELECT 1 AS ok');
    if (!res) return { ok: false, error: 'DATABASE_URL not set' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'ping failed' };
  }
}

/** Persist attendance punch (events only — no video). */
export async function insertAttendanceEvent(row: {
  id?: string;
  facilityId: string;
  staffId?: string;
  badgeId?: string;
  staffName?: string;
  direction: 'IN' | 'OUT';
  punchedAt: string;
  source: string;
  cameraId?: string;
  confidence?: number;
  note?: string;
}): Promise<boolean> {
  const res = await pgQuery(
    `INSERT INTO attendance_events
      (facility_id, staff_id, badge_id, staff_name, direction, punched_at, source, camera_id, confidence, note)
     VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,$10)
     `,
    [
      row.facilityId,
      row.staffId || null,
      row.badgeId || null,
      row.staffName || null,
      row.direction,
      row.punchedAt,
      row.source,
      row.cameraId || null,
      row.confidence ?? null,
      row.note || null,
    ]
  );
  return res !== null;
}

export async function listAttendanceEvents(facilityId?: string, limit = 100) {
  if (facilityId) {
    return pgQuery(
      `SELECT id, facility_id AS "facilityId", staff_id AS "staffId", badge_id AS "badgeId",
              staff_name AS "staffName", direction, punched_at AS "punchedAt", source,
              camera_id AS "cameraId", confidence, note
       FROM attendance_events
       WHERE facility_id = $1
       ORDER BY punched_at DESC
       LIMIT $2`,
      [facilityId, limit]
    );
  }
  return pgQuery(
    `SELECT id, facility_id AS "facilityId", staff_id AS "staffId", badge_id AS "badgeId",
            staff_name AS "staffName", direction, punched_at AS "punchedAt", source,
            camera_id AS "cameraId", confidence, note
     FROM attendance_events
     ORDER BY punched_at DESC
     LIMIT $1`,
    [limit]
  );
}
