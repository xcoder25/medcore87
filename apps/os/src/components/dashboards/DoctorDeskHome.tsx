'use client';

/**
 * Doctor clinical desk — same UX pattern as Reception Front Desk Operations.
 * Hero · KPIs · Quick actions · Live worklist · Right rail. Realtime only, no demo patients.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Stethoscope, Activity, FileText, FlaskConical, Pill, Users, Clock,
  Brain, ChevronRight, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2,
  HeartPulse, Layers, Phone, Heart, UserCheck, User, ArrowRight, Zap,
  Thermometer, Wind,
} from 'lucide-react';
import {
  visitsForDoctor,
  subscribeReceptionOps,
  updateVisitStatus,
  type ReceptionVisit,
} from '../../lib/receptionOpsStore';
import { listOrders, subscribeOrders, placeOrder, type ClinicalOrder } from '../../lib/clinicalEventBus';
import { subscribeVitals } from '../../lib/nursingVitalsStore';
import { setPatientContext } from '../../lib/patientContextStore';
import {
  listNotifications,
  subscribeNotifications,
  markRead,
  pushNotification,
} from '../../lib/notificationEngine';
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
import { useOpdSync, broadcastOpdStage } from '../../hooks/useOpdSync';

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderSetId, setOrderSetId] = useState('os-malaria');
  const [orderFlash, setOrderFlash] = useState('');
  const [resultTab, setResultTab] = useState<'critical' | 'unreviewed' | 'reviewed'>('unreviewed');
  const [newCritical, setNewCritical] = useState<string | null>(null); // flash on new critical patient
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const [lastCompleted, setLastCompleted] = useState<{
    patientName: string;
    queueNumber?: string;
  } | null>(null);

  // Unified real-time sync — reacts to nurse vitals, reception check-ins, BroadcastChannel
  const { tick } = useOpdSync({ heartbeatMs: 25_000 });

  const reload = useCallback(() => {
    setLastSync(new Date());
  }, []);

  // Belt-and-suspenders: direct store subscriptions (fire immediately on same-tab writes)
  useEffect(() => {
    const u1 = subscribeReceptionOps(reload);
    const u2 = subscribeOrders(reload);
    const u3 = subscribePatients(reload);
    const u4 = subscribeIntelligence(reload);
    const u5 = subscribeResultReviews(reload);
    const u6 = subscribePatientContext(reload);
    const u7 = subscribeNotifications(reload);
    const u8 = subscribeVitals(reload);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [reload]);

  // Flash badge when a new critical patient arrives via broadcast
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.urgency === 'critical' && d?.patientName) {
        setNewCritical(`Critical triage: ${d.patientName}`);
        setTimeout(() => setNewCritical(null), 8000);
      }
    };
    window.addEventListener('medcore-opd-stage', handler);
    return () => window.removeEventListener('medcore-opd-stage', handler);
  }, []);

  const doctorName = session.name || '';
  /** Only visits assigned to this doctor (or open pool "Any available") */
  const visits = useMemo(
    () => visitsForDoctor(facilityId, doctorName),
    [facilityId, doctorName, tick]
  );
  const orders = useMemo(() => listOrders(facilityId), [facilityId, tick]);
  const criticalAcks = useMemo(() => listPendingCriticalAcks(facilityId), [facilityId, tick]);
  const pulse = useMemo(() => facilityIntelligencePulse(facilityId), [facilityId, tick]);
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);
  const myNotifs = useMemo(
    () =>
      listNotifications(facilityId, true, {
        staffName: doctorName,
        roleKey: session.roleKey,
      }).filter((n) => n.roleHint === 'doctor' || n.module === 'doctor-portal' || !n.roleHint),
    [facilityId, doctorName, session.roleKey, tick]
  );

  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called');
  const withMe = visits.filter((v) => v.status === 'with_provider');
  const completed = visits.filter((v) => v.status === 'completed');
  const pendingResults = orders.filter((o) => o.status === 'resulted');
  const openOrders = orders.filter((o) => o.status === 'ordered' || o.status === 'in_progress');
  const criticalOrders = orders.filter((o) => o.priority === 'stat' || o.priority === 'urgent');

  const waitingQueue = useMemo(() => {
    return visits.filter((v) => v.status === 'waiting' || v.status === 'called');
  }, [visits]);

  /** Next patient to call: critical triage first, then urgent, then FIFO */
  const nextPatient = useMemo(() => {
    if (waitingQueue.length === 0) return null;
    return [...waitingQueue].sort((a, b) => {
      const score = (u?: string) => (u === 'critical' ? 2 : u === 'urgent' ? 1 : 0);
      const diff = score(b.triageUrgency) - score(a.triageUrgency);
      if (diff !== 0) return diff;
      return a.checkedInAt.localeCompare(b.checkedInAt);
    })[0];
  }, [waitingQueue]);

  const worklist = useMemo(() => {
    return [...visits]
      .filter((v) => v.status !== 'cancelled' && v.status !== 'completed')
      .sort((a, b) => {
        // Patients with provider first, then called, then waiting by urgency & FIFO
        if (a.status === 'with_provider' && b.status !== 'with_provider') return -1;
        if (b.status === 'with_provider' && a.status !== 'with_provider') return 1;
        const score = (u?: string) => (u === 'critical' ? 2 : u === 'urgent' ? 1 : 0);
        const diff = score(b.triageUrgency) - score(a.triageUrgency);
        if (diff !== 0) return diff;
        return a.checkedInAt.localeCompare(b.checkedInAt);
      });
  }, [visits]);

  const kpi = [
    {
      label: 'Waiting for clinic',
      value: waiting.length,
      sub: 'Check-ins in queue · Live',
      icon: Users,
      tint: '#EFF6FF',
      iconColor: C.blue,
    },
    {
      label: 'With provider',
      value: withMe.length,
      sub: 'Active consultations · Live',
      icon: Stethoscope,
      tint: '#F5F3FF',
      iconColor: C.violet,
    },
    {
      label: 'Completed today',
      value: completed.length,
      sub: 'Visits closed · Live',
      icon: CheckCircle2,
      tint: '#ECFDF5',
      iconColor: C.green,
    },
    {
      label: 'Results ready',
      value: pendingResults.length,
      sub: 'Review in EMR · Live',
      icon: FlaskConical,
      tint: '#FEF3C7',
      iconColor: C.amber,
    },
    {
      label: 'Open orders',
      value: openOrders.length,
      sub: criticalOrders.length ? `${criticalOrders.length} urgent/stat · Live` : 'Lab · Rx · Imaging · Live',
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
    { label: 'AI assistant', desc: 'Celestia clinical help', icon: Brain, go: 'm87-ai' },
  ];

  const callPatient = (v: ReceptionVisit) => {
    setBusyId(v.id);
    updateVisitStatus(v.id, 'called');
    emitLiveAction(`Called ${v.patientName} · ${v.queueNumber}`, { module: 'doctor-portal' });
    try {
      pushNotification({
        facilityId,
        level: 'info',
        title: 'Patient called',
        body: `${v.patientName} · ${v.queueNumber} · ${v.department}`,
        module: 'reception',
      });
    } catch { /* ignore */ }
    // Notify reception & triage that this patient was called
    broadcastOpdStage('medcore_reception', {
      facilityId, patientId: v.patientId, visitId: v.id,
      stage: 'called', patientName: v.patientName, queueNumber: v.queueNumber,
    });
    broadcastOpdStage('medcore_triage', {
      facilityId, patientId: v.patientId, stage: 'called',
    });
    setTimeout(() => setBusyId(null), 400);
    reload();
  };

  const takePatient = (v: ReceptionVisit) => {
    setBusyId(v.id);
    updateVisitStatus(v.id, 'with_provider');
    setLastCompleted(null);
    try {
      const parts = (v.patientName || '').split(' ');
      setPatientContext({
        id: v.patientId,
        hospitalNumber: v.hospitalNumber,
        firstName: parts[0] || v.patientName,
        lastName: parts.slice(1).join(' ') || '',
        facilityId,
      });
    } catch { /* ignore */ }
    emitLiveAction(`Seeing ${v.patientName}`, { module: 'doctor-portal' });
    try {
      pushNotification({
        facilityId,
        level: 'info',
        title: 'Consult started',
        body: `${v.patientName} · with provider · ${v.department}`,
        module: 'reception',
      });
    } catch { /* ignore */ }
    broadcastOpdStage('medcore_reception', {
      facilityId, patientId: v.patientId, visitId: v.id,
      stage: 'with_provider', patientName: v.patientName,
    });
    setTimeout(() => setBusyId(null), 400);
    reload();
  };

  const completeVisit = (v: ReceptionVisit) => {
    setBusyId(v.id);
    updateVisitStatus(v.id, 'completed');
    setLastCompleted({ patientName: v.patientName, queueNumber: v.queueNumber });
    emitLiveAction(`Completed ${v.patientName}`, { module: 'doctor-portal' });
    try {
      pushNotification({
        facilityId,
        level: 'info',
        title: 'Visit completed',
        body: `${v.patientName} · ${v.queueNumber || ''} · done`,
        module: 'reception',
      });
    } catch { /* ignore */ }
    broadcastOpdStage('medcore_reception', {
      facilityId, patientId: v.patientId, visitId: v.id,
      stage: 'completed', patientName: v.patientName, queueNumber: v.queueNumber,
    });
    broadcastOpdStage('medcore_triage', {
      facilityId, patientId: v.patientId, stage: 'completed',
    });
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


  const assignmentBanner =
    myNotifs.length > 0 ? (
      <div
        style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, color: '#065F46' }}>
          New assignments · {myNotifs.length}
        </div>
        {myNotifs.slice(0, 4).map((n) => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              background: '#fff',
              borderRadius: 8,
              padding: '8px 10px',
              border: '1px solid #D1FAE5',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{n.title}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{n.body}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                markRead(n.id);
                reload();
                onNavigate('doctor-portal');
              }}
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                background: '#0D9488',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {/* Critical triage flash — fires when nurse records critical vitals */}
      {newCritical && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF2F2, #FFF1F2)',
          border: '2px solid #FECACA',
          borderRadius: 14,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'pulse 1.5s ease-in-out infinite',
          boxShadow: '0 4px 16px rgba(220,38,38,0.15)',
        }}>
          <Zap size={20} color="#DC2626" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#991B1B' }}>
              🚨 Triage Alert — {newCritical}
            </div>
            <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2 }}>
              Critical vitals recorded by nursing · Patient at the top of your queue
            </div>
          </div>
          <button type="button" onClick={() => setNewCritical(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontWeight: 700, fontSize: 12 }}>
            Dismiss
          </button>
        </div>
      )}
      {criticalPanel}
      {assignmentBanner}
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
        <InBasketPanel
          facilityId={facilityId}
          roleKey={session.roleKey}
          staffName={session.name}
          onNavigate={onNavigate}
        />
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
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Clinic Consultation Board</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Active queue · Triage vitals · Next-up patient caller
                </div>
              </div>
              <button type="button" className="os-ghost-btn mc-btn-live" onClick={reload}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {/* SECTION 1: Active Consultation Card (if seeing a patient) */}
            {withMe.length > 0 && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                  border: '1.5px solid #DDD6FE',
                  borderRadius: 16,
                  padding: '16px 20px',
                  marginBottom: 16,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: '#7C3AED',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                      }}
                    >
                      <Stethoscope size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', background: '#fff', padding: '2px 8px', borderRadius: 999 }}>
                          CURRENTLY IN CONSULTATION
                        </span>
                        <span style={{ fontSize: 12, color: '#6D28D9', fontWeight: 600 }}>Queue #{withMe[0].queueNumber}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginTop: 2 }}>
                        {withMe[0].patientName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {withMe[0].hospitalNumber} · {withMe[0].department} · In room {waitMins(withMe[0].checkedInAt)}m
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {withMe[0].triageUrgency && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background:
                            withMe[0].triageUrgency === 'critical'
                              ? '#FEF2F2'
                              : withMe[0].triageUrgency === 'urgent'
                              ? '#FFFBEB'
                              : '#ECFDF5',
                          color:
                            withMe[0].triageUrgency === 'critical'
                              ? '#DC2626'
                              : withMe[0].triageUrgency === 'urgent'
                              ? '#D97706'
                              : '#16A34A',
                          border:
                            withMe[0].triageUrgency === 'critical'
                              ? '1px solid #FECACA'
                              : withMe[0].triageUrgency === 'urgent'
                              ? '1px solid #FDE68A'
                              : '1px solid #BBF7D0',
                          textTransform: 'uppercase',
                        }}
                      >
                        {withMe[0].triageUrgency}
                      </span>
                    )}
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: 10,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1F2937',
                      }}
                    >
                      {withMe[0].vitalsSummary || 'Triage vitals on file'}
                    </div>
                    <button
                      type="button"
                      onClick={() => completeVisit(withMe[0])}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(135deg, #16A34A, #0D9488)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                      }}
                    >
                      <CheckCircle2 size={16} /> Complete & Call Next Patient
                    </button>
                  </div>
                </div>

                {/* Up Next in Queue Preview banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontSize: 12,
                    border: '1px solid rgba(221, 214, 254, 0.8)',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4C1D95' }}>
                    <span style={{ fontWeight: 800 }}>Next in Line:</span>
                    {nextPatient ? (
                      <span>
                        <strong>{nextPatient.patientName}</strong> ({nextPatient.hospitalNumber} · #{nextPatient.queueNumber}) · Waiting {waitMins(nextPatient.checkedInAt)}m
                        {nextPatient.vitalsSummary ? ` · ${nextPatient.vitalsSummary}` : ''}
                      </span>
                    ) : (
                      <span style={{ color: '#6B7280' }}>No other patients waiting in queue</span>
                    )}
                  </div>
                  {nextPatient && (
                    <button
                      type="button"
                      onClick={() => callPatient(nextPatient)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #7C3AED',
                        background: '#fff',
                        color: '#7C3AED',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Phone size={11} /> Call Next ({nextPatient.queueNumber})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 2: Completed Banner with Call Next Trigger */}
            {lastCompleted && withMe.length === 0 && (
              <div
                style={{
                  background: '#ECFDF5',
                  border: '1.5px solid #A7F3D0',
                  borderRadius: 14,
                  padding: '12px 18px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={18} color="#16A34A" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#065F46' }}>
                      Consultation completed for {lastCompleted.patientName}
                    </div>
                    <div style={{ fontSize: 12, color: '#047857' }}>
                      {nextPatient
                        ? `Next patient ready is ${nextPatient.patientName} (${nextPatient.hospitalNumber} · Queue #${nextPatient.queueNumber})`
                        : 'OPD queue is now clear.'}
                    </div>
                  </div>
                </div>
                {nextPatient && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => callPatient(nextPatient)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: '1px solid #059669',
                        background: '#fff',
                        color: '#065F46',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Phone size={13} /> Call {nextPatient.patientName}
                    </button>
                    <button
                      type="button"
                      onClick={() => takePatient(nextPatient)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#16A34A',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Stethoscope size={13} /> See Now
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: Next Patient in Queue Flight-Deck Card (when doctor is free) */}
            {nextPatient && withMe.length === 0 && !lastCompleted && (
              <div
                style={{
                  background:
                    nextPatient.triageUrgency === 'critical'
                      ? 'linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)'
                      : nextPatient.triageUrgency === 'urgent'
                      ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'
                      : 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
                  border:
                    nextPatient.triageUrgency === 'critical'
                      ? '1.5px solid #FECACA'
                      : nextPatient.triageUrgency === 'urgent'
                      ? '1.5px solid #FDE68A'
                      : '1.5px solid #BFDBFE',
                  borderRadius: 18,
                  padding: '18px 22px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  boxShadow:
                    nextPatient.triageUrgency === 'critical'
                      ? '0 8px 24px rgba(239, 68, 68, 0.12)'
                      : '0 8px 24px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background:
                        nextPatient.triageUrgency === 'critical'
                          ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                          : nextPatient.triageUrgency === 'urgent'
                          ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                          : 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                      flexShrink: 0,
                    }}
                  >
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          color:
                            nextPatient.triageUrgency === 'critical'
                              ? '#B91C1C'
                              : nextPatient.triageUrgency === 'urgent'
                              ? '#92400E'
                              : '#1D4ED8',
                          background:
                            nextPatient.triageUrgency === 'critical'
                              ? '#FEE2E2'
                              : nextPatient.triageUrgency === 'urgent'
                              ? '#FEF3C7'
                              : '#DBEAFE',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {nextPatient.triageUrgency === 'critical'
                          ? 'CRITICAL TRIAGE PRIORITY'
                          : nextPatient.triageUrgency === 'urgent'
                          ? 'URGENT PRIORITY'
                          : 'NEXT UP IN QUEUE'}
                      </span>
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>
                        Ticket #{nextPatient.queueNumber}
                      </span>
                      <span style={{ fontSize: 11, color: C.muted }}>
                        Waiting {waitMins(nextPatient.checkedInAt)}m
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: 18, color: C.text, marginTop: 3 }}>
                      {nextPatient.patientName}
                    </div>

                    {/* Vitals Telemetry Chips Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{nextPatient.hospitalNumber}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>•</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{nextPatient.department}</span>

                      {nextPatient.vitalsBp ? (
                        <>
                          <span style={{ fontSize: 11, color: C.muted }}>•</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#FFFFFF',
                              padding: '2px 8px',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid #E2E8F0',
                              color: C.text,
                            }}
                          >
                            <Heart size={11} color="#EF4444" /> BP {nextPatient.vitalsBp}
                          </span>
                          {nextPatient.vitalsPulse && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#FFFFFF',
                                padding: '2px 8px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                border: '1px solid #E2E8F0',
                                color: C.text,
                              }}
                            >
                              <Activity size={11} color="#0D9488" /> {nextPatient.vitalsPulse} bpm
                            </span>
                          )}
                          {nextPatient.vitalsTemp && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#FFFFFF',
                                padding: '2px 8px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                border: '1px solid #E2E8F0',
                                color: C.text,
                              }}
                            >
                              <Thermometer size={11} color="#EA580C" /> {nextPatient.vitalsTemp}°C
                            </span>
                          )}
                          {nextPatient.vitalsSpo2 && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#FFFFFF',
                                padding: '2px 8px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                border: '1px solid #E2E8F0',
                                color: C.text,
                              }}
                            >
                              <Wind size={11} color="#2563EB" /> SpO₂ {nextPatient.vitalsSpo2}%
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 11, color: C.muted }}>•</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#D97706',
                              background: '#FFFBEB',
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid #FDE68A',
                            }}
                          >
                            Awaiting Vitals
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => callPatient(nextPatient)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 12,
                      border: '1.5px solid #2563EB',
                      background: '#FFFFFF',
                      color: '#2563EB',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 6px rgba(37,99,235,0.08)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Phone size={14} /> Call Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => takePatient(nextPatient)}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Stethoscope size={15} /> Start Consultation
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 700 }}>
                    {['Patient', 'ID', 'Triage / Vitals', 'Dept', 'Wait', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {worklist.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                        No patients waiting — reception check-ins appear here in realtime
                      </td>
                    </tr>
                  )}
                  {worklist.slice(0, 15).map((v) => (
                    <tr
                      key={v.id}
                      className={`mc-queue-row${busyId === v.id ? ' is-updating' : ''}`}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{v.patientName}</span>
                          {nextPatient?.id === v.id && v.status !== 'with_provider' && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                border: '1px solid #BFDBFE',
                                padding: '1px 6px',
                                borderRadius: 999,
                              }}
                            >
                              NEXT UP
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>{v.hospitalNumber}</td>
                      <td style={{ padding: '12px 10px' }}>
                        {v.triageUrgency ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 999,
                                background:
                                  v.triageUrgency === 'critical' ? '#FEF2F2' : v.triageUrgency === 'urgent' ? '#FFFBEB' : '#ECFDF5',
                                color:
                                  v.triageUrgency === 'critical' ? '#DC2626' : v.triageUrgency === 'urgent' ? '#D97706' : '#16A34A',
                                border:
                                  v.triageUrgency === 'critical' ? '1px solid #FECACA' : v.triageUrgency === 'urgent' ? '1px solid #FDE68A' : '1px solid #BBF7D0',
                                textTransform: 'uppercase',
                              }}
                            >
                              {v.triageUrgency}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                              {v.vitalsSummary || 'Logged'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                            Awaiting triage
                          </span>
                        )}
                      </td>
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
                          {v.status === 'waiting' && (
                            <button
                              type="button"
                              className={`mc-btn-live${busyId === v.id ? ' is-busy' : ''}`}
                              onClick={() => callPatient(v)}
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
                              Call
                            </button>
                          )}
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
