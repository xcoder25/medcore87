'use client';

/**
 * MedCore Administrator Workspace
 * See → Understand → Act → Confirm
 * Admin-focused (staff, transfers, access, compliance) — not clinical monitoring.
 */
import React, { useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Users, UserPlus, ArrowRightLeft, CalendarDays, AlertTriangle, Shield,
  Building2, FileCheck, ChevronRight, Activity, Clock, CheckCircle2,
  UserCheck, BedDouble, MapPin, Plus, Search, Bell,
} from 'lucide-react';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

const KPI = [
  { key: 'staff', label: 'Active Staff', value: '87', trend: '+6% this month', tone: 'blue', icon: Users, nav: 'staffing' },
  { key: 'open', label: 'Open Positions', value: '12', trend: '+2% this month', tone: 'sky', icon: UserPlus, nav: 'enrolment' },
  { key: 'transfer', label: 'Pending Transfer', value: '1', trend: 'View details', tone: 'amber', icon: ArrowRightLeft, nav: 'transfer' },
  { key: 'logged', label: 'Staff Logged In', value: '64', trend: 'Live', tone: 'teal', icon: UserCheck, nav: 'staffing' },
  { key: 'leave', label: 'On Leave', value: '8', trend: '+1% this week', tone: 'violet', icon: CalendarDays, nav: 'staffing' },
  { key: 'access', label: 'Access Issues', value: '3', trend: 'Needs review', tone: 'rose', icon: Shield, nav: 'rbac' },
];

const ATTENTION = [
  { id: 1, title: '1 staff transfer awaiting approval', severity: 'High' as const, when: '8 min ago', action: 'Review', nav: 'transfer' },
  { id: 2, title: '3 access requests pending', severity: 'Medium' as const, when: '14 min ago', action: 'Review', nav: 'rbac' },
  { id: 3, title: '2 compliance documents expiring', severity: 'Medium' as const, when: '21 min ago', action: 'Review', nav: 'compliance' },
  { id: 4, title: '4 open positions need assignment', severity: 'Low' as const, when: 'Today', action: 'View', nav: 'enrolment' },
];

const DEPTS = [
  { name: 'Nursing', count: 34, pct: 92, color: '#6366F1' },
  { name: 'Internal Medicine', count: 14, pct: 78, color: '#0EA5E9' },
  { name: 'Radiology', count: 11, pct: 76, color: '#14B8A6' },
  { name: 'Surgery', count: 9, pct: 71, color: '#A855F7' },
  { name: 'Pharmacy', count: 6, pct: 68, color: '#22C55E' },
];

const ACTIVITY = [
  { t: '14:26', text: 'Sarah approved a staff transfer' },
  { t: '14:18', text: 'New account created for Pharmacy' },
  { t: '14:03', text: 'James updated Ward B roster' },
  { t: '13:52', text: 'Access permission changed' },
  { t: '13:41', text: 'Compliance document uploaded' },
];

const TRANSFERS = [
  { staff: 'Dr. Fatima Al-Hassan', route: 'LUTH → UCH', date: '2026-10-01', status: 'Pending' },
  { staff: 'Dr. Amara Okafor', route: 'AKTH → LIGH', date: '2026-09-01', status: 'Completed' },
  { staff: 'Dr. Ibrahim Musa', route: 'UCH → FCTH', date: '2026-08-15', status: 'Completed' },
];

