'use client';

import React, { useMemo, useState } from 'react';
import { Building2, Download, Search } from 'lucide-react';
import type { MohFacilityTelemetry } from '../../lib/mohTypes';

interface MohFacilitiesViewProps {
  facilities: MohFacilityTelemetry[];
  onSelectFacility: (fac: MohFacilityTelemetry) => void;
}

export const MohFacilitiesView: React.FC<MohFacilitiesViewProps> = ({
  facilities,
  onSelectFacility,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [boardFilter, setBoardFilter] = useState('all');

  const filtered = useMemo(() => {
    return facilities.filter((f) => {
      if (statusFilter !== 'all' && f.enrollmentStatus !== statusFilter) return false;
      if (boardFilter !== 'all' && f.board !== boardFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          f.facilityName.toLowerCase().includes(q) ||
          f.facilityId.toLowerCase().includes(q) ||
          f.lga.toLowerCase().includes(q) ||
          f.hfrCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facilities, statusFilter, boardFilter, search]);

  const exportCsv = () => {
    const header = ['Facility ID', 'Name', 'District', 'LGA', 'Board', 'HFR Code', 'Enrollment', 'Compliance %', 'Beds Occupied', 'Total Beds', 'Active Staff'];
    const rows = filtered.map((f) => [
      f.facilityId,
      `"${f.facilityName.replace(/"/g, '""')}"`,
      f.district,
      `"${f.lga}"`,
      f.supervisoryBoard,
      f.hfrCode || 'Pending',
      f.enrollmentStatus,
      f.complianceScore,
      f.occupiedBeds,
      f.totalBeds,
      f.activeStaffCount,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akwa-ibom-moh-facilities-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Facility Network &amp; HFR Registry</h1>
          <p className="moh-view-sub">
            Canonical registry of official Akwa Ibom health facilities linked to MedCore OS ({facilities.length} total).
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={exportCsv}>
          <Download size={15} />
          <span>Export Registry CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="moh-panel" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="moh-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search by facility name, code, LGA, or HFR ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="moh-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All Statuses</option>
            <option value="active">Connected to OS</option>
            <option value="pending">Pending Onboarding</option>
          </select>
          <select className="moh-select" value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)}>
            <option value="all">All Supervisory Boards</option>
            <option value="AKSHMB">AKSHMB (Secondary)</option>
            <option value="AKSPHCDA">AKSPHCDA (Primary)</option>
            <option value="FMOH">FMOH (Tertiary)</option>
            <option value="Mission">Mission Hospitals</option>
          </select>
        </div>
      </div>

      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Building2 size={17} color="#065F46" />
            Showing {filtered.length} of {facilities.length} Facilities
          </h2>
          <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Click any facility row to inspect &amp; update oversight status</span>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Facility ID</th>
                <th>Facility &amp; LGA</th>
                <th>District</th>
                <th>Board</th>
                <th>HFR Code</th>
                <th>Capacity</th>
                <th>Compliance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((fac) => (
                <tr key={fac.facilityId} className="moh-row-click" onClick={() => onSelectFacility(fac)}>
                  <td><code style={{ fontWeight: 700, color: '#065F46' }}>{fac.facilityId}</code></td>
                  <td>
                    <strong style={{ color: '#0F172A' }}>{fac.facilityName}</strong>
                    <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{fac.lga} · {fac.facilityType}</div>
                  </td>
                  <td>{fac.district}</td>
                  <td><span className="moh-pill slate">{fac.supervisoryBoard}</span></td>
                  <td>{fac.hfrCode || <span style={{ color: '#94A3B8' }}>Not set</span>}</td>
                  <td>{fac.totalBeds > 0 ? `${fac.occupiedBeds}/${fac.totalBeds} beds` : '—'}</td>
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
                    No facilities match your current filter.
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
