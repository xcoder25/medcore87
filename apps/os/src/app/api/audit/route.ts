import { NextRequest, NextResponse } from 'next/server';
import {
  isPostgresConfigured,
  ensureSchema,
  withTenantClient,
  computeAuditRowHash,
} from '../../../lib/db/postgres';
import { publishFacilitySseEvent } from '../../../lib/sseBroker';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ServerAuditEntry {
  id: string;
  at: string;
  facilityId: string;
  actor: string;
  actorBadge?: string;
  category: 'clinical' | 'financial' | 'access' | 'pharmacy' | 'records';
  severity: 'normal' | 'notable' | 'critical';
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
  prevHash: string;
  rowHash: string;
}

const VAULT_FILE = path.join(os.tmpdir(), 'medcore-audit-ledger-v1.json');
let memLedger: Record<string, ServerAuditEntry[]> | null = null;

function readVault(): Record<string, ServerAuditEntry[]> {
  if (memLedger) return memLedger;
  try {
    if (fs.existsSync(VAULT_FILE)) {
      memLedger = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
      return memLedger!;
    }
  } catch {
    /* ignore */
  }
  memLedger = {};
  return memLedger;
}

function writeVault(data: Record<string, ServerAuditEntry[]>): void {
  memLedger = data;
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data), 'utf8');
  } catch {
    /* ignore */
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (
    req.nextUrl.searchParams.get('facilityId') ||
    req.headers.get('x-medcore-facility-id') ||
    'IGH-EKT'
  )
    .trim()
    .toUpperCase();
  const limit = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '200', 10)));

  const vault = readVault();
  let entries: ServerAuditEntry[] = [...(vault[facilityId] || [])];

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{
          id: string;
          facility_id: string;
          actor: string;
          actor_badge: string | null;
          category: string | null;
          severity: string | null;
          action: string;
          entity: string | null;
          entity_id: string | null;
          detail: string | null;
          prev_hash: string;
          row_hash: string;
          created_at: Date;
        }>(
          `SELECT id, facility_id, actor, actor_badge, category, severity, action, entity, entity_id, detail, prev_hash, row_hash, created_at
           FROM clinical_audit_ledger
           WHERE facility_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [facilityId, limit]
        );
        if (res.rows.length > 0) {
          entries = res.rows.map((r) => ({
            id: r.id,
            at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            facilityId: r.facility_id,
            actor: r.actor,
            actorBadge: r.actor_badge || undefined,
            category: (r.category as ServerAuditEntry['category']) || 'clinical',
            severity: (r.severity as ServerAuditEntry['severity']) || 'normal',
            action: r.action,
            entity: r.entity || undefined,
            entityId: r.entity_id || undefined,
            detail: r.detail || undefined,
            prevHash: r.prev_hash,
            rowHash: r.row_hash,
          }));
        }
      });
    } catch (e) {
      console.warn('[api/audit GET] Postgres fallback to vault:', (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    facilityId,
    count: entries.length,
    entries: entries.slice(0, limit),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const facilityId = String(
      body.facilityId || req.headers.get('x-medcore-facility-id') || 'IGH-EKT'
    )
      .trim()
      .toUpperCase();

    const id = String(body.id || `AUD-${Date.now().toString(36).toUpperCase()}`);
    const at = String(body.at || new Date().toISOString());
    const actor = String(body.actor || req.headers.get('x-medcore-staff-name') || 'System').trim();
    const actorBadge = String(body.actorBadge || req.headers.get('x-medcore-staff-badge') || '').trim();
    const category = (body.category || 'clinical') as ServerAuditEntry['category'];
    const severity = (body.severity || 'normal') as ServerAuditEntry['severity'];
    const action = String(body.action || 'CLINICAL_EVENT').trim();
    const entity = body.entity ? String(body.entity) : undefined;
    const entityId = body.entityId ? String(body.entityId) : undefined;
    const detail = body.detail ? String(body.detail) : undefined;

    const vault = readVault();
    const facList = vault[facilityId] || [];
    const latestPrevHash = facList[0]?.rowHash || 'GENESIS_00000000000000000000000000000000';

    const prevHash = String(body.prevHash || latestPrevHash);
    const rowHash = computeAuditRowHash({
      prevHash,
      at,
      facilityId,
      actor,
      actorBadge,
      action,
      entity,
      entityId,
      detail,
    });

    const entry: ServerAuditEntry = {
      id,
      at,
      facilityId,
      actor,
      actorBadge: actorBadge || undefined,
      category,
      severity,
      action,
      entity,
      entityId,
      detail,
      prevHash,
      rowHash,
    };

    vault[facilityId] = [entry, ...facList.filter((x) => x.id !== id)].slice(0, 2000);
    writeVault(vault);

    if (isPostgresConfigured()) {
      try {
        await ensureSchema();
        await withTenantClient(facilityId, async (c) => {
          await c.query(
            `INSERT INTO clinical_audit_ledger (
               id, facility_id, actor, actor_badge, category, severity,
               action, entity, entity_id, detail, prev_hash, row_hash, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz)
             ON CONFLICT (facility_id, id) DO NOTHING`,
            [
              entry.id,
              entry.facilityId,
              entry.actor,
              entry.actorBadge || null,
              entry.category,
              entry.severity,
              entry.action,
              entry.entity || null,
              entry.entityId || null,
              entry.detail || null,
              entry.prevHash,
              entry.rowHash,
              entry.at,
            ]
          );
        });
      } catch (e) {
        console.warn('[api/audit POST] Postgres write warning:', (e as Error).message);
      }
    }

    publishFacilitySseEvent({
      facilityId,
      key: 'medcore_os_audit_log_v1',
      value: vault[facilityId].slice(0, 200),
      updatedAt: at,
      actor,
    });

    return NextResponse.json({
      ok: true,
      entry,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
