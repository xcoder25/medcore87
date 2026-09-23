'use client';

import React from 'react';
import { 
  ShieldAlert, 
  Radio, 
  Send, 
  FileSpreadsheet, 
  CalendarPlus, 
  Layers, 
  Building2, 
  Activity, 
  FileCheck2, 
  Users2, 
  Scale,
  Bot,
  Sparkles,
  Lock,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import type { MOHOfficerSession } from './MOHAuthScreen';

export type AdminTab = 
  | 'hud' 
  | 'facilities' 
  | 'epidemiology' 
  | 'licensing' 
  | 'workforce' 
  | 'directives'
  | 'ai';

interface AdminHeaderProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  onOpenBroadcastModal: () => void;
  onOpenScheduleAuditModal: () => void;
  activeAlertsCount: number;
  activeDirectivesCount: number;
  officerSession?: MOHOfficerSession | null;
  onLockScreen?: () => void;
  onLogout?: () => void;
  onGenerateBriefing?: () => void;
  telemetryOnline?: boolean;
  lastSyncAt?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  onTabChange,
  selectedRegion,
  onRegionChange,
  onOpenBroadcastModal,
  onOpenScheduleAuditModal,
  activeAlertsCount,
  activeDirectivesCount,
  officerSession,
  onLockScreen,
  onLogout,
  onGenerateBriefing,
  telemetryOnline = false,
  lastSyncAt,
}) => {
  const regions = [
    'All National Jurisdictions',
    'Capital Central',
    'Northern District',
    'Eastern District',
    'Western Province',
  ];

  return (
    <header className="admin-header-v2">
      {/* Top Credentials & Authority Strip */}
      <div className="moh-top-credentials-bar">
        <div className="moh-brand-cluster">
          <div className="moh-seal-icon">
            <ShieldAlert size={20} className="seal-svg" />
          </div>
          <div className="moh-title-block">
            <div className="moh-department-tag">
              MINISTRY OF HEALTH & REGULATORY OVERSIGHT
            </div>
            <div className="moh-division-title">
              National Health Surveillance & Regulatory Operations Directorate
            </div>
          </div>
        </div>

        <div className="moh-security-telemetry-cluster">
          <div className="jurisdiction-select-wrapper">
            <label htmlFor="jurisdiction-select">Jurisdiction:</label>
            <select
              id="jurisdiction-select"
              value={selectedRegion}
              onChange={(e) => onRegionChange(e.target.value)}
              className="jurisdiction-dropdown"
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {officerSession ? (
            <div className="moh-session-bar">
              <div className="moh-officer-pill">
                <div className="moh-officer-avatar-sm">{officerSession.avatarInitials}</div>
                <span style={{ fontWeight: 600 }}>{officerSession.name}</span>
                <span className="moh-level-badge-sm">LEVEL {officerSession.clearanceLevel}</span>
              </div>
              {onLockScreen && (
                <button type="button" className="moh-auth-btn-ghost" onClick={onLockScreen} title="Lock ministerial terminal">
                  <Lock size={13} />
                  <span>Lock</span>
                </button>
              )}
              {onLogout && (
                <button type="button" className="moh-auth-btn-ghost" onClick={onLogout} title="Switch official or sign out">
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          ) : (
            <div className="security-badge">
              <span className="sec-dot"></span>
              <span>Zero-Trust Level 5</span>
            </div>
          )}

          <div className="telemetry-live-pill" title={telemetryOnline ? 'Gateway WebSocket connected' : 'Local realtime simulation'}>
            <Radio size={14} className="pulse-icon" />
            <span>Port 3004 Telemetry Sync</span>
          </div>
        </div>
      </div>

      {/* Hero Headline & Quick Command Actions */}
      <div className="moh-hero-banner">
        <div className="hero-text-side">
          <h1>National Healthcare Command & Regulatory Portal</h1>
          <p>
            Real-time inter-hospital telemetry, surge capacity tracking, early epidemiological outbreak detection, facility accreditation enforcement, and national healthcare workforce distribution.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button 
            type="button" 
            className="action-btn broadcast-btn"
            onClick={onOpenBroadcastModal}
          >
            <Send size={15} />
            <span>Broadcast Directive</span>
          </button>
          <button 
            type="button" 
            className="action-btn audit-btn"
            onClick={onOpenScheduleAuditModal}
          >
            <CalendarPlus size={15} />
            <span>Schedule Inspection</span>
          </button>
          <button 
            type="button" 
            className="action-btn report-btn"
            onClick={() => onGenerateBriefing?.()}
          >
            <FileSpreadsheet size={15} />
            <span>Export Briefing</span>
          </button>
        </div>
      </div>

      {/* Navigation Command Tabs */}
      <nav className="moh-navigation-tabs" aria-label="Console Modules">
        <button
          type="button"
          className={`moh-nav-tab ${activeTab === 'hud' ? 'active' : ''}`}
          onClick={() => onTabChange('hud')}
        >
          <Layers size={16} />
          <span>Command HUD</span>
        </button>

        <button
          type="button"
          className={`moh-nav-tab ${activeTab === 'facilities' ? 'active' : ''}`}
          onClick={() => onTabChange('facilities')}
        >
          <Building2 size={16} />
          <span>Facility Surveillance</span>
          <span className="nav-pill-counter">124</span>
        </button>

        <button
          type="button"
          className={`moh-nav-tab ${activeTab === 'epidemiology' ? 'active' : ''}`}
          onClick={() => onTabChange('epidemiology')}
        >
          <Activity size={16} />
          <span>Epidemiological Radar</span>
          {activeAlertsCount > 0 && (
            <span className="nav-pill-counter alert-pulse">{activeAlertsCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`moh-nav-tab ${activeTab === 'licensing' ? 'active' : ''}`}
          onClick={() => onTabChange('licensing')}
        >
          <FileCheck2 size={16} />
          <span>Licensing & Audits</span>
        </button>

        <button
          type="button"
          className={`moh-nav-tab ${activeTab === 'workforce' ? 'active' : ''}`}
          onClick={() => onTabChange('workforce')}
        >
          <Users2 size={16} />
          <span>National Workforce</span>
          <span className="nav-pill-counter">14.8k</span>
        </button>

        <button
          type="button"
          className={`moh-nav-tab ${activeTab === 'directives' ? 'active' : ''}`}
          onClick={() => onTabChange('directives')}
        >
          <Scale size={16} />
          <span>Regulatory Directives</span>
          {activeDirectivesCount > 0 && (
            <span className="nav-pill-counter gold-counter">{activeDirectivesCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`moh-nav-tab moh-nav-tab--ai ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => onTabChange('ai')}
        >
          <Bot size={16} className="ai-nav-icon" />
          <span>M87 Cortex AI</span>
          <span className="nav-pill-counter ai-pulse-counter">
            <Sparkles size={10} />
            Autonomous
          </span>
        </button>
      </nav>
    </header>
  );
};
