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

async function mirrorClaims(facilityId: string, state: ClaimsStoreState): Promise<void> {
  if (!isPostgresConfigured() || !facilityId) return;
  try {
    await ensureSchema();
    await withTenantClient(facilityId, async (c) => {
      await c.query(
        `INSERT INTO facility_kv (facility_id, key, value, updated_at)
         VALUES ($1, 'medcore_akshia_claims_v1', $2::jsonb, NOW())
         ON CONFLICT (facility_id, key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [
          facilityId,
          JSON.stringify({
            claims: state.claims.filter((x) => x.facilityId === facilityId),
            batches: state.batches.filter((x) => x.facilityId === facilityId),
          }),
        ]
      );
    });
  } catch {
    // fail soft
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT').trim().toUpperCase();
  const state = readState();
  const claims = state.claims.filter((c) => !facilityId || c.facilityId === facilityId);
  const batches = state.batches.filter((b) => !facilityId || b.facilityId === facilityId);

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
        await mirrorClaims(facilityId, state);
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
    await mirrorClaims(facilityId, state);

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
    await mirrorClaims(existing.facilityId, state);

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
