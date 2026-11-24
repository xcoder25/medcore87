'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  MessageSquareWarning,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { SENATORIAL_DISTRICTS } from '../../data/akwaIbomFacilities';
import {
  broadcastMohDirective,
  createEnforcementAction,
  createHrhRecruitment,
  createIdsrReport,
  createOrToggleMohAlert,
  createMohTransfer,
  registerPrivateFacility,
  saveSupplyEquipment,
  scheduleMohAudit,
  submitCitizenGrievance,
  updateCitizenGrievance,
  updateEnforcementAction,
  updateHrhRecruitment,
  updateIdsrReport,
  updateMohAuditStatus,
  updateMohDirectiveStatus,
  updateMohFacilityOversight,
  updateMohTransferStatus,
  updateSupplyEquipment,
  useMohSync,
} from '../../lib/mohRealtime';
import type {
  MohAuditRecord,
  MohDirective,
  MohFacilityTelemetry,
  MohTabKey,
  MohTransferRecord,
} from '../../lib/mohTypes';
import { MASTER_ADMIN_PASSWORDS, type MOHOfficerSession } from '../MOHAuthScreen';
import {
  BroadcastDirectiveModal,
  CreateAlertModal,
  CreateTransferModal,
  ScheduleAuditModal,
} from './MohActionModals';
import { MohAuditLedgerView } from './MohAuditLedgerView';
import { MohDirectivesComplianceView } from './MohDirectivesComplianceView';
import { MohFacilitiesView } from './MohFacilitiesView';
import { MohFacilityDossierView } from './MohFacilityDossierView';
import { MohFacilityDrawer } from './MohFacilityDrawer';
import { MohFinanceView } from './MohFinanceView';
import { MohGrievancesView } from './MohGrievancesView';
import { MohIntelligenceView } from './MohIntelligenceView';
import { MohOverviewView } from './MohOverviewView';
import { MohSupplyInfraView } from './MohSupplyInfraView';
import { MohSurveillanceView } from './MohSurveillanceView';
import { MohWorkforceView } from './MohWorkforceView';

interface MohShellProps {
  session: MOHOfficerSession;
  isLocked: boolean;
  onLockTerminal: () => void;
  onUnlockTerminal: () => void;
  onLogout: () => void;
}

const VALID_OFFICER_CODES = new Set<string>([
  ...MASTER_ADMIN_PASSWORDS,
  'AKSG-MOH-2026',
  'PUBHLTH-012',
  'HMB-004-SEC',
  'MEDSERV-029',
  '9942',
]);

function formatSyncHm(iso: string | null): string {
  if (!iso) return 'Syncing';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Now';
  }
}

