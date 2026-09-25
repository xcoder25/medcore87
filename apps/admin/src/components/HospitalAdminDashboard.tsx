'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  User,
  Briefcase, 
  ArrowRightLeft, 
  UserCheck, 
  UserMinus, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  BarChart3, 
  Clock, 
  Lock, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  RotateCw, 
  ArrowRight, 
  SlidersHorizontal,
  Building2,
  FileCheck2,
  CalendarDays,
  Bed
} from 'lucide-react';

interface HospitalAdminDashboardProps {
  onNavigateToTab: (tab: any) => void;
  onOpenTransferReview: (transferId?: string) => void;
  onOpenAccessReview: () => void;
  onOpenComplianceDrawer: () => void;
  onOpenStaffDrawer: () => void;
  onOpenNewTransferModal: () => void;
  onOpenAddStaffModal: () => void;
  onOpenCreateRosterModal: () => void;
  onOpenReportIncidentModal: () => void;
  onOpenAssignBedModal: () => void;
  showToast: (msg: string, type?: 'success' | 'alert') => void;
  facilityName?: string;
}

export const HospitalAdminDashboard: React.FC<HospitalAdminDashboardProps> = ({
  onNavigateToTab,
  onOpenTransferReview,
  onOpenAccessReview,
  onOpenComplianceDrawer,
  onOpenStaffDrawer,
  onOpenNewTransferModal,
  onOpenAddStaffModal,
  onOpenCreateRosterModal,
  onOpenReportIncidentModal,
  onOpenAssignBedModal,
  showToast,
  facilityName = 'Immanuel General Hospital, Eket',
}) => {
  const [secondsAgo, setSecondsAgo] = useState(12);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setSecondsAgo(0);
      showToast('Dashboard metrics refreshed from Hospital Gateway', 'success');
    }, 450);
  };

  // Staff by department data
  const deptData = [
    { name: 'Nursing', count: 34, pct: 92, barClass: 'ha-bar-blue' },
    { name: 'Internal Medicine', count: 14, pct: 78, barClass: 'ha-bar-cyan' },
    { name: 'Radiology', count: 11, pct: 76, barClass: 'ha-bar-teal' },
    { name: 'Surgery', count: 9, pct: 71, barClass: 'ha-bar-purple' },
    { name: 'Pharmacy', count: 6, pct: 68, barClass: 'ha-bar-cyan' },
  ];

  // Bar chart stats
  const chartBars = [
    { label: 'Nursing', value: 34, max: 40 },
    { label: 'Internal Med.', value: 14, max: 40 },
    { label: 'Radiology', value: 11, max: 40 },
    { label: 'Surgery', value: 9, max: 40 },
    { label: 'Pharmacy', value: 6, max: 40 },
    { label: 'Others', value: 13, max: 40 },
  ];

  return (
    <div className="ha-content-canvas">
      {/* 1. HERO SECTION */}
      <div className="ha-hero-card">
        <div className="ha-hero-top">
          <div>
            <h1 className="ha-hero-greeting">
              Good afternoon, Administrator 👋
            </h1>
            <p className="ha-hero-subtitle">
              Here&apos;s what&apos;s happening at {facilityName} today.
            </p>
          </div>

          <div className="ha-system-status-pill">
            <div className="ha-status-dot-pulse" />
            <div>
              <div className="ha-system-status-title">System Healthy</div>
              <div className="ha-system-status-sub">All systems operational</div>
            </div>
          </div>
        </div>

        {/* Data Freshness Indicator per UX Rule 21 */}
        <div className="ha-freshness-bar">
          <span>
            Telemetry synchronized · Updated {secondsAgo === 0 ? 'just now' : `${secondsAgo} seconds ago`}
          </span>
          <button
            type="button"
            className="ha-refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RotateCw size={12} className={isRefreshing ? 'ha-shimmer' : ''} style={{ animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* 2. KPI ROW (Rule 3) */}
        <div className="ha-kpi-grid">
          {/* Active Staff */}
          <div className="ha-kpi-card" onClick={onOpenStaffDrawer}>
            <div className="ha-kpi-top">
              <span className="ha-kpi-label">Active Staff</span>
              <div className="ha-kpi-icon-wrap ha-kpi-icon-green">
                <Users size={18} />
              </div>
            </div>
            <div className="ha-kpi-value">87</div>
            <div className="ha-kpi-subtext green">
              <span>↑ +6% this month</span>
            </div>
          </div>

          {/* Open Positions */}
          <div className="ha-kpi-card" onClick={() => onNavigateToTab('staffing')}>
            <div className="ha-kpi-top">
              <span className="ha-kpi-label">Open Positions</span>
              <div className="ha-kpi-icon-wrap ha-kpi-icon-blue">
                <Briefcase size={18} />
              </div>
            </div>
            <div className="ha-kpi-value">12</div>
            <div className="ha-kpi-subtext blue">
              <span>↑ +2% this month</span>
            </div>
          </div>

          {/* Pending Transfers */}
          <div className="ha-kpi-card" onClick={() => onOpenTransferReview('TRF-1024')}>
            <div className="ha-kpi-top">
              <span className="ha-kpi-label">Pending Transfers</span>
              <div className="ha-kpi-icon-wrap ha-kpi-icon-amber">
                <ArrowRightLeft size={18} />
              </div>
            </div>
            <div className="ha-kpi-value">1</div>
            <div className="ha-kpi-subtext amber">
              <span>1 Pending Transfer · View details →</span>
            </div>
          </div>

          {/* Staff Logged In */}
          <div className="ha-kpi-card" onClick={onOpenStaffDrawer}>
            <div className="ha-kpi-top">
              <span className="ha-kpi-label">Staff Logged In</span>
              <div className="ha-kpi-icon-wrap ha-kpi-icon-green">
                <UserCheck size={18} />
              </div>
            </div>
            <div className="ha-kpi-value">64</div>
            <div className="ha-kpi-subtext green">
              <span className="ha-status-dot-pulse" style={{ width: 6, height: 6, display: 'inline-block' }} />
              <span>Live on duty</span>
            </div>
          </div>

          {/* On Leave */}
          <div className="ha-kpi-card" onClick={() => onNavigateToTab('staffing')}>
            <div className="ha-kpi-top">
              <span className="ha-kpi-label">On Leave</span>
              <div className="ha-kpi-icon-wrap ha-kpi-icon-purple">
                <UserMinus size={18} />
              </div>
            </div>
            <div className="ha-kpi-value">8</div>
            <div className="ha-kpi-subtext purple">
              <span>↑ +1% this week</span>
            </div>
          </div>

          {/* Access Issues */}
          <div className="ha-kpi-card" onClick={onOpenAccessReview}>
            <div className="ha-kpi-top">
              <span className="ha-kpi-label">Access Issues</span>
              <div className="ha-kpi-icon-wrap ha-kpi-icon-red">
                <ShieldAlert size={18} />
              </div>
            </div>
            <div className="ha-kpi-value">3</div>
            <div className="ha-kpi-subtext red">
              <span>Requires attention</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUICK ACTIONS ROW (Rule 8) */}
      <div className="ha-quick-actions-bar">
        <div className="ha-quick-actions-left">
          <button
            type="button"
            className="ha-action-pill-btn"
            onClick={onOpenNewTransferModal}
          >
            <ArrowRightLeft size={15} color="#38BDF8" />
            <span>New Staff Transfer</span>
          </button>

          <button
            type="button"
            className="ha-action-pill-btn"
            onClick={onOpenAddStaffModal}
          >
            <Plus size={15} color="#00D4A8" />
            <span>Add Staff</span>
          </button>

          <button
            type="button"
            className="ha-action-pill-btn"
            onClick={onOpenCreateRosterModal}
          >
            <CalendarDays size={15} color="#F59E0B" />
            <span>Create Roster</span>
          </button>

          <button
            type="button"
            className="ha-action-pill-btn"
            onClick={onOpenReportIncidentModal}
          >
            <AlertTriangle size={15} color="#EF4444" />
            <span>Report Incident</span>
          </button>

          <button
            type="button"
            className="ha-action-pill-btn"
            onClick={onOpenAssignBedModal}
          >
            <Bed size={15} color="#C084FC" />
            <span>Assign Bed</span>
          </button>
        </div>

        <button
          type="button"
          className="ha-action-ghost-btn"
          onClick={() => showToast('Dashboard layout customized and saved', 'success')}
        >
          <SlidersHorizontal size={14} />
          <span>Customize</span>
        </button>
      </div>

      {/* 4. MAIN 3-COLUMN WORKSPACE GRID (Rule 3) */}
      <div className="ha-workspace-grid">
        {/* ROW 1: CARD 1 — Needs Your Attention */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <div className="ha-attention-badge">
                <AlertTriangle size={16} />
              </div>
              <h3 className="ha-card-title">Needs Your Attention</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={() => onNavigateToTab('transfers')}
            >
              View all →
            </button>
          </div>

          <div className="ha-attention-list">
            {/* Item 1 */}
            <div className="ha-attention-item">
              <div className="ha-attention-meta">
                <span className="ha-attention-text">1 staff transfer awaiting approval</span>
                <div className="ha-attention-sub">
                  <span className="ha-priority-pill high">● High</span>
                  <span>8 min ago</span>
                </div>
              </div>
              <button
                type="button"
                className="ha-attention-action-btn"
                onClick={() => onOpenTransferReview('TRF-1024')}
              >
                Review →
              </button>
            </div>

            {/* Item 2 */}
            <div className="ha-attention-item">
              <div className="ha-attention-meta">
                <span className="ha-attention-text">3 access requests pending</span>
                <div className="ha-attention-sub">
                  <span className="ha-priority-pill medium">● Medium</span>
                  <span>14 min ago</span>
                </div>
              </div>
              <button
                type="button"
                className="ha-attention-action-btn"
                onClick={onOpenAccessReview}
              >
                Review →
              </button>
            </div>

            {/* Item 3 */}
            <div className="ha-attention-item">
              <div className="ha-attention-meta">
                <span className="ha-attention-text">2 compliance documents expiring</span>
                <div className="ha-attention-sub">
                  <span className="ha-priority-pill medium">● Medium</span>
                  <span>21 min ago</span>
                </div>
              </div>
              <button
                type="button"
                className="ha-attention-action-btn"
                onClick={onOpenComplianceDrawer}
              >
                Review →
              </button>
            </div>

            {/* Item 4 */}
            <div className="ha-attention-item">
              <div className="ha-attention-meta">
                <span className="ha-attention-text">4 open positions need assignment</span>
                <div className="ha-attention-sub">
                  <span className="ha-priority-pill low">● Low</span>
                  <span>Today</span>
                </div>
              </div>
              <button
                type="button"
                className="ha-attention-action-btn"
                onClick={() => onNavigateToTab('staffing')}
              >
                View →
              </button>
            </div>
          </div>
        </div>

        {/* ROW 1: CARD 2 — Staff Overview */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <Users size={18} color="#00D4A8" />
              <h3 className="ha-card-title">Staff Overview</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={onOpenStaffDrawer}
            >
              View staff →
            </button>
          </div>

          <div className="ha-staff-total-count">
            87 <span>Total Staff</span>
          </div>

          <div className="ha-dept-progress-list">
            {deptData.map((dept) => (
              <div key={dept.name} className="ha-dept-row">
                <div className="ha-dept-info">
                  <span className="ha-dept-name">{dept.name}</span>
                  <div className="ha-dept-numbers">
                    <span className="ha-dept-count">{dept.count}</span>
                    <span className="ha-dept-pct">{dept.pct}%</span>
                  </div>
                </div>
                <div className="ha-progress-track">
                  <div
                    className={`ha-progress-bar ${dept.barClass}`}
                    style={{ width: `${dept.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenStaffDrawer}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38BDF8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              padding: '4px 0 0'
            }}
          >
            + 13 other departments
          </button>
        </div>

        {/* ROW 1: CARD 3 — Access & Security */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <ShieldCheck size={18} color="#38BDF8" />
              <h3 className="ha-card-title">Access & Security</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={() => onNavigateToTab('access-control')}
            >
              Manage access →
            </button>
          </div>

          <div className="ha-access-metrics-grid">
            <div className="ha-access-metric-row" onClick={() => onNavigateToTab('access-control')} style={{ cursor: 'pointer' }}>
              <div className="ha-dot-indicator green" />
              <div className="ha-access-metric-value">142</div>
              <div className="ha-access-metric-label">Active accounts</div>
            </div>

            <div className="ha-access-metric-row" onClick={onOpenAccessReview} style={{ cursor: 'pointer' }}>
              <div className="ha-dot-indicator amber" />
              <div className="ha-access-metric-value">3</div>
              <div className="ha-access-metric-label">Pending requests</div>
            </div>

            <div className="ha-access-metric-row" onClick={() => onNavigateToTab('access-control')} style={{ cursor: 'pointer' }}>
              <div className="ha-dot-indicator red" />
              <div className="ha-access-metric-value">2</div>
              <div className="ha-access-metric-label">Suspended accounts</div>
            </div>

            <div className="ha-access-metric-row" onClick={() => onNavigateToTab('access-control')} style={{ cursor: 'pointer' }}>
              <div className="ha-dot-indicator blue" />
              <div className="ha-access-metric-value">1</div>
              <div className="ha-access-metric-label">Permission change today</div>
            </div>
          </div>
        </div>

        {/* ROW 2: CARD 4 — Staff by Department */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <BarChart3 size={18} color="#38BDF8" />
              <h3 className="ha-card-title">Staff by Department</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={onOpenStaffDrawer}
            >
              View details →
            </button>
          </div>

          <div className="ha-chart-container">
            {chartBars.map((bar) => {
              const heightPct = Math.round((bar.value / bar.max) * 100);
              return (
                <div key={bar.label} className="ha-chart-col">
                  <span className="ha-chart-val">{bar.value}</span>
                  <div className="ha-chart-bar-wrap">
                    <div
                      className="ha-chart-bar"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="ha-chart-label" title={bar.label}>
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 2: CARD 5 — Compliance Health */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <ShieldCheck size={18} color="#10B981" />
              <h3 className="ha-card-title">Compliance Health</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={onOpenComplianceDrawer}
            >
              View compliance →
            </button>
          </div>

          <div className="ha-compliance-wrapper">
            {/* SVG Donut Ring Gauge */}
            <div className="ha-gauge-circle">
              <svg className="ha-gauge-svg" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="3.2"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#00D4A8"
                  strokeWidth="3.2"
                  strokeDasharray="92, 100"
                  strokeLinecap="round"
                />
              </svg>
              <div className="ha-gauge-center-text">
                <span className="ha-gauge-num">92%</span>
                <span className="ha-gauge-label">Compliance Health</span>
              </div>
            </div>

            <div className="ha-compliance-legend">
              <div className="ha-legend-item">
                <span className="ha-legend-label">
                  <span className="ha-dot-indicator amber" style={{ width: 8, height: 8 }} />
                  Documents expiring
                </span>
                <span className="ha-legend-count">4</span>
              </div>

              <div className="ha-legend-item">
                <span className="ha-legend-label">
                  <span className="ha-dot-indicator red" style={{ width: 8, height: 8 }} />
                  Overdue reviews
                </span>
                <span className="ha-legend-count">2</span>
              </div>

              <div className="ha-legend-item">
                <span className="ha-legend-label">
                  <span className="ha-dot-indicator blue" style={{ width: 8, height: 8 }} />
                  Pending audits
                </span>
                <span className="ha-legend-count">1</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: CARD 6 — Recent Admin Activity */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <Clock size={18} color="#C084FC" />
              <h3 className="ha-card-title">Recent Admin Activity</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={() => onNavigateToTab('compliance')}
            >
              View all →
            </button>
          </div>

          <div className="ha-activity-list">
            <div className="ha-activity-item">
              <span className="ha-activity-time">14:26</span>
              <div className="ha-activity-dot" />
              <span className="ha-activity-desc">Sarah approved a staff transfer</span>
            </div>

            <div className="ha-activity-item">
              <span className="ha-activity-time">14:18</span>
              <div className="ha-activity-dot" />
              <span className="ha-activity-desc">New account created for Pharmacy</span>
            </div>

            <div className="ha-activity-item">
              <span className="ha-activity-time">14:03</span>
              <div className="ha-activity-dot" />
              <span className="ha-activity-desc">James updated Ward B roster</span>
            </div>

            <div className="ha-activity-item">
              <span className="ha-activity-time">13:52</span>
              <div className="ha-activity-dot" />
              <span className="ha-activity-desc">Access permission changed</span>
            </div>

            <div className="ha-activity-item">
              <span className="ha-activity-time">13:41</span>
              <div className="ha-activity-dot" />
              <span className="ha-activity-desc">Compliance document uploaded</span>
            </div>
          </div>
        </div>

        {/* ROW 3: CARD 7 — Recent Transfers (Enterprise Table, Span across 1.5 columns or 1.5 grid) */}
        <div className="ha-card" style={{ gridColumn: 'span 2' }}>
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <ArrowRightLeft size={18} color="#F59E0B" />
              <h3 className="ha-card-title">Recent Transfers</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={() => onNavigateToTab('transfers')}
            >
              View all →
            </button>
          </div>

          <div className="ha-table-container">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>From → To</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <User size={15} color="#38BDF8" />
                      <span>Dr. Fatima Al-Hassan</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: '#E2E8F0' }}>LUTH → UCH</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>2026-10-01</span>
                  </td>
                  <td>
                    <span className="ha-status-badge pending">Pending</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ha-attention-action-btn"
                      onClick={() => onOpenTransferReview('TRF-1024')}
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                    >
                      Review →
                    </button>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <User size={15} color="#38BDF8" />
                      <span>Dr. Amara Okafor</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: '#E2E8F0' }}>AKTH → Ligh</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>2026-09-01</span>
                  </td>
                  <td>
                    <span className="ha-status-badge completed">Completed</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>Archived</span>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <User size={15} color="#38BDF8" />
                      <span>Dr. Ibrahim Musa</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: '#E2E8F0' }}>UCH → FCTH</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>2026-08-15</span>
                  </td>
                  <td>
                    <span className="ha-status-badge completed">Completed</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>Archived</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ROW 3: CARD 8 — Access & Permissions */}
        <div className="ha-card">
          <div className="ha-card-header">
            <div className="ha-card-title-group">
              <Lock size={18} color="#C084FC" />
              <h3 className="ha-card-title">Access & Permissions</h3>
            </div>
            <button
              type="button"
              className="ha-card-link-action"
              onClick={() => onNavigateToTab('access-control')}
            >
              View all →
            </button>
          </div>

          <div className="ha-table-container">
            <table className="ha-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span style={{ fontWeight: 600 }}>Admin User</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>Administrator</span>
                  </td>
                  <td>
                    <span className="ha-status-badge active">● Active</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748B', fontSize: '0.72rem' }}>2 mins ago</span>
                  </td>
                </tr>

                <tr>
                  <td>
                    <span style={{ fontWeight: 600 }}>Sarah Johnson</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>HR Manager</span>
                  </td>
                  <td>
                    <span className="ha-status-badge active">● Active</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748B', fontSize: '0.72rem' }}>12 mins ago</span>
                  </td>
                </tr>

                <tr>
                  <td>
                    <span style={{ fontWeight: 600 }}>Michael Okafor</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>IT Support</span>
                  </td>
                  <td>
                    <span className="ha-status-badge active">● Active</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748B', fontSize: '0.72rem' }}>1 hour ago</span>
                  </td>
                </tr>

                <tr>
                  <td>
                    <span style={{ fontWeight: 600 }}>Amina Bello</span>
                  </td>
                  <td>
                    <span style={{ color: '#94A3B8' }}>Finance Officer</span>
                  </td>
                  <td>
                    <span className="ha-status-badge active">● Active</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748B', fontSize: '0.72rem' }}>3 hours ago</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
