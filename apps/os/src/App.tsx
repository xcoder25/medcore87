import React, { useState } from 'react';
import { CommandCentreDashboard } from './components/command-centre/CommandCentreDashboard';
import { BedManagement } from './components/beds/BedManagement';
import { PatientFlowVisibility } from './components/patient-flow/PatientFlowVisibility';
import { StaffingOverview } from './components/staffing/StaffingOverview';
import { HospitalStaffTransfer } from './components/staffing/HospitalStaffTransfer';
import { IntegratedDataHub } from './components/data-hub/IntegratedDataHub';
import { PerformanceAnalytics } from './components/analytics/PerformanceAnalytics';
import { AccessControl } from './components/rbac/AccessControl';
import { SystemAdministration } from './components/system-admin/SystemAdministration';
import { ComplianceAuditLogs } from './components/compliance/ComplianceAuditLogs';
import { AICommandInsights } from './components/ai-insights/AICommandInsights';
import { CashierRevenue } from './components/cashier/CashierRevenue';
import { FacilityOnboarding } from './components/facility/FacilityOnboarding';
import { AuthIdentity } from './components/auth/AuthIdentity';
import { DigitalPatientCard } from './components/patient-card/DigitalPatientCard';
import { RoleDashboard } from './components/dashboards/RoleDashboard';
import { EMRManager } from './components/gateway-modules/EMRManager';
import { AuthScreen, UserSession } from './components/auth/AuthScreen';
import { RealtimeChrome } from './components/realtime/RealtimeChrome';
import './styles/os.css';

type ModuleKey =
  | 'dashboard' | 'command' | 'ai' | 'emr' | 'beds' | 'patient-flow' | 'staffing'
  | 'transfer' | 'cashier' | 'patient-card' | 'auth' | 'facility'
  | 'data-hub' | 'analytics' | 'rbac' | 'sysadmin' | 'compliance';

type NavSection = {
  label: string;
  items: { key: ModuleKey; icon: string; label: string; badge?: string; badgeTone?: 'default' | 'arise'; adminOnly?: boolean }[];
};

