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
import './styles/os.css';

// ─── Navigation config ─────────────────────────────────────────────────────────

type ModuleKey =
  | 'dashboard' | 'command' | 'ai' | 'emr' | 'beds' | 'patient-flow' | 'staffing'
  | 'transfer' | 'cashier' | 'patient-card' | 'auth' | 'facility'
  | 'data-hub' | 'analytics' | 'rbac' | 'sysadmin' | 'compliance';

type NavSection = {
  label: string;
  items: { key: ModuleKey; icon: string; label: string; badge?: string; adminOnly?: boolean }[];
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
      { key: 'transfer', icon: '🔀', label: 'Staff Transfer', badge: 'Admin', adminOnly: true },
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

// ─── App Shell ─────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  // ── Auth flow ──────────────────────────────────────────────────────────────
  if (!session) {
    return <AuthScreen onLogin={(s) => { setSession(s); setActiveModule('dashboard'); }} />;
  }

  const isAdmin = ['hospital_admin', 'sysadmin', 'medical_director'].includes(session.roleKey);

  // Module renderer
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

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#090D16', color: '#F9FAFB', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarOpen ? 224 : 56, flexShrink: 0,
        background: '#0B1120', borderRight: '1px solid #1F2937',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.22s ease', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
            <img src="/medcore-logo.png" alt="MedCore" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2, fontFamily: 'Outfit,sans-serif', color: '#FFFFFF' }}>MedCore</div>
              <div style={{ fontSize: '0.62rem', color: '#9CA3AF' }}>Powered by M87</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV.map(section => (
            <div key={section.label}>
              {sidebarOpen && (
                <div style={{ padding: '12px 14px 4px', fontSize: '0.62rem', color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {section.label}
                </div>
              )}
              {section.items
                .filter(item => !item.adminOnly || isAdmin)
                .map(item => {
                  const isActive = activeModule === item.key;
                  return (
                    <button key={item.key} onClick={() => setActiveModule(item.key)}
                      title={item.label}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: sidebarOpen ? '8px 14px' : '8px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        background: isActive ? 'rgba(13,148,136,0.15)' : 'transparent',
                        border: 'none', borderLeft: isActive ? '3px solid #0D9488' : '3px solid transparent',
                        color: isActive ? '#2DD4BF' : '#9CA3AF', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: isActive ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#F9FAFB'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent'; } }}
                    >
                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                      {sidebarOpen && (
                        <>
                          <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                          {item.badge && (
                            <span style={{ background: 'rgba(13,148,136,0.15)', color: '#2DD4BF', padding: '1px 6px', borderRadius: 5, fontSize: '0.6rem', fontWeight: 700 }}>{item.badge}</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Bottom: user info */}
        {sidebarOpen && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid #1F2937', fontSize: '0.72rem', color: '#6B7280', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg,#0D9488,#2563EB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 800, color: '#FFF',
              }}>{session.avatarInitials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#E5E7EB', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</div>
                <div style={{ fontSize: '0.65rem', color: '#4B5563' }}>{session.role}</div>
              </div>
            </div>
            <div style={{ fontWeight: 600, color: '#9CA3AF', marginBottom: 2, fontSize: '0.7rem' }}>
              🏥 {session.facility.length > 28 ? session.facility.slice(0, 26) + '…' : session.facility}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
              <span>LIVE · {now}</span>
            </div>
            {/* Logout */}
            <button
              onClick={() => { setSession(null); setActiveModule('dashboard'); }}
              style={{
                marginTop: 10, width: '100%', padding: '6px 10px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 7, color: '#F87171', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              ⏏ Sign Out
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer',
          padding: '10px', textAlign: 'center', borderTop: '1px solid #1F2937',
          fontSize: '0.85rem', transition: 'color 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <div>
            {activeItem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>{activeItem.icon}</span>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>
                    {activeModule === 'dashboard' ? `${session.role} Dashboard` : activeItem.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                    MedCore OS · {session.facility}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', padding: '4px 12px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(52,211,153,0.2)' }}>● LIVE</span>
            <span style={{ background: 'rgba(37,99,235,0.1)', color: '#60A5FA', padding: '4px 12px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 500, border: '1px solid rgba(37,99,235,0.2)' }}>
              {session.hospitalId.toLowerCase()}.medcore.ng
            </span>
            {/* Avatar */}
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#0D9488,#2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
              {session.avatarInitials}
            </div>
          </div>
        </div>

        {/* Active module */}
        <div className="os-grid" style={{ gridTemplateColumns: '1fr' }}>
          {renderModule()}
        </div>
      </main>
    </div>
  );
};

export default App;
