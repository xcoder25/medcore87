'use client';

import React from 'react';
import type { RegionalFacilityOverview } from '@medcore/types';
import { 
  X, 
  Building2, 
  ShieldCheck, 
  Bed, 
  AlertTriangle, 
  Wind, 
  Zap, 
  Users, 
  Activity, 
  FileText,
  Ambulance,
  CheckCircle
} from 'lucide-react';

interface FacilityDetailDrawerProps {
  facility: RegionalFacilityOverview | null;
  onClose: () => void;
  onUpdateStatus: (facilityId: string, newStatus: RegionalFacilityOverview['emergencyStatus']) => void;
}

export const FacilityDetailDrawer: React.FC<FacilityDetailDrawerProps> = ({
  facility,
  onClose,
  onUpdateStatus,
}) => {
  if (!facility) return null;

  const bedOccupancyPercent = Math.round((facility.occupiedBeds / facility.totalBeds) * 100);
  const icuOccupancyPercent = Math.round((facility.icuBedsOccupied / facility.icuBedsTotal) * 100);

  // Mock department breakdown derived deterministically
  const medSurgTotal = Math.round(facility.totalBeds * 0.55);
  const medSurgOccupied = Math.round(facility.occupiedBeds * 0.58);
  const pedsTotal = Math.round(facility.totalBeds * 0.18);
  const pedsOccupied = Math.round(facility.occupiedBeds * 0.16);
  const edTotal = Math.round(facility.totalBeds * 0.12);
  const edOccupied = Math.round(facility.occupiedBeds * 0.14);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="facility-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-tier-pill">
              {facility.tier.replace(/_/g, ' ').toUpperCase()}
            </div>
            <h2>{facility.facilityName}</h2>
            <div className="drawer-meta-row">
              <span>License: <strong>{facility.licenseNumber}</strong></span>
              <span>•</span>
              <span>Region: <strong>{facility.region}</strong></span>
              <span>•</span>
              <span className={`status-tag ${facility.accreditationStatus}`}>
                {facility.accreditationStatus.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Emergency Alert & Surge Status Banner */}
          <div className={`drawer-surge-banner ${facility.emergencyStatus}`}>
            <div className="surge-banner-left">
              <AlertTriangle size={20} />
              <div>
                <strong>Operational Mode: {facility.emergencyStatus.replace(/_/g, ' ').toUpperCase()}</strong>
                <p>
                  {facility.emergencyStatus === 'normal' 
                    ? 'Facility is within acceptable capacity margins. All emergency systems nominal.'
                    : facility.emergencyStatus === 'surge_code_yellow'
                    ? 'Bed census > 85%. Elective intake constrained; step-down transitions expedited.'
                    : 'Critical saturation reached. Mutual-aid diversion protocol authorized by MOH.'}
                </p>
              </div>
            </div>
            <div className="surge-controls">
              <label>Override Status:</label>
              <select
                value={facility.emergencyStatus}
                onChange={(e) => onUpdateStatus(facility.facilityId, e.target.value as any)}
                className="status-selector"
              >
                <option value="normal">Normal</option>
                <option value="surge_code_yellow">Surge (Code Yellow)</option>
                <option value="critical_code_red">Critical (Code Red)</option>
                <option value="diversion">Diversion</option>
              </select>
            </div>
          </div>

          {/* High Density Metric Gauges */}
          <div className="drawer-metric-grid">
            <div className="drawer-metric-card">
              <div className="metric-header-row">
                <span className="metric-name">Total Bed Occupancy</span>
                <Bed size={16} />
              </div>
              <div className="metric-main-val">
                {facility.occupiedBeds} <span className="sub">/ {facility.totalBeds}</span>
              </div>
              <div className="progress-bar-track">
                <div 
                  className={`progress-bar-fill ${bedOccupancyPercent > 90 ? 'critical' : bedOccupancyPercent > 80 ? 'warning' : 'optimal'}`}
                  style={{ width: `${Math.min(bedOccupancyPercent, 100)}%` }}
                />
              </div>
              <span className="metric-footnote">{bedOccupancyPercent}% total network load</span>
            </div>

            <div className="drawer-metric-card">
              <div className="metric-header-row">
                <span className="metric-name">ICU Critical Load</span>
                <Activity size={16} />
              </div>
              <div className="metric-main-val">
                {facility.icuBedsOccupied} <span className="sub">/ {facility.icuBedsTotal}</span>
              </div>
              <div className="progress-bar-track">
                <div 
                  className={`progress-bar-fill ${icuOccupancyPercent > 85 ? 'critical' : 'optimal'}`}
                  style={{ width: `${Math.min(icuOccupancyPercent, 100)}%` }}
                />
              </div>
              <span className="metric-footnote">{icuOccupancyPercent}% ICU beds occupied</span>
            </div>

            <div className="drawer-metric-card">
              <div className="metric-header-row">
                <span className="metric-name">Active Ventilators</span>
                <Wind size={16} />
              </div>
              <div className="metric-main-val">
                {facility.ventilatorsAvailable} <span className="sub">Standby</span>
              </div>
              <div className="metric-sub-detail">
                <span>Total Unit Fleet: {facility.ventilatorsAvailable + facility.icuBedsOccupied}</span>
              </div>
              <span className="metric-footnote text-good">O2 reserves 96 hrs</span>
            </div>

            <div className="drawer-metric-card">
              <div className="metric-header-row">
                <span className="metric-name">Accreditation Score</span>
                <ShieldCheck size={16} />
              </div>
              <div className="metric-main-val score-val">
                {facility.complianceScore}%
              </div>
              <div className="metric-sub-detail">
                <span>Expires: {facility.licenseExpires}</span>
              </div>
              <span className="metric-footnote text-good">Full Regulatory Standing</span>
            </div>
          </div>

          {/* Department Breakdown Section */}
          <div className="drawer-section">
            <h3 className="section-title">Department Bed Distribution</h3>
            <table className="drawer-subtable">
              <thead>
                <tr>
                  <th>Department / Service</th>
                  <th>Occupied</th>
                  <th>Capacity</th>
                  <th>Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>General Medicine & Surgery</strong></td>
                  <td>{medSurgOccupied}</td>
                  <td>{medSurgTotal}</td>
                  <td>{Math.round((medSurgOccupied / medSurgTotal) * 100)}%</td>
                  <td><span className="tag-ok">Normal</span></td>
                </tr>
                <tr>
                  <td><strong>Intensive Care Unit (ICU / CCU)</strong></td>
                  <td>{facility.icuBedsOccupied}</td>
                  <td>{facility.icuBedsTotal}</td>
                  <td>{icuOccupancyPercent}%</td>
                  <td>
                    <span className={icuOccupancyPercent > 85 ? 'tag-warn' : 'tag-ok'}>
                      {icuOccupancyPercent > 85 ? 'Constrained' : 'Nominal'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Pediatric & Neonatal Care</strong></td>
                  <td>{pedsOccupied}</td>
                  <td>{pedsTotal}</td>
                  <td>{Math.round((pedsOccupied / pedsTotal) * 100)}%</td>
                  <td><span className="tag-ok">Nominal</span></td>
                </tr>
                <tr>
                  <td><strong>Emergency & Resuscitation Bays</strong></td>
                  <td>{edOccupied}</td>
                  <td>{edTotal}</td>
                  <td>{Math.round((edOccupied / edTotal) * 100)}%</td>
                  <td><span className="tag-ok">Nominal</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Infrastructure & Clinical Logistics */}
          <div className="drawer-section">
            <h3 className="section-title">Critical Infrastructure & Logistics</h3>
            <div className="infra-grid">
              <div className="infra-item">
                <Wind className="infra-icon" />
                <div>
                  <div className="infra-title">Liquid Medical Oxygen (LOX)</div>
                  <div className="infra-desc">96 Hours autonom. reserve (8,400 L)</div>
                </div>
                <span className="infra-badge-ok">Optimal</span>
              </div>

              <div className="infra-item">
                <Zap className="infra-icon" />
                <div>
                  <div className="infra-title">Emergency Power Generation</div>
                  <div className="infra-desc">Dual CAT Diesel Generators tested 3d ago</div>
                </div>
                <span className="infra-badge-ok">Standby Active</span>
              </div>

              <div className="infra-item">
                <Users className="infra-icon" />
                <div>
                  <div className="infra-title">Bedside Clinical Staff</div>
                  <div className="infra-desc">{facility.staffOnDuty} Nurses & MDs on active shift</div>
                </div>
                <span className="infra-badge-ok">1:3.8 Ratio</span>
              </div>

              <div className="infra-item">
                <Activity className="infra-icon" />
                <div>
                  <div className="infra-title">Negative Pressure Isolation</div>
                  <div className="infra-desc">6 Rooms available / 8 Total capacity</div>
                </div>
                <span className="infra-badge-ok">Available</span>
              </div>
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="drawer-footer-actions">
            <button 
              type="button" 
              className="footer-btn alert-action"
              onClick={() => {
                onUpdateStatus(facility.facilityId, 'diversion');
                alert(`Mutual-Aid Diversion protocol activated for ${facility.facilityName}. Ambulances will be rerouted automatically.`);
              }}
            >
              <Ambulance size={15} />
              <span>Activate Ambulance Diversion</span>
            </button>
            <button 
              type="button" 
              className="footer-btn audit-action"
              onClick={() => alert(`Inspection docket initialized for ${facility.facilityName}. Inspector will be notified.`)}
            >
              <FileText size={15} />
              <span>Initiate Formal Compliance Audit</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
