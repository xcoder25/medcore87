'use client';

/**
 * Full Administrator shell — matches MedCore admin mockup (dark sidebar + premium home).
 */
import React, { useMemo, useState, useEffect } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import { AdminWorkspace } from './AdminWorkspace';
import {
  LayoutDashboard, Users, Building2, Activity, BedDouble, RefreshCw, PhoneCall,
  Lock, FileText, BarChart3, Search, Bell, ChevronLeft, LogOut, UserPlus,
} from 'lucide-react';

// Lazy module map — same keys as page.tsx
import { HospitalStaffTransfer } from '../staffing/HospitalStaffTransfer';
import { StaffingOverview } from '../staffing/StaffingOverview';
import { FacilityOnboarding } from '../facility/FacilityOnboarding';
import { CommandCentreDashboard } from '../command-centre/CommandCentreDashboard';
import { BedManagement } from '../beds/BedManagement';
import { PatientFlowVisibility } from '../patient-flow/PatientFlowVisibility';
import { AccessControl } from '../rbac/AccessControl';
import { ComplianceAuditLogs } from '../compliance/ComplianceAuditLogs';
import { CashierRevenue } from '../cashier/CashierRevenue';
import { StaffEnrolment } from '../staffing/StaffEnrolment';

type AdminModule =
  | 'dashboard'
  | 'transfer'
  | 'staffing'
  | 'facility'
  | 'command'
  | 'beds'
  | 'patient-flow'
  | 'ambulance'
  | 'rbac'
  | 'enrolment'
  | 'compliance'
  | 'cashier';

interface NavItem {
  key: AdminModule;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'transfer', label: 'Hospital Staff Transfer', icon: Users },
      { key: 'staffing', label: 'Staffing & Rosters', icon: Users },
      { key: 'facility', label: 'Hospital Management', icon: Building2 },
    ],
  },
  {
    label: 'Operations & Bed Management',
    items: [
      { key: 'command', label: 'Hospital Command Centre', icon: Activity },
      { key: 'beds', label: 'Bed & Ward Occupancy', icon: BedDouble },
      { key: 'patient-flow', label: 'Patient Flow Visibility', icon: RefreshCw },
      { key: 'ambulance', label: 'Ambulance & Dispatch', icon: PhoneCall },
    ],
  },
  {
    label: 'Identity, Security & Finance',
    items: [
      { key: 'rbac', label: 'Staff Access Control', icon: Lock },
      { key: 'enrolment', label: 'Staff Enrolment & ID', icon: UserPlus },
      { key: 'compliance', label: 'Compliance & Audit', icon: FileText },
      { key: 'cashier', label: 'Revenue & Cashier', icon: BarChart3 },
    ],
  },
];

interface Props {
  session: UserSession;
  onLogout: () => void;
}

function formatNow(): string {
  try {
    return new Date().toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export const AdminShell: React.FC<Props> = ({ session, onLogout }) => {
  const [module, setModule] = useState<AdminModule>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState(formatNow);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = setInterval(() => setClock(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const facility = session.facility || 'Immanuel General Hospital, Eket';
  const initials = session.avatarInitials || 'HA';

  const body = useMemo(() => {
    switch (module) {
      case 'dashboard':
        return <AdminWorkspace session={session} onNavigate={(k) => setModule(k as AdminModule)} />;
      case 'transfer':
        return <HospitalStaffTransfer session={session} />;
      case 'staffing':
        return <StaffingOverview />;
      case 'facility':
        return <FacilityOnboarding />;
      case 'command':
        return <CommandCentreDashboard />;
      case 'beds':
        return <BedManagement />;
      case 'patient-flow':
        return <PatientFlowVisibility />;
      case 'ambulance':
        return (
          <div className="admin-placeholder">
            <PhoneCall size={28} />
            <h2>Ambulance &amp; Dispatch</h2>
            <p>Fleet tracking and dispatch will appear here.</p>
          </div>
        );
      case 'rbac':
        return <AccessControl />;
      case 'enrolment':
        return <StaffEnrolment />;
      case 'compliance':
        return <ComplianceAuditLogs />;
      case 'cashier':
        return <CashierRevenue />;
      default:
        return <AdminWorkspace session={session} onNavigate={(k) => setModule(k as AdminModule)} />;
    }
  }, [module, session]);

  return (
    <div className="admin-shell">
      {/* ── Dark sidebar (mockup) ── */}
      <aside className={`admin-shell-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="admin-shell-brand">
          <div className="admin-shell-logo">M</div>
          {!collapsed && (
            <div className="admin-shell-brand-text">
              <span className="name">MedCore</span>
              <span className="role">ADMINISTRATOR</span>
            </div>
          )}
          <button
            type="button"
            className="admin-shell-collapse"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <ChevronLeft size={16} style={{ transform: collapsed ? 'rotate(180deg)' : undefined }} />
          </button>
        </div>

        <nav className="admin-shell-nav">
          {NAV.map((sec, si) => (
            <div key={si} className="admin-shell-nav-sec">
              {sec.label && !collapsed && (
                <div className="admin-shell-nav-label">{sec.label}</div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const active = module === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`admin-shell-nav-item${active ? ' is-active' : ''}`}
                    onClick={() => setModule(item.key)}
                    title={item.label}
                  >
                    <Icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-shell-user">
          <div className="admin-shell-avatar">{initials}</div>
          {!collapsed && (
            <div className="admin-shell-user-meta">
              <div className="admin-shell-user-name">{session.name || 'Hospital Administrator'}</div>
              <div className="admin-shell-user-fac">{facility}</div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="admin-shell-main">
        <header className="admin-shell-top">
          <div className="admin-shell-top-left">
            <div className="admin-shell-facility">
              <Building2 size={14} />
              <span>{facility}</span>
            </div>
            <div className="admin-shell-online">
              <span className="dot" />
              Online
            </div>
            <div className="admin-shell-clock">{clock}</div>
          </div>

          <div className="admin-shell-top-right">
            <div className="admin-shell-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anything..."
                aria-label="Search"
              />
              <kbd>⌘K</kbd>
            </div>
            <button type="button" className="admin-shell-icon-btn" aria-label="Notifications">
              <Bell size={16} />
              <span className="badge">3</span>
            </button>
            <div className="admin-shell-profile">
              <div className="admin-shell-avatar sm">{initials}</div>
              <span>Admin</span>
            </div>
            <button type="button" className="admin-shell-icon-btn" onClick={onLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="admin-shell-content">{body}</main>
      </div>
    </div>
  );
};

export default AdminShell;
