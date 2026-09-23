'use client';

import React, { useState, useEffect } from 'react';
import type { 
  RegionalFacilityOverview, 
  EpidemiologicalAlert, 
  RegulatoryComplianceAudit,
  RegulatoryDirective
} from '@medcore/types';

import { AdminHeader, AdminTab } from '../components/AdminHeader';
import { AdminTopBar } from '../components/AdminTopBar';
import { AdminSidebar, ExtendedAdminTab } from '../components/AdminSidebar';
import { NationalCommandHud } from '../components/NationalCommandHud';
import { FacilitySurveillanceView } from '../components/FacilitySurveillanceView';
import { EpidemiologicalRadarView } from '../components/EpidemiologicalRadarView';
import { LicensingAccreditationView } from '../components/LicensingAccreditationView';
import { WorkforceSurveillanceView } from '../components/WorkforceSurveillanceView';
import { DirectivesEnforcementView } from '../components/DirectivesEnforcementView';
import { FacilityDetailDrawer } from '../components/FacilityDetailDrawer';
import { BroadcastDirectiveModal } from '../components/BroadcastDirectiveModal';
import { ScheduleAuditModal } from '../components/ScheduleAuditModal';
import { M87AIAssistantView } from '../components/M87AIAssistantView';
import { VitalStatisticsView } from '../components/VitalStatisticsView';
import { FinancialRevenueView } from '../components/FinancialRevenueView';
import { SecurityAuditLedgerView } from '../components/SecurityAuditLedgerView';
import { FacilityRegistryView } from '../components/FacilityRegistryView';
import { MOHSplashScreen } from '../components/MOHSplashScreen';
import { MOHAuthScreen, MOHOfficerSession } from '../components/MOHAuthScreen';
import {
  buildOfficialFacilityRegistry,
  generateHospiCredentials,
  activateFacility,
  type AkwaIbomFacility,
} from '../data/akwaIbomFacilities';
import { Lock, Unlock, X, Wifi } from 'lucide-react';
import { startMohRealtime } from '../lib/mohRealtime';

const INITIAL_FACILITIES: RegionalFacilityOverview[] = [
  {
    facilityId: 'FAC-001',
    facilityName: 'National Referral Hospital & Trauma Centre',
    region: 'Capital Central',
    tier: 'national_referral',
    licenseNumber: 'MOH-LIC-2024-0019',
    licenseExpires: '2027-12-31',
    accreditationStatus: 'accredited',
    totalBeds: 850,
    occupiedBeds: 792,
    icuBedsTotal: 64,
    icuBedsOccupied: 58,
    ventilatorsAvailable: 12,
    staffOnDuty: 420,
    complianceScore: 98.4,
    emergencyStatus: 'normal',
  },
  {
    facilityId: 'FAC-002',
    facilityName: 'St. Jude Metropolitan General',
    region: 'Northern District',
    tier: 'regional_general',
    licenseNumber: 'MOH-LIC-2023-0482',
    licenseExpires: '2026-11-15',
    accreditationStatus: 'accredited',
    totalBeds: 420,
    occupiedBeds: 388,
    icuBedsTotal: 28,
    icuBedsOccupied: 26,
    ventilatorsAvailable: 4,
    staffOnDuty: 185,
    complianceScore: 94.2,
    emergencyStatus: 'surge_code_yellow',
  },
  {
    facilityId: 'FAC-003',
    facilityName: 'Eastern Coastal Children’s & Maternal Hospital',
    region: 'Eastern District',
    tier: 'specialized_center',
    licenseNumber: 'MOH-LIC-2025-0104',
    licenseExpires: '2028-04-30',
    accreditationStatus: 'accredited',
    totalBeds: 280,
    occupiedBeds: 215,
    icuBedsTotal: 32,
    icuBedsOccupied: 22,
    ventilatorsAvailable: 14,
    staffOnDuty: 140,
    complianceScore: 96.8,
    emergencyStatus: 'normal',
  },
  {
    facilityId: 'FAC-004',
    facilityName: 'Western Valley Community Hospital',
    region: 'Western Province',
    tier: 'district_hospital',
    licenseNumber: 'MOH-LIC-2022-0931',
    licenseExpires: '2026-10-01',
    accreditationStatus: 'provisional',
    totalBeds: 160,
    occupiedBeds: 142,
    icuBedsTotal: 10,
    icuBedsOccupied: 9,
    ventilatorsAvailable: 2,
    staffOnDuty: 62,
    complianceScore: 86.5,
    emergencyStatus: 'normal',
  },
];

