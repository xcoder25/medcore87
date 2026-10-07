'use client';

/**
 * Full-page intelligent POS & Payment desk
 * AI assists amount/method/risk; human confirms every charge.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Wallet, Search, CreditCard, Banknote, Building2, ShieldCheck,
  Sparkles, RefreshCw, Printer, CheckCircle2, AlertTriangle, Receipt,
  Users, Clock, Zap, ArrowRight, X, UserRound,
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
} from '../../lib/patientBillingStore';
import { verifyInsurance } from '../../lib/receptionConstants';
import { printPaymentReceipt } from '../../lib/printService';
import { syncAccountsRequestsForPatientPayment } from '../../lib/frontDeskAccountsBridge';

const C = {
  blue: '#0284C7',
  teal: '#0D9488',
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
};

const METHODS: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'pos', label: 'POS', icon: CreditCard },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', icon: Building2 },
  { id: 'hmo', label: 'HMO', icon: ShieldCheck },
  { id: 'waiver', label: 'Waiver', icon: CheckCircle2 },
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
}

export const PosPaymentDesk: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Hospital';
  const cashier = session?.name || 'Cashier';

  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [visits, setVisits] = useState<ReceptionVisit[]>([]);
  const [payments, setPayments] = useState<ReceptionPayment[]>([]);
  const [stats, setStats] = useState(dayStats(facilityId));
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState<FacilityPatient | null>(null);
  const [amount, setAmount] = useState('5000');
  const [method, setMethod] = useState<PaymentMethod>('pos');
  const [purpose, setPurpose] = useState('Consultation');
  const [lines, setLines] = useState<{ label: string; amount: number }[]>([
    { label: 'Consultation', amount: 5000 },
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceptionPayment | null>(null);
  /** Cash (and desk) post-payment ceremony: success → receipt → home */
  const [payCeremony, setPayCeremony] = useState<null | {
    phase: 'success' | 'receipt';
    pay: ReceptionPayment;
    patientName: string;
    hospitalNumber: string;
    purpose: string;
  }>(null);
  const [insMsg, setInsMsg] = useState('');
  const [billTick, setBillTick] = useState(0);

  const reload = useCallback(() => {
    setPatients(listPatients(facilityId));
    setVisits(todayVisits(facilityId));
    setPayments(todayPayments(facilityId));
    setStats(dayStats(facilityId));
  }, [facilityId]);

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

  // Default charge to open hospital bill when patient selected
  useEffect(() => {
    if (!patient) return;
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
  }, [patient?.id, facilityId]);

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

  const unpaidVisits = visits.filter(
    (v) =>
      (v.paymentStatus === 'pending' || v.paymentStatus === 'partial') &&
      v.status !== 'completed' &&
      v.status !== 'cancelled'
  );

  const openBillPatients = useMemo(() => listPatientsWithOpenBills(facilityId), [facilityId, billTick, payments, visits, patients]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  };

  const fullName = (p: FacilityPatient) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

  const applyAiSuggestion = () => {
    if (!patientAi) return;
    if (patientAi.suggestedAmount != null) {
      setAmount(String(patientAi.suggestedAmount));
      setLines([{ label: patientAi.suggestedPurpose || 'Consultation', amount: patientAi.suggestedAmount }]);
    }
    if (patientAi.suggestedMethod) setMethod(patientAi.suggestedMethod);
    if (patientAi.suggestedPurpose) setPurpose(patientAi.suggestedPurpose);
    flash('AI suggestion applied — confirm before recording');
  };

  const applyLineTotal = (next: { label: string; amount: number }[]) => {
    setLines(next);
    setAmount(String(next.reduce((s, l) => s + l.amount, 0)));
  };

  const doCharge = () => {
    if (!patient) {
      flash('Select a patient first');
      return;
    }
    const amt = Number(amount) || 0;
    if (amt <= 0 && method !== 'waiver') {
      flash('Enter a valid amount');
      return;
    }
    if (patientAi?.risk === 'high') {
      const ok = window.confirm(
        `AI risk flag: ${patientAi.flags.join('; ')}\n\nRecord ₦${amt.toLocaleString()} anyway?`
      );
      if (!ok) return;
    }
    const open = visits.find(
      (v) => v.patientId === patient.id && v.status !== 'completed' && v.status !== 'cancelled'
    );
    const pay = recordPayment({
      facilityId,
      patientId: patient.id,
      patientName: fullName(patient),
      hospitalNumber: patient.hospitalNumber,
      visitId: open?.id,
      amount: amt,
      method,
      purpose: lines.map((l) => l.label).join(', ') || purpose,
      cashier,
    });
    // Settle ALL open bill lines (pharmacy, lab, billing-office invoices, etc.)
    const via =
      method === 'hmo' ? 'hmo' : method === 'waiver' ? 'waiver' : method === 'pos' || method === 'transfer' ? 'paystack' : 'cashier';
    const status = method === 'hmo' ? 'hmo' : method === 'waiver' ? 'waived' : 'paid';
    const unpaid = listBillLines(facilityId, { patientId: patient.id }).filter(
      (l) => l.status === 'unpaid' || l.status === 'partial'
    );
    const settleAll =
      purpose === 'Hospital bill' ||
      purpose === 'All charges' ||
      purpose === 'Pharmacy' ||
      purpose === 'Lab' ||
      unpaid.length > 0;
    if (settleAll) {
      for (const line of unpaid) {
        // Pharmacy-only purpose: only settle pharmacy lines
        if (purpose === 'Pharmacy' && line.source !== 'pharmacy') continue;
        if (purpose === 'Lab' && line.source !== 'lab') continue;
        markLinePaid(line.id, {
          via: via as 'cashier' | 'pharmacy' | 'hmo' | 'waiver' | 'paystack',
          status: status as 'paid' | 'hmo' | 'waived',
          paidBy: cashier,
          paymentRef: pay.reference,
        });
      }
      // Also run bulk settle for billing-office invoice sync
      if (purpose !== 'Pharmacy' && purpose !== 'Lab') {
        markPatientOutstandingPaid(facilityId, patient.id, {
          via: via as 'cashier' | 'pharmacy' | 'hmo' | 'waiver' | 'paystack',
          paidBy: cashier,
          paymentRef: pay.reference,
        });
      }
    }
    setLastReceipt(pay);
    try {
      syncAccountsRequestsForPatientPayment(facilityId, patient.id, {
        reference: pay.reference,
        via: method === 'cash' ? 'cash' : String(method),
        paidBy: cashier,
      });
    } catch {
      /* ignore */
    }
    reload();
    emitLiveAction(`POS ${pay.reference} · ₦${amt}`, { module: 'cashier' });
    const bal = patientBalance(facilityId, patient.id);

    // Cash / desk methods: success screen → auto receipt → paid (already) → home
    const deskMethod = method === 'cash' || method === 'pos' || method === 'transfer' || method === 'waiver';
    if (deskMethod) {
      const patientName = fullName(patient);
      const hospNo = patient.hospitalNumber;
      const purposeLabel = lines.map((l) => l.label).join(', ') || purpose;
      setPayCeremony({
        phase: 'success',
        pay,
        patientName,
        hospitalNumber: hospNo,
        purpose: purposeLabel,
      });
      // After 3s success → generate & print receipt
      window.setTimeout(() => {
        try {
          printPaymentReceipt({
            reference: pay.reference,
            patientName,
            hospitalNumber: hospNo,
            amount: amt,
            method: String(method).toUpperCase(),
            purpose: purposeLabel,
            facilityName,
            facilityId,
            patientId: patient.id,
            cashier,
            cashierBadge: session?.badgeId,
            paymentId: pay.id,
            visitId: open?.id,
            print: true,
          });
        } catch (e) {
          console.warn('[pos] receipt print', e);
        }
        setPayCeremony((prev) => (prev ? { ...prev, phase: 'receipt' } : prev));
        // Clear form for next patient
        setPatient(null);
        setQuery('');
        setAmount('5000');
        // After receipt shown briefly → dashboard / check-in
        window.setTimeout(() => {
          setPayCeremony(null);
          if (onNavigate) {
            const role = session?.roleKey || '';
            if (role === 'reception') onNavigate('patient-flow');
            else if (role === 'accountant' || role === 'hospital_admin') onNavigate('dashboard');
            else onNavigate('dashboard');
          }
        }, 2500);
      }, 3000);
      return;
    }

    flash(
      `Recorded · ${pay.reference} · ₦${amt.toLocaleString()}` +
        (bal > 0 ? ` · Remaining bill ₦${bal.toLocaleString()}` : ' · Bill clear')
    );
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    boxSizing: 'border-box',
  };

  const totalLines = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const displayAmount = Number(amount) || totalLines || 0;

  return (
    <>
    <div className="pos-desk" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 28, maxWidth: 1280, margin: '0 auto' }}>
      {toast && (
        <div className="os-toast-in" style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 120,
          background: C.navy, color: '#fff', padding: '14px 18px', borderRadius: 14,
          fontWeight: 700, fontSize: 13, boxShadow: '0 12px 36px rgba(0,0,0,0.28)', maxWidth: 360,
        }}>
          {toast}
        </div>
      )}

      {/* Hero */}
      <div style={{
        borderRadius: 20, overflow: 'hidden', color: '#fff', position: 'relative',
        background: 'linear-gradient(120deg, #0B1220 0%, #0C4A6E 42%, #0F766E 100%)',
        padding: '22px 26px', boxShadow: '0 18px 44px rgba(15,23,42,0.22)',
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9 }}>
            <Wallet size={14} /> POS · PAYMENT DESK
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Front desk collections
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
            {facilityName} · {cashier} · AI suggests amount & method — you confirm every charge
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999,
              background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(52,211,153,0.35)', fontSize: 12, fontWeight: 700,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399' }} /> Shift live
            </span>
            <span style={{
              padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 600,
            }}>
              Human confirm required
            </span>
          </div>
        </div>
        <button type="button" onClick={reload} style={{
          position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, cursor: 'pointer',
        }}>
          <RefreshCw size={15} /> Refresh desk
        </button>
      </div>

      {/* KPIs */}
      <div className="os-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[
          { l: 'Collected today', v: `₦${(stats.collected || 0).toLocaleString()}`, sub: 'This shift', c: '#059669', bg: '#ECFDF5', icon: Banknote },
          { l: 'Receipts', v: String(payments.length), sub: 'Posted today', c: C.blue, bg: '#EFF6FF', icon: Receipt },
          { l: 'Unpaid in queue', v: String(deskAi.unpaidTickets), sub: 'Need collection', c: '#D97706', bg: '#FFFBEB', icon: Clock },
          { l: 'Queue exposure', v: `₦${deskAi.pendingQueueValue.toLocaleString()}`, sub: 'Pending value', c: '#7C3AED', bg: '#F5F3FF', icon: Zap },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.l} className="mc-kpi-card" style={{
              background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 16,
              borderTop: `3px solid ${k.c}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: k.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={k.c} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 12, letterSpacing: '0.04em' }}>{k.l.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* AI strip */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14,
        background: 'linear-gradient(90deg, #F5F3FF, #EFF6FF)', border: '1px solid #E9D5FF',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, #7C3AED, #0284C7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: C.navy }}>POS AI · shift brain</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>{deskAi.shiftSummary}</div>
          {deskAi.anomalies?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {deskAi.anomalies.slice(0, 4).map((h: string, i: number) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  background: '#fff', border: '1px solid #E2E8F0', color: '#475569',
                }}>{h}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main 12-col style grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: 16, alignItems: 'start' }}>
        {/* LEFT: charge console */}
        <div style={{
          background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`,
          boxShadow: '0 8px 28px rgba(15,23,42,0.05)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: 'linear-gradient(180deg, #F8FAFC, #fff)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: '#E0F2FE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CreditCard size={18} color={C.blue} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Charge console</div>
                <div style={{ fontSize: 12, color: C.muted }}>Find patient → amount → method → confirm</div>
              </div>
            </div>
            {patient && (
              <button type="button" onClick={() => setPatient(null)} style={{
                border: 'none', background: '#F1F5F9', borderRadius: 8, padding: 6, cursor: 'pointer',
              }} title="Clear patient">
                <X size={16} color={C.muted} />
              </button>
            )}
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Patient search */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>PATIENT</label>
              <div style={{
                marginTop: 6, display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${patient ? '#7DD3FC' : C.border}`,
                background: patient ? '#F0F9FF' : '#F8FAFC',
              }}>
                <Search size={16} color={C.muted} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, hospital no., phone…"
                  style={{
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 14, fontWeight: 600, color: C.navy,
                  }}
                />
              </div>
              {!patient && searchHits.length > 0 && (
                <div style={{
                  marginTop: 8, maxHeight: 180, overflowY: 'auto', borderRadius: 12,
                  border: `1px solid ${C.border}`, background: '#fff',
                }}>
                  {searchHits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPatient(p);
                        setQuery(`${p.firstName} ${p.lastName}`);
                        const sug = suggestChargeForPatient(p, visits, payments);
                        if (sug?.suggestedAmount) setAmount(String(sug?.suggestedAmount));
                        if (sug?.suggestedMethod) setMethod(sug?.suggestedMethod as PaymentMethod);
                      }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none',
                        borderBottom: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer',
                        display: 'flex', gap: 10, alignItems: 'center',
                      }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, background: '#E0F2FE',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <UserRound size={16} color={C.blue} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: C.navy }}>
                          {p.firstName} {p.lastName}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {p.hospitalNumber} · {p.phone || 'No phone'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {patient && (
                <div style={{
                  marginTop: 10, padding: 12, borderRadius: 12,
                  background: 'linear-gradient(135deg, #F0F9FF, #ECFDF5)', border: '1px solid #BAE6FD',
                  display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: C.navy }}>{patient.firstName} {patient.lastName}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {patient.hospitalNumber} · {patient.sex} · {patient.phone || '—'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                    background: '#fff', color: C.teal, border: '1px solid #99F6E4',
                  }}>SELECTED</span>
                </div>
              )}
            </div>

            {/* AI patient suggestion */}
            {patient && patientAi && (
              <div style={{
                padding: 12, borderRadius: 12, background: '#FAF5FF', border: '1px solid #E9D5FF',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: '#6D28D9' }}>
                    <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
                    AI charge suggestion
                  </div>
                  <button type="button" onClick={applyAiSuggestion} style={{
                    fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 8,
                    border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer',
                  }}>
                    Apply AI
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#57534E', marginTop: 6, lineHeight: 1.4 }}>
                  {patientAi.detail || patientAi.nextBestAction || 'Review amount and method before posting.'}
                </div>
              </div>
            )}

            
            {/* Open hospital bill (shared ledger — billing office + clinical) */}
            {patient && (
              <OpenBillsPanel
                facilityId={facilityId}
                patientId={patient.id}
                hospitalNumber={patient.hospitalNumber}
                onUseBalance={(bal) => {
                  setAmount(String(bal));
                  setPurpose('Hospital bill');
                }}
              />
            )}

            {/* Amount + purpose */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>AMOUNT (₦)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  style={{
                    marginTop: 6, width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.border}`, fontSize: 20, fontWeight: 800,
                    color: C.navy, fontVariantNumeric: 'tabular-nums', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>PURPOSE</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  style={{
                    marginTop: 6, width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.border}`, fontSize: 14, fontWeight: 600,
                    color: C.navy, background: '#fff', outline: 'none',
                  }}
                >
                  {PURPOSES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>

            {/* Methods */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: '0.04em' }}>PAYMENT METHOD</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const on = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                        border: on ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                        background: on ? '#E0F2FE' : '#F8FAFC',
                        color: on ? C.blue : C.navy, fontWeight: 700, fontSize: 12,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={18} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick fee chips */}
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
                    fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 999,
                    border: `1px solid ${C.border}`, background: '#fff', color: C.navy, cursor: 'pointer',
                  }}
                >
                  {dept} · ₦{(fee as number).toLocaleString()}
                </button>
              ))}
            </div>

            {/* Confirm */}
            <button
              type="button"
              disabled={!patient}
              onClick={doCharge}
              style={{
                marginTop: 4, height: 52, borderRadius: 14, border: 'none',
                background: patient
                  ? 'linear-gradient(90deg, #0284C7 0%, #0D9488 100%)'
                  : '#CBD5E1',
                color: '#fff', fontWeight: 800, fontSize: 15, cursor: patient ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: patient ? '0 12px 28px rgba(2,132,199,0.35)' : 'none',
              }}
            >
              <CheckCircle2 size={18} />
              Record ₦{displayAmount.toLocaleString()} · {method.toUpperCase()}
              <ArrowRight size={18} />
            </button>
            <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
              AI never posts money without your confirmation
            </div>
          </div>
        </div>

        {/* RIGHT: unpaid queue + receipts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`,
            boxShadow: '0 8px 28px rgba(15,23,42,0.05)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(180deg, #FFFBEB, #fff)',
            }}>
              <div style={{ fontWeight: 800, color: C.navy }}>Unpaid queue</div>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
                background: '#FEF3C7', color: '#B45309',
              }}>{deskAi.unpaidTickets}</span>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {visits.filter((v) => v.paymentStatus === 'pending' || v.paymentStatus === 'partial').length === 0 &&
              openBillPatients.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                  No unpaid tickets or billing invoices — queue is clear
                </div>
              ) : (
                <>
                {openBillPatients.slice(0, 8).map((ob) => (
                  <button
                    key={`bill-${ob.patientId}`}
                    type="button"
                    onClick={() => {
                      const p = patients.find(
                        (x) => x.id === ob.patientId || x.hospitalNumber === ob.hospitalNumber
                      );
                      if (p) {
                        setPatient(p);
                        setQuery(`${p.firstName} ${p.lastName}`);
                      } else {
                        setQuery(ob.patientName);
                        setAmount(String(ob.balanceNgn));
                        setPurpose('Hospital bill');
                        setLines([{ label: 'Hospital bill', amount: ob.balanceNgn }]);
                      }
                    }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none',
                      borderBottom: '1px solid #E2E8F0', background: '#ECFEFF', cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 13 }}>{ob.patientName}</span>
                      <span style={{ fontWeight: 800, color: '#0D9488' }}>₦{ob.balanceNgn.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Billing / clinical · {ob.lines.length} open line{ob.lines.length === 1 ? '' : 's'}
                    </div>
                  </button>
                ))}
                {visits
                  .filter((v) => v.paymentStatus === 'pending' || v.paymentStatus === 'partial')
                  .slice(0, 12)
                  .map((v) => {
                    const fee = v.amount || CONSULT_FEES[v.department] || 5000;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          const p = patients.find((x) => x.id === v.patientId);
                          if (p) {
                            setPatient(p);
                            setQuery(`${p.firstName} ${p.lastName}`);
                          }
                          setAmount(String(fee));
                          setPurpose(v.department || 'Consultation');
                          setLines([{ label: v.department || 'Consultation', amount: fee }]);
                        }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none',
                          borderBottom: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: C.blue, fontSize: 12 }}>
                            {v.queueNumber}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: 13, color: C.navy }}>
                            ₦{fee.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{v.patientName}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{v.department}</div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div style={{
            background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`,
            boxShadow: '0 8px 28px rgba(15,23,42,0.05)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
              fontWeight: 800, color: C.navy,
            }}>
              Today&apos;s receipts
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {payments.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                  No receipts yet this shift
                </div>
              ) : (
                payments.slice(0, 20).map((p) => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 10,
                    padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: C.navy }}>{p.patientName}</div>
                      <div style={{ color: C.muted, marginTop: 2 }}>
                        {p.method} · {p.reference || p.id}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: C.teal, flexShrink: 0 }}>
                      ₦{p.amount.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {lastReceipt && !payCeremony && (
            <div style={{
              padding: 14, borderRadius: 14, background: '#ECFDF5', border: '1px solid #A7F3D0',
            }}>
              <div style={{ fontWeight: 800, color: '#047857', fontSize: 13 }}>Last receipt</div>
              <div style={{ fontSize: 12, color: '#065F46', marginTop: 6 }}>
                {lastReceipt.patientName} · ₦{lastReceipt.amount.toLocaleString()} · {lastReceipt.method}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {payCeremony && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: 20,
              background: '#fff',
              padding: '28px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            {payCeremony.phase === 'success' ? (
              <>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    background: 'linear-gradient(135deg,#16A34A,#0D9488)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={36} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#0F172A' }}>Payment successful</div>
                <div style={{ marginTop: 8, fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
                  ₦{payCeremony.pay.amount.toLocaleString()} · {String(payCeremony.pay.method).toUpperCase()}
                  <br />
                  {payCeremony.patientName}
                </div>
                <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: '#0D9488' }}>
                  Preparing receipt…
                </div>
                <div
                  style={{
                    marginTop: 12,
                    height: 4,
                    borderRadius: 999,
                    background: '#E2E8F0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '100%',
                      background: 'linear-gradient(90deg,#0284C7,#0D9488)',
                      animation: 'medcore-pay-progress 3s linear forwards',
                    }}
                  />
                </div>
                <style>{`@keyframes medcore-pay-progress { from { transform: scaleX(0); transform-origin: left; } to { transform: scaleX(1); transform-origin: left; } }`}</style>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    background: 'linear-gradient(135deg,#0284C7,#0D9488)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Printer size={32} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#0F172A' }}>Receipt issued</div>
                <div style={{ marginTop: 8, fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
                  Ref: <strong style={{ color: '#0F172A' }}>{payCeremony.pay.reference}</strong>
                  <br />
                  Bill marked paid · returning to desk…
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayCeremony(null);
                    onNavigate?.(session?.roleKey === 'reception' ? 'patient-flow' : 'dashboard');
                  }}
                  style={{
                    marginTop: 20,
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(90deg,#0284C7,#0D9488)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};





/** Open charges from billing office + clinical auto-bills */
function OpenBillsPanel({
  facilityId,
  patientId,
  hospitalNumber,
  onUseBalance,
}: {
  facilityId: string;
  patientId: string;
  hospitalNumber?: string;
  onUseBalance: (bal: number) => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeBills(() => setTick((n) => n + 1)), []);
  const lines = useMemo(() => {
    void tick;
    const a = listBillLines(facilityId, { patientId }).filter(
      (l) => l.status === 'unpaid' || l.status === 'partial'
    );
    const b = hospitalNumber
      ? listBillLines(facilityId, { patientId: hospitalNumber }).filter(
          (l) => l.status === 'unpaid' || l.status === 'partial'
        )
      : [];
    const byId = new Map<string, (typeof a)[0]>();
    for (const l of [...a, ...b]) byId.set(l.id, l);
    return Array.from(byId.values());
  }, [facilityId, patientId, hospitalNumber, tick]);
  const bal = lines.reduce((s, l) => s + l.amountNgn, 0);
  if (lines.length === 0) {
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px dashed #CBD5E1',
          background: '#F8FAFC',
          fontSize: 13,
          color: '#64748B',
        }}
      >
        No open hospital bill lines for this patient. Billing office invoices marked
        &quot;pending payment&quot; and clinical charges appear here.
      </div>
    );
  }
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid #A5F3FC',
        background: 'linear-gradient(135deg,#ECFEFF,#F0FDF4)',
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>
          Open bill · ₦{bal.toLocaleString()}
        </div>
        <button
          type="button"
          onClick={() => onUseBalance(bal)}
          style={{
            border: 'none',
            background: '#0D9488',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Use balance
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
        {lines.map((l) => (
          <div
            key={l.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12,
              padding: '6px 8px',
              borderRadius: 8,
              background: '#fff',
              border: '1px solid #E2E8F0',
            }}
          >
            <span style={{ color: '#334155', fontWeight: 600 }}>
              {l.source === 'billing' ? 'Billing · ' : ''}
              {l.description}
            </span>
            <span style={{ fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap' }}>
              ₦{l.amountNgn.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PosPaymentDesk;

