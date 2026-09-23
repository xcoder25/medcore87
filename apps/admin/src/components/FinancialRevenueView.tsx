'use client';

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Download,
  Search,
  TrendingUp,
  Wallet,
  Banknote,
  Building2,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowUpRight,
} from 'lucide-react';

const REVENUE_KPIS = {
  grossYTD: 2847392400,
  paystack: 1204800000,
  akwaRemit: 984200000,
  cashTills: 428992400,
  hmo: 229400000,
  outstanding: 48204000,
  openTills: 7,
  closedTills: 19,
  discrepancies: 0,
};

const FACILITY_REVENUE = [
  { name: 'National Referral Hospital & Trauma Centre', region: 'Capital Central', paystack: 412000000, akwa: 298000000, cash: 142000000, total: 852000000, variance: 0 },
  { name: 'St. Jude Metropolitan General', region: 'Northern District', paystack: 286000000, akwa: 221000000, cash: 98000000, total: 605000000, variance: 0 },
  { name: 'Eastern Coastal Children’s & Maternal', region: 'Eastern District', paystack: 198000000, akwa: 164000000, cash: 72000000, total: 434000000, variance: 0 },
  { name: 'Western Valley Community Hospital', region: 'Western Province', paystack: 98000000, akwa: 86000000, cash: 51000000, total: 235000000, variance: 0 },
  { name: 'Other Facilities (8)', region: 'Multiple', paystack: 210800000, akwa: 215200000, cash: 65992400, total: 491992400, variance: 0 },
];

const TILL_STATUS = [
  { id: 'TILL-NRH-03', facility: 'National Referral', officer: 'A. Okon', opened: '07:12', status: 'open', balance: 1842000 },
  { id: 'TILL-SJM-01', facility: 'St. Jude Metropolitan', officer: 'E. Etim', opened: '07:45', status: 'open', balance: 920500 },
  { id: 'TILL-ECC-02', facility: 'Eastern Coastal', officer: 'M. Udoh', opened: '08:01', status: 'open', balance: 612300 },
  { id: 'TILL-WVC-01', facility: 'Western Valley', officer: 'J. Akpan', opened: '07:30', status: 'open', balance: 445800 },
  { id: 'TILL-NRH-01', facility: 'National Referral', officer: 'C. Bassey', opened: '06:55', status: 'reconciled', balance: 0 },
  { id: 'TILL-SJM-02', facility: 'St. Jude Metropolitan', officer: 'F. Inyang', opened: '06:40', status: 'reconciled', balance: 0 },
];