const INITIAL_ALERTS: EpidemiologicalAlert[] = [
  {
    alertId: 'EPI-2026-08',
    condition: 'Acute Respiratory Syncytial Surge (Pediatric Bronchiolitis)',
    icd10Category: 'J21.0 - Acute bronchiolitis due to RSV',
    detectedCases: 142,
    rateOfIncreasePercent: 24.5,
    affectedRegions: ['Northern District', 'Eastern District'],
    severity: 'warning',
    reportingFacilitiesCount: 8,
    firstIdentified: '2026-09-02',
    containmentProtocolActive: true,
  },
  {
    alertId: 'EPI-2026-09',
    condition: 'Foodborne Gastroenteritis Cluster',
    icd10Category: 'A02.0 - Salmonella enteritis',
    detectedCases: 38,
    rateOfIncreasePercent: 12.0,
    affectedRegions: ['Western Province'],
    severity: 'advisory',
    reportingFacilitiesCount: 3,
    firstIdentified: '2026-09-07',
    containmentProtocolActive: false,
  },
];

const INITIAL_AUDITS: RegulatoryComplianceAudit[] = [
  {
    auditId: 'AUD-8831',
    facilityId: 'FAC-004',
    facilityName: 'Western Valley Community Hospital',
    auditDate: '2026-08-28',
    auditorName: 'Dr. Evelyn Vance (Chief Inspector)',
    category: 'pharmacy_cold_chain',
    findingsCount: 3,
    criticalViolations: 0,
    resolutionDeadline: '2026-10-15',
    status: 'remediation_required',
  },
  {
    auditId: 'AUD-8832',
    facilityId: 'FAC-001',
    facilityName: 'National Referral Hospital & Trauma Centre',
    auditDate: '2026-08-14',
    auditorName: 'Marcus Bennett (Directorate of Quality)',
    category: 'data_privacy_phi',
    findingsCount: 0,
    criticalViolations: 0,
    resolutionDeadline: 'N/A',
    status: 'passed',
  },
];

const INITIAL_DIRECTIVES: RegulatoryDirective[] = [
  {
    directiveId: 'DIR-0901',
    code: 'MOH-DIR-2026-041',
    title: 'Pediatric ICU Surge Protocol & Mutual-Aid Decompression',
    category: 'surge_capacity',
    severity: 'mandatory_order',
    issuedDate: '2026-09-04',
    effectiveUntil: '2026-10-04',
    targetRegions: ['Northern District', 'Eastern District'],
    targetFacilityTiers: ['national_referral', 'regional_general', 'specialized_center'],
    summary: 'Due to acute RSV bronchiolitis surge, all regional acute pediatric beds must be held at 15% standby reserve. Elective minor procedures suspended for 14 days.',
    mandatoryActions: [
      'Decompress pediatric step-down wards into ambulatory care',
      'Deploy rapid RSV antigen point-of-care diagnostics at triage',
      'Daily census telemetry transmission to MOH command hub by 08:00'
    ],
    complianceConfirmedCount: 7,
    totalTargetedFacilities: 8,
    status: 'active',
  },
  {
    directiveId: 'DIR-0899',
    code: 'MOH-DIR-2026-039',
    title: 'Hospital Pharmacy Vaccine Cold-Chain Re-verification',
    category: 'pharmaceutical_recall',
    severity: 'stat_advisory',
    issuedDate: '2026-08-20',
    effectiveUntil: '2026-09-20',
    targetRegions: ['Capital Central', 'Western Province'],
    targetFacilityTiers: ['national_referral', 'regional_general', 'district_hospital'],
    summary: 'Sub-zero temperature logs verification for mRNA and live-attenuated pediatric vaccines following regional power grid fluctuations.',
    mandatoryActions: [
      'Download 72-hour digital logger telemetry from cold storage',
      'Report any excursion exceeding 2°C to 8°C range immediately'
    ],
    complianceConfirmedCount: 18,
    totalTargetedFacilities: 18,
    status: 'completed',
  },
];

const DEFAULT_COMMISSIONER_SESSION: MOHOfficerSession = {
  id: 'MOH-OFF-001',
  name: 'Hon. Dr. Emmanuel Udoh',
  role: 'Commissioner of Health',
  department: 'Office of the Honourable Commissioner',
  badgeId: 'AKS-MOH-EXEC-01',
  clearanceLevel: 5,
  jurisdiction: 'Akwa Ibom State (Statewide)',
  avatarInitials: 'EU',
  authMethod: 'biometric_yubikey',
  token: 'mock-session-token-001',
  loginTime: 'Mon, 15 Sep 2025 10:24 AM',
};

