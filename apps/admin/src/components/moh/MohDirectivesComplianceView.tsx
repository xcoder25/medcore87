'use client';

import React, { useMemo, useState } from 'react';
import {
  Send,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  ShieldAlert,
  Lock,
  Unlock,
  Camera,
  X,
} from 'lucide-react';
import type {
  MohAuditRecord,
  MohDirective,
  MohEnforcementAction,
  MohFacilityTelemetry,
  MohLiveSnapshot,
} from '../../lib/mohTypes';

interface MohDirectivesComplianceViewProps {
  snapshot: MohLiveSnapshot;
  officerName?: string;
  onBroadcastDirective: () => void;
  onUpdateDirectiveStatus: (id: string, status: MohDirective['status']) => Promise<void>;
  onScheduleAudit: (presetFacilityId?: string) => void;
  onUpdateAuditStatus: (
    id: string,
    patch: Partial<Pick<MohAuditRecord, 'status' | 'findingsCount' | 'criticalViolations' | 'notes'>>
  ) => Promise<void>;
  onSelectFacility: (facility: MohFacilityTelemetry) => void;
  onCreateEnforcement?: (input: {
    facilityId: string;
    facilityName?: string;
    lga?: string;
    district?: MohFacilityTelemetry['district'];
    actionType: MohEnforcementAction['actionType'];
    reason: string;
    checklist?: { label: string; passed: boolean }[];
    evidencePhotoData?: string;
    officerName: string;
    followUpDate?: string;
  }) => Promise<void>;
  onUpdateEnforcement?: (input: {
    id: string;
    status?: MohEnforcementAction['status'];
    followUpDate?: string;
    resolutionNotes?: string;
    unsealFacility?: boolean;
    updatedBy?: string;
  }) => Promise<void>;
}

const DEFAULT_CHECKLIST = [
  'Valid MOH Operating License displayed',
  'Licensed Medical / Nursing personnel on duty',
  'Approved scope of practice adhered to',
  'Minimum IPC & sterile equipment standards met',
];

