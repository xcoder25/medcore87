import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, ensureSchema, query } from '../../../../lib/db/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-side Cloud & On-Prem Facility State Sync API.
 * Replaces browser localStorage with server-persisted state (Aurora PostgreSQL + Server Vault fallback).
 */

type FacilityStateMap = Record<string, Record<string, { value: unknown; updatedAt: string }>>;

const SERVER_STORE_FILE = path.join(os.tmpdir(), 'medcore-facility-cloud-kv.json');
let memStore: FacilityStateMap | null = null;

function getServerStore(): FacilityStateMap {
  if (memStore) return memStore;
  try {
    if (fs.existsSync(SERVER_STORE_FILE)) {
      const raw = fs.readFileSync(SERVER_STORE_FILE, 'utf8');
      memStore = JSON.parse(raw) as FacilityStateMap;
      return memStore;
    }
  } catch {
    /* ignore */
  }
  memStore = {};
  return memStore;
}

function flushServerStore(store: FacilityStateMap): void {
  memStore = store;
  try {
    fs.writeFileSync(SERVER_STORE_FILE, JSON.stringify(store), 'utf8');
  } catch {
    /* ignore read-only fs */
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'DEFAULT').trim();
  const singleKey = (req.nextUrl.searchParams.get('key') || '').trim();

  const data: Record<string, unknown> = {};
  let latestUpdatedAt: string | null = null;

  // 1) Read from server vault fallback first
  const store = getServerStore();
  const facBag = store[facilityId] || {};
  if (singleKey) {
    if (facBag[singleKey]) {
      data[singleKey] = facBag[singleKey].value;
      latestUpdatedAt = facBag[singleKey].updatedAt;
    }
  } else {
    for (const [k, entry] of Object.entries(facBag)) {
      data[k] = entry.value;
      if (!latestUpdatedAt || entry.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = entry.updatedAt;
      }
    }
  }

  // 2) Overlay from Aurora PostgreSQL if configured
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      if (singleKey) {
        const res = await query<{ key: string; value: unknown; updated_at: Date }>(
          `SELECT key, value, updated_at FROM facility_kv WHERE facility_id = $1 AND key = $2`,
          [facilityId, singleKey]
        );
        for (const row of res.rows) {
          data[row.key] = row.value;
          const iso = row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString();
          latestUpdatedAt = iso;
        }
      } else {
        const res = await query<{ key: string; value: unknown; updated_at: Date }>(
          `SELECT key, value, updated_at FROM facility_kv WHERE facility_id = $1`,
          [facilityId]
        );
        for (const row of res.rows) {
          data[row.key] = row.value;
          const iso = row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString();
          if (!latestUpdatedAt || iso > latestUpdatedAt) {
            latestUpdatedAt = iso;
          }
        }
      }
    } catch (e) {
      console.warn('[api/facility/sync GET] Postgres fallback to server vault:', (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    facilityId,
    data,
    updatedAt: latestUpdatedAt || new Date().toISOString(),
  });
}

export async function PUT(req: NextRequest) {
  let body: {
    facilityId?: string;
    data?: Record<string, unknown>;
    key?: string;
    value?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const facilityId = String(body.facilityId || req.nextUrl.searchParams.get('facilityId') || 'DEFAULT').trim();
  const entries: Record<string, unknown> = { ...(body.data || {}) };
  if (body.key) {
    entries[String(body.key)] = body.value;
  }

  const keys = Object.keys(entries);
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, facilityId, updated: 0 });
  }

  const nowIso = new Date().toISOString();

  // 1) Persist in server vault
  const store = getServerStore();
  if (!store[facilityId]) store[facilityId] = {};
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined) continue;
    store[facilityId][k] = { value: v, updatedAt: nowIso };
  }
  flushServerStore(store);

  // 2) Persist in Aurora PostgreSQL if configured
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      for (const [k, v] of Object.entries(entries)) {
        if (v === undefined) continue;
        await query(
          `INSERT INTO facility_kv (facility_id, key, value, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (facility_id, key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [facilityId, k, JSON.stringify(v)]
        );
      }
    } catch (e) {
      console.warn('[api/facility/sync PUT] Postgres write warning:', (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    facilityId,
    updated: keys.length,
    updatedAt: nowIso,
  });
}

export async function POST(req: NextRequest) {
  return PUT(req);
}

export async function DELETE(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'DEFAULT').trim();
  const key = (req.nextUrl.searchParams.get('key') || '').trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });
  }

  const store = getServerStore();
  if (store[facilityId] && key in store[facilityId]) {
    delete store[facilityId][key];
    flushServerStore(store);
  }

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await query(`DELETE FROM facility_kv WHERE facility_id = $1 AND key = $2`, [facilityId, key]);
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true, facilityId, deleted: key });
}
