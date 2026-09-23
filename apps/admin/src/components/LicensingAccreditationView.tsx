'use client';

import React, { useState } from 'react';
import type { 
  RegionalFacilityOverview, 
  RegulatoryComplianceAudit, 
  AccreditationStatus 
} from '@medcore/types';
import { 
  FileCheck2, 
  CalendarPlus, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Scale, 
  ChevronRight,
  Download
} from 'lucide-react';

interface LicensingAccreditationViewProps {
  facilities: RegionalFacilityOverview[];
  audits: RegulatoryComplianceAudit[];
  onOpenScheduleAuditModal: () => void;
  onUpdateAuditStatus: (auditId: string, status: RegulatoryComplianceAudit['status']) => void;
}

export const LicensingAccreditationView: React.FC<LicensingAccreditationViewProps> = ({
  facilities,
  audits,
  onOpenScheduleAuditModal,
  onUpdateAuditStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'facilities' | 'audits'>('facilities');

  const accreditedCount = facilities.filter((f) => f.accreditationStatus === 'accredited').length;
  const provisionalCount = facilities.filter((f) => f.accreditationStatus === 'provisional').length;
  const pendingRemediations = audits.filter((a) => a.status === 'remediation_required').length;

  return (
    <div className="moh-licensing-view">
      {/* Top Accreditation KPI Ribbon */}
      <div className="licensing-kpi-ribbon">
        <div className="licensing-kpi-card">
          <div className="kpi-label">Full Accreditation Rate</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">
              {Math.round((accreditedCount / facilities.length) * 100)}%
            </span>
            <span className="kpi-badge good">{accreditedCount} of {facilities.length} Accredited</span>
          </div>
          <div className="kpi-subtext">Certified under National Clinical Standards ISO-15189</div>
        </div>

        <div className="licensing-kpi-card">
          <div className="kpi-label">Provisional Licenses</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{provisionalCount}</span>
            <span className="kpi-badge warn">6-Month Conditional</span>
          </div>
          <div className="kpi-subtext">Western Valley Community Hospital under active monitoring</div>
        </div>

        <div className="licensing-kpi-card">
          <div className="kpi-label">Pending Audit Remediations</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{pendingRemediations}</span>
            <span className="kpi-badge alert">Deadline Enforcement</span>
          </div>
          <div className="kpi-subtext">Cold-chain and staff credentialing corrective dockets</div>
        </div>

        <div className="licensing-kpi-card">
          <div className="kpi-label">MOH Inspectors Deployed</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">18</span>
            <span className="kpi-badge good">Field Active</span>
          </div>
          <div className="kpi-subtext">Directorate of Quality & Healthcare Enforcement</div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="licensing-sub-nav">
        <div className="sub-tab-buttons">
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === 'facilities' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('facilities')}
          >
            <ShieldCheck size={16} />
            <span>Facility Licensing & Expirations ({facilities.length})</span>
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${activeSubTab === 'audits' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audits')}
          >
            <FileCheck2 size={16} />
            <span>Inspection Dockets & Audits ({audits.length})</span>
          </button>
        </div>

        <div className="sub-nav-actions">
          <button
            type="button"
            className="action-btn audit-btn"
            onClick={onOpenScheduleAuditModal}
          >
            <CalendarPlus size={15} />
            <span>Schedule New Inspection</span>
          </button>
        </div>
      </div>

      {/* View 1: Facility Licensing Pipeline */}
      {activeSubTab === 'facilities' && (
        <div className="moh-panel no-padding">
          <div className="table-responsive">
            <table className="moh-data-table full-width">
              <thead>
                <tr>
                  <th>Hospital Facility</th>
                  <th>License Number</th>
                  <th>Tier Classification</th>
                  <th>Accreditation Standing</th>
                  <th>License Expiration</th>
                  <th>Quality Score</th>
                  <th>Regulatory Action</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((fac) => (
                  <tr key={fac.facilityId}>
                    <td>
                      <strong>{fac.facilityName}</strong>
                      <div className="table-sub-detail">{fac.region}</div>
                    </td>
                    <td>
                      <span className="license-code">{fac.licenseNumber}</span>
                    </td>
                    <td>
                      <span className="tier-tag-pill">{fac.tier.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${fac.accreditationStatus}`}>
                        {fac.accreditationStatus.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="expiration-cell">
                        <Calendar size={13} />
                        <span>{fac.licenseExpires}</span>
                      </div>
                    </td>
                    <td>
                      <strong className={fac.complianceScore >= 95 ? 'text-good' : 'text-amber'}>
                        {fac.complianceScore}%
                      </strong>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="mini-action-btn"
                        onClick={() => alert(`Issuing formal Accreditation Renewal Certificate for ${fac.facilityName}...`)}
                      >
                        Renew License
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Regulatory Audits & Inspection Dockets */}
      {activeSubTab === 'audits' && (
        <div className="audits-view-container">
          <div className="audits-grid">
            {audits.map((aud) => (
              <div key={aud.auditId} className="audit-docket-card">
                <div className="audit-docket-header">
                  <div className="audit-id-tag">{aud.auditId}</div>
                  <span className={`status-badge ${aud.status === 'passed' ? 'accredited' : 'provisional'}`}>
                    {aud.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <h3>{aud.facilityName}</h3>
                <div className="audit-category-chip">
                  <span>Category: <strong>{aud.category.replace(/_/g, ' ').toUpperCase()}</strong></span>
                </div>

                <div className="audit-detail-list">
                  <div className="detail-row">
                    <span className="label">Lead Auditor:</span>
                    <span className="val">{aud.auditorName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Inspection Date:</span>
                    <span className="val">{aud.auditDate}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Total Findings:</span>
                    <span className="val">{aud.findingsCount} issues noted</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Critical Violations:</span>
                    <span className={`val ${aud.criticalViolations > 0 ? 'text-red font-bold' : 'text-good'}`}>
                      {aud.criticalViolations}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Remediation Deadline:</span>
                    <span className="val">{aud.resolutionDeadline}</span>
                  </div>
                </div>

                <div className="audit-card-footer">
                  {aud.status !== 'passed' ? (
                    <button
                      type="button"
                      className="remediate-resolve-btn"
                      onClick={() => onUpdateAuditStatus(aud.auditId, 'passed')}
                    >
                      <CheckCircle2 size={14} />
                      <span>Sign Off Remediation (Pass)</span>
                    </button>
                  ) : (
                    <div className="passed-notice">
                      <CheckCircle2 size={16} className="text-good" />
                      <span>Audit Certified & Fully Compliant</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
