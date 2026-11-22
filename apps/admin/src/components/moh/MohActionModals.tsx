'use client';

import React, { useState } from 'react';
import { X, Send, ClipboardCheck, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { SENATORIAL_DISTRICTS } from '../../data/akwaIbomFacilities';
import type { MohFacilityTelemetry } from '../../lib/mohTypes';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  issuedBy: string;
  onSubmit: (payload: {
    title: string;
    summary: string;
    category: string;
    severity: 'mandatory_order' | 'stat_advisory' | 'national_emergency' | 'standard_guidance';
    targetDistricts: string[];
    mandatoryActions: string[];
    effectiveUntil: string;
    issuedBy: string;
  }) => Promise<void>;
}

export const BroadcastDirectiveModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  issuedBy,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('clinical_governance');
  const [severity, setSeverity] = useState<'mandatory_order' | 'stat_advisory' | 'national_emergency' | 'standard_guidance'>('mandatory_order');
  const [districts, setDistricts] = useState<string[]>([...SENATORIAL_DISTRICTS]);
  const [actionsText, setActionsText] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const toggleDistrict = (d: string) => {
    setDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!title.trim() || !summary.trim() || districts.length === 0) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        summary: summary.trim(),
        category,
        severity,
        targetDistricts: districts,
        mandatoryActions: actionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        effectiveUntil,
        issuedBy,
      });
      setTitle('');
      setSummary('');
      setActionsText('');
      setEffectiveUntil('');
      setAttempted(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="moh-backdrop" onClick={() => !busy && onClose()}>
      <div className="moh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Broadcast Regulatory Directive">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Broadcast Official Directive</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
              Pushes an official notice directly to connected hospital administrator consoles.
            </p>
          </div>
          <button type="button" className="moh-icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Directive Title *
            <input
              className={`moh-input${attempted && !title.trim() ? ' moh-input-error' : ''}`}
              style={{ marginTop: 4 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Emergency Paediatric Ward Standby Protocol"
            />
          </label>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Severity
              <select className="moh-input" style={{ marginTop: 4 }} value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                <option value="mandatory_order">Mandatory Order</option>
                <option value="stat_advisory">STAT Advisory</option>
                <option value="national_emergency">State Emergency Order</option>
                <option value="standard_guidance">Standard Guidance</option>
              </select>
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Effective Until
              <input type="date" className="moh-input" style={{ marginTop: 4 }} value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} />
            </label>
          </div>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Category
            <select className="moh-input" style={{ marginTop: 4 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="clinical_governance">Clinical Governance</option>
              <option value="surge_capacity">Bed & ICU Surge Capacity</option>
              <option value="pharmaceutical_cold_chain">Pharmacy & Cold-Chain</option>
              <option value="disease_surveillance">Disease Surveillance</option>
              <option value="revenue_compliance">Treasury & AkwaRemit Compliance</option>
            </select>
          </label>

          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>Target Senatorial Districts *</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SENATORIAL_DISTRICTS.map((d) => {
                const active = districts.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDistrict(d)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: `1px solid ${active ? '#065F46' : attempted && districts.length === 0 ? '#DC2626' : '#CBD5E1'}`,
                      background: active ? '#ECFDF5' : '#FFFFFF',
                      color: active ? '#065F46' : '#475569',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {d} District
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Executive Summary *
            <textarea
              rows={3}
              className={`moh-textarea${attempted && !summary.trim() ? ' moh-input-error' : ''}`}
              style={{ marginTop: 4 }}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Clear regulatory instruction and expected facility compliance actions..."
            />
          </label>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Mandatory Action Checklist (one per line)
            <textarea
              rows={3}
              className="moh-textarea"
              style={{ marginTop: 4 }}
              value={actionsText}
              onChange={(e) => setActionsText(e.target.value)}
              placeholder="Submit daily bed census by 08:00 WAT&#10;Verify oxygen reserve levels"
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="moh-btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="moh-btn-primary" disabled={busy}>
              <Send size={14} />
              <span>{busy ? 'Broadcasting…' : 'Broadcast Directive'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: MohFacilityTelemetry[];
  presetFacilityId?: string;
  onSubmit: (payload: {
    facilityId: string;
    facilityName: string;
    auditDate: string;
    auditorName: string;
    category: string;
    resolutionDeadline: string;
    notes: string;
  }) => Promise<void>;
}

export const ScheduleAuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  facilities,
  presetFacilityId,
  onSubmit,
}) => {
  const [facilityId, setFacilityId] = useState(presetFacilityId || facilities[0]?.facilityId || 'IGH-EKT');
  const [auditDate, setAuditDate] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [category, setCategory] = useState('clinical_safety');
  const [resolutionDeadline, setResolutionDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (presetFacilityId) setFacilityId(presetFacilityId);
  }, [presetFacilityId]);

  if (!isOpen) return null;

  const selectedFac = facilities.find((f) => f.facilityId === facilityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!facilityId || !auditDate.trim() || !auditorName.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        facilityId,
        facilityName: selectedFac?.facilityName || facilityId,
        auditDate,
        auditorName: auditorName.trim(),
        category,
        resolutionDeadline,
        notes: notes.trim(),
      });
      setAuditDate('');
      setAuditorName('');
      setResolutionDeadline('');
      setNotes('');
      setAttempted(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="moh-backdrop" onClick={() => !busy && onClose()}>
      <div className="moh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Schedule Facility Audit">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Schedule Facility Inspection</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
              Assign an inspection docket and notify the Hospital Administrator.
            </p>
          </div>
          <button type="button" className="moh-icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Target Health Facility *
            <select className="moh-input" style={{ marginTop: 4 }} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              {facilities.map((f) => (
                <option key={f.facilityId} value={f.facilityId}>
                  {f.facilityName} ({f.facilityId})
                </option>
              ))}
            </select>
          </label>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Inspection Date *
              <input
                type="date"
                className={`moh-input${attempted && !auditDate ? ' moh-input-error' : ''}`}
                style={{ marginTop: 4 }}
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
              />
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Inspection Domain
              <select className="moh-input" style={{ marginTop: 4 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="clinical_safety">Clinical Safety & Triage</option>
                <option value="pharmacy_cold_chain">Pharmacy & Cold-Chain</option>
                <option value="hfr_accreditation">HFR & Licensing Verification</option>
                <option value="data_privacy_phi">NDPR & Data Privacy</option>
                <option value="financial_treasury">Treasury & AkwaRemit Controls</option>
              </select>
            </label>
          </div>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Lead MOH Inspector *
              <input
                className={`moh-input${attempted && !auditorName.trim() ? ' moh-input-error' : ''}`}
                style={{ marginTop: 4 }}
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                placeholder="e.g. Dr. Idongesit Akpan"
              />
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Remediation Deadline
              <input type="date" className="moh-input" style={{ marginTop: 4 }} value={resolutionDeadline} onChange={(e) => setResolutionDeadline(e.target.value)} />
            </label>
          </div>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Inspection Scope Notes
            <textarea
              rows={2}
              className="moh-textarea"
              style={{ marginTop: 4 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specific units or compliance documents to inspect..."
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="moh-btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="moh-btn-primary" disabled={busy}>
              <ClipboardCheck size={14} />
              <span>{busy ? 'Scheduling…' : 'Schedule Inspection'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: MohFacilityTelemetry[];
  requestedBy: string;
  onSubmit: (payload: {
    staffBadge: string;
    staffName: string;
    cadre: string;
    fromFacilityId: string;
    fromFacilityName: string;
    toFacilityId: string;
    toFacilityName: string;
    transferType: 'temporary_surge' | 'emergency_mutual_aid' | 'specialist_rotation' | 'permanent_reassignment';
    urgency: 'routine' | 'urgent' | 'immediate_code_red';
    reason: string;
    requestedBy: string;
  }) => Promise<void>;
}

export const CreateTransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  facilities,
  requestedBy,
  onSubmit,
}) => {
  const [staffName, setStaffName] = useState('');
  const [staffBadge, setStaffBadge] = useState('');
  const [cadre, setCadre] = useState('Medical Officer');
  const [fromFacilityId, setFromFacilityId] = useState(facilities[0]?.facilityId || 'IGH-EKT');
  const [toFacilityId, setToFacilityId] = useState(facilities[1]?.facilityId || facilities[0]?.facilityId || 'GH-IKE');
  const [transferType, setTransferType] = useState<'temporary_surge' | 'emergency_mutual_aid' | 'specialist_rotation' | 'permanent_reassignment'>('temporary_surge');
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'immediate_code_red'>('routine');
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const fromFac = facilities.find((f) => f.facilityId === fromFacilityId);
  const toFac = facilities.find((f) => f.facilityId === toFacilityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!staffName.trim() || !reason.trim() || fromFacilityId === toFacilityId) return;
    setBusy(true);
    try {
      await onSubmit({
        staffBadge: staffBadge.trim(),
        staffName: staffName.trim(),
        cadre: cadre.trim(),
        fromFacilityId,
        fromFacilityName: fromFac?.facilityName || fromFacilityId,
        toFacilityId,
        toFacilityName: toFac?.facilityName || toFacilityId,
        transferType,
        urgency,
        reason: reason.trim(),
        requestedBy,
      });
      setStaffName('');
      setStaffBadge('');
      setReason('');
      setAttempted(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="moh-backdrop" onClick={() => !busy && onClose()}>
      <div className="moh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Dispatch Inter-Facility Transfer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Inter-Facility Staff Transfer</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
              Create a state deployment order between Akwa Ibom health facilities.
            </p>
          </div>
          <button type="button" className="moh-icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Clinician Full Name *
              <input
                className={`moh-input${attempted && !staffName.trim() ? ' moh-input-error' : ''}`}
                style={{ marginTop: 4 }}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Dr. Iniobong Udoh"
              />
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Staff Badge ID (Optional)
              <input className="moh-input" style={{ marginTop: 4 }} value={staffBadge} onChange={(e) => setStaffBadge(e.target.value.toUpperCase())} placeholder="e.g. IGH-2026-1002" />
            </label>
          </div>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Cadre / Specialty
              <input className="moh-input" style={{ marginTop: 4 }} value={cadre} onChange={(e) => setCadre(e.target.value)} />
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Priority
              <select className="moh-input" style={{ marginTop: 4 }} value={urgency} onChange={(e) => setUrgency(e.target.value as any)}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="immediate_code_red">Immediate Surge</option>
              </select>
            </label>
          </div>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Origin Facility *
              <select className="moh-input" style={{ marginTop: 4 }} value={fromFacilityId} onChange={(e) => setFromFacilityId(e.target.value)}>
                {facilities.map((f) => (
                  <option key={f.facilityId} value={f.facilityId}>
                    {f.facilityName}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Destination Facility *
              <select
                className={`moh-input${attempted && fromFacilityId === toFacilityId ? ' moh-input-error' : ''}`}
                style={{ marginTop: 4 }}
                value={toFacilityId}
                onChange={(e) => setToFacilityId(e.target.value)}
              >
                {facilities.map((f) => (
                  <option key={f.facilityId} value={f.facilityId}>
                    {f.facilityName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Deployment Type
            <select className="moh-input" style={{ marginTop: 4 }} value={transferType} onChange={(e) => setTransferType(e.target.value as any)}>
              <option value="temporary_surge">Temporary Surge Support</option>
              <option value="emergency_mutual_aid">Emergency Mutual Aid</option>
              <option value="specialist_rotation">Specialist Rotation</option>
              <option value="permanent_reassignment">Permanent Reassignment</option>
            </select>
          </label>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Clinical / Operational Justification *
            <textarea
              rows={2}
              className={`moh-textarea${attempted && !reason.trim() ? ' moh-input-error' : ''}`}
              style={{ marginTop: 4 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for redeployment..."
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="moh-btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="moh-btn-primary" disabled={busy}>
              <ArrowRightLeft size={14} />
              <span>{busy ? 'Submitting…' : 'Create Transfer Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    condition: string;
    icd10Category: string;
    detectedCases: number;
    rateOfIncrease: number;
    affectedDistricts: string[];
    severity: 'advisory' | 'warning' | 'emergency';
    reportingFacilities: number;
    notes: string;
  }) => Promise<void>;
}

export const CreateAlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [condition, setCondition] = useState('');
  const [icd10Category, setIcd10Category] = useState('');
  const [detectedCases, setDetectedCases] = useState(1);
  const [severity, setSeverity] = useState<'advisory' | 'warning' | 'emergency'>('warning');
  const [districts, setDistricts] = useState<string[]>(['Uyo']);
  const [notes, setNotes] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!condition.trim() || districts.length === 0) return;
    setBusy(true);
    try {
      await onSubmit({
        condition: condition.trim(),
        icd10Category: icd10Category.trim() || 'Syndromic Alert',
        detectedCases: Math.max(1, Number(detectedCases) || 1),
        rateOfIncrease: 0,
        affectedDistricts: districts,
        severity,
        reportingFacilities: 1,
        notes: notes.trim(),
      });
      setCondition('');
      setIcd10Category('');
      setNotes('');
      setAttempted(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="moh-backdrop" onClick={() => !busy && onClose()}>
      <div className="moh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Issue Surveillance Bulletin">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Issue Epidemiological Bulletin</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748B' }}>
              Log a state disease surveillance signal and activate regional containment tracking.
            </p>
          </div>
          <button type="button" className="moh-icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Condition / Syndrome *
            <input
              className={`moh-input${attempted && !condition.trim() ? ' moh-input-error' : ''}`}
              style={{ marginTop: 4 }}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. Acute Watery Diarrhoea Cluster"
            />
          </label>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              ICD-10 Code / Classification
              <input className="moh-input" style={{ marginTop: 4 }} value={icd10Category} onChange={(e) => setIcd10Category(e.target.value)} placeholder="e.g. A00.9" />
            </label>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Initial Confirmed Cases
              <input type="number" min={1} className="moh-input" style={{ marginTop: 4 }} value={detectedCases} onChange={(e) => setDetectedCases(Number(e.target.value) || 1)} />
            </label>
          </div>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Severity Level
              <select className="moh-input" style={{ marginTop: 4 }} value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                <option value="advisory">Advisory</option>
                <option value="warning">Warning</option>
                <option value="emergency">State Emergency</option>
              </select>
            </label>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>Affected Districts *</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SENATORIAL_DISTRICTS.map((d) => {
                  const active = districts.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: `1px solid ${active ? '#065F46' : '#CBD5E1'}`,
                        background: active ? '#ECFDF5' : '#FFFFFF',
                        color: active ? '#065F46' : '#475569',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Containment Notes
            <textarea rows={2} className="moh-textarea" style={{ marginTop: 4 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="moh-btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="moh-btn-primary" disabled={busy}>
              <AlertTriangle size={14} />
              <span>{busy ? 'Issuing…' : 'Issue Surveillance Alert'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