const PERMS = [
  { user: 'Admin User', role: 'Administrator', status: 'Active', last: '2 mins ago' },
  { user: 'Sarah Johnson', role: 'HR Manager', status: 'Active', last: '12 mins ago' },
  { user: 'Michael Okafor', role: 'IT Support', status: 'Active', last: '1 hour ago' },
  { user: 'Amina Bello', role: 'Finance Officer', status: 'Active', last: '3 hours ago' },
];

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
  const [toast, setToast] = useState<string | null>(null);
  const facility = session.facility || 'Immanuel General Hospital, Eket';
  const firstName = (session.name || 'Administrator').split(' ')[0];

  const notify = (msg: string, nav?: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
    if (nav) setTimeout(() => onNavigate(nav), 450);
  };

  const sevStyle = useMemo(
    () => ({
      High: { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA' },
      Medium: { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A' },
      Low: { bg: '#EFF6FF', fg: '#2563EB', border: '#BFDBFE' },
    }),
    []
  );

  return (
    <div className="admin-workspace">
      {toast && (
        <div className="admin-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}

      {/* Hero */}
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
            <div className="admin-status-title">System Healthy</div>
            <div className="admin-status-sub">All systems operational</div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <section className="admin-kpi-row" aria-label="Key metrics">
        {KPI.map((k) => {
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

      {/* Quick actions */}
      <section className="admin-quick">
        <div className="admin-quick-title">Quick Actions</div>
        <div className="admin-quick-row">
          <button type="button" className="admin-qa primary" onClick={() => onNavigate('transfer')}>
            <ArrowRightLeft size={14} /> New Staff Transfer
          </button>
          <button type="button" className="admin-qa" onClick={() => onNavigate('enrolment')}>
            <UserPlus size={14} /> Add Staff
          </button>
          <button type="button" className="admin-qa" onClick={() => notify('Open staffing to create a roster', 'staffing')}>
            <CalendarDays size={14} /> Create Roster
          </button>
          <button type="button" className="admin-qa" onClick={() => notify('Incident logged for review', 'compliance')}>
            <AlertTriangle size={14} /> Report Incident
          </button>
          <button type="button" className="admin-qa" onClick={() => onNavigate('beds')}>
            <BedDouble size={14} /> Assign Bed
          </button>
        </div>
      </section>

      {/* Attention + Staff + Access */}
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
            {ATTENTION.map((a) => (
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
            <span className="big">87</span>
            <span className="muted">Total Staff</span>
          </div>
          <ul className="admin-dept-list">
            {DEPTS.map((d) => (
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
            + 13 other departments
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
              <span className="dot" /> 142 Active accounts
            </div>
            <div className="admin-access-row warn">
              <span className="dot" /> 3 Pending requests
            </div>
            <div className="admin-access-row bad">
              <span className="dot" /> 2 Suspended accounts
            </div>
            <div className="admin-access-row info">
              <span className="dot" /> 1 Permission change today
            </div>
          </div>
          <button
            type="button"
            className="admin-cta"
            onClick={() => onNavigate('rbac')}
          >
            Review access requests
          </button>
        </div>
      </section>

      {/* Staff by Department | Compliance | Activity */}
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
            <div className="admin-ring" aria-label="92 percent compliance">
              <span>92%</span>
            </div>
            <ul>
              <li>
                <span className="dot amber" /> Documents expiring <strong>4</strong>
              </li>
              <li>
                <span className="dot rose" /> Overdue reviews <strong>2</strong>
              </li>
              <li>
                <span className="dot blue" /> Pending audits <strong>1</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Activity size={15} /> Recent Admin Activity
            </div>
            <button type="button" className="admin-link" onClick={() => notify('Opening full activity log')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <ul className="admin-activity">
            {ACTIVITY.map((a, i) => (
              <li key={i}>
                <span className="time">{a.t}</span>
                <span className="text">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Tables */}
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
                {TRANSFERS.map((r) => (
                  <tr key={r.staff}>
                    <td>{r.staff}</td>
                    <td className="muted">{r.route}</td>
                    <td className="muted">{r.date}</td>
                    <td>
                      <span className={`admin-badge ${r.status === 'Pending' ? 'pending' : 'done'}`}>
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
                {PERMS.map((r) => (
                  <tr key={r.user}>
                    <td>{r.user}</td>
                    <td className="muted">{r.role}</td>
                    <td>
                      <span className="admin-badge done">● {r.status}</span>
                    </td>
                    <td className="muted">{r.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="admin-footnote">
        <Clock size={12} /> Updated just now · Administrator workspace · {facility}
      </p>
    </div>
  );
};

export default AdminWorkspace;
