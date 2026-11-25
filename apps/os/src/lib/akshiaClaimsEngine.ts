/**
 * Automated AKSHIA / NHIA / BHCPF Claims Batcher & Reimbursement Tracker (`apps/os`).
 * Enforces zero-denial claim scrubbing before monthly bundle transmission.
 */
import { auditHmoClaimReadiness } from './predictiveOpsEngine';

export interface ClaimRecord {
  id: string;
  claimNumber: string;
  facilityId: string;
  scheme: 'AKSHIA' | 'NHIA' | 'BHCPF' | 'Private HMO';
  patientName: string;
  enrolleeId: string;
  icd11Code: string;
  diagnosis: string;
  authorizationCode?: string;
  encounterDate: string;
  lineItems: Array<{ description: string; amountNgn: number; category?: string }>;
  totalAmountNgn: number;
  readinessScore: number;
  denialRisks: Array<{
    code: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    fixAction: string;
  }>;
  status: 'draft' | 'vetted_ready' | 'submitted' | 'queried' | 'paid';
  batchId?: string;
  submittedAt?: string;
  paidAt?: string;
  paidAmountNgn?: number;
  queryReason?: string;
}

export interface ClaimBatchSummary {
  batchId: string;
  facilityId: string;
  periodMonth: string;
  scheme: string;
  claimCount: number;
  cleanCount: number;
  blockedCount: number;
  totalAmountNgn: number;
  cleanAmountNgn: number;
  createdAt: string;
  status: 'submitted' | 'partially_paid' | 'settled';
  signatureHash: string;
}

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function evaluateAndBuildClaim(input: {
  facilityId: string;
  scheme?: ClaimRecord['scheme'];
  patientName: string;
  enrolleeId: string;
  icd11Code: string;
  diagnosis: string;
  authorizationCode?: string;
  encounterDate?: string;
  lineItems?: Array<{ description: string; amountNgn: number; category?: string }>;
  totalAmountNgn: number;
}): ClaimRecord {
  const lineItems =
    input.lineItems && input.lineItems.length > 0
      ? input.lineItems
      : [{ description: input.diagnosis || 'Clinical Encounter', amountNgn: Number(input.totalAmountNgn || 0), category: 'opd' }];
  const totalAmountNgn = Number(
    input.totalAmountNgn || lineItems.reduce((s, l) => s + Number(l.amountNgn || 0), 0)
  );

  const audit = auditHmoClaimReadiness({
    patientName: input.patientName,
    insuranceProvider: input.scheme || 'AKSHIA',
    nhiaNumber: input.enrolleeId,
    icd11Code: input.icd11Code,
    diagnosis: input.diagnosis,
    authorizationCode: input.authorizationCode,
    totalAmountNgn,
    lineItems,
  });

  const encounterDate = input.encounterDate || new Date().toISOString().slice(0, 10);
  const hash = stableHash(
    `${input.facilityId}|${input.enrolleeId}|${input.icd11Code}|${totalAmountNgn}|${encounterDate}`
  );

  return {
    id: `CLM-${hash}`,
    claimNumber: `${(input.scheme || 'AKSHIA').slice(0, 3).toUpperCase()}-${hash}`,
    facilityId: input.facilityId,
    scheme: input.scheme || 'AKSHIA',
    patientName: input.patientName,
    enrolleeId: input.enrolleeId,
    icd11Code: input.icd11Code,
    diagnosis: input.diagnosis,
    authorizationCode: input.authorizationCode,
    encounterDate,
    lineItems,
    totalAmountNgn,
    readinessScore: audit.readinessScore,
    denialRisks: audit.denialRisks,
    status: audit.readinessScore >= 85 && audit.denialRisks.length === 0 ? 'vetted_ready' : 'draft',
  };
}

export function assembleMonthlyClaimBatch(
  claims: ClaimRecord[],
  facilityId: string,
  periodMonth: string,
  nowIso = new Date().toISOString()
): {
  batch: ClaimBatchSummary;
  includedClaims: ClaimRecord[];
  blockedClaims: ClaimRecord[];
} {
  const candidates = claims.filter((c) => c.facilityId === facilityId && (c.status === 'vetted_ready' || c.status === 'draft'));
  const includedClaims: ClaimRecord[] = [];
  const blockedClaims: ClaimRecord[] = [];

  for (const c of candidates) {
    if (c.readinessScore >= 85 && c.denialRisks.filter((r) => r.severity === 'high').length === 0) {
      includedClaims.push(c);
    } else {
      blockedClaims.push(c);
    }
  }

  const cleanAmountNgn = includedClaims.reduce((s, c) => s + Number(c.totalAmountNgn || 0), 0);
  const totalAmountNgn = candidates.reduce((s, c) => s + Number(c.totalAmountNgn || 0), 0);
  const digestSeed = `${facilityId}|${periodMonth}|${includedClaims.map((c) => c.claimNumber).join(',')}|${nowIso}`;
  const hash = stableHash(digestSeed);
  const batchId = `BATCH-${periodMonth.replace(/[^0-9]/g, '')}-${hash.slice(0, 6)}`;

  const stampedIncluded = includedClaims.map((c) => ({
    ...c,
    status: 'submitted' as const,
    batchId,
    submittedAt: nowIso,
  }));

  return {
    batch: {
      batchId,
      facilityId,
      periodMonth,
      scheme: 'AKSHIA / NHIA Unified',
      claimCount: candidates.length,
      cleanCount: stampedIncluded.length,
      blockedCount: blockedClaims.length,
      totalAmountNgn,
      cleanAmountNgn,
      createdAt: nowIso,
      status: 'submitted',
      signatureHash: `SIG-${hash}-${stableHash(String(cleanAmountNgn))}`,
    },
    includedClaims: stampedIncluded,
    blockedClaims,
  };
}

export function computeReimbursementMetrics(claims: ClaimRecord[]) {
  const totalBilledNgn = claims.reduce((s, c) => s + Number(c.totalAmountNgn || 0), 0);
  const submitted = claims.filter((c) => c.status === 'submitted' || c.status === 'paid' || c.status === 'queried');
  const paid = claims.filter((c) => c.status === 'paid');
  const queried = claims.filter((c) => c.status === 'queried');
  const totalSubmittedNgn = submitted.reduce((s, c) => s + Number(c.totalAmountNgn || 0), 0);
  const totalPaidNgn = paid.reduce((s, c) => s + Number(c.paidAmountNgn ?? c.totalAmountNgn ?? 0), 0);
  const cleanRatePct = claims.length
    ? Math.round((claims.filter((c) => c.readinessScore >= 85).length / claims.length) * 100)
    : 100;

  let turnaroundSumDays = 0;
  let turnaroundCount = 0;
  for (const p of paid) {
    if (p.submittedAt && p.paidAt) {
      const days = Math.max(1, Math.round((Date.parse(p.paidAt) - Date.parse(p.submittedAt)) / 86_400_000));
      turnaroundSumDays += days;
      turnaroundCount += 1;
    }
  }

  return {
    totalClaims: claims.length,
    cleanRatePct,
    totalBilledNgn,
    totalSubmittedNgn,
    totalPaidNgn,
    paidCount: paid.length,
    queriedCount: queried.length,
    avgTurnaroundDays: turnaroundCount > 0 ? Math.round(turnaroundSumDays / turnaroundCount) : 0,
  };
}