export const MohShell: React.FC<MohShellProps> = ({
  session,
  isLocked,
  onLockTerminal,
  onUnlockTerminal,
  onLogout,
}) => {
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<MohTabKey>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [dossierFacilityId, setDossierFacilityId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditPresetFacId, setAuditPresetFacId] = useState<string | undefined>(undefined);
  const [transferOpen, setTransferOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'error' }[]>([]);
  const notifyToast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = `moh-toast-${Date.now()}-${Math.floor(text.length * 17)}`;
    setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const { snapshot, loading, refreshing, error, lastSyncedAt, syncMode, refreshNow } =
    useMohSync(districtFilter);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setUserMenuOpen(false);
        setNotifOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isLocked) {
      setUnlockPin('');
      setUnlockError('');
    }
  }, [isLocked]);

  const selectedFacility: MohFacilityTelemetry | null = useMemo(() => {
    if (!selectedFacilityId || !snapshot) return null;
    return snapshot.facilities.find((f) => f.facilityId === selectedFacilityId) || null;
  }, [selectedFacilityId, snapshot]);

  const attentionList = useMemo(() => {
    if (!snapshot) return [];
    const items: {
      id: string;
      severity: 'danger' | 'amber';
      title: string;
      detail: string;
      onOpen: () => void;
    }[] = [];

    for (const fac of snapshot.facilities) {
      if (fac.emergencyStatus !== 'normal') {
        items.push({
          id: `surge-${fac.facilityId}`,
          severity:
            fac.emergencyStatus === 'surge_code_red' || fac.emergencyStatus === 'critical'
              ? 'danger'
              : 'amber',
          title: `${fac.facilityName} · ${fac.emergencyStatus.replace(/_/g, ' ').toUpperCase()}`,
          detail: `${fac.occupiedBeds}/${fac.totalBeds} beds · ICU ${fac.icuBedsOccupied}/${fac.icuBedsTotal}`,
          onOpen: () => {
            setSelectedFacilityId(fac.facilityId);
            setNotifOpen(false);
          },
        });
      }
    }

    for (const tr of snapshot.transfers.filter((t) => t.status === 'pending')) {
      items.push({
        id: `tr-${tr.id}`,
        severity: tr.urgency === 'immediate_code_red' ? 'danger' : 'amber',
        title: `Pending transfer: ${tr.staffName}`,
        detail: `${tr.fromFacilityName} → ${tr.toFacilityName}`,
        onOpen: () => {
          setActiveTab('workforce');
          setNotifOpen(false);
        },
      });
    }

    for (const aud of snapshot.audits.filter((a) => a.status === 'remediation_required')) {
      items.push({
        id: `aud-${aud.id}`,
        severity: 'amber',
        title: `Audit remediation: ${aud.facilityName}`,
        detail: `${aud.findingsCount} finding(s) · Due ${aud.resolutionDeadline || 'Pending'}`,
        onOpen: () => {
          setActiveTab('directives');
          setNotifOpen(false);
        },
      });
    }

    for (const al of snapshot.surveillance.alerts.filter((a) => a.containmentActive)) {
      items.push({
        id: `al-${al.id}`,
        severity: al.severity === 'emergency' ? 'danger' : 'amber',
        title: `Surveillance alert: ${al.condition}`,
        detail: `${al.detectedCases} case(s) · ${al.affectedDistricts.join(', ')}`,
        onOpen: () => {
          setActiveTab('surveillance');
          setNotifOpen(false);
        },
      });
    }

    if (snapshot.supplyChain.stockOutCount > 0) {
      items.push({
        id: 'supply-stockout',
        severity: 'danger',
        title: `${snapshot.supplyChain.stockOutCount} Essential Stock-Out(s)`,
        detail: `${snapshot.supplyChain.lowStockCount} low-stock · ${snapshot.supplyChain.faultyEquipmentCount} faulty equipment`,
        onOpen: () => {
          setActiveTab('supply');
          setNotifOpen(false);
        },
      });
    }

    if (snapshot.grievances.openCount > 0) {
      items.push({
        id: 'grievances-open',
        severity: 'amber',
        title: `${snapshot.grievances.openCount} Open Citizen Grievance(s)`,
        detail: `${snapshot.grievances.investigatingCount} under active review`,
        onOpen: () => {
          setActiveTab('grievances');
          setNotifOpen(false);
        },
      });
    }

    return items;
  }, [snapshot]);

  const navGroups: {
    label: string;
    items: {
      key: MohTabKey;
      label: string;
      icon: React.ComponentType<{ size?: number }>;
      badge?: number;
      badgeTone?: 'warn' | 'alert';
    }[];
  }[] = useMemo(() => {
    const sum = snapshot?.summary;
    const surveillanceCount =
      (sum?.activeAlertsCount || 0) +
      (sum?.surgeFacilitiesCount || 0) +
      (snapshot?.idsr.dsnoReports.filter((r) => r.status !== 'contained').length || 0);
    const supplyAlerts =
      (snapshot?.supplyChain.stockOutCount || 0) + (snapshot?.supplyChain.faultyEquipmentCount || 0);
    const openGrievances = snapshot?.grievances.openCount || 0;
    return [
      {
        label: 'Command',
        items: [
          { key: 'overview', label: 'Executive Overview', icon: LayoutGrid },
          {
            key: 'facilities',
            label: 'Facility Registry',
            icon: Building2,
            badge: sum?.connectedFacilities,
          },
          {
            key: 'surveillance',
            label: 'Surveillance & IDSR',
            icon: Activity,
            badge: surveillanceCount > 0 ? surveillanceCount : undefined,
            badgeTone: 'alert',
          },
        ],
      },
      {
        label: 'Operations',
        items: [
          {
            key: 'workforce',
            label: 'HRH & Transfers',
            icon: Users,
            badge: sum && sum.pendingTransfersCount > 0 ? sum.pendingTransfersCount : undefined,
            badgeTone: 'warn',
          },
          {
            key: 'supply',
            label: 'Supply & Equipment',
            icon: Package,
            badge: supplyAlerts > 0 ? supplyAlerts : undefined,
            badgeTone: 'warn',
          },
          { key: 'finance', label: 'Public Health Finance', icon: Wallet },
          {
            key: 'directives',
            label: 'Compliance & Enforcement',
            icon: Send,
            badge: sum && sum.openRemediationsCount > 0 ? sum.openRemediationsCount : undefined,
            badgeTone: 'warn',
          },
        ],
      },
      {
        label: 'Governance',
        items: [
          {
            key: 'grievances',
            label: 'Citizen Feedback',
            icon: MessageSquareWarning,
            badge: openGrievances > 0 ? openGrievances : undefined,
            badgeTone: 'alert',
          },
          { key: 'audit', label: 'Audit Ledger & Privacy', icon: ShieldCheck },
          { key: 'intelligence', label: 'Celestia MOH AI', icon: Sparkles },
        ],
      },
    ];
  }, [snapshot]);

  const cmdMatches = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    const tabs = navGroups.flatMap((g) => g.items);
    const matchingTabs = tabs.filter(
      (t) => !q || t.label.toLowerCase().includes(q) || t.key.includes(q)
    );
    const matchingHospitals = (snapshot?.facilities || [])
      .filter(
        (f) =>
          !q ||
          f.facilityName.toLowerCase().includes(q) ||
          f.facilityId.toLowerCase().includes(q) ||
          f.lga.toLowerCase().includes(q)
      )
      .slice(0, 8);
    return { matchingTabs, matchingHospitals };
  }, [cmdQuery, navGroups, snapshot?.facilities]);

  const handleBroadcastSubmit = async (payload: Parameters<typeof broadcastMohDirective>[0]) => {
    const res = await broadcastMohDirective(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not broadcast directive.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Directive ${res.data?.directive?.code || ''} broadcast to hospitals.`);
    await refreshNow();
  };

  const handleUpdateDirectiveStatus = async (id: string, status: MohDirective['status']) => {
    const res = await updateMohDirectiveStatus(id, status);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update directive status.', 'error');
      return;
    }
    notifyToast(`Directive marked ${status}.`);
    await refreshNow();
  };

  const handleScheduleAuditSubmit = async (payload: Parameters<typeof scheduleMohAudit>[0]) => {
    const res = await scheduleMohAudit(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not schedule inspection.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Inspection scheduled for ${payload.facilityName}.`);
    await refreshNow();
  };

  const handleUpdateAuditStatus = async (
    id: string,
    patch: Partial<Pick<MohAuditRecord, 'status' | 'findingsCount' | 'criticalViolations' | 'notes'>>
  ) => {
    const res = await updateMohAuditStatus(id, patch);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update inspection status.', 'error');
      return;
    }
    notifyToast('Inspection outcome saved.');
    await refreshNow();
  };

  const handleCreateTransferSubmit = async (payload: Parameters<typeof createMohTransfer>[0]) => {
    const res = await createMohTransfer(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not create transfer order.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Transfer order created for ${payload.staffName}.`);
    await refreshNow();
  };

  const handleDecideTransfer = async (id: string, status: MohTransferRecord['status']) => {
    const res = await updateMohTransferStatus(id, status, session.name);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update transfer status.', 'error');
      return;
    }
    notifyToast(`Transfer order marked ${status}.`);
    await refreshNow();
  };

  const handleUpdateOversight = async (payload: {
    facilityId: string;
    emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
    accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
    notes: string;
  }) => {
    const res = await updateMohFacilityOversight({
      ...payload,
      updatedBy: session.name,
    });
    if (!res.ok) {
      notifyToast(res.error || 'Could not update facility posture.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Oversight updated for ${payload.facilityId}.`);
    await refreshNow();
  };

  const handleCreateAlertSubmit = async (payload: {
    condition: string;
    icd10Category: string;
    detectedCases: number;
    rateOfIncrease: number;
    affectedDistricts: string[];
    severity: 'advisory' | 'warning' | 'emergency';
    reportingFacilities: number;
    notes: string;
  }) => {
    const res = await createOrToggleMohAlert(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not issue surveillance bulletin.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Surveillance bulletin issued: ${payload.condition}.`);
    await refreshNow();
  };

  const handleToggleContainment = async (alertId: string) => {
    const res = await createOrToggleMohAlert({ id: alertId, toggleContainment: true });
    if (!res.ok) {
      notifyToast(res.error || 'Could not toggle containment status.', 'error');
      return;
    }
    notifyToast('Surveillance containment posture updated.');
    await refreshNow();
  };

  const handleRegisterPrivateFacility = async (payload: Parameters<typeof registerPrivateFacility>[0]) => {
    const res = await registerPrivateFacility(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not register private facility.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Registered ${payload.facilityName} on the state GIS registry.`);
    await refreshNow();
  };

  const handleCreateEnforcement = async (payload: Parameters<typeof createEnforcementAction>[0]) => {
    const res = await createEnforcementAction(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not log enforcement action.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Enforcement action logged for ${payload.facilityId}.`);
    await refreshNow();
  };

  const handleUpdateEnforcement = async (payload: Parameters<typeof updateEnforcementAction>[0]) => {
    const res = await updateEnforcementAction(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update enforcement action.', 'error');
      return;
    }
    notifyToast(payload.unsealFacility ? 'Facility verified and seal lifted.' : 'Enforcement action updated.');
    await refreshNow();
  };

  const handleCreateRecruitment = async (payload: Parameters<typeof createHrhRecruitment>[0]) => {
    const res = await createHrhRecruitment(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not publish recruitment vacancy.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Published vacancy: ${payload.title}.`);
    await refreshNow();
  };

  const handleUpdateRecruitment = async (payload: Parameters<typeof updateHrhRecruitment>[0]) => {
    const res = await updateHrhRecruitment(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update recruitment status.', 'error');
      return;
    }
    notifyToast('Recruitment pipeline stage updated.');
    await refreshNow();
  };

  const handleSaveSupplyEquipment = async (payload: Parameters<typeof saveSupplyEquipment>[0]) => {
    const res = await saveSupplyEquipment(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not save supply/equipment item.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Saved ${payload.itemName} inventory record.`);
    await refreshNow();
  };

  const handleUpdateSupplyEquipment = async (payload: Parameters<typeof updateSupplyEquipment>[0]) => {
    const res = await updateSupplyEquipment(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update supply/equipment record.', 'error');
      return;
    }
    notifyToast('Supply & equipment status updated.');
    await refreshNow();
  };

  const handleCreateIdsrReport = async (payload: Parameters<typeof createIdsrReport>[0]) => {
    const res = await createIdsrReport(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not save IDSR/service report.', 'error');
      throw new Error(res.error);
    }
    notifyToast(
      payload.reportKind === 'dsno_outbreak'
        ? `DSNO notification logged for ${payload.disease || payload.lga}.`
        : 'RMNCH & service utilization return recorded.'
    );
    await refreshNow();
  };

  const handleUpdateIdsrReport = async (payload: Parameters<typeof updateIdsrReport>[0]) => {
    const res = await updateIdsrReport(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update IDSR report.', 'error');
      return;
    }
    notifyToast('IDSR surveillance record updated.');
    await refreshNow();
  };

  const handleSubmitGrievance = async (payload: Parameters<typeof submitCitizenGrievance>[0]) => {
    const res = await submitCitizenGrievance(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not log grievance.', 'error');
      throw new Error(res.error);
    }
    notifyToast(`Logged grievance ticket ${res.data?.grievance?.trackingCode || ''}.`);
    await refreshNow();
  };

  const handleUpdateGrievance = async (payload: Parameters<typeof updateCitizenGrievance>[0]) => {
    const res = await updateCitizenGrievance(payload);
    if (!res.ok) {
      notifyToast(res.error || 'Could not update grievance ticket.', 'error');
      return;
    }
    notifyToast(`Grievance marked ${payload.status?.replace(/_/g, ' ') || 'updated'}.`);
    await refreshNow();
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = unlockPin.trim();
    if (!entered) {
      setUnlockError('Enter your Ministry access passcode to unlock.');
      return;
    }
    const isValid =
      VALID_OFFICER_CODES.has(entered) || entered.toUpperCase() === session.badgeId.toUpperCase();
    if (!isValid) {
      setUnlockError('Invalid Ministry passcode. Please verify and try again.');
      return;
    }
    setUnlockPin('');
    setUnlockError('');
    onUnlockTerminal();
  };

  return (
    <div className="moh-shell">
      {/* Left Navigation Sidebar */}
      <aside
        className={`moh-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${
          mobileNavOpen ? 'mobile-open' : ''
        }`}
        aria-label="Ministry Navigation"
      >
        <div className="moh-sidebar-head">
          <div className="moh-brand">
            <div className="moh-brand-crest">
              <img
                src="/ibmlogo.png"
                alt="Akwa Ibom State MOH Crest"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div className="moh-brand-title">Akwa Ibom MOH</div>
                <div className="moh-brand-sub">State Health Command</div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="moh-icon-btn"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className="moh-nav-scroll">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && <div className="moh-nav-group-label">{group.label}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`moh-nav-btn ${active ? 'active' : ''}`}
                      onClick={() => {
                        setDossierFacilityId(null);
                        setActiveTab(item.key);
                        setMobileNavOpen(false);
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon size={17} />
                      {!sidebarCollapsed && (
                        <>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                          {item.badge !== undefined && (
                            <span className={`moh-nav-count ${item.badgeTone || ''}`}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="moh-sidebar-footer">
          <div className="moh-officer-pill">
            <div className="moh-avatar">{session.avatarInitials || 'MH'}</div>
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.79rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session.name}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: '#64748B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session.role}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="moh-main-col">
        {/* Sticky Top Bar (No back button, no seconds clock) */}
        <header className="moh-topbar">
          <div className="moh-topbar-left">
            <button
              type="button"
              className="moh-icon-btn moh-mobile-only"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation menu"
            >
              <Menu size={17} />
            </button>

            <select
              className="moh-select"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              aria-label="Filter dashboard by Senatorial District"
            >
              <option value="all">All Akwa Ibom Districts</option>
              {SENATORIAL_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d} Senatorial District
                </option>
              ))}
            </select>

            <button
              type="button"
              className="moh-cmd-trigger"
              onClick={() => setCmdOpen(true)}
            >
              <Search size={14} />
              <span>Quick jump…</span>
              <span className="moh-kbd">⌘K</span>
            </button>
          </div>

          <div className="moh-topbar-right">
            <div
              className="moh-sync-pill"
              title={
                syncMode === 'live_db'
                  ? 'Connected to shared MedCore OS database'
                  : 'Operating on local facility registry'
              }
            >
              <span className={`moh-sync-dot ${syncMode === 'local_registry' ? 'local' : ''}`} />
              <span>
                {syncMode === 'live_db' ? 'Live DB' : 'Local Registry'} · {formatSyncHm(lastSyncedAt)}
              </span>
            </div>

            <button
              type="button"
              className="moh-icon-btn"
              onClick={() => void refreshNow()}
              disabled={refreshing}
              aria-label="Refresh telemetry"
              title="Refresh telemetry"
            >
              <RefreshCw
                size={15}
                style={refreshing ? { opacity: 0.5 } : undefined}
              />
            </button>

            <button
              type="button"
              className="moh-icon-btn"
              style={{ position: 'relative' }}
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserMenuOpen(false);
              }}
              aria-label="Open ministerial attention alerts"
            >
              <Bell size={16} />
              {attentionList.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 999,
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {attentionList.length}
                </span>
              )}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="moh-btn-outline"
                style={{ padding: '6px 10px', height: 34 }}
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: '#065F46',
                    color: '#FFFFFF',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {session.avatarInitials || 'MH'}
                </span>
                <ChevronDown size={14} />
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 40,
                    width: 220,
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    boxShadow: '0 14px 36px rgba(15,23,42,0.14)',
                    padding: 8,
                    zIndex: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ padding: '6px 8px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
                      {session.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
                      {session.badgeId}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="moh-nav-btn"
                    style={{ padding: '7px 8px', fontSize: '0.8rem' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLockTerminal();
                    }}
                  >
                    <Lock size={14} />
                    <span>Lock Terminal</span>
                  </button>
                  <button
                    type="button"
                    className="moh-nav-btn"
                    style={{ padding: '7px 8px', fontSize: '0.8rem', color: '#DC2626' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="moh-content-wrap">
          {(dossierFacilityId || activeTab !== 'overview') && (
            <div className="moh-back-bar">
              <button
                type="button"
                className="moh-back-btn"
                onClick={() => {
                  if (dossierFacilityId) {
                    setDossierFacilityId(null);
                  } else {
                    setActiveTab('overview');
                  }
                }}
              >
                <ArrowLeft size={14} />
                <span>
                  {dossierFacilityId
                    ? activeTab === 'facilities'
                      ? 'Back to Facility Registry'
                      : 'Back'
                    : 'Back to Overview'}
                </span>
              </button>
            </div>
          )}

          {dossierFacilityId ? (
            <MohFacilityDossierView
              facilityId={dossierFacilityId}
              officerName={session.name}
              onUpdateOversight={handleUpdateOversight}
              onScheduleAudit={(facId) => {
                setAuditPresetFacId(facId);
                setAuditOpen(true);
              }}
              onUpdateAuditStatus={handleUpdateAuditStatus}
              onOpenTransferModal={() => setTransferOpen(true)}
              onDecideTransfer={handleDecideTransfer}
              onUpdateDirectiveStatus={handleUpdateDirectiveStatus}
              onNotify={notifyToast}
            />
          ) : loading && !snapshot ? (
            <div className="moh-panel" style={{ padding: 36, textAlign: 'center', color: '#64748B' }}>
              Synchronizing Akwa Ibom Ministry of Health telemetry…
            </div>
          ) : error && !snapshot ? (
            <div className="moh-panel" style={{ padding: 32, textAlign: 'center' }}>
              <AlertTriangle size={28} color="#DC2626" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
                Could not load Ministry telemetry
              </div>
              <div style={{ fontSize: '0.84rem', color: '#64748B', marginBottom: 14 }}>{error}</div>
              <button type="button" className="moh-btn-primary" onClick={() => void refreshNow()}>
                Retry Synchronization
              </button>
            </div>
          ) : snapshot ? (
            <>
              {activeTab === 'overview' && (
                <MohOverviewView
                  officerName={session.name}
                  jurisdiction={session.jurisdiction}
                  snapshot={snapshot}
                  onBroadcastDirective={() => setBroadcastOpen(true)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onSelectFacility={(fac) => setSelectedFacilityId(fac.facilityId)}
                  onOpenDossier={(fac) => setDossierFacilityId(fac.facilityId)}
                />
              )}

              {activeTab === 'facilities' && (
                <MohFacilitiesView
                  facilities={snapshot.facilities}
                  officerName={session.name}
                  onSelectFacility={(fac) => setDossierFacilityId(fac.facilityId)}
                  onRegisterPrivateFacility={handleRegisterPrivateFacility}
                />
              )}

              {activeTab === 'surveillance' && (
                <MohSurveillanceView
                  snapshot={snapshot}
                  officerName={session.name}
                  onSelectFacility={(fac) => setSelectedFacilityId(fac.facilityId)}
                  onOpenAlertModal={() => setAlertOpen(true)}
                  onToggleContainment={handleToggleContainment}
                  onCreateIdsrReport={handleCreateIdsrReport}
                  onUpdateIdsrReport={handleUpdateIdsrReport}
                />
              )}

              {activeTab === 'workforce' && (
                <MohWorkforceView
                  snapshot={snapshot}
                  officerName={session.name}
                  onOpenTransferModal={() => setTransferOpen(true)}
                  onDecideTransfer={handleDecideTransfer}
                  onCreateRecruitment={handleCreateRecruitment}
                  onUpdateRecruitment={handleUpdateRecruitment}
                />
              )}

              {activeTab === 'supply' && (
                <MohSupplyInfraView
                  snapshot={snapshot}
                  officerName={session.name}
                  onSaveSupplyEquipment={handleSaveSupplyEquipment}
                  onUpdateSupplyEquipment={handleUpdateSupplyEquipment}
                />
              )}

              {activeTab === 'finance' && (
                <MohFinanceView
                  snapshot={snapshot}
                  onSelectFacility={(fac) => setSelectedFacilityId(fac.facilityId)}
                />
              )}

              {activeTab === 'directives' && (
                <MohDirectivesComplianceView
                  snapshot={snapshot}
                  officerName={session.name}
                  onBroadcastDirective={() => setBroadcastOpen(true)}
                  onUpdateDirectiveStatus={handleUpdateDirectiveStatus}
                  onScheduleAudit={(presetId) => {
                    setAuditPresetFacId(presetId);
                    setAuditOpen(true);
                  }}
                  onUpdateAuditStatus={handleUpdateAuditStatus}
                  onSelectFacility={(fac) => setSelectedFacilityId(fac.facilityId)}
                  onCreateEnforcement={handleCreateEnforcement}
                  onUpdateEnforcement={handleUpdateEnforcement}
                />
              )}

              {activeTab === 'grievances' && (
                <MohGrievancesView
                  snapshot={snapshot}
                  officerName={session.name}
                  onSubmitGrievance={handleSubmitGrievance}
                  onUpdateGrievance={handleUpdateGrievance}
                  onNotify={notifyToast}
                />
              )}

              {activeTab === 'audit' && <MohAuditLedgerView snapshot={snapshot} />}

              {activeTab === 'intelligence' && (
                <MohIntelligenceView
                  snapshot={snapshot}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onBroadcastDirective={() => setBroadcastOpen(true)}
                  onScheduleAudit={() => {
                    setAuditPresetFacId(undefined);
                    setAuditOpen(true);
                  }}
                />
              )}
            </>
          ) : null}
        </main>
      </div>

      {/* Facility Oversight Drawer */}
      <MohFacilityDrawer
        facility={selectedFacility}
        onClose={() => setSelectedFacilityId(null)}
        onOpenFullDossier={(facId) => {
          setSelectedFacilityId(null);
          setDossierFacilityId(facId);
        }}
        onUpdateOversight={handleUpdateOversight}
        onScheduleAudit={(facId) => {
          setSelectedFacilityId(null);
          setAuditPresetFacId(facId);
          setAuditOpen(true);
        }}
      />

      {/* Action Modals */}
      <BroadcastDirectiveModal
        isOpen={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        issuedBy={session.name}
        onSubmit={handleBroadcastSubmit}
      />

      <ScheduleAuditModal
        isOpen={auditOpen}
        onClose={() => {
          setAuditOpen(false);
          setAuditPresetFacId(undefined);
        }}
        facilities={snapshot?.facilities || []}
        presetFacilityId={auditPresetFacId}
        onSubmit={handleScheduleAuditSubmit}
      />

      <CreateTransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        facilities={snapshot?.facilities || []}
        requestedBy={session.name}
        onSubmit={handleCreateTransferSubmit}
      />

      <CreateAlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        onSubmit={handleCreateAlertSubmit}
      />

      {/* Quick Jump Command Palette (⌘K) */}
      {cmdOpen && (
        <div className="moh-backdrop" onClick={() => setCmdOpen(false)}>
          <div
            className="moh-modal"
            style={{ maxWidth: 520, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick Jump Search"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #E2E8F0' }}>
              <Search size={16} color="#64748B" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Search hospitals, LGAs, modules, or actions…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.9rem',
                  background: 'transparent',
                }}
              />
              <button type="button" className="moh-icon-btn" onClick={() => setCmdOpen(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="moh-nav-group-label" style={{ paddingLeft: 4 }}>Modules</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {cmdMatches.matchingTabs.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className="moh-nav-btn"
                        style={{ padding: '7px 10px' }}
                        onClick={() => {
                          setDossierFacilityId(null);
                          setActiveTab(t.key);
                          setCmdOpen(false);
                          setCmdQuery('');
                        }}
                      >
                        <Icon size={15} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {cmdMatches.matchingHospitals.length > 0 && (
                <div>
                  <div className="moh-nav-group-label" style={{ paddingLeft: 4 }}>Hospitals</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {cmdMatches.matchingHospitals.map((f) => (
                      <button
                        key={f.facilityId}
                        type="button"
                        className="moh-nav-btn"
                        style={{ padding: '7px 10px' }}
                        onClick={() => {
                          setSelectedFacilityId(f.facilityId);
                          setCmdOpen(false);
                          setCmdQuery('');
                        }}
                      >
                        <Building2 size={15} />
                        <span style={{ flex: 1 }}>{f.facilityName}</span>
                        <span className="moh-pill slate" style={{ fontFamily: 'monospace' }}>{f.facilityId}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="moh-nav-group-label" style={{ paddingLeft: 4 }}>Quick Actions</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 4 }}>
                  <button
                    type="button"
                    className="moh-btn-outline"
                    onClick={() => {
                      setCmdOpen(false);
                      setBroadcastOpen(true);
                    }}
                  >
                    <Send size={13} />
                    <span>Broadcast Directive</span>
                  </button>
                  <button
                    type="button"
                    className="moh-btn-outline"
                    onClick={() => {
                      setCmdOpen(false);
                      setAuditOpen(true);
                    }}
                  >
                    <ClipboardCheck size={13} />
                    <span>Schedule Inspection</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ministerial Attention Notifications Drawer */}
      {notifOpen && (
        <div className="moh-drawer-backdrop" onClick={() => setNotifOpen(false)}>
          <div
            className="moh-drawer"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Ministerial Attention Queue"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #E2E8F0', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Attention Queue</h3>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  Live exceptions requiring Ministerial review
                </div>
              </div>
              <button type="button" className="moh-icon-btn" onClick={() => setNotifOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {attentionList.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
                <CheckCircle2 size={28} color="#065F46" style={{ marginBottom: 8 }} />
                <div>All connected facilities are operating normally.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attentionList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${item.severity === 'danger' ? '#FECACA' : '#FDE68A'}`,
                      background: item.severity === 'danger' ? '#FEF2F2' : '#FFFBEB',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0F172A' }}>{item.title}</div>
                    <div style={{ fontSize: '0.76rem', color: '#475569' }}>{item.detail}</div>
                    <button
                      type="button"
                      className="moh-btn-outline"
                      style={{ alignSelf: 'flex-start', padding: '5px 10px', fontSize: '0.74rem' }}
                      onClick={item.onOpen}
                    >
                      Open Item
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Terminal Lock Overlay */}
      {isLocked && (
        <div
          className="moh-backdrop"
          style={{ zIndex: 1200, background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(12px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Locked Ministry Terminal"
        >
          <div className="moh-modal" style={{ maxWidth: 410 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: '#ECFDF5',
                  color: '#065F46',
                  border: '1px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Lock size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                  Terminal Locked
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {session.name} · <span style={{ fontFamily: 'monospace' }}>{session.badgeId}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUnlockSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                Ministry Access Code / Badge ID
                <input
                  type="password"
                  autoFocus
                  className={`moh-input ${unlockError ? 'moh-input-error' : ''}`}
                  style={{ marginTop: 6 }}
                  value={unlockPin}
                  onChange={(e) => {
                    setUnlockPin(e.target.value);
                    if (unlockError) setUnlockError('');
                  }}
                  placeholder="Enter access passcode to resume"
                />
              </label>

              {unlockError && (
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#DC2626' }}>
                  {unlockError}
                </div>
              )}

              <button type="submit" className="moh-btn-primary" style={{ justifyContent: 'center' }}>
                <Lock size={15} />
                <span>Unlock Terminal</span>
              </button>
              <button
                type="button"
                className="moh-btn-outline"
                style={{ justifyContent: 'center' }}
                onClick={onLogout}
              >
                <LogOut size={15} />
                <span>Sign Out Completely</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Calm Action Feedback Toasts */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 18,
            right: 18,
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                background: '#FFFFFF',
                border: `1px solid ${t.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
                color: '#0F172A',
                padding: '10px 14px',
                borderRadius: 12,
                boxShadow: '0 10px 26px rgba(15, 23, 42, 0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              {t.type === 'error' ? (
                <AlertTriangle size={16} color="#DC2626" />
              ) : (
                <CheckCircle2 size={16} color="#065F46" />
              )}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