const NAV: NavSection[] = [
  {
    label: 'My Dashboard',
    items: [
      { key: 'dashboard', icon: '🏠', label: 'My Dashboard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'command', icon: '🖥', label: 'Command Centre' },
      { key: 'ai', icon: '🤖', label: 'AI Insights', badge: 'M87' },
      { key: 'beds', icon: '🛏', label: 'Bed Management' },
      { key: 'patient-flow', icon: '🔄', label: 'Patient Flow' },
      { key: 'staffing', icon: '👥', label: 'Staffing' },
    ],
  },
  {
    label: 'Finance & Records',
    items: [
      { key: 'emr', icon: '📋', label: 'Intelligent EMR & Records', badge: 'AI' },
      { key: 'cashier', icon: '💰', label: 'Cashier & Revenue' },
      { key: 'patient-card', icon: '🪪', label: 'Digital Patient Card', badge: 'FHIR' },
    ],
  },
  {
    label: 'Identity & Access',
    items: [
      { key: 'auth', icon: '🔐', label: 'Auth & Identity', badge: 'IAM' },
      { key: 'facility', icon: '🏥', label: 'Facility & SaaS', badge: 'SaaS' },
      { key: 'rbac', icon: '🛡', label: 'Access Control' },
      { key: 'transfer', icon: '🔀', label: 'Staff Transfer', badge: 'Admin', badgeTone: 'arise', adminOnly: true },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { key: 'data-hub', icon: '🔗', label: 'Data Hub' },
      { key: 'analytics', icon: '📊', label: 'Analytics' },
      { key: 'compliance', icon: '📋', label: 'Compliance & Audit' },
      { key: 'sysadmin', icon: '⚙️', label: 'System Admin' },
    ],
  },
];

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  if (!session) {
    return <AuthScreen onLogin={(s) => { setSession(s); setActiveModule('dashboard'); }} />;
  }

  const isAdmin = ['hospital_admin', 'sysadmin', 'medical_director'].includes(session.roleKey);

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':    return <RoleDashboard session={session} onNavigate={(k) => setActiveModule(k as ModuleKey)} />;
      case 'command':      return <CommandCentreDashboard />;
      case 'ai':           return <AICommandInsights />;
      case 'emr':          return <EMRManager onNavigate={(k) => setActiveModule(k as ModuleKey)} />;
      case 'beds':         return <BedManagement />;
      case 'patient-flow': return <PatientFlowVisibility />;
      case 'staffing':     return <StaffingOverview />;
      case 'transfer':     return <HospitalStaffTransfer session={session} />;
      case 'cashier':      return <CashierRevenue />;
      case 'patient-card': return <DigitalPatientCard />;
      case 'auth':         return <AuthIdentity />;
      case 'facility':     return <FacilityOnboarding />;
      case 'data-hub':     return <IntegratedDataHub />;
      case 'analytics':    return <PerformanceAnalytics />;
      case 'rbac':         return <AccessControl />;
      case 'sysadmin':     return <SystemAdministration />;
      case 'compliance':   return <ComplianceAuditLogs />;
      default:             return <RoleDashboard session={session} onNavigate={(k) => setActiveModule(k as ModuleKey)} />;
    }
  };

  const allNavItems = NAV.flatMap(s => s.items);
  const activeItem = allNavItems.find(i => i.key === activeModule);
  const facilityShort =
    session.facility.length > 32 ? session.facility.slice(0, 30) + '…' : session.facility;

  return (
    <div className="os-shell">
      {/* ── Sidebar ── */}
      <aside className={`os-sidebar${sidebarOpen ? '' : ' is-collapsed'}`}>
        <div className="os-sidebar-brand">
          <div className="os-sidebar-logo-wrap">
            <img src="/medcore-logo.png" alt="MedCore" />
          </div>
          {sidebarOpen && (
            <div className="os-sidebar-brand-text">
              <div className="os-sidebar-brand-name">MedCore</div>
              <div className="os-sidebar-brand-sub">
                Hospital OS <span className="m87-pill">M87</span>
              </div>
            </div>
          )}
        </div>

        <nav className="os-sidebar-nav">
          {NAV.map(section => (
            <div key={section.label} className="os-nav-section">
              {sidebarOpen && (
                <div className="os-nav-section-label">{section.label}</div>
              )}
              {section.items
                .filter(item => !item.adminOnly || isAdmin)
                .map(item => {
                  const isActive = activeModule === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`os-nav-item${isActive ? ' is-active' : ''}`}
                      onClick={() => setActiveModule(item.key)}
                      title={item.label}
                    >
                      <span className="os-nav-icon">{item.icon}</span>
                      {sidebarOpen && (
                        <>
                          <span className="os-nav-label">{item.label}</span>
                          {item.badge && (
                            <span className={`os-nav-badge${item.badgeTone === 'arise' ? ' arise' : ''}`}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="os-sidebar-footer">
            <div className="os-sidebar-user">
              <div className="os-sidebar-avatar">{session.avatarInitials}</div>
              <div className="os-sidebar-user-meta">
                <div className="os-sidebar-user-name">{session.name}</div>
                <div className="os-sidebar-user-role">{session.role}</div>
              </div>
            </div>
            <div className="os-sidebar-facility">🏥 {facilityShort}</div>
            <div className="os-live-row">
              <span className="os-live-dot" />
              <span>LIVE · {now}</span>
            </div>
            <button
              type="button"
              className="os-btn-signout"
              onClick={() => { setSession(null); setActiveModule('dashboard'); }}
            >
              ⏏ Sign Out
            </button>
          </div>
        )}

        <button
          type="button"
          className="os-sidebar-collapse"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="os-main">
        <header className="os-topbar">
          <div className="os-topbar-title-block">
            {activeItem && (
              <>
                <div className="os-topbar-icon">{activeItem.icon}</div>
                <div>
                  <div className="os-topbar-heading">
                    {activeModule === 'dashboard' ? `${session.role} Dashboard` : activeItem.label}
                  </div>
                  <div className="os-topbar-sub">
                    MedCore OS · {session.facility}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="os-topbar-actions">
            <RealtimeChrome
              facilityId={session.hospitalId || 'AKS-IBOM-SPECIALIST'}
              app="MEDCORE_OS"
            />
            <span className="os-pill os-pill-host">
              {session.hospitalId.toLowerCase()}.medcore.ng
            </span>
            <div className="os-topbar-avatar" title={session.name}>
              {session.avatarInitials}
            </div>
          </div>
        </header>

        <main className="os-content">
          <div className="os-content-inner os-active-module-wrap">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
