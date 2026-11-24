'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Briefcase, Clock, MapPin, Plus, Search, Users, Check, X as XIcon } from 'lucide-react';
import type { MohHrhRecruitment, MohLiveSnapshot, MohTransferRecord } from '../../lib/mohTypes';

interface MohWorkforceViewProps {
  snapshot: MohLiveSnapshot;
  officerName: string;
  onOpenTransferModal: () => void;
  onDecideTransfer: (id: string, status: MohTransferRecord['status']) => Promise<void>;
  onCreateRecruitment?: (input: {
    title: string;
    cadre: string;
    facilityId: string;
    facilityName?: string;
    lga?: string;
    vacanciesCount?: number;
    postedBy?: string;
  }) => Promise<void>;
  onUpdateRecruitment?: (input: {
    id: string;
    stage?: MohHrhRecruitment['stage'];
    applicantsCount?: number;
    shortlistedCount?: number;
    deployedCount?: number;
  }) => Promise<void>;
}

export const MohWorkforceView: React.FC<MohWorkforceViewProps> = ({
  snapshot,
  officerName,
  onOpenTransferModal,
  onDecideTransfer,
  onCreateRecruitment,
  onUpdateRecruitment,
}) => {
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState<'transfers' | 'lga_matrix' | 'attendance' | 'recruitment' | 'directory'>('transfers');
  const [recOpen, setRecOpen] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recCadre, setRecCadre] = useState('Medical Officer');
  const [recFacId, setRecFacId] = useState(snapshot.facilities[0]?.facilityId || 'IGH-EKT');
  const [recVacancies, setRecVacancies] = useState(2);
  const [recBusy, setRecBusy] = useState(false);

  const { workforce, transfers, hrh, facilities } = snapshot;

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return workforce.staffDirectory;
    const q = search.toLowerCase();
    return workforce.staffDirectory.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.facilityName.toLowerCase().includes(q) ||
        s.badgeId.toLowerCase().includes(q)
    );
  }, [workforce.staffDirectory, search]);

  const handleRecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateRecruitment || !recTitle.trim()) return;
    const fac = facilities.find((f) => f.facilityId === recFacId);
    setRecBusy(true);
    try {
      await onCreateRecruitment({
        title: recTitle.trim(),
        cadre: recCadre.trim(),
        facilityId: recFacId,
        facilityName: fac?.facilityName,
        lga: fac?.lga,
        vacanciesCount: Math.max(1, Number(recVacancies) || 1),
        postedBy: officerName,
      });
      setRecTitle('');
      setRecOpen(false);
    } finally {
      setRecBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Human Resources for Health (HRH) &amp; Transfers</h1>
          <p className="moh-view-sub">
            LGA cadre distribution across all 31 Akwa Ibom LGAs, attendance/rural staffing gaps, recruitment pipeline, and transfers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {subTab === 'recruitment' && onCreateRecruitment && (
            <button type="button" className="moh-btn-outline" onClick={() => setRecOpen((v) => !v)}>
              <Plus size={15} />
              <span>Post HRH Vacancy</span>
            </button>
          )}
          <button type="button" className="moh-btn-primary" onClick={onOpenTransferModal}>
            <ArrowRightLeft size={15} />
            <span>Dispatch Staff Transfer</span>
          </button>
        </div>
      </div>

      {/* Cadre Distribution Summary */}
      <div className="moh-panel">
        <div className="moh-panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2 className="moh-panel-title">
            <Users size={17} color="#065F46" />
            Active Cadre Breakdown ({workforce.totalActive} total active clinicians)
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={subTab === 'transfers' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 11px', fontSize: '0.76rem' }}
              onClick={() => setSubTab('transfers')}
            >
              Transfers ({transfers.length})
            </button>
            <button
              type="button"
              className={subTab === 'lga_matrix' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 11px', fontSize: '0.76rem' }}
              onClick={() => setSubTab('lga_matrix')}
            >
              <MapPin size={13} /> LGA Distribution ({hrh.lgaDistribution.length})
            </button>
            <button
              type="button"
              className={subTab === 'attendance' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 11px', fontSize: '0.76rem' }}
              onClick={() => setSubTab('attendance')}
            >
              <Clock size={13} /> Attendance &amp; Rural Gaps
            </button>
            <button
              type="button"
              className={subTab === 'recruitment' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 11px', fontSize: '0.76rem' }}
              onClick={() => setSubTab('recruitment')}
            >
              <Briefcase size={13} /> Recruitment ({hrh.recruitment.length})
            </button>
            <button
              type="button"
              className={subTab === 'directory' ? 'moh-btn-primary' : 'moh-btn-outline'}
              style={{ padding: '6px 11px', fontSize: '0.76rem' }}
              onClick={() => setSubTab('directory')}
            >
              Roster ({workforce.staffDirectory.length})
            </button>
          </div>
        </div>

        {workforce.byCadre.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
            Enrolled hospital staff will populate automatically as facilities onboard in MedCore OS.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {workforce.byCadre.slice(0, 8).map((c) => (
              <div key={c.cadre} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{c.cadre}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{c.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {subTab === 'transfers' ? (
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">Inter-Facility Deployment Orders</h2>
          </div>
          <div className="moh-table-wrap">
            <table className="moh-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Origin → Destination</th>
                  <th>Type / Priority</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => (
                  <tr key={tr.id}>
                    <td>
                      <strong>{tr.staffName}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {tr.cadre} {tr.staffBadge ? `· ${tr.staffBadge}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tr.fromFacilityName}</div>
                      <div style={{ fontSize: '0.74rem', color: '#065F46', fontWeight: 700 }}>→ {tr.toFacilityName}</div>
                    </td>
                    <td>
                      <span className="moh-pill slate">{tr.transferType.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ maxWidth: 260 }}>{tr.reason}</td>
                    <td>
                      <span className={`moh-pill ${tr.status === 'approved' || tr.status === 'completed' ? 'emerald' : tr.status === 'declined' ? 'danger' : 'amber'}`}>
                        {tr.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {tr.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', color: '#065F46' }} onClick={() => void onDecideTransfer(tr.id, 'approved')}>
                            <Check size={13} /> Approve
                          </button>
                          <button type="button" className="moh-btn-outline" style={{ padding: '4px 8px', color: '#DC2626' }} onClick={() => void onDecideTransfer(tr.id, 'declined')}>
                            <XIcon size={13} /> Decline
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>{tr.decidedBy || 'Recorded'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                      No transfer orders logged yet. Click <strong>Dispatch Staff Transfer</strong> to initiate a facility deployment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === 'lga_matrix' ? (
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">Workforce Distribution by Akwa Ibom LGA (31 LGAs)</h2>
            <span className="moh-pill slate">{hrh.attendanceSummary.ruralUnderstaffedCount} rural understaffed</span>
          </div>
          <div className="moh-table-wrap">
            <table className="moh-table">
              <thead>
                <tr>
                  <th>LGA</th>
                  <th>District</th>
                  <th>Facilities</th>
                  <th>Doctors</th>
                  <th>Nurses</th>
                  <th>Midwives</th>
                  <th>Pharmacists</th>
                  <th>CHEWs</th>
                  <th>Total Active</th>
                  <th>Staffing Status</th>
                </tr>
              </thead>
              <tbody>
                {hrh.lgaDistribution.map((row) => (
                  <tr key={row.lga}>
                    <td><strong>{row.lga}</strong></td>
                    <td>{row.district}</td>
                    <td>{row.facilitiesCount}</td>
                    <td>{row.doctors}</td>
                    <td>{row.nurses}</td>
                    <td>{row.midwives}</td>
                    <td>{row.pharmacists}</td>
                    <td>{row.chews}</td>
                    <td><strong>{row.totalStaff}</strong></td>
                    <td>
                      {row.understaffed ? (
                        <span className="moh-pill amber">Rural Understaffed</span>
                      ) : row.totalStaff > 0 ? (
                        <span className="moh-pill emerald">Active Coverage</span>
                      ) : (
                        <span className="moh-pill slate">Pending Sync</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === 'attendance' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-kpi-grid">
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Active Attendance Rate</div>
              <div className="moh-kpi-val" style={{ color: '#065F46' }}>{hrh.attendanceSummary.avgAttendancePct}%</div>
              <div className="moh-kpi-sub">Active roster vs total enrolled accounts</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Suspension / Absence Gap</div>
              <div className="moh-kpi-val" style={{ color: hrh.attendanceSummary.avgAbsenteeismPct > 10 ? '#DC2626' : '#0F172A' }}>
                {hrh.attendanceSummary.avgAbsenteeismPct}%
              </div>
              <div className="moh-kpi-sub">Inactive or suspended staff share</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Rural Understaffed LGAs</div>
              <div className="moh-kpi-val" style={{ color: hrh.attendanceSummary.ruralUnderstaffedCount > 0 ? '#D97706' : '#065F46' }}>
                {hrh.attendanceSummary.ruralUnderstaffedCount}
              </div>
              <div className="moh-kpi-sub">Hard-to-reach LGAs under 5 clinicians</div>
            </div>
          </div>

          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">Facility Attendance &amp; Rural Hard-to-Reach Summary</h2>
            </div>
            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>LGA / District</th>
                    <th>Active / Total Staff</th>
                    <th>Attendance / Readiness</th>
                    <th>Rural Gap Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.filter((f) => f.totalStaffCount > 0 || f.ruralUnderstaffed).map((f) => (
                    <tr key={f.facilityId}>
                      <td><strong>{f.facilityName}</strong></td>
                      <td>{f.lga} · {f.district}</td>
                      <td>{f.activeStaffCount} / {f.totalStaffCount}</td>
                      <td>
                        <span className={`moh-pill ${f.attendanceRatePct >= 85 ? 'emerald' : f.attendanceRatePct > 0 ? 'amber' : 'slate'}`}>
                          {f.attendanceRatePct}%
                        </span>
                      </td>
                      <td>
                        {f.ruralUnderstaffed ? (
                          <span className="moh-pill amber">Rural Understaffed</span>
                        ) : (
                          <span className="moh-pill emerald">Adequate</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {facilities.filter((f) => f.totalStaffCount > 0 || f.ruralUnderstaffed).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                        No staff roster telemetry synced yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : subTab === 'recruitment' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {recOpen && (
            <form onSubmit={handleRecSubmit} className="moh-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Post New State Health Worker Recruitment</div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Posting Title *
                  <input className="moh-input" style={{ marginTop: 4 }} required value={recTitle} onChange={(e) => setRecTitle(e.target.value)} placeholder="e.g. Rural Medical Officer Batch 2026" />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Target Cadre
                  <input className="moh-input" style={{ marginTop: 4 }} value={recCadre} onChange={(e) => setRecCadre(e.target.value)} />
                </label>
              </div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Receiving Facility
                  <select className="moh-input" style={{ marginTop: 4 }} value={recFacId} onChange={(e) => setRecFacId(e.target.value)}>
                    {facilities.map((f) => (
                      <option key={f.facilityId} value={f.facilityId}>{f.facilityName} ({f.lga})</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Vacancies
                  <input type="number" min={1} className="moh-input" style={{ marginTop: 4 }} value={recVacancies} onChange={(e) => setRecVacancies(Number(e.target.value) || 1)} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="moh-btn-outline" onClick={() => setRecOpen(false)} disabled={recBusy}>Cancel</button>
                <button type="submit" className="moh-btn-primary" disabled={recBusy}>{recBusy ? 'Publishing…' : 'Publish Posting'}</button>
              </div>
            </form>
          )}

          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">Recruitment &amp; Deployment Tracker</h2>
            </div>
            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Role / Posting</th>
                    <th>Facility &amp; LGA</th>
                    <th>Vacancies</th>
                    <th>Applicants / Deployed</th>
                    <th>Stage</th>
                    <th>Advance Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {hrh.recruitment.map((rec) => (
                    <tr key={rec.id}>
                      <td>
                        <strong>{rec.title}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{rec.cadre}</div>
                      </td>
                      <td>{rec.facilityName} <span style={{ color: '#64748B' }}>({rec.lga})</span></td>
                      <td>{rec.vacanciesCount}</td>
                      <td>{rec.applicantsCount} applied · {rec.deployedCount} deployed</td>
                      <td><span className="moh-pill slate">{rec.stage.toUpperCase()}</span></td>
                      <td>
                        {onUpdateRecruitment && rec.stage !== 'closed' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {rec.stage !== 'deploying' ? (
                              <button type="button" className="moh-btn-outline" style={{ padding: '4px 9px', fontSize: '0.74rem' }} onClick={() => void onUpdateRecruitment({ id: rec.id, stage: 'deploying' })}>
                                Move to Deploying
                              </button>
                            ) : (
                              <button type="button" className="moh-btn-outline" style={{ padding: '4px 9px', fontSize: '0.74rem' }} onClick={() => void onUpdateRecruitment({ id: rec.id, stage: 'closed', deployedCount: rec.vacanciesCount })}>
                                Mark Deployed
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {hrh.recruitment.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                        No active recruitment postings logged. Click <strong>Post HRH Vacancy</strong> to track new state postings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">Statewide Clinician Directory</h2>
            <div style={{ position: 'relative', minWidth: 240 }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="moh-input"
                style={{ paddingLeft: 32, height: 34 }}
                placeholder="Search clinician or facility…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="moh-table-wrap">
            <table className="moh-table">
              <thead>
                <tr>
                  <th>Badge ID</th>
                  <th>Name</th>
                  <th>Role &amp; Unit</th>
                  <th>Facility</th>
                  <th>District</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => (
                  <tr key={`${s.facilityId}-${s.badgeId}`}>
                    <td><code style={{ color: '#065F46', fontWeight: 700 }}>{s.badgeId}</code></td>
                    <td><strong>{s.fullName}</strong></td>
                    <td>
                      <div>{s.role}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{s.department}</div>
                    </td>
                    <td>{s.facilityName}</td>
                    <td>{s.district}</td>
                    <td>
                      <span className={`moh-pill ${s.status === 'active' ? 'emerald' : 'amber'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                      No staff records found in the connected facilities database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
