'use client';

/**
 * Doctor clinical desk — same UX pattern as Reception Front Desk Operations.
 * Hero · KPIs · Quick actions · Live worklist · Right rail. Realtime only, no demo patients.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Stethoscope, Activity, FileText, FlaskConical, Pill, Users, Clock,
  Brain, ChevronRight, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2,
  HeartPulse, Layers,
} from 'lucide-react';
import { todayVisits, subscribeReceptionOps, type ReceptionVisit } from '../../lib/receptionOpsStore';
import { listOrders, subscribeOrders, placeOrder, type ClinicalOrder } from '../../lib/clinicalEventBus';
import {
  ORDER_SETS,
  previewOrderBpa,
  listPendingCriticalAcks,
  acknowledgeCriticalResult,
  canAcknowledgeCritical,
  facilityIntelligencePulse,
  subscribeIntelligence,
} from '../../lib/clinicalIntelligenceEngine';
import {
  markResultReviewed,
  isReviewed,
  subscribeResultReviews,
} from '../../lib/resultReviewStore';
import { VisitStoryboard } from '../clinical-core/VisitStoryboard';
import { InBasketPanel } from '../clinical-core/InBasketPanel';
import { getPatientContext, subscribePatientContext } from '../../lib/patientContextStore';
import { listPatients, subscribePatients } from '../../lib/patientRegistryStore';
import { emitLiveAction } from '../../lib/liveActions';
import { updateVisitStatus } from '../../lib/receptionOpsStore';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

const C = {
  text: '#0F172A',
  muted: '#64748B',
  border: '#E8EEF5',
  blue: '#2563EB',
  teal: '#0D9488',
  violet: '#7C3AED',
  red: '#DC2626',
  green: '#16A34A',
  amber: '#D97706',
};

function waitMins(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export const DoctorDeskHome: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const firstName = (session.name || 'Doctor').split(' ')[0];
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderSetId, setOrderSetId] = useState('os-malaria');
  const [orderFlash, setOrderFlash] = useState('');
  const [resultTab, setResultTab] = useState<'critical' | 'unreviewed' | 'reviewed'>('unreviewed');

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeReceptionOps(reload);
    const u2 = subscribeOrders(reload);
    const u3 = subscribePatients(reload);
    const u4 = subscribeIntelligence(reload);
    const u5 = subscribeResultReviews(reload);
    const u6 = subscribePatientContext(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, []);

  const visits = useMemo(() => todayVisits(facilityId), [facilityId, tick]);
  const orders = useMemo(() => listOrders(facilityId), [facilityId, tick]);
  const criticalAcks = useMemo(() => listPendingCriticalAcks(facilityId), [facilityId, tick]);
  const pulse = useMemo(() => facilityIntelligencePulse(facilityId), [facilityId, tick]);
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);

  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called');
  const withMe = visits.filter((v) => v.status === 'with_provider');
  const completed = visits.filter((v) => v.status === 'completed');
  const pendingResults = orders.filter((o) => o.status === 'resulted');
  const openOrders = orders.filter((o) => o.status === 'ordered' || o.status === 'in_progress');
  const criticalOrders = orders.filter((o) => o.priority === 'stat' || o.priority === 'urgent');

  const worklist = useMemo(() => {
    return [...visits]
      .filter((v) => v.status !== 'cancelled' && v.status !== 'completed')
      .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  }, [visits]);

  const kpi = [
    {
      label: 'Waiting for clinic',
      value: waiting.length,
      sub: 'Check-ins in queue',
      icon: Users,
      tint: '#EFF6FF',
      iconColor: C.blue,
    },
    {
      label: 'With provider',
      value: withMe.length,
      sub: 'Active consultations',
      icon: Stethoscope,
      tint: '#F5F3FF',
      iconColor: C.violet,
    },
    {
      label: 'Completed today',
      value: completed.length,
      sub: 'Visits closed',
      icon: CheckCircle2,
      tint: '#ECFDF5',
      iconColor: C.green,
    },
    {
      label: 'Results ready',
      value: pendingResults.length,
      sub: 'Review in EMR',
      icon: FlaskConical,
      tint: '#FEF3C7',
      iconColor: C.amber,
    },
    {
      label: 'Open orders',
      value: openOrders.length,
      sub: criticalOrders.length ? `${criticalOrders.length} urgent/stat` : 'Lab · Rx · Imaging',
      icon: Activity,
      tint: '#FEF2F2',
      iconColor: C.red,
    },
  ];

  const quick = [
    { label: 'Open EMR', desc: 'Records & notes', icon: FileText, go: 'emr' },
    { label: 'Consultations', desc: 'See & treat', icon: Stethoscope, go: 'doctor-portal' },
    { label: 'Lab orders', desc: 'Order & track', icon: FlaskConical, go: 'laboratory' },
    { label: 'Prescribe', desc: 'e-Prescription', icon: Pill, go: 'pharmacy' },
    { label: 'Imaging', desc: 'Radiology / PACS', icon: Layers, go: 'radiology' },
    { label: 'AI assistant', desc: 'M87 clinical help', icon: Brain, go: 'm87-ai' },
  ];

  const takePatient = (v: ReceptionVisit) => {
    setBusyId(v.id);
    updateVisitStatus(v.id, 'with_provider');
    emitLiveAction(`Seeing ${v.patientName}`, { module: 'doctor-portal' });
    setTimeout(() => setBusyId(null), 400);
    reload();
  };

  const completeVisit = (v: ReceptionVisit) => {
    setBusyId(v.id);
    updateVisitStatus(v.id, 'completed');
    emitLiveAction(`Completed ${v.patientName}`, { module: 'doctor-portal' });
    setTimeout(() => setBusyId(null), 400);
    reload();
  };



  const fireOrderSet = () => {
    const set = ORDER_SETS.find((s) => s.id === orderSetId);
    const p = patients.find((x) => x.id === orderPatientId);
    if (!set || !p) {
      setOrderFlash('Select patient and order set');
      setTimeout(() => setOrderFlash(''), 2500);
      return;
    }
    let n = 0;
    let warns = 0;
    for (const item of set.items) {
      const bpas = previewOrderBpa({
        facilityId,
        patientId: p.id,
        type: item.type,
        code: item.code,
        name: item.name,
        priority: item.priority,
      });
      if (bpas.some((b) => b.level === 'hard_stop' || b.level === 'warning')) warns += 1;
      placeOrder({
        facilityId,
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        hospitalNumber: p.hospitalNumber,
        type: item.type,
        code: item.code,
        name: item.name,
        orderedBy: session.name || 'Doctor',
        orderedByBadge: session.badgeId,
        priority: item.priority || 'routine',
      });
      n += 1;
    }
    emitLiveAction(`Order set ${set.label}: ${n} orders on bus`, { module: 'doctor-portal' });
    setOrderFlash(`${set.label} · ${n} orders${warns ? ` · ${warns} BPA flags` : ''} · bills auto-created`);
    setTimeout(() => setOrderFlash(''), 4000);
    reload();
  };

  const criticalPanel = criticalAcks.length > 0 && (
    <div
      style={{
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={18} color="#DC2626" />
        <span style={{ fontWeight: 800, color: '#991B1B', fontSize: 14 }}>
          Critical results — acknowledge ({criticalAcks.length})
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 10 }}>{pulse.headline}</div>
      {criticalAcks.map((a) => (
        <div
          key={a.orderId}
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            border: '1px solid #FECACA',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>{a.patientName}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{a.hospitalNumber}</div>
          <div style={{ fontSize: 12, marginTop: 6, color: '#0F172A' }}>{a.summary}</div>
          <button
            type="button"
            onClick={() => {
              const ok = canAcknowledgeCritical(session.roleKey);
              if (!ok) {
                emitLiveAction('Only clinicians can acknowledge critical results', { module: 'doctor-portal' });
                return;
              }
              acknowledgeCriticalResult(a.orderId, session.name || 'Doctor', session.badgeId, session.roleKey);
              reload();
              emitLiveAction(`Critical result acknowledged: ${a.patientName}`, { module: 'doctor-portal' });
            }}
            style={{
              marginTop: 10,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#DC2626',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {canAcknowledgeCritical(session.roleKey) ? 'Acknowledge critical result' : 'Clinician ACK only'}
          </button>
        </div>
      ))}
    </div>
  );


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {criticalPanel}
      {getPatientContext() && (
        <VisitStoryboard
          facilityId={facilityId}
          patientId={getPatientContext()!.patientId}
          onJump={(step) => {
            if (step === 'orders' || step === 'results') onNavigate('laboratory');
            else if (step === 'rx') onNavigate('pharmacy');
            else if (step === 'checkin' || step === 'consult') onNavigate('patient-flow');
            else onNavigate('patient-360');
          }}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <InBasketPanel facilityId={facilityId} roleKey={session.roleKey} onNavigate={onNavigate} />
      </div>

      {/* Doctor order path — order sets + closed loop */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr auto',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Order path (sets → lab/Rx bus → bills)</div>
          <select
            value={orderPatientId}
            onChange={(e) => setOrderPatientId(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13 }}
          >
            <option value="">Patient…</option>
            {patients.slice(0, 40).map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} · {p.hospitalNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>Order set</div>
          <select
            value={orderSetId}
            onChange={(e) => setOrderSetId(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13 }}
          >
            {ORDER_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={fireOrderSet}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #0D9488)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Fire to bus
        </button>
        {orderFlash && (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#0F766E', fontWeight: 600 }}>{orderFlash}</div>
        )}
      </div>

      {/* Hero */}
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
        <div style={{ padding: '22px 28px', flex: 1, zIndex: 1, maxWidth: '70%' }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>
            Welcome back, {firstName} 👋
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>
            Clinical Desk
          </div>
          <div style={{ fontSize: 13, opacity: 0.88, maxWidth: 440, lineHeight: 1.45 }}>
            See patients, review results, order labs and prescriptions — one continuous clinical loop.
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
              Clinical systems online
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
              {session.department || 'Medical'} · {patients.length} registered patients
            </span>
          </div>
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
          <HeartPulse size={36} style={{ opacity: 0.9 }} />
          <div style={{ fontSize: 13, fontStyle: 'italic', opacity: 0.95, marginTop: 8, lineHeight: 1.4 }}>
            “ Better Care.
            <br />
            Smarter Systems.”
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, opacity: 0.85 }}>MedCore</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        {kpi.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="mc-kpi-card"
              style={{
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: '14px 16px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}
            >
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
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick actions */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 18,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Quick Actions</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
              Jump to the tools you use every shift
            </div>
            <div className="mc-stagger-desk" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
              {quick.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.label}
                    type="button"
                    className="mc-btn-live"
                    onClick={() => onNavigate(q.go)}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      background: '#F8FAFC',
                      padding: '14px 10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: '#EFF6FF',
                        color: C.blue,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{q.label}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{q.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live clinic board */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 18,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Clinic board</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Take · Complete — live from reception check-ins
                </div>
              </div>
              <button type="button" className="os-ghost-btn mc-btn-live" onClick={reload}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 700 }}>
                    {['Patient', 'ID', 'Dept', 'Wait', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {worklist.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                        No patients waiting — reception check-ins appear here in realtime
                      </td>
                    </tr>
                  )}
                  {worklist.slice(0, 12).map((v) => (
                    <tr
                      key={v.id}
                      className={`mc-queue-row${busyId === v.id ? ' is-updating' : ''}`}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>{v.patientName}</td>
                      <td style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>{v.hospitalNumber}</td>
                      <td style={{ padding: '12px 10px' }}>{v.department}</td>
                      <td style={{ padding: '12px 10px' }}>{waitMins(v.checkedInAt)} min</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background:
                              v.status === 'with_provider'
                                ? '#F5F3FF'
                                : v.status === 'called'
                                  ? '#ECFDF5'
                                  : '#EFF6FF',
                            color:
                              v.status === 'with_provider'
                                ? '#6D28D9'
                                : v.status === 'called'
                                  ? '#047857'
                                  : '#1D4ED8',
                          }}
                        >
                          {v.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(v.status === 'waiting' || v.status === 'called') && (
                            <button
                              type="button"
                              className={`mc-btn-live${busyId === v.id ? ' is-busy' : ''}`}
                              onClick={() => takePatient(v)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#EEF2FF',
                                color: '#4338CA',
                                cursor: 'pointer',
                              }}
                            >
                              See now
                            </button>
                          )}
                          {v.status === 'with_provider' && (
                            <button
                              type="button"
                              className={`mc-btn-live${busyId === v.id ? ' is-busy' : ''}`}
                              onClick={() => completeVisit(v)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#ECFDF5',
                                color: '#047857',
                                cursor: 'pointer',
                              }}
                            >
                              Complete
                            </button>
                          )}
                          <button
                            type="button"
                            className="mc-btn-live"
                            onClick={() => onNavigate('emr')}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid #E2E8F0',
                              background: '#fff',
                              color: C.muted,
                              cursor: 'pointer',
                            }}
                          >
                            EMR
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlaskConical size={15} color={C.amber} /> Results inbox
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[
                { id: 'critical', label: `Critical (${criticalAcks.length})` },
                { id: 'unreviewed', label: 'Unreviewed' },
                { id: 'reviewed', label: 'Reviewed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setResultTab(tab.id as typeof resultTab)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: resultTab === tab.id ? `1px solid ${C.blue}` : `1px solid ${C.border}`,
                    background: resultTab === tab.id ? '#EFF6FF' : '#fff',
                    color: resultTab === tab.id ? C.blue : C.muted,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {resultTab === 'critical' && (
              <>
                {criticalAcks.length === 0 && (
                  <div style={{ fontSize: 12, color: C.muted }}>No critical results pending ACK</div>
                )}
                {criticalAcks.slice(0, 6).map((a) => (
                  <div key={a.orderId} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: C.red }}>{a.patientName}</div>
                    <div style={{ color: C.muted }}>{a.summary}</div>
                    {canAcknowledgeCritical(session.roleKey) && (
                      <button
                        type="button"
                        onClick={() => {
                          acknowledgeCriticalResult(a.orderId, session.name || 'Doctor', session.badgeId, session.roleKey);
                          reload();
                        }}
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: C.red,
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
            {resultTab === 'unreviewed' && (
              <>
                {pendingResults.filter((o) => !isReviewed(o.id)).length === 0 && (
                  <div style={{ fontSize: 12, color: C.muted }}>No unreviewed results</div>
                )}
                {pendingResults.filter((o) => !isReviewed(o.id)).slice(0, 8).map((o) => (
                  <div key={o.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{o.patientName}</div>
                    <div style={{ color: C.muted }}>{o.name} · {o.resultSummary || 'Result available'}</div>
                    <button
                      type="button"
                      onClick={() => {
                        markResultReviewed(o.id, {
                          facilityId,
                          patientId: o.patientId,
                          by: session.name || 'Doctor',
                          badge: session.badgeId,
                        });
                        emitLiveAction(`Reviewed result ${o.name}`, { module: 'doctor-portal' });
                        reload();
                      }}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Mark reviewed
                    </button>
                  </div>
                ))}
              </>
            )}
            {resultTab === 'reviewed' && (
              <>
                {pendingResults.filter((o) => isReviewed(o.id)).length === 0 && (
                  <div style={{ fontSize: 12, color: C.muted }}>No reviewed results yet today</div>
                )}
                {pendingResults.filter((o) => isReviewed(o.id)).slice(0, 8).map((o) => (
                  <div key={o.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{o.patientName}</div>
                    <div style={{ color: C.muted }}>{o.name} · {o.resultSummary || '—'}</div>
                    <div style={{ color: C.green, fontWeight: 600, marginTop: 4 }}>Reviewed</div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Clinical pulse</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { l: 'Patients on file', v: String(patients.length) },
                { l: 'Visits today', v: String(visits.length) },
                { l: 'Orders open', v: String(openOrders.length) },
                { l: 'Urgent / STAT', v: String(criticalOrders.length) },
              ].map((x) => (
                <div key={x.l} style={{ background: '#F8FAFC', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{x.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>

          {criticalOrders.length > 0 && (
            <div
              style={{
                background: '#FEF2F2',
                borderRadius: 16,
                border: '1px solid #FECACA',
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: C.red, display: 'flex', gap: 6, alignItems: 'center' }}>
                <AlertTriangle size={15} /> Urgent orders
              </div>
              {criticalOrders.slice(0, 4).map((o) => (
                <div key={o.id} style={{ fontSize: 12, marginTop: 8, color: C.text }}>
                  <strong>{o.patientName}</strong> — {o.name} ({o.priority})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDeskHome;
