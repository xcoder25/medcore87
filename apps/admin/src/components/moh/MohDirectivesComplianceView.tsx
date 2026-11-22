'use client';

import React, { useState } from 'react';
import {
  Send,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
} from 'lucide-react';
import type {
  MohAuditRecord,
  MohDirective,
  MohFacilityTelemetry,
  MohLiveSnapshot,
} from '../../lib/mohTypes';

interface MohDirectivesComplianceViewProps {
  snapshot: MohLiveSnapshot;
  onBroadcastDirective: () => void;
  onUpdateDirectiveStatus: (id: string, status: MohDirective['status']) => Promise<void>;
  onScheduleAudit: (presetFacilityId?: string) => void;
  onUpdateAuditStatus: (
    id: string,
    patch: Partial<Pick<MohAuditRecord, 'status' | 'findingsCount' | 'criticalViolations' | 'notes'>>
  ) => Promise<void>;
  onSelectFacility: (facility: MohFacilityTelemetry) => void;
}

export const MohDirectivesComplianceView: React.FC<MohDirectivesComplianceViewProps> = ({
  snapshot,
  onBroadcastDirective,
  onUpdateDirectiveStatus,
  onScheduleAudit,
  onUpdateAuditStatus,
  onSelectFacility,
}) => {
  const [subTab, setSubTab] = useState<'directives' | 'audits'>('directives');

  const { directives, audits, facilities } = snapshot;
  const activeDirectives = directives.filter((d) => d.status === 'active').length;
  const openRemediations = audits.filter((a) => a.status === 'remediation_required').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Directives &amp; Regulatory Compliance</h1>
          <p className="moh-view-sub">
            Official Ministry circulars synced to hospital leadership, alongside HFR accreditation and facility audits.
          </p>
        </div>
        {subTab === 'directives' ? (
          <button type="button" className="moh-btn-primary" onClick={onBroadcastDirective}>
            <Send size={15} />
            <span>Broadcast Directive</span>
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
          <span>Accreditation &amp; Audits ({audits.length})</span>
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
      ) : (
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
      )}
    </div>
  );
};
