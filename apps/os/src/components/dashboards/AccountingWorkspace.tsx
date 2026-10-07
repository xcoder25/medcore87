'use client';

/**
 * Accounting / Cashier desk — owns payment collection, POS, and billing office.
 * Receives digital invoices from Front Desk when a new folder is opened.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Users,
  Clock,
  CheckCircle2,
  Wallet,
  ArrowRight,
  RefreshCw,
  Banknote,
} from 'lucide-react';
import {
  listAccountsRequests,
  subscribeAccountsRequests,
  markAccountsRequestPaid,
  type FrontDeskAccountsRequest,
} from '../../lib/frontDeskAccountsBridge';
import { patientBalance, listPatientsWithOpenBills, subscribeBills } from '../../lib/patientBillingStore';
import { todayPayments, dayStats, subscribeReceptionOps } from '../../lib/receptionOpsStore';
import { PosPaymentDesk } from '../cashier/PosPaymentDesk';
import { BillingInvoicingSuite } from '../finance/BillingInvoicingSuite';
import { emitLiveAction } from '../../lib/liveActions';

type AccView = 'home' | 'payment' | 'billing' | 'receipts';

interface Props {
  session: UserSession;
  onNavigate?: (key: string) => void;
  initialView?: AccView;
}

const C = {
  navy: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  amber: '#D97706',
  teal: '#0D9488',
  blue: '#0284C7',
};

export const AccountingWorkspace: React.FC<Props> = ({
  session,
  onNavigate,
  initialView = 'home',
}) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const facilityName = session.facility || 'Hospital';
  const [view, setView] = useState<AccView>(initialView);
  const [tick, setTick] = useState(0);
  const [selectedReq, setSelectedReq] = useState<FrontDeskAccountsRequest | null>(null);

  const bump = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const u1 = subscribeAccountsRequests(bump);
    const u2 = subscribeBills(bump);
    const u3 = subscribeReceptionOps(bump);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [bump]);

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  const awaiting = useMemo(() => {
    void tick;
    return listAccountsRequests(facilityId, { status: 'awaiting_payment' });
  }, [facilityId, tick]);

  const paidToday = useMemo(() => {
    void tick;
    const day = new Date().toISOString().slice(0, 10);
    return listAccountsRequests(facilityId, { status: 'paid' }).filter((r) =>
      (r.paidAt || '').startsWith(day)
    );
  }, [facilityId, tick]);

  const payments = useMemo(() => {
    void tick;
    return todayPayments(facilityId);
  }, [facilityId, tick]);

  const stats = useMemo(() => {
    void tick;
    return dayStats(facilityId);
  }, [facilityId, tick]);

  const openBills = useMemo(() => {
    void tick;
    return listPatientsWithOpenBills(facilityId);
  }, [facilityId, tick]);

  const nav: { id: AccView; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'home', label: 'Accounts desk', icon: LayoutDashboard, badge: awaiting.length || undefined },
    { id: 'payment', label: 'Collect payment', icon: CreditCard },
    { id: 'billing', label: 'Billing office', icon: FileText },
    { id: 'receipts', label: 'Today receipts', icon: Wallet },
  ];

  const openInPos = (req: FrontDeskAccountsRequest) => {
    setSelectedReq(req);
    setView('payment');
    emitLiveAction(`Accounts open POS · ${req.hospitalNumber}`, { module: 'cashier' });
  };

  const quickMarkPaid = (req: FrontDeskAccountsRequest) => {
    const ref = `CASH-${Date.now().toString(36).toUpperCase()}`;
    markAccountsRequestPaid(req.id, {
      reference: ref,
      via: 'cashier',
      paidBy: session.name,
    });
    emitLiveAction(`Accounts paid · ${req.hospitalNumber} · ${ref}`, { module: 'cashier' });
    bump();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '70vh' }}>
      {/* Desk header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 16,
          background: 'linear-gradient(135deg,#FFFBEB 0%,#FFF7ED 50%,#F0FDFA 100%)',
          border: '1px solid #FDE68A',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.amber, letterSpacing: '0.06em' }}>
            ACCOUNTING · CASHIER DESK
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy, marginTop: 2 }}>
            {session.name || 'Cashier'} · {facilityName}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Front desk sends folder invoices here. Collect payment, issue receipt — patient returns to reception.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Kpi label="Awaiting pay" value={String(awaiting.length)} tone="#B45309" />
          <Kpi label="Paid today" value={String(paidToday.length)} tone="#047857" />
          <Kpi
            label="Cash today"
            value={`₦${(stats.collected || 0).toLocaleString()}`}
            tone="#0284C7"
          />
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nav.map((n) => {
          const Icon = n.icon;
          const on = view === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 12,
                border: on ? `2px solid ${C.amber}` : `1px solid ${C.border}`,
                background: on ? '#FFFBEB' : '#fff',
                fontWeight: 700,
                fontSize: 13,
                color: C.navy,
                cursor: 'pointer',
              }}
            >
              <Icon size={16} color={on ? C.amber : C.muted} />
              {n.label}
              {n.badge ? (
                <span
                  style={{
                    marginLeft: 4,
                    background: '#FEF3C7',
                    color: '#B45309',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {n.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {view === 'home' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
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
                background: 'linear-gradient(180deg,#FFFBEB,#fff)',
              }}
            >
              <div style={{ fontWeight: 800, color: C.navy }}>
                From front desk · awaiting payment
              </div>
              <button
                type="button"
                onClick={bump}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: C.muted,
                }}
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {awaiting.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 14 }}>
                  No pending invoices from front desk. When reception opens a new folder, it appears here.
                </div>
              ) : (
                awaiting.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${C.border}`,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 800, color: C.navy }}>{r.patientName}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {r.hospitalNumber} · {r.purpose}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                        Sent by {r.sentBy} · {new Date(r.sentAt).toLocaleTimeString()}
                        {r.invoiceNumber ? ` · ${r.invoiceNumber}` : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: C.amber }}>
                      ₦{r.amountNgn.toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openInPos(r)}
                        style={{
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
                        }}
                      >
                        Collect <ArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => quickMarkPaid(r)}
                        title="Mark paid if cash already taken"
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: `1px solid ${C.border}`,
                          background: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          color: C.navy,
                        }}
                      >
                        Mark paid
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 800, color: C.navy, marginBottom: 10 }}>Open hospital bills</div>
              {openBills.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted }}>No open balances</div>
              ) : (
                openBills.slice(0, 8).map((ob) => (
                  <div
                    key={ob.patientId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{ob.patientName}</span>
                    <span style={{ fontWeight: 800, color: C.teal }}>
                      ₦{ob.balanceNgn.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() => setView('payment')}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0F172A',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Open payment desk
              </button>
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg,#ECFDF5,#F0FDFA)',
                borderRadius: 16,
                border: '1px solid #A7F3D0',
                padding: 16,
                fontSize: 13,
                color: '#065F46',
                lineHeight: 1.5,
              }}
            >
              <strong>Patient journey</strong>
              <div style={{ marginTop: 8 }}>
                1. Front desk opens folder → invoice sent here
                <br />
                2. Patient pays at this desk → receipt issued
                <br />
                3. Patient returns to front desk with receipt → next step
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'payment' && (
        <div>
          {selectedReq && (
            <div
              style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 12,
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: 13,
              }}
            >
              <strong>Collecting for:</strong> {selectedReq.patientName} · {selectedReq.hospitalNumber} ·{' '}
              ₦{selectedReq.amountNgn.toLocaleString()} ({selectedReq.purpose})
            </div>
          )}
          <PosPaymentDesk session={session} onNavigate={(k) => (k === 'dashboard' ? setView('home') : onNavigate?.(k))} />
        </div>
      )}

      {view === 'billing' && (
        <div>
          <BillingInvoicingSuite />
        </div>
      )}

      {view === 'receipts' && (
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 800 }}>
            Today&apos;s payments
          </div>
          {payments.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: C.muted }}>No payments recorded today</div>
          ) : (
            payments.slice(0, 40).map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{p.patientName}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>
                    {p.method} · {p.reference}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: C.teal }}>₦{p.amount.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        padding: '10px 14px',
        minWidth: 100,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18, color: tone, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default AccountingWorkspace;
