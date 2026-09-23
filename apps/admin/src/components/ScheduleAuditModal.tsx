'use client';

import React, { useState } from 'react';
import type { RegulatoryComplianceAudit, RegionalFacilityOverview } from '@medcore/types';
import { X, CalendarPlus, ShieldCheck } from 'lucide-react';

interface ScheduleAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: RegionalFacilityOverview[];
  onScheduleAudit: (newAudit: RegulatoryComplianceAudit) => void;
}

export const ScheduleAuditModal: React.FC<ScheduleAuditModalProps> = ({
  isOpen,
  onClose,
  facilities,
  onScheduleAudit,
}) => {
  const [facilityId, setFacilityId] = useState(facilities[0]?.facilityId || '');
  const [category, setCategory] = useState<RegulatoryComplianceAudit['category']>('clinical_safety');
  const [auditorName, setAuditorName] = useState('Dr. Marcus Bennett (Senior Health Inspector)');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetFacility = facilities.find((f) => f.facilityId === facilityId);

    const newAudit: RegulatoryComplianceAudit = {
      auditId: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
      facilityId,
      facilityName: targetFacility ? targetFacility.facilityName : 'Regional Facility',
      auditDate,
      auditorName,
      category,
      findingsCount: 0,
      criticalViolations: 0,
      resolutionDeadline: deadline,
      status: 'remediation_required',
    };

    onScheduleAudit(newAudit);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-icon-badge gold">
            <CalendarPlus size={20} />
          </div>
          <div>
            <h3>Schedule Regulatory Accreditation Audit</h3>
            <p className="modal-subtitle">
              Dispatch certified MOH health inspectors for on-site facility verification.
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Target Healthcare Facility</label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="modal-select"
            >
              {facilities.map((fac) => (
                <option key={fac.facilityId} value={fac.facilityId}>
                  {fac.facilityName} ({fac.region} • {fac.licenseNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Audit Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="modal-select"
              >
                <option value="clinical_safety">Clinical Safety & Patient Care</option>
                <option value="pharmacy_cold_chain">Pharmacy & Vaccine Cold-Chain</option>
                <option value="data_privacy_phi">PHI Privacy & HIPAA/GDPR Compliance</option>
                <option value="sanitation_infection">Sterilization & Infection Control</option>
                <option value="staff_credentialing">Doctor & Nurse Credentialing</option>
              </select>
            </div>

            <div className="form-group">
              <label>Lead Inspector / Directorate</label>
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                className="modal-input"
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Scheduled Inspection Date</label>
              <input
                type="date"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className="modal-input"
                required
              />
            </div>

            <div className="form-group">
              <label>Remediation Target Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="modal-input"
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-gold">
              <ShieldCheck size={15} />
              <span>Confirm & Issue Inspection Warrant</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
