'use client';

import React, { useState } from 'react';
import type { EpidemiologicalAlert, OutbreakSeverity } from '@medcore/types';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  Thermometer, 
  Biohazard, 
  Send, 
  CheckCircle, 
  Users, 
  FileText,
  Clock
} from 'lucide-react';

interface EpidemiologicalRadarViewProps {
  alerts: EpidemiologicalAlert[];
  onToggleProtocol: (alertId: string) => void;
  onOpenBroadcastModal: () => void;
}

export const EpidemiologicalRadarView: React.FC<EpidemiologicalRadarViewProps> = ({
  alerts,
  onToggleProtocol,
  onOpenBroadcastModal,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const filteredAlerts = alerts.filter((al) => {
    if (selectedSeverity !== 'all' && al.severity !== selectedSeverity) return false;
    return true;
  });

  return (
    <div className="moh-radar-view">
      {/* Top Threat Briefing Banner */}
      <div className="radar-threat-ribbon">
        <div className="threat-kpi-card highlight-danger">
          <div className="threat-icon-box">
            <Biohazard size={22} />
          </div>
          <div className="threat-content">
            <div className="threat-label">Surveillance Radar Status</div>
            <div className="threat-status">ELEVATED SYNDROMIC ALERT</div>
            <div className="threat-sub">Pediatric RSV surge in Northern/Eastern corridors</div>
          </div>
        </div>

        <div className="threat-kpi-card">
          <div className="threat-content">
            <div className="threat-label">Aggregated Case Volume</div>
            <div className="threat-number">180 Confirmed</div>
            <div className="threat-sub">+24.5% surge in 7-day rolling window</div>
          </div>
        </div>

        <div className="threat-kpi-card">
          <div className="threat-content">
            <div className="threat-label">Genomic Sequencing Yield</div>
            <div className="threat-number">98.2% Precision</div>
            <div className="threat-sub">14 Central Laboratories reporting to MOH bus</div>
          </div>
        </div>

        <div className="threat-kpi-card">
          <div className="threat-content">
            <div className="threat-label">Public Health Directives</div>
            <div className="threat-number">1 Active Mandate</div>
            <div className="threat-sub">Targeted Pediatric ICU reserve protocol active</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Outbreak Clusters & Regional Vector Tracking */}
      <div className="radar-main-layout">
        {/* Left: Active Outbreak Advisories */}
        <div className="radar-col-left">
          <div className="moh-panel">
            <div className="moh-panel-header">
              <div className="panel-title-block">
                <h3>Active Epidemiological Alerts & Vector Tracking</h3>
                <span className="panel-subtitle">Real-time syndromic surveillance across regional hospitals and diagnostic centers</span>
              </div>
              <button 
                type="button" 
                className="action-btn broadcast-btn mini"
                onClick={onOpenBroadcastModal}
              >
                <Send size={14} />
                <span>Issue Alert Bulletin</span>
              </button>
            </div>

            <div className="alerts-deck">
              {filteredAlerts.map((al) => (
                <div key={al.alertId} className={`outbreak-card ${al.severity}`}>
                  <div className="outbreak-card-top">
                    <div className="outbreak-title-group">
                      <span className="outbreak-id">{al.alertId}</span>
                      <h4>{al.condition}</h4>
                      <span className="icd-tag">{al.icd10Category}</span>
                    </div>
                    <div className="outbreak-severity-badge-row">
                      <span className={`sev-badge ${al.severity}`}>
                        {al.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="outbreak-stats-grid">
                    <div className="outbreak-stat">
                      <span className="stat-label">Confirmed Cases</span>
                      <span className="stat-val">{al.detectedCases} Patients</span>
                    </div>
                    <div className="outbreak-stat">
                      <span className="stat-label">Surge Velocity</span>
                      <span className="stat-val text-red">+{al.rateOfIncreasePercent}% Weekly</span>
                    </div>
                    <div className="outbreak-stat">
                      <span className="stat-label">Reporting Facilities</span>
                      <span className="stat-val">{al.reportingFacilitiesCount} Hospitals</span>
                    </div>
                    <div className="outbreak-stat">
                      <span className="stat-label">First Signal Detected</span>
                      <span className="stat-val">{al.firstIdentified}</span>
                    </div>
                  </div>

                  <div className="affected-regions-line">
                    <strong>Impacted Zones:</strong>
                    <div className="region-chips">
                      {al.affectedRegions.map((reg) => (
                        <span key={reg} className="region-chip">
                          {reg}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="outbreak-actions-footer">
                    <div className="containment-switch-group">
                      <button
                        type="button"
                        className={`containment-toggle-btn ${al.containmentProtocolActive ? 'active' : ''}`}
                        onClick={() => onToggleProtocol(al.alertId)}
                      >
                        <ShieldAlert size={14} />
                        <span>
                          {al.containmentProtocolActive
                            ? 'Containment Protocol ACTIVE (Click to De-escalate)'
                            : 'Activate MOH Containment Protocol'}
                        </span>
                      </button>
                    </div>

                    <button 
                      type="button" 
                      className="inspect-alert-btn"
                      onClick={() => alert(`Opening Syndromic Genomic Profile for ${al.alertId}`)}
                    >
                      <span>Genomic Trace</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Pathogen Epidemiology Surveillance Breakdown */}
        <div className="radar-col-right">
          <div className="moh-panel">
            <div className="moh-panel-header">
              <div className="panel-title-block">
                <h3>Pathogen Surveillance Matrix</h3>
                <span className="panel-subtitle">Regional lab positivity rate</span>
              </div>
            </div>

            <div className="pathogen-breakdown-list">
              <div className="pathogen-item">
                <div className="pathogen-info">
                  <strong>Respiratory Syncytial Virus (RSV)</strong>
                  <span>Pediatric Bronchiolitis • High Vector</span>
                </div>
                <div className="pathogen-meter">
                  <div className="meter-label-row">
                    <span>Positivity: <strong>18.4%</strong></span>
                    <span className="text-red">R0: 1.45</span>
                  </div>
                  <div className="progress-bar-track small">
                    <div className="progress-bar-fill critical" style={{ width: '68%' }} />
                  </div>
                </div>
              </div>

              <div className="pathogen-item">
                <div className="pathogen-info">
                  <strong>Salmonella Enterica (Serovar Typh.)</strong>
                  <span>Foodborne Cluster • Western Valley</span>
                </div>
                <div className="pathogen-meter">
                  <div className="meter-label-row">
                    <span>Positivity: <strong>6.2%</strong></span>
                    <span className="text-amber">R0: 1.12</span>
                  </div>
                  <div className="progress-bar-track small">
                    <div className="progress-bar-fill warning" style={{ width: '38%' }} />
                  </div>
                </div>
              </div>

              <div className="pathogen-item">
                <div className="pathogen-info">
                  <strong>Dengue Arbovirus (DENV-2)</strong>
                  <span>Vector-Borne • Coastal Surveillance</span>
                </div>
                <div className="pathogen-meter">
                  <div className="meter-label-row">
                    <span>Positivity: <strong>2.8%</strong></span>
                    <span className="text-good">R0: 0.88</span>
                  </div>
                  <div className="progress-bar-track small">
                    <div className="progress-bar-fill optimal" style={{ width: '18%' }} />
                  </div>
                </div>
              </div>

              <div className="pathogen-item">
                <div className="pathogen-info">
                  <strong>Influenza A (H3N2 Clade)</strong>
                  <span>Seasonal Respiratory • Baseline</span>
                </div>
                <div className="pathogen-meter">
                  <div className="meter-label-row">
                    <span>Positivity: <strong>4.1%</strong></span>
                    <span className="text-good">R0: 0.95</span>
                  </div>
                  <div className="progress-bar-track small">
                    <div className="progress-bar-fill optimal" style={{ width: '22%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="moh-panel" style={{ marginTop: '20px' }}>
            <div className="moh-panel-header">
              <div className="panel-title-block">
                <h3>Automated Contact Tracing Feed</h3>
                <span className="panel-subtitle">Mobile health exposure notifications</span>
              </div>
            </div>

            <div className="contact-tracing-log">
              <div className="trace-entry">
                <Clock size={13} className="trace-icon" />
                <div>
                  <div className="trace-title">Cluster #882 Quarantined</div>
                  <div className="trace-sub">38 contacts alerted in Northern District via MedCore Care app</div>
                </div>
              </div>

              <div className="trace-entry">
                <Clock size={13} className="trace-icon" />
                <div>
                  <div className="trace-title">Rapid Antigen Dispatch</div>
                  <div className="trace-sub">2,500 testing kits dispatched to General Hospital Abak</div>
                </div>
              </div>

              <div className="trace-entry">
                <Clock size={13} className="trace-icon" />
                <div>
                  <div className="trace-title">Surveillance Advisory Broadcast</div>
                  <div className="trace-sub">Pediatric clinics notified of bronchiolitis admission criteria</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
