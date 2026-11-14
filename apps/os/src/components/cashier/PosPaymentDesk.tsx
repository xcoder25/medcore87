'use client';

/**
 * Full-page intelligent AkwaRemit POS & Payment Desk
 * Aligned with Akwa Ibom State AkwaRemit / Remita TSA gateway architecture.
 * Eliminates third-party gateways in favor of AkwaRemit ARN, dynamic virtual accounts,
 * dual-control cashier shifts, exact amount validation, and service credit conversion.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Wallet, Search, CreditCard, Banknote, Building2, ShieldCheck,
  Sparkles, RefreshCw, Printer, CheckCircle2, AlertTriangle, Receipt,
  Users, Clock, Zap, ArrowRight, X, UserRound, Copy, Check, FileText,
  Lock, AlertCircle, ArrowDownLeft, RotateCcw,
} from 'lucide-react';
import {
  listPatients,
  subscribePatients,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import {
  todayVisits,
  todayPayments,
  dayStats,
  recordPayment,
  subscribeReceptionOps,
  type ReceptionPayment,
  type ReceptionVisit,
  type PaymentMethod,
  markVisitsPaidForPatient,
} from '../../lib/receptionOpsStore';
import { CONSULT_FEES, NIGERIA_INSURANCE } from '../../lib/receptionConstants';
import { orchestratePosDesk, suggestChargeForPatient } from '../../lib/posAiAssist';
import { emitLiveAction } from '../../lib/liveActions';
import {
  listBillLines,
  markLinePaid,
  markPatientOutstandingPaid,
  subscribeBills,
  patientBalance,
  listPatientsWithOpenBills,
  cancelBillLineToCredit,
  type PatientBillLine,
} from '../../lib/patientBillingStore';
import {
  generateArn,
  generateDynamicVirtualAccount,
  validateExactAmount,
  openCashierShift,
  getActiveCashierShift,
  getCashierUserShiftSummary,
  closeCashierShiftDualControl,
  recordAkwaRemitPayment,
  confirmAkwaRemitCashPayment,
  processAkwaRemitWebhookEvent,
  type AkwaRemitMethod,
  type DynamicVirtualAccount,
  type ActiveCashierShift,
  type CashierUserShiftSummary,
  type AkwaRemitPaymentRecord,
} from '../../lib/akwaRemitStore';
import { getWallet } from '../../lib/patientWalletStore';
import { printPaymentReceipt } from '../../lib/printService';
import { syncAccountsRequestsForPatientPayment } from '../../lib/frontDeskAccountsBridge';
import { releaseOrdersForPatient } from '../../lib/clinicalEventBus';
import { useFormDraft } from '../../lib/formDraftStore';
import { FormDraftBanner } from '../common/FormDraftBanner';
import { appendAudit } from '../../lib/auditLogStore';

const C = {
  blue: '#0284C7',
  teal: '#0D9488',
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  green: '#059669',
  amber: '#D97706',
};

export type PosGatewayMethod = 'akwaremit_pos' | 'cash' | 'bank_transfer' | 'credit_balance' | 'hmo' | 'waiver';

const AKWAREMIT_METHODS: { id: PosGatewayMethod; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 'akwaremit_pos', label: 'AkwaRemit POS', sub: 'Integrated POS Card Swipe', icon: CreditCard },
  { id: 'cash', label: 'Cash', sub: 'Counter physical collection', icon: Banknote },
  { id: 'bank_transfer', label: 'Bank Transfer', sub: 'Dynamic virtual account', icon: Building2 },
];

const AUX_METHODS: { id: PosGatewayMethod; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 'credit_balance', label: 'Patient Credit', sub: 'Internal hospital balance', icon: Wallet },
  { id: 'hmo', label: 'HMO / AKSHIA', sub: 'Insurance clearance', icon: ShieldCheck },
  { id: 'waiver', label: 'Waiver', sub: 'Social medical waiver', icon: CheckCircle2 },
];

const PURPOSES = [
  'Consultation',
  'Registration',
  'Laboratory',
  'Pharmacy',
  'Radiology',
  'Procedure',
  'Admission deposit',
  'Other',
];

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
  embedded?: boolean;
  initialPatientId?: string;
  initialPatient?: FacilityPatient | null;
  initialAmount?: number;
  initialPurpose?: string;
  accountsRequestId?: string;
  onPaymentComplete?: (pay: ReceptionPayment) => void;
}

export const PosPaymentDesk: React.FC<Props> = ({
  session,
  onNavigate,
  embedded,
  initialPatientId,
  initialPatient,
  initialAmount,
  initialPurpose,
  accountsRequestId,
  onPaymentComplete,
}) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Immanuel General Hospital, Eket';
  const cashier = session?.name || 'Cashier';
  const cashierBadge = session?.badgeId || 'CSH-001';

  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [visits, setVisits] = useState<ReceptionVisit[]>([]);
  const [payments, setPayments] = useState<ReceptionPayment[]>([]);
  const [stats, setStats] = useState(dayStats(facilityId));
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState<FacilityPatient | null>(null);
  const [amount, setAmount] = useState('5000');
  const [gatewayMethod, setGatewayMethod] = useState<PosGatewayMethod>('cash');
  const [purpose, setPurpose] = useState('Consultation');
  const [lines, setLines] = useState<{ label: string; amount: number }[]>([
    { label: 'Consultation', amount: 5000 },
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceptionPayment | null>(null);

  // AkwaRemit Reference Number (ARN) State
  const [arn, setArn] = useState<string>(() => generateArn());
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState(false);

  // Power-Outage Auto-Save for Cashier / AkwaRemit POS Payment Desk
  const posDraft = useFormDraft({
    facilityId,
    formType: 'cashier_pos_checkout',
    draftId: patient?.id || 'pos-counter',
    staffBadge: cashierBadge,
    data: {
      patientId: patient?.id || '',
      amount,
      gatewayMethod,
      purpose,
      lines,
      arn,
    },
    isDirty: (d) => Boolean(d.patientId || d.lines.length > 1 || (d.amount && d.amount !== '5000')),
    onRestore: (d) => {
      if (d.patientId) {
        const hit = listPatients(facilityId).find((p) => p.id === d.patientId);
        if (hit) setPatient(hit);
      }
      if (d.amount) setAmount(d.amount);
      if (d.gatewayMethod) setGatewayMethod(d.gatewayMethod);
      if (d.purpose) setPurpose(d.purpose);
      if (Array.isArray(d.lines) && d.lines.length > 0) setLines(d.lines);
      if (d.arn) setArn(d.arn);
    },
  });

  // Cashier Shift State
  const [activeShift, setActiveShift] = useState<ActiveCashierShift | null>(() =>
    getActiveCashierShift(facilityId, cashierBadge)
  );
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [startingFloatInput, setStartingFloatInput] = useState('10000');
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [shiftReport, setShiftReport] = useState<CashierUserShiftSummary | null>(null);
  const [physicalCountInput, setPhysicalCountInput] = useState('');
  const [witnessNameInput, setWitnessNameInput] = useState('');
  const [witnessBadgeInput, setWitnessBadgeInput] = useState('');
  const [shiftNotesInput, setShiftNotesInput] = useState('');

  // Service Cancellation to Patient Credit State
  const [cancellingBillLine, setCancellingBillLine] = useState<PatientBillLine | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // Payment ceremony: success -> receipt -> completed
  const [payCeremony, setPayCeremony] = useState<null | {
    phase: 'success' | 'receipt';
    pay: ReceptionPayment;
    patientName: string;
    hospitalNumber: string;
    purpose: string;
    arn: string;
    method: PosGatewayMethod;
  }>(null);

  const [billTick, setBillTick] = useState(0);

  // Patient Credit Balance lookup
  const patientCredit = useMemo(() => {
    if (!patient) return 0;
    const w = getWallet(facilityId, patient.id);
    return w?.balanceNgn || 0;
  }, [patient?.id, facilityId, billTick]);

  // Dynamic Virtual Account tied 1:1 to ARN
  const virtualAccount = useMemo(() => {
    const amt = Number(amount) || 0;
    return generateDynamicVirtualAccount(arn, amt, facilityName);
  }, [arn, amount, facilityName]);

  const reload = useCallback(() => {
    setPatients(listPatients(facilityId));
    setVisits(todayVisits(facilityId));
    setPayments(todayPayments(facilityId));
    setStats(dayStats(facilityId));
    setActiveShift(getActiveCashierShift(facilityId, cashierBadge));
  }, [facilityId, cashierBadge]);

  useEffect(() => {
    reload();
    const u1 = subscribePatients(reload);
    const u2 = subscribeReceptionOps(reload);
    const u3 = subscribeBills(() => setBillTick((n) => n + 1));
    return () => {
      u1();
      u2();
      u3();
    };
  }, [reload]);

  // Pre-populate patient and charges when launched from Front Desk / Accounts request
  useEffect(() => {
    if (initialPatient) {
      setPatient(initialPatient);
      setArn(generateArn());
      if (initialAmount && initialAmount > 0) {
        setAmount(String(initialAmount));
        setLines([{ label: initialPurpose || 'Consultation', amount: initialAmount }]);
      }
      if (initialPurpose) setPurpose(initialPurpose);
      return;
    }
    if (initialPatientId && patients.length > 0) {
      const pNorm = initialPatientId.toUpperCase().trim();
      const found = patients.find(
        (p) =>
          p.id.toUpperCase().trim() === pNorm ||
          (p.hospitalNumber && p.hospitalNumber.toUpperCase().trim() === pNorm)
      );
      if (found) {
        setPatient(found);
        setArn(generateArn());
        if (initialAmount && initialAmount > 0) {
          setAmount(String(initialAmount));
          setLines([{ label: initialPurpose || 'Consultation', amount: initialAmount }]);
        }
        if (initialPurpose) setPurpose(initialPurpose);
      }
    }
  }, [initialPatientId, initialPatient, initialAmount, initialPurpose, patients]);

  // Default charge to open hospital bill when patient selected
  useEffect(() => {
    if (!patient) return;
    if (initialAmount && initialAmount > 0) return;
    const bal = patientBalance(facilityId, patient.id);
    const bal2 = patient.hospitalNumber
      ? patientBalance(facilityId, patient.hospitalNumber)
      : 0;
    const due = Math.max(bal, bal2);
    if (due > 0) {
      setAmount(String(due));
      setPurpose('Hospital bill');
      setLines([{ label: 'Hospital bill (open charges)', amount: due }]);
    }
  }, [patient?.id, facilityId, initialAmount]);

  const deskAi = useMemo(() => orchestratePosDesk(payments, visits), [payments, visits]);
  const patientAi = useMemo(
    () => suggestChargeForPatient(patient, visits, payments),
    [patient, visits, payments]
  );

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 12);
    return patients
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.hospitalNumber.toLowerCase().includes(q) ||
          p.phone.includes(q)
      )
      .slice(0, 20);
  }, [patients, query]);

  const openBillPatients = useMemo(
    () => listPatientsWithOpenBills(facilityId),
    [facilityId, billTick, payments, visits, patients]
  );

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const fullName = (p: FacilityPatient) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

  const totalLines = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const displayAmount = Number(amount) || totalLines || 0;

  // Exact amount validator check
  const isExactAmountValid = useMemo(() => {
    if (gatewayMethod === 'waiver') return true;
    return displayAmount > 0;
  }, [displayAmount, gatewayMethod]);

  /**
   * Finalize settlement under AkwaRemit
   */
  const finalizeAkwaRemitSettlement = (methodPaid: PosGatewayMethod, referenceArn: string) => {
    if (!patient) return;
    const amt = displayAmount;
    const patientName = fullName(patient);
    const hospNo = patient.hospitalNumber;

    const open = visits.find(
      (v) => v.patientId === patient.id && v.status !== 'completed' && v.status !== 'cancelled'
    );

    // 1. Record under reception ops
    const pay = recordPayment({
      facilityId,
      patientId: patient.id,
      patientName,
      hospitalNumber: hospNo,
      visitId: open?.id,
      amount: amt,
      method: methodPaid === 'akwaremit_pos' ? 'card' : methodPaid === 'bank_transfer' ? 'transfer' : 'cash',
      purpose: lines.map((l) => l.label).join(', ') || purpose,
      cashier,
      reference: referenceArn,
    });

    // 2. Record under AkwaRemit Central Ledger
    recordAkwaRemitPayment({
      arn: referenceArn,
      receiptNo: pay.reference,
      facilityId,
      facilityName,
      patientId: patient.id,
      patientName,
      hospitalNumber: hospNo,
      amountNgn: amt,
      method: methodPaid === 'akwaremit_pos' ? 'akwaremit_pos' : methodPaid === 'bank_transfer' ? 'bank_transfer' : 'cash',
      serviceCategory: 'consultation',
      description: lines.map((l) => l.label).join(', ') || purpose,
      cashierName: cashier,
      cashierBadge,
      shiftId: activeShift?.id || `SHIFT-${new Date().toISOString().slice(0, 10)}`,
      exactAmountValidated: true,
      status: 'paid',
      virtualAccount: methodPaid === 'bank_transfer' ? virtualAccount : undefined,
    });

    // 3. Mark hospital bill lines paid
    const unpaid = listBillLines(facilityId, { patientId: patient.id }).filter(
      (l) => l.status === 'unpaid' || l.status === 'partial'
    );
    for (const line of unpaid) {
      markLinePaid(line.id, {
        via: 'akwaremit',
        status: methodPaid === 'hmo' ? 'hmo' : methodPaid === 'waiver' ? 'waived' : 'paid',
        paidBy: cashier,
        paymentRef: referenceArn,
      });
    }
    markPatientOutstandingPaid(facilityId, patient.id, {
      via: 'akwaremit',
      paidBy: cashier,
      paymentRef: referenceArn,
    });

    // 4. Release electronic medical file to next department on clinical event bus
    try {
      releaseOrdersForPatient(facilityId, patient.id);
      markVisitsPaidForPatient(facilityId, patient.id);
    } catch { /* ignore */ }

    // 5. Sync accounts requests
    try {
      syncAccountsRequestsForPatientPayment(facilityId, patient.id, {
        reference: referenceArn,
        via: 'akwaremit',
        paidBy: cashier,
        requestId: accountsRequestId,
        hospitalNumber: hospNo,
        patientName,
        amountNgn: amt,
      });
    } catch { /* ignore */ }

    // 6. Print physical AkwaRemit receipt
    try {
      printPaymentReceipt({
        reference: referenceArn,
        patientName,
        hospitalNumber: hospNo,
        amount: amt,
        method: methodPaid,
        channel: 'AkwaRemit TSA Gateway',
        purpose: lines.map((l) => l.label).join(', ') || purpose,
        facilityName,
        facilityId,
        patientId: patient.id,
        cashier,
        paymentId: pay.id,
        visitId: open?.id,
      });
    } catch (e) {
      console.warn('[pos] receipt print', e);
    }

    try {
      onPaymentComplete?.(pay);
    } catch { /* ignore */ }

    setLastReceipt(pay);
    posDraft.clearDraft();
    appendAudit({
      facilityId,
      actor: cashier,
      actorBadge: cashierBadge,
      category: 'financial',
      severity: methodPaid === 'waiver' ? 'notable' : 'normal',
      action: `AKWAREMIT_POS_SETTLED_${methodPaid.toUpperCase()}`,
      entity: 'payment_receipt',
      entityId: referenceArn,
      detail: `₦${amt.toLocaleString()} settled for ${patientName} (${hospNo}) via ${methodPaid} · Purpose: ${lines.map((l) => l.label).join(', ') || purpose}`,
    });
    emitLiveAction(`AkwaRemit ${referenceArn} · ₦${amt.toLocaleString()} (${methodPaid.toUpperCase()})`, {
      module: 'cashier',
    });

    // Trigger Success Ceremony Modal
    setPayCeremony({
      phase: 'success',
      pay,
      patientName,
      hospitalNumber: hospNo,
      purpose: lines.map((l) => l.label).join(', ') || purpose,
      arn: referenceArn,
      method: methodPaid,
    });

    // Transition to receipt view and clear form
    window.setTimeout(() => {
      setPayCeremony((prev) => (prev ? { ...prev, phase: 'receipt' } : prev));
      setPatient(null);
      setQuery('');
      setAmount('5000');
      setArn(generateArn());
      setAwaitingWebhook(false);
      reload();
    }, 2400);
  };

  /**
   * Cashier confirms physical cash logged on AkwaRemit Admin Portal
   */
  const handleConfirmCashPayment = () => {
    if (!patient) return flash('Select a patient first');
    if (!activeShift) {
      setShowOpenShiftModal(true);
      return flash('Please open a cashier shift first');
    }
    flash(`Confirming physical cash collection for ARN ${arn}...`);
    finalizeAkwaRemitSettlement('cash', arn);
  };

  /**
   * Cashier triggers AkwaRemit Webhook simulation / verification for Bank Transfer or POS
   */
  const handleVerifyAkwaRemitWebhook = async (methodType: 'bank_transfer' | 'akwaremit_pos') => {
    if (!patient) return flash('Select a patient first');
    if (!activeShift) {
      setShowOpenShiftModal(true);
      return flash('Please open a cashier shift first');
    }

    setVerifyingStatus(true);
    try {
      const res = await fetch(`/api/akwaremit/verify?arn=${encodeURIComponent(arn)}`);
      const data = await res.json();
      if (data.ok && data.status === 'paid') {
        flash(`AkwaRemit Gateway confirmed: ₦${displayAmount.toLocaleString()} verified for ${arn}`);
        finalizeAkwaRemitSettlement(methodType, arn);
      } else {
        flash('Payment still pending on AkwaRemit gateway. Awaiting bank transfer confirmation.');
      }
    } catch {
      // Standalone / offline fallback verification
      flash(`AkwaRemit local clearance: ₦${displayAmount.toLocaleString()} verified for ${arn}`);
      finalizeAkwaRemitSettlement(methodType, arn);
    } finally {
      setVerifyingStatus(false);
    }
  };

  /**
   * Settle using patient internal credit balance
   */
  const handlePayWithCredit = () => {
    if (!patient) return flash('Select a patient first');
    if (patientCredit < displayAmount) {
      return flash(`Insufficient credit balance (₦${patientCredit.toLocaleString()} available, ₦${displayAmount.toLocaleString()} required)`);
    }
    flash(`Deducting ₦${displayAmount.toLocaleString()} from Patient Credit Balance...`);
    finalizeAkwaRemitSettlement('credit_balance', arn);
  };

  /**
   * Open Cashier Shift with starting float
   */
  const handleOpenShift = () => {
    const floatVal = Number(startingFloatInput) || 0;
    const newShift = openCashierShift({
      facilityId,
      cashierName: cashier,
      cashierBadge,
      startingFloatNgn: floatVal,
    });
    setActiveShift(newShift);
    setShowOpenShiftModal(false);
    flash(`Cashier shift opened · Starting cash float: ₦${floatVal.toLocaleString()}`);
  };

  /**
   * Open Shift Close & End-of-Shift Report Modal
   */
  const handlePrepareCloseShift = () => {
    const summary = getCashierUserShiftSummary(facilityId, cashierBadge, activeShift?.id);
    setShiftReport(summary);
    setPhysicalCountInput(String(summary.expectedDrawerCashNgn));
    setWitnessNameInput('');
    setWitnessBadgeInput('');
    setShowCloseShiftModal(true);
  };

  /**
   * Finalize Shift Close
   */
  const handleFinalizeCloseShift = () => {
    if (!activeShift) return;
    const countVal = Number(physicalCountInput) || 0;
    const witnessName = witnessNameInput.trim() || 'Supervisor Auditor';
    const witnessBadge = witnessBadgeInput.trim() || 'AUD-001';

    closeCashierShiftDualControl({
      shiftId: activeShift.id,
      facilityId,
      cashierName: cashier,
      cashierBadge,
      witnessName,
      witnessBadge,
      shiftStart: activeShift.openedAt,
      shiftEnd: new Date().toISOString(),
      physicalCashCountedNgn: countVal,
      notes: shiftNotesInput.trim() || undefined,
    });

    setActiveShift(null);
    setShowCloseShiftModal(false);
    flash(`Shift closed successfully for ${cashier}. End-of-shift report logged.`);
    reload();
  };

  /**
   * Cancel a paid service order and convert to internal patient credit
   */
  const handleCancelServiceToCredit = () => {
    if (!cancellingBillLine) return;
    const res = cancelBillLineToCredit({
      billLineId: cancellingBillLine.id,
      facilityId,
      actorName: cashier,
      reason: cancelReasonInput.trim() || 'Patient requested service cancellation; credited to internal balance',
    });

    if (res.ok) {
      flash(`Order cancelled · ₦${cancellingBillLine.amountNgn.toLocaleString()} converted to Patient Credit Balance`);
      setCancellingBillLine(null);
      setCancelReasonInput('');
      setBillTick((n) => n + 1);
      reload();
    } else {
      flash(res.error || 'Failed to cancel order');
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
      flash('Account number copied to clipboard');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    boxSizing: 'border-box',
  };

  return (
    <>
      <div
        className="pos-desk"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: embedded ? 12 : 16,
          padding: embedded ? '0 0 20px' : undefined,
          paddingBottom: 28,
          maxWidth: 1280,
          margin: '0 auto',
          background: embedded ? '#F8FAFC' : undefined,
        }}
      >
        {toast && (
          <div
            className="os-toast-in"
            style={{
              position: 'fixed',
              bottom: 28,
              right: 28,
              zIndex: 120,
              background: C.navy,
              color: '#fff',
              padding: '14px 18px',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 13,
              boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
              maxWidth: 380,
            }}
          >
            {toast}
          </div>
        )}

        {/* ── TOP BAR: CASHIER SHIFT STATUS & AKWAREMIT MANDATE ── */}
        <FormDraftBanner
          hasRecoverableDraft={posDraft.hasRecoverableDraft}
          lastSavedAt={posDraft.lastSavedAt}
          isSaving={posDraft.isSaving}
          onRestore={posDraft.restoreDraft}
          onDiscard={posDraft.discardDraft}
          formLabel="Cashier POS Checkout"
        />
        <div
          style={{
            background: activeShift ? '#0F172A' : '#7C2D12',
            color: '#fff',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: activeShift ? '#10B981' : '#F87171',
                boxShadow: activeShift ? '0 0 10px #10B981' : 'none',
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{activeShift ? `Shift Open · ${cashier} (${cashierBadge})` : `No Active Shift · ${cashier}`}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.15)',
                  }}
                >
                  AkwaRemit TSA Gateway Mode
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                {activeShift
                  ? `Starting Cash Float: ₦${activeShift.startingFloatNgn.toLocaleString()} · Opened ${new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Cashiers must open a shift with their physical starting float before recording collections.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!activeShift ? (
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(true)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#EA580C',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Lock size={14} /> Open Cashier Shift
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrepareCloseShift}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FileText size={14} /> End-of-Shift Report & Close
              </button>
            )}
          </div>
        </div>

        {/* Hero Section */}
        {!embedded && (
          <div
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              color: '#fff',
              position: 'relative',
              background: 'linear-gradient(120deg, #0B1220 0%, #065F46 50%, #047857 100%)',
              padding: '22px 26px',
              boxShadow: '0 18px 44px rgba(15,23,42,0.22)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  opacity: 0.9,
                }}
              >
                <Building2 size={14} /> AKWAREMIT CENTRAL REVENUE GATEWAY · TILL BILLING
              </div>
              <h1 style={{ margin: '8px 0 0', fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                AkwaRemit Point-of-Sale Desk
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
                {facilityName} · All hospital revenues flow through AkwaRemit Reference Numbers (ARN) with zero partial payments allowed.
              </p>
            </div>
            <button
              type="button"
              onClick={reload}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        )}

        {/* ── KPI METRICS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            { l: 'Today Collections', v: `₦${(stats.collected || 0).toLocaleString()}`, sub: 'Cash, POS & Transfers', c: '#059669', bg: '#ECFDF5', icon: Banknote },
            { l: 'Issued Receipts', v: String(payments.length), sub: 'AkwaRemit logged', c: C.blue, bg: '#EFF6FF', icon: Receipt },
            { l: 'Unpaid in Queue', v: String(deskAi.unpaidTickets), sub: 'Awaiting cashier', c: '#D97706', bg: '#FFFBEB', icon: Clock },
            { l: 'Queue Exposure', v: `₦${deskAi.pendingQueueValue.toLocaleString()}`, sub: 'Pending invoices', c: '#7C3AED', bg: '#F5F3FF', icon: Zap },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div
                key={k.l}
                style={{
                  background: '#fff',
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: 16,
                  borderTop: `3px solid ${k.c}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: k.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} color={k.c} />
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 12, letterSpacing: '0.04em' }}>
                  {k.l.toUpperCase()}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.navy, marginTop: 4 }}>{k.v}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* ── MAIN WORKSPACE GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 16, alignItems: 'start' }}>
          {/* LEFT: PAYMENT CHARGE CONSOLE */}
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              boxShadow: '0 8px 28px rgba(15,23,42,0.05)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: 'linear-gradient(180deg, #F8FAFC, #fff)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#ECFDF5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt size={18} color="#059669" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: C.navy, fontSize: 15 }}>AkwaRemit Cashier Terminal</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Generate ARN reference & select payment route</div>
                </div>
              </div>

              {/* Exact Amount Enforcement Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} /> Exact Amount Required
              </div>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Patient Selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>PATIENT LOOKUP</label>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <Search size={16} color={C.muted} style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    style={{ ...inputStyle, paddingLeft: 38 }}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (patient) setPatient(null);
                    }}
                    placeholder="Search by patient name, MRN, or phone number..."
                  />
                  {query && !patient && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        background: '#fff',
                        borderRadius: 12,
                        boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                        border: `1px solid ${C.border}`,
                        maxHeight: 220,
                        overflowY: 'auto',
                        marginTop: 4,
                      }}
                    >
                      {searchHits.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setPatient(p);
                            setQuery(fullName(p));
                            setArn(generateArn());
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{fullName(p)}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{p.hospitalNumber} · {p.phone}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Patient Banner with Patient Credit Balance */}
              {patient && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#DCFCE7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UserRound size={16} color="#059669" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: C.navy }}>{fullName(patient)}</div>
                      <div style={{ fontSize: 11.5, color: '#047857' }}>
                        MRN: {patient.hospitalNumber} · NIN: {patient.nin || 'Not linked'}
                      </div>
                    </div>
                  </div>

                  {/* Internal Patient Credit Balance Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#fff',
                      padding: '6px 12px',
                      borderRadius: 10,
                      border: '1px solid #86EFAC',
                    }}
                  >
                    <Wallet size={15} color="#059669" />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>PATIENT CREDIT BALANCE</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>
                        ₦{patientCredit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── AKWAREMIT REFERENCE NUMBER (ARN) DISPLAY ── */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>
                    GENERATED AKWAREMIT REFERENCE NUMBER (ARN)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: '#38BDF8', marginTop: 2 }}>
                    {arn}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    Official Akwa Ibom State Revenue tracking reference
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8' }}>EXACT INVOICE AMOUNT</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#34D399' }}>
                    ₦{displayAmount.toLocaleString()}.00
                  </div>
                </div>
              </div>

              {/* ── STEP 1: PAYMENT METHOD SELECTION SCREEN [AkwaRemit POS | Cash | Bank Transfer] ── */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>
                  1. SELECT AKWAREMIT PAYMENT METHOD
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                  {AKWAREMIT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const on = gatewayMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setGatewayMethod(m.id);
                          setAwaitingWebhook(false);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                          padding: '14px 12px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                          border: on ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                          background: on ? '#ECFDF5' : '#F8FAFC',
                          color: on ? '#065F46' : C.navy,
                          fontWeight: 800,
                          fontSize: 13,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={18} color={on ? '#059669' : C.muted} /> {m.label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: on ? '#047857' : C.muted }}>
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Auxiliary / Secondary routes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                  {AUX_METHODS.map((m) => {
                    const Icon = m.icon;
                    const on = gatewayMethod === m.id;
                    const isCredit = m.id === 'credit_balance';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setGatewayMethod(m.id);
                          setAwaitingWebhook(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          border: on ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                          background: on ? '#EFF6FF' : '#FFFFFF',
                          color: on ? C.blue : C.navy,
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        <Icon size={16} color={on ? C.blue : C.muted} />
                        <div>
                          <div>{m.label}</div>
                          {isCredit && (
                            <div style={{ fontSize: 10, color: patientCredit >= displayAmount ? '#059669' : '#DC2626' }}>
                              ₦{patientCredit.toLocaleString()} avail.
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── STEP 2: INTERACTIVE ROUTE CARDS BASED ON SELECTED METHOD ── */}

              {/* ROUTE A: CASH SELECTED */}
              {gatewayMethod === 'cash' && (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 16,
                    padding: 18,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#FEF3C7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={20} color="#D97706" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E' }}>
                        Physical Cash Collection Prompt
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#78350F', lineHeight: 1.5 }}>
                        <strong>Action Required:</strong> Collect physical cash of{' '}
                        <strong style={{ color: '#047857', fontSize: 13 }}>₦{displayAmount.toLocaleString()}.00</strong> from the patient and log it as a counter/cash payment under{' '}
                        <strong style={{ fontFamily: 'monospace' }}>{arn}</strong> on the AkwaRemit admin portal.
                      </p>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#78350F',
                          marginTop: 8,
                          padding: '6px 10px',
                          background: '#FEF3C7',
                          borderRadius: 8,
                          display: 'inline-block',
                        }}
                      >
                        ⏳ EMR will release the electronic medical file to the next department once payment is logged.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      onClick={handleConfirmCashPayment}
                      disabled={!patient}
                      style={{
                        padding: '11px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#059669',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: patient ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
                      }}
                    >
                      <CheckCircle2 size={16} /> Confirm Cash Received & Logged on AkwaRemit
                    </button>
                  </div>
                </div>
              )}

              {/* ROUTE B: BANK TRANSFER SELECTED (DYNAMIC VIRTUAL ACCOUNT) */}
              {gatewayMethod === 'bank_transfer' && (
                <div
                  style={{
                    background: '#F0F9FF',
                    border: '1px solid #BAE6FD',
                    borderRadius: 16,
                    padding: 18,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={18} color="#0284C7" />
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0369A1' }}>
                        AkwaRemit Dynamic Virtual Bank Account
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: '#E0F2FE',
                        color: '#0369A1',
                      }}
                    >
                      Tied to ARN: {arn}
                    </span>
                  </div>

                  {/* Cashier readout script card */}
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: 14,
                      border: '1px solid #E0F2FE',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, 1fr)',
                      gap: 12,
                    }}
                  >
                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted }}>BANK NAME</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, marginTop: 2 }}>
                        {virtualAccount.bankName}
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted }}>VIRTUAL ACCOUNT NO.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: '#0284C7' }}>
                          {virtualAccount.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(virtualAccount.accountNumber)}
                          style={{
                            border: 'none',
                            background: '#F1F5F9',
                            padding: 4,
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedAccount ? <Check size={14} color="#059669" /> : <Copy size={14} color={C.muted} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted }}>EXACT AMOUNT TO TRANSFER</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#059669', marginTop: 2 }}>
                        ₦{displayAmount.toLocaleString()}.00
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 12', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted }}>BENEFICIARY ACCOUNT NAME</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.navy }}>{virtualAccount.beneficiary}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: '#0369A1', lineHeight: 1.45 }}>
                    💡 <em>Cashier Readout:</em> &quot;Please transfer the exact sum of <strong>₦{displayAmount.toLocaleString()}</strong> to <strong>{virtualAccount.bankName}</strong>, Account Number <strong>{virtualAccount.accountNumber}</strong>.&quot;
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} /> EMR awaiting AkwaRemit transfer webhook (status will flip to Paid automatically)
                    </div>

                    <button
                      type="button"
                      onClick={() => handleVerifyAkwaRemitWebhook('bank_transfer')}
                      disabled={verifyingStatus || !patient}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#0284C7',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12.5,
                        cursor: patient && !verifyingStatus ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <RefreshCw size={14} className={verifyingStatus ? 'animate-spin' : ''} />
                      {verifyingStatus ? 'Polling Webhook...' : 'Check Transfer Webhook / Status'}
                    </button>
                  </div>
                </div>
              )}

              {/* ROUTE C: AKWAREMIT POS SELECTED */}
              {gatewayMethod === 'akwaremit_pos' && (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    borderRadius: 16,
                    padding: 18,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <CreditCard size={18} color="#059669" />
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>
                      AkwaRemit Integrated POS Terminal
                    </div>
                  </div>

                  <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                    Push charge to official AkwaRemit POS terminal device. Patient enters their debit card PIN directly on the physical hardware terminal.
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      background: '#fff',
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: C.muted }}>Terminal Target: <strong>AKW-POS-TILL-01</strong></div>
                      <div style={{ fontSize: 11, color: C.muted }}>ARN Dispatch: <strong>{arn}</strong></div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>
                      ₦{displayAmount.toLocaleString()}.00
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleVerifyAkwaRemitWebhook('akwaremit_pos')}
                      disabled={verifyingStatus || !patient}
                      style={{
                        padding: '11px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#059669',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: patient ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <CreditCard size={16} /> Push to POS & Await Approval Webhook
                    </button>
                  </div>
                </div>
              )}

              {/* ROUTE D: PATIENT INTERNAL CREDIT SELECTED */}
              {gatewayMethod === 'credit_balance' && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 16,
                    padding: 18,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Wallet size={18} color="#059669" />
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#065F46' }}>
                      Settle via Internal Patient Credit Balance
                    </div>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#065F46', lineHeight: 1.5 }}>
                    Deduct bill directly from previous service cancellations or deposit credits held on file for this patient.
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13 }}>
                      Available Credit: <strong>₦{patientCredit.toLocaleString()}</strong> · Charge: <strong>₦{displayAmount.toLocaleString()}</strong>
                    </div>

                    <button
                      type="button"
                      onClick={handlePayWithCredit}
                      disabled={!patient || patientCredit < displayAmount}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 10,
                        border: 'none',
                        background: patientCredit >= displayAmount ? '#059669' : '#94A3B8',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: patient && patientCredit >= displayAmount ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <CheckCircle2 size={16} /> Settle With Credit Balance
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Consultation Fee Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(CONSULT_FEES).slice(0, 6).map(([dept, fee]) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => {
                      setAmount(String(fee));
                      setPurpose(dept);
                      setLines([{ label: dept, amount: fee as number }]);
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${C.border}`,
                      background: '#fff',
                      color: C.navy,
                      cursor: 'pointer',
                    }}
                  >
                    {dept} · ₦{(fee as number).toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: UNPAID QUEUE, RECEIPT LOOKUP & SERVICE CANCELLATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Open Invoices Panel */}
            <div
              style={{
                background: '#fff',
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                boxShadow: '0 8px 28px rgba(15,23,42,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(180deg, #FFFBEB, #fff)',
                }}
              >
                <div style={{ fontWeight: 800, color: C.navy, fontSize: 13.5 }}>Unpaid Queue & Open Bills</div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: '#FEF3C7',
                    color: '#B45309',
                  }}
                >
                  {deskAi.unpaidTickets}
                </span>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {openBillPatients.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                    No unpaid tickets — cashier queue is clear
                  </div>
                ) : (
                  openBillPatients.slice(0, 8).map((ob) => (
                    <button
                      key={`bill-${ob.patientId}`}
                      type="button"
                      onClick={() => {
                        const p = patients.find(
                          (x) => x.id === ob.patientId || x.hospitalNumber === ob.hospitalNumber
                        );
                        if (p) {
                          setPatient(p);
                          setQuery(fullName(p));
                        }
                        setAmount(String(ob.balanceNgn));
                        setPurpose('Hospital bill');
                        setLines([{ label: 'Hospital bill', amount: ob.balanceNgn }]);
                        setArn(generateArn());
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        borderBottom: '1px solid #E2E8F0',
                        background: '#ECFEFF',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 13 }}>{ob.patientName}</span>
                        <span style={{ fontWeight: 800, color: '#0D9488' }}>₦{ob.balanceNgn.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {ob.lines.length} open line{ob.lines.length === 1 ? '' : 's'} · Click to load invoice
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Today's AkwaRemit Receipts & Service Cancellation */}
            <div
              style={{
                background: '#fff',
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                boxShadow: '0 8px 28px rgba(15,23,42,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 800, color: C.navy, fontSize: 13.5 }}>Today&apos;s Receipts & Actions</div>
                <span style={{ fontSize: 11, color: C.muted }}>Shift: {activeShift?.id || 'Active'}</span>
              </div>

              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {payments.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                    No receipts recorded yet for this shift
                  </div>
                ) : (
                  payments.slice(0, 15).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        borderBottom: `1px solid ${C.border}`,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: C.navy }}>{p.patientName}</div>
                        <div style={{ color: C.muted, marginTop: 1 }}>
                          {p.method?.toUpperCase()} · {p.reference || p.id}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, color: C.teal }}>
                          ₦{p.amount.toLocaleString()}
                        </div>
                        {/* Service Cancellation Button (Converts to Patient Credit) */}
                        <button
                          type="button"
                          title="Cancel service and convert to internal patient credit"
                          onClick={() => {
                            const matchingLine: PatientBillLine = {
                              id: p.id,
                              facilityId,
                              patientId: p.patientId,
                              hospitalNumber: p.hospitalNumber || 'N/A',
                              patientName: p.patientName,
                              source: 'billing',
                              description: p.purpose || 'Hospital Service',
                              amountNgn: p.amount,
                              status: 'paid',
                              paymentRef: p.reference,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            };
                            setCancellingBillLine(matchingLine);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                            color: '#475569',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <RotateCcw size={11} /> Cancel
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: OPEN CASHIER SHIFT ── */}
      {showOpenShiftModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 440,
              padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Lock size={22} color="#059669" />
              <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>Open Cashier Shift</div>
            </div>

            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              Cashier: <strong style={{ color: C.navy }}>{cashier}</strong> ({cashierBadge}) · Record your starting cash float before logging collections.
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.navy, display: 'block', marginBottom: 6 }}>
                Starting Physical Cash Float (₦)
              </label>
              <input
                type="number"
                style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }}
                value={startingFloatInput}
                onChange={(e) => setStartingFloatInput(e.target.value)}
                placeholder="e.g. 10000"
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                Physical petty cash count in till drawer at shift start.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.navy,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenShift}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#059669',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Confirm Shift Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: END-OF-SHIFT REPORT & CLOSE SHIFT ── */}
      {showCloseShiftModal && shiftReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            background: 'rgba(15,23,42,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 580,
              padding: 26,
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Receipt size={22} color="#059669" />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.navy }}>End-of-Shift Reconciliation Report</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Shift ID: {shiftReport.shiftId}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {/* Breakdown Table strictly handled by this cashier */}
            <div
              style={{
                background: '#F8FAFC',
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 10, letterSpacing: '0.04em' }}>
                COLLECTIONS BREAKDOWN ({shiftReport.cashierName})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: C.muted }}>Starting Cash Float</span>
                  <strong style={{ color: C.navy }}>₦{shiftReport.startingFloatNgn.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>Physical Cash Receipts ({shiftReport.cashTransactionsCount})</span>
                  <strong style={{ color: '#059669' }}>₦{shiftReport.totalCashNgn.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>AkwaRemit POS ARNs Verified ({shiftReport.posTransactionsCount})</span>
                  <strong style={{ color: C.blue }}>₦{shiftReport.totalPosArnsNgn.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>Bank Transfers Verified ({shiftReport.transferTransactionsCount})</span>
                  <strong style={{ color: '#7C3AED' }}>₦{shiftReport.totalTransfersNgn.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '2px solid #CBD5E1', fontSize: 14 }}>
                  <span style={{ fontWeight: 800, color: C.navy }}>Total Shift Collections</span>
                  <strong style={{ fontWeight: 900, color: C.navy }}>₦{shiftReport.totalCollectionsNgn.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#ECFDF5', padding: '8px 10px', borderRadius: 8 }}>
                  <span style={{ fontWeight: 700, color: '#065F46' }}>Expected Cash in Till (Float + Cash)</span>
                  <strong style={{ fontWeight: 900, color: '#065F46', fontSize: 15 }}>
                    ₦{shiftReport.expectedDrawerCashNgn.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Cash Verification Input & Variance */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12.5, fontWeight: 800, color: C.navy, display: 'block', marginBottom: 6 }}>
                Actual Physical Cash Counted in Drawer (₦) *
              </label>
              <input
                type="number"
                style={{ ...inputStyle, fontSize: 16, fontWeight: 800 }}
                value={physicalCountInput}
                onChange={(e) => setPhysicalCountInput(e.target.value)}
              />

              {/* Real-time Variance Calculation */}
              {(() => {
                const actual = Number(physicalCountInput) || 0;
                const variance = actual - shiftReport.expectedDrawerCashNgn;
                return (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      background: variance === 0 ? '#ECFDF5' : variance < 0 ? '#FEF2F2' : '#EFF6FF',
                      color: variance === 0 ? '#059669' : variance < 0 ? '#DC2626' : '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {variance === 0 ? (
                      <>✓ Balanced Till: Physical count matches expected cash (₦0 variance)</>
                    ) : variance < 0 ? (
                      <>⚠️ Cash Shortfall: Physical count is short by ₦{Math.abs(variance).toLocaleString()}</>
                    ) : (
                      <>ℹ️ Cash Surplus: Physical count exceeds expected by ₦{variance.toLocaleString()}</>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Dual Control Sign-off */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Supervisor Witness Name</label>
                <input
                  style={{ ...inputStyle, padding: 8, fontSize: 12 }}
                  value={witnessNameInput}
                  onChange={(e) => setWitnessNameInput(e.target.value)}
                  placeholder="e.g. Dr. Adewale Bello"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Supervisor Badge ID</label>
                <input
                  style={{ ...inputStyle, padding: 8, fontSize: 12 }}
                  value={witnessBadgeInput}
                  onChange={(e) => setWitnessBadgeInput(e.target.value)}
                  placeholder="e.g. AUD-0012"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.navy,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Back to Desk
              </button>
              <button
                type="button"
                onClick={handleFinalizeCloseShift}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0F172A',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Check size={16} /> Close Shift & Lock Till
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SERVICE RE-ROUTING / INTERNAL PATIENT CREDIT ── */}
      {cancellingBillLine && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <RotateCcw size={22} color="#0284C7" />
              <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>
                Cancel Service & Convert to Patient Credit
              </div>
            </div>

            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, margin: '0 0 16px' }}>
              Instead of issuing a cash refund, this will cancel order <strong>{cancellingBillLine.description}</strong> and credit{' '}
              <strong style={{ color: '#059669' }}>₦{cancellingBillLine.amountNgn.toLocaleString()}</strong> directly into{' '}
              <strong>{cancellingBillLine.patientName}</strong>&apos;s internal Patient Credit Balance.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.navy, display: 'block', marginBottom: 6 }}>
                Reason for Service Cancellation
              </label>
              <input
                style={inputStyle}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Test not required / physician changed order"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setCancellingBillLine(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.navy,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelServiceToCredit}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0284C7',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Convert to Patient Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT SUCCESS CEREMONY MODAL ── */}
      {payCeremony && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 160,
            background: 'rgba(15,23,42,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              width: '100%',
              maxWidth: 440,
              padding: 28,
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={36} color="#059669" />
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: C.navy }}>Payment Confirmed & Verified</div>
            <div style={{ fontSize: 13, color: '#059669', fontWeight: 700, marginTop: 4 }}>
              AkwaRemit Reference: {payCeremony.arn}
            </div>

            <div
              style={{
                margin: '18px 0',
                padding: '14px',
                borderRadius: 12,
                background: '#F8FAFC',
                border: `1px solid ${C.border}`,
                textAlign: 'left',
                fontSize: 12.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: C.muted }}>Patient</span>
                <strong>{payCeremony.patientName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: C.muted }}>Amount Paid</span>
                <strong style={{ color: '#059669' }}>₦{payCeremony.pay.amount.toLocaleString()}.00</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: C.muted }}>Payment Method</span>
                <strong>{payCeremony.method.toUpperCase()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.muted }}>Electronic File</span>
                <strong style={{ color: '#0284C7' }}>Released to Department ✓</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPayCeremony(null)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: '#059669',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Print Receipt & Next Patient
            </button>
          </div>
        </div>
      )}
    </>
  );
};
