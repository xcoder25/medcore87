import React, { useState, useEffect, lazy, Suspense } from 'react';

// ── Always-needed (small, on the critical path) ─────────────────────────────
import { AuthScreen, UserSession } from './components/auth/AuthScreen';
import { HospitalOnboardingWizard, resolveOnboardingMode } from './components/onboarding/HospitalOnboardingWizard';
import { RoleFirstRunGuide } from './components/onboarding/RoleFirstRunGuide';
import { RealtimeChrome } from './components/realtime/RealtimeChrome';
import { shouldShowRoleGuide } from './lib/roleFirstRunGuide';
import { inferRoleKey, ensureCardForSession } from './lib/staffCardStore';
import { subscribeOnboarding } from './lib/onboardingStore';
import { hydratePatientRegistry } from './lib/patientRegistryStore';
import { hydrateBedBoard } from './lib/bedBoardStore';
import { migrateLocalStorageToIDB } from './lib/idb';
import './styles/os.css';

// ── Heavy modules — loaded on demand (lazy) ───────────────────────────────
// Each import() creates a separate JS chunk; the browser only fetches the
// chunk when the user first navigates to that module.
const RoleDashboard       = lazy(() => import('./components/dashboards/RoleDashboard').then(m => ({ default: m.RoleDashboard })));
const CommandCentreDashboard = lazy(() => import('./components/command-centre/CommandCentreDashboard').then(m => ({ default: m.CommandCentreDashboard })));
const AICommandInsights   = lazy(() => import('./components/ai-insights/AICommandInsights').then(m => ({ default: m.AICommandInsights })));
const EMRManager          = lazy(() => import('./components/gateway-modules/EMRManager').then(m => ({ default: m.EMRManager })));
const BedManagement       = lazy(() => import('./components/beds/BedManagement').then(m => ({ default: m.BedManagement })));
const PatientFlowVisibility = lazy(() => import('./components/patient-flow/PatientFlowVisibility').then(m => ({ default: m.PatientFlowVisibility })));
const StaffingOverview    = lazy(() => import('./components/staffing/StaffingOverview').then(m => ({ default: m.StaffingOverview })));
const HospitalStaffTransfer = lazy(() => import('./components/staffing/HospitalStaffTransfer').then(m => ({ default: m.HospitalStaffTransfer })));
const StaffEnrolment      = lazy(() => import('./components/staffing/StaffEnrolment').then(m => ({ default: m.StaffEnrolment })));
const StaffIdCardView     = lazy(() => import('./components/staffing/StaffIdCardView').then(m => ({ default: m.StaffIdCardView })));
const CashierRevenue      = lazy(() => import('./components/cashier/CashierRevenue').then(m => ({ default: m.CashierRevenue })));
const DigitalPatientCard  = lazy(() => import('./components/patient-card/DigitalPatientCard').then(m => ({ default: m.DigitalPatientCard })));
const AuthIdentity        = lazy(() => import('./components/auth/AuthIdentity').then(m => ({ default: m.AuthIdentity })));
const FacilityOnboarding  = lazy(() => import('./components/facility/FacilityOnboarding').then(m => ({ default: m.FacilityOnboarding })));
const IntegratedDataHub   = lazy(() => import('./components/data-hub/IntegratedDataHub').then(m => ({ default: m.IntegratedDataHub })));
const PerformanceAnalytics = lazy(() => import('./components/analytics/PerformanceAnalytics').then(m => ({ default: m.PerformanceAnalytics })));
const AccessControl       = lazy(() => import('./components/rbac/AccessControl').then(m => ({ default: m.AccessControl })));
const SystemAdministration = lazy(() => import('./components/system-admin/SystemAdministration').then(m => ({ default: m.SystemAdministration })));
const ComplianceAuditLogs = lazy(() => import('./components/compliance/ComplianceAuditLogs').then(m => ({ default: m.ComplianceAuditLogs })));

// ── Module skeleton shown while a lazy chunk is downloading ──────────────────
const ModuleSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, animation: 'os-pulse 1.4s ease-in-out infinite' }}>
    <div style={{ height: 32, width: '40%', background: 'rgba(15,23,42,0.06)', borderRadius: 8 }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {[1,2,3,4].map(i => <div key={i} style={{ height: 88, background: 'rgba(15,23,42,0.06)', borderRadius: 12 }} />)}
    </div>
    <div style={{ height: 240, background: 'rgba(15,23,42,0.04)', borderRadius: 12 }} />
  </div>
);

