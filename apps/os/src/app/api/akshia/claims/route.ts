import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  assembleMonthlyClaimBatch,
  computeReimbursementMetrics,
  evaluateAndBuildClaim,
  type ClaimBatchSummary,
  type ClaimRecord,
} from '../../../../lib/akshiaClaimsEngine';
import {
  ensureSchema,
  isPostgresConfigured,
  withTenantClient,
} from '../../../../lib/db/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLAIMS_VAULT = path.join(os.tmpdir(), 'medcore-akshia-claims-v1.json');

interface ClaimsStoreState {
  claims: ClaimRecord[];
  batches: ClaimBatchSummary[];
}

let memState: ClaimsStoreState | null = null;

function readState(): ClaimsStoreState {
  if (memState) return { claims: [...memState.claims], batches: [...memState.batches] };
  try {
    if (fs.existsSync(CLAIMS_VAULT)) {
      const parsed = JSON.parse(fs.readFileSync(CLAIMS_VAULT, 'utf8')) as Partial<ClaimsStoreState>;
      memState = {
        claims: Array.isArray(parsed.claims) ? parsed.claims : [],
        batches: Array.isArray(parsed.batches) ? parsed.batches : [],
      };
      return { claims: [...memState.claims], batches: [...memState.batches] };
    }
  } catch {
    // ignore
  }
  memState = { claims: [], batches: [] };
  return { claims: [], batches: [] };
}

function writeState(next: ClaimsStoreState): void {
  memState = next;
  try {
    fs.writeFileSync(CLAIMS_VAULT, JSON.stringify(next), 'utf8');
  } catch {
    // ignore
  }
}

