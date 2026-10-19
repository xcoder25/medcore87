'use client';

/**
 * Front Desk Operations home — matches MedCore reception design system mockup.
 */
import { InBasketPanel } from '../clinical-core/InBasketPanel';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listActiveStaff,
  subscribeStaffPresence,
  startFacilityPresenceListener,
  STAFF_PRESENCE_EVENT,
} from '../../lib/staffPresenceStore';
import { listStaffCards, isReceptionRole } from '../../lib/staffCardStore';
import type { FacilityPatient } from '../../lib/patientRegistryStore';
import type { ReceptionVisit, ReceptionAppointment, ReceptionDayStats } from '../../lib/receptionOpsStore';
import {
  listAccountsRequests,
  markAccountsRequestPaid,
  subscribeAccountsRequests,
  type FrontDeskAccountsRequest,
} from '../../lib/frontDeskAccountsBridge';


import {
  Search, UserPlus, CreditCard, Calendar, QrCode, Users, Clock,
  Activity, CheckCircle2, RefreshCw, ChevronRight,
  TrendingUp, TrendingDown, Heart, Ticket,
} from 'lucide-react';
import { useOpdSync, broadcastOpdStage } from '../../hooks/useOpdSync';

export type DeskNav =
  | 'home'
  | 'queue'
  | 'register'
  | 'appointments'
  | 'payment'
  | 'cashier'
  | 'search'
  | 'scan'
  | 'walkin'
  | 'triage';

interface Props {
  session: UserSession;
  patients: FacilityPatient[];
  visits: ReceptionVisit[];
  appts: ReceptionAppointment[];
  stats: ReceptionDayStats;
  onGo: (v: DeskNav) => void;
  onCheckIn: (p: FacilityPatient) => void;
  onUpdateVisit: (id: string, status: ReceptionVisit['status']) => void;
  onSelectPatient: (p: FacilityPatient) => void;
  onRefresh: () => void;
}

const C = {
  navy: '#0B1220',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E8EEF5',
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  teal: '#0D9488',
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
  purple: '#7C3AED',
};

