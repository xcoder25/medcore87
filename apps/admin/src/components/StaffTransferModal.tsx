'use client';

import React, { useState, useEffect } from 'react';
import type { 
  HealthcareWorkerRegistry, 
  StaffTransferRecord, 
  StaffTransferType, 
  StaffTransferReason 
} from '@medcore/types';
import { 
  X, 
  Send, 
  ArrowRight, 
  AlertTriangle, 
  ShieldAlert, 
  Building2, 
  Stethoscope, 
  Sparkles, 
  Clock, 
  Award,
  Calendar
} from 'lucide-react';

interface StaffTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: HealthcareWorkerRegistry[];
  selectedWorkerId?: string;
  targetRegionPreset?: string;
  onTransferDispatched: (transfer: StaffTransferRecord) => void;
}

interface FacilityOption {
  id: string;
  name: string;
  region: string;
  tier: string;
  deficits: string[];
}

const AVAILABLE_FACILITIES: FacilityOption[] = [
  {
    id: 'FAC-001',
    name: 'National Referral Hospital & Trauma Centre',
    region: 'Capital Central',
    tier: 'National Referral / Quaternary',
    deficits: ['Pediatric Surgery'],
  },
  {
    id: 'FAC-002',
    name: 'St. Jude Metropolitan General',
    region: 'Northern District',
    tier: 'Regional General Hospital',
    deficits: ['Adult Intensivists', 'Nephrology'],
  },
  {
    id: 'FAC-003',
    name: 'Eastern Coastal Children’s & Maternal Hospital',
    region: 'Eastern District',
    tier: 'Specialized Center',
    deficits: ['Neonatal Intensive Care', 'Trauma Surgery'],
  },
  {
    id: 'FAC-004',
    name: 'Western Valley Community Hospital',
    region: 'Western Province',
    tier: 'District Hospital (Critical Deficit)',
    deficits: ['Cardiology', 'Obstetric Emergency', 'Anesthesiology & Critical Care'],
  },
];

