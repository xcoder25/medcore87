'use client';

import React, { useState } from 'react';
import type { HealthcareWorkerRegistry, RegionalWorkforceSummary, StaffTransferRecord } from '@medcore/types';
import { 
  Users2, 
  Search, 
  UserCheck, 
  AlertCircle, 
  Award, 
  Stethoscope, 
  Activity, 
  Building2,
  Filter,
  CheckCircle2,
  FileBadge,
  ArrowRightLeft,
  Zap,
  MapPin,
  Clock,
  TrendingUp,
  XCircle,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import { StaffTransferModal } from './StaffTransferModal';

const INITIAL_REGIONAL_WORKFORCE: RegionalWorkforceSummary[] = [
  {
    region: 'Capital Central',
    totalDoctors: 2840,
    totalNurses: 6120,
    intensivistsCount: 184,
    doctorToPopulationRatio: '1:1,120',
    specialistDeficitAreas: ['Pediatric Surgery'],
    staffingShortageLevel: 'optimal',
  },
  {
    region: 'Northern District',
    totalDoctors: 1420,
    totalNurses: 3450,
    intensivistsCount: 68,
    doctorToPopulationRatio: '1:2,100',
    specialistDeficitAreas: ['Adult Intensivists', 'Nephrology'],
    staffingShortageLevel: 'moderate',
  },
  {
    region: 'Eastern District',
    totalDoctors: 1180,
    totalNurses: 2890,
    intensivistsCount: 52,
    doctorToPopulationRatio: '1:2,450',
    specialistDeficitAreas: ['Neonatal Intensive Care', 'Trauma Surgery'],
    staffingShortageLevel: 'moderate',
  },
  {
    region: 'Western Province',
    totalDoctors: 680,
    totalNurses: 1840,
    intensivistsCount: 22,
    doctorToPopulationRatio: '1:3,800',
    specialistDeficitAreas: ['Cardiology', 'Obstetric Emergency', 'Anesthesiology'],
    staffingShortageLevel: 'critical',
  },
];

const INITIAL_WORKERS: HealthcareWorkerRegistry[] = [
  {
    workerId: 'WKR-1001',
    fullName: 'Dr. Evelyn Montgomery, MD, FRCS',
    cadre: 'Surgeon',
    licenseNumber: 'MDCN-LIC-2018-0914',
    licenseStatus: 'active',
    assignedFacilityId: 'FAC-001',
    assignedFacilityName: 'National Referral Hospital & Trauma Centre',
    region: 'Capital Central',
    primarySpecialty: 'Cardiothoracic & Vascular Surgery',
    yearsOfPractice: 14,
    lastAccreditedDate: '2025-11-20',
  },
  {
    workerId: 'WKR-1002',
    fullName: 'Dr. Julian Thorne, MD',
    cadre: 'Specialist Physician',
    licenseNumber: 'MDCN-LIC-2020-0412',
    licenseStatus: 'active',
    assignedFacilityId: 'FAC-002',
    assignedFacilityName: 'St. Jude Metropolitan General',
    region: 'Northern District',
    primarySpecialty: 'Internal Medicine & Critical Care',
    yearsOfPractice: 9,
    lastAccreditedDate: '2026-02-14',
  },
  {
    workerId: 'WKR-1003',
    fullName: 'Nurse Supervisor Chidinma Okafor, RN, BSN',
    cadre: 'Registered Nurse',
    licenseNumber: 'NMCN-LIC-2019-3381',
    licenseStatus: 'active',
    assignedFacilityId: 'FAC-003',
    assignedFacilityName: 'Eastern Coastal Children\u2019s & Maternal Hospital',
    region: 'Eastern District',
    primarySpecialty: 'Pediatric Intensive Care Unit (PICU)',
    yearsOfPractice: 11,
    lastAccreditedDate: '2025-08-30',
  },
  {
    workerId: 'WKR-1004',
    fullName: 'Dr. Tariq Al-Mansoor, MD',
    cadre: 'Intensivist',
    licenseNumber: 'MDCN-LIC-2022-7719',
    licenseStatus: 'renewal_pending',
    assignedFacilityId: 'FAC-004',
    assignedFacilityName: 'Western Valley Community Hospital',
    region: 'Western Province',
    primarySpecialty: 'Anesthesiology & Critical Care',
    yearsOfPractice: 6,
    lastAccreditedDate: '2024-09-01',
  },
  {
    workerId: 'WKR-1005',
    fullName: 'Dr. Fatimah Bello, MBBS, FMCP',
    cadre: 'Epidemiologist',
    licenseNumber: 'MDCN-LIC-2017-1102',
    licenseStatus: 'active',
    assignedFacilityId: 'FAC-001',
    assignedFacilityName: 'National Referral Hospital & Trauma Centre',
    region: 'Capital Central',
    primarySpecialty: 'Infectious Diseases & Outbreak Surveillance',
    yearsOfPractice: 16,
    lastAccreditedDate: '2026-04-10',
  },
];

type WorkforceSubTab = 'radar' | 'registry' | 'transfers';

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  temporary_surge: 'Temp Surge',
  emergency_mutual_aid: 'Mutual Aid',
  specialist_rotation: 'Rotation',
  permanent_reassignment: 'Permanent',
};

