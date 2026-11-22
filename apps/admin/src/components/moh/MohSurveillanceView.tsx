'use client';

import React from 'react';
import { Activity, AlertTriangle, BedDouble, ShieldAlert } from 'lucide-react';
import type { MohFacilityTelemetry, MohLiveSnapshot } from '../../lib/mohTypes';

interface MohSurveillanceViewProps {
  snapshot: MohLiveSnapshot;
  onSelectFacility: (fac: MohFacilityTelemetry) => void;
  onOpenAlertModal: () => void;
  onToggleContainment: (alertId: string) => Promise<void>;
}

export const MohSurveillanceView: React.FC<MohSurveillanceViewProps> = ({
  snapshot,
  onSelectFacility,
  onOpenAlertModal,
  onToggleContainment,
}) => {
  const { summary, facilities, surveillance } = snapshot;
  const capacityFacilities = facilities.filter((f) => f.totalBeds > 0 || f.enrollmentStatus === 'active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Capacity &amp; Disease Surveillance</h1>
          <p className="moh-view-sub">
            De-identified inpatient bed utilization, outpatient throughput, and syndromic escalations across Akwa Ibom.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={onOpenAlertModal}>
          <AlertTriangle size={15} />
          <span>Issue Surveillance Alert</span>
        </button>
      </div>

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
    </div>
  );
};
