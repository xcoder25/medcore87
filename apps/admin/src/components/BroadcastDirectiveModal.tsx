'use client';

import React, { useState } from 'react';
import type { RegulatoryDirective, DirectiveSeverity, FacilityTier } from '@medcore/types';
import { X, Send, AlertTriangle, ShieldAlert, CheckSquare } from 'lucide-react';

interface BroadcastDirectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBroadcast: (newDirective: RegulatoryDirective) => void;
}

export const BroadcastDirectiveModal: React.FC<BroadcastDirectiveModalProps> = ({
  isOpen,
  onClose,
  onBroadcast,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RegulatoryDirective['category']>('surge_capacity');
  const [severity, setSeverity] = useState<DirectiveSeverity>('mandatory_order');
  const [targetRegion, setTargetRegion] = useState('All Regions');
  const [targetTier, setTargetTier] = useState<FacilityTier | 'all'>('all');
  const [summary, setSummary] = useState('');
  const [mandatoryAction1, setMandatoryAction1] = useState('');
  const [mandatoryAction2, setMandatoryAction2] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      window.dispatchEvent(new CustomEvent('moh:notify', { detail: { title: 'Incomplete directive', body: 'Provide a title and operational summary before broadcast.', type: 'alert' } }));
      return;
    }

    const actions = [mandatoryAction1, mandatoryAction2].filter(Boolean);
    if (actions.length === 0) {
      actions.push('Report live bed telemetry every 60 minutes');
      actions.push('Enforce standard emergency triage protocols');
    }

    const newDirective: RegulatoryDirective = {
      directiveId: `DIR-${Date.now().toString().slice(-4)}`,
      code: `MOH-DIR-2026-${Math.floor(100 + Math.random() * 900)}`,
      title,
      category,
      severity,
      issuedDate: new Date().toISOString().split('T')[0],
      effectiveUntil: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      targetRegions: targetRegion === 'All Regions' ? ['Capital Central', 'Northern District', 'Eastern District', 'Western Province'] : [targetRegion],
      targetFacilityTiers: targetTier === 'all' 
        ? ['national_referral', 'regional_general', 'district_hospital', 'specialized_center'] 
        : [targetTier],
      summary,
      mandatoryActions: actions,
      complianceConfirmedCount: 0,
      totalTargetedFacilities: targetRegion === 'All Regions' ? 124 : 28,
      status: 'active',
    };

    onBroadcast(newDirective);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-icon-badge">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3>Broadcast Official Ministry of Health Directive</h3>
            <p className="modal-subtitle">
              Issue an authoritative operational mandate broadcast directly to hospital command centers.
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Directive Title / Subject</label>
            <input
              type="text"
              placeholder="e.g. Mandatory ICU Surge Escalation & Elective Suspension"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="modal-input"
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Classification & Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as DirectiveSeverity)}
                className="modal-select"
              >
                <option value="standard_guidance">Standard Guidance (Level 1)</option>
                <option value="stat_advisory">STAT Clinical Advisory (Level 2)</option>
                <option value="mandatory_order">Mandatory Regulatory Order (Level 3)</option>
                <option value="national_emergency">National Emergency Protocol (Level 4)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Directive Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="modal-select"
              >
                <option value="surge_capacity">Hospital Surge & Bed Capacity</option>
                <option value="infection_control">Infection Control & Containment</option>
                <option value="triage_protocol">ED Resuscitation & Triage Protocol</option>
                <option value="pharmaceutical_recall">Critical Drug / Vaccine Recall</option>
                <option value="credentialing_audit">Staff Credentialing Enforcement</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Target Jurisdiction / Region</label>
              <select
                value={targetRegion}
                onChange={(e) => setTargetRegion(e.target.value)}
                className="modal-select"
              >
                <option value="All Regions">Nationwide (All Regions)</option>
                <option value="Capital Central">Capital Central</option>
                <option value="Northern District">Northern District</option>
                <option value="Eastern District">Eastern District</option>
                <option value="Western Province">Western Province</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target Facility Tier</label>
              <select
                value={targetTier}
                onChange={(e) => setTargetTier(e.target.value as any)}
                className="modal-select"
              >
                <option value="all">All Healthcare Facilities</option>
                <option value="national_referral">National Referral Centers Only</option>
                <option value="regional_general">Regional General Hospitals</option>
                <option value="district_hospital">District Hospitals</option>
                <option value="specialized_center">Specialized Clinics</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Operational Executive Summary</label>
            <textarea
              placeholder="Describe the clinical rationale, trigger thresholds, and mandatory regulatory instructions for hospital chief executives..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="modal-textarea"
              required
            />
          </div>

          <div className="form-group">
            <label>Mandatory Hospital Action Items</label>
            <div className="mandatory-action-inputs">
              <div className="action-input-row">
                <CheckSquare size={16} className="text-muted" />
                <input
                  type="text"
                  placeholder="Primary Action: e.g. Open 20% surge reserve beds within 12 hours"
                  value={mandatoryAction1}
                  onChange={(e) => setMandatoryAction1(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div className="action-input-row">
                <CheckSquare size={16} className="text-muted" />
                <input
                  type="text"
                  placeholder="Secondary Action: e.g. Mandate N95 masks across all pediatric wards"
                  value={mandatoryAction2}
                  onChange={(e) => setMandatoryAction2(e.target.value)}
                  className="modal-input"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-danger">
              <Send size={15} />
              <span>Broadcast Official Directive Now</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
