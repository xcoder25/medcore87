'use client';

/**
 * MedCore Administrator Workspace — live data from adminRealtimeStore + WS events.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Users, UserPlus, ArrowRightLeft, CalendarDays, AlertTriangle, Shield,
  FileCheck, ChevronRight, Activity, Clock, CheckCircle2,
  UserCheck, BedDouble,
} from 'lucide-react';
import {
  buildAdminSnapshot,
  subscribeAdminSync,
  pushActivity,
  type AdminSnapshot,
} from '../../lib/adminRealtimeStore';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const toneBg: Record<string, string> = {
  blue: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
  sky: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
  amber: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
  teal: 'linear-gradient(135deg, #F0FDFA, #CCFBF1)',
  violet: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
  rose: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
};
const toneFg: Record<string, string> = {
  blue: '#2563EB', sky: '#0284C7', amber: '#D97706', teal: '#0D9488', violet: '#7C3AED', rose: '#E11D48',
};

export const AdminWorkspace: React.FC<Props> = ({ session, onNavigate }) => {
  const [snap, setSnap] = useState<AdminSnapshot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const facility = session.facility || 'Immanuel General Hospital, Eket';
  const firstName = (session.name || 'Administrator').split(' ')[0];

  const refresh = useCallback(() => {
    setSnap(buildAdminSnapshot());
  }, []);

  const { connected } = useRealtimeEvents({
    app: 'MEDCORE_OS_ADMIN',
    facilityId: session.hospitalId || facility,
    onEvent: (evt) => {
      pushActivity(`Live: ${evt.topic.replace(/_/g, ' ').toLowerCase()}`);
      refresh();
    },
  });

  useEffect(() => {
    refresh();
    const unsub = subscribeAdminSync(refresh);
    const iv = setInterval(() => {
      setTick((t) => t + 1);
      refresh();
    }, 8000);
    return () => {
      unsub();
      clearInterval(iv);
    };
  }, [refresh]);

  const notify = (msg: string, nav?: string) => {
    setToast(msg);
    pushActivity(msg);
    setTimeout(() => setToast(null), 2800);
    if (nav) setTimeout(() => onNavigate(nav), 400);
  };

  if (!snap) {
    return (
      <div className="admin-workspace">
        <div className="admin-card" style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
          Loading administrator workspace…
        </div>
      </div>
    );
  }

  const kpis = [
    { key: 'staff', label: 'Active Staff', value: String(snap.activeStaff), trend: 'Live roster', tone: 'blue', icon: Users, nav: 'staffing' },
    { key: 'open', label: 'Open Positions', value: String(snap.openPositions), trend: 'Recruitment', tone: 'sky', icon: UserPlus, nav: 'enrolment' },
    { key: 'transfer', label: 'Pending Transfer', value: String(snap.pendingTransfers), trend: snap.pendingTransfers ? 'Needs review' : 'Clear', tone: 'amber', icon: ArrowRightLeft, nav: 'transfer' },
    { key: 'logged', label: 'Staff Logged In', value: String(snap.staffLoggedIn), trend: connected ? 'Live' : 'Local sync', tone: 'teal', icon: UserCheck, nav: 'staffing' },
    { key: 'leave', label: 'On Leave', value: String(snap.onLeave), trend: 'Roster', tone: 'violet', icon: CalendarDays, nav: 'staffing' },
    { key: 'access', label: 'Access Issues', value: String(snap.accessIssues), trend: snap.accessIssues ? 'Needs review' : 'Clear', tone: 'rose', icon: Shield, nav: 'rbac' },
  ];

  const sevStyle = {
    High: { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA' },
    Medium: { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A' },
    Low: { bg: '#EFF6FF', fg: '#2563EB', border: '#BFDBFE' },
  };

  const ageSec = Math.max(0, Math.floor((Date.now() - new Date(snap.updatedAt).getTime()) / 1000));

  return (
    <div className="admin-workspace">
      {toast && (
        <div className="admin-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}

      <section className="admin-hero">
        <div className="admin-hero-copy">
          <h1>
            {greeting()}, {session.roleKey === 'hospital_admin' ? 'Administrator' : firstName}{' '}
            <span aria-hidden>👋</span>
          </h1>
          <p>
            Here&apos;s what&apos;s happening at <strong>{facility}</strong> today.
          </p>
        </div>
        <div className="admin-hero-status">
          <span className="admin-status-dot" />
          <div>
            <div className="admin-status-title">{connected ? 'Live connection' : 'Local realtime'}</div>
            <div className="admin-status-sub">
              {connected ? 'Event bus online' : 'Synced in this browser · updates every few seconds'}
            </div>
          </div>
        </div>
      </section>

      <section className="admin-kpi-row" aria-label="Key metrics">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              type="button"
              className="admin-kpi"
              style={{ background: toneBg[k.tone] }}
              onClick={() => onNavigate(k.nav)}
            >
              <div className="admin-kpi-top">
                <span className="admin-kpi-icon" style={{ color: toneFg[k.tone], background: '#fff' }}>
                  <Icon size={16} />
                </span>
                <span className="admin-kpi-label">{k.label}</span>
              </div>
              <div className="admin-kpi-value" style={{ color: toneFg[k.tone] }}>
                {k.value}
              </div>
              <div className="admin-kpi-trend">{k.trend}</div>
            </button>
          );
        })}
      </section>

      <section className="admin-quick">
        <div className="admin-quick-title">Quick Actions</div>
        <div className="admin-quick-row">
          <button type="button" className="admin-qa primary" onClick={() => onNavigate('transfer')}>
            <ArrowRightLeft size={14} /> New Staff Transfer
          </button>
          <button type="button" className="admin-qa" onClick={() => onNavigate('enrolment')}>
            <UserPlus size={14} /> Add Staff
          </button>
          <button type="button" className="admin-qa" onClick={() => notify('Open staffing to edit rosters', 'staffing')}>
            <CalendarDays size={14} /> Create Roster
          </button>
          <button
            type="button"
            className="admin-qa"
            onClick={() => {
              pushActivity('Incident reported from admin dashboard');
              notify('Incident noted — open Compliance to follow up', 'compliance');
            }}
          >
            <AlertTriangle size={14} /> Report Incident
          </button>
          <button type="button" className="admin-qa" onClick={() => onNavigate('beds')}>
            <BedDouble size={14} /> Assign Bed
          </button>
        </div>
      </section>

      <section className="admin-grid-3">
        <div className="admin-card admin-card-attention">
          <div className="admin-card-head">
            <div className="admin-card-title danger">
              <AlertTriangle size={15} /> Needs Your Attention
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('transfer')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <ul className="admin-attention-list">
            {snap.attention.map((a) => (
              <li key={a.id}>
                <div>
                  <span
                    className="admin-sev"
                    style={{
                      background: sevStyle[a.severity].bg,
                      color: sevStyle[a.severity].fg,
                      borderColor: sevStyle[a.severity].border,
                    }}
                  >
                    {a.severity}
                  </span>
                  <div className="admin-att-title">{a.title}</div>
                  <div className="admin-att-when">{a.when}</div>
                </div>
                <button type="button" className="admin-link" onClick={() => onNavigate(a.nav)}>
                  {a.action} <ChevronRight size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Users size={15} /> Staff Overview
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('staffing')}>
              View staff <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-staff-total">
            <span className="big">{snap.activeStaff}</span>
            <span className="muted">Active staff</span>
          </div>
          <ul className="admin-dept-list">
            {snap.depts.map((d) => (
              <li key={d.name}>
                <div className="admin-dept-row">
                  <span className="admin-dept-name">{d.name}</span>
                  <span className="admin-dept-count">{d.count}</span>
                </div>
                <div className="admin-bar-track">
                  <div className="admin-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <div className="admin-dept-pct">{d.pct}% coverage</div>
              </li>
            ))}
          </ul>
          <button type="button" className="admin-ghost-full" onClick={() => onNavigate('staffing')}>
            Open full roster
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Shield size={15} /> Access &amp; Security
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('rbac')}>
              Manage access <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-access-stats">
            <div className="admin-access-row ok">
              <span className="dot" /> {snap.accessActive} Active accounts
            </div>
            <div className="admin-access-row warn">
              <span className="dot" /> {snap.accessPending} Pending requests
            </div>
            <div className="admin-access-row bad">
              <span className="dot" /> {snap.accessSuspended} Suspended accounts
            </div>
            <div className="admin-access-row info">
              <span className="dot" /> Live permission changes recorded
            </div>
          </div>
          <button type="button" className="admin-cta" onClick={() => onNavigate('rbac')}>
            Review access requests
          </button>
        </div>
      </section>

      <section className="admin-grid-3">
        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Users size={15} /> Staff by Department
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('staffing')}>
              View details <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-bar-chart" role="img" aria-label="Staff counts by department">
            {[
              { name: 'Nursing', n: 34, color: '#3B82F6' },
              { name: 'Internal Med.', n: 14, color: '#14B8A6' },
              { name: 'Radiology', n: 11, color: '#6366F1' },
              { name: 'Surgery', n: 9, color: '#8B5CF6' },
              { name: 'Pharmacy', n: 6, color: '#22C55E' },
              { name: 'Others', n: 13, color: '#38BDF8' },
            ].map((d) => (
              <div key={d.name} className="admin-bar-col">
                <div className="admin-bar-val">{d.n}</div>
                <div className="admin-bar-stem" style={{ height: `${Math.max(12, d.n * 2.2)}px`, background: d.color }} />
                <div className="admin-bar-label">{d.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <FileCheck size={15} /> Compliance Health
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('compliance')}>
              View compliance <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-compliance">
            <div className="admin-ring" aria-label={`${snap.compliancePct} percent compliance`}>
              <span>{snap.compliancePct}%</span>
            </div>
            <ul>
              <li>
                <span className="dot amber" /> Documents expiring <strong>{snap.complianceExpiring}</strong>
              </li>
              <li>
                <span className="dot rose" /> Overdue reviews <strong>{snap.complianceOverdue}</strong>
              </li>
              <li>
                <span className="dot blue" /> Pending audits <strong>{snap.compliancePending}</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Activity size={15} /> Recent Admin Activity
            </div>
            <button type="button" className="admin-link" onClick={refresh}>
              Refresh <ChevronRight size={14} />
            </button>
          </div>
          <ul className="admin-activity">
            {snap.activity.slice(0, 6).map((a) => (
              <li key={a.id}>
                <span className="time">{a.time}</span>
                <span className="text">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <ArrowRightLeft size={15} /> Recent Transfers
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('transfer')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>From → To</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(snap.transfers.length
                  ? snap.transfers
                  : [
                      { staffName: 'Dr. Fatima Al-Hassan', fromHospitalName: 'LUTH', toHospitalName: 'UCH', effectiveDate: '2026-10-01', status: 'pending' },
                      { staffName: 'Dr. Amara Okafor', fromHospitalName: 'AKTH', toHospitalName: 'LIGH', effectiveDate: '2026-09-01', status: 'completed' },
                    ]
                ).map((r: any, i: number) => (
                  <tr key={r.id || i}>
                    <td>{r.staffName || r.staff}</td>
                    <td className="muted">
                      {(r.fromHospitalName || r.from || '—')} → {(r.toHospitalName || r.to || '—')}
                    </td>
                    <td className="muted">{r.effectiveDate || r.date || '—'}</td>
                    <td>
                      <span className={`admin-badge ${String(r.status).toLowerCase() === 'pending' ? 'pending' : 'done'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Shield size={15} /> Access &amp; Permissions
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('rbac')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {snap.perms.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="muted">{r.role}</td>
                    <td>
                      <span className={`admin-badge ${r.status === 'active' ? 'done' : 'pending'}`}>
                        ● {r.status}
                      </span>
                    </td>
                    <td className="muted">{r.lastLogin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="admin-footnote">
        <Clock size={12} /> Updated {ageSec < 5 ? 'just now' : `${ageSec}s ago`}
        {' · '}
        {connected ? 'Event bus connected' : 'Browser realtime active'}
        {' · '}
        {facility}
      </p>
    </div>
  );
};

export default AdminWorkspace;