export const StaffTransferModal: React.FC<StaffTransferModalProps> = ({
  isOpen,
  onClose,
  workers,
  selectedWorkerId,
  targetRegionPreset,
  onTransferDispatched,
}) => {
  const [workerId, setWorkerId] = useState<string>(selectedWorkerId || workers[0]?.workerId || '');
  const [targetFacilityId, setTargetFacilityId] = useState<string>('');
  const [transferType, setTransferType] = useState<StaffTransferType>('temporary_surge');
  const [reason, setReason] = useState<StaffTransferReason>('critical_deficit_relief');
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'immediate_code_red'>('urgent');
  const [durationWeeks, setDurationWeeks] = useState<number>(8);
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [authorizingOfficer, setAuthorizingOfficer] = useState<string>(
    'Dr. Ibrahim Al-Mansoor (Health Commissioner)'
  );
  const [notes, setNotes] = useState<string>('');

  // Synchronize when props change
  useEffect(() => {
    if (selectedWorkerId) {
      setWorkerId(selectedWorkerId);
    } else if (workers.length > 0 && !workerId) {
      setWorkerId(workers[0].workerId);
    }
  }, [selectedWorkerId, workers]);

  useEffect(() => {
    if (targetRegionPreset) {
      const match = AVAILABLE_FACILITIES.find((f) => f.region === targetRegionPreset);
      if (match) setTargetFacilityId(match.id);
    } else if (!targetFacilityId) {
      // Default to Western Valley (critical deficit)
      setTargetFacilityId('FAC-004');
    }
  }, [targetRegionPreset]);

  if (!isOpen) return null;

  const currentWorker = workers.find((w) => w.workerId === workerId) || workers[0];
  const targetFacility = AVAILABLE_FACILITIES.find((f) => f.id === targetFacilityId) || AVAILABLE_FACILITIES[3];

  // Prevent transferring to the same facility
  const isSameFacility = currentWorker && currentWorker.assignedFacilityId === targetFacility.id;

  // Check if clinician's specialty helps resolve target facility's deficit
  const isDeficitReliefMatch = targetFacility?.deficits.some((d) =>
    currentWorker?.primarySpecialty.toLowerCase().includes(d.toLowerCase()) ||
    d.toLowerCase().includes(currentWorker?.cadre.toLowerCase() || '')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorker) return;

    if (isSameFacility) {
      window.dispatchEvent(
        new CustomEvent('moh:notify', {
          detail: {
            title: 'Invalid Destination',
            body: 'Clinician is already deployed at this facility. Select a different target facility.',
            type: 'alert',
          },
        })
      );
      return;
    }

    const transferRecord: StaffTransferRecord = {
      transferId: `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      workerId: currentWorker.workerId,
      workerName: currentWorker.fullName,
      cadre: currentWorker.cadre,
      primarySpecialty: currentWorker.primarySpecialty,
      sourceFacilityId: currentWorker.assignedFacilityId,
      sourceFacilityName: currentWorker.assignedFacilityName,
      sourceRegion: currentWorker.region,
      targetFacilityId: targetFacility.id,
      targetFacilityName: targetFacility.name,
      targetRegion: targetFacility.region,
      transferType,
      reason,
      urgency,
      effectiveDate,
      durationWeeks: transferType === 'permanent_reassignment' ? undefined : durationWeeks,
      authorizingOfficer,
      status: urgency === 'immediate_code_red' ? 'dispatched' : 'pending_approval',
      notes: notes.trim() || `Ministerial surge order for ${targetFacility.region} healthcare coverage.`,
      createdAt: new Date().toISOString(),
    };

    onTransferDispatched(transferRecord);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window modal-window--wide" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-icon-badge gold">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3>Ministerial Clinician Transfer & Surge Redeployment Directive</h3>
            <p className="modal-subtitle">
              Issue an authoritative inter-facility deployment order under the National Health Act
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Clinician Selection Section */}
          <div className="transfer-card-panel">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label-with-icon">
                <Stethoscope size={14} /> Select Registered Clinician
              </label>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="modal-select"
                required
              >
                {workers.map((w) => (
                  <option key={w.workerId} value={w.workerId}>
                    {w.fullName} — {w.cadre} ({w.assignedFacilityName}, {w.region})
                  </option>
                ))}
              </select>
            </div>

            {currentWorker && (
              <div className="transfer-clinician-dossier">
                <div className="dossier-col">
                  <span className="dossier-label">Specialty & Cadre</span>
                  <span className="dossier-value">{currentWorker.primarySpecialty}</span>
                  <span className="cadre-pill">{currentWorker.cadre}</span>
                </div>
                <div className="dossier-col">
                  <span className="dossier-label">Current Deployment</span>
                  <span className="dossier-value">{currentWorker.assignedFacilityName}</span>
                  <span className="dossier-sub">{currentWorker.region}</span>
                </div>
                <div className="dossier-col">
                  <span className="dossier-label">MDCN / Licensing Status</span>
                  <span className="license-code">{currentWorker.licenseNumber}</span>
                  <span className="dossier-sub text-good">
                    {currentWorker.yearsOfPractice} Years Clinical Experience
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Transfer Pathway: Source -> Destination */}
          <div className="transfer-pathway-box">
            <div className="pathway-node source">
              <span className="pathway-tag">Current Facility (Source)</span>
              <strong>{currentWorker?.assignedFacilityName || 'Selected Origin'}</strong>
              <div className="pathway-region">{currentWorker?.region}</div>
            </div>

            <div className="pathway-arrow-cluster">
              <ArrowRight size={22} className="pathway-arrow-icon" />
              <span className={`urgency-badge urgency-badge--${urgency}`}>
                {urgency === 'immediate_code_red' ? 'CODE RED STAT' : urgency.toUpperCase()}
              </span>
            </div>

            <div className="pathway-node target">
              <span className="pathway-tag">Destination Facility (Target)</span>
              <select
                value={targetFacilityId}
                onChange={(e) => setTargetFacilityId(e.target.value)}
                className="modal-select pathway-select"
                required
              >
                {AVAILABLE_FACILITIES.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({fac.region})
                  </option>
                ))}
              </select>
              <div className="pathway-region">{targetFacility?.region}</div>
            </div>
          </div>

          {/* Deficit Match Impact Banner */}
          {isDeficitReliefMatch && (
            <div className="transfer-deficit-match-banner">
              <Sparkles size={16} className="text-gold" />
              <div>
                <strong>High-Priority Shortage Relief Match</strong>
                <p>
                  Deploying {currentWorker.fullName} directly alleviates documented specialist shortages in {targetFacility.region} ({targetFacility.deficits.join(', ')}).
                </p>
              </div>
            </div>
          )}

          {isSameFacility && (
            <div className="transfer-warning-banner">
              <AlertTriangle size={16} />
              <span>
                Target facility matches current facility. Select a different hospital for transfer.
              </span>
            </div>
          )}

          {/* Transfer Parameters Grid */}
          <div className="form-row-2">
            <div className="form-group">
              <label>Transfer Type & Scope</label>
              <select
                value={transferType}
                onChange={(e) => setTransferType(e.target.value as StaffTransferType)}
                className="modal-select"
              >
                <option value="temporary_surge">Temporary Surge Deployment (Time-Bound)</option>
                <option value="emergency_mutual_aid">Emergency Mutual Aid (Acute Code Red)</option>
                <option value="specialist_rotation">Specialist Clinical Rotation</option>
                <option value="permanent_reassignment">Permanent Reassignment (Full Transfer)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Operational Rationale / Cause</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as StaffTransferReason)}
                className="modal-select"
              >
                <option value="critical_deficit_relief">Critical Regional Deficit Relief</option>
                <option value="emergency_surge">Emergency Surge & High ICU Utilization</option>
                <option value="outbreak_surveillance">Epidemic / Outbreak Containment Response</option>
                <option value="maternal_child_intervention">Maternal & Neonatal Mortality Prevention</option>
                <option value="specialist_rotation">Standard Specialty Residency Rotation</option>
                <option value="facility_request">Receiving Hospital CMD Formal Request</option>
              </select>
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label>Urgency Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="modal-select"
              >
                <option value="immediate_code_red">Immediate Code Red (Active Surge)</option>
                <option value="urgent">Urgent (Deployment within 48h)</option>
                <option value="routine">Routine Administrative (7 Days)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Effective Date</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="modal-input"
                required
              />
            </div>

            <div className="form-group">
              <label>Surge Duration (Weeks)</label>
              <input
                type="number"
                min="1"
                max="52"
                disabled={transferType === 'permanent_reassignment'}
                value={transferType === 'permanent_reassignment' ? '' : durationWeeks}
                onChange={(e) => setDurationWeeks(parseInt(e.target.value, 10) || 4)}
                placeholder={transferType === 'permanent_reassignment' ? 'Permanent' : 'Weeks'}
                className="modal-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Authorizing Ministerial Officer</label>
            <input
              type="text"
              value={authorizingOfficer}
              onChange={(e) => setAuthorizingOfficer(e.target.value)}
              className="modal-input"
              required
            />
          </div>

          <div className="form-group">
            <label>Operational Orders & Coverage Directives (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Assigned to Lead Intensivist coverage for COVID/RSV surge ward. Direct report to Chief Medical Officer."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="modal-textarea"
            />
          </div>

          {/* Modal Footer / Submit Action */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-gold"
              disabled={isSameFacility}
            >
              <Send size={15} />
              <span>Issue Ministerial Transfer Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
