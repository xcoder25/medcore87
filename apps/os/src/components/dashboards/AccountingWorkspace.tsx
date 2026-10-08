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
      sub: awaiting.length ? 'From Front Desk' : 'Queue clear',
      icon: Clock,
      tint: 'linear-gradient(145deg,#FFFBEB,#FEF3C7)',
      iconColor: '#B45309',
      accent: '#F59E0B',
    },
    {
      label: 'Paid today',
      value: String(paidToday.length),
      sub: 'Cleared requests',
      icon: CheckCircle2,
      tint: 'linear-gradient(145deg,#ECFDF5,#D1FAE5)',
      iconColor: '#059669',
      accent: '#10B981',
    },
    {
      label: 'Collected today',
      value: `₦${(stats.collected || 0).toLocaleString()}`,
      sub: 'This shift',
      icon: Wallet,
      tint: 'linear-gradient(145deg,#EFF6FF,#DBEAFE)',
      iconColor: '#0284C7',
      accent: '#0284C7',
    },
    {
      label: 'Open bills',
      value: String(openBills.length),
      sub: 'Hospital ledger',
      icon: FileText,
      tint: 'linear-gradient(145deg,#F5F3FF,#EDE9FE)',
      iconColor: '#7C3AED',
      accent: '#8B5CF6',
    },
  ];

  return (
    <div className="mc-stagger-desk" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '70vh', paddingBottom: 28 }}>
      {/* Brand hero */}
      <div
        className="mc-hero-fluid"
        style={{
          borderRadius: 22,
          overflow: 'hidden',
          color: '#fff',
          position: 'relative',
          minHeight: 160,
          background: 'linear-gradient(135deg,#0052D4 0%,#0284C7 42%,#0D9488 100%)',
          boxShadow: '0 20px 50px rgba(2,82,212,0.22)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 50% 80% at 90% 20%, rgba(20,184,166,0.35), transparent 55%), radial-gradient(ellipse 40% 60% at 10% 90%, rgba(0,82,212,0.3), transparent)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ padding: '24px 28px', position: 'relative', zIndex: 1, maxWidth: 640 }}>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92, marginBottom: 6 }}>
            Welcome back, {firstName}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
            Accounting desk
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5, maxWidth: 480 }}>
            Live invoices from Front Desk · collect, receipt, clear balance — patient returns to reception for care.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span
                className="m87-live-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#4ADE80',
                  boxShadow: '0 0 0 3px rgba(74,222,128,0.35)',
                }}
              />
              Live sync
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.14)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {facilityName}
            </span>
            {awaiting.length > 0 && (
              <span
                style={{
                  background: 'rgba(245,158,11,0.95)',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {awaiting.length} awaiting
              </span>
            )}
            <button
              type="button"
              className="mc-btn-live"
              onClick={() => setView('payment')}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                border: 'none',
                background: 'rgba(255,255,255,0.95)',
                color: '#0052D4',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              Collect payment <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Nav pills */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          padding: 6,
          background: '#F1F5F9',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
        }}
      >
        {nav.map((n) => {
          const Icon = n.icon;
          const on = view === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              className={on ? 'mc-btn-live' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 12,
                border: on ? 'none' : '1px solid transparent',
                background: on ? 'linear-gradient(135deg,#0052D4,#0D9488)' : 'transparent',
                color: on ? '#fff' : C.navy,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: on ? '0 8px 20px rgba(2,132,199,0.25)' : 'none',
              }}
            >
              <Icon size={16} />
              {n.label}
              {n.badge != null && n.badge > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 999,
                    background: on ? 'rgba(255,255,255,0.25)' : '#F59E0B',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                  }}
                >
                  {n.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view === 'home' && (
        <>
          {/* KPI row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            {kpi.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="mc-kpi-card mc-scroll-reveal"
                  style={{
                    background: k.tint,
                    borderRadius: 18,
                    padding: '16px 16px 14px',
                    border: '1px solid rgba(255,255,255,0.7)',
                    boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: -8,
                      top: -8,
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: `${k.accent}18`,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: k.iconColor,
                        boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                      }}
                    >
                      <Icon size={20} />
                    </div>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: C.navy, letterSpacing: -0.3 }}>
                    {k.value}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginTop: 2 }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: k.iconColor, fontWeight: 600, marginTop: 4 }}>{k.sub}</div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {/* Awaiting from Front Desk */}
            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                border: `1px solid ${C.border}`,
                boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 18px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(180deg,#FFFBEB 0%,#fff 100%)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Front Desk invoices</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Snapshot live · pay here, patient returns to reception
                  </div>
                </div>
                <button
                  type="button"
                  onClick={bump}
                  title="Refresh"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: C.muted,
                  }}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                {awaiting.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 20px',
                      textAlign: 'center',
                      color: C.muted,
                      fontSize: 13,
                    }}
                  >
                    <CheckCircle2 size={32} style={{ color: '#10B981', marginBottom: 10 }} />
                    <div style={{ fontWeight: 700, color: C.navy }}>No invoices waiting</div>
                    <div style={{ marginTop: 4 }}>When Front Desk sends a fee, it appears here instantly.</div>
                  </div>
                ) : (
                  awaiting.map((r) => (
                    <div
                      key={r.id}
                      className="mc-scroll-reveal"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        alignItems: 'center',
                        padding: '14px 14px',
                        borderRadius: 14,
                        border: '1px solid #FED7AA',
                        background: 'linear-gradient(135deg,#FFF7ED,#fff)',
                        boxShadow: '0 4px 14px rgba(245,158,11,0.08)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>{r.patientName}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                          {r.hospitalNumber} · {r.purpose}
                          {r.invoiceNumber ? ` · ${r.invoiceNumber}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#B45309', fontWeight: 600, marginTop: 4 }}>
                          From {r.sentBy} · {new Date(r.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
                        ₦{r.amountNgn.toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="mc-btn-live"
                          onClick={() => openInPos(r)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(90deg,#D97706,#F59E0B)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: 'pointer',
                            boxShadow: '0 8px 18px rgba(217,119,6,0.3)',
                          }}
                        >
                          Collect <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => quickMarkPaid(r)}
                          title="Mark paid if already collected offline"
                          style={{
                            padding: '10px 12px',
                            borderRadius: 12,
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

            {/* Side column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 20,
                  border: `1px solid ${C.border}`,
                  boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: 800,
                    color: C.navy,
                    background: 'linear-gradient(180deg,#F0FDFA,#fff)',
                  }}
                >
                  Open hospital bills
                </div>
                <div style={{ padding: '8px 12px', maxHeight: 220, overflowY: 'auto' }}>
                  {openBills.length === 0 ? (
                    <div style={{ fontSize: 13, color: C.muted, padding: '16px 8px' }}>No open balances</div>
                  ) : (
                    openBills.slice(0, 10).map((ob) => (
                      <div
                        key={ob.patientId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 8px',
                          borderBottom: `1px solid ${C.border}`,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: C.navy }}>{ob.patientName}</span>
                        <span style={{ fontWeight: 800, color: C.teal }}>₦{ob.balanceNgn.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => setView('payment')}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg,#0052D4,#0D9488)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Open collect desk
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: 'linear-gradient(145deg,#F8FAFC,#EFF6FF)',
                  borderRadius: 20,
                  border: `1px solid ${C.border}`,
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 800, color: C.navy, marginBottom: 8, fontSize: 14 }}>Flow</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 6 }}>1. Front Desk sends invoice</div>
                  <div style={{ marginBottom: 6 }}>2. Collect here (Terminal / transfer / cash)</div>
                  <div style={{ marginBottom: 6 }}>3. Receipt issued · request paid</div>
                  <div>4. Patient returns to Front Desk</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'payment' && (
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(15,23,42,0.06)',
          }}
        >
          {selectedReq && (
            <div
              style={{
                padding: '12px 16px',
                background: 'linear-gradient(90deg,#FFFBEB,#FEF3C7)',
                borderBottom: '1px solid #FDE68A',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <Banknote size={18} color="#B45309" />
              <strong style={{ color: C.navy }}>{selectedReq.patientName}</strong>
              <span style={{ color: C.muted }}>{selectedReq.hospitalNumber}</span>
              <span style={{ fontWeight: 800, color: '#B45309' }}>₦{selectedReq.amountNgn.toLocaleString()}</span>
              <span style={{ color: C.muted }}>{selectedReq.purpose}</span>
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                style={{
                  marginLeft: 'auto',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: C.muted,
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </div>
          )}
          <PosPaymentDesk
            session={session}
            embedded
            onNavigate={(k) => (k === 'dashboard' ? setView('home') : onNavigate?.(k))}
          />
        </div>
      )}

      {view === 'ar' && (
        <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 12px 36px rgba(15,23,42,0.05)' }}>
          <AccountingArDesk session={session} onCollectPayment={() => setView('payment')} />
        </div>
      )}

      {view === 'claims' && (
        <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden', padding: 4 }}>
          <InsuranceHmoClaimsSuite />
        </div>
      )}

      {view === 'billing' && (
        <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden', padding: 4 }}>
          <BillingInvoicingSuite />
        </div>
      )}

      {view === 'receipts' && (
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(15,23,42,0.05)',
          }}
        >
          <div
            style={{
              padding: '16px 18px',
              borderBottom: `1px solid ${C.border}`,
              fontWeight: 800,
              background: 'linear-gradient(180deg,#EFF6FF,#fff)',
              color: C.navy,
            }}
          >
            Today&apos;s payments
          </div>
          {payments.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: C.muted }}>No payments recorded today</div>
          ) : (
            payments.slice(0, 40).map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: C.navy }}>{p.patientName}</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                    {p.method} · {p.reference}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: C.teal, fontSize: 15 }}>₦{p.amount.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AccountingWorkspace;
