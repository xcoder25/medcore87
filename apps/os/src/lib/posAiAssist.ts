/**
 * POS AI assist — behind-the-scenes intelligence for the payment desk.
 * Never mutates money without human confirm; only recommends.
 */
import type { FacilityPatient } from './patientRegistryStore';
import type {
  ReceptionPayment,
  ReceptionVisit,
  PaymentMethod,
} from './receptionOpsStore';
import { CONSULT_FEES } from './receptionConstants';

export type PosRiskLevel = 'low' | 'medium' | 'high';

export interface PosAiSuggestion {
  id: string;
  severity: 'info' | 'success' | 'warn' | 'attention';
  title: string;
  detail: string;
  suggestedAmount?: number;
  suggestedMethod?: PaymentMethod;
  suggestedPurpose?: string;
  flags: string[];
  risk: PosRiskLevel;
  nextBestAction: string;
}

export interface PosAiDeskInsight {
  pendingQueueValue: number;
  unpaidTickets: number;
  avgTicket: number;
  cashSharePct: number;
  hmoSharePct: number;
  anomalies: string[];
  suggestions: PosAiSuggestion[];
  shiftSummary: string;
}

function money(n: number) {
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

/** Suggest amount/method from open visit + patient insurance */
export function suggestChargeForPatient(
  patient: FacilityPatient | null,
  openVisits: ReceptionVisit[],
  recentPayments: ReceptionPayment[]
): PosAiSuggestion | null {
  if (!patient) return null;
  const open = openVisits.filter(
    (v) => v.patientId === patient.id && v.status !== 'completed' && v.status !== 'cancelled'
  );
  const unpaid = open.filter((v) => v.paymentStatus === 'pending' || v.paymentStatus === 'partial');
  const fee = unpaid[0]
    ? CONSULT_FEES[unpaid[0].department] || unpaid[0].amount || 5000
    : CONSULT_FEES['General OPD'] || 5000;

  const flags: string[] = [];
  let risk: PosRiskLevel = 'low';
  let method: PaymentMethod = 'pos';
  let severity: PosAiSuggestion['severity'] = 'info';

  if (patient.insuranceProvider && patient.insuranceProvider !== 'NONE') {
    flags.push(`HMO on file: ${patient.insuranceProvider}`);
    method = 'hmo';
    severity = 'success';
  }
  if (unpaid.length > 1) {
    flags.push(`${unpaid.length} unpaid visits today`);
    risk = 'medium';
    severity = 'warn';
  }
  if (unpaid.length === 0 && open.length === 0) {
    flags.push('No open visit — walk-in charge or registration fee');
  }
  const prior = recentPayments.filter((p) => p.patientId === patient.id);
  if (prior.length >= 3) {
    flags.push('Frequent payer today — verify duplicate charge');
    risk = 'medium';
  }
  const sameAmt = prior.filter((p) => p.amount === fee && Date.now() - new Date(p.createdAt).getTime() < 10 * 60 * 1000);
  if (sameAmt.length) {
    flags.push('Same amount paid in last 10 min — possible double charge');
    risk = 'high';
    severity = 'attention';
  }

  return {
    id: `sug-${patient.id}`,
    severity,
    title: unpaid.length ? `Settle queue · ${unpaid[0].queueNumber}` : 'Suggested desk charge',
    detail: unpaid.length
      ? `${unpaid[0].department} · ${unpaid[0].visitType} · suggested ${money(fee)}`
      : `Standard OPD consult ${money(fee)}. Confirm services before recording.`,
    suggestedAmount: fee,
    suggestedMethod: method,
    suggestedPurpose: unpaid[0]?.department || 'Consultation',
    flags,
    risk,
    nextBestAction: risk === 'high' ? 'Review before recording' : method === 'hmo' ? 'Verify HMO then record' : 'Confirm amount & take payment',
  };
}

/** Desk-wide shift intelligence */
export function orchestratePosDesk(
  payments: ReceptionPayment[],
  visits: ReceptionVisit[]
): PosAiDeskInsight {
  const unpaid = visits.filter(
    (v) =>
      (v.paymentStatus === 'pending' || v.paymentStatus === 'partial') &&
      v.status !== 'completed' &&
      v.status !== 'cancelled'
  );
  const pendingQueueValue = unpaid.reduce(
    (s, v) => s + (v.amount || CONSULT_FEES[v.department] || 5000),
    0
  );
  const success = payments.filter((p) => p.status === 'success');
  const total = success.reduce((s, p) => s + p.amount, 0);
  const avgTicket = success.length ? total / success.length : 0;
  const cash = success.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const hmo = success.filter((p) => p.method === 'hmo').reduce((s, p) => s + p.amount, 0);
  const cashSharePct = total ? Math.round((cash / total) * 100) : 0;
  const hmoSharePct = total ? Math.round((hmo / total) * 100) : 0;

  const anomalies: string[] = [];
  if (unpaid.length >= 5) anomalies.push(`${unpaid.length} patients still unpaid in active queue`);
  if (cashSharePct >= 80 && total > 50000) anomalies.push('High cash mix — reconcile till before shift end');
  const big = success.filter((p) => p.amount >= 100000);
  if (big.length) anomalies.push(`${big.length} ticket(s) ≥ ₦100,000 — supervisor review recommended`);

  const suggestions: PosAiSuggestion[] = unpaid.slice(0, 5).map((v) => ({
    id: `q-${v.id}`,
    severity: 'warn' as const,
    title: `${v.queueNumber} · ${v.patientName}`,
    detail: `${v.department} · collect ${money(v.amount || CONSULT_FEES[v.department] || 5000)}`,
    suggestedAmount: v.amount || CONSULT_FEES[v.department] || 5000,
    suggestedMethod: 'pos' as PaymentMethod,
    suggestedPurpose: v.department,
    flags: [v.visitType, v.status],
    risk: 'medium' as PosRiskLevel,
    nextBestAction: 'Open charge for this patient',
  }));

  return {
    pendingQueueValue,
    unpaidTickets: unpaid.length,
    avgTicket,
    cashSharePct,
    hmoSharePct,
    anomalies,
    suggestions,
    shiftSummary:
      success.length === 0
        ? 'No collections yet this shift. Clear unpaid queue tickets as patients arrive.'
        : `${success.length} receipts · ${money(total)} collected · ${unpaid.length} still pending in queue (${money(pendingQueueValue)} exposure).`,
  };
}
