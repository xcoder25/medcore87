'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pill,
  CreditCard,
  FileText,
  Boxes,
  Brain,
  Bell,
  Clock,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  X,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listOrders,
  subscribeOrders,
  type ClinicalOrder,
} from '../../lib/clinicalEventBus';
import {
  listPharmacyBillLines,
  getLineForOrder,
  subscribeBills,
} from '../../lib/patientBillingStore';
import {
  formularyStats,
  subscribeFormulary,
} from '../../lib/formularyInventory';
import {
  listWardMedRequests,
  subscribeWardMedRequests,
  updateWardMedRequestStatus,
  type WardMedRequest,
} from '../../lib/wardMedRequestStore';
import {
  listNotifications,
  markRead,
  subscribeNotifications,
  type HospitalNotification,
} from '../../lib/notificationEngine';
import { getActiveFacilityId } from '../../lib/facilityContext';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

export const PharmacyDeskHome: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || getActiveFacilityId() || 'IGH-EKT';
  const facilityName = session.facility || 'MedCore Facility';
  const actor = session.name || 'Pharmacist';
  const [tick, setTick] = useState(0);
  const [openNotif, setOpenNotif] = useState<HospitalNotification | null>(null);

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeOrders(reload);
    const u2 = subscribeBills(reload);
    const u3 = subscribeFormulary(reload);
    const u4 = subscribeWardMedRequests(reload);
    const u5 = subscribeNotifications(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [facilityId]);

  const data = useMemo(() => {
    const rxOrders = listOrders(facilityId).filter((o) => o.type === 'rx');
    const pharmacyBills = listPharmacyBillLines(facilityId);

    const activeRx = rxOrders.filter((o) => o.status !== 'resulted' && o.status !== 'cancelled');
    const paidReady: ClinicalOrder[] = [];
    const awaitingPay: ClinicalOrder[] = [];
    const deferredOrders: ClinicalOrder[] = [];

    for (const o of activeRx) {
      const line = getLineForOrder(o.id);
      if (line?.status === 'deferred' || o.deferredForPayment) {
        deferredOrders.push(o);
      } else if (
        o.paymentCleared ||
        line?.status === 'paid' ||
        line?.status === 'hmo' ||
        line?.status === 'waived'
      ) {
        paidReady.push(o);
      } else {
        awaitingPay.push(o);
      }
    }

    const deferredLinesCount = pharmacyBills.filter((l) => l.status === 'deferred').length;
    const wardReqs = listWardMedRequests(facilityId).filter(
      (r) => r.status === 'pending' || r.status === 'approved'
    );
    const inv = formularyStats(facilityId);
    const notices = listNotifications(facilityId, false, {
      staffName: actor,
      roleKey: 'pharmacist',
    });

    return {
      rxOrders,
      activeRx,
      paidReady,
      awaitingPay,
      deferredCount: Math.max(deferredOrders.length, deferredLinesCount),
      wardReqs,
      inv,
      notices,
    };
  }, [facilityId, actor, tick]);

  const firstName = actor.split(' ')[0] || 'Pharmacist';

  const quickActions = [
    {
      label: 'Dispense Queue',
      desc: `${data.paidReady.length} paid · ${data.awaitingPay.length} unpaid`,
      icon: Pill,
      go: 'pharmacy',
      accent: '#059669',
      bg: '#ECFDF5',
    },
    {
      label: 'Pharmacy Payment Desk',
      desc: 'Collect Rx bills & hold/restore drugs',
      icon: CreditCard,
      go: 'pharmacy-pos',
      accent: '#047857',
      bg: '#D1FAE5',
    },
    {
      label: 'Prescription Records',
      desc: `${data.rxOrders.length} longitudinal Rx dossiers`,
      icon: FileText,
      go: 'emr',
      accent: '#0F766E',
      bg: '#CCFBF1',
    },
    {
      label: 'Formulary & Stock',
      desc: `${data.inv.items} drugs · ${data.inv.lowStock} low stock`,
      icon: Boxes,
      go: 'formulary',
      accent: '#0284C7',
      bg: '#E0F2FE',
    },
    {
      label: 'Celestia Rx AI',
      desc: 'Interactions · dosing · stock insights',
      icon: Brain,
      go: 'm87-ai',
      accent: '#7C3AED',
      bg: '#F3E8FF',
    },
  ];

  const handleQuickApproveWardReq = (req: WardMedRequest) => {
    updateWardMedRequestStatus(req.id, facilityId, 'approved', actor, 'Approved on Pharmacy Desk');
    reload();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--os-font-sans, system-ui)' }}>
      {/* Emerald Pharmacy Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #0D9488 100%)',
          color: '#FFFFFF',
          borderRadius: 18,
          padding: '22px 26px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 14px 32px rgba(6, 78, 59, 0.24)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A7F3D0' }}>
            Dispensary & Clinical Pharmacy Command · {facilityName}
          </div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>
            Welcome, {firstName}
          </h1>
          <div style={{ fontSize: 13, color: '#D1FAE5' }}>
            Real-time e-Prescriptions, Ward Med Requests, FEFO stock alerts & dedicated Pharmacy Payment Desk
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onNavigate('pharmacy')}
            style={{
              background: '#FFFFFF',
              color: '#065F46',
              border: 'none',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Pill size={15} /> Open Dispense Queue
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pharmacy-pos')}
            style={{
              background: 'rgba(255,255,255,0.16)',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.32)',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CreditCard size={15} /> Pharmacy Payment Desk
          </button>
        </div>
      </div>

      {/* Full-Dataset Pharmacy KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
        {[
          { label: 'Pending Rx Orders', value: data.activeRx.length, sub: `${data.awaitingPay.length} awaiting payment`, color: '#0F172A', border: '#059669' },
          { label: 'Paid · Ready to Dispense', value: data.paidReady.length, sub: 'Cleared for release', color: '#047857', border: '#10B981' },
          { label: 'Held / Deferred Drugs', value: data.deferredCount, sub: 'Patient coming back later', color: '#7E22CE', border: '#9333EA' },
          { label: 'Ward Med Requests', value: data.wardReqs.length, sub: `${data.wardReqs.filter((w) => w.priority === 'stat').length} STAT urgent`, color: '#B45309', border: '#F59E0B' },
          { label: 'Low Stock / Expiring', value: data.inv.lowStock + data.inv.expiringBatches, sub: `${data.inv.lowStock} low · ${data.inv.expiringBatches} exp <=90d`, color: '#DC2626', border: '#EF4444' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderTop: `4px solid ${k.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: k.color, margin: '4px 0 2px' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {quickActions.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onNavigate(q.go)}
              style={{
                textAlign: 'left',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: q.bg,
                  color: q.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{q.label}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{q.desc}</div>
              </div>
              <ArrowRight size={15} color="#94A3B8" />
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Pharmacy Live Streams */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Left: Live Active Prescriptions + Ward Med Requests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Rx Preview */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                  Live Outpatient & Inpatient Prescriptions
                </h2>
                <div style={{ fontSize: 12, color: '#64748B' }}>Doctor orders routed directly to Pharmacy</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pharmacy')}
                style={{
                  border: '1px solid #A7F3D0',
                  background: '#ECFDF5',
                  color: '#065F46',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                View All ({data.activeRx.length})
              </button>
            </div>

            {data.activeRx.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13, background: '#F8FAFC', borderRadius: 12 }}>
                No pending prescriptions in dispensary queue.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.activeRx.slice(0, 6).map((rx) => {
                  const line = getLineForOrder(rx.id);
                  const isDeferred = line?.status === 'deferred' || rx.deferredForPayment;
                  const cleared =
                    rx.paymentCleared ||
                    line?.status === 'paid' ||
                    line?.status === 'hmo' ||
                    line?.status === 'waived';

                  return (
                    <div
                      key={rx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        background: isDeferred ? '#FAF5FF' : cleared ? '#F0FDF4' : '#FFFBEB',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>
                          {rx.patientName} <span style={{ fontWeight: 600, color: '#64748B' }}>· {rx.hospitalNumber}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#065F46', fontWeight: 700, marginTop: 2 }}>{rx.name}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Prescriber: {rx.orderedBy || 'Clinician'}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '4px 9px',
                          borderRadius: 999,
                          background: isDeferred ? '#F3E8FF' : cleared ? '#DCFCE7' : '#FEF3C7',
                          color: isDeferred ? '#7E22CE' : cleared ? '#15803D' : '#B45309',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isDeferred ? 'HELD FOR LATER' : cleared ? 'PAID · READY' : 'AWAITING PAY'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming Ward Med Requests from Nursing */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                  Incoming Ward Medication Requests
                </h2>
                <div style={{ fontSize: 12, color: '#64748B' }}>Requests from Inpatient Nurses & Labour Ward</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pharmacy')}
                style={{
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  color: '#0F172A',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Dispense Requests
              </button>
            </div>

            {data.wardReqs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 13, background: '#F8FAFC', borderRadius: 12 }}>
                All nurse ward medication requests have been processed.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.wardReqs.slice(0, 5).map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: req.priority === 'stat' ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                      background: req.priority === 'stat' ? '#FEF2F2' : '#FFFFFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>
                        {req.drugName} ({req.dosage}) × {req.quantity}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {req.ward} · Bed {req.bedNumber || 'Ward'} · {req.patientName || 'Ward Stock'} · By {req.requestedBy}
                      </div>
                    </div>
                    {req.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickApproveWardReq(req)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#059669',
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Approve
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', whiteSpace: 'nowrap' }}>
                        APPROVED
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Scoped Pharmacy Notifications ONLY */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={17} color="#059669" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                Pharmacy Alerts & Notices
              </h2>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '3px 8px', borderRadius: 999 }}>
              {data.notices.filter((n) => !n.read).length} unread
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            Scoped strictly to prescriptions, formulary stock, and ward med requests (nurse & OPD notices filtered out).
          </div>

          {data.notices.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: 13, background: '#F8FAFC', borderRadius: 12 }}>
              <PackageCheck size={24} color="#10B981" style={{ marginBottom: 6 }} />
              <div>No unread pharmacy notifications.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {data.notices.slice(0, 12).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    setOpenNotif(n);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: n.read ? '1px solid #E2E8F0' : '1px solid #A7F3D0',
                    background: n.read ? '#FFFFFF' : '#F0FDF4',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: 12, color: '#0F172A' }}>{n.title}</strong>
                    {n.level === 'critical' && <AlertTriangle size={13} color="#DC2626" />}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#475569',
                      marginTop: 3,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {n.body}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                    <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Openable Pharmacy Notification Detail Modal */}
      {openNotif && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 480, width: '100%', padding: 22, boxShadow: '0 24px 60px rgba(0,0,0,0.28)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '3px 9px', borderRadius: 999 }}>
                PHARMACY NOTICE · {openNotif.level.toUpperCase()}
              </span>
              <button type="button" onClick={() => setOpenNotif(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{openNotif.title}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#334155', lineHeight: 1.55 }}>{openNotif.body}</p>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 14 }}>
              Logged: {new Date(openNotif.createdAt).toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const target = openNotif.module || 'pharmacy';
                  setOpenNotif(null);
                  onNavigate(target);
                }}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />
                Open Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
