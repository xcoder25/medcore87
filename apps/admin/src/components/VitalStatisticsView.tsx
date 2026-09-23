'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  Heart,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  Download,
  Users,
  Baby,
  Skull,
  BarChart3,
  Filter,
} from 'lucide-react';

/* ── Mock executive data ── */
const MORTALITY_KPIS = {
  totalMonitored: 48294,
  currentlyAdmitted: 1537,
  dischargedAlive: 46024,
  totalDeceased: 733,
  mortalityRate: 1.52,
  maternalDeaths: 2,
  neonatalDeaths: 3,
  under5Deaths: 41,
};

const CAUSE_BREAKDOWN = [
  { cause: 'Cardiovascular Disease (I21)', count: 214, pct: 29.2, trend: 'up' as const },
  { cause: 'Sepsis & Systemic Infection (A41)', count: 158, pct: 21.6, trend: 'stable' as const },
  { cause: 'Acute RSV Bronchiolitis (J21.0)', count: 84, pct: 11.5, trend: 'up' as const },
  { cause: 'Trauma & Injury (S00–T98)', count: 67, pct: 9.1, trend: 'down' as const },
  { cause: 'Malignant Neoplasms (C00–C97)', count: 52, pct: 7.1, trend: 'stable' as const },
  { cause: 'Other / Unspecified', count: 158, pct: 21.5, trend: 'stable' as const },
];

const REGIONAL_MORTALITY = [
  { region: 'Capital Central', deaths: 312, rate: 1.21, maternal: 0, neonatal: 1, status: 'normal' },
  { region: 'Northern District', deaths: 198, rate: 1.68, maternal: 1, neonatal: 1, status: 'elevated' },
  { region: 'Eastern District', deaths: 147, rate: 1.55, maternal: 0, neonatal: 1, status: 'normal' },
  { region: 'Western Province', deaths: 76, rate: 2.14, maternal: 1, neonatal: 0, status: 'critical' },
];

const RECENT_ALERTS = [
  { id: 'MAT-001', type: 'Maternal Death', facility: 'Apex Teaching Hospital', date: '2026-09-12', status: 'Under Investigation' },
  { id: 'MAT-002', type: 'Maternal Death', facility: 'Western Valley Community', date: '2026-09-08', status: 'Under Investigation' },
  { id: 'NEO-014', type: 'Neonatal Death', facility: 'Eastern Coastal Children’s', date: '2026-09-10', status: 'Peer Review' },
  { id: 'NEO-015', type: 'Neonatal Death', facility: 'National Referral & Trauma', date: '2026-09-05', status: 'Closed' },
  { id: 'NEO-016', type: 'Neonatal Death', facility: 'St. Jude Metropolitan', date: '2026-09-03', status: 'Closed' },
];

export const VitalStatisticsView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  const filteredAlerts = useMemo(() => {
    return RECENT_ALERTS.filter((a) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.id.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          a.facility.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search]);

  return (
    <div className="exec-view anim-fade-up">
      {/* Header */}
      <div className="exec-view-header">
        <div className="exec-view-title-block">
          <div className="exec-view-icon-wrap exec-icon-vital">
            <Activity size={22} />
          </div>
          <div>
            <h1 className="exec-view-title">Vital Statistics & Mortality</h1>
            <p className="exec-view-subtitle">Statewide census, cause-of-death intelligence & statutory alerts</p>
          </div>
        </div>
        <button type="button" className="exec-export-btn">
          <Download size={15} />
          Export Brief
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="exec-kpi-ribbon">
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Patients Monitored</div>
          <div className="exec-kpi-value">{MORTALITY_KPIS.totalMonitored.toLocaleString()}</div>
          <div className="exec-kpi-sub">Statewide cumulative</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Currently Admitted</div>
          <div className="exec-kpi-value">{MORTALITY_KPIS.currentlyAdmitted.toLocaleString()}</div>
          <div className="exec-kpi-sub">Alive in wards / ICUs</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Overall Mortality</div>
          <div className="exec-kpi-value">{MORTALITY_KPIS.mortalityRate}%</div>
          <div className="exec-kpi-sub">{MORTALITY_KPIS.totalDeceased.toLocaleString()} deceased</div>
        </div>
        <div className="exec-kpi-card exec-kpi-alert">
          <div className="exec-kpi-label">Maternal Deaths</div>
          <div className="exec-kpi-value">{MORTALITY_KPIS.maternalDeaths}</div>
          <div className="exec-kpi-sub">Under statutory review</div>
        </div>
        <div className="exec-kpi-card exec-kpi-alert">
          <div className="exec-kpi-label">Neonatal Deaths</div>
          <div className="exec-kpi-value">{MORTALITY_KPIS.neonatalDeaths}</div>
          <div className="exec-kpi-sub">Under formal review</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Under-5 Deaths</div>
          <div className="exec-kpi-value">{MORTALITY_KPIS.under5Deaths}</div>
          <div className="exec-kpi-sub">YTD cumulative</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="exec-two-col">
        {/* Cause of death */}
        <div className="exec-panel">
          <div className="exec-panel-header">
            <BarChart3 size={16} />
            <h2>Leading Causes of Death (ICD-10)</h2>
          </div>
          <div className="exec-cause-list">
            {CAUSE_BREAKDOWN.map((c) => (
              <div key={c.cause} className="exec-cause-row">
                <div className="exec-cause-meta">
                  <span className="exec-cause-name">{c.cause}</span>
                  <span className="exec-cause-count">{c.count} deaths · {c.pct}%</span>
                </div>
                <div className="exec-cause-bar-track">
                  <div className="exec-cause-bar-fill" style={{ width: `${c.pct}%` }} />
                </div>
                <span className={`exec-trend exec-trend--${c.trend}`}>
                  {c.trend === 'up' && <TrendingUp size={12} />}
                  {c.trend === 'down' && <TrendingDown size={12} />}
                  {c.trend === 'stable' && '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Regional rates */}
        <div className="exec-panel">
          <div className="exec-panel-header">
            <Users size={16} />
            <h2>Regional Mortality Rates</h2>
          </div>
          <div className="table-responsive">
            <table className="moh-data-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Deaths</th>
                  <th>Rate %</th>
                  <th>Maternal</th>
                  <th>Neonatal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {REGIONAL_MORTALITY.map((r) => (
                  <tr key={r.region}>
                    <td><strong>{r.region}</strong></td>
                    <td>{r.deaths}</td>
                    <td>{r.rate.toFixed(2)}%</td>
                    <td>{r.maternal}</td>
                    <td>{r.neonatal}</td>
                    <td>
                      <span className={`exec-status-pill exec-status--${r.status}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Statutory alerts table */}
      <div className="exec-panel" style={{ marginTop: 18 }}>
        <div className="exec-panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            <h2>Statutory Death Alerts & Reviews</h2>
          </div>
          <div className="exec-search-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search alerts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="exec-search-input"
            />
          </div>
        </div>
        <div className="table-responsive">
          <table className="moh-data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Type</th>
                <th>Facility</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((a) => (
                <tr key={a.id} className="clickable-row">
                  <td><code className="license-code">{a.id}</code></td>
                  <td>
                    <span className="exec-alert-type">
                      {a.type.includes('Maternal') ? <Heart size={12} /> : <Baby size={12} />}
                      {a.type}
                    </span>
                  </td>
                  <td>{a.facility}</td>
                  <td>{a.date}</td>
                  <td>
                    <span className={`exec-status-pill ${a.status.includes('Investigation') || a.status.includes('Review') ? 'exec-status--elevated' : 'exec-status--normal'}`}>
                      {a.status}
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
