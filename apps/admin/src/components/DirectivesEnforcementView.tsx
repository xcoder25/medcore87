'use client';

import React, { useState } from 'react';
import type { RegulatoryDirective, DirectiveSeverity } from '@medcore/types';
import { 
  Scale, 
  Send, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  FileText, 
  CheckSquare2, 
  Filter 
} from 'lucide-react';

interface DirectivesEnforcementViewProps {
  directives: RegulatoryDirective[];
  onOpenBroadcastModal: () => void;
  onUpdateDirectiveStatus: (directiveId: string, newStatus: RegulatoryDirective['status']) => void;
}

export const DirectivesEnforcementView: React.FC<DirectivesEnforcementViewProps> = ({
  directives,
  onOpenBroadcastModal,
  onUpdateDirectiveStatus,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const filteredDirectives = directives.filter((d) => {
    if (selectedSeverity !== 'all' && d.severity !== selectedSeverity) return false;
    return true;
  });

  const activeDirectives = directives.filter((d) => d.status === 'active').length;
  const totalTargeted = directives.reduce((sum, d) => sum + d.totalTargetedFacilities, 0);
  const totalConfirmed = directives.reduce((sum, d) => sum + d.complianceConfirmedCount, 0);
  const nationalAckRate = totalTargeted > 0 ? Math.round((totalConfirmed / totalTargeted) * 100) : 0;

  return (
    <div className="moh-directives-view">
      {/* Top Enforcement Statistics Ribbon */}
      <div className="directives-kpi-ribbon">
        <div className="directives-kpi-card">
          <div className="kpi-label">Active National Directives</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{activeDirectives}</span>
            <span className="kpi-badge alert">Enforced Statewide</span>
          </div>
          <div className="kpi-subtext">Issued by Director General under Public Health Act §44</div>
        </div>

        <div className="directives-kpi-card">
          <div className="kpi-label">Network Acknowledgment Rate</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{nationalAckRate}%</span>
            <span className="kpi-badge good">{totalConfirmed} / {totalTargeted} Confirmed</span>
          </div>
          <div className="kpi-subtext">Automated cryptographic receipt from MedCore OS command centers</div>
        </div>

        <div className="directives-kpi-card">
          <div className="kpi-label">Regulatory Inquiries Pending</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">2</span>
            <span className="kpi-badge warn">Remediation Dockets</span>
          </div>
          <div className="kpi-subtext">Cold-chain and emergency diversion compliance reviews</div>
        </div>

        <div className="directives-kpi-card">
          <div className="kpi-label">Emergency Broadcast Channel</div>
          <div className="kpi-value-row">
            <span className="kpi-big-num">ONLINE</span>
            <span className="kpi-badge good">Class-4 Bus</span>
          </div>
          <div className="kpi-subtext">Instant push notifications to clinical mobile & OS HUDs</div>
        </div>
      </div>

      {/* Control Header */}
      <div className="directives-control-bar">
        <div className="directives-filter-group">
          <Filter size={14} />
          <span>Severity Filter:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="directives-select"
          >
            <option value="all">All Directives ({directives.length})</option>
            <option value="mandatory_order">Mandatory Orders</option>
            <option value="stat_advisory">STAT Advisories</option>
            <option value="national_emergency">National Emergencies</option>
            <option value="standard_guidance">Standard Guidance</option>
          </select>
        </div>

        <button 
          type="button" 
          className="action-btn broadcast-btn"
          onClick={onOpenBroadcastModal}
        >
          <Send size={15} />
          <span>Broadcast Official Directive</span>
        </button>
      </div>

      {/* Directives Cards Deck */}
      <div className="directives-deck">
        {filteredDirectives.map((dir) => {
          const compliancePercent = dir.totalTargetedFacilities > 0
            ? Math.round((dir.complianceConfirmedCount / dir.totalTargetedFacilities) * 100)
            : 0;

          return (
            <div key={dir.directiveId} className={`directive-card ${dir.severity}`}>
              <div className="directive-header-strip">
                <div className="directive-code-cluster">
                  <span className="dir-code-badge">{dir.code}</span>
                  <span className={`dir-sev-badge ${dir.severity}`}>
                    {dir.severity.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="dir-cat-badge">
                    {dir.category.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div className="directive-status-tag">
                  <span className={`status-badge ${dir.status === 'active' ? 'alert' : 'accredited'}`}>
                    {dir.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <h3 className="directive-title">{dir.title}</h3>
              <p className="directive-summary">{dir.summary}</p>

              {/* Target Scope */}
              <div className="directive-scope-row">
                <div className="scope-item">
                  <span className="scope-label">Target Regions:</span>
                  <span className="scope-val">{dir.targetRegions.join(', ')}</span>
                </div>
                <div className="scope-item">
                  <span className="scope-label">Target Facilities:</span>
                  <span className="scope-val">
                    {dir.targetFacilityTiers.map((t) => t.replace(/_/g, ' ')).join(', ')}
                  </span>
                </div>
                <div className="scope-item">
                  <span className="scope-label">Effective Horizon:</span>
                  <span className="scope-val">{dir.issuedDate} &rarr; {dir.effectiveUntil}</span>
                </div>
              </div>

              {/* Mandatory Action Items */}
              <div className="mandatory-actions-block">
                <h4>Mandatory Operational Requirements:</h4>
                <ul className="actions-checklist">
                  {dir.mandatoryActions.map((act, idx) => (
                    <li key={idx}>
                      <CheckSquare2 size={15} className="text-good" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Network Confirmation Progress Bar */}
              <div className="compliance-tracker-row">
                <div className="tracker-text">
                  <span>Hospital Network Confirmation Progress:</span>
                  <strong>{dir.complianceConfirmedCount} of {dir.totalTargetedFacilities} Facilities ({compliancePercent}%)</strong>
                </div>
                <div className="progress-bar-track">
                  <div 
                    className={`progress-bar-fill ${compliancePercent >= 90 ? 'optimal' : compliancePercent >= 50 ? 'warning' : 'critical'}`}
                    style={{ width: `${compliancePercent}%` }}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="directive-card-footer">
                <div className="footer-left">
                  <span>Directive Issued by Authority of MOH Chief Health Inspector</span>
                </div>
                <div className="footer-right">
                  {dir.status === 'active' ? (
                    <button
                      type="button"
                      className="mini-action-btn-outline"
                      onClick={() => onUpdateDirectiveStatus(dir.directiveId, 'completed')}
                    >
                      Mark Protocol Fulfilled & Archive
                    </button>
                  ) : (
                    <span className="text-good font-bold text-xs">
                      <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />
                      Completed & Logged in Regulatory Archives
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
