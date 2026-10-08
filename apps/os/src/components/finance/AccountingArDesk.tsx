'use client';

/**
 * Complete AR Desk — Epic/Cerner-style + Nigeria (cash/HMO/NHIA) + MedCore AI
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  computeArSnapshot,
  subscribeArDesk,
  listClaims,
  upsertClaim,
  advanceClaimStatus,
  listRemittances,
  postRemittance,
  listShiftCloses,
  closeCashierShift,
  expectedCashFromPayments,
  refreshWorkItemsFromLiveData,
  setWorkItemStatus,
  arAiCoach,
  type ArClaim,
  type ClaimStatus,
  type ArDashboardSnapshot,
  type DebtorRow,
} from '../../lib/arDeskStore';
import {
  Users,
  Clock,
  FileText,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Building2,
  TrendingUp,
  Shield,
  Banknote,
  ListTodo,
  ArrowRight,
} from 'lucide-react';
import { todayPayments } from '../../lib/receptionOpsStore';

type Tab = 'overview' | 'debtors' | 'aging' | 'claims' | 'remit' | 'shift' | 'worklist';

const C = {
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E8EEF5',
  blue: '#0284C7',
  teal: '#0D9488',
  amber: '#D97706',
  green: '#16A34A',
  red: '#DC2626',
  purple: '#7C3AED',
};

const CLAIM_FLOW: ClaimStatus[] = [
  'draft',
  'preauth_pending',
  'preauth_approved',
  'submitted',
  'queried',
  'paid',
  'denied',
  'appealed',
];

interface Props {
  session: UserSession;
  onCollectPayment?: () => void;
}

export const AccountingArDesk: React.FC<Props> = ({ session, onCollectPayment }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [tab, setTab] = useState<Tab>('overview');
  const [tick, setTick] = useState(0);
  const [snap, setSnap] = useState<ArDashboardSnapshot | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Claim form
  const [cName, setCName] = useState('');
  const [cHosp, setCHosp] = useState('');
  const [cPid, setCPid] = useState('');
  const [cPayer, setCPayer] = useState('NHIA');
  const [cAmt, setCAmt] = useState('');
  const [cType, setCType] = useState<'hmo' | 'nhia' | 'corporate'>('nhia');

  // Remit form
  const [rPayer, setRPayer] = useState('');
  const [rAmt, setRAmt] = useState('');
  const [rAlloc, setRAlloc] = useState('');
  const [rRef, setRRef] = useState('');

  // Shift form
  const [counted, setCounted] = useState('');
  const [shiftNote, setShiftNote] = useState('');

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  };

  const reload = useCallback(() => {
    const s = computeArSnapshot(facilityId);
    setSnap(s);
    setTick((n) => n + 1);
  }, [facilityId]);

  useEffect(() => {
    reload();
    refreshWorkItemsFromLiveData(facilityId);
    return subscribeArDesk(() => {
      reload();
    });
  }, [facilityId, reload]);

  const claims = useMemo(() => {
    void tick;
    return listClaims(facilityId);
  }, [facilityId, tick]);

  const remits = useMemo(() => {
    void tick;
    return listRemittances(facilityId);
  }, [facilityId, tick]);

  const shifts = useMemo(() => {
    void tick;
    return listShiftCloses(facilityId);
  }, [facilityId, tick]);

  const expectedCash = useMemo(() => {
    void tick;
    return expectedCashFromPayments(facilityId);
  }, [facilityId, tick]);

  const runAi = async () => {
    setAiBusy(true);
    try {
      const t = await arAiCoach(facilityId);
      setAiText(t);
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (snap) setAiText(snap.aiBrief);
  }, [snap?.updatedAt]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'AR overview', icon: TrendingUp },
    { id: 'debtors', label: 'Debtors', icon: Users },
    { id: 'aging', label: 'Aging', icon: Clock },
    { id: 'claims', label: 'Claims & auth', icon: Shield },
    { id: 'remit', label: 'Remittance', icon: Building2 },
    { id: 'shift', label: 'Shift close', icon: Banknote },
    { id: 'worklist', label: 'Worklist', icon: ListTodo },
  ];

  if (!snap) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
        Loading AR desk…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            background: C.navy,
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {toast}
        </div>
      )}

      {/* AR command strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          padding: '12px 14px',
          borderRadius: 14,
          background: 'linear-gradient(90deg,#FFFBEB,#F0FDFA)',
          border: '1px solid #FDE68A',
        }}
      >
        <Sparkles size={18} color={C.amber} />
        <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: C.navy, lineHeight: 1.45 }}>
          <strong>M87 AR intelligence</strong> · {aiText.slice(0, 220)}
          {aiText.length > 220 ? '…' : ''}
        </div>
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => void runAi()}
          style={btnPrimary}
        >
          {aiBusy ? 'Thinking…' : 'Refresh AI'}
        </button>
        <button type="button" onClick={() => { refreshWorkItemsFromLiveData(facilityId); reload(); flash('Worklist refreshed'); }} style={btnGhost}>
          <RefreshCw size={14} /> Sync
        </button>
        {onCollectPayment && (
          <button type="button" onClick={onCollectPayment} style={btnPrimary}>
            Collect payment <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        <Kpi label="Total A/R" value={`₦${snap.totalArNgn.toLocaleString()}`} color={C.amber} />
        <Kpi label="Cash AR" value={`₦${snap.cashArNgn.toLocaleString()}`} color={C.blue} />
        <Kpi label="HMO AR" value={`₦${snap.hmoArNgn.toLocaleString()}`} color={C.purple} />
        <Kpi label="NHIA AR" value={`₦${snap.nhiaArNgn.toLocaleString()}`} color={C.teal} />
        <Kpi label="Collected today" value={`₦${snap.collectedTodayNgn.toLocaleString()}`} color={C.green} />
        <Kpi label="Collection rate" value={`${snap.collectionRatePct}%`} color={C.navy} />
        <Kpi label="FD awaiting" value={String(snap.fdAwaitingCount)} color={C.red} />
        <Kpi label="Open claims" value={String(snap.openClaims)} color={C.blue} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                border: on ? `2px solid ${C.amber}` : `1px solid ${C.border}`,
                background: on ? '#FFFBEB' : '#fff',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                color: C.navy,
              }}
            >
              <Icon size={14} color={on ? C.amber : C.muted} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 14 }}>
          <Card title="Payer mix (open AR)">
            <Bar label="Cash / family" amt={snap.cashArNgn} total={snap.totalArNgn || 1} color={C.blue} />
            <Bar label="HMO" amt={snap.hmoArNgn} total={snap.totalArNgn || 1} color={C.purple} />
            <Bar label="NHIA" amt={snap.nhiaArNgn} total={snap.totalArNgn || 1} color={C.teal} />
            <Bar label="Corporate" amt={snap.corporateArNgn} total={snap.totalArNgn || 1} color={C.amber} />
            <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
              Today: Cash ₦{snap.cashTodayNgn.toLocaleString()} · POS ₦{snap.posTodayNgn.toLocaleString()} ·
              Transfer ₦{snap.transferTodayNgn.toLocaleString()} · {snap.receiptCountToday} receipts
            </div>
          </Card>
          <Card title="Needs attention">
            {snap.workItems.length === 0 ? (
              <Empty>No open work items — AR healthy</Empty>
            ) : (
              snap.workItems.slice(0, 8).map((w) => (
                <div key={w.id} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{w.title}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{w.detail}</div>
                  </div>
                  <PriorityBadge p={w.priority} />
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === 'debtors' && (
        <Card title={`Outstanding debtors (${snap.debtors.length})`}>
          {snap.debtors.length === 0 ? (
            <Empty>No open balances</Empty>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.muted, fontSize: 11 }}>
                  <th style={th}>Patient</th>
                  <th style={th}>Hosp #</th>
                  <th style={th}>Payer</th>
                  <th style={th}>Days</th>
                  <th style={th}>Balance</th>
                  <th style={th}>Lines</th>
                </tr>
              </thead>
              <tbody>
                {snap.debtors.map((d) => (
                  <tr key={d.patientId + d.hospitalNumber} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={td}>
                      <strong>{d.patientName}</strong>
                      {d.partial && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: C.amber, fontWeight: 700 }}>PARTIAL</span>
                      )}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{d.hospitalNumber}</td>
                    <td style={td}>{d.payerHint.toUpperCase()}</td>
                    <td style={td}>
                      <span style={{ color: d.daysOutstanding >= 90 ? C.red : d.daysOutstanding >= 30 ? C.amber : C.green, fontWeight: 700 }}>
                        {d.daysOutstanding}d
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 800 }}>₦{d.balanceNgn.toLocaleString()}</td>
                    <td style={td}>{d.lineCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'aging' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <Kpi label="0–30 days" value={`₦${snap.aging.d0_30.toLocaleString()}`} color={C.green} />
            <Kpi label="31–60 days" value={`₦${snap.aging.d31_60.toLocaleString()}`} color={C.blue} />
            <Kpi label="61–90 days" value={`₦${snap.aging.d61_90.toLocaleString()}`} color={C.amber} />
            <Kpi label="90+ days" value={`₦${snap.aging.d90plus.toLocaleString()}`} color={C.red} />
          </div>
          <Card title="Aging by payer (Nigeria)">
            {(['cash', 'hmo', 'nhia', 'corporate', 'family'] as const).map((p) => {
              const b = snap.aging.byPayer[p];
              return (
                <div key={p} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4 }}>{p.toUpperCase()} · ₦{b.total.toLocaleString()}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, fontSize: 11, color: C.muted }}>
                    <span>0–30: ₦{b.d0_30.toLocaleString()}</span>
                    <span>31–60: ₦{b.d31_60.toLocaleString()}</span>
                    <span>61–90: ₦{b.d61_90.toLocaleString()}</span>
                    <span>90+: ₦{b.d90plus.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === 'claims' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,0.9fr)', gap: 14 }}>
          <Card title="HMO / NHIA claim register">
            {claims.length === 0 ? (
              <Empty>No claims yet — create from the form</Empty>
            ) : (
              claims.slice(0, 40).map((c) => (
                <div key={c.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{c.patientName}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {c.hospitalNumber} · {c.payerName} · ₦{c.amountNgn.toLocaleString()}
                      </div>
                    </div>
                    <StatusPill status={c.status} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CLAIM_FLOW.filter((s) => s !== c.status).slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          advanceClaimStatus(c.id, s, s === 'denied' ? { denialReason: 'Payer query / tariff mismatch' } : {});
                          reload();
                          flash(`Claim → ${s}`);
                        }}
                        style={{ ...btnGhost, fontSize: 10, padding: '4px 8px' }}
                      >
                        → {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Card>
          <Card title="New claim / pre-auth">
            <Field label="Patient name" value={cName} onChange={setCName} />
            <Field label="Hospital number" value={cHosp} onChange={setCHosp} />
            <Field label="Patient ID" value={cPid} onChange={setCPid} />
            <Field label="Payer name" value={cPayer} onChange={setCPayer} />
            <label style={labelStyle}>Payer type</label>
            <select value={cType} onChange={(e) => setCType(e.target.value as typeof cType)} style={inputStyle}>
              <option value="nhia">NHIA</option>
              <option value="hmo">HMO</option>
              <option value="corporate">Corporate</option>
            </select>
            <Field label="Amount (₦)" value={cAmt} onChange={setCAmt} />
            <button
              type="button"
              style={{ ...btnPrimary, width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => {
                const amt = Number(cAmt) || 0;
                if (!cName.trim() || amt <= 0) {
                  flash('Name and amount required');
                  return;
                }
                upsertClaim({
                  facilityId,
                  patientId: cPid || cHosp || `PT-${Date.now()}`,
                  hospitalNumber: cHosp || cPid || '—',
                  patientName: cName.trim(),
                  payerType: cType,
                  payerName: cPayer.trim() || cType.toUpperCase(),
                  amountNgn: amt,
                  status: 'preauth_pending',
                  actorName: session.name,
                });
                setCName('');
                setCAmt('');
                reload();
                flash('Claim created · pre-auth pending');
              }}
            >
              Create claim
            </button>
          </Card>
        </div>
      )}

      {tab === 'remit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card title="Post HMO / NHIA remittance advice">
            <Field label="Payer" value={rPayer} onChange={setRPayer} />
            <Field label="Advice reference" value={rRef} onChange={setRRef} />
            <Field label="Amount received (₦)" value={rAmt} onChange={setRAmt} />
            <Field label="Allocated to claims (₦)" value={rAlloc} onChange={setRAlloc} />
            <button
              type="button"
              style={{ ...btnPrimary, width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => {
                const amountNgn = Number(rAmt) || 0;
                if (!rPayer.trim() || amountNgn <= 0) {
                  flash('Payer and amount required');
                  return;
                }
                postRemittance({
                  facilityId,
                  payerName: rPayer.trim(),
                  amountNgn,
                  adviceRef: rRef.trim() || `RA-${Date.now().toString(36).toUpperCase()}`,
                  allocatedNgn: Number(rAlloc) || amountNgn,
                  actorName: session.name,
                });
                setRPayer('');
                setRAmt('');
                setRAlloc('');
                setRRef('');
                reload();
                flash('Remittance posted');
              }}
            >
              Post remittance
            </button>
          </Card>
          <Card title="Recent remittances">
            {remits.length === 0 ? (
              <Empty>No remittance advice posted</Empty>
            ) : (
              remits.slice(0, 20).map((r) => (
                <div key={r.id} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.payerName}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {r.adviceRef} · allocated ₦{r.allocatedNgn.toLocaleString()}
                      {r.surplusNgn > 0 ? ` · surplus ₦${r.surplusNgn.toLocaleString()}` : ''}
                    </div>
                  </div>
                  <strong>₦{r.amountNgn.toLocaleString()}</strong>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === 'shift' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card title="Cashier shift close">
            <div style={{ fontSize: 13, marginBottom: 10, color: C.muted }}>
              Expected cash from system (today):{' '}
              <strong style={{ color: C.navy }}>₦{expectedCash.toLocaleString()}</strong>
            </div>
            <Field label="Physical cash counted (₦)" value={counted} onChange={setCounted} />
            <Field label="Note" value={shiftNote} onChange={setShiftNote} />
            <button
              type="button"
              style={{ ...btnPrimary, width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => {
                const countedCashNgn = Number(counted) || 0;
                const pays = todayPayments(facilityId).filter((p) => p.status === 'success');
                closeCashierShift({
                  facilityId,
                  deskId: session.badgeId || 'TILL-1',
                  cashier: session.name || 'Cashier',
                  expectedCashNgn: expectedCash,
                  countedCashNgn,
                  posTotalNgn: pays.filter((p) => p.method === 'pos').reduce((s, p) => s + p.amount, 0),
                  transferTotalNgn: pays
                    .filter((p) => p.method === 'transfer' || p.method === 'card')
                    .reduce((s, p) => s + p.amount, 0),
                  receiptCount: pays.length,
                  note: shiftNote,
                });
                setCounted('');
                setShiftNote('');
                reload();
                flash('Shift closed');
              }}
            >
              Close shift
            </button>
          </Card>
          <Card title="Closed shifts">
            {shifts.length === 0 ? (
              <Empty>No shifts closed yet</Empty>
            ) : (
              shifts.slice(0, 15).map((s) => (
                <div key={s.id} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.cashier}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {new Date(s.closedAt).toLocaleString()} · expected ₦{s.expectedCashNgn.toLocaleString()} ·
                      counted ₦{s.countedCashNgn.toLocaleString()}
                    </div>
                  </div>
                  <span
                    style={{
                      fontWeight: 800,
                      color: s.varianceNgn === 0 ? C.green : s.varianceNgn > 0 ? C.blue : C.red,
                    }}
                  >
                    {s.varianceNgn === 0 ? 'Balanced' : `Var ₦${s.varianceNgn.toLocaleString()}`}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === 'worklist' && (
        <Card title="Action worklist">
          <button
            type="button"
            onClick={() => {
              refreshWorkItemsFromLiveData(facilityId);
              reload();
              flash('Worklist rebuilt from live AR');
            }}
            style={{ ...btnGhost, marginBottom: 12 }}
          >
            <RefreshCw size={14} /> Rebuild from live data
          </button>
          {snap.workItems.length === 0 ? (
            <Empty>Queue clear</Empty>
          ) : (
            snap.workItems.map((w) => (
              <div key={w.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <PriorityBadge p={w.priority} />
                    <strong style={{ fontSize: 13 }}>{w.title}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{w.detail}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWorkItemStatus(w.id, 'done');
                    reload();
                  }}
                  style={btnGhost}
                >
                  <CheckCircle2 size={14} /> Done
                </button>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
};

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: '12px 12px',
        borderTop: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.04em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 800, fontSize: 13, color: C.navy }}>
        {title}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>{children}</div>;
}

function Bar({ label, amt, total, color }: { label: string; amt: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((amt / total) * 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 800 }}>₦{amt.toLocaleString()}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const color = p === 'critical' ? C.red : p === 'high' ? C.amber : p === 'medium' ? C.blue : C.muted;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, color, background: `${color}18`, padding: '2px 8px', borderRadius: 99 }}>
      {p.toUpperCase()}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        padding: '3px 8px',
        borderRadius: 99,
        background: '#F1F5F9',
        color: C.navy,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', fontWeight: 700 };
const td: React.CSSProperties = { padding: '10px 6px', verticalAlign: 'top' };
const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: '10px 0',
  borderBottom: `1px solid ${C.border}`,
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(90deg,#D97706,#F59E0B)',
  color: '#fff',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: '#fff',
  color: C.navy,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

export default AccountingArDesk;
