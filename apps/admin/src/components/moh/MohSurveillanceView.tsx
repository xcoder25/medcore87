'use client';

import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Baby, BedDouble, Plus, ShieldAlert, Radio } from 'lucide-react';
import { AKWA_IBOM_LGAS } from '../../data/akwaIbomFacilities';
import type { MohFacilityTelemetry, MohIdsrReport, MohLiveSnapshot } from '../../lib/mohTypes';
import { detectCrossLgaSyndromicAnomalies } from '../../lib/mohSyndromicEngine';

interface MohSurveillanceViewProps {
  snapshot: MohLiveSnapshot;
  officerName?: string;
  onSelectFacility: (fac: MohFacilityTelemetry) => void;
  onOpenAlertModal: () => void;
  onToggleContainment: (alertId: string) => Promise<void>;
  onCreateIdsrReport?: (input: {
    reportKind: MohIdsrReport['reportKind'];
    facilityId?: string;
    facilityName?: string;
    lga: string;
    district?: MohFacilityTelemetry['district'];
    periodLabel?: string;
    disease?: string;
    suspectedCases?: number;
    confirmedCases?: number;
    deaths?: number;
    ancVisits?: number;
    skilledDeliveries?: number;
    immunizationDoses?: number;
    emergencyReferrals?: number;
    maternalDeaths?: number;
    under5Deaths?: number;
    dsnoOfficer?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateIdsrReport?: (input: {
    id: string;
    status?: MohIdsrReport['status'];
    confirmedCases?: number;
    deaths?: number;
    notes?: string;
  }) => Promise<void>;
}

export const MohSurveillanceView: React.FC<MohSurveillanceViewProps> = ({
  snapshot,
  officerName,
  onSelectFacility,
  onOpenAlertModal,
  onToggleContainment,
  onCreateIdsrReport,
  onUpdateIdsrReport,
}) => {
  const [subTab, setSubTab] = useState<'radar' | 'dsno' | 'rmnch'>('radar');
  const [dsnoFormOpen, setDsnoFormOpen] = useState(false);
  const [rmnchFormOpen, setRmnchFormOpen] = useState(false);

  const [dsnoLga, setDsnoLga] = useState(AKWA_IBOM_LGAS[0]?.lga || 'Uyo');
  const [dsnoFacId, setDsnoFacId] = useState(snapshot.facilities[0]?.facilityId || '');
  const [dsnoDisease, setDsnoDisease] = useState('Cholera');
  const [dsnoSuspected, setDsnoSuspected] = useState(2);
  const [dsnoConfirmed, setDsnoConfirmed] = useState(0);
  const [dsnoDeaths, setDsnoDeaths] = useState(0);
  const [dsnoOfficer, setDsnoOfficer] = useState(officerName || 'LGA DSNO Officer');
  const [dsnoNotes, setDsnoNotes] = useState('');

  const [rmLga, setRmLga] = useState(AKWA_IBOM_LGAS[0]?.lga || 'Uyo');
  const [rmFacId, setRmFacId] = useState(snapshot.facilities[0]?.facilityId || 'IGH-EKT');
  const [rmPeriod, setRmPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [rmAnc, setRmAnc] = useState(120);
  const [rmDeliveries, setRmDeliveries] = useState(48);
  const [rmImm, setRmImm] = useState(210);
  const [rmRef, setRmRef] = useState(9);
  const [rmMatDeaths, setRmMatDeaths] = useState(0);
  const [rmU5Deaths, setRmU5Deaths] = useState(0);
  const [busy, setBusy] = useState(false);

  const { summary, facilities, surveillance, idsr } = snapshot;
  const capacityFacilities = facilities.filter((f) => f.totalBeds > 0 || f.enrollmentStatus === 'active');
  const syndromicClusters = useMemo(() => detectCrossLgaSyndromicAnomalies(snapshot), [snapshot]);

  const handleDsnoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateIdsrReport || !dsnoDisease.trim()) return;
    const fac = facilities.find((f) => f.facilityId === dsnoFacId);
    const lgaMeta = AKWA_IBOM_LGAS.find((l) => l.lga === dsnoLga);
    setBusy(true);
    try {
      await onCreateIdsrReport({
        reportKind: 'dsno_outbreak',
        facilityId: dsnoFacId || undefined,
        facilityName: fac?.facilityName,
        lga: dsnoLga,
        district: lgaMeta?.district,
        disease: dsnoDisease.trim(),
        suspectedCases: Number(dsnoSuspected || 0),
        confirmedCases: Number(dsnoConfirmed || 0),
        deaths: Number(dsnoDeaths || 0),
        dsnoOfficer: dsnoOfficer.trim(),
        notes: dsnoNotes.trim(),
      });
      setDsnoNotes('');
      setDsnoFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRmnchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateIdsrReport) return;
    const fac = facilities.find((f) => f.facilityId === rmFacId);
    const lgaMeta = AKWA_IBOM_LGAS.find((l) => l.lga === rmLga);
    setBusy(true);
    try {
      await onCreateIdsrReport({
        reportKind: 'service_utilization',
        facilityId: rmFacId || undefined,
        facilityName: fac?.facilityName,
        lga: fac?.lga || rmLga,
        district: fac?.district || lgaMeta?.district,
        periodLabel: rmPeriod,
        ancVisits: Number(rmAnc || 0),
        skilledDeliveries: Number(rmDeliveries || 0),
        immunizationDoses: Number(rmImm || 0),
        emergencyReferrals: Number(rmRef || 0),
        maternalDeaths: Number(rmMatDeaths || 0),
        under5Deaths: Number(rmU5Deaths || 0),
        dsnoOfficer: officerName || 'RMNCH Coordinator',
      });
      setRmnchFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Capacity, DSNO e-Surveillance &amp; Service Metrics</h1>
          <p className="moh-view-sub">
            Inpatient capacity, IDSR priority disease notifications (Cholera, Lassa Fever, Measles), and RMNCH/immunization utilization.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {subTab === 'dsno' && onCreateIdsrReport && (
            <button type="button" className="moh-btn-primary" onClick={() => setDsnoFormOpen((v) => !v)}>
              <Plus size={15} />
              <span>Submit DSNO Alert</span>
            </button>
          )}
          {subTab === 'rmnch' && onCreateIdsrReport && (
            <button type="button" className="moh-btn-primary" onClick={() => setRmnchFormOpen((v) => !v)}>
              <Plus size={15} />
              <span>Log Service Return</span>
            </button>
          )}
          {subTab === 'radar' && (
            <button type="button" className="moh-btn-primary" onClick={onOpenAlertModal}>
              <AlertTriangle size={15} />
              <span>Issue Surveillance Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={subTab === 'radar' ? 'moh-btn-primary' : 'moh-btn-outline'}
          onClick={() => setSubTab('radar')}
        >
          <BedDouble size={14} />
          <span>Capacity &amp; Outbreak Radar</span>
        </button>
        <button
          type="button"
          className={subTab === 'dsno' ? 'moh-btn-primary' : 'moh-btn-outline'}
          onClick={() => setSubTab('dsno')}
        >
          <ShieldAlert size={14} />
          <span>DSNO e-Surveillance / IDSR ({idsr.dsnoReports.length})</span>
        </button>
        <button
          type="button"
          className={subTab === 'rmnch' ? 'moh-btn-primary' : 'moh-btn-outline'}
          onClick={() => setSubTab('rmnch')}
        >
          <Baby size={14} />
          <span>RMNCH &amp; Service Utilization ({idsr.serviceMetrics.length})</span>
        </button>
      </div>

      {subTab === 'radar' ? (
        <>

      {/* KPI Strip */}
      <div className="moh-kpi-grid">
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Bed Utilization</div>
          <div className="moh-kpi-val">{summary.bedOccupancyPct}%</div>
          <div className="moh-kpi-sub">{summary.occupiedBeds} occupied / {summary.totalBeds} beds</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">ICU Occupancy</div>
          <div className="moh-kpi-val">{summary.icuOccupancyPct}%</div>
          <div className="moh-kpi-sub">{summary.icuBedsOccupied} occupied / {summary.icuBedsTotal} ICU beds</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Active OPD Flow</div>
          <div className="moh-kpi-val">{surveillance.activeOpdVisits}</div>
          <div className="moh-kpi-sub">{surveillance.waitingOpd} waiting · {surveillance.withProviderOpd} with clinician</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Clinical Escalations</div>
          <div className="moh-kpi-val">{surveillance.criticalLabAlerts + surveillance.criticalVitalsAlerts}</div>
          <div className="moh-kpi-sub">{surveillance.criticalLabAlerts} critical labs · {surveillance.criticalVitalsAlerts} urgent vitals</div>
        </div>
      </div>

      <div className="moh-two-col">
        {/* Outbreak Advisories */}
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">
              <ShieldAlert size={17} color="#D97706" />
              Epidemiological Alerts ({surveillance.alerts.length})
            </h2>
          </div>

          {surveillance.alerts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: '0.84rem', background: '#F8FAFC', borderRadius: 10 }}>
              No active outbreak bulletins issued. Use <strong>Issue Surveillance Alert</strong> if a facility cluster warrants statewide coordination.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {surveillance.alerts.map((al) => (
                <div key={al.id} style={{ padding: 14, borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '0.9rem' }}>{al.condition}</strong>
                    <span className={`moh-pill ${al.severity === 'emergency' ? 'danger' : 'amber'}`}>
                      {al.severity.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 4 }}>
                    {al.icd10Category} · {al.detectedCases} cases · {al.affectedDistricts.join(', ')}
                  </div>
                  {al.notes && <p style={{ fontSize: '0.78rem', margin: '6px 0 0', color: '#334155' }}>{al.notes}</p>}
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Logged {al.firstIdentified}</span>
                    <button type="button" className="moh-btn-outline" onClick={() => void onToggleContainment(al.id)}>
                      {al.containmentActive ? 'De-escalate Containment' : 'Activate Containment'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* De-identified Clinical Signals from OS Labs/Vitals */}
        <div className="moh-panel">
          <div className="moh-panel-head">
            <h2 className="moh-panel-title">
              <Activity size={17} color="#065F46" />
              Automated Facility Signal Feed ({surveillance.clinicalSignals.length})
            </h2>
          </div>

          {surveillance.clinicalSignals.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: '0.84rem', background: '#F8FAFC', borderRadius: 10 }}>
              Zero critical lab flags or emergency triage escalations detected across connected facilities.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {surveillance.clinicalSignals.map((sig) => (
                <div key={sig.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '0.82rem' }}>{sig.facilityName}</strong>
                    <span className={`moh-pill ${sig.severity === 'critical' ? 'danger' : 'amber'}`}>
                      {sig.signalType === 'critical_lab' ? 'Critical Lab' : 'Urgent Vitals'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 3 }}>{sig.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bed Capacity Matrix */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Radio size={17} color="#DC2626" />
            Cross-LGA Syndromic Early-Warning Clusters ({syndromicClusters.length})
          </h2>
          <button type="button" className="moh-btn-outline" onClick={onOpenAlertModal}>
            Escalate Bulletin
          </button>
        </div>

        {syndromicClusters.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 10, background: '#F8FAFC', color: '#64748B', fontSize: '0.82rem' }}>
            Zero cross-LGA syndromic clusters (Cholera/AWD, Lassa VHF, Measles, Severe Malaria, or SARI) detected above baseline.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {syndromicClusters.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: c.severity === 'outbreak_surge' ? '1.5px solid #DC2626' : '1px solid #F59E0B',
                  background: c.severity === 'outbreak_surge' ? '#FEF2F2' : '#FFFBEB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{c.syndromeLabel}</strong>
                  <span className={`moh-pill ${c.severity === 'outbreak_surge' ? 'danger' : 'amber'}`}>
                    {c.severity.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 6 }}>
                  <strong>Affected LGAs:</strong> {c.affectedLgas.join(', ')} · <strong>Signals/Cases:</strong> {c.suspectedCasesTotal}
                </div>
                {c.neighboringRiskLgas.length > 0 && (
                  <div style={{ fontSize: '0.74rem', color: '#B45309', marginTop: 3 }}>
                    Adjacent Watch LGAs: {c.neighboringRiskLgas.join(', ')}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: '#1E293B', marginTop: 6, background: '#FFFFFF', padding: 8, borderRadius: 8 }}>
                  {c.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bed Capacity Matrix */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <BedDouble size={17} color="#065F46" />
            Facility Bed &amp; ICU Capacity Matrix
          </h2>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>District</th>
                <th>Total Beds</th>
                <th>Occupied</th>
                <th>Available</th>
                <th>ICU (Occ / Total)</th>
                <th>Surge Status</th>
              </tr>
            </thead>
            <tbody>
              {capacityFacilities.map((fac) => {
                const pct = fac.totalBeds > 0 ? Math.round((fac.occupiedBeds / fac.totalBeds) * 100) : 0;
                return (
                  <tr key={fac.facilityId} className="moh-row-click" onClick={() => onSelectFacility(fac)}>
                    <td>
                      <strong style={{ color: '#0F172A' }}>{fac.facilityName}</strong>
                      <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{fac.facilityId}</div>
                    </td>
                    <td>{fac.district}</td>
                    <td>{fac.totalBeds}</td>
                    <td>{fac.occupiedBeds} ({pct}%)</td>
                    <td>{fac.availableBeds}</td>
                    <td>{fac.icuBedsOccupied} / {fac.icuBedsTotal}</td>
                    <td>
                      <span className={`moh-pill ${fac.emergencyStatus === 'normal' ? 'emerald' : 'danger'}`}>
                        {fac.emergencyStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {capacityFacilities.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                    No connected facility bed boards streaming yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : subTab === 'dsno' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dsnoFormOpen && (
            <form onSubmit={handleDsnoSubmit} className="moh-panel" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Submit LGA DSNO e-Surveillance Notification (IDSR)</div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Priority Disease *
                  <select className="moh-input" style={{ marginTop: 4 }} value={dsnoDisease} onChange={(e) => setDsnoDisease(e.target.value)}>
                    <option value="Cholera">Cholera</option>
                    <option value="Lassa Fever">Lassa Fever</option>
                    <option value="Measles">Measles</option>
                    <option value="Cerebrospinal Meningitis">Cerebrospinal Meningitis</option>
                    <option value="Yellow Fever">Yellow Fever</option>
                    <option value="Mpox">Mpox</option>
                    <option value="Diphtheria">Diphtheria</option>
                  </select>
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Reporting LGA *
                  <select className="moh-input" style={{ marginTop: 4 }} value={dsnoLga} onChange={(e) => setDsnoLga(e.target.value)}>
                    {AKWA_IBOM_LGAS.map((l) => (
                      <option key={l.lga} value={l.lga}>{l.lga} ({l.district})</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Facility (Optional)
                  <select className="moh-input" style={{ marginTop: 4 }} value={dsnoFacId} onChange={(e) => setDsnoFacId(e.target.value)}>
                    <option value="">LGA Community Case</option>
                    {facilities.map((f) => (
                      <option key={f.facilityId} value={f.facilityId}>{f.facilityName}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Suspected Cases
                  <input type="number" min={0} className="moh-input" style={{ marginTop: 4 }} value={dsnoSuspected} onChange={(e) => setDsnoSuspected(Number(e.target.value) || 0)} />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Confirmed Cases
                  <input type="number" min={0} className="moh-input" style={{ marginTop: 4 }} value={dsnoConfirmed} onChange={(e) => setDsnoConfirmed(Number(e.target.value) || 0)} />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Deaths
                  <input type="number" min={0} className="moh-input" style={{ marginTop: 4 }} value={dsnoDeaths} onChange={(e) => setDsnoDeaths(Number(e.target.value) || 0)} />
                </label>
              </div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  DSNO Reporting Officer
                  <input className="moh-input" style={{ marginTop: 4 }} value={dsnoOfficer} onChange={(e) => setDsnoOfficer(e.target.value)} />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Epidemiological Notes
                  <input className="moh-input" style={{ marginTop: 4 }} value={dsnoNotes} onChange={(e) => setDsnoNotes(e.target.value)} placeholder="Sample RDT/PCR dispatch, ward cluster notes..." />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="moh-btn-outline" onClick={() => setDsnoFormOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="moh-btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit DSNO Notification'}</button>
              </div>
            </form>
          )}

          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">IDSR Outbreak Notification Feed ({idsr.dsnoReports.length})</h2>
            </div>
            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Disease</th>
                    <th>LGA / Facility</th>
                    <th>Suspected / Confirmed / Deaths</th>
                    <th>DSNO Officer</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {idsr.dsnoReports.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.disease}</strong></td>
                      <td>
                        <div>{r.lga} LGA ({r.district})</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{r.facilityName}</div>
                      </td>
                      <td>{r.suspectedCases} susp · {r.confirmedCases} conf · {r.deaths} death(s)</td>
                      <td>{r.dsnoOfficer}</td>
                      <td><span className={`moh-pill ${r.status === 'contained' ? 'emerald' : 'amber'}`}>{r.status.toUpperCase()}</span></td>
                      <td>
                        {onUpdateIdsrReport && r.status !== 'contained' && (
                          <button type="button" className="moh-btn-outline" style={{ padding: '4px 9px', fontSize: '0.74rem' }} onClick={() => void onUpdateIdsrReport({ id: r.id, status: 'contained' })}>
                            Mark Contained
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {idsr.dsnoReports.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                        No DSNO priority disease notifications logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="moh-kpi-grid">
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">ANC Visits</div>
              <div className="moh-kpi-val">{idsr.ancVisitsTotal.toLocaleString()}</div>
              <div className="moh-kpi-sub">Reported antenatal visits</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Skilled Birth Deliveries</div>
              <div className="moh-kpi-val">{idsr.skilledDeliveriesTotal.toLocaleString()}</div>
              <div className="moh-kpi-sub">Attended in registered facilities</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Routine Immunization</div>
              <div className="moh-kpi-val">{idsr.immunizationDosesTotal.toLocaleString()}</div>
              <div className="moh-kpi-sub">Total vaccine doses administered</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Emergency Referrals</div>
              <div className="moh-kpi-val">{idsr.emergencyReferralsTotal.toLocaleString()}</div>
              <div className="moh-kpi-sub">Inter-facility obstetric/acute transfers</div>
            </div>
            <div className="moh-kpi-card">
              <div className="moh-kpi-label">Maternal / Under-5 Deaths</div>
              <div className="moh-kpi-val" style={{ color: idsr.maternalDeathsTotal + idsr.under5DeathsTotal > 0 ? '#DC2626' : '#065F46' }}>
                {idsr.maternalDeathsTotal} / {idsr.under5DeathsTotal}
              </div>
              <div className="moh-kpi-sub">Maternal / Under-5 mortality audit count</div>
            </div>
          </div>

          {rmnchFormOpen && (
            <form onSubmit={handleRmnchSubmit} className="moh-panel" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Log Monthly / Weekly Service Utilization &amp; RMNCH Return</div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Facility
                  <select className="moh-input" style={{ marginTop: 4 }} value={rmFacId} onChange={(e) => setRmFacId(e.target.value)}>
                    {facilities.map((f) => (
                      <option key={f.facilityId} value={f.facilityId}>{f.facilityName} ({f.lga})</option>
                    ))}
                  </select>
                </label>
                <div className="moh-two-col">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    LGA
                    <select className="moh-input" style={{ marginTop: 4 }} value={rmLga} onChange={(e) => setRmLga(e.target.value)}>
                      {AKWA_IBOM_LGAS.map((l) => (
                        <option key={l.lga} value={l.lga}>{l.lga}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                    Period (YYYY-MM)
                    <input className="moh-input" style={{ marginTop: 4 }} value={rmPeriod} onChange={(e) => setRmPeriod(e.target.value)} />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>ANC Visits <input type="number" className="moh-input" style={{ marginTop: 4 }} value={rmAnc} onChange={(e) => setRmAnc(Number(e.target.value) || 0)} /></label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Skilled Deliveries <input type="number" className="moh-input" style={{ marginTop: 4 }} value={rmDeliveries} onChange={(e) => setRmDeliveries(Number(e.target.value) || 0)} /></label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Immunization Doses <input type="number" className="moh-input" style={{ marginTop: 4 }} value={rmImm} onChange={(e) => setRmImm(Number(e.target.value) || 0)} /></label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Emergency Referrals <input type="number" className="moh-input" style={{ marginTop: 4 }} value={rmRef} onChange={(e) => setRmRef(Number(e.target.value) || 0)} /></label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Maternal Deaths <input type="number" className="moh-input" style={{ marginTop: 4 }} value={rmMatDeaths} onChange={(e) => setRmMatDeaths(Number(e.target.value) || 0)} /></label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Under-5 Deaths <input type="number" className="moh-input" style={{ marginTop: 4 }} value={rmU5Deaths} onChange={(e) => setRmU5Deaths(Number(e.target.value) || 0)} /></label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="moh-btn-outline" onClick={() => setRmnchFormOpen(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="moh-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Service Return'}</button>
              </div>
            </form>
          )}

          <div className="moh-panel">
            <div className="moh-panel-head">
              <h2 className="moh-panel-title">RMNCH &amp; Routine Immunization Returns</h2>
            </div>
            <div className="moh-table-wrap">
              <table className="moh-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Facility &amp; LGA</th>
                    <th>ANC Visits</th>
                    <th>Skilled Births</th>
                    <th>Immunization Doses</th>
                    <th>Referrals</th>
                    <th>Mat / U-5 Deaths</th>
                  </tr>
                </thead>
                <tbody>
                  {idsr.serviceMetrics.map((m) => (
                    <tr key={m.id}>
                      <td><code style={{ fontWeight: 700, color: '#065F46' }}>{m.periodLabel}</code></td>
                      <td><strong>{m.facilityName}</strong> <span style={{ color: '#64748B' }}>({m.lga})</span></td>
                      <td>{m.ancVisits}</td>
                      <td>{m.skilledDeliveries}</td>
                      <td>{m.immunizationDoses}</td>
                      <td>{m.emergencyReferrals}</td>
                      <td>{m.maternalDeaths} / {m.under5Deaths}</td>
                    </tr>
                  ))}
                  {idsr.serviceMetrics.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                        No weekly/monthly RMNCH returns logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
