'use client';

/**
 * Full Administrator shell — matches MedCore admin mockup (dark sidebar + premium home).
 */
import React, { useMemo, useState, useEffect } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import { AdminWorkspace } from './AdminWorkspace';
import {
  LayoutDashboard, Users, Building2, Activity, BedDouble, RefreshCw, PhoneCall,
  Lock, Shield, FileText, BarChart3, Search, Bell, ChevronLeft, LogOut, Settings,
  Brain, Sparkles, ChevronDown, Landmark, ArrowRightLeft, IdCard,
} from 'lucide-react';
import { MyStaffIdPanel } from '../staffing/MyStaffIdPanel';
import { ChangeCredentialsModal } from '../auth/ChangeCredentialsModal';
import { UserProfileModal } from '../auth/UserProfileModal';
import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';
import { M87AICopilotSuite } from '../ai-insights/M87AICopilotSuite';
import { HybridConnectivityDrawer } from '../realtime/HybridConnectivityDrawer';

// Lazy module map — same keys as page.tsx
import { HospitalStaffTransfer } from '../staffing/HospitalStaffTransfer';
import { StaffingOverview } from '../staffing/StaffingOverview';
import { FacilityOnboarding } from '../facility/FacilityOnboarding';
import { CommandCentreDashboard } from '../command-centre/CommandCentreDashboard';
import { BedManagement } from '../beds/BedManagement';
import { PatientFlowVisibility } from '../patient-flow/PatientFlowVisibility';
import { AccessControl } from '../rbac/AccessControl';
import { RolePermissionsMatrix } from '../rbac/RolePermissionsMatrix';
import { ComplianceAuditLogs } from '../compliance/ComplianceAuditLogs';
import { AdminRevenueOverview } from '../admin/AdminRevenueOverview';
import { AdminSettings } from '../admin/AdminSettings';
import { getAdminSettings, subscribeAdminSettings } from '../../lib/adminSettingsStore';
import { AdminAmbulanceDesk } from '../operations/AdminAmbulanceDesk';
import { NotificationCentre } from '../notifications/NotificationCentre';
import { AkwaRemitRevenueSuite } from '../finance/AkwaRemitRevenueSuite';
import NotificationBell from '../realtime/NotificationBell';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { ensureCleanPilot, setActiveFacilityId } from '../../lib/adminRealtimeStore';
import { startFacilitySyncLoop, probeHospitalApi } from '../../lib/hospitalSync';
import { firestoreSubscribeFacility, enableFirestoreOffline } from '../../lib/firebase';
import { getOutboxPendingCount, startOutboxAutoFlush } from '../../lib/durableOutbox';
import {
  applyCloudStaffDirectory,
  isStaffFlushLocked,
  syncAccessRosterFromSources,
} from '../../lib/staffCardStore';

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
  | 'role-permissions'
  | 'enrolment'
  | 'compliance'
  | 'cashier'
  | 'akwaremit'
  | 'settings'
  | 'notifications'
  | 'my-card'
  | 'm87-ai';

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
    label: 'Command & Analytics',
    items: [
      { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      { key: 'm87-ai', label: 'Clinical Intelligence & CDS', icon: Brain },
      { key: 'command', label: 'Hospital Command Centre', icon: Activity },
      { key: 'beds', label: 'Hospital Bed Census', icon: BedDouble },
      { key: 'cashier', label: 'Revenue & Finance', icon: BarChart3 },
      { key: 'akwaremit', label: 'AkwaRemit State Revenue', icon: Landmark },
      { key: 'notifications', label: 'Admin In-Basket', icon: Bell },
    ],
  },
  {
    label: 'Workforce & Operations',
    items: [
      { key: 'rbac', label: 'Staff Access & Enrolment', icon: Shield },
      { key: 'staffing', label: 'Staff Presence & Rosters', icon: Users },
      { key: 'transfer', label: 'Hospital Staff Transfer', icon: ArrowRightLeft },
      { key: 'patient-flow', label: 'Patient Flow Visibility', icon: RefreshCw },
      { key: 'my-card', label: 'My Administrator ID Card', icon: IdCard },
    ],
  },
  {
    label: 'Identity, Security & Governance',
    items: [
      { key: 'role-permissions', label: 'Role Visibility & Matrix', icon: Lock },
      { key: 'compliance', label: 'Compliance & Audit Logs', icon: FileText },
      { key: 'facility', label: 'Hospital Facility Setup', icon: Building2 },
      { key: 'settings', label: 'Hospital Settings & Configuration', icon: Settings },
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
  const [moduleHistory, setModuleHistory] = useState<AdminModule[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState(formatNow);
  const [search, setSearch] = useState('');

  const adminSuggestions: SearchSuggestion[] = useMemo(() => {
    const list: SearchSuggestion[] = [];
    NAV.forEach((sec) => {
      sec.items.forEach((item) => {
        list.push({
          id: item.key,
          label: item.label,
          category: sec.label || 'Navigation',
          icon: item.icon,
          onClick: () => {
            goModule(item.key);
            setSearch('');
          },
        });
      });
    });
    list.push(
      {
        id: 'settings-identity',
        label: 'Hospital Identity & Profile Settings',
        sub: 'Branding, LGA, helpline numbers',
        category: 'Settings',
        icon: Building2,
        onClick: () => { goModule('settings'); setSearch(''); },
      },
      {
        id: 'settings-security',
        label: 'Administrator Security & Master PIN',
        sub: 'Change admin password or fast-switch PIN',
        category: 'Security',
        icon: Lock,
        onClick: () => { setShowCredModal(true); setSearch(''); },
      },
      {
        id: 'ai-cds',
        label: 'Clinical Intelligence & AI Ops',
        sub: 'Triage rules, reception automation, and CDS',
        category: 'Intelligence',
        icon: Sparkles,
        onClick: () => { goModule('m87-ai'); setSearch(''); },
      }
    );
    return list;
  }, []);
  const [online, setOnline] = useState(true);
  const [hospitalShare, setHospitalShare] = useState<'local' | 'lan' | 'cloud' | 'probing'>('probing');
  const [facilityDisplayName, setFacilityDisplayName] = useState(() => {
    const s = getAdminSettings(session.hospitalId);
    return s.displayName
      ? (s.lga ? `${s.displayName}, ${s.lga}` : s.displayName)
      : (session.facility || 'Hospital Facility');
  });

  useEffect(() => {
    const updateFromStore = () => {
      const s = getAdminSettings(session.hospitalId);
      if (s.displayName) {
        setFacilityDisplayName(s.lga ? `${s.displayName}, ${s.lga}` : s.displayName);
      }
    };
    updateFromStore();
    const unsub = subscribeAdminSettings(updateFromStore);
    window.addEventListener('medcore-facility-updated', updateFromStore);
    return () => {
      unsub();
      window.removeEventListener('medcore-facility-updated', updateFromStore);
    };
  }, [session.hospitalId]);
  const [pendingSync, setPendingSync] = useState(0);
  const [showCredModal, setShowCredModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { connected } = useRealtimeEvents({ app: 'MEDCORE_OS_ADMIN', facilityId: session.hospitalId });

  const goModule = (key: AdminModule) => {
    if (key === module) return;
    setModuleHistory((h) => [...h.slice(-19), module]);
    setModule(key);
  };

  const goBack = () => {
    setModuleHistory((h) => {
      if (!h.length) {
        setModule('dashboard');
        return h;
      }
      const prev = h[h.length - 1];
      setModule(prev);
      return h.slice(0, -1);
    });
  };

  useEffect(() => {
    try { ensureCleanPilot(); } catch {}
    const fid = session.hospitalId || session.facility || 'DEFAULT-HOSPITAL';
    setActiveFacilityId(fid);
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    const id = setInterval(() => setClock(formatNow()), 1000);

    // Same-hospital multi-user: pull shared facility data from LAN API when present
    const applyKey = (key: string, value: unknown) => {
      try {
        if (value === undefined) return;
        // Protect staff from empty or destructive remote overwrites
        if (
          key === 'medcore_os_access_control' ||
          key === 'medcore_os_staff_registry' ||
          key === 'medcore_staff_id_cards' ||
          key === 'medcore_os_staff_cards' ||
          key === 'medcore_staff_cards'
        ) {
          if (!Array.isArray(value) || value.length === 0) {
            if (!isStaffFlushLocked()) return;
          }
          if (
            key === 'medcore_staff_id_cards' ||
            key === 'medcore_os_staff_cards' ||
            key === 'medcore_staff_cards'
          ) {
            applyCloudStaffDirectory({ staffCards: value as any[], facilityId: fid });
            return;
          }
          if (key === 'medcore_os_staff_registry') {
            applyCloudStaffDirectory({ staffRegistry: value as any[], facilityId: fid });
            return;
          }
          if (key === 'medcore_os_access_control') {
            syncAccessRosterFromSources(fid);
            return;
          }
        }
        localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key } }));
      } catch { /* ignore */ }
    };
    const stopSync = startFacilitySyncLoop(fid, applyKey, 4000);
    void enableFirestoreOffline();
    const stopOutbox = startOutboxAutoFlush(12000);
    const pendingIv = setInterval(() => setPendingSync(getOutboxPendingCount()), 3000);
    setPendingSync(getOutboxPendingCount());
    const stopFs = firestoreSubscribeFacility(fid, (data) => {
      setHospitalShare('cloud');
      for (const [k, v] of Object.entries(data)) {
        if (k === 'updatedAt') continue;
        applyKey(k, v);
      }
    });
    void probeHospitalApi().then((ok) => {
      setHospitalShare((prev) => (prev === 'cloud' ? 'cloud' : ok ? 'lan' : 'local'));
    });

    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
      stopSync();
      stopFs();
      stopOutbox();
      clearInterval(pendingIv);
    };
  }, [session.hospitalId, session.facility]);

  const facility = session.facility || 'Immanuel General Hospital, Eket';
  const initials = session.avatarInitials || 'HA';

  const body = useMemo(() => {
    switch (module) {
      case 'dashboard':
        return <AdminWorkspace session={session} onNavigate={(k) => goModule(k as AdminModule)} />;
      case 'transfer':
        return <HospitalStaffTransfer session={session} />;
      case 'staffing':
        return <StaffingOverview session={session} />;
      case 'facility':
        return <FacilityOnboarding session={session} />;
      case 'command':
        return <CommandCentreDashboard />;
      case 'beds':
        return <BedManagement />;
      case 'patient-flow':
        return <PatientFlowVisibility />;
      case 'ambulance':
        return <AdminAmbulanceDesk />;
      case 'rbac':
        return <AccessControl session={session} initialTab="directory" onNavigate={(k) => goModule(k as AdminModule)} />;
      case 'role-permissions':
        return <RolePermissionsMatrix />;
      case 'enrolment':
        return <AccessControl session={session} initialTab="enrol" onNavigate={(k) => goModule(k as AdminModule)} />;
      case 'compliance':
        return <ComplianceAuditLogs />;
      case 'cashier':
        return <AdminRevenueOverview session={session} />;
      case 'akwaremit':
        return <AkwaRemitRevenueSuite session={session} />;
      case 'notifications':
        return <NotificationCentre session={session} />;
      case 'my-card':
        return <MyStaffIdPanel session={session} />;
      case 'settings':
        return <AdminSettings session={session} />;
      case 'm87-ai':
        return <M87AICopilotSuite session={session} onNavigate={(k: string) => goModule(k as AdminModule)} />;
      default:
        return <AdminWorkspace session={session} onNavigate={(k) => goModule(k as AdminModule)} />;
    }
  }, [module, session]);

  return (
    <div className="admin-shell">
      {/* ── Dark sidebar (mockup) ── */}
      <aside className={`admin-shell-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="admin-shell-brand">
          <div className="admin-shell-logo">
            <img src="/medcore-logo.png" alt="MedCore" />
          </div>
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
                    onClick={() => goModule(item.key)}
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

        <div
          className="admin-shell-user"
          onClick={() => goModule('my-card')}
          style={{ cursor: 'pointer' }}
          title="View My Administrator ID Card"
        >
          <div className="admin-shell-avatar">{initials}</div>
          {!collapsed && (
            <div className="admin-shell-user-meta">
              <div className="admin-shell-user-name">{session.name || 'Hospital Administrator'}</div>
              <div className="admin-shell-user-fac">{facilityDisplayName}</div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="admin-shell-main">
        <header className="admin-shell-top">
          <div className="admin-shell-top-left">
            <button
              type="button"
              className="admin-shell-icon-btn"
              onClick={goBack}
              title="Back"
              aria-label="Go back"
              disabled={moduleHistory.length === 0 && module === 'dashboard'}
              style={{
                opacity: moduleHistory.length === 0 && module === 'dashboard' ? 0.35 : 1,
                marginRight: 4,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="admin-shell-facility"
              onClick={() => goModule('settings')}
              title={`${facilityDisplayName} · Click to edit hospital settings`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
            >
              <Building2 size={14} style={{ flexShrink: 0 }} />
              <span>{facilityDisplayName}</span>
            </button>
            <HybridConnectivityDrawer />
            <div className="admin-shell-clock">{clock}</div>
          </div>

          <div className="admin-shell-top-right">
            <div style={{ width: 280, maxWidth: '100%' }}>
              <InteractiveSearchBar
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search modules, staff, settings…"
                suggestions={adminSuggestions}
                size="sm"
                kbdShortcut="⌘K"
                aria-label="Search modules and settings"
              />
            </div>
            <NotificationBell app="MEDCORE_OS_ADMIN" facilityId={session.facility} session={session} />
            <button
              type="button"
              className="admin-shell-icon-btn"
              onClick={() => goModule('m87-ai')}
              title="Open Clinical Intelligence & CDS"
              style={{ color: '#F59E0B' }}
            >
              <Sparkles size={16} />
            </button>
            <div
              className="admin-shell-profile"
              onClick={() => setShowProfileModal(true)}
              style={{ cursor: 'pointer' }}
              title="View Administrator Profile & Security"
            >
              <div className="admin-shell-avatar sm">{initials}</div>
              <span>Admin</span>
              <ChevronDown size={13} style={{ color: '#64748B', marginLeft: 2 }} />
            </div>
            <button type="button" className="admin-shell-icon-btn" onClick={onLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="admin-shell-content">
          {body}
        </main>

        <UserProfileModal
          session={session}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onOpenCredentials={() => setShowCredModal(true)}
          onLogout={onLogout}
        />
        <ChangeCredentialsModal
          session={session}
          isOpen={showCredModal}
          onClose={() => setShowCredModal(false)}
        />
      </div>
    </div>
  );
};

export default AdminShell;