const URGENCY_LABELS: Record<string, string> = {
  immediate_code_red: 'CODE RED',
  urgent: 'Urgent',
  routine: 'Routine',
};

export const WorkforceSurveillanceView: React.FC = () => {
  const [workers, setWorkers] = useState<HealthcareWorkerRegistry[]>(INITIAL_WORKERS);
  const [regionalData, setRegionalData] = useState<RegionalWorkforceSummary[]>(INITIAL_REGIONAL_WORKFORCE);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCadre, setSelectedCadre] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<WorkforceSubTab>('radar');

  // Transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferPresetWorkerId, setTransferPresetWorkerId] = useState<string | undefined>(undefined);
  const [transferTargetRegion, setTransferTargetRegion] = useState<string | undefined>(undefined);
  const [transfers, setTransfers] = useState<StaffTransferRecord[]>([]);
  const [transferFilter, setTransferFilter] = useState<string>('all');

  const filteredWorkers = workers.filter((w) => {
    if (selectedCadre !== 'all' && w.cadre !== selectedCadre) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        w.fullName.toLowerCase().includes(q) ||
        w.licenseNumber.toLowerCase().includes(q) ||
        w.primarySpecialty.toLowerCase().includes(q) ||
        w.assignedFacilityName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredTransfers = transfers.filter((t) => {
    if (transferFilter === 'all') return true;
    return t.status === transferFilter;
  });

  const handleVerifyLicense = (workerId: string) => {
    setWorkers((prev) =>
      prev.map((w) => (w.workerId === workerId ? { ...w, licenseStatus: 'active' } : w))
    );
    window.dispatchEvent(new CustomEvent('moh:notify', {
      detail: { title: 'License Verified', body: 'Clinician credentials verified and digitally re-authenticated on MOH register.', type: 'success' }
    }));
  };

  const openTransferModal = (workerId?: string, targetRegion?: string) => {
    setTransferPresetWorkerId(workerId);
    setTransferTargetRegion(targetRegion);
    setIsTransferModalOpen(true);
  };

  const handleTransferDispatched = (transfer: StaffTransferRecord) => {
    // Add to transfer ledger
    setTransfers((prev) => [transfer, ...prev]);

    // Update the clinician's assignment in the registry
    setWorkers((prev) =>
      prev.map((w) =>
        w.workerId === transfer.workerId
          ? {
              ...w,
              assignedFacilityId: transfer.targetFacilityId,
              assignedFacilityName: transfer.targetFacilityName,
              region: transfer.targetRegion,
            }
          : w
      )
    );

    // Rebalance regional workforce counts (simplified)
    setRegionalData((prev) =>
      prev.map((rw) => {
        if (rw.region === transfer.sourceRegion) {
          const delta = transfer.cadre === 'Intensivist' ? -1 : 0;
          return {
            ...rw,
            totalDoctors: transfer.cadre !== 'Registered Nurse' ? Math.max(0, rw.totalDoctors - 1) : rw.totalDoctors,
            totalNurses: transfer.cadre === 'Registered Nurse' ? Math.max(0, rw.totalNurses - 1) : rw.totalNurses,
            intensivistsCount: rw.intensivistsCount + delta,
          };
        }
        if (rw.region === transfer.targetRegion) {
          const delta = transfer.cadre === 'Intensivist' ? 1 : 0;
          return {
            ...rw,
            totalDoctors: transfer.cadre !== 'Registered Nurse' ? rw.totalDoctors + 1 : rw.totalDoctors,
            totalNurses: transfer.cadre === 'Registered Nurse' ? rw.totalNurses + 1 : rw.totalNurses,
            intensivistsCount: rw.intensivistsCount + delta,
          };
        }
        return rw;
      })
    );

    window.dispatchEvent(new CustomEvent('moh:notify', {
      detail: {
        title: 'Transfer Order Dispatched',
        body: `${transfer.workerName} redeployed to ${transfer.targetFacilityName} (${transfer.targetRegion}). Status: ${transfer.status.replace(/_/g, ' ').toUpperCase()}.`,
        type: 'success',
      }
    }));

    setActiveSubTab('transfers');
  };

  const handleCheckIn = (transferId: string) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.transferId === transferId ? { ...t, status: 'active_deployment' } : t
      )
    );
  };

  const handleRecall = (transfer: StaffTransferRecord) => {
    // Update transfer to completed
    setTransfers((prev) =>
      prev.map((t) =>
        t.transferId === transfer.transferId
          ? { ...t, status: 'completed', completedAt: new Date().toISOString() }
          : t
      )
    );

    // Return clinician to home facility if temporary/rotation
    if (transfer.transferType !== 'permanent_reassignment') {
      setWorkers((prev) =>
        prev.map((w) =>
          w.workerId === transfer.workerId
            ? {
                ...w,
                assignedFacilityId: transfer.sourceFacilityId,
                assignedFacilityName: transfer.sourceFacilityName,
                region: transfer.sourceRegion,
              }
            : w
        )
      );

      // Rebalance regional counts back
      setRegionalData((prev) =>
        prev.map((rw) => {
          if (rw.region === transfer.targetRegion) {
            const delta = transfer.cadre === 'Intensivist' ? -1 : 0;
            return {
              ...rw,
              totalDoctors: transfer.cadre !== 'Registered Nurse' ? Math.max(0, rw.totalDoctors - 1) : rw.totalDoctors,
              totalNurses: transfer.cadre === 'Registered Nurse' ? Math.max(0, rw.totalNurses - 1) : rw.totalNurses,
              intensivistsCount: rw.intensivistsCount + delta,
            };
          }
          if (rw.region === transfer.sourceRegion) {
            const delta = transfer.cadre === 'Intensivist' ? 1 : 0;
            return {
              ...rw,
              totalDoctors: transfer.cadre !== 'Registered Nurse' ? rw.totalDoctors + 1 : rw.totalDoctors,
              totalNurses: transfer.cadre === 'Registered Nurse' ? rw.totalNurses + 1 : rw.totalNurses,
              intensivistsCount: rw.intensivistsCount + delta,
            };
          }
          return rw;
        })
      );

      window.dispatchEvent(new CustomEvent('moh:notify', {
        detail: {
          title: 'Clinician Recalled',
          body: `${transfer.workerName} has been recalled and returned to ${transfer.sourceFacilityName}.`,
          type: 'success',
        }
      }));
    }
  };

  const activeTransferCount = transfers.filter((t) => t.status === 'active_deployment' || t.status === 'dispatched').length;

  return (
    <div className="moh-workforce-view">
      {/* Top Clinician Distribution KPI Strip */}
      <div className="workforce-kpi-ribbon">
        <div className="workforce-kpi-card">
          <div className="kpi-label">Licensed Health Workforce</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">14,820</span>
            <span className="kpi-badge good">National Register</span>
          </div>
          <div className="kpi-subtext">Verified under Medical & Dental Council Integration</div>
        </div>

        <div className="workforce-kpi-card">
          <div className="kpi-label">Specialist Physicians</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">4,250</span>
            <span className="kpi-badge good">28.7% of Doctors</span>
          </div>
          <div className="kpi-subtext">Consultants across surgical, medical, & acute disciplines</div>
        </div>

        <div className="workforce-kpi-card">
          <div className="kpi-label">Critical Care Intensivists</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">326</span>
            <span className="kpi-badge warn">Surge Shortage Area</span>
          </div>
          <div className="kpi-subtext">Western Province deficit: 1 intensivist per 85,000 residents</div>
        </div>

        <div className="workforce-kpi-card">
          <div className="kpi-label">Active Redeployments</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{activeTransferCount}</span>
            <span className={`kpi-badge ${activeTransferCount > 0 ? 'warn' : 'good'}`}>
              {activeTransferCount > 0 ? 'Surge Active' : 'Baseline'}
            </span>
          </div>
          <div className="kpi-subtext">Surge transfers & mutual-aid deployments in progress</div>
        </div>
      </div>

      {/* Sub-Tab Navigator */}
      <div className="workforce-subtab-bar">
        <button
          type="button"
          className={`workforce-subtab ${activeSubTab === 'radar' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('radar')}
        >
          <Activity size={15} />
          Regional Deficit Radar
        </button>
        <button
          type="button"
          className={`workforce-subtab ${activeSubTab === 'registry' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('registry')}
        >
          <FileBadge size={15} />
          Licensed Clinician Registry
        </button>
        <button
          type="button"
          className={`workforce-subtab ${activeSubTab === 'transfers' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('transfers')}
        >
          <ArrowRightLeft size={15} />
          Surge Redeployments
          {activeTransferCount > 0 && (
            <span className="subtab-badge">{activeTransferCount}</span>
          )}
        </button>
      </div>

      {/* ── Tab: Regional Deficit Radar ── */}
      {activeSubTab === 'radar' && (
        <div className="moh-panel">
          <div className="moh-panel-header">
            <div className="panel-title-block">
              <h3>Regional Healthcare Workforce Distribution & Deficit Radar</h3>
              <span className="panel-subtitle">Clinician density and specialist shortage alerts across national administrative territories</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="moh-data-table full-width">
              <thead>
                <tr>
                  <th>Jurisdiction</th>
                  <th>Doctors</th>
                  <th>Nurses</th>
                  <th>ICU Intensivists</th>
                  <th>Doctor:Pop Ratio</th>
                  <th>Specialist Shortage Areas</th>
                  <th>Staffing Health</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {regionalData.map((rw) => (
                  <tr key={rw.region}>
                    <td><strong>{rw.region}</strong></td>
                    <td>{rw.totalDoctors.toLocaleString()}</td>
                    <td>{rw.totalNurses.toLocaleString()}</td>
                    <td>
                      <strong>{rw.intensivistsCount}</strong>
                    </td>
                    <td>
                      <span className={rw.staffingShortageLevel === 'critical' ? 'text-red font-bold' : ''}>
                        {rw.doctorToPopulationRatio}
                      </span>
                    </td>
                    <td>
                      <div className="shortage-chips">
                        {rw.specialistDeficitAreas.map((area) => (
                          <span key={area} className="deficit-chip">
                            {area}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${rw.staffingShortageLevel === 'optimal' ? 'accredited' : rw.staffingShortageLevel === 'moderate' ? 'provisional' : 'alert-yellow'}`}>
                        {rw.staffingShortageLevel.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {rw.staffingShortageLevel !== 'optimal' && (
                        <button
                          type="button"
                          className={`mini-action-btn ${rw.staffingShortageLevel === 'critical' ? 'mini-action-btn--danger' : ''}`}
                          onClick={() => openTransferModal(undefined, rw.region)}
                        >
                          <Zap size={12} />
                          Deploy Surge Relief
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Clinician Registry ── */}
      {activeSubTab === 'registry' && (
        <div className="moh-panel">
          <div className="moh-panel-header">
            <div className="panel-title-block">
              <h3>National Licensed Clinician Credential Registry</h3>
              <span className="panel-subtitle">Real-time professional licensing and hospital deployment registry</span>
            </div>
            <button
              type="button"
              className="btn-primary-gold"
              onClick={() => openTransferModal()}
            >
              <ArrowRightLeft size={15} />
              <span>Issue Transfer Order</span>
            </button>
          </div>

          <div className="workforce-search-row">
            <div className="search-input-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search clinician by name, MDCN license, or hospital affiliation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="cadre-select-group">
              <Filter size={14} />
              <select
                value={selectedCadre}
                onChange={(e) => setSelectedCadre(e.target.value)}
                className="cadre-select"
              >
                <option value="all">All Cadres</option>
                <option value="Surgeon">Surgeons</option>
                <option value="Specialist Physician">Specialist Physicians</option>
                <option value="Intensivist">Intensivists</option>
                <option value="Registered Nurse">Registered Nurses</option>
                <option value="Epidemiologist">Epidemiologists</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="moh-data-table full-width">
              <thead>
                <tr>
                  <th>Clinician</th>
                  <th>Cadre & Specialty</th>
                  <th>License Number</th>
                  <th>Assigned Facility</th>
                  <th>Experience</th>
                  <th>License Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((w) => (
                  <tr key={w.workerId}>
                    <td>
                      <strong>{w.fullName}</strong>
                      <div className="table-sub-detail">{w.region}</div>
                    </td>
                    <td>
                      <div className="cadre-tag">{w.cadre}</div>
                      <div className="table-sub-detail">{w.primarySpecialty}</div>
                    </td>
                    <td>
                      <span className="license-code">{w.licenseNumber}</span>
                    </td>
                    <td>
                      <span>{w.assignedFacilityName}</span>
                    </td>
                    <td>
                      <span>{w.yearsOfPractice} Years</span>
                    </td>
                    <td>
                      <span className={`status-badge ${w.licenseStatus === 'active' ? 'accredited' : 'alert-yellow'}`}>
                        {w.licenseStatus.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {w.licenseStatus === 'renewal_pending' && (
                          <button
                            type="button"
                            className="mini-action-btn"
                            onClick={() => handleVerifyLicense(w.workerId)}
                          >
                            Verify & Renew
                          </button>
                        )}
                        {w.licenseStatus === 'active' && (
                          <span className="text-good font-bold text-xs">
                            <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 3 }} />
                            Verified
                          </span>
                        )}
                        <button
                          type="button"
                          className="mini-action-btn mini-action-btn--transfer"
                          onClick={() => openTransferModal(w.workerId)}
                        >
                          <ArrowRightLeft size={12} />
                          Transfer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Surge Redeployments & Transfer Orders ── */}
      {activeSubTab === 'transfers' && (
        <div className="moh-panel">
          <div className="moh-panel-header">
            <div className="panel-title-block">
              <h3>Surge Redeployments & Inter-Facility Transfer Orders</h3>
              <span className="panel-subtitle">Active, dispatched, and completed ministerial deployment directives</span>
            </div>
            <button
              type="button"
              className="btn-primary-gold"
              onClick={() => openTransferModal()}
            >
              <ShieldAlert size={15} />
              <span>New Transfer Order</span>
            </button>
          </div>

          {/* Transfer Status Filter Bar */}
          <div className="transfer-filter-bar">
            {['all', 'pending_approval', 'dispatched', 'active_deployment', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                type="button"
                className={`transfer-filter-pill ${transferFilter === status ? 'active' : ''}`}
                onClick={() => setTransferFilter(status)}
              >
                {status === 'all' ? 'All Orders' : status.replace(/_/g, ' ')}
                {status !== 'all' && transfers.filter((t) => t.status === status).length > 0 && (
                  <span className="filter-pill-count">
                    {transfers.filter((t) => t.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Transfer Cards */}
          {filteredTransfers.length === 0 ? (
            <div className="transfer-empty-state">
              <ArrowRightLeft size={40} strokeWidth={1.2} />
              <h4>No Transfer Orders Issued</h4>
              <p>
                Issue a ministerial staff deployment directive to begin tracking surge redeployments and inter-facility clinician transfers across the national network.
              </p>
              <button
                type="button"
                className="btn-primary-gold"
                onClick={() => openTransferModal()}
              >
                <ShieldAlert size={14} />
                <span>Issue First Transfer Order</span>
              </button>
            </div>
          ) : (
            <div className="transfer-orders-deck">
              {filteredTransfers.map((t) => (
                <div key={t.transferId} className={`transfer-order-card transfer-order-card--${t.urgency}`}>
                  <div className="transfer-order-header">
                    <div className="transfer-order-id-cluster">
                      <span className="transfer-order-id">{t.transferId}</span>
                      <span className={`urgency-badge urgency-badge--${t.urgency}`}>
                        {URGENCY_LABELS[t.urgency]}
                      </span>
                      <span className={`transfer-type-pill transfer-type-pill--${t.transferType}`}>
                        {TRANSFER_TYPE_LABELS[t.transferType]}
                      </span>
                    </div>
                    <span className={`status-badge ${
                      t.status === 'active_deployment' ? 'accredited' :
                      t.status === 'dispatched' ? 'provisional' :
                      t.status === 'completed' ? 'accredited' :
                      t.status === 'cancelled' ? 'alert-yellow' :
                      'provisional'
                    }`}>
                      {t.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="transfer-order-clinician-row">
                    <Stethoscope size={16} className="text-gold" />
                    <div>
                      <strong>{t.workerName}</strong>
                      <span className="table-sub-detail" style={{ marginLeft: 8 }}>
                        {t.cadre} · {t.primarySpecialty}
                      </span>
                    </div>
                  </div>

                  <div className="transfer-pathway-inline">
                    <div className="pathway-inline-node">
                      <MapPin size={12} className="text-muted" />
                      <div>
                        <span className="pathway-inline-label">From</span>
                        <strong>{t.sourceFacilityName}</strong>
                        <span className="dossier-sub">{t.sourceRegion}</span>
                      </div>
                    </div>
                    <div className="pathway-inline-arrow">→</div>
                    <div className="pathway-inline-node">
                      <Building2 size={12} className="text-gold" />
                      <div>
                        <span className="pathway-inline-label">To</span>
                        <strong>{t.targetFacilityName}</strong>
                        <span className="dossier-sub">{t.targetRegion}</span>
                      </div>
                    </div>
                  </div>

                  <div className="transfer-order-meta">
                    <span>
                      <Clock size={12} />
                      Effective {t.effectiveDate}
                      {t.durationWeeks && ` · ${t.durationWeeks} weeks`}
                    </span>
                    <span>
                      <Award size={12} />
                      Auth: {t.authorizingOfficer}
                    </span>
                    {t.notes && (
                      <span className="transfer-notes">{t.notes}</span>
                    )}
                  </div>

                  {/* Action buttons based on status */}
                  <div className="transfer-order-actions">
                    {(t.status === 'pending_approval' || t.status === 'dispatched') && (
                      <button
                        type="button"
                        className="mini-action-btn"
                        onClick={() => handleCheckIn(t.transferId)}
                      >
                        <CheckCircle2 size={13} />
                        Confirm In-Service Check-In
                      </button>
                    )}
                    {t.status === 'active_deployment' && t.transferType !== 'permanent_reassignment' && (
                      <button
                        type="button"
                        className="mini-action-btn mini-action-btn--recall"
                        onClick={() => handleRecall(t)}
                      >
                        <RotateCcw size={13} />
                        Recall Clinician
                      </button>
                    )}
                    {t.status === 'completed' && (
                      <span className="text-good font-bold text-xs">
                        <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 3 }} />
                        Deployment Completed {t.completedAt ? `· ${new Date(t.completedAt).toLocaleDateString()}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff Transfer Modal */}
      <StaffTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        workers={workers}
        selectedWorkerId={transferPresetWorkerId}
        targetRegionPreset={transferTargetRegion}
        onTransferDispatched={handleTransferDispatched}
      />
    </div>
  );
};
