'use client';

import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sliders,
  ShieldCheck,
  Bell,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Lock,
  Radio,
  Eye,
  Zap,
  Sparkles,
  Save,
  RotateCcw,
  Smartphone,
  Globe,
  Database,
  Moon,
  Sun
} from 'lucide-react';
import type { MOHOfficerSession } from './MOHAuthScreen';

export interface ThemeConfig {
  colorPalette: 'akwa-ibom' | 'emerald' | 'amber' | 'ocean';
  fluidMotionEnabled: boolean;
  motionSpeed: 'slow' | 'balanced' | 'energetic';
  ambientOrbsEnabled: boolean;
  glassIntensity: 'low' | 'medium' | 'high';
  highContrast: boolean;
  density: 'standard' | 'compact';
}

const DEFAULT_THEME: ThemeConfig = {
  colorPalette: 'akwa-ibom',
  fluidMotionEnabled: true,
  motionSpeed: 'balanced',
  ambientOrbsEnabled: true,
  glassIntensity: 'high',
  highContrast: false,
  density: 'standard',
};

interface SettingsViewProps {
  officerSession?: MOHOfficerSession | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ officerSession }) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'telemetry' | 'security' | 'notifications'>('theme');
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Operational toggles
  const [pollingRate, setPollingRate] = useState<number>(30);
  const [autoDispatchCredentials, setAutoDispatchCredentials] = useState<boolean>(true);
  const [smsGatewayActive, setSmsGatewayActive] = useState<boolean>(true);
  const [retentionPeriod, setRetentionPeriod] = useState<string>('permanent');
  const [emergencyCode, setEmergencyCode] = useState<'green' | 'yellow' | 'red'>('green');

  // Load saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('medcore_theme_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setTheme({ ...DEFAULT_THEME, ...parsed });
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme in real-time to DOM
  const applyThemeToDOM = (cfg: ThemeConfig) => {
    const root = document.documentElement;
    const body = document.body;

    // Fluid motion toggle
    if (cfg.fluidMotionEnabled) {
      body.style.removeProperty('animation');
      const speeds = { slow: '28s', balanced: '20s', energetic: '10s' };
      body.style.animationDuration = speeds[cfg.motionSpeed];
    } else {
      body.style.animation = 'none';
    }

    // Ambient orbs toggle
    if (cfg.ambientOrbsEnabled) {
      root.style.setProperty('--ambient-orbs-opacity', '1');
    } else {
      root.style.setProperty('--ambient-orbs-opacity', '0');
    }

    // High contrast
    if (cfg.highContrast) {
      root.classList.add('high-contrast-mode');
    } else {
      root.classList.remove('high-contrast-mode');
    }

    // Palette classes
    root.setAttribute('data-theme-palette', cfg.colorPalette);
  };

  const updateTheme = (partial: Partial<ThemeConfig>) => {
    const updated = { ...theme, ...partial };
    setTheme(updated);
    applyThemeToDOM(updated);
    try {
      localStorage.setItem('medcore_theme_config', JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast('Theme updated in real time');
  };

  const handleResetDefaults = () => {
    setTheme(DEFAULT_THEME);
    applyThemeToDOM(DEFAULT_THEME);
    try {
      localStorage.setItem('medcore_theme_config', JSON.stringify(DEFAULT_THEME));
    } catch {
      // ignore
    }
    showToast('Theme reset to official state defaults');
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3200);
  };

  return (
    <div className="dash-settings-container">
      {/* Toast alert */}
      {saveToast && (
        <div className="dash-settings-toast">
          <CheckCircle2 size={16} color="#10B981" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="dash-settings-header">
        <div className="dash-settings-header-left">
          <div className="dash-settings-header-badge">
            <Sliders size={14} />
            <span>EXECUTIVE COMMAND SYSTEM CONTROLS</span>
          </div>
          <h1 className="dash-settings-title">System Settings & Theme Configuration</h1>
          <p className="dash-settings-subtitle">
            Configure real-time ministerial telemetry, visual aesthetics, Akwa Ibom brand identity, and secure terminal parameters.
          </p>
        </div>
        <div className="dash-settings-header-actions">
          <button 
            type="button" 
            className="dash-settings-reset-btn"
            onClick={handleResetDefaults}
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="dash-settings-tabs">
        <button
          type="button"
          className={`dash-settings-tab ${activeTab === 'theme' ? 'active' : ''}`}
          onClick={() => setActiveTab('theme')}
        >
          <Palette size={16} />
          <span>Theme & Appearance</span>
        </button>
        <button
          type="button"
          className={`dash-settings-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <Cpu size={16} />
          <span>Surveillance & Telemetry</span>
        </button>
        <button
          type="button"
          className={`dash-settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} />
          <span>Alerts & Gateways</span>
        </button>
        <button
          type="button"
          className={`dash-settings-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <ShieldCheck size={16} />
          <span>Officer Terminal Security</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="dash-settings-content">
        {/* ===================== TAB 1: THEME & CUSTOMIZATION ===================== */}
        {activeTab === 'theme' && (
          <div className="dash-theme-customizer">
            {/* Color Palettes Section */}
            <div className="dash-setting-card">
              <div className="dash-setting-card-header">
                <div className="dash-setting-card-icon-wrap green">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="dash-setting-card-title">Color Theme & Palette</h3>
                  <p className="dash-setting-card-desc">
                    Select the active color theme blended across dashboard card surfaces, HUD metrics, and borders.
                  </p>
                </div>
              </div>

              <div className="dash-palette-grid">
                {/* 1. Sovereign Tri-Color */}
                <div
                  className={`dash-palette-card ${theme.colorPalette === 'akwa-ibom' ? 'selected' : ''}`}
                  onClick={() => updateTheme({ colorPalette: 'akwa-ibom' })}
                >
                  <div className="dash-palette-preview tri-color-preview">
                    <span className="swatch sw-emerald" />
                    <span className="swatch sw-orange" />
                    <span className="swatch sw-gold" />
                  </div>
                  <div className="dash-palette-meta">
                    <div className="dash-palette-name">
                      <span>Akwa Ibom Sovereign Tri-Color</span>
                      {theme.colorPalette === 'akwa-ibom' && <CheckCircle2 size={16} className="selected-check" />}
                    </div>
                    <div className="dash-palette-desc">Official State Identity: Deep Emerald, Sun Orange & Warm Gold.</div>
                  </div>
                </div>

                {/* 2. Emerald Authority */}
                <div
                  className={`dash-palette-card ${theme.colorPalette === 'emerald' ? 'selected' : ''}`}
                  onClick={() => updateTheme({ colorPalette: 'emerald' })}
                >
                  <div className="dash-palette-preview emerald-preview">
                    <span className="swatch sw-forest" />
                    <span className="swatch sw-mint" />
                    <span className="swatch sw-white" />
                  </div>
                  <div className="dash-palette-meta">
                    <div className="dash-palette-name">
                      <span>Emerald Authority</span>
                      {theme.colorPalette === 'emerald' && <CheckCircle2 size={16} className="selected-check" />}
                    </div>
                    <div className="dash-palette-desc">Healthcare Precision: Forest Green, Crisp Mint & Radiant White.</div>
                  </div>
                </div>

                {/* 3. Sunrise Amber */}
                <div
                  className={`dash-palette-card ${theme.colorPalette === 'amber' ? 'selected' : ''}`}
                  onClick={() => updateTheme({ colorPalette: 'amber' })}
                >
                  <div className="dash-palette-preview amber-preview">
                    <span className="swatch sw-gold" />
                    <span className="swatch sw-amber" />
                    <span className="swatch sw-emerald" />
                  </div>
                  <div className="dash-palette-meta">
                    <div className="dash-palette-name">
                      <span>Sunrise Amber</span>
                      {theme.colorPalette === 'amber' && <CheckCircle2 size={16} className="selected-check" />}
                    </div>
                    <div className="dash-palette-desc">Warm Horizon: Solar Amber, Golden Sunburst & Deep Pine.</div>
                  </div>
                </div>

                {/* 4. Ocean Maritime */}
                <div
                  className={`dash-palette-card ${theme.colorPalette === 'ocean' ? 'selected' : ''}`}
                  onClick={() => updateTheme({ colorPalette: 'ocean' })}
                >
                  <div className="dash-palette-preview ocean-preview">
                    <span className="swatch sw-teal" />
                    <span className="swatch sw-cyan" />
                    <span className="swatch sw-emerald" />
                  </div>
                  <div className="dash-palette-meta">
                    <div className="dash-palette-name">
                      <span>Ocean Maritime</span>
                      {theme.colorPalette === 'ocean' && <CheckCircle2 size={16} className="selected-check" />}
                    </div>
                    <div className="dash-palette-desc">Coastal Atlantic: Deep Teal, Luminous Cyan & Emerald Reef.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fluid Motion & Gradient Controls */}
            <div className="dash-setting-card">
              <div className="dash-setting-card-header">
                <div className="dash-setting-card-icon-wrap orange">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="dash-setting-card-title">Fluid Motion & Gradient Dynamics</h3>
                  <p className="dash-setting-card-desc">
                    Control the continuous animated fluid flow on card backgrounds, ambient lighting orbs, and transition speeds.
                  </p>
                </div>
              </div>

              <div className="dash-settings-controls-list">
                {/* Fluid Animation Toggle */}
                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">Fluid Animated Gradient Flow</div>
                    <div className="dash-control-hint">
                      Smooth multi-layer background gradient animation on cards and background wallpaper.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`dash-switch-toggle ${theme.fluidMotionEnabled ? 'on' : 'off'}`}
                    onClick={() => updateTheme({ fluidMotionEnabled: !theme.fluidMotionEnabled })}
                  >
                    <span className="dash-switch-thumb" />
                  </button>
                </div>

                {/* Animation Speed Selector */}
                {theme.fluidMotionEnabled && (
                  <div className="dash-control-row">
                    <div className="dash-control-info">
                      <div className="dash-control-label">Gradient Flow Velocity</div>
                      <div className="dash-control-hint">Cycle duration for the fluid aurora movement.</div>
                    </div>
                    <div className="dash-speed-chips">
                      {(['slow', 'balanced', 'energetic'] as const).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          className={`dash-speed-chip ${theme.motionSpeed === spd ? 'active' : ''}`}
                          onClick={() => updateTheme({ motionSpeed: spd })}
                        >
                          {spd === 'slow' ? 'Gentle (28s)' : spd === 'balanced' ? 'Balanced (20s)' : 'Fast (10s)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ambient Wave Orbs Toggle */}
                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">Ambient Floating Wave Orbs</div>
                    <div className="dash-control-hint">
                      Hardware-accelerated ambient glowing light orbs in viewport corners.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`dash-switch-toggle ${theme.ambientOrbsEnabled ? 'on' : 'off'}`}
                    onClick={() => updateTheme({ ambientOrbsEnabled: !theme.ambientOrbsEnabled })}
                  >
                    <span className="dash-switch-thumb" />
                  </button>
                </div>
              </div>
            </div>

            {/* Display & Accessibility */}
            <div className="dash-setting-card">
              <div className="dash-setting-card-header">
                <div className="dash-setting-card-icon-wrap gold">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="dash-setting-card-title">Glassmorphism & Legibility</h3>
                  <p className="dash-setting-card-desc">
                    Adjust frosted glass backdrop intensity and accessibility contrast settings.
                  </p>
                </div>
              </div>

              <div className="dash-settings-controls-list">
                {/* High Contrast */}
                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">High-Contrast Text Hierarchy</div>
                    <div className="dash-control-hint">
                      Enforces maximum AAA luminance contrast across card titles, badges, and metrics.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`dash-switch-toggle ${theme.highContrast ? 'on' : 'off'}`}
                    onClick={() => updateTheme({ highContrast: !theme.highContrast })}
                  >
                    <span className="dash-switch-thumb" />
                  </button>
                </div>

                {/* Glassmorphism Intensity */}
                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">Glass Frosted Blur Depth</div>
                    <div className="dash-control-hint">
                      Level of frosted glass refraction on topbar, sub-panels, and dropdowns.
                    </div>
                  </div>
                  <div className="dash-speed-chips">
                    {(['low', 'medium', 'high'] as const).map((intensity) => (
                      <button
                        key={intensity}
                        type="button"
                        className={`dash-speed-chip ${theme.glassIntensity === intensity ? 'active' : ''}`}
                        onClick={() => updateTheme({ glassIntensity: intensity })}
                      >
                        {intensity.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: SURVEILLANCE & TELEMETRY ===================== */}
        {activeTab === 'telemetry' && (
          <div className="dash-theme-customizer">
            <div className="dash-setting-card">
              <div className="dash-setting-card-header">
                <div className="dash-setting-card-icon-wrap green">
                  <Radio size={20} />
                </div>
                <div>
                  <h3 className="dash-setting-card-title">State Health Surveillance Telemetry</h3>
                  <p className="dash-setting-card-desc">
                    Real-time data feed configuration across 31 Local Government Areas and General Hospitals.
                  </p>
                </div>
              </div>

              <div className="dash-settings-controls-list">
                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">Live Facility Heartbeat Polling Frequency</div>
                    <div className="dash-control-hint">Interval for querying ICU census, mortality logs, and emergency wards.</div>
                  </div>
                  <div className="dash-speed-chips">
                    {[15, 30, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        className={`dash-speed-chip ${pollingRate === sec ? 'active' : ''}`}
                        onClick={() => {
                          setPollingRate(sec);
                          showToast(`Polling frequency set to every ${sec} seconds`);
                        }}
                      >
                        Every {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">Auto-Dispatch Hospital OS Logins</div>
                    <div className="dash-control-hint">
                      Automatically transmit credential tokens when new facilities register.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`dash-switch-toggle ${autoDispatchCredentials ? 'on' : 'off'}`}
                    onClick={() => {
                      setAutoDispatchCredentials(!autoDispatchCredentials);
                      showToast(autoDispatchCredentials ? 'Auto-dispatch paused' : 'Auto-dispatch activated');
                    }}
                  >
                    <span className="dash-switch-thumb" />
                  </button>
                </div>

                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">State Emergency Alert Level Override</div>
                    <div className="dash-control-hint">
                      Sets active surveillance posture across all territorial health dashboards.
                    </div>
                  </div>
                  <div className="dash-speed-chips">
                    <button
                      type="button"
                      className={`dash-speed-chip ${emergencyCode === 'green' ? 'active code-green' : ''}`}
                      onClick={() => {
                        setEmergencyCode('green');
                        showToast('Emergency Status: Code Green (Normal Operations)');
                      }}
                    >
                      CODE GREEN
                    </button>
                    <button
                      type="button"
                      className={`dash-speed-chip ${emergencyCode === 'yellow' ? 'active code-yellow' : ''}`}
                      onClick={() => {
                        setEmergencyCode('yellow');
                        showToast('Emergency Status: Code Yellow (Heightened Alert)');
                      }}
                    >
                      CODE YELLOW
                    </button>
                    <button
                      type="button"
                      className={`dash-speed-chip ${emergencyCode === 'red' ? 'active code-red' : ''}`}
                      onClick={() => {
                        setEmergencyCode('red');
                        showToast('Emergency Status: Code Red (Surge Containment Active)');
                      }}
                    >
                      CODE RED
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: ALERTS & NOTIFICATIONS ===================== */}
        {activeTab === 'notifications' && (
          <div className="dash-theme-customizer">
            <div className="dash-setting-card">
              <div className="dash-setting-card-header">
                <div className="dash-setting-card-icon-wrap orange">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="dash-setting-card-title">Emergency Broadcast Gateways</h3>
                  <p className="dash-setting-card-desc">
                    Integration relays for dispatching official health directives to Medical Directors.
                  </p>
                </div>
              </div>

              <div className="dash-settings-controls-list">
                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">State SMS Emergency Broadcast Gateway</div>
                    <div className="dash-control-hint">
                      Direct GSM relay through state government telecommunication lines.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`dash-switch-toggle ${smsGatewayActive ? 'on' : 'off'}`}
                    onClick={() => {
                      setSmsGatewayActive(!smsGatewayActive);
                      showToast(smsGatewayActive ? 'SMS Gateway suspended' : 'SMS Gateway enabled');
                    }}
                  >
                    <span className="dash-switch-thumb" />
                  </button>
                </div>

                <div className="dash-control-row">
                  <div className="dash-control-info">
                    <div className="dash-control-label">Data Retention & Audit Ledger Policy</div>
                    <div className="dash-control-hint">
                      Retention length for cryptographic audit records and compliance logs.
                    </div>
                  </div>
                  <div className="dash-speed-chips">
                    {['90_days', '1_year', 'permanent'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`dash-speed-chip ${retentionPeriod === p ? 'active' : ''}`}
                        onClick={() => {
                          setRetentionPeriod(p);
                          showToast(`Audit policy set to: ${p.replace('_', ' ').toUpperCase()}`);
                        }}
                      >
                        {p === 'permanent' ? 'SOVEREIGN PERMANENT' : p.replace('_', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: OFFICER SECURITY ===================== */}
        {activeTab === 'security' && (
          <div className="dash-theme-customizer">
            <div className="dash-setting-card">
              <div className="dash-setting-card-header">
                <div className="dash-setting-card-icon-wrap green">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="dash-setting-card-title">Officer Credentials & Clearance</h3>
                  <p className="dash-setting-card-desc">
                    Active ministerial identity, cryptographic session tokens, and security clearance.
                  </p>
                </div>
              </div>

              <div className="dash-officer-info-grid">
                <div className="dash-info-tile">
                  <div className="dash-info-tile-label">OFFICER NAME</div>
                  <div className="dash-info-tile-val">{officerSession?.name || 'Hon. Dr. Emmanuel Udoh'}</div>
                </div>
                <div className="dash-info-tile">
                  <div className="dash-info-tile-label">DESIGNATION</div>
                  <div className="dash-info-tile-val">{officerSession?.role || 'Commissioner of Health'}</div>
                </div>
                <div className="dash-info-tile">
                  <div className="dash-info-tile-label">CLEARANCE LEVEL</div>
                  <div className="dash-info-tile-val text-gold">Level-5 Sovereign Executive</div>
                </div>
                <div className="dash-info-tile">
                  <div className="dash-info-tile-label">JURISDICTION</div>
                  <div className="dash-info-tile-val">Akwa Ibom State Statewide</div>
                </div>
                <div className="dash-info-tile">
                  <div className="dash-info-tile-label">SESSION TOKEN</div>
                  <div className="dash-info-tile-val font-mono">{officerSession?.token || 'AKSG-MOH-SECURE-NODE'}</div>
                </div>
                <div className="dash-info-tile">
                  <div className="dash-info-tile-label">AUTHENTICATION METHOD</div>
                  <div className="dash-info-tile-val text-emerald">PKI Token Verified</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
