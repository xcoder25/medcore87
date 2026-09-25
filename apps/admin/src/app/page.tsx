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
import { HospitalAdminHeader } from '../components/HospitalAdminHeader';
import { HospitalAdminSidebar, HospitalAdminTab } from '../components/HospitalAdminSidebar';
import { HospitalAdminDashboard } from '../components/HospitalAdminDashboard';
import { AdminCommandPalette } from '../components/AdminCommandPalette';
import { AdminNotificationsDrawer, AdminNotification } from '../components/AdminNotificationsDrawer';
import { 
  TransferReviewDrawer, 
  AccessReviewDrawer, 
  ComplianceDrawer, 
  StaffDirectoryDrawer,
  QuickAddStaffModal,
  QuickTransferModal,
  QuickCreateRosterModal,
  QuickIncidentModal,
  QuickAssignBedModal
} from '../components/AdminModals';
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
import { Lock, Unlock, X, Wifi, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  const [officerSession, setOfficerSession] = useState<MOHOfficerSession | null>(DEFAULT_COMMISSIONER_SESSION);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');

  // Hospital Administrator Workspace State
  const [currentFacility, setCurrentFacility] = useState('Immanuel General Hospital, Eket');
  const [adminTab, setAdminTab] = useState<HospitalAdminTab>('dashboard');

  // Interactive Drawers & Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [isTransferReviewOpen, setIsTransferReviewOpen] = useState(false);
  const [isAccessReviewOpen, setIsAccessReviewOpen] = useState(false);
  const [isComplianceDrawerOpen, setIsComplianceDrawerOpen] = useState(false);
  const [isStaffDirectoryOpen, setIsStaffDirectoryOpen] = useState(false);

  // Quick Action Modals
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isNewTransferModalOpen, setIsNewTransferModalOpen] = useState(false);
  const [isCreateRosterModalOpen, setIsCreateRosterModalOpen] = useState(false);
  const [isReportIncidentModalOpen, setIsReportIncidentModalOpen] = useState(false);
  const [isAssignBedModalOpen, setIsAssignBedModalOpen] = useState(false);

  // Real-time Action Feedback Toasts (UX Rule 15)
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'alert' }[]>([]);
  const triggerToast = (text: string, type: 'success' | 'alert' = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Transfer record state
  const [transferData, setTransferData] = useState({
    id: '1024',
    staffName: 'Dr. Fatima Al-Hassan',
    role: 'Senior Consultant Obstetrician & Gynecologist',
    sourceHospital: 'Lagos University Teaching Hospital (LUTH)',
    targetHospital: 'University College Hospital (UCH)',
    date: '2026-10-01',
    status: 'Pending' as 'Pending' | 'Completed' | 'Rejected',
    reason: 'Critical specialist deficit surge support in Maternal & High-Risk Obstetric Ward.',
    urgency: 'High (Deficit Response)'
  });

  // Admin notifications (UX Rule 12)
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([
    {
      id: 'ntf-1',
      type: 'action_required',
      title: 'Transfer #1024 Awaiting Approval',
      description: 'Dr. Fatima Al-Hassan transfer request submitted from LUTH to UCH requires sign-off.',
      time: '8 min ago',
      read: false,
      actionLabel: 'Review Transfer',
      actionHandler: () => setIsTransferReviewOpen(true),
    },
    {
      id: 'ntf-2',
      type: 'alert',
      title: '3 Pending Access Requests',
      description: 'Nurse Chidinma Eze and 2 others requested elevated clinical role clearance.',
      time: '14 min ago',
      read: false,
      actionLabel: 'Review Requests',
      actionHandler: () => setIsAccessReviewOpen(true),
    },
    {
      id: 'ntf-3',
      type: 'alert',
      title: 'Pharmacy Cold-Chain Document Expiring',
      description: 'Statutory cold-chain temperature verification expires in 7 days.',
      time: '21 min ago',
      read: false,
      actionLabel: 'Open Compliance',
      actionHandler: () => setIsComplianceDrawerOpen(true),
    },
    {
      id: 'ntf-4',
      type: 'info',
      title: 'Ward B Roster Updated',
      description: 'James Bassey published shift allocations for Ward B night rotation.',
      time: '1 hour ago',
      read: true,
    },
    {
      id: 'ntf-5',
      type: 'success',
      title: 'Telemetry Gateway Synchronized',
      description: 'Real-time telemetry stream online with 87 active staff and 64 logged in.',
      time: '2 hours ago',
      read: true,
    },
  ]);

  const handleApproveTransfer = (id: string, staffName: string) => {
    setTransferData(prev => ({ ...prev, status: 'Completed' }));
    triggerToast(`✓ Transfer approved: ${staffName} has been moved to ${transferData.targetHospital}.`, 'success');
    setIsTransferReviewOpen(false);
  };

  const handleRejectTransfer = (id: string, staffName: string) => {
    setTransferData(prev => ({ ...prev, status: 'Rejected' }));
    triggerToast(`Transfer #${id} for ${staffName} declined. Notice sent to medical director.`, 'alert');
    setIsTransferReviewOpen(false);
  };

  const handleGrantAccess = (id: string, user: string, role: string) => {
    triggerToast(`✓ Access granted: ${user} assigned role "${role}".`, 'success');
  };

  const handleRevokeAccess = (id: string, user: string) => {
    triggerToast(`Access request denied for ${user}. Security audit ledger updated.`, 'alert');
  };

  const handleAddStaffSubmit = (staff: { name: string; role: string; dept: string; license: string }) => {
    triggerToast(`✓ Staff member added: ${staff.name} registered into ${staff.dept}.`, 'success');
  };

  const handleQuickTransferSubmit = (transfer: { staffName: string; from: string; to: string; date: string }) => {
    triggerToast(`✓ New staff transfer dispatched for ${transfer.staffName}.`, 'success');
  };

  const handleCreateRosterSubmit = (roster: { dept: string; period: string; coordinator: string }) => {
    triggerToast(`✓ ${roster.period} published for ${roster.dept} by ${roster.coordinator}.`, 'success');
  };

  const handleReportIncidentSubmit = (incident: { title: string; severity: string; details: string }) => {
    triggerToast(`⚠ Operational incident logged: "${incident.title}" (${incident.severity}).`, 'alert');
  };

  const handleAssignBedSubmit = (assignment: { ward: string; bed: string; patient: string }) => {
    triggerToast(`✓ Bed allocated: ${assignment.bed} in ${assignment.ward} for ${assignment.patient}.`, 'success');
  };

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
    setAppState('app');
    if (!officerSession) setOfficerSession(DEFAULT_COMMISSIONER_SESSION);
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
    setAdminTab('compliance');
  };

  // Schedule New Audit
  const handleScheduleAudit = (newAudit: RegulatoryComplianceAudit) => {
    setAudits((prev) => [newAudit, ...prev]);
    setAdminTab('compliance');
  };

  if (appState === 'splash') {
    return <MOHSplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'auth') {
    return <MOHAuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="ha-app-container">
      {/* Lock Screen Modal */}
      {isLocked && (
        <div className="ha-modal-backdrop" style={{ zIndex: 99999 }}>
          <div className="ha-modal-window" style={{ maxWidth: 400, textAlign: 'center', padding: 30 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(217, 119, 6, 0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Lock size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', color: '#FFF' }}>Administrative Terminal Locked</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.82rem', color: '#94A3B8' }}>
              Authorized Officer: <strong style={{ color: '#38BDF8' }}>{officerSession?.name || 'Administrator'}</strong>. Enter PIN to resume.
            </p>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                placeholder="••••"
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#FFF',
                  textAlign: 'center',
                  letterSpacing: '0.3em',
                  fontSize: '1.2rem',
                  marginBottom: 16,
                  outline: 'none'
                }}
              />
              <button type="submit" className="ha-action-pill-btn primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Unlock size={16} />
                <span>Unlock Terminal</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar matching mockup */}
      <HospitalAdminSidebar
        activeTab={adminTab}
        onTabChange={setAdminTab}
        currentFacility={currentFacility}
        onOpenProfile={() => setIsNotificationsDrawerOpen(true)}
      />

      {/* Main Viewport */}
      <div className="ha-main-viewport">
        {/* Topbar matching mockup */}
        <HospitalAdminHeader
          currentFacility={currentFacility}
          onFacilityChange={setCurrentFacility}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
          unreadNotificationsCount={adminNotifications.filter(n => !n.read).length}
          onLockScreen={handleLockScreen}
          onLogout={handleLogout}
          administratorName="Admin"
        />

        {/* Content Canvas */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {adminTab === 'dashboard' && (
            <HospitalAdminDashboard
              onNavigateToTab={(t) => setAdminTab(t)}
              onOpenTransferReview={() => setIsTransferReviewOpen(true)}
              onOpenAccessReview={() => setIsAccessReviewOpen(true)}
              onOpenComplianceDrawer={() => setIsComplianceDrawerOpen(true)}
              onOpenStaffDrawer={() => setIsStaffDirectoryOpen(true)}
              onOpenNewTransferModal={() => setIsNewTransferModalOpen(true)}
              onOpenAddStaffModal={() => setIsAddStaffModalOpen(true)}
              onOpenCreateRosterModal={() => setIsCreateRosterModalOpen(true)}
              onOpenReportIncidentModal={() => setIsReportIncidentModalOpen(true)}
              onOpenAssignBedModal={() => setIsAssignBedModalOpen(true)}
              showToast={triggerToast}
              facilityName={currentFacility}
            />
          )}

          {adminTab === 'transfers' && (
            <div style={{ padding: '24px 28px' }}>
              <WorkforceSurveillanceView />
            </div>
          )}

          {adminTab === 'staffing' && (
            <div style={{ padding: '24px 28px' }}>
              <WorkforceSurveillanceView />
            </div>
          )}

          {(adminTab === 'hospital-management' || adminTab === 'facilities') && (
            <div style={{ padding: '24px 28px' }}>
              <FacilityRegistryView
                registry={facilityRegistry}
                onIssueCredentials={handleIssueCredentials}
                onSimulateActivation={handleSimulateActivation}
                selectedRegion={selectedRegion}
              />
            </div>
          )}

          {adminTab === 'command-centre' && (
            <div style={{ padding: '24px 28px' }}>
              <NationalCommandHud
                facilities={facilities}
                alerts={alerts}
                audits={audits}
                directives={directives}
                onSelectFacility={setSelectedFacility}
                onNavigateToTab={(t) => {
                  if (t === 'hud') setAdminTab('command-centre');
                  else setAdminTab(t);
                }}
              />
            </div>
          )}

          {adminTab === 'bed-occupancy' && (
            <div style={{ padding: '24px 28px' }}>
              <FacilitySurveillanceView
                facilities={facilities}
                selectedRegion={selectedRegion}
                onSelectFacility={setSelectedFacility}
              />
            </div>
          )}

          {adminTab === 'patient-flow' && (
            <div style={{ padding: '24px 28px' }}>
              <VitalStatisticsView />
            </div>
          )}

          {adminTab === 'ambulance' && (
            <div style={{ padding: '24px 28px' }}>
              <EpidemiologicalRadarView
                alerts={alerts}
                onToggleProtocol={handleToggleAlertProtocol}
                onOpenBroadcastModal={() => setIsBroadcastModalOpen(true)}
              />
            </div>
          )}

          {adminTab === 'access-control' && (
            <div style={{ padding: '24px 28px' }}>
              <SecurityAuditLedgerView />
            </div>
          )}

          {adminTab === 'compliance' && (
            <div style={{ padding: '24px 28px' }}>
              <LicensingAccreditationView
                facilities={facilities}
                audits={audits}
                onOpenScheduleAuditModal={() => setIsScheduleAuditModalOpen(true)}
                onUpdateAuditStatus={handleUpdateAuditStatus}
              />
            </div>
          )}
        </div>
      </div>

      {/* ⌘K Global Command Palette (UX Rule 7) */}
      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(page) => {
          if (page === 'dashboard') setAdminTab('dashboard');
          else if (page === 'transfers') setAdminTab('transfers');
          else if (page === 'staffing') setAdminTab('staffing');
          else if (page === 'access-control') setAdminTab('access-control');
          else if (page === 'facilities') setAdminTab('facilities');
          else if (page === 'compliance') setAdminTab('compliance');
          else if (page === 'command-centre') setAdminTab('command-centre');
        }}
        onOpenTransferReview={() => setIsTransferReviewOpen(true)}
        onOpenStaffDetail={() => setIsStaffDirectoryOpen(true)}
      />

      {/* Notifications Drawer (UX Rule 12) */}
      <AdminNotificationsDrawer
        isOpen={isNotificationsDrawerOpen}
        onClose={() => setIsNotificationsDrawerOpen(false)}
        notifications={adminNotifications}
        onMarkAllAsRead={() => {
          setAdminNotifications(prev => prev.map(n => ({ ...n, read: true })));
          triggerToast('All notifications marked as read', 'success');
        }}
        onClearNotification={(id) => {
          setAdminNotifications(prev => prev.filter(n => n.id !== id));
        }}
      />

      {/* Progressive Disclosure Drawers (UX Rules 4 & 5) */}
      <TransferReviewDrawer
        isOpen={isTransferReviewOpen}
        onClose={() => setIsTransferReviewOpen(false)}
        transferData={transferData}
        onApprove={handleApproveTransfer}
        onReject={handleRejectTransfer}
      />

      <AccessReviewDrawer
        isOpen={isAccessReviewOpen}
        onClose={() => setIsAccessReviewOpen(false)}
        onGrantAccess={handleGrantAccess}
        onRevokeAccess={handleRevokeAccess}
      />

      <ComplianceDrawer
        isOpen={isComplianceDrawerOpen}
        onClose={() => setIsComplianceDrawerOpen(false)}
        onScheduleAudit={() => {
          setIsComplianceDrawerOpen(false);
          setIsScheduleAuditModalOpen(true);
        }}
      />

      <StaffDirectoryDrawer
        isOpen={isStaffDirectoryOpen}
        onClose={() => setIsStaffDirectoryOpen(false)}
        onAddStaff={() => {
          setIsStaffDirectoryOpen(false);
          setIsAddStaffModalOpen(true);
        }}
      />

      {/* Quick Action Modals (UX Rule 8) */}
      <QuickAddStaffModal
        isOpen={isAddStaffModalOpen}
        onClose={() => setIsAddStaffModalOpen(false)}
        onSubmit={handleAddStaffSubmit}
      />

      <QuickTransferModal
        isOpen={isNewTransferModalOpen}
        onClose={() => setIsNewTransferModalOpen(false)}
        onSubmit={handleQuickTransferSubmit}
      />

      <QuickCreateRosterModal
        isOpen={isCreateRosterModalOpen}
        onClose={() => setIsCreateRosterModalOpen(false)}
        onSubmit={handleCreateRosterSubmit}
      />

      <QuickIncidentModal
        isOpen={isReportIncidentModalOpen}
        onClose={() => setIsReportIncidentModalOpen(false)}
        onSubmit={handleReportIncidentSubmit}
      />

      <QuickAssignBedModal
        isOpen={isAssignBedModalOpen}
        onClose={() => setIsAssignBedModalOpen(false)}
        onSubmit={handleAssignBedSubmit}
      />

      {/* Real-time Action Feedback Toasts (UX Rule 15) */}
      {toasts.length > 0 && (
        <div className="ha-toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`ha-toast ${toast.type}`}>
              {toast.type === 'success' ? (
                <CheckCircle2 size={16} color="#10B981" />
              ) : (
                <AlertTriangle size={16} color="#EF4444" />
              )}
              <span>{toast.text}</span>
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