function formatNaira(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

export const FinancialRevenueView: React.FC = () => {
  const [search, setSearch] = useState('');

  const filteredFacilities = useMemo(() => {
    if (!search.trim()) return FACILITY_REVENUE;
    const q = search.toLowerCase();
    return FACILITY_REVENUE.filter(
      (f) => f.name.toLowerCase().includes(q) || f.region.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="exec-view anim-fade-up">
      {/* Header */}
      <div className="exec-view-header">
        <div className="exec-view-title-block">
          <div className="exec-view-icon-wrap exec-icon-finance">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="exec-view-title">Financial & Revenue</h1>
            <p className="exec-view-subtitle">Statewide collections, channel mix & till integrity oversight</p>
          </div>
        </div>
        <button type="button" className="exec-export-btn">
          <Download size={15} />
          Export Ledger
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="exec-kpi-ribbon">
        <div className="exec-kpi-card exec-kpi-hero">
          <div className="exec-kpi-label">Gross Revenue YTD</div>
          <div className="exec-kpi-value">{formatNaira(REVENUE_KPIS.grossYTD)}</div>
          <div className="exec-kpi-sub">Across 12 facilities</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Paystack</div>
          <div className="exec-kpi-value">{formatNaira(REVENUE_KPIS.paystack)}</div>
          <div className="exec-kpi-sub">Health wallets & NUBAN</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">AkwaRemit</div>
          <div className="exec-kpi-value">{formatNaira(REVENUE_KPIS.akwaRemit)}</div>
          <div className="exec-kpi-sub">Card & bank transfer</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Cash Tills</div>
          <div className="exec-kpi-value">{formatNaira(REVENUE_KPIS.cashTills)}</div>
          <div className="exec-kpi-sub">OTC physical currency</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">HMO / Insurer</div>
          <div className="exec-kpi-value">{formatNaira(REVENUE_KPIS.hmo)}</div>
          <div className="exec-kpi-sub">80% auto-adjudicated</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Outstanding</div>
          <div className="exec-kpi-value">{formatNaira(REVENUE_KPIS.outstanding)}</div>
          <div className="exec-kpi-sub">Co-pay / indigent waiver</div>
        </div>
      </div>

      {/* Channel mix + Till integrity */}
      <div className="exec-two-col">
        <div className="exec-panel">
          <div className="exec-panel-header">
            <Wallet size={16} />
            <h2>Payment Channel Mix</h2>
          </div>
          <div className="exec-channel-bars">
            {[
              { label: 'Paystack', value: REVENUE_KPIS.paystack, color: '#059669' },
              { label: 'AkwaRemit', value: REVENUE_KPIS.akwaRemit, color: '#0EA5E9' },
              { label: 'Cash Tills', value: REVENUE_KPIS.cashTills, color: '#F59E0B' },
              { label: 'HMO / Insurer', value: REVENUE_KPIS.hmo, color: '#7C3AED' },
            ].map((ch) => {
              const pct = (ch.value / REVENUE_KPIS.grossYTD) * 100;
              return (
                <div key={ch.label} className="exec-channel-row">
                  <div className="exec-channel-meta">
                    <span className="exec-channel-dot" style={{ background: ch.color }} />
                    <span className="exec-channel-label">{ch.label}</span>
                    <span className="exec-channel-val">{formatNaira(ch.value)} · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="exec-cause-bar-track">
                    <div className="exec-cause-bar-fill" style={{ width: `${pct}%`, background: ch.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="exec-panel">
          <div className="exec-panel-header">
            <Banknote size={16} />
            <h2>Till Integrity</h2>
          </div>
          <div className="exec-till-stats">
            <div className="exec-till-stat">
              <span className="exec-till-num">{REVENUE_KPIS.openTills}</span>
              <span className="exec-till-lbl">Open Tills</span>
            </div>
            <div className="exec-till-stat">
              <span className="exec-till-num">{REVENUE_KPIS.closedTills}</span>
              <span className="exec-till-lbl">Reconciled</span>
            </div>
            <div className="exec-till-stat exec-till-clean">
              <span className="exec-till-num">{REVENUE_KPIS.discrepancies}</span>
              <span className="exec-till-lbl">Discrepancies</span>
            </div>
          </div>
          <div className="exec-integrity-badge">
            <CheckCircle2 size={16} />
            Double-entry invariant holds · ΣDebits = ΣCredits
          </div>
          <div className="table-responsive" style={{ marginTop: 14 }}>
            <table className="moh-data-table">
              <thead>
                <tr>
                  <th>Till</th>
                  <th>Facility</th>
                  <th>Officer</th>
                  <th>Status</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {TILL_STATUS.map((t) => (
                  <tr key={t.id}>
                    <td><code className="license-code">{t.id}</code></td>
                    <td>{t.facility}</td>
                    <td>{t.officer}</td>
                    <td>
                      <span className={`exec-status-pill ${t.status === 'open' ? 'exec-status--elevated' : 'exec-status--normal'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.balance > 0 ? formatNaira(t.balance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Facility revenue ranking */}
      <div className="exec-panel" style={{ marginTop: 18 }}>
        <div className="exec-panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} />
            <h2>Facility Revenue Ranking</h2>
          </div>
          <div className="exec-search-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search facilities…"
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
                <th>Facility</th>
                <th>Region</th>
                <th>Paystack</th>
                <th>AkwaRemit</th>
                <th>Cash</th>
                <th>Total</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((f) => (
                <tr key={f.name} className="clickable-row">
                  <td><strong>{f.name}</strong></td>
                  <td>{f.region}</td>
                  <td>{formatNaira(f.paystack)}</td>
                  <td>{formatNaira(f.akwa)}</td>
                  <td>{formatNaira(f.cash)}</td>
                  <td><strong>{formatNaira(f.total)}</strong></td>
                  <td>
                    {f.variance === 0 ? (
                      <span className="exec-status-pill exec-status--normal">Clean</span>
                    ) : (
                      <span className="exec-status-pill exec-status--critical">{formatNaira(f.variance)}</span>
                    )}
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
