'use client';

import React, { useState } from 'react';
import { X, Building2, ShieldCheck, BedDouble, Users, Wallet, ClipboardCheck, AlertTriangle } from 'lucide-react';
import type { MohFacilityTelemetry } from '../../lib/mohTypes';

interface MohFacilityDrawerProps {
  facility: MohFacilityTelemetry | null;
  onClose: () => void;
  onOpenFullDossier?: (facilityId: string) => void;
  onUpdateOversight: (payload: {
    facilityId: string;
    emergencyStatus: MohFacilityTelemetry['emergencyStatus'];
    accreditationStatus: MohFacilityTelemetry['accreditationStatus'];
    notes: string;
  }) => Promise<void>;
  onScheduleAudit: (facilityId: string) => void;
}

function fmtNaira(val: number): string {
  return `₦${Math.round(val).toLocaleString('en-NG')}`;
}

export const MohFacilityDrawer: React.FC<MohFacilityDrawerProps> = ({
  facility,
  onClose,
  onOpenFullDossier,
  onUpdateOversight,
  onScheduleAudit,
}) => {
  const [emergencyStatus, setEmergencyStatus] = useState<MohFacilityTelemetry['emergencyStatus']>(
    facility?.emergencyStatus || 'normal'
  );
  const [accreditationStatus, setAccreditationStatus] = useState<MohFacilityTelemetry['accreditationStatus']>(
    facility?.accreditationStatus || 'pending'
  );
  const [notes, setNotes] = useState(facility?.notes || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (facility) {
      setEmergencyStatus(facility.emergencyStatus);
      setAccreditationStatus(facility.accreditationStatus);
      setNotes(facility.notes || '');
    }
  }, [facility]);

  if (!facility) return null;

  const bedPct = facility.totalBeds > 0 ? Math.round((facility.occupiedBeds / facility.totalBeds) * 100) : 0;

  return (
    <div className="moh-drawer-backdrop" onClick={() => !saving && onClose()}>
      <div className="moh-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Facility Oversight Drawer">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ECFDF5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="moh-pill slate" style={{ fontFamily: 'monospace' }}>{facility.facilityId}</span>
                <span className={`moh-pill ${facility.enrollmentStatus === 'active' ? 'emerald' : 'slate'}`}>
                  {facility.enrollmentStatus === 'active' ? 'Connected' : 'Pending Enrollment'}
                </span>
              </div>
              <h2 style={{ margin: '6px 0 2px', fontSize: '1.08rem', fontWeight: 800, color: '#0F172A' }}>
                {facility.facilityName}
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {facility.district} Senatorial District · {facility.lga} · {facility.supervisoryBoard}
              </div>
            </div>
          </div>
          <button type="button" className="moh-icon-btn" onClick={onClose} disabled={saving} aria-label="Close drawer">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {onOpenFullDossier && (
            <button
              type="button"
              className="moh-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onOpenFullDossier(facility.facilityId)}
            >
              <span>Open Full 360° Hospital Dossier →</span>
            </button>
          )}

          {/* Governance & Statutory Metadata */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Regulatory & HFR Compliance
              </span>
              <span className={`moh-pill ${facility.complianceScore >= 75 ? 'emerald' : facility.complianceScore > 0 ? 'amber' : 'slate'}`}>
                <ShieldCheck size={12} /> Score {facility.complianceScore}%
              </span>
            </div>
            <div className="moh-two-col" style={{ gap: 10, fontSize: '0.8rem' }}>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Federal HFR Code</div>
                <strong>{facility.hfrCode || 'Not yet submitted'}</strong>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Medical Director (CMD)</div>
                <strong>{facility.medicalDirector || 'Unassigned'}</strong>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Supervisory Board</div>
                <strong>{facility.supervisoryBoard || facility.board}</strong>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '0.72rem' }}>Board Circular Ref</div>
                <strong>{facility.boardAuthCircularRef || 'Pending'}</strong>
              </div>
            </div>
          </div>

          {/* Live Telemetry Snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <BedDouble size={13} /> BEDS
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                {facility.occupiedBeds}/{facility.totalBeds}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{bedPct}% occupied</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={13} /> STAFF
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 4 }}>
                {facility.activeStaffCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{facility.activeOpdVisits} active OPD</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wallet size={13} /> REVENUE
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, marginTop: 4 }}>
                {fmtNaira(facility.revenuePaidNgn)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{fmtNaira(facility.revenuePendingNgn)} pending</div>
            </div>
          </div>

          {/* Ward Capacity */}
          {facility.wardBreakdown.length > 0 && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Ward Occupancy</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {facility.wardBreakdown.map((w) => {
                  const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                  return (
                    <div key={w.ward} style={{ fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{w.ward}</span>
                        <span style={{ color: '#64748B' }}>{w.occupied}/{w.total} ({pct}%)</span>
                      </div>
                      <div className="moh-meter">
                        <div className={`moh-meter-fill ${pct >= 90 ? 'danger' : pct >= 75 ? 'amber' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Oversight Controls (Persisted to DB) */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} color="#D97706" /> Ministerial Oversight Status
            </div>

            <div className="moh-two-col" style={{ gap: 10 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                Emergency Status
                <select className="moh-input" style={{ marginTop: 4 }} value={emergencyStatus} onChange={(e) => setEmergencyStatus(e.target.value as any)}>
                  <option value="normal">Normal Operations</option>
                  <option value="surge_code_yellow">Surge Advisory (Code Yellow)</option>
                  <option value="surge_code_red">Critical Diversion (Code Red)</option>
                  <option value="critical">System Critical</option>
                </select>
              </label>

              <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                Accreditation
                <select className="moh-input" style={{ marginTop: 4 }} value={accreditationStatus} onChange={(e) => setAccreditationStatus(e.target.value as any)}>
                  <option value="accredited">Accredited</option>
                  <option value="provisional">Provisional</option>
                  <option value="pending">Pending Verification</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
            </div>

            <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
              Inspector Note
              <textarea rows={2} className="moh-textarea" style={{ marginTop: 4 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ministerial note or remediation instruction..." />
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="moh-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onUpdateOversight({
                      facilityId: facility.facilityId,
                      emergencyStatus,
                      accreditationStatus,
                      notes,
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'Saving Status…' : 'Save Oversight Update'}
              </button>
              <button
                type="button"
                className="moh-btn-outline"
                onClick={() => onScheduleAudit(facility.facilityId)}
              >
                <ClipboardCheck size={14} /> Schedule Audit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