export default function MOHAdminPage() {
  // On reload: always show splash first for 5s, then auth screen (no automatic login)
  const [appState, setAppState] = useState<'splash' | 'auth' | 'app'>('splash');
  const [officerSession, setOfficerSession] = useState<MOHOfficerSession | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');

  const [activeTab, setActiveTab] = useState<ExtendedAdminTab>('hud');
  const [selectedRegion, setSelectedRegion] = useState('All National Jurisdictions');
  const [facilities, setFacilities] = useState<RegionalFacilityOverview[]>(INITIAL_FACILITIES);
  const [alerts, setAlerts] = useState<EpidemiologicalAlert[]>(INITIAL_ALERTS);
  const [audits, setAudits] = useState<RegulatoryComplianceAudit[]>(INITIAL_AUDITS);
  const [directives, setDirectives] = useState<RegulatoryDirective[]>(INITIAL_DIRECTIVES);

  // Official Akwa Ibom secondary facility registry (starts pending)
  const [facilityRegistry, setFacilityRegistry] = useState<AkwaIbomFacility[]>(() =>
    buildOfficialFacilityRegistry()
  );
  const [notifications, setNotifications] = useState<
    { id: string; title: string; body: string; type: 'success' | 'info' | 'alert'; ts: string }[]
  >([]);

  const pushNotification = (title: string, body: string, type: 'success' | 'info' | 'alert' = 'info') => {
    const id = `NTF-${Date.now()}`;
    setNotifications((prev) => [{ id, title, body, type, ts: new Date().toISOString() }, ...prev].slice(0, 8));
  };

  const handleIssueCredentials = (facilityId: string) => {
    setFacilityRegistry((prev) =>
      prev.map((f) => {
        if (f.facilityId !== facilityId) return f;
        const creds = generateHospiCredentials(f);
        return {
          ...f,
          enrollmentStatus: 'credentials_issued',
          hospiLogin: creds.hospiLogin,
          hospiTempPassword: creds.hospiTempPassword,
          credentialsIssuedAt: creds.issuedAt,
        };
      })
    );
    const fac = facilityRegistry.find((f) => f.facilityId === facilityId);
    pushNotification(
      'Hospi OS Credentials Issued',
      `${fac?.facilityName ?? facilityId} — login ready. Share with facility admin. Status: Credentials Issued.`,
      'info'
    );
  };

  const handleSimulateActivation = (facilityId: string) => {
    setFacilityRegistry((prev) =>
      prev.map((f) => (f.facilityId === facilityId ? activateFacility(f) : f))
    );
    const fac = facilityRegistry.find((f) => f.facilityId === facilityId);
    pushNotification(
      'Facility Now Active',
      `${fac?.facilityName ?? facilityId} authenticated into Hospi OS and is streaming live telemetry. You can oversee this facility.`,
      'success'
    );
  };

  const handleIssueCredentialsBulk = (facilityIds: string[]) => {
    setFacilityRegistry((prev) =>
      prev.map((f) => {
        if (!facilityIds.includes(f.facilityId) || f.enrollmentStatus !== 'pending') return f;
        const creds = generateHospiCredentials(f);
        return {
          ...f,
          enrollmentStatus: 'credentials_issued',
          hospiLogin: creds.hospiLogin,
          hospiTempPassword: creds.hospiTempPassword,
          credentialsIssuedAt: creds.issuedAt,
        };
      })
    );
    pushNotification(
      'Bulk Credentials Issued',
      `Hospi OS logins generated for ${facilityIds.length} facility(ies). Share securely with each facility admin.`,
      'info'
    );
  };

  // Check saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('medcore_moh_session');
      if (saved) {
        setOfficerSession(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Realtime: live facility/epi ticks + optional Hospital Gateway WebSocket
  const [telemetryOnline, setTelemetryOnline] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string>(() => new Date().toISOString());
  useEffect(() => {
    if (appState !== 'app' || !officerSession) return;
    const stop = startMohRealtime({
      onFacilitiesTick: (mutator) => {
        setFacilities(mutator);
        setLastSyncAt(new Date().toISOString());
      },
      onAlertsTick: (mutator) => {
        setAlerts(mutator);
        setLastSyncAt(new Date().toISOString());
      },
      onNotification: (title, body, type) => pushNotification(title, body, type),
      onConnectionChange: (online) => setTelemetryOnline(online),
      onServerEvent: (topic, payload) => {
        setLastSyncAt(new Date().toISOString());
        if (topic === 'NOTIFICATION' && payload && typeof payload === 'object') {
          const p = payload as { title?: string; body?: string };
          pushNotification(p.title || 'Facility event', p.body || topic, 'info');
        }
        if (topic === 'BED_BOARD_UPDATED' || topic === 'QUEUES_UPDATED') {
          pushNotification('Facility telemetry', `${topic.replace(/_/g, ' ')} received from gateway`, 'info');
        }
      },
    });
    return stop;
  }, [appState, officerSession]);
  useEffect(() => {
    const onNotify = (ev: Event) => {
      const d = (ev as CustomEvent).detail || {};
      pushNotification(d.title || 'Notice', d.body || '', d.type || 'info');
    };
    window.addEventListener('moh:notify', onNotify as EventListener);
    return () => window.removeEventListener('moh:notify', onNotify as EventListener);
  }, []);


  const handleSplashComplete = () => {
    setAppState('auth');
  };

  const handleLoginSuccess = (session: MOHOfficerSession) => {
    setOfficerSession(session);
    setAppState('app');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('medcore_moh_session');
    } catch {
      // ignore
    }
    setOfficerSession(null);
    setAppState('auth');
  };

  const handleLockScreen = () => {
    setIsLocked(true);
    setUnlockPin('');
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLocked(false);
  };

  // Drawer & Modal States
  const [selectedFacility, setSelectedFacility] = useState<RegionalFacilityOverview | null>(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isScheduleAuditModalOpen, setIsScheduleAuditModalOpen] = useState(false);

  // Facility Status Update
  const handleUpdateFacilityStatus = (
    facilityId: string, 
    newStatus: RegionalFacilityOverview['emergencyStatus']
  ) => {
    setFacilities((prev) =>
      prev.map((f) => (f.facilityId === facilityId ? { ...f, emergencyStatus: newStatus } : f))
    );
    if (selectedFacility && selectedFacility.facilityId === facilityId) {
      setSelectedFacility((prev) => prev ? { ...prev, emergencyStatus: newStatus } : null);
    }
  };

  // Containment Protocol Toggle
  const handleToggleAlertProtocol = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.alertId === alertId
          ? { ...a, containmentProtocolActive: !a.containmentProtocolActive }
          : a
      )
    );
  };

  // Audit Status Update
  const handleUpdateAuditStatus = (
    auditId: string, 
    status: RegulatoryComplianceAudit['status']
  ) => {
    setAudits((prev) =>
      prev.map((aud) => (aud.auditId === auditId ? { ...aud, status } : aud))
    );
  };

  // Directive Status Update
  const handleUpdateDirectiveStatus = (
    directiveId: string, 
    newStatus: RegulatoryDirective['status']
  ) => {
    setDirectives((prev) =>
      prev.map((dir) => (dir.directiveId === directiveId ? { ...dir, status: newStatus } : dir))
    );
  };

  // Broadcast New Directive
  const handleBroadcastDirective = (newDirective: RegulatoryDirective) => {
    setDirectives((prev) => [newDirective, ...prev]);
    setActiveTab('directives');
  };

  // Schedule New Audit
  const handleScheduleAudit = (newAudit: RegulatoryComplianceAudit) => {
    setAudits((prev) => [newAudit, ...prev]);
    setActiveTab('licensing');
  };


  const handleGenerateBriefing = () => {
    pushNotification(
      'Surveillance Briefing',
      'Cryptographic MOH National Surveillance Briefing queued. Signed JSON + PDF package prepared for commissioner review.',
      'success'
    );
  };

  const handleShowAlerts = () => {
    const lines = alerts.slice(0, 5).map((a, i) => `${i + 1}. ${a.condition} (${a.severity}) — ${a.detectedCases} cases`);
    pushNotification(
      `${alerts.length} Active Surveillance Alerts`,
      lines.join(' · ') || 'No active alerts',
      'alert'
    );
    setActiveTab('epidemiology');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [liveClock, setLiveClock] = useState(() =>
    new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setLiveClock(
        new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) return;
    const ql = q.toLowerCase();
    const fac = facilities.find((f) => f.facilityName.toLowerCase().includes(ql) || f.facilityId.toLowerCase().includes(ql));
    if (fac) {
      setSelectedFacility(fac);
      setActiveTab('facilities');
      pushNotification('Search', `Opened facility: ${fac.facilityName}`, 'info');
      return;
    }
    const al = alerts.find((a) => a.condition.toLowerCase().includes(ql) || a.alertId.toLowerCase().includes(ql));
    if (al) {
      setActiveTab('epidemiology');
      pushNotification('Search', `Matched alert: ${al.condition}`, 'alert');
      return;
    }
    pushNotification('Search', `No match for "${q}"`, 'info');
  };


  if (appState === 'splash') {
    return <MOHSplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'auth') {
    return <MOHAuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="admin-layout-v2">
      {/* Lock Screen Modal */}
      {isLocked && (
        <div className="modal-backdrop" style={{ zIndex: 99999 }}>
          <div className="modal-window" style={{ maxWidth: 400, textAlign: 'center', padding: 30 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(217, 119, 6, 0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Lock size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', color: '#FFF' }}>Ministerial Terminal Locked</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.82rem', color: '#94A3B8' }}>
              Authorized Officer: <strong style={{ color: '#FBBF24' }}>{officerSession?.name}</strong>. Enter ministerial PIN to resume.
            </p>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                className="modal-input"
                placeholder="••••"
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.2rem', marginBottom: 16 }}
              />
              <button type="submit" className="btn-primary-gold" style={{ width: '100%', justifyContent: 'center' }}>
                <Unlock size={16} />
                <span>Unlock Terminal</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Executive Command Topbar matching dash.png */}
      <AdminTopBar
        officerSession={officerSession}
        onLockScreen={handleLockScreen}
        onLogout={handleLogout}
        onSearch={handleSearch}
        onShowAlerts={handleShowAlerts}
        alertCount={alerts.length}
        liveClock={liveClock}
      />

      {/* Main Two-Column Frame: Sidebar + Canvas matching dash.png */}
      <div className="dash-workspace-frame">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
        />

        <main className="dash-main-scroll-canvas">
          {activeTab === 'hud' && (
            <NationalCommandHud
              facilities={facilities}
              alerts={alerts}
              audits={audits}
              directives={directives}
              onSelectFacility={setSelectedFacility}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === 'vital-stats' && (
            <VitalStatisticsView />
          )}

          {activeTab === 'financial' && (
            <FinancialRevenueView />
          )}

          {activeTab === 'security' && (
            <SecurityAuditLedgerView />
          )}

          {activeTab === 'facilities' && (
            <FacilityRegistryView
              registry={facilityRegistry}
              onIssueCredentials={handleIssueCredentials}
              onSimulateActivation={handleSimulateActivation}
              selectedRegion={selectedRegion}
            />
          )}

          {activeTab === 'epidemiology' && (
            <EpidemiologicalRadarView
              alerts={alerts}
              onToggleProtocol={handleToggleAlertProtocol}
              onOpenBroadcastModal={() => setIsBroadcastModalOpen(true)}
            />
          )}

          {activeTab === 'licensing' && (
            <LicensingAccreditationView
              facilities={facilities}
              audits={audits}
              onOpenScheduleAuditModal={() => setIsScheduleAuditModalOpen(true)}
              onUpdateAuditStatus={handleUpdateAuditStatus}
            />
          )}

          {activeTab === 'workforce' && (
            <WorkforceSurveillanceView />
          )}

          {activeTab === 'directives' && (
            <DirectivesEnforcementView
              directives={directives}
              onOpenBroadcastModal={() => setIsBroadcastModalOpen(true)}
              onUpdateDirectiveStatus={handleUpdateDirectiveStatus}
            />
          )}

          {activeTab === 'ai' && (
            <M87AIAssistantView
              facilityRegistry={facilityRegistry}
              onIssueCredentials={handleIssueCredentials}
              onIssueCredentialsBulk={handleIssueCredentialsBulk}
              onSimulateActivation={handleSimulateActivation}
            />
          )}
        </main>
      </div>

      {/* Notification toasts — facility activation & credential events */}
      {notifications.length > 0 && (
        <div className="moh-notification-stack">
          {notifications.slice(0, 3).map((n) => (
            <div key={n.id} className={`moh-notification moh-notification--${n.type}`}>
              <div className="moh-notification-icon">
                {n.type === 'success' ? <Wifi size={16} /> : <Lock size={16} />}
              </div>
              <div className="moh-notification-body">
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </div>
              <button
                type="button"
                className="moh-notification-close"
                onClick={() => setNotifications((prev) => prev.filter((x) => x.id !== n.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Slide-out Hospital Telemetry Detail Drawer */}
      <FacilityDetailDrawer
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        onUpdateStatus={handleUpdateFacilityStatus}
      />

      {/* Modal: Broadcast Official Directive */}
      <BroadcastDirectiveModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        onBroadcast={handleBroadcastDirective}
      />

      {/* Modal: Schedule Regulatory Audit */}
      <ScheduleAuditModal
        isOpen={isScheduleAuditModalOpen}
        onClose={() => setIsScheduleAuditModalOpen(false)}
        facilities={facilities}
        onScheduleAudit={handleScheduleAudit}
      />
    </div>
  );
}
