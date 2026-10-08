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
  TrendingUp,
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
import { AccountingArDesk } from '../finance/AccountingArDesk';
import { InsuranceHmoClaimsSuite } from '../finance/InsuranceHmoClaimsSuite';
import { emitLiveAction } from '../../lib/liveActions';

type AccView = 'home' | 'payment' | 'billing' | 'receipts' | 'ar' | 'claims';

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
    { id: 'home', label: 'Accounts home', icon: LayoutDashboard, badge: awaiting.length || undefined },
    { id: 'ar', label: 'AR desk', icon: Wallet, badge: awaiting.length || undefined },
    { id: 'payment', label: 'Collect payment', icon: CreditCard },
    { id: 'billing', label: 'Billing office', icon: FileText },
    { id: 'claims', label: 'HMO / NHIA claims', icon: FileText },
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

  const firstName = (session.name || 'Cashier').split(' ')[0];

  const kpi = [
    {
      label: 'Awaiting payment',
      value: String(awaiting.length),
      icon: Clock,
      tint: '#FEF3C7',
      iconColor: '#B45309',
      trend: awaiting.length ? 'Live' : undefined,
      up: true,
    },
    {
      label: 'Paid today',
      value: String(paidToday.length),
      icon: CheckCircle2,
      tint: '#DCFCE7',
      iconColor: '#16A34A',
    },
    {
      label: 'Collected today',
      value: `₦${(stats.collected || 0).toLocaleString()}`,
      icon: Wallet,
      tint: '#E0F2FE',
      iconColor: '#0284C7',
    },
    {
      label: 'Open bills',
      value: String(openBills.length),
      icon: FileText,
      tint: '#F3E8FF',
      iconColor: '#7C3AED',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '70vh', paddingBottom: 24 }}>
      {/* Hero — same pattern as Front Desk */}
      <div
        className="mc-hero-fluid"
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          color: '#fff',
          position: 'relative',
          minHeight: 148,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <div style={{ padding: '22px 28px', flex: 1, zIndex: 1, maxWidth: '62%' }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>
            Welcome back, {firstName} 👋
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>
            Accounting &amp; Cashier Desk
          </div>
          <div style={{ fontSize: 13, opacity: 0.88, maxWidth: 440, lineHeight: 1.45 }}>
            Collect payments from front-desk invoices, manage billing, and issue receipts — patients return to reception for the next step.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#4ADE80',
                  boxShadow: '0 0 0 3px rgba(74,222,128,0.35)',
                }}
              />
              System Online
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {facilityName}
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {awaiting.length} awaiting payment
            </span>
          </div>
        </div>
        {/* Hero photo — same assets as Front Desk */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '50%',
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <img
            src="/hosos-clean.png"
            alt=""
            onError={(e) => {
              const el = e.currentTarget;
              if (!el.dataset.fallback) {
                el.dataset.fallback = '1';
                el.src = '/auth-hero.png';
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              opacity: 0.42,
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 28%)',
              maskImage: 'linear-gradient(90deg, transparent 0%, black 28%)',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: '50%',
            transform: 'translateY(-50%)',
            textAlign: 'right',
            zIndex: 2,
            maxWidth: 180,
          }}
        >
          <div style={{ fontSize: 13, fontStyle: 'italic', opacity: 0.95, lineHeight: 1.4 }}>
            “ Better Care.
            <br />
            Smarter Systems.”
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, opacity: 0.85 }}>MedCore</div>
        </div>
      </div>

      {/* KPI row — same cards as front desk */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${kpi.length}, minmax(0, 1fr))`,
          gap: 10,
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        {kpi.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="mc-kpi-card"
              style={{
                background: '#fff',
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                padding: '12px 12px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: k.tint,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: k.iconColor,
                  }}
                >
                  <Icon size={18} />
                </div>
                {k.trend && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: k.up ? '#16A34A' : '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <TrendingUp size={12} />
                    {k.trend}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.navy, letterSpacing: -0.5 }}>{k.value}</div>
            </div>
          );
        })}
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
              <button
                type="button"
                onClick={() => setView('ar')}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid #FDE68A',
                  background: '#FFFBEB',
                  color: '#92400E',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Open full AR desk (debtors · aging · claims)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              padding: '16px 18px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #0B3A6E 0%, #0E7490 50%, #0D9488 100%)',
              color: '#fff',
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, letterSpacing: '0.04em' }}>
                COLLECT PAYMENT
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                {selectedReq
                  ? selectedReq.patientName
                  : 'Search patient or pick from awaiting queue'}
              </div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                {selectedReq
                  ? `${selectedReq.hospitalNumber} · ${selectedReq.purpose} · ₦${selectedReq.amountNgn.toLocaleString()}`
                  : 'Cash · POS · Transfer · then issue receipt for front desk'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView('home')}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ← Accounts home
            </button>
          </div>
          {selectedReq && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: 14,
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 800, color: '#92400E' }}>From front desk</span>
              <span style={{ color: '#78350F' }}>
                {selectedReq.invoiceNumber || selectedReq.id} · sent by {selectedReq.sentBy}
              </span>
              <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#B45309', fontSize: 16 }}>
                ₦{selectedReq.amountNgn.toLocaleString()}
              </span>
            </div>
          )}
          <div
            style={{
              borderRadius: 18,
              border: '1px solid #E8EEF5',
              overflow: 'hidden',
              background: '#F8FAFC',
              boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
            }}
          >
            <PosPaymentDesk
              session={session}
              embedded
              onNavigate={(k) => (k === 'dashboard' ? setView('home') : onNavigate?.(k))}
            />
          </div>
        </div>
      )}

      {view === 'ar' && (
        <AccountingArDesk session={session} onCollectPayment={() => setView('payment')} />
      )}

      {view === 'claims' && (
        <div>
          <InsuranceHmoClaimsSuite />
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
