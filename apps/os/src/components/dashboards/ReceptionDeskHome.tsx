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
import { listAccountsRequests } from '../../lib/frontDeskAccountsBridge';
import {
  Search, UserPlus, CreditCard, Calendar, QrCode, Users, Clock,
  Activity, CheckCircle2, AlertTriangle, RefreshCw, ChevronRight,
  MoreHorizontal, TrendingUp, TrendingDown, ScanLine,
} from 'lucide-react';

export type DeskNav =
  | 'home'
  | 'queue'
  | 'register'
  | 'appointments'
  | 'payment'
  | 'send-accounts'
  | 'cashier'
  | 'search'
  | 'scan'
  | 'walkin';

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
  const accountsPending = listAccountsRequests(facilityId, { status: 'awaiting_payment' });
  const [deptFilter, setDeptFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeFrontDesk, setActiveFrontDesk] = useState(0);

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
  const firstName = (session.name || 'Staff').split(' ')[0];

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

  const filtered = useMemo(() => {
    let list = [...visits].filter((v) => v.status !== 'cancelled');
    if (deptFilter !== 'all') list = list.filter((v) => v.department === deptFilter);
    return list.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  }, [visits, deptFilter]);

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
    { label: 'Send to Accounts', desc: 'Queue / flow → Accounting desk', icon: CreditCard, go: 'send-accounts' as DeskNav },
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
        <div style={{ padding: '22px 28px', flex: 1, zIndex: 1, maxWidth: '62%' }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>
            Welcome back, {firstName} 👋
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>
            Front Desk Operations
          </div>
          <div style={{ fontSize: 13, opacity: 0.88, maxWidth: 420, lineHeight: 1.45 }}>
            Manage check-ins, queue, appointments and patient flow efficiently.
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
              All systems operational
            </span>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '48%',
            backgroundImage: 'url(/hosos-clean.png), url(/auth-hero.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.35,
            maskImage: 'linear-gradient(90deg, transparent, black 30%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 30%)',
          }}
        />
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

      
      {/* Accounts PENDING — live from Accounting desk */}
      {accountsPending.length > 0 && (
        <div
          style={{
            borderRadius: 16,
            border: '1px solid #FDE68A',
            background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 800, color: '#92400E', fontSize: 14 }}>
              PENDING at Accounts · {accountsPending.length}
            </div>
            <div style={{ fontSize: 12, color: '#B45309', fontWeight: 600 }}>
              Live · clears to PAID when Accounting collects
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
            {accountsPending.slice(0, 6).map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontSize: 13,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.7)',
                }}
              >
                <span style={{ fontWeight: 700, color: '#0F172A' }}>
                  {r.patientName}{' '}
                  <span style={{ fontWeight: 600, color: '#64748B' }}>· {r.hospitalNumber}</span>
                </span>
                <span style={{ fontWeight: 800, color: '#B45309' }}>₦{r.amountNgn.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI row — single horizontal line */}
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
          {/* Quick Actions */}
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
            <div className="mc-stagger-desk" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
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

            {/* Status chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {[
                { l: 'Waiting', v: waiting.length, bg: '#EFF6FF', c: '#1D4ED8' },
                { l: 'Called', v: called.length, bg: '#ECFDF5', c: '#047857' },
                { l: 'With Provider', v: withProv.length, bg: '#F5F3FF', c: '#6D28D9' },
                { l: 'Completed Today', v: completed.length, bg: '#F0FDF4', c: '#15803D' },
                { l: 'Unpaid in Queue', v: unpaid.length, bg: '#FEF2F2', c: '#B91C1C' },
              ].map((x) => (
                <div
                  key={x.l}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    background: x.bg,
                    borderRadius: 12,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: x.c }}>{x.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: x.c }}>{x.v}</div>
                </div>
              ))}
            </div>

            {/* Table */}
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
                        <div style={{ display: 'flex', gap: 4 }}>
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