export const MohDirectivesComplianceView: React.FC<MohDirectivesComplianceViewProps> = ({
  snapshot,
  officerName,
  onBroadcastDirective,
  onUpdateDirectiveStatus,
  onScheduleAudit,
  onUpdateAuditStatus,
  onSelectFacility,
  onCreateEnforcement,
  onUpdateEnforcement,
}) => {
  const [subTab, setSubTab] = useState<'directives' | 'audits' | 'enforcement'>('directives');
  const [enfOpen, setEnfOpen] = useState(false);
  const [enfFacId, setEnfFacId] = useState(snapshot.facilities[0]?.facilityId || 'IGH-EKT');
  const [enfActionType, setEnfActionType] = useState<MohEnforcementAction['actionType']>('sealed');
  const [enfReason, setEnfReason] = useState('');
  const [enfFollowUp, setEnfFollowUp] = useState('');
  const [enfChecks, setEnfChecks] = useState<{ label: string; passed: boolean }[]>(
    DEFAULT_CHECKLIST.map((label) => ({ label, passed: false }))
  );
  const [enfPhoto, setEnfPhoto] = useState<string>('');
  const [enfBusy, setEnfBusy] = useState(false);

  const { directives, audits, facilities, enforcement } = snapshot;
  const activeDirectives = directives.filter((d) => d.status === 'active').length;
  const openRemediations = audits.filter((a) => a.status === 'remediation_required').length;

  const licenseAlerts = useMemo(
    () =>
      facilities.filter(
        (f) => f.licenseAlert === 'expired' || f.licenseAlert === 'expiring_soon' || f.unapprovedPracticeFlag
      ),
    [facilities]
  );

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEnfPhoto(reader.result.slice(0, 500_000));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEnfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateEnforcement || !enfFacId || !enfReason.trim()) return;
    const fac = facilities.find((f) => f.facilityId === enfFacId);
    setEnfBusy(true);
    try {
      await onCreateEnforcement({
        facilityId: enfFacId,
        facilityName: fac?.facilityName,
        lga: fac?.lga,
        district: fac?.district,
        actionType: enfActionType,
        reason: enfReason.trim(),
        checklist: enfChecks,
        evidencePhotoData: enfPhoto || undefined,
        officerName: officerName || 'MOH Enforcement Taskforce',
        followUpDate: enfFollowUp,
      });
      setEnfReason('');
      setEnfFollowUp('');
      setEnfPhoto('');
      setEnfOpen(false);
    } finally {
      setEnfBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Directives, Licensing &amp; Anti-Quackery</h1>
          <p className="moh-view-sub">
            Official Ministry circulars, automated license renewal alerts, accreditation audits, and facility enforcement seals.
          </p>
        </div>
        {subTab === 'directives' ? (
          <button type="button" className="moh-btn-primary" onClick={onBroadcastDirective}>
            <Send size={15} />
            <span>Broadcast Directive</span>
          </button>
        ) : subTab === 'enforcement' && onCreateEnforcement ? (
          <button type="button" className="moh-btn-primary" onClick={() => setEnfOpen(true)}>
            <ShieldAlert size={15} />
            <span>Log Enforcement / Seal Facility</span>
          </button>
        ) : (
          <button type="button" className="moh-btn-primary" onClick={() => onScheduleAudit()}>
            <ClipboardCheck size={15} />
            <span>Schedule Inspection</span>
          </button>
        )}
      </div>

      {/* Sub-view switcher */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={subTab === 'directives' ? 'moh-btn-primary' : 'moh-btn-outline'}
          style={subTab === 'directives' ? { padding: '8px 14px', fontSize: '0.8rem' } : undefined}
          onClick={() => setSubTab('directives')}
        >
          <Send size={14} />
          <span>Official Directives ({directives.length})</span>
        </button>
        <button
          type="button"
          className={subTab === 'audits' ? 'moh-btn-primary' : 'moh-btn-outline'}
          style={subTab === 'audits' ? { padding: '8px 14px', fontSize: '0.8rem' } : undefined}
          onClick={() => setSubTab('audits')}
        >
          <ClipboardCheck size={14} />
          <span>Accreditation &amp; Renewals ({audits.length})</span>
        </button>
        <button
          type="button"
          className={subTab === 'enforcement' ? 'moh-btn-primary' : 'moh-btn-outline'}
          style={subTab === 'enforcement' ? { padding: '8px 14px', fontSize: '0.8rem' } : undefined}
          onClick={() => setSubTab('enforcement')}
        >
          <ShieldAlert size={14} />
          <span>Anti-Quackery &amp; Enforcement ({enforcement.length})</span>
        </button>
      </div>

      {subTab === 'directives' ? (
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">
              <Send size={17} color="#065F46" />
              <span>Statewide Ministry Directives</span>
            </h2>
            <span className={activeDirectives > 0 ? 'moh-pill emerald' : 'moh-pill slate'}>
              {activeDirectives} Active Circular(s)
            </span>
          </div>

          {directives.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: '0.86rem' }}>
              No Ministry directives have been broadcast yet. Click <strong>Broadcast Directive</strong> to notify connected hospitals.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {directives.map((dir) => (
                <div
                  key={dir.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '14px 16px',
                    background: dir.status === 'active' ? '#FFFFFF' : '#F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span className="moh-pill slate" style={{ fontFamily: 'monospace' }}>{dir.code}</span>
                        <span
                          className={`moh-pill ${
                            dir.severity === 'national_emergency'
                              ? 'danger'
                              : dir.severity === 'mandatory_order'
                              ? 'amber'
                              : 'emerald'
                          }`}
                        >
                          {dir.severity.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className={`moh-pill ${dir.status === 'active' ? 'emerald' : 'slate'}`}>
                          {dir.status === 'active' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0F172A' }}>{dir.title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 4 }}>{dir.summary}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {dir.status === 'active' ? (
                        <button
                          type="button"
                          className="moh-btn-outline"
                          onClick={() => void onUpdateDirectiveStatus(dir.id, 'completed')}
                        >
                          <CheckCircle2 size={14} />
                          <span>Mark Fulfilled</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="moh-btn-outline"
                          onClick={() => void onUpdateDirectiveStatus(dir.id, 'active')}
                        >
                          <span>Reopen</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {dir.mandatoryActions.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {dir.mandatoryActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                    <span>
                      Issued by <strong>{dir.issuedBy}</strong> · Districts: {dir.targetDistricts.join(', ') || 'All Districts'}
                    </span>
                    <span>
                      Acknowledgements: <strong>{dir.acknowledgedFacilities.length}</strong> / {facilities.filter((f) => f.enrollmentStatus === 'active').length} active hospitals
                      {dir.effectiveUntil ? ` · Effective until ${dir.effectiveUntil}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : subTab === 'audits' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Automated License Renewal & Unapproved Practice Tracker */}
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <AlertTriangle size={17} color="#D97706" />
                <span>Automated License Renewal &amp; Unapproved Practice Alerts ({licenseAlerts.length})</span>
              </h2>
            </div>
            {licenseAlerts.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                No expired licenses, pending 30-day renewals, or unapproved practice flags detected.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {licenseAlerts.map((fac) => (
                  <div
                    key={`lic-${fac.facilityId}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #FDE68A',
                      background: '#FFFBEB',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0F172A' }}>{fac.facilityName}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                        {fac.lga} · License: {fac.licenseNo || 'Pending'} · Expiry: {fac.licenseExpiry || 'Not set'}
                        {fac.unapprovedPracticeFlag ? ' · Flagged for unapproved clinical practice' : ''}
                      </div>
                    </div>
                    <button type="button" className="moh-btn-outline" onClick={() => onScheduleAudit(fac.facilityId)}>
                      Inspect Facility
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        <div className="moh-two-col">
          {/* Scheduled & Past Inspections */}
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <ClipboardCheck size={17} color="#065F46" />
                <span>Inspection &amp; Audit Queue</span>
              </h2>
              {openRemediations > 0 && (
                <span className="moh-pill amber">{openRemediations} Remediation Required</span>
              )}
            </div>

            {audits.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
                No facility inspections scheduled yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {audits.map((aud) => (
                  <div
                    key={aud.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: 13,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A' }}>
                          {aud.facilityName}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <Calendar size={12} />
                          <span>{aud.auditDate} · Auditor: {aud.auditorName}</span>
                        </div>
                      </div>
                      <span
                        className={`moh-pill ${
                          aud.status === 'passed'
                            ? 'emerald'
                            : aud.status === 'remediation_required'
                            ? 'danger'
                            : 'amber'
                        }`}
                      >
                        {aud.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    {aud.notes && (
                      <div style={{ fontSize: '0.79rem', color: '#475569' }}>{aud.notes}</div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {aud.status !== 'passed' && (
                        <button
                          type="button"
                          className="moh-btn-outline"
                          style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                          onClick={() => void onUpdateAuditStatus(aud.id, { status: 'passed', findingsCount: 0, criticalViolations: 0 })}
                        >
                          <CheckCircle2 size={13} />
                          <span>Mark Passed</span>
                        </button>
                      )}
                      {aud.status !== 'remediation_required' && (
                        <button
                          type="button"
                          className="moh-btn-outline"
                          style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                          onClick={() =>
                            void onUpdateAuditStatus(aud.id, {
                              status: 'remediation_required',
                              findingsCount: Math.max(1, aud.findingsCount),
                            })
                          }
                        >
                          <AlertTriangle size={13} />
                          <span>Flag Remediation</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HFR & Accreditation Readiness */}
          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <Building2 size={17} color="#065F46" />
                <span>Accreditation &amp; HFR Readiness</span>
              </h2>
              <span className="moh-pill slate">{facilities.length} Hospitals</span>
            </div>

            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>HFR Code</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.slice(0, 18).map((fac) => (
                    <tr
                      key={fac.facilityId}
                      className="moh-row-click"
                      onClick={() => onSelectFacility(fac)}
                    >
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>
                          {fac.facilityName}
                        </div>
                        <div style={{ fontSize: '0.71rem', color: '#64748B' }}>{fac.district}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>
                        {fac.hfrCode || <span style={{ color: '#D97706', fontWeight: 700 }}>Pending HFR</span>}
                      </td>
                      <td style={{ fontWeight: 700 }}>{fac.complianceScore}%</td>
                      <td>
                        <span
                          className={`moh-pill ${
                            fac.accreditationStatus === 'accredited'
                              ? 'emerald'
                              : fac.accreditationStatus === 'suspended'
                              ? 'danger'
                              : 'amber'
                          }`}
                        >
                          {fac.accreditationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-kpi-grid">
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Actively Sealed Facilities</div>
              <div className="moh-kpi-val" style={{ color: '#DC2626' }}>
                {facilities.filter((f) => f.operationalStatus === 'sealed').length}
              </div>
              <div className="moh-kpi-sub">Suspended from clinical operations</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Total Enforcement Actions</div>
              <div className="moh-kpi-val">{enforcement.length}</div>
              <div className="moh-kpi-sub">Taskforce raids, warnings &amp; inspections</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Pending Follow-Ups</div>
              <div className="moh-kpi-val" style={{ color: '#D97706' }}>
                {enforcement.filter((e) => e.status === 'follow_up' || e.status === 'active_seal').length}
              </div>
              <div className="moh-kpi-sub">Requiring field verification sign-off</div>
            </div>
          </div>

          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">
                <ShieldAlert size={17} color="#DC2626" />
                <span>Anti-Quackery &amp; Enforcement Field Log</span>
              </h2>
            </div>

            {enforcement.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
                No enforcement actions or seals recorded yet. Use <strong>Log Enforcement / Seal Facility</strong> to document inspections, checklists, and field photo evidence.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {enforcement.map((enf) => {
                  const passedCount = enf.checklist.filter((c) => c.passed).length;
                  return (
                    <div
                      key={enf.id}
                      style={{
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        padding: 14,
                        background: enf.status === 'active_seal' ? '#FEF2F2' : '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                            <span className={`moh-pill ${enf.actionType === 'sealed' || enf.actionType === 'quackery_raid' ? 'danger' : 'amber'}`}>
                              {enf.actionType.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            <code style={{ fontWeight: 700, color: '#065F46' }}>{enf.facilityId}</code>
                            {enf.checklist.length > 0 && (
                              <span className="moh-pill slate">
                                Checklist: {passedCount}/{enf.checklist.length} passed
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>{enf.facilityName}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                            Officer: {enf.officerName} · {enf.lga} ({enf.district})
                            {enf.followUpDate ? ` · Follow-up: ${enf.followUpDate}` : ''}
                          </div>
                        </div>
                        <span className={`moh-pill ${enf.status === 'resolved' ? 'emerald' : enf.status === 'active_seal' ? 'danger' : 'amber'}`}>
                          {enf.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.83rem', color: '#1E293B' }}>{enf.reason}</div>

                      {enf.evidencePhotoData && (
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                            Field Officer Photographic Evidence
                          </div>
                          <img
                            src={enf.evidencePhotoData}
                            alt={`Field evidence for ${enf.facilityName}`}
                            style={{ maxHeight: 160, borderRadius: 10, border: '1px solid #CBD5E1' }}
                          />
                        </div>
                      )}

                      {onUpdateEnforcement && enf.status !== 'resolved' && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {enf.status === 'active_seal' && (
                            <button
                              type="button"
                              className="moh-btn-outline"
                              style={{ padding: '5px 11px', fontSize: '0.75rem' }}
                              onClick={() =>
                                void onUpdateEnforcement({
                                  id: enf.id,
                                  status: 'resolved',
                                  unsealFacility: true,
                                  resolutionNotes: 'Compliance verified and seal lifted by MOH.',
                                  updatedBy: officerName,
                                })
                              }
                            >
                              <Unlock size={13} />
                              <span>Verify &amp; Lift Seal</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="moh-btn-outline"
                            style={{ padding: '5px 11px', fontSize: '0.75rem' }}
                            onClick={() =>
                              void onUpdateEnforcement({
                                id: enf.id,
                                status: 'resolved',
                                resolutionNotes: 'Compliance follow-up closed.',
                                updatedBy: officerName,
                              })
                            }
                          >
                            <CheckCircle2 size={13} />
                            <span>Close Action</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enforcement Log Modal */}
      {enfOpen && (
        <div className="moh-backdrop" onClick={() => !enfBusy && setEnfOpen(false)}>
          <div className="moh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Log Enforcement Action">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Log Enforcement / Anti-Quackery Action</h3>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  Sealing or flagging a facility automatically updates its GIS operational pin and accreditation standing.
                </div>
              </div>
              <button type="button" className="moh-icon-btn" onClick={() => setEnfOpen(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleEnfSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Target Facility *
                  <select className="moh-input" style={{ marginTop: 4 }} value={enfFacId} onChange={(e) => setEnfFacId(e.target.value)}>
                    {facilities.map((f) => (
                      <option key={f.facilityId} value={f.facilityId}>
                        {f.facilityName} ({f.facilityId})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Action Type *
                  <select className="moh-input" style={{ marginTop: 4 }} value={enfActionType} onChange={(e) => setEnfActionType(e.target.value as any)}>
                    <option value="sealed">Seal Facility Immediately</option>
                    <option value="quackery_raid">Anti-Quackery Raid &amp; Seal</option>
                    <option value="compliance_warning">Compliance Warning Notice</option>
                    <option value="inspection">Routine Enforcement Inspection</option>
                    <option value="unsealed">Lift Existing Seal</option>
                  </select>
                </label>
              </div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                Violation Findings &amp; Reason *
                <textarea
                  rows={2}
                  required
                  className="moh-textarea"
                  style={{ marginTop: 4 }}
                  value={enfReason}
                  onChange={(e) => setEnfReason(e.target.value)}
                  placeholder="Describe unlicensed practice, unqualified personnel, or safety breaches..."
                />
              </label>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>Inspection Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {enfChecks.map((item, idx) => (
                    <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
                      <input
                        type="checkbox"
                        checked={item.passed}
                        onChange={(e) =>
                          setEnfChecks((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, passed: e.target.checked } : row))
                          )
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Follow-up Inspection Date
                  <input type="date" className="moh-input" style={{ marginTop: 4 }} value={enfFollowUp} onChange={(e) => setEnfFollowUp(e.target.value)} />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Field Officer Photo Evidence
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="moh-btn-outline" style={{ padding: '6px 10px', fontSize: '0.76rem', cursor: 'pointer' }}>
                      <Camera size={14} />
                      <span>{enfPhoto ? 'Photo Attached' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    </label>
                  </div>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button type="button" className="moh-btn-outline" onClick={() => setEnfOpen(false)} disabled={enfBusy}>Cancel</button>
                <button type="submit" className="moh-btn-primary" disabled={enfBusy}>
                  <Lock size={14} />
                  <span>{enfBusy ? 'Recording…' : 'Record Enforcement Action'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
