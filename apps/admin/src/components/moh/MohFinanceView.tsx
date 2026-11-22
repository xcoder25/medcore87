'use client';

import React, { useMemo, useState } from 'react';
import { Wallet, Download, Search, CheckCircle2, Clock } from 'lucide-react';
import type { MohFacilityTelemetry, MohLiveSnapshot } from '../../lib/mohTypes';

interface MohFinanceViewProps {
  snapshot: MohLiveSnapshot;
  onSelectFacility: (facility: MohFacilityTelemetry) => void;
}

function fmtNaira(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

function fmtExactNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

export const MohFinanceView: React.FC<MohFinanceViewProps> = ({
  snapshot,
  onSelectFacility,
}) => {
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');

  const { finance, facilities } = snapshot;

  const totalVolume = finance.totalCollectedNgn + finance.totalPendingNgn;
  const collectionRate =
    totalVolume > 0 ? Math.round((finance.totalCollectedNgn / totalVolume) * 100) : 100;

  const channels = [
    { key: 'akwaremit', label: 'AkwaRemit Treasury', amount: finance.byChannel.akwaremit },
    { key: 'paystack', label: 'Paystack Gateway', amount: finance.byChannel.paystack },
    { key: 'hmo', label: 'HMO / AKSHIA Claims', amount: finance.byChannel.hmo },
    { key: 'cash', label: 'Facility Cash Desk', amount: finance.byChannel.cash },
    { key: 'other', label: 'Other Channels', amount: finance.byChannel.other },
  ];

  const rows = useMemo(() => {
    const facilityMap = new Map(facilities.map((f) => [f.facilityId, f]));
    const base =
      finance.byFacility.length > 0
        ? finance.byFacility
        : facilities.map((f) => ({
            facilityId: f.facilityId,
            facilityName: f.facilityName,
            district: f.district,
            collectedNgn: f.revenuePaidNgn,
            pendingNgn: f.revenuePendingNgn,
            receiptsCount: f.hasDbActivity ? 1 : 0,
          }));

    return base
      .filter((r) => {
        if (districtFilter !== 'all' && r.district !== districtFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            r.facilityName.toLowerCase().includes(q) ||
            r.facilityId.toLowerCase().includes(q) ||
            r.district.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((r) => ({
        ...r,
        facility: facilityMap.get(r.facilityId) || null,
      }))
      .sort((a, b) => b.collectedNgn + b.pendingNgn - (a.collectedNgn + a.pendingNgn));
  }, [finance.byFacility, facilities, search, districtFilter]);

  const exportCsv = () => {
    const header = [
      'Facility ID',
      'Facility Name',
      'District',
      'Collected (NGN)',
      'Pending Settlement (NGN)',
      'Receipts Count',
    ];
    const body = rows.map((r) => [
      r.facilityId,
      r.facilityName,
      r.district,
      String(Math.round(r.collectedNgn)),
      String(Math.round(r.pendingNgn)),
      String(r.receiptsCount),
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aks-moh-treasury-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Public Health Finance &amp; Treasury</h1>
          <p className="moh-view-sub">
            Aggregated facility collections, AkwaRemit remittances, AKSHIA/HMO settlements, and open funding requisitions.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={exportCsv}>
          <Download size={15} />
          <span>Export Treasury CSV</span>
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="moh-kpi-grid">
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Total Collected (YTD)</span>
          <span className="moh-kpi-val">{fmtNaira(finance.totalCollectedNgn)}</span>
          <span className="moh-kpi-sub">{finance.paidReceiptsCount} verified receipts settled</span>
        </div>
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Pending Settlement</span>
          <span className="moh-kpi-val">{fmtNaira(finance.totalPendingNgn)}</span>
          <span className="moh-kpi-sub">
            {finance.totalPendingNgn > 0 ? 'Unsettled receivables tracked' : 'All posted receivables cleared'}
          </span>
        </div>
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Collection Realization</span>
          <span className="moh-kpi-val">{collectionRate}%</span>
          <span className="moh-kpi-sub">Paid vs. total invoiced facility billing</span>
        </div>
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Open Facility Requisitions</span>
          <span className="moh-kpi-val">{finance.openRequestsCount}</span>
          <span className="moh-kpi-sub">Pending accounts desk requests statewide</span>
        </div>
      </div>

      {/* Payment Channel Mix */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Wallet size={17} color="#065F46" />
            <span>Remittance &amp; Payment Channel Distribution</span>
          </h2>
          <span className="moh-pill slate">
            Total Verified: {fmtExactNaira(finance.totalCollectedNgn)}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          {channels.map((ch) => {
            const pct =
              finance.totalCollectedNgn > 0
                ? Math.round((ch.amount / finance.totalCollectedNgn) * 100)
                : 0;
            return (
              <div
                key={ch.key}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  <span>{ch.label}</span>
                  <span style={{ color: '#065F46' }}>{pct}%</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                  {fmtNaira(ch.amount)}
                </div>
                <div className="moh-meter">
                  <div className="moh-meter-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Facility Revenue Table */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <span>Facility Financial Telemetry ({rows.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 250 }}>
              <Search
                size={14}
                color="#64748B"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="moh-input"
                style={{ paddingLeft: 32, height: 36 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hospital, code..."
              />
            </div>
            <select
              className="moh-select"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              aria-label="Filter revenue by senatorial district"
            >
              <option value="all">All Senatorial Districts</option>
              <option value="Uyo">Uyo District</option>
              <option value="Ikot Ekpene">Ikot Ekpene District</option>
              <option value="Eket">Eket District</option>
            </select>
          </div>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>District</th>
                <th>Receipts</th>
                <th>Collected</th>
                <th>Pending</th>
                <th>Settlement Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.facilityId}
                  className={r.facility ? 'moh-row-click' : undefined}
                  onClick={() => r.facility && onSelectFacility(r.facility)}
                >
                  <td>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{r.facilityName}</div>
                    <div style={{ fontSize: '0.73rem', color: '#64748B', fontFamily: 'monospace' }}>
                      {r.facilityId}
                    </div>
                  </td>
                  <td>{r.district}</td>
                  <td style={{ fontWeight: 700 }}>{r.receiptsCount.toLocaleString('en-NG')}</td>
                  <td style={{ fontWeight: 700, color: '#065F46' }}>{fmtExactNaira(r.collectedNgn)}</td>
                  <td style={{ color: r.pendingNgn > 0 ? '#D97706' : '#64748B', fontWeight: r.pendingNgn > 0 ? 700 : 500 }}>
                    {fmtExactNaira(r.pendingNgn)}
                  </td>
                  <td>
                    {r.pendingNgn > 0 ? (
                      <span className="moh-pill amber">
                        <Clock size={12} />
                        Pending Settlement
                      </span>
                    ) : r.collectedNgn > 0 ? (
                      <span className="moh-pill emerald">
                        <CheckCircle2 size={12} />
                        Reconciled
                      </span>
                    ) : (
                      <span className="moh-pill slate">No Posted Receipts</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                    No facilities match the selected filter criteria.
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
