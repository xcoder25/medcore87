'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { 
  RegionalFacilityOverview, 
  EpidemiologicalAlert, 
  RegulatoryComplianceAudit, 
  RegulatoryDirective 
} from '@medcore/types';
import { 
  Building2, 
  Bed, 
  Activity, 
  AlertOctagon, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp,
  Scale,
  CreditCard,
  Radio,
  FileCheck2,
  Users2,
  Calendar,
  AlertTriangle,
  Send,
  Zap,
  Bot,
  Sparkles,
  Search,
  ExternalLink,
  Lock,
  ChevronRight,
  Shield
} from 'lucide-react';

interface NationalCommandHudProps {
  facilities: RegionalFacilityOverview[];
  alerts: EpidemiologicalAlert[];
  audits: RegulatoryComplianceAudit[];
  directives: RegulatoryDirective[];
  onSelectFacility: (facility: RegionalFacilityOverview) => void;
  onNavigateToTab: (tab: any) => void;
}

export const NationalCommandHud: React.FC<NationalCommandHudProps> = ({
  facilities,
  alerts,
  audits,
  directives,
  onSelectFacility,
  onNavigateToTab,
}) => {
  const [selectedMapRegion, setSelectedMapRegion] = useState<string | null>(null);
  const [mortalitySearch, setMortalitySearch] = useState('');
  const [activeAssistantPrompt, setActiveAssistantPrompt] = useState<string | null>(null);

  // Verified Registry Records (Clean real hospital names and physician hashes)
  const VERIFIED_MORTALITY_RECORDS = [
    {
      id: '#MD-2025-00481',
      condition: 'Acute Myocardial Infarction',
      icd10: 'I21.0',
      facility: 'Uyo General Hospital',
      timestamp: '2025-09-14 08:32',
      verifiedHash: 'a3f9...7e2c',
      status: 'VERIFIED',
    },
    {
      id: '#MD-2025-00480',
      condition: 'Acute Respiratory Distress (Pneumonia)',
      icd10: 'J96.0',
      facility: 'Eket General Hospital',
      timestamp: '2025-09-13 21:17',
      verifiedHash: '6d4e...9b1f',
      status: 'VERIFIED',
    },
    {
      id: '#MD-2025-00479',
      condition: 'Septic Shock / Multi-organ Failure',
      icd10: 'A41.9',
      facility: 'Ikot Ekpene General Hospital',
      timestamp: '2025-09-13 16:03',
      verifiedHash: '9e2a...e8f0',
      status: 'VERIFIED',
    },
  ];

  // Hospital Accreditation & Regulatory Audits (Replacing all corrupted names)
  const ACCREDITATION_AUDITS = [
    {
      facility: "St. Luke's Hospital, Anua",
      type: 'Pharmacy Cold-Chain & Vaccine Audit',
      score: 94,
      status: 'Passed',
      auditor: 'Dr. Evelyn Vance',
      deadline: '2026-03-15',
    },
    {
      facility: 'General Hospital, Ikot Ekpene',
      type: 'ICU Radiation & Sterilization Safety',
      score: 89,
      status: 'Remediation Required',
      auditor: 'Engr. Bassey Archibong',
      deadline: '2025-10-15',
    },
    {
      facility: 'Eket Immanuel Hospital',
      type: 'Maternal Care Quality & Protocol Review',
      score: 91,
      status: 'Passed',
      auditor: 'Marcus Bennett',
      deadline: '2025-11-30',
    },
  ];

  const handleAssistantPromptClick = (prompt: string) => {
    setActiveAssistantPrompt(prompt);
    onNavigateToTab('ai');
  };

  return (
    <div className="dash-command-centre-layout">
      {/* ── TOP HERO HEADER STRIP ── */}
      <div className="dash-hero-header-row">
        {/* Left: Title & Live Status Badge */}
        <div className="dash-hero-title-col">
          <div className="dash-hero-headline-wrap">
            <h1 className="dash-hero-headline">Command Centre</h1>
            <span className="dash-status-pill">
              <span className="dash-status-dot" />
              <span>Live System Status</span>
            </span>
          </div>
          <p className="dash-hero-subheadline">
            Executive Overview &ndash; Akwa Ibom State
          </p>
        </div>

        {/* Center: Akwa Ibom Healthcare Quote Banner */}
        <div className="dash-hero-quote-banner">
          <div className="dash-hero-quote-overlay" />
          <div className="dash-hero-quote-content">
            <div className="dash-hero-arise-tag">
              <Image 
                src="/arise-logo.png" 
                alt="ARISE" 
                width={56} 
                height={24} 
                className="dash-quote-arise-img" 
              />
            </div>
            <div className="dash-hero-quote-text">
              &ldquo;Better healthcare for a healthier Akwa Ibom.&rdquo;
            </div>
            <div className="dash-hero-quote-author">&mdash; Ministry of Health</div>
          </div>
        </div>

        {/* Right Top Cards: Epidemiological Alert Status & Surge Status Map */}
        <div className="dash-hero-right-cards">
          {/* Epidemiological Alert Status (Red Card) */}
          <div className="dash-alert-status-card">
            <div className="dash-alert-header">
              <AlertOctagon size={18} className="dash-alert-icon" />
              <span className="dash-alert-title">Epidemiological Alert Status</span>
            </div>
            <div className="dash-alert-items">
              <div className="dash-alert-row">
                <span className="dash-alert-dot red" />
                <span className="dash-alert-label">Active Quarantine Protocols:</span>
                <strong className="dash-alert-val">2 regions &bull; 5 facilities</strong>
              </div>
              <div className="dash-alert-row">
                <span className="dash-alert-dot amber" />
                <span className="dash-alert-label">Emerging Pathogen Clusters:</span>
                <strong className="dash-alert-val">1 cluster &bull; RSV (Uyo)</strong>
              </div>
              <div className="dash-alert-row">
                <span className="dash-alert-dot red" />
                <span className="dash-alert-label">Outbreak Surge Indicator:</span>
                <span className="dash-badge-high">High</span>
                <span className="dash-alert-detail">Gastroenteritis (Eastern)</span>
              </div>
            </div>
          </div>

          {/* Surge Status Map Card (Replaced "Surge Status Radar") */}
          <div className="dash-surge-map-card">
            <div className="dash-surge-map-header">
              <Radio size={16} className="dash-surge-icon" />
              <span className="dash-surge-title">Surge Status Map</span>
            </div>
            <div className="dash-surge-content-row">
              {/* Akwa Ibom State Map Vector */}
              <div className="dash-surge-svg-wrap">
                <svg viewBox="0 0 110 95" className="dash-surge-state-svg">
                  {/* Uyo Region (Green) */}
                  <path
                    d="M 38 18 C 50 14, 66 18, 72 28 C 65 38, 52 38, 42 32 Z"
                    fill={selectedMapRegion === 'Uyo' ? '#10B981' : '#059669'}
                    stroke="#10B981"
                    strokeWidth="1.2"
                    className="dash-svg-region"
                    onClick={() => setSelectedMapRegion('Uyo')}
                  >
                    <title>Uyo Region (Normal Surge)</title>
                  </path>
                  {/* Ikot Ekpene Region (Yellow / Code Yellow) */}
                  <path
                    d="M 22 34 C 36 30, 44 33, 44 48 C 32 52, 20 46, 22 34 Z"
                    fill={selectedMapRegion === 'Ikot Ekpene' ? '#FBBF24' : '#D97706'}
                    stroke="#F59E0B"
                    strokeWidth="1.2"
                    className="dash-svg-region"
                    onClick={() => setSelectedMapRegion('Ikot Ekpene')}
                  >
                    <title>Ikot Ekpene Region (Code Yellow)</title>
                  </path>
                  {/* Eket & Coastal Region (Red / Code Red) */}
                  <path
                    d="M 44 48 C 56 42, 74 44, 82 56 C 76 72, 54 74, 44 64 Z"
                    fill={selectedMapRegion === 'Eket' ? '#F87171' : '#DC2626'}
                    stroke="#EF4444"
                    strokeWidth="1.2"
                    className="dash-svg-region"
                    onClick={() => setSelectedMapRegion('Eket')}
                  >
                    <title>Eket Region (Code Red Surge)</title>
                  </path>
                  {/* Oruk Anam Region (Normal) */}
                  <path
                    d="M 24 50 C 40 54, 42 66, 36 78 C 22 74, 18 60, 24 50 Z"
                    fill="#047857"
                    stroke="#10B981"
                    strokeWidth="1.2"
                    className="dash-svg-region"
                  >
                    <title>Oruk Anam Region (Normal)</title>
                  </path>
                  {/* Map Pin Dots */}
                  <circle cx="52" cy="26" r="3" fill="#FFFFFF" />
                  <circle cx="34" cy="42" r="3" fill="#FFFFFF" />
                  <circle cx="62" cy="58" r="3" fill="#FFFFFF" />
                </svg>
              </div>

              {/* Legend with Hospital Counts */}
              <div className="dash-surge-legend">
                <div className="dash-legend-item">
                  <span className="dash-legend-dot green" />
                  <div className="dash-legend-text">
                    <span className="dash-legend-status">Normal</span>
                    <span className="dash-legend-count">32 hospitals</span>
                  </div>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot yellow" />
                  <div className="dash-legend-text">
                    <span className="dash-legend-status">Code Yellow</span>
                    <span className="dash-legend-count">11 hospitals</span>
                  </div>
                </div>
                <div className="dash-legend-item">
                  <span className="dash-legend-dot red" />
                  <div className="dash-legend-text">
                    <span className="dash-legend-status">Code Red</span>
                    <span className="dash-legend-count">4 hospitals</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP 4 KPI CARDS (MATCHING DASH.PNG) ── */}
      <section className="dash-kpi-grid-4">
        {/* KPI 1: Connected Hospitals */}
        <div className="dash-kpi-tile">
          <div className="dash-tile-header">
            <div className="dash-tile-icon-wrap blue">
              <Building2 size={16} />
            </div>
            <div className="dash-tile-title-group">
              <span className="dash-tile-label">Connected Hospitals</span>
              <span className="dash-tile-sub">Complete Coverage</span>
            </div>
          </div>
          <div className="dash-tile-val-row">
            <span className="dash-tile-num">47 / 47</span>
            <span className="dash-tile-pct-badge green">100%</span>
          </div>
          <div className="dash-tile-meta">
            <span className="dash-tile-accent green">+0</span>
            <span className="dash-tile-subtext">new this month</span>
          </div>
        </div>

        {/* KPI 2: Total Bed Capacity */}
        <div className="dash-kpi-tile">
          <div className="dash-tile-header">
            <div className="dash-tile-icon-wrap cyan">
              <Bed size={16} />
            </div>
            <div className="dash-tile-title-group">
              <span className="dash-tile-label">Total Bed Capacity</span>
              <span className="dash-tile-sub">Statewide Aggregate</span>
            </div>
          </div>
          <div className="dash-tile-val-row">
            <span className="dash-tile-num">4,832</span>
            <span className="dash-tile-occupancy">
              <strong>78%</strong> occupied
            </span>
          </div>
          <div className="dash-tile-bar-track">
            <div className="dash-tile-bar-fill cyan" style={{ width: '78%' }} />
          </div>
        </div>

        {/* KPI 3: ICU Utilization */}
        <div className="dash-kpi-tile">
          <div className="dash-tile-header">
            <div className="dash-tile-icon-wrap purple">
              <Activity size={16} />
            </div>
            <div className="dash-tile-title-group">
              <span className="dash-tile-label">ICU Utilization</span>
              <span className="dash-tile-sub">Critical Care Bays</span>
            </div>
          </div>
          <div className="dash-tile-val-row">
            <span className="dash-tile-num">68%</span>
            <span className="dash-tile-subtext">of 642 ICU beds</span>
          </div>
          <div className="dash-tile-bar-track">
            <div className="dash-tile-bar-fill purple" style={{ width: '68%' }} />
          </div>
        </div>

        {/* KPI 4: Standby Ventilators */}
        <div className="dash-kpi-tile">
          <div className="dash-tile-header">
            <div className="dash-tile-icon-wrap emerald">
              <Zap size={16} />
            </div>
            <div className="dash-tile-title-group">
              <span className="dash-tile-label">Standby Ventilators</span>
              <span className="dash-tile-sub">Emergency Deployment</span>
            </div>
          </div>
          <div className="dash-tile-val-row">
            <span className="dash-tile-num">312</span>
            <span className="dash-tile-tag green">available</span>
          </div>
          <div className="dash-tile-meta">
            <span className="dash-tile-subtext">Mutual-aid inventory ready</span>
          </div>
        </div>
      </section>

      {/* ── MIDDLE ROW: VITAL STATISTICS, ACCREDITATION & HEALTH AI ASSISTANT ── */}
      <section className="dash-middle-grid">
        {/* LEFT: Vital Statistics & Mortality Surveillance (Wide Card) */}
        <div className="dash-panel dash-vital-stats-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title-wrap">
              <div className="dash-panel-icon-wrap green">
                <Activity size={16} />
              </div>
              <h3 className="dash-panel-title">Vital Statistics & Mortality Surveillance</h3>
            </div>
            <button 
              type="button" 
              className="dash-panel-action-btn"
              onClick={() => onNavigateToTab('vital-stats')}
            >
              <span>Full Analytics</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* 5 Top Stat Boxes */}
          <div className="dash-vital-numbers-grid">
            <div className="dash-vital-stat-box">
              <span className="dash-stat-label">Total Monitored Patients</span>
              <span className="dash-stat-num">482,671</span>
              <span className="dash-stat-trend green">&uarr; 3.2%</span>
            </div>
            <div className="dash-vital-stat-box">
              <span className="dash-stat-label">Currently Admitted Inpatients</span>
              <span className="dash-stat-num">32,408</span>
              <span className="dash-stat-trend green">&uarr; 2.1%</span>
            </div>
            <div className="dash-vital-stat-box">
              <span className="dash-stat-label">Discharged Alive</span>
              <span className="dash-stat-num">421,386</span>
              <span className="dash-stat-trend green">&uarr; 4.5%</span>
            </div>
            <div className="dash-vital-stat-box">
              <span className="dash-stat-label">Total Deceased</span>
              <span className="dash-stat-num red-num">28,877</span>
              <span className="dash-stat-trend red">&uarr; 1.8%</span>
            </div>
            <div className="dash-vital-stat-box">
              <span className="dash-stat-label">Mortality Rate</span>
              <span className="dash-stat-num amber-num">5.97%</span>
              <span className="dash-stat-trend red">&uarr; 0.3%</span>
            </div>
          </div>

          {/* 3 Sub-columns: High Priority Alerts, ICD-10 Donut, Verified Registry */}
          <div className="dash-vital-sub-cols">
            {/* Sub-col 1: High Priority Alerts */}
            <div className="dash-priority-alerts-col">
              <div className="dash-sub-title">High-Priority Alerts</div>
              <div className="dash-priority-card">
                <div className="dash-priority-icon red">
                  <AlertTriangle size={15} />
                </div>
                <div className="dash-priority-body">
                  <div className="dash-priority-name">Maternal Mortality Watch</div>
                  <div className="dash-priority-num-row">
                    <span className="dash-priority-num">42</span>
                    <span className="dash-priority-badge red">&uarr; 12% vs last month</span>
                  </div>
                </div>
              </div>

              <div className="dash-priority-card">
                <div className="dash-priority-icon amber">
                  <AlertOctagon size={15} />
                </div>
                <div className="dash-priority-body">
                  <div className="dash-priority-name">Neonatal Mortality Watch</div>
                  <div className="dash-priority-num-row">
                    <span className="dash-priority-num">18</span>
                    <span className="dash-priority-badge amber">&uarr; 6% vs last month</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-col 2: ICD-10 Cause of Death Breakdown (Donut Chart) */}
            <div className="dash-icd10-donut-col">
              <div className="dash-sub-title">ICD-10 Cause of Death Breakdown</div>
              <div className="dash-donut-container">
                {/* SVG Donut Chart */}
                <div className="dash-donut-chart-wrap">
                  <svg viewBox="0 0 100 100" className="dash-donut-svg">
                    {/* Background Ring */}
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#1E293B" strokeWidth="12" />
                    {/* Segment 1: Cardiovascular (28.4%) - Blue */}
                    <circle 
                      cx="50" cy="50" r="38" fill="none" 
                      stroke="#3B82F6" strokeWidth="12" 
                      strokeDasharray="67.8 238.8" strokeDashoffset="0"
                    />
                    {/* Segment 2: Sepsis (18.7%) - Indigo */}
                    <circle 
                      cx="50" cy="50" r="38" fill="none" 
                      stroke="#6366F1" strokeWidth="12" 
                      strokeDasharray="44.6 238.8" strokeDashoffset="-67.8"
                    />
                    {/* Segment 3: Trauma (12.6%) - Amber */}
                    <circle 
                      cx="50" cy="50" r="38" fill="none" 
                      stroke="#F59E0B" strokeWidth="12" 
                      strokeDasharray="30.1 238.8" strokeDashoffset="-112.4"
                    />
                    {/* Segment 4: Respiratory (10.3%) - Red */}
                    <circle 
                      cx="50" cy="50" r="38" fill="none" 
                      stroke="#EF4444" strokeWidth="12" 
                      strokeDasharray="24.6 238.8" strokeDashoffset="-142.5"
                    />
                    {/* Segment 5: Stroke (7.8%) - Orange */}
                    <circle 
                      cx="50" cy="50" r="38" fill="none" 
                      stroke="#F97316" strokeWidth="12" 
                      strokeDasharray="18.6 238.8" strokeDashoffset="-167.1"
                    />
                    {/* Segment 6: Other (22.2%) - Slate */}
                    <circle 
                      cx="50" cy="50" r="38" fill="none" 
                      stroke="#64748B" strokeWidth="12" 
                      strokeDasharray="53.1 238.8" strokeDashoffset="-185.7"
                    />
                  </svg>
                  {/* Center Stat */}
                  <div className="dash-donut-center-label">
                    <span className="dash-donut-center-val">28,877</span>
                    <span className="dash-donut-center-sub">Total Deceased</span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="dash-donut-legend">
                  <div className="dash-donut-legend-item">
                    <span className="dash-donut-dot blue" />
                    <span className="dash-dli-name">Cardiovascular (I21)</span>
                    <span className="dash-dli-pct">28.4%</span>
                    <span className="dash-dli-count">8,207</span>
                  </div>
                  <div className="dash-donut-legend-item">
                    <span className="dash-donut-dot indigo" />
                    <span className="dash-dli-name">Sepsis (A41)</span>
                    <span className="dash-dli-pct">18.7%</span>
                    <span className="dash-dli-count">5,404</span>
                  </div>
                  <div className="dash-donut-legend-item">
                    <span className="dash-donut-dot amber" />
                    <span className="dash-dli-name">Trauma (V89)</span>
                    <span className="dash-dli-pct">12.6%</span>
                    <span className="dash-dli-count">3,643</span>
                  </div>
                  <div className="dash-donut-legend-item">
                    <span className="dash-donut-dot red" />
                    <span className="dash-dli-name">Respiratory (J96)</span>
                    <span className="dash-dli-pct">10.3%</span>
                    <span className="dash-dli-count">2,978</span>
                  </div>
                  <div className="dash-donut-legend-item">
                    <span className="dash-donut-dot orange" />
                    <span className="dash-dli-name">Stroke (I64)</span>
                    <span className="dash-dli-pct">7.8%</span>
                    <span className="dash-dli-count">2,255</span>
                  </div>
                  <div className="dash-donut-legend-item">
                    <span className="dash-donut-dot slate" />
                    <span className="dash-dli-name">Other</span>
                    <span className="dash-dli-pct">22.2%</span>
                    <span className="dash-dli-count">6,390</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-col 3: Verified Mortality Registry (Replaced "Cryptographic Mortality Registry") */}
            <div className="dash-verified-registry-col">
              <div className="dash-registry-header">
                <span className="dash-sub-title">Verified Mortality Registry</span>
                <span className="dash-registry-tag">SHA-256 Sealed</span>
              </div>
              <div className="dash-registry-list">
                {VERIFIED_MORTALITY_RECORDS.map((rec) => (
                  <div key={rec.id} className="dash-registry-card">
                    <div className="dash-reg-top">
                      <span className="dash-reg-id">{rec.id}</span>
                      <span className="dash-reg-time">{rec.timestamp}</span>
                    </div>
                    <div className="dash-reg-facility">{rec.facility}</div>
                    <div className="dash-reg-condition">
                      <span className="dash-reg-code">{rec.icd10}</span>
                      <span>{rec.condition}</span>
                    </div>
                    <div className="dash-reg-hash-row">
                      <ShieldCheck size={11} className="dash-hash-icon" />
                      <span className="dash-reg-hash">Ledger Hash: {rec.verifiedHash}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE-RIGHT 1: Hospital Accreditation & Regulatory Audits (CLEAN REPLACEMENT FOR BIAFIMATICS) */}
        <div className="dash-panel dash-accreditation-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title-wrap">
              <div className="dash-panel-icon-wrap purple">
                <FileCheck2 size={16} />
              </div>
              <h3 className="dash-panel-title">Hospital Accreditation & Regulatory Audits</h3>
            </div>
            <button 
              type="button" 
              className="dash-link-text"
              onClick={() => onNavigateToTab('licensing')}
            >
              View All
            </button>
          </div>

          {/* Top Featured Hospital Card */}
          <div className="dash-featured-audit-card">
            <div className="dash-fa-header">
              <div className="dash-fa-avatar">
                <Building2 size={18} />
              </div>
              <div>
                <div className="dash-fa-title">Apex Specialist & Teaching Hospital</div>
                <div className="dash-fa-sub">Uyo Metropolitan District &bull; National Referral Tier</div>
              </div>
              <span className="dash-badge-normal">Accredited</span>
            </div>
            <div className="dash-fa-details">
              <div className="dash-fa-detail-item">
                <span className="dash-fa-label">Statutory Inspection:</span>
                <strong>Annual Accreditation Audit</strong>
              </div>
              <div className="dash-fa-detail-item">
                <span className="dash-fa-label">Scheduled Date:</span>
                <strong>2025-09-30</strong>
              </div>
              <div className="dash-fa-detail-item">
                <span className="dash-fa-label">Lead Inspector:</span>
                <strong>Dr. Evelyn Vance</strong>
              </div>
            </div>
          </div>

          {/* Recent Audit Records List */}
          <div className="dash-audits-mini-list">
            {ACCREDITATION_AUDITS.map((item, i) => (
              <div key={i} className="dash-audit-mini-item">
                <div className="dash-ami-left">
                  <div className="dash-ami-facility">{item.facility}</div>
                  <div className="dash-ami-type">{item.type}</div>
                  <div className="dash-ami-meta">
                    <span>Score: <strong>{item.score}%</strong></span>
                    <span>&bull;</span>
                    <span>Auditor: {item.auditor}</span>
                  </div>
                </div>
                <div className="dash-ami-right">
                  <span className={`dash-audit-status-badge ${item.status === 'Passed' ? 'passed' : 'remedial'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE-RIGHT 2: MedCore Health AI Assistant (Replaced "M87 Cortex AI Assistant") */}
        <div className="dash-panel dash-ai-assistant-card">
          <div className="dash-ai-header">
            <div className="dash-ai-orb">
              <Bot size={20} />
            </div>
            <div>
              <div className="dash-ai-title">MedCore Health AI Assistant</div>
              <div className="dash-ai-sub">Executive Health Intelligence</div>
            </div>
          </div>

          {/* AI Greeting Bubble */}
          <div className="dash-ai-greeting-box">
            <p className="dash-ai-greeting-text">
              How can I help you today, Honourable Commissioner?
            </p>
          </div>

          {/* Quick Action Prompt Buttons (Matching dash.png) */}
          <div className="dash-ai-action-prompts">
            <button 
              type="button" 
              className="dash-ai-prompt-btn"
              onClick={() => handleAssistantPromptClick('Summarize statewide mortality trends and maternal health alerts')}
            >
              <Activity size={14} className="dash-prompt-icon blue" />
              <span>Summarize statewide mortality trends</span>
            </button>

            <button 
              type="button" 
              className="dash-ai-prompt-btn"
              onClick={() => handleAssistantPromptClick('Check facility licensing compliance and overdue inspection audits')}
            >
              <FileCheck2 size={14} className="dash-prompt-icon purple" />
              <span>Check facility compliance status</span>
            </button>

            <button 
              type="button" 
              className="dash-ai-prompt-btn"
              onClick={() => handleAssistantPromptClick('Draft a statutory emergency surge directive for Northern district hospitals')}
            >
              <Scale size={14} className="dash-prompt-icon gold" />
              <span>Draft a surge directive</span>
            </button>

            <button 
              type="button" 
              className="dash-ai-prompt-btn"
              onClick={() => handleAssistantPromptClick('Reallocate 6 standby ventilators from Eastern Coastal Hospital to St. Jude')}
            >
              <Zap size={14} className="dash-prompt-icon cyan" />
              <span>Reallocate ventilators</span>
            </button>

            <button 
              type="button" 
              className="dash-ai-prompt-btn"
              onClick={() => handleAssistantPromptClick('Run financial revenue reconciliation across Paystack, AkwaRemit and cash tills')}
            >
              <CreditCard size={14} className="dash-prompt-icon green" />
              <span>Run financial reconciliation</span>
            </button>
          </div>

          {/* Bottom Connectivity Note */}
          <div className="dash-ai-footer-note">
            <Sparkles size={13} className="dash-ai-sparkle" />
            <span>MedCore Assistant is connected to live facility data, banking ledgers, and surveillance systems.</span>
          </div>
        </div>
      </section>

      {/* ── BOTTOM ROW: FINANCIAL, FACILITY CAPACITY, COMPLIANCE & DIRECTIVES ── */}
      <section className="dash-bottom-grid-4">
        {/* Card 1: Financial & Revenue Surveillance */}
        <div className="dash-panel dash-finance-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title-wrap">
              <div className="dash-panel-icon-wrap emerald">
                <CreditCard size={16} />
              </div>
              <h3 className="dash-panel-title">Financial & Revenue Surveillance</h3>
            </div>
            <button 
              type="button" 
              className="dash-panel-action-btn"
              onClick={() => onNavigateToTab('financial')}
            >
              <span>Ledger</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Revenue Total */}
          <div className="dash-fin-total-block">
            <span className="dash-fin-label">Total Gross Revenue (Statewide)</span>
            <div className="dash-fin-sum-row">
              <span className="dash-fin-amount">&#8358; 12.4B</span>
              <span className="dash-fin-growth green">&uarr; 8.6% vs last month</span>
            </div>
          </div>

          {/* Payment Channels Breakdown + Donut Mini */}
          <div className="dash-fin-channels-row">
            <div className="dash-mini-donut-wrap">
              <svg viewBox="0 0 40 40" className="dash-mini-donut-svg">
                <circle cx="20" cy="20" r="14" fill="none" stroke="#1E293B" strokeWidth="6" />
                {/* Paystack: 42% (37) */}
                <circle cx="20" cy="20" r="14" fill="none" stroke="#3B82F6" strokeWidth="6" strokeDasharray="37 88" strokeDashoffset="0" />
                {/* AkwaRemit: 28% (25) */}
                <circle cx="20" cy="20" r="14" fill="none" stroke="#10B981" strokeWidth="6" strokeDasharray="25 88" strokeDashoffset="-37" />
                {/* Cash: 18% (16) */}
                <circle cx="20" cy="20" r="14" fill="none" stroke="#F59E0B" strokeWidth="6" strokeDasharray="16 88" strokeDashoffset="-62" />
                {/* HMO: 12% (10) */}
                <circle cx="20" cy="20" r="14" fill="none" stroke="#8B5CF6" strokeWidth="6" strokeDasharray="10 88" strokeDashoffset="-78" />
              </svg>
            </div>
            <div className="dash-fin-channels-legend">
              <div className="dash-fcl-item">
                <span className="dash-fcl-dot blue" />
                <span>Paystack Health Wallets: <strong>42%</strong></span>
              </div>
              <div className="dash-fcl-item">
                <span className="dash-fcl-dot green" />
                <span>AkwaRemit Gateway: <strong>28%</strong></span>
              </div>
              <div className="dash-fcl-item">
                <span className="dash-fcl-dot amber" />
                <span>Cash OTC: <strong>18%</strong></span>
              </div>
              <div className="dash-fcl-item">
                <span className="dash-fcl-dot purple" />
                <span>HMO / Insurance: <strong>12%</strong></span>
              </div>
            </div>
          </div>

          {/* Cashier Integrity Indicators */}
          <div className="dash-till-integrity-box">
            <div className="dash-till-integrity-title">Cashier Till Integrity</div>
            <div className="dash-till-metrics-row">
              <div className="dash-tm-item">
                <span className="dash-tm-dot blue" />
                <span>Open Shifts: <strong>3</strong></span>
              </div>
              <div className="dash-tm-item">
                <span className="dash-tm-dot green" />
                <span>Closed Shifts: <strong>45</strong></span>
              </div>
              <div className="dash-tm-item">
                <span className="dash-tm-dot amber" />
                <span>Variance Alerts: <strong>1</strong></span>
              </div>
            </div>
            <div className="dash-till-invariant">
              <CheckCircle2 size={12} className="dash-invariant-icon" />
              <span>Double-Entry Invariant: <strong>Verified Balanced (&Sigma;Debits = &Sigma;Credits)</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: Facility Surveillance & Capacity Telemetry */}
        <div className="dash-panel dash-facility-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title-wrap">
              <div className="dash-panel-icon-wrap cyan">
                <Building2 size={16} />
              </div>
              <h3 className="dash-panel-title">Facility Surveillance & Capacity Telemetry</h3>
            </div>
            <button 
              type="button" 
              className="dash-link-text"
              onClick={() => onNavigateToTab('facilities')}
            >
              Full List
            </button>
          </div>

          {/* Active Facility Card */}
          <div className="dash-active-fac-card">
            <div className="dash-afc-header">
              <div className="dash-afc-icon">
                <Building2 size={18} />
              </div>
              <div>
                <div className="dash-afc-name">Uyo General Hospital</div>
                <span className="dash-badge-tier">National Referral</span>
              </div>
            </div>

            <div className="dash-afc-specs-grid">
              <div className="dash-spec-col">
                <span className="dash-spec-label">Compliance Score:</span>
                <strong className="dash-spec-val green">92%</strong>
              </div>
              <div className="dash-spec-col">
                <span className="dash-spec-label">Accreditation:</span>
                <strong className="dash-spec-val green">Accredited</strong>
              </div>
              <div className="dash-spec-col">
                <span className="dash-spec-label">License No:</span>
                <span className="dash-spec-val">MOH/AKS/00123</span>
              </div>
              <div className="dash-spec-col">
                <span className="dash-spec-label">Expires:</span>
                <span className="dash-spec-val">2027-06-30</span>
              </div>
            </div>

            {/* Live Bed Census Mini */}
            <div className="dash-census-mini-box">
              <div className="dash-census-mini-title">Live Bed Census</div>
              <div className="dash-census-mini-grid">
                <div className="dash-cm-stat">
                  <span className="dash-cm-lbl">Ward Beds:</span>
                  <span className="dash-cm-val">248 / 320</span>
                </div>
                <div className="dash-cm-stat">
                  <span className="dash-cm-lbl">ICU Beds:</span>
                  <span className="dash-cm-val">18 / 40</span>
                </div>
                <div className="dash-cm-stat">
                  <span className="dash-cm-lbl">Ventilators:</span>
                  <span className="dash-cm-val">7 / 12</span>
                </div>
                <div className="dash-cm-stat">
                  <span className="dash-cm-lbl">Duty Staff:</span>
                  <span className="dash-cm-val">142 / 160</span>
                </div>
              </div>
            </div>

            <div className="dash-afc-footer-actions">
              <button 
                type="button" 
                className="dash-btn-outline-sm"
                onClick={() => onNavigateToTab('facilities')}
              >
                View Details
              </button>
              <button 
                type="button" 
                className="dash-btn-teal-sm"
                onClick={() => onNavigateToTab('licensing')}
              >
                Schedule Audit
              </button>
            </div>
          </div>

          {/* Regional Surge Status Indicators */}
          <div className="dash-regional-surge-mini">
            <div className="dash-rsm-item">
              <span className="dash-rsm-region">Uyo:</span>
              <span className="dash-badge-surge moderate">Moderate</span>
            </div>
            <div className="dash-rsm-item">
              <span className="dash-rsm-region">Eket:</span>
              <span className="dash-badge-surge high">High</span>
            </div>
            <div className="dash-rsm-item">
              <span className="dash-rsm-region">Ikot Ekpene:</span>
              <span className="dash-badge-surge moderate">Moderate</span>
            </div>
          </div>
        </div>

        {/* Card 3: Regulatory Compliance & Inspections */}
        <div className="dash-panel dash-compliance-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title-wrap">
              <div className="dash-panel-icon-wrap gold">
                <Scale size={16} />
              </div>
              <h3 className="dash-panel-title">Regulatory Compliance</h3>
            </div>
            <button 
              type="button" 
              className="dash-link-text"
              onClick={() => onNavigateToTab('licensing')}
            >
              View Details &gt;
            </button>
          </div>

          {/* Circular Progress Gauge */}
          <div className="dash-gauge-row">
            <div className="dash-gauge-svg-wrap">
              <svg viewBox="0 0 60 60" className="dash-gauge-svg">
                <circle cx="30" cy="30" r="24" fill="none" stroke="#1E293B" strokeWidth="6" />
                <circle 
                  cx="30" cy="30" r="24" fill="none" 
                  stroke="#10B981" strokeWidth="6" 
                  strokeDasharray="117.6 150.8" strokeDashoffset="0"
                />
              </svg>
              <div className="dash-gauge-center">
                <span className="dash-gauge-pct">78%</span>
                <span className="dash-gauge-sub">Overall</span>
              </div>
            </div>

            {/* Regional Breakdown Bars */}
            <div className="dash-regional-bars">
              <div className="dash-rb-item">
                <span className="dash-rb-label">Uyo</span>
                <div className="dash-rb-track">
                  <div className="dash-rb-fill green" style={{ width: '92%' }} />
                </div>
                <span className="dash-rb-val">92%</span>
              </div>
              <div className="dash-rb-item">
                <span className="dash-rb-label">Eket</span>
                <div className="dash-rb-track">
                  <div className="dash-rb-fill green" style={{ width: '86%' }} />
                </div>
                <span className="dash-rb-val">86%</span>
              </div>
              <div className="dash-rb-item">
                <span className="dash-rb-label">Ikot Ekpene</span>
                <div className="dash-rb-track">
                  <div className="dash-rb-fill amber" style={{ width: '74%' }} />
                </div>
                <span className="dash-rb-val">74%</span>
              </div>
              <div className="dash-rb-item">
                <span className="dash-rb-label">Oruk Anam</span>
                <div className="dash-rb-track">
                  <div className="dash-rb-fill red" style={{ width: '68%' }} />
                </div>
                <span className="dash-rb-val">68%</span>
              </div>
            </div>
          </div>

          {/* Audit Metrics Summary */}
          <div className="dash-audit-summary-row">
            <div className="dash-asr-stat">
              <span className="dash-asr-num">12</span>
              <span className="dash-asr-lbl">Active Audits</span>
            </div>
            <div className="dash-asr-stat">
              <span className="dash-asr-num red-num">3</span>
              <span className="dash-asr-lbl">Critical Citations</span>
            </div>
            <div className="dash-asr-stat">
              <span className="dash-asr-num amber-num">18</span>
              <span className="dash-asr-lbl">Remediation Due</span>
            </div>
          </div>

          <button 
            type="button" 
            className="dash-btn-schedule-wide"
            onClick={() => onNavigateToTab('licensing')}
          >
            <Calendar size={14} />
            <span>Schedule Facility Audit</span>
          </button>
        </div>

        {/* Card 4: Directives Enforcement */}
        <div className="dash-panel dash-directives-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title-wrap">
              <div className="dash-panel-icon-wrap blue">
                <Send size={16} />
              </div>
              <h3 className="dash-panel-title">Directives Enforcement</h3>
            </div>
            <button 
              type="button" 
              className="dash-link-text"
              onClick={() => onNavigateToTab('directives')}
            >
              Manage &gt;
            </button>
          </div>

          {/* Active Directives Numbers */}
          <div className="dash-directives-stat-row">
            <div className="dash-ds-box">
              <span className="dash-ds-lbl">Active Directives</span>
              <span className="dash-ds-val">4</span>
            </div>
            <div className="dash-ds-box">
              <span className="dash-ds-lbl">Compliance Rate</span>
              <span className="dash-ds-val green">87%</span>
            </div>
          </div>

          {/* Highlighted Recent Directive */}
          <div className="dash-recent-directive-card">
            <div className="dash-rd-top">
              <span className="dash-rd-badge amber">Statutory Order</span>
              <span className="dash-rd-code">MOH-DIR-2025-041</span>
            </div>
            <div className="dash-rd-title">Surge Standby Protocols</div>
            <div className="dash-rd-desc">
              Mandatory 15% bed reserve across all tertiary hospital pediatric wards during current RSV surge.
            </div>
            <div className="dash-rd-meta">
              <span>Target: All Tertiary Hospitals</span>
              <span>Due: 2025-09-20</span>
            </div>
            <div className="dash-rd-compliance-bar">
              <div className="dash-rd-cb-track">
                <div className="dash-rd-cb-fill green" style={{ width: '87%' }} />
              </div>
              <span className="dash-rd-cb-pct">87% confirmed</span>
            </div>
          </div>

          <button 
            type="button" 
            className="dash-btn-broadcast-wide"
            onClick={() => onNavigateToTab('directives')}
          >
            <Send size={14} />
            <span>Broadcast New Directive</span>
          </button>
        </div>
      </section>

      {/* ── FOOTER SECURITY STRIP (LESS PROMINENT, SLEEK COMPLIANCE BADGES) ── */}
      <footer className="dash-security-footer">
        <div className="dash-sec-badges-group">
          <div className="dash-sec-item">
            <ShieldCheck size={14} className="dash-sec-icon" />
            <span>AES-256-GCM Encryption</span>
          </div>
          <div className="dash-sec-divider">&bull;</div>
          <div className="dash-sec-item">
            <Lock size={14} className="dash-sec-icon" />
            <span>SHA-256 Immutable Ledger</span>
          </div>
          <div className="dash-sec-divider">&bull;</div>
          <div className="dash-sec-item">
            <CheckCircle2 size={14} className="dash-sec-icon" />
            <span>HIPAA Safe Harbor (De-identified)</span>
          </div>
          <div className="dash-sec-divider">&bull;</div>
          <div className="dash-sec-item">
            <Shield size={14} className="dash-sec-icon" />
            <span>Zero-Trust Level 4 Security</span>
          </div>
        </div>

        <div className="dash-sec-tagline">
          Secure Data &rarr; Better Decisions &rarr; Healthier Communities
        </div>
      </footer>
    </div>
  );
};
