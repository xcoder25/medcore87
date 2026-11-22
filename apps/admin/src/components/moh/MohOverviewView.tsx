'use client';

import React from 'react';
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import type { MohFacilityTelemetry, MohLiveSnapshot, MohTabKey } from '../../lib/mohTypes';

interface MohOverviewViewProps {
  officerName: string;
  jurisdiction: string;
  snapshot: MohLiveSnapshot;
  onBroadcastDirective: () => void;
  onNavigateTab: (tab: MohTabKey) => void;
  onSelectFacility: (facility: MohFacilityTelemetry) => void;
}

function fmtNaira(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

export const MohOverviewView: React.FC<MohOverviewViewProps> = ({
  officerName,
  jurisdiction,
  snapshot,
  onBroadcastDirective,
  onNavigateTab,
  onSelectFacility,
}) => {
  const { summary, facilities, regionalRollup, transfers, audits, surveillance } = snapshot;

  // Compute genuine exceptions only for the Ministerial Attention Queue
  const attentionItems: {
    id: string;
    severity: 'danger' | 'amber';
    title: string;
    detail: string;
    actionLabel: string;
    onAction: () => void;
  }[] = [];

  for (const fac of facilities) {
    if (fac.emergencyStatus !== 'normal') {
      attentionItems.push({
        id: `surge-${fac.facilityId}`,
        severity: fac.emergencyStatus === 'surge_code_red' || fac.emergencyStatus === 'critical' ? 'danger' : 'amber',
        title: `${fac.facilityName} · ${fac.emergencyStatus.replace(/_/g, ' ').toUpperCase()}`,
        detail: `${fac.occupiedBeds}/${fac.totalBeds} beds occupied · ICU ${fac.icuBedsOccupied}/${fac.icuBedsTotal}`,
        actionLabel: 'Inspect',
        onAction: () => onSelectFacility(fac),
      });
    } else if (fac.enrollmentStatus === 'active' && !fac.hfrCode) {
      attentionItems.push({
        id: `hfr-${fac.facilityId}`,
        severity: 'amber',
        title: `${fac.facilityName} missing HFR code`,
        detail: `${fac.district} District · Compliance score ${fac.complianceScore}%`,
        actionLabel: 'Review',
        onAction: () => onSelectFacility(fac),
      });
    }
  }

  for (const tr of transfers.filter((t) => t.status === 'pending')) {
    attentionItems.push({
      id: `tr-${tr.id}`,
      severity: tr.urgency === 'immediate_code_red' ? 'danger' : 'amber',
      title: `Pending transfer: ${tr.staffName}`,
      detail: `${tr.fromFacilityName} → ${tr.toFacilityName}`,
      actionLabel: 'Decide',
      onAction: () => onNavigateTab('workforce'),
    });
  }

  for (const aud of audits.filter((a) => a.status === 'remediation_required')) {
    attentionItems.push({
      id: `aud-${aud.id}`,
      severity: 'amber',
      title: `Remediation required: ${aud.facilityName}`,
      detail: `${aud.findingsCount} finding(s) · Deadline ${aud.resolutionDeadline || 'Pending'}`,
      actionLabel: 'Audits',
      onAction: () => onNavigateTab('directives'),
    });
  }

  for (const al of surveillance.alerts.filter((a) => a.containmentActive)) {
    attentionItems.push({
      id: `al-${al.id}`,
      severity: al.severity === 'emergency' ? 'danger' : 'amber',
      title: `Active alert: ${al.condition}`,
      detail: `${al.detectedCases} cases · ${al.affectedDistricts.join(', ')}`,
      actionLabel: 'Radar',
      onAction: () => onNavigateTab('surveillance'),
    });
  }

  const activeFacilities = facilities.filter((f) => f.enrollmentStatus === 'active');
  const displayFacilities = activeFacilities.length > 0 ? activeFacilities : facilities.slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Executive Header */}
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Welcome, {officerName}</h1>
          <p className="moh-view-sub">
            Akwa Ibom State Ministry of Health · {jurisdiction} · {snapshot.districtFilter}
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={onBroadcastDirective}>
          <Send size={15} />
          <span>Broadcast Directive</span>
        </button>
      </div>

      {/* 6 Tabular KPI Cards */}
      <div className="moh-kpi-grid">
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Connected Facilities</div>
          <div className="moh-kpi-val">
            {summary.connectedFacilities} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748B' }}>/ {summary.totalOfficialFacilities}</span>
          </div>
          <div className="moh-kpi-sub">{summary.pendingFacilities} awaiting MedCore OS onboarding</div>
        </div>

        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Statewide Bed Capacity</div>
          <div className="moh-kpi-val">{summary.bedOccupancyPct}%</div>
          <div className="moh-kpi-sub">
            {summary.occupiedBeds} occupied of {summary.totalBeds} · ICU {summary.icuBedsOccupied}/{summary.icuBedsTotal}
          </div>
        </div>

        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Active Clinical Workforce</div>
          <div className="moh-kpi-val">{summary.activeStaffCount.toLocaleString()}</div>
          <div className="moh-kpi-sub">{summary.pendingTransfersCount} pending inter-facility transfers</div>
        </div>

        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Patient Registry &amp; OPD</div>
          <div className="moh-kpi-val">{summary.registeredPatientsCount.toLocaleString()}</div>
          <div className="moh-kpi-sub">{summary.activeOpdVisits} active outpatient visits today</div>
        </div>

        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Verified Collections</div>
          <div className="moh-kpi-val">{fmtNaira(summary.totalRevenuePaidNgn)}</div>
          <div className="moh-kpi-sub">{fmtNaira(summary.totalRevenuePendingNgn)} pending settlement</div>
        </div>

        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Regulatory Governance</div>
          <div className="moh-kpi-val">{summary.activeDirectivesCount}</div>
          <div className="moh-kpi-sub">
            Active directives · {summary.openRemediationsCount} remediation docket(s)
          </div>
        </div>
      </div>

      {/* Ministerial Attention Queue (Quiet Single-Line Row When Zero Exceptions) */}
      {attentionItems.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 10,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            fontSize: '0.82rem',
            color: '#334155',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <CheckCircle2 size={16} color="#065F46" />
            All monitored facilities and compliance indicators are operating within normal thresholds.
          </span>
          <button
            type="button"
            className="moh-btn-outline"
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            onClick={() => onNavigateTab('facilities')}
          >
            Inspect Network
          </button>
        </div>
      ) : (
        <div className="moh-panel" style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
          <div className="moh-panel-head" style={{ marginBottom: 10 }}>
            <h2 className="moh-panel-title" style={{ color: '#92400E' }}>
              <AlertTriangle size={17} color="#D97706" />
              Ministerial Attention Queue ({attentionItems.length})
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attentionItems.slice(0, 6).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#FFFFFF',
                  border: `1px solid ${item.severity === 'danger' ? '#FECACA' : '#FDE68A'}`,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A' }}>{item.title}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B' }}>{item.detail}</div>
                </div>
                <button type="button" className="moh-btn-outline" onClick={item.onAction}>
                  <span>{item.actionLabel}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Senatorial District Rollup */}
      <div className="moh-three-col">
        {regionalRollup.map((reg) => {
          const occPct = reg.totalBeds > 0 ? Math.round((reg.occupiedBeds / reg.totalBeds) * 100) : 0;
          return (
            <div key={reg.district} className="moh-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Senatorial District
                  </div>
                  <h3 style={{ margin: '2px 0 0', fontSize: '1.02rem', fontWeight: 800 }}>{reg.district}</h3>
                </div>
                <span className="moh-pill slate">
                  {reg.connectedFacilities}/{reg.totalFacilities} active
                </span>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                  <span style={{ color: '#64748B' }}>Bed Occupancy</span>
                  <strong>{reg.occupiedBeds}/{reg.totalBeds} ({occPct}%)</strong>
                </div>
                <div className="moh-meter">
                  <div className={`moh-meter-fill ${occPct >= 90 ? 'danger' : occPct >= 75 ? 'amber' : ''}`} style={{ width: `${occPct}%` }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#475569' }}>
                <span>Staff: <strong>{reg.staffCount}</strong></span>
                <span>OPD: <strong>{reg.activeOpdVisits}</strong></span>
                <span>Rev: <strong>{fmtNaira(reg.revenuePaidNgn)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connected Facilities Pulse Table */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Building2 size={17} color="#065F46" />
            {activeFacilities.length > 0 ? `Connected Facilities (${activeFacilities.length})` : 'Official Health Facility Network Preview'}
          </h2>
          <button type="button" className="moh-btn-outline" onClick={() => onNavigateTab('facilities')}>
            <span>View All {summary.totalOfficialFacilities} Facilities</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Facility ID</th>
                <th>Name</th>
                <th>District</th>
                <th>Beds (Occ / Total)</th>
                <th>Active Staff</th>
                <th>Compliance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayFacilities.map((fac) => (
                <tr key={fac.facilityId} className="moh-row-click" onClick={() => onSelectFacility(fac)}>
                  <td><code style={{ fontWeight: 700, color: '#065F46' }}>{fac.facilityId}</code></td>
                  <td>
                    <strong style={{ color: '#0F172A' }}>{fac.facilityName}</strong>
                    <div style={{ fontSize: '0.73rem', color: '#64748B' }}>
                      {fac.facilityType} · {fac.hfrCode ? `HFR ${fac.hfrCode}` : 'HFR pending'}
                    </div>
                  </td>
                  <td>{fac.district}</td>
                  <td>{fac.totalBeds > 0 ? `${fac.occupiedBeds} / ${fac.totalBeds}` : '—'}</td>
                  <td>{fac.activeStaffCount}</td>
                  <td>
                    <span className={`moh-pill ${fac.complianceScore >= 75 ? 'emerald' : fac.complianceScore > 0 ? 'amber' : 'slate'}`}>
                      {fac.complianceScore}%
                    </span>
                  </td>
                  <td>
                    <span className={`moh-pill ${fac.enrollmentStatus === 'active' ? 'emerald' : 'slate'}`}>
                      {fac.enrollmentStatus === 'active' ? 'Connected' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
