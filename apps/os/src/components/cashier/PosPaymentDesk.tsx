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
  Users, Clock, Zap,
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
import { verifyInsurance } from '../../lib/receptionConstants';

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

export const PosPaymentDesk: React.FC<Props> = ({ session }) => {
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
  const [insMsg, setInsMsg] = useState('');

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
    return () => {
      u1();
      u2();
    };
  }, [reload]);

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
    setLastReceipt(pay);
    reload();
    emitLiveAction(`POS ${pay.reference} · ₦${amt}`, { module: 'cashier' });
    flash(`Recorded · ${pay.reference} · ₦${amt.toLocaleString()}`);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: C.navy,
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Hero */}
      <div
        style={{
          borderRadius: 20,
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #0F172A 0%, #0E4D7B 45%, #0D9488 100%)',
          color: '#fff',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 16px 40px rgba(15,23,42,0.25)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', opacity: 0.9 }}>
            POS · PAYMENT DESK · AI-ASSISTED
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {facilityName}
          </h1>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
            {cashier} · Shift live · AI never posts money without your confirm
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Sync desk
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { l: 'Collected today', v: `₦${(stats.collected || 0).toLocaleString()}`, c: '#10B981' },
          { l: 'Receipts', v: String(payments.length), c: C.blue },
          { l: 'Unpaid in queue', v: String(deskAi.unpaidTickets), c: '#F59E0B' },
          { l: 'Queue exposure', v: `₦${deskAi.pendingQueueValue.toLocaleString()}`, c: '#EF4444' },
          { l: 'Avg ticket', v: `₦${Math.round(deskAi.avgTicket).toLocaleString()}`, c: '#8B5CF6' },
          { l: 'Cash / HMO mix', v: `${deskAi.cashSharePct}% / ${deskAi.hmoSharePct}%`, c: C.teal },
        ].map((k) => (
          <div
            key={k.l}
            style={{
              background: '#fff',
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              padding: '12px 14px',
              borderTop: `3px solid ${k.c}`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {k.l}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginTop: 4 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* AI shift strip */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          padding: '14px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #EEF2FF, #F0FDFA)',
          border: '1px solid rgba(99,102,241,0.2)',
        }}
      >
        <Sparkles size={18} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
          <strong style={{ color: C.navy }}>POS AI · shift brain</strong>
          <div style={{ marginTop: 4 }}>{deskAi.shiftSummary}</div>
          {deskAi.anomalies.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {deskAi.anomalies.map((a) => (
                <span
                  key={a}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#FEF3C7',
                    color: '#B45309',
                  }}
                >
                  <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr) minmax(260px, 320px)',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* Patient finder */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} color={C.blue} /> Patient
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input
              style={{ ...inputStyle, paddingLeft: 32 }}
              placeholder="Name, hospital no., phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {searchHits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPatient(p);
                  const sug = suggestChargeForPatient(p, visits, payments);
                  if (sug?.suggestedAmount) {
                    setAmount(String(sug.suggestedAmount));
                    setLines([{ label: sug.suggestedPurpose || 'Consultation', amount: sug.suggestedAmount }]);
                  }
                  if (sug?.suggestedMethod) setMethod(sug.suggestedMethod);
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px 10px',
                  borderRadius: 10,
                  border: patient?.id === p.id ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
                  background: patient?.id === p.id ? '#E0F2FE' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{fullName(p)}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.hospitalNumber}</div>
              </button>
            ))}
            {searchHits.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: C.muted, fontSize: 12 }}>No patients — register at reception first</div>
            )}
          </div>
        </div>

        {/* Charge console */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={16} color={C.teal} /> Charge console
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            {patient ? (
              <>
                Charging <strong>{fullName(patient)}</strong> · {patient.hospitalNumber}
              </>
            ) : (
              'Select a patient to enable AI charge suggestions'
            )}
          </div>

          {patientAi && (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 12,
                background:
                  patientAi.severity === 'attention'
                    ? '#FEF2F2'
                    : patientAi.severity === 'warn'
                      ? '#FFFBEB'
                      : '#F0FDF4',
                border: `1px solid ${
                  patientAi.severity === 'attention'
                    ? '#FECACA'
                    : patientAi.severity === 'warn'
                      ? '#FDE68A'
                      : '#BBF7D0'
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} /> {patientAi.title}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{patientAi.detail}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {patientAi.flags.map((f) => (
                      <span key={f} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fff', color: C.navy }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applyAiSuggestion}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: C.navy,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Apply AI
                </button>
              </div>
              <div style={{ fontSize: 11, marginTop: 8, color: C.muted }}>
                Next: <strong>{patientAi.nextBestAction}</strong> · risk {patientAi.risk}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, marginBottom: 8 }}>LINE ITEMS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {Object.entries(CONSULT_FEES).slice(0, 8).map(([dept, fee]) => (
              <button
                key={dept}
                type="button"
                onClick={() => applyLineTotal([{ label: dept, amount: fee }])}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                {dept} · ₦{fee.toLocaleString()}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Purpose</label>
              <select style={{ ...inputStyle, marginTop: 4 }} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {PURPOSES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Amount (₦)</label>
              <input
                style={{ ...inputStyle, marginTop: 4, fontSize: 18, fontWeight: 800 }}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, marginBottom: 8 }}>METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {METHODS.map((m) => {
              const Icon = m.icon;
              const on = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 12,
                    border: on ? `2px solid ${C.teal}` : `1px solid ${C.border}`,
                    background: on ? '#CCFBF1' : '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Icon size={16} color={on ? C.teal : C.muted} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {method === 'hmo' && patient && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: '#EFF6FF', fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>HMO verification</div>
              <select
                style={inputStyle}
                value={patient.insuranceProvider || 'NONE'}
                onChange={() => {}}
                disabled
              >
                {NIGERIA_INSURANCE.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const r = verifyInsurance(patient.insuranceProvider || 'NONE', patient.insuranceId);
                  setInsMsg(r.message);
                  flash(r.message);
                }}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: 'none',
                  background: C.blue,
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Run eligibility check
              </button>
              {insMsg && <div style={{ marginTop: 6, color: C.muted }}>{insMsg}</div>}
            </div>
          )}

          <button
            type="button"
            onClick={doCharge}
            disabled={!patient}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: 'none',
              background: patient ? `linear-gradient(90deg, ${C.teal}, ${C.blue})` : '#94A3B8',
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              cursor: patient ? 'pointer' : 'not-allowed',
              boxShadow: patient ? '0 8px 24px rgba(13,148,136,0.35)' : 'none',
            }}
          >
            Record payment · ₦{(Number(amount) || 0).toLocaleString()}
          </button>

          {lastReceipt && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 12,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt size={14} /> Last receipt
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {lastReceipt.reference} · ₦{lastReceipt.amount.toLocaleString()} · {lastReceipt.method}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{lastReceipt.patientName}</div>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <Printer size={13} /> Print
              </button>
            </div>
          )}
        </div>

        {/* Right: unpaid queue + receipts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color="#D97706" /> Unpaid queue
            </div>
            {unpaidVisits.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, padding: 8 }}>Queue payments clear</div>
            ) : (
              unpaidVisits.slice(0, 8).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    const p = patients.find((x) => x.id === v.patientId);
                    if (p) {
                      setPatient(p);
                      const fee = v.amount || CONSULT_FEES[v.department] || 5000;
                      setAmount(String(fee));
                      setPurpose(v.department);
                      setLines([{ label: v.department, amount: fee }]);
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 8px',
                    border: 'none',
                    borderBottom: `1px solid ${C.border}`,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.blue }}>{v.queueNumber}</span>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>
                      ₦{(v.amount || CONSULT_FEES[v.department] || 5000).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{v.patientName}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{v.department}</div>
                </button>
              ))
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Today&apos;s receipts</div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {payments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.patientName}</div>
                    <div style={{ color: C.muted }}>
                      {p.method} · {p.reference}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: C.teal }}>₦{p.amount.toLocaleString()}</div>
                </div>
              ))}
              {payments.length === 0 && (
                <div style={{ fontSize: 12, color: C.muted, padding: 8 }}>No receipts yet this shift</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosPaymentDesk;