type ModuleKey =
  | 'dashboard' | 'command' | 'ai' | 'emr' | 'beds' | 'patient-flow' | 'staffing'
  | 'transfer' | 'enrolment' | 'my-card' | 'cashier' | 'patient-card' | 'auth' | 'facility'
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
      { key: 'ai', icon: '🤖', label: 'AI Insights', badge: 'AI' },
      { key: 'beds', icon: '🛏', label: 'Bed Management' },
      { key: 'patient-flow', icon: '🔄', label: 'Patient Flow' },
      { key: 'staffing', icon: '👥', label: 'Staffing' },
      { key: 'enrolment', icon: '🪪', label: 'Staff Enrolment & ID', badge: 'Staff' },
      { key: 'my-card', icon: '🎴', label: 'My Staff ID Card' },
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
      { key: 'auth', icon: '🔐', label: 'Auth & Identity', badge: 'Staff' },
      { key: 'facility', icon: '🏥', label: 'Facility & SaaS', badge: 'SaaS' },
      { key: 'rbac', icon: '🛡', label: 'Access Control' },
      { key: 'transfer', icon: '🔀', label: 'Staff Transfer', badge: 'Admin', badgeTone: 'arise', adminOnly: true },
    ],
  },
  {
    label: 'Clinical tools',
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
  const [onboardTick, setOnboardTick] = useState(0);
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  useEffect(() => {
    if (!session) return;
    const unsub = subscribeOnboarding(() => {
      setOnboardTick((t) => t + 1);
    }, session.hospitalId);
    return unsub;
  }, [session?.hospitalId, session?.badgeId]);

  // ── Post-login: hydrate IndexedDB caches & run one-time migration ────────
  useEffect(() => {
    if (!session) return;
    // Run in the background — does not block rendering
    void Promise.all([
      hydratePatientRegistry(),
      hydrateBedBoard(),
      migrateLocalStorageToIDB([
        { lsKey: 'medcore_os_patient_registry_v1', idbStore: 'patient_registry', idbKey: 'all' },
        { lsKey: 'medcore_os_bed_board_v1',        idbStore: 'bed_board',        idbKey: 'state' },
        { lsKey: 'medcore_os_bed_audit_v1',        idbStore: 'bed_audit',        idbKey: 'all' },
        { lsKey: 'medcore_os_staff_cards_v1',      idbStore: 'staff_cards',      idbKey: 'all' },
        { lsKey: 'medcore_os_staff_registry_v1',   idbStore: 'staff_registry',   idbKey: 'all' },
      ]),
    ]);
  }, [session?.badgeId]);

  if (!session) {
    return <AuthScreen onLogin={(s) => { setSession(s); setActiveModule('dashboard'); }} />;
  }

  void onboardTick;
  const onboardMode = resolveOnboardingMode(session);
  if (onboardMode) {
    return (
      <HospitalOnboardingWizard
        session={session}
        mode={onboardMode}
        onComplete={() => setSession({ ...session })}
      />
    );
  }

  const guideRole = inferRoleKey(session.roleKey || session.role || session.title, session.badgeId);
  if (shouldShowRoleGuide(session.badgeId || '', guideRole)) {
    return (
      <RoleFirstRunGuide
        session={session}
        onComplete={({ openModule } = {}) => {
          if (openModule) setActiveModule(openModule as any);
          setSession({ ...session });
        }}
      />
    );
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
      case 'enrolment':    return <StaffEnrolment />;
      case 'my-card': {
        const card = ensureCardForSession(session);
        return (
          <div className="os-module-layout">
            <div className="os-insight-banner">
              <div>
                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>
                  My Staff ID — linked to this login
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>
                  Same badge ID on MedCore Clinic. Status follows staff access (active or suspended).
                </div>
              </div>
            </div>
            <StaffIdCardView card={card} />
          </div>
        );
      }
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
                Hospital OS
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
              <span>Online · {now}</span>
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
            <Suspense fallback={<ModuleSkeleton />}>
              {renderModule()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