function waitMins(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function statusStyle(s: string): React.CSSProperties {
  if (s === 'waiting') return { background: '#EFF6FF', color: '#1D4ED8' };
  if (s === 'called') return { background: '#ECFDF5', color: '#047857' };
  if (s === 'with_provider') return { background: '#F5F3FF', color: '#6D28D9' };
  if (s === 'completed') return { background: '#F0FDF4', color: '#15803D' };
  return { background: '#F1F5F9', color: '#475569' };
}

function statusLabel(s: string) {
  if (s === 'with_provider') return 'With Provider';
  return s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');
}

export const ReceptionDeskHome: React.FC<Props> = ({
  session,
  patients,
  visits,
  appts,
  stats,
  onGo,
  onCheckIn,
  onUpdateVisit,
  onSelectPatient,
  onRefresh,
}) => {
  const facilityId = session.hospitalId || 'IGH-EKT';

  const [deptFilter, setDeptFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeFrontDesk, setActiveFrontDesk] = useState(0);
  const [queueTab, setQueueTab] = useState<'all' | 'accounts' | 'triage' | 'doctor' | 'completed'>('all');
  const [accountsRequests, setAccountsRequests] = useState<FrontDeskAccountsRequest[]>([]);

  const reloadAccounts = useCallback(() => {
    setAccountsRequests(listAccountsRequests(facilityId, { status: 'awaiting_payment' }));
  }, [facilityId]);

  useEffect(() => {
    reloadAccounts();
    return subscribeAccountsRequests(reloadAccounts);
  }, [reloadAccounts]);

  const handleMarkAccountsPaid = (req: FrontDeskAccountsRequest) => {
    markAccountsRequestPaid(req.id, {
      reference: `RCPT-${Date.now().toString(36).toUpperCase()}`,
      via: 'cashier',
      paidBy: session.name || 'Reception',
    });
    reloadAccounts();
    onRefresh();
  };

  const recountFrontDeskStaff = useCallback(() => {
    try {
      const fid = String(facilityId || '').toUpperCase();
      const selfBadge = String(session.badgeId || '')
        .toUpperCase()
        .replace(/\s+/g, '');
      const selfRoleKey = String(session.roleKey || '').toLowerCase();

      // Facility roster only — enrolled cards + registry (ignore deleted / other hospitals)
      const rosterIds = new Set<string>();
      try {
        for (const c of listStaffCards()) {
          if (String(c.facilityId || '').toUpperCase() !== fid) continue;
          const st = String(c.status || 'ACTIVE').toUpperCase();
          if (st === 'REVOKED' || st === 'SUSPENDED' || st === 'EXPIRED') continue;
          const id = String(c.badgeId || '')
            .toUpperCase()
            .replace(/\s+/g, '');
          if (id) rosterIds.add(id);
        }
      } catch {
        /* ignore */
      }
      try {
        const raw = localStorage.getItem('medcore_os_staff_registry');
        const reg = raw ? JSON.parse(raw) : [];
        if (Array.isArray(reg)) {
          for (const r of reg) {
            const hid = String(r.hospitalId || r.facilityId || '').toUpperCase();
            if (hid && hid !== fid) continue;
            const st = String(r.status || 'active').toLowerCase();
            if (st === 'suspended' || st === 'revoked' || st === 'deleted') continue;
            const id = String(r.badgeId || r.id || '')
              .toUpperCase()
              .replace(/\s+/g, '');
            if (id) rosterIds.add(id);
          }
        }
      } catch {
        /* ignore */
      }
      // Self is always on roster while signed in
      if (selfBadge) rosterIds.add(selfBadge);

      const sameRole = (roleKey?: string, role?: string) => {
        const rk = String(roleKey || '').toLowerCase();
        // Front-desk family: reception, records, and exact match to this session's role
        if (selfRoleKey && rk === selfRoleKey) return true;
        if (isReceptionRole(roleKey, role)) return true;
        if (rk === 'reception' || rk === 'records') return true;
        const r = String(role || '').toLowerCase();
        if (r.includes('reception') || r.includes('front desk') || r.includes('records')) return true;
        return false;
      };

      const live = listActiveStaff(facilityId).filter((p) => {
        const id = String(p.badgeId || '')
          .toUpperCase()
          .replace(/\s+/g, '');
        if (!id || !rosterIds.has(id)) return false; // not in facility auth/DB
        return sameRole(p.roleKey, p.role);
      });

      let n = live.length;
      // Count self if reception-family and not yet in presence map
      if (
        selfBadge &&
        sameRole(session.roleKey, session.role) &&
        !live.some((p) => String(p.badgeId).toUpperCase().replace(/\s+/g, '') === selfBadge)
      ) {
        n += 1;
      }
      setActiveFrontDesk(n);
    } catch {
      setActiveFrontDesk(
        isReceptionRole(session.roleKey, session.role, session.title, session.badgeId) ? 1 : 0
      );
    }
  }, [facilityId, session.badgeId, session.roleKey, session.role, session.title]);

  useEffect(() => {
    recountFrontDeskStaff();
    const unsub = subscribeStaffPresence(() => recountFrontDeskStaff());
    const stopCloud = startFacilityPresenceListener(facilityId);
    const bump = () => recountFrontDeskStaff();
    window.addEventListener(STAFF_PRESENCE_EVENT, bump);
    window.addEventListener('medcore-admin-sync', bump);
    window.addEventListener('storage', bump);
    window.addEventListener('medcore-facility-cloud', bump);
    window.addEventListener('medcore-staff-cards-updated', bump);
    window.addEventListener('medcore-staff-registry-updated', bump);
    const tick = window.setInterval(bump, 4000);
    return () => {
      unsub();
      stopCloud();
      window.removeEventListener(STAFF_PRESENCE_EVENT, bump);
      window.removeEventListener('medcore-admin-sync', bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('medcore-facility-cloud', bump);
      window.removeEventListener('medcore-staff-cards-updated', bump);
      window.removeEventListener('medcore-staff-registry-updated', bump);
      window.clearInterval(tick);
    };
  }, [facilityId, recountFrontDeskStaff]);

  const liveUpdate = async (id: string, status: ReceptionVisit['status']) => {
    setBusyId(id);
    onUpdateVisit(id, status);
    try {
      const { emitLiveAction } = await import('../../lib/liveActions');
      emitLiveAction(`Queue ${status} · ${id}`, { module: 'queue' });
    } catch { /* ignore */ }
    window.setTimeout(() => setBusyId(null), 450);
  };

  const waiting = visits.filter((v) => v.status === 'waiting');
  const called = visits.filter((v) => v.status === 'called');
  const withProv = visits.filter((v) => v.status === 'with_provider');
  const completed = visits.filter((v) => v.status === 'completed');
  const unpaid = visits.filter(
    (v) =>
      (v.status === 'waiting' || v.status === 'called') &&
      v.paymentStatus !== 'paid' &&
      v.paymentStatus !== 'hmo' &&
      v.paymentStatus !== 'waived'
  );

  const missedAppts = appts.filter((a) => a.status === 'no_show' || a.status === 'cancelled').length;
  const avgWait =
    waiting.length === 0
      ? 0
      : Math.round(waiting.reduce((s, v) => s + waitMins(v.checkedInAt), 0) / waiting.length);

  const triageVisits = useMemo(
    () => visits.filter((v) => (v.status === 'waiting' || v.status === 'called') && (v.department === 'Triage' || !v.triagedAt)),
    [visits]
  );
  const doctorVisits = useMemo(
    () => visits.filter((v) => (v.status === 'waiting' || v.status === 'called' || v.status === 'with_provider') && v.department !== 'Triage' && v.triagedAt),
    [visits]
  );

  const filtered = useMemo(() => {
    let list = [...visits].filter((v) => v.status !== 'cancelled');
    if (deptFilter !== 'all') list = list.filter((v) => v.department === deptFilter);
    if (queueTab === 'triage') {
      list = list.filter((v) => (v.status === 'waiting' || v.status === 'called') && (v.department === 'Triage' || !v.triagedAt));
    } else if (queueTab === 'doctor') {
      list = list.filter((v) => (v.status === 'waiting' || v.status === 'called' || v.status === 'with_provider') && v.department !== 'Triage' && v.triagedAt);
    } else if (queueTab === 'completed') {
      list = list.filter((v) => v.status === 'completed');
    }
    return list.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  }, [visits, deptFilter, queueTab]);

  const depts = useMemo(() => {
    const s = new Set(visits.map((v) => v.department));
    return Array.from(s).sort();
  }, [visits]);

  const recent = useMemo(() => {
    const items: { t: string; title: string; sub: string; color: string }[] = [];
    for (const v of [...visits].slice(0, 8)) {
      items.push({
        t: v.checkedInAt.slice(11, 16),
        title: v.status === 'completed' ? 'Visit completed' : 'Patient checked-in',
        sub: `${v.patientName} (${v.hospitalNumber})`,
        color: '#2563EB',
      });
    }
    for (const a of appts.slice(0, 3)) {
      items.push({
        t: a.scheduledAt.slice(11, 16),
        title: a.status === 'booked' ? 'Appointment confirmed' : `Appointment ${a.status}`,
        sub: `${a.patientName}`,
        color: '#0D9488',
      });
    }
    return items.slice(0, 6);
  }, [visits, appts]);

  const kpi = [
    {
      label: "Today's Check-ins",
      value: stats.checkIns,
      sub: `${stats.appointments} appt · ${Math.max(0, stats.checkIns - stats.appointments)} walk-in`,
      trend: 'Live',
      up: true,
      icon: RefreshCw,
      tint: '#EFF6FF',
      iconColor: '#2563EB',
    },
    {
      label: 'Waiting in Queue',
      value: stats.waiting,
      sub: avgWait > 0 ? `Avg. wait ${avgWait} min` : 'No one waiting',
      trend: 'Live',
      up: true,
      icon: Users,
      tint: '#ECFDF5',
      iconColor: '#0D9488',
    },
    {
      label: 'Completed Today',
      value: stats.completed || completed.length,
      sub: `${withProv.length} with provider`,
      trend: 'Live',
      up: true,
      icon: CheckCircle2,
      tint: '#F5F3FF',
      iconColor: '#7C3AED',
    },
    {
      label: 'Appointments',
      value: stats.bookedToday || appts.filter((a) => a.status === 'booked' || a.status === 'arrived').length,
      sub: missedAppts ? `${missedAppts} missed/cancelled` : 'Booked today',
      trend: 'Live',
      up: missedAppts === 0,
      icon: Calendar,
      tint: '#FEF2F2',
      iconColor: '#DC2626',
    },
    {
      label: 'Active Staff',
      value: activeFrontDesk,
      sub: 'Same role · live · facility only',
      trend: 'Live',
      up: true,
      icon: Users,
      tint: '#F0F9FF',
      iconColor: '#0284C7',
    },
  ];

  const quick = [
    { label: 'Find Patient', desc: 'Search by name/ID', icon: Search, go: 'search' as DeskNav },
    { label: 'Scan ID / QR', desc: 'Card scan · badge lookup', icon: QrCode, go: 'scan' as DeskNav },
    { label: 'Register', desc: 'New patient registration', icon: UserPlus, go: 'register' as DeskNav },
    { label: 'Walk-in', desc: 'No appointment', icon: Users, go: 'walkin' as DeskNav },
    { label: 'Appointments', desc: 'Book · Confirm · Arrive', icon: Calendar, go: 'appointments' as DeskNav },
    { label: 'Live Queue', desc: 'Call · Skip · Manage OPD', icon: Ticket, go: 'queue' as DeskNav },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InBasketPanel
        facilityId={facilityId}
        roleKey="reception"
        staffName={session.name}
        onNavigate={(k) => {
          if (k === 'patient-flow' || k === 'dashboard') onGo('queue');
          else if (k === 'patient-360') onGo('search');
          else onGo('home');
        }}
      />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {/* Quick Actions — first thing the desk officer sees */}
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
          Speed up your workflow with essential actions
        </div>
        <div className="mc-stagger-desk" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => onGo(q.go)}
                className="mc-btn-live"
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  background: '#F8FAFC',
                  padding: '14px 10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#BFDBFE';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.boxShadow = 'none';
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
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>{q.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
      {/* KPI row — live stats */}
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
                      color: k.up ? C.green : C.red,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    {k.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {k.trend}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Live Queue Board */}
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
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Live Queue Board</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Call · Skip · Complete · Overtime alerts · by department
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#fff',
                  }}
                >
                  <option value="all">All Departments</option>
                  {depts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onGo('walkin')}
                  className="mc-btn-live"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: C.blue,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  + Walk-in Check-in
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: '#fff',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    color: C.muted,
                  }}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </div>

            {/* Stage tabs: Accounts Queue vs Triage Queue vs Doctor Queue vs Completed */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'all' as const, l: 'All Active OPD', v: waiting.length + called.length + withProv.length, c: '#2563EB', bg: '#EFF6FF' },
                { id: 'accounts' as const, l: '💳 Accounts Queue (Awaiting Pay)', v: accountsRequests.length, c: '#D97706', bg: '#FFFBEB' },
                { id: 'triage' as const, l: '🩺 Triage Queue (Paid · Vitals)', v: triageVisits.length, c: '#0D9488', bg: '#F0FDFA' },
                { id: 'doctor' as const, l: '👨‍⚕️ Doctor Consult Queue', v: doctorVisits.length, c: '#7C3AED', bg: '#F5F3FF' },
                { id: 'completed' as const, l: '🏁 Completed Today', v: completed.length, c: '#16A34A', bg: '#F0FDF4' },
              ].map((tab) => {
                const active = queueTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setQueueTab(tab.id)}
                    style={{
                      flex: '1 1 140px',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: active ? `2px solid ${tab.c}` : `1px solid ${C.border}`,
                      background: active ? tab.bg : '#FFFFFF',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? tab.c : C.muted }}>
                      {tab.l}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tab.c, marginTop: 2 }}>
                      {tab.v}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* If Accounts Queue tab is active, render dedicated Accounts Queue */}
            {queueTab === 'accounts' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 700 }}>
                      {['#', 'Patient Name', 'Hospital No', 'Invoice / Order', 'Purpose', 'Amount', 'Wait at Accounts', 'Status', 'Action'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accountsRequests.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                          No patients currently waiting at Accounts. New registrations are automatically queued here.
                        </td>
                      </tr>
                    ) : (
                      accountsRequests.map((req, idx) => (
                        <tr key={req.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '12px 10px', color: C.muted }}>{idx + 1}</td>
                          <td style={{ padding: '12px 10px', fontWeight: 800, color: C.text }}>{req.patientName}</td>
                          <td style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>{req.hospitalNumber}</td>
                          <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: 12 }}>
                            {req.invoiceNumber || req.id}
                          </td>
                          <td style={{ padding: '12px 10px', color: C.muted }}>{req.purpose}</td>
                          <td style={{ padding: '12px 10px', fontWeight: 800, color: '#B45309' }}>
                            ₦{req.amountNgn.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px' }}>{waitMins(req.sentAt)} min</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: 999,
                                background: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                              }}
                            >
                              ⏳ Awaiting Payment
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <button
                              type="button"
                              onClick={() => handleMarkAccountsPaid(req)}
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: 'linear-gradient(135deg, #059669, #0D9488)',
                                color: '#fff',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(5,150,105,0.2)',
                              }}
                              title="Confirm cashier payment — moves patient to Triage Queue"
                            >
                              Confirm Paid → To Triage
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Table */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.muted, fontSize: 11, fontWeight: 700 }}>
                      {['#', 'Patient Name', 'ID', 'Department', 'Type', 'Wait Time', 'Status', 'Actions'].map(
                        (h) => (
                          <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: C.muted }}>
                        No patients in queue — use Walk-in Check-in or Register
                      </td>
                    </tr>
                  )}
                  {filtered.slice(0, 10).map((v, i) => (
                    <tr key={v.id} className={`mc-queue-row${busyId === v.id ? ' is-updating' : ''}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '12px 10px', color: C.muted }}>{i + 1}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 700, color: C.text }}>{v.patientName}</td>
                      <td style={{ padding: '12px 10px', color: C.muted, fontSize: 12 }}>{v.hospitalNumber}</td>
                      <td style={{ padding: '12px 10px' }}>{v.department}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: v.visitType === 'appointment' ? '#F5F3FF' : '#EFF6FF',
                            color: v.visitType === 'appointment' ? '#6D28D9' : '#1D4ED8',
                          }}
                        >
                          {v.visitType === 'appointment' ? 'Appointment' : 'Walk-in'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>{waitMins(v.checkedInAt)} min</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            ...statusStyle(v.status),
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'currentColor',
                            }}
                          />
                          {statusLabel(v.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {(v.status === 'waiting' || v.status === 'called') && (
                            <button
                              type="button"
                              onClick={() => onGo('triage')}
                              title="Take vitals / triage"
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid #BBF7D0',
                                background: '#ECFDF5',
                                color: '#16A34A',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <Heart size={10} /> Triage
                            </button>
                          )}
                          {v.status === 'waiting' && (
                            <button
                              type="button"
                              onClick={() => void liveUpdate(v.id, 'called')}
                              className={`mc-btn-live${busyId === v.id ? ' is-busy' : ''}`}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                cursor: 'pointer',
                              }}
                            >
                              Call
                            </button>
                          )}
                          {(v.status === 'waiting' || v.status === 'called') && (
                            <button
                              type="button"
                              onClick={() => void liveUpdate(v.id, 'with_provider')}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#F5F3FF',
                                color: '#6D28D9',
                                cursor: 'pointer',
                              }}
                            >
                              Send
                            </button>
                          )}
                          {v.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => void liveUpdate(v.id, 'completed')}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#F1F5F9',
                                color: '#475569',
                                cursor: 'pointer',
                              }}
                            >
                              Done
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                fontSize: 12,
                color: C.muted,
              }}
            >
              <span>
                Showing {Math.min(filtered.length, 10)} of {filtered.length} patients
              </span>
              <button
                type="button"
                onClick={() => onGo('queue')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.blue,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                View full queue <ChevronRight size={14} />
              </button>
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
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={15} color={C.blue} /> Today&apos;s Queue
              </div>
              <button
                type="button"
                onClick={() => onGo('queue')}
                style={{ border: 'none', background: 'none', color: C.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                View all →
              </button>
            </div>
            {visits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled').length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Queue is empty</div>
            )}
            {visits
              .filter((v) => v.status !== 'completed' && v.status !== 'cancelled')
              .slice(0, 5)
              .map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: C.muted, width: 40 }}>{v.checkedInAt.slice(11, 16)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{v.patientName}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{v.department}</div>
                  </div>
                  <span
                    style={{
                      ...statusStyle(v.status),
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {statusLabel(v.status)}
                  </span>
                </div>
              ))}
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 16,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Patient Flow Insights</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { l: 'Avg. Wait Time', v: `${avgWait || 8} min`, s: '↓ 40%' },
                { l: 'No. of Check-ins', v: String(stats.checkIns), s: '↑ 12%' },
                { l: 'Peak Hour', v: '10:00 AM', s: `${stats.checkIns} check-ins` },
              ].map((x) => (
                <div key={x.l} style={{ background: '#F8FAFC', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{x.l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{x.v}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{x.s}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: 16,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Recent Activity</div>
            </div>
            {recent.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, padding: 8 }}>Activity will appear as you work</div>
            )}
            {recent.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${r.color}15`,
                    color: r.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Clock size={13} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{r.sub}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{r.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ReceptionDeskHome;