async function upsertRelationalClaims(facilityId: string, claims: ClaimRecord[], batches: ClaimBatchSummary[]): Promise<void> {
  if (!isPostgresConfigured() || !facilityId) return;
  try {
    await ensureSchema();
    await withTenantClient(facilityId, async (c) => {
      for (const clm of claims.filter((x) => x.facilityId === facilityId)) {
        await c.query(
          `INSERT INTO akshia_claims (
             id, facility_id, claim_number, scheme, patient_name, enrollee_id, icd11_code,
             diagnosis, authorization_code, encounter_date, total_amount_ngn, paid_amount_ngn,
             readiness_score, status, batch_id, payload, submitted_at, paid_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13,$14,$15,$16::jsonb,$17::timestamptz,$18::timestamptz,NOW())
           ON CONFLICT (facility_id, id) DO UPDATE SET
             status = EXCLUDED.status,
             batch_id = EXCLUDED.batch_id,
             paid_amount_ngn = EXCLUDED.paid_amount_ngn,
             paid_at = EXCLUDED.paid_at,
             submitted_at = EXCLUDED.submitted_at,
             payload = EXCLUDED.payload,
             updated_at = NOW()`,
          [
            clm.id,
            facilityId,
            clm.claimNumber,
            clm.scheme,
            clm.patientName,
            clm.enrolleeId,
            clm.icd11Code,
            clm.diagnosis,
            clm.authorizationCode || null,
            clm.encounterDate || null,
            clm.totalAmountNgn,
            clm.paidAmountNgn ?? null,
            clm.readinessScore,
            clm.status,
            clm.batchId || null,
            JSON.stringify(clm),
            clm.submittedAt || null,
            clm.paidAt || null,
          ]
        );
      }
      for (const b of batches.filter((x) => x.facilityId === facilityId)) {
        await c.query(
          `INSERT INTO akshia_claim_batches (
             batch_id, facility_id, period_month, scheme, claim_count, clean_count,
             blocked_count, total_amount_ngn, clean_amount_ngn, status, signature_hash, payload
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
           ON CONFLICT (facility_id, batch_id) DO UPDATE SET
             status = EXCLUDED.status,
             payload = EXCLUDED.payload`,
          [
            b.batchId,
            facilityId,
            b.periodMonth,
            b.scheme,
            b.claimCount,
            b.cleanCount,
            b.blockedCount,
            b.totalAmountNgn,
            b.cleanAmountNgn,
            b.status,
            b.signatureHash,
            JSON.stringify(b),
          ]
        );
      }
    });
  } catch {
    // fail soft to server vault
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT').trim().toUpperCase();
  const state = readState();
  let claims = state.claims.filter((c) => !facilityId || c.facilityId === facilityId);
  let batches = state.batches.filter((b) => !facilityId || b.facilityId === facilityId);

  if (isPostgresConfigured() && facilityId) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const cr = await c.query<{ payload: ClaimRecord }>(
          `SELECT payload FROM akshia_claims WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 300`,
          [facilityId]
        );
        const br = await c.query<{ payload: ClaimBatchSummary }>(
          `SELECT payload FROM akshia_claim_batches WHERE facility_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [facilityId]
        );
        if (cr.rows.length > 0) claims = cr.rows.map((r) => r.payload);
        if (br.rows.length > 0) batches = br.rows.map((r) => r.payload);
      });
    } catch {
      // keep vault view
    }
  }

  return NextResponse.json({
    ok: true,
    facilityId,
    claims,
    batches,
    metrics: computeReimbursementMetrics(claims),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'add_claim' | 'submit_batch';
      facilityId?: string;
      periodMonth?: string;
      claim?: {
        scheme?: ClaimRecord['scheme'];
        patientName?: string;
        enrolleeId?: string;
        icd11Code?: string;
        diagnosis?: string;
        authorizationCode?: string;
        encounterDate?: string;
        totalAmountNgn?: number;
        lineItems?: Array<{ description: string; amountNgn: number; category?: string }>;
      };
    };

    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const state = readState();

    if (body.action === 'submit_batch') {
      const periodMonth = String(body.periodMonth || new Date().toISOString().slice(0, 7));
      const { batch, includedClaims, blockedClaims } = assembleMonthlyClaimBatch(
        state.claims,
        facilityId,
        periodMonth
      );

      if (includedClaims.length > 0) {
        const updatedMap = new Map(includedClaims.map((c) => [c.id, c]));
        state.claims = state.claims.map((c) => updatedMap.get(c.id) || c);
        state.batches = [batch, ...state.batches].slice(0, 100);
        writeState(state);
        await upsertRelationalClaims(facilityId, includedClaims, [batch]);
      }

      return NextResponse.json({
        ok: true,
        batch,
        submittedCount: includedClaims.length,
        blockedCount: blockedClaims.length,
        blockedClaims,
        metrics: computeReimbursementMetrics(state.claims.filter((c) => c.facilityId === facilityId)),
      });
    }

    const c = body.claim;
    if (!c || !c.patientName) {
      return NextResponse.json({ ok: false, error: 'Claim payload with patientName is required.' }, { status: 400 });
    }

    const record = evaluateAndBuildClaim({
      facilityId,
      scheme: c.scheme || 'AKSHIA',
      patientName: String(c.patientName),
      enrolleeId: String(c.enrolleeId || ''),
      icd11Code: String(c.icd11Code || ''),
      diagnosis: String(c.diagnosis || ''),
      authorizationCode: c.authorizationCode,
      encounterDate: c.encounterDate,
      lineItems: c.lineItems,
      totalAmountNgn: Number(c.totalAmountNgn || 0),
    });

    state.claims = [record, ...state.claims].slice(0, 500);
    writeState(state);
    await upsertRelationalClaims(facilityId, [record], []);

    return NextResponse.json(
      {
        ok: true,
        claim: record,
        metrics: computeReimbursementMetrics(state.claims.filter((x) => x.facilityId === facilityId)),
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to process AKSHIA claim operation.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      status?: 'paid' | 'queried';
      paidAmountNgn?: number;
      queryReason?: string;
    };
    if (!body.id || !body.status) {
      return NextResponse.json({ ok: false, error: 'Claim id and target status are required.' }, { status: 400 });
    }

    const state = readState();
    const idx = state.claims.findIndex((c) => c.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: `Claim ${body.id} not found.` }, { status: 404 });
    }

    const existing = state.claims[idx];
    const nowIso = new Date().toISOString();
    state.claims[idx] = {
      ...existing,
      status: body.status,
      ...(body.status === 'paid'
        ? { paidAt: nowIso, paidAmountNgn: Number(body.paidAmountNgn ?? existing.totalAmountNgn), queryReason: undefined }
        : { queryReason: body.queryReason || 'Missing supporting clinical detail requested by payer.' }),
    };

    writeState(state);
    await upsertRelationalClaims(existing.facilityId, [state.claims[idx]], []);

    return NextResponse.json({
      ok: true,
      claim: state.claims[idx],
      metrics: computeReimbursementMetrics(state.claims.filter((x) => x.facilityId === existing.facilityId)),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to reconcile claim remittance.' },
      { status: 500 }
    );
  }
}
