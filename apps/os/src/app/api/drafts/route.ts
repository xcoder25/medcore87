import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured, ensureSchema, query } from '../../../lib/db/postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Power-Outage-Resilient Form Drafts Cloud API.
 * Saves in-progress clinical and administrative forms (New Patient Registration,
 * Existing Patient Encounter, Nurse Triage Vitals, Doctor SOAP Notes, etc.)
 * directly to Cloud & On-Prem server storage so a power cut loses zero keystrokes.
 */

export interface StoredFormDraft {
  facilityId: string;
  formType: string;
  draftId: string;
  staffBadge?: string;
  step?: number;
  payload: unknown;
  updatedAt: string;
  expiresAt: string;
}

type DraftMap = Record<string, StoredFormDraft>;

const DRAFTS_FILE = path.join(os.tmpdir(), 'medcore-form-drafts-cloud.json');
let memDrafts: DraftMap | null = null;

function compositeKey(facilityId: string, formType: string, draftId: string): string {
  return `${facilityId}::${formType}::${draftId}`;
}

function getDraftStore(): DraftMap {
  if (memDrafts) return memDrafts;
  try {
    if (fs.existsSync(DRAFTS_FILE)) {
      const raw = fs.readFileSync(DRAFTS_FILE, 'utf8');
      memDrafts = JSON.parse(raw) as DraftMap;
      return memDrafts;
    }
  } catch {
    /* ignore */
  }
  memDrafts = {};
  return memDrafts;
}

function flushDraftStore(store: DraftMap): void {
  memDrafts = store;
  try {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(store), 'utf8');
  } catch {
    /* ignore */
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'DEFAULT').trim();
  const formType = (req.nextUrl.searchParams.get('formType') || '').trim();
  const draftId = (req.nextUrl.searchParams.get('draftId') || 'default').trim();

  if (!formType) {
    return NextResponse.json({ ok: false, error: 'formType required' }, { status: 400 });
  }

  const now = Date.now();
  let draft: StoredFormDraft | null = null;

  // 1) Check server vault
  const store = getDraftStore();
  const ck = compositeKey(facilityId, formType, draftId);
  const localHit = store[ck];
  if (localHit && new Date(localHit.expiresAt).getTime() > now) {
    draft = localHit;
  }

  // 2) Check Aurora PostgreSQL if configured
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      const res = await query<{
        facility_id: string;
        form_type: string;
        draft_id: string;
        staff_badge: string | null;
        step: number | null;
        payload: unknown;
        updated_at: Date;
        expires_at: Date;
      }>(
        `SELECT facility_id, form_type, draft_id, staff_badge, step, payload, updated_at, expires_at
         FROM form_drafts
         WHERE facility_id = $1 AND form_type = $2 AND draft_id = $3 AND expires_at > NOW()`,
        [facilityId, formType, draftId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0]!;
        const pgUpdated = new Date(row.updated_at).toISOString();
        if (!draft || pgUpdated >= draft.updatedAt) {
          draft = {
            facilityId: row.facility_id,
            formType: row.form_type,
            draftId: row.draft_id,
            staffBadge: row.staff_badge || undefined,
            step: row.step ?? 1,
            payload: row.payload,
            updatedAt: pgUpdated,
            expiresAt: new Date(row.expires_at).toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[api/drafts GET] Postgres warning:', (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    draft,
  });
}

export async function PUT(req: NextRequest) {
  let body: {
    facilityId?: string;
    formType?: string;
    draftId?: string;
    staffBadge?: string;
    step?: number;
    payload?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const facilityId = String(body.facilityId || 'DEFAULT').trim();
  const formType = String(body.formType || '').trim();
  const draftId = String(body.draftId || 'default').trim();
  const staffBadge = body.staffBadge ? String(body.staffBadge).trim() : undefined;
  const step = typeof body.step === 'number' ? body.step : 1;
  const payload = body.payload ?? {};

  if (!formType) {
    return NextResponse.json({ ok: false, error: 'formType required' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const record: StoredFormDraft = {
    facilityId,
    formType,
    draftId,
    staffBadge,
    step,
    payload,
    updatedAt: nowIso,
    expiresAt: expiresIso,
  };

  // 1) Save to server vault
  const store = getDraftStore();
  store[compositeKey(facilityId, formType, draftId)] = record;
  flushDraftStore(store);

  // 2) Save to Aurora PostgreSQL if configured
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await query(
        `INSERT INTO form_drafts (facility_id, form_type, draft_id, staff_badge, step, payload, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW() + INTERVAL '24 hours')
         ON CONFLICT (facility_id, form_type, draft_id)
         DO UPDATE SET
           staff_badge = EXCLUDED.staff_badge,
           step = EXCLUDED.step,
           payload = EXCLUDED.payload,
           updated_at = NOW(),
           expires_at = NOW() + INTERVAL '24 hours'`,
        [facilityId, formType, draftId, staffBadge || null, step, JSON.stringify(payload)]
      );
    } catch (e) {
      console.warn('[api/drafts PUT] Postgres warning:', (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    draft: record,
  });
}

/** Support navigator.sendBeacon on abrupt power cut / page unload */
export async function POST(req: NextRequest) {
  return PUT(req);
}

export async function DELETE(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'DEFAULT').trim();
  const formType = (req.nextUrl.searchParams.get('formType') || '').trim();
  const draftId = (req.nextUrl.searchParams.get('draftId') || 'default').trim();

  if (!formType) {
    return NextResponse.json({ ok: false, error: 'formType required' }, { status: 400 });
  }

  const store = getDraftStore();
  const ck = compositeKey(facilityId, formType, draftId);
  if (ck in store) {
    delete store[ck];
    flushDraftStore(store);
  }

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await query(
        `DELETE FROM form_drafts WHERE facility_id = $1 AND form_type = $2 AND draft_id = $3`,
        [facilityId, formType, draftId]
      );
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true, deleted: true });
}
