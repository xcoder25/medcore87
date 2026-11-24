'use client';

import React, { useMemo, useState } from 'react';
import { Building2, Download, Plus, Search, X } from 'lucide-react';
import { AKWA_IBOM_LGAS } from '../../data/akwaIbomFacilities';
import type { MohFacilityTelemetry, MohLicenseAlertStatus, MohOperationalStatus } from '../../lib/mohTypes';

interface MohFacilitiesViewProps {
  facilities: MohFacilityTelemetry[];
  officerName?: string;
  onSelectFacility: (fac: MohFacilityTelemetry) => void;
  onRegisterPrivateFacility?: (input: {
    facilityName: string;
    lga: string;
    ownership?: 'private' | 'mission' | 'ppp';
    facilityType?: string;
    licenseNo?: string;
    licenseExpiry?: string;
    approvedServices?: string[];
    registeredBy?: string;
  }) => Promise<void>;
}

const OP_STATUS_BADGE: Record<MohOperationalStatus, { label: string; tone: string }> = {
  fully_functional: { label: 'Fully Functional', tone: 'emerald' },
  partially_functional: { label: 'Partially Functional', tone: 'amber' },
  closed: { label: 'Closed', tone: 'slate' },
  sealed: { label: 'Sealed', tone: 'danger' },
};

const LIC_ALERT_BADGE: Record<MohLicenseAlertStatus, { label: string; tone: string }> = {
  valid: { label: 'License Valid', tone: 'emerald' },
  expiring_soon: { label: 'Expiring ≤30d', tone: 'amber' },
  expired: { label: 'Expired', tone: 'danger' },
  missing: { label: 'Unlicensed / Pending', tone: 'slate' },
};

export const MohFacilitiesView: React.FC<MohFacilitiesViewProps> = ({
  facilities,
  officerName,
  onSelectFacility,
  onRegisterPrivateFacility,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [boardFilter, setBoardFilter] = useState('all');
  const [opFilter, setOpFilter] = useState<'all' | MohOperationalStatus>('all');
  const [licFilter, setLicFilter] = useState<'all' | MohLicenseAlertStatus>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'public' | 'private' | 'mission'>('all');

  const [privateOpen, setPrivateOpen] = useState(false);
  const [privName, setPrivName] = useState('');
  const [privLga, setPrivLga] = useState(AKWA_IBOM_LGAS[0]?.lga || 'Uyo');
  const [privOwnership, setPrivOwnership] = useState<'private' | 'mission' | 'ppp'>('private');
  const [privType, setPrivType] = useState('Private Clinic & Maternity');
  const [privLicNo, setPrivLicNo] = useState('');
  const [privLicExp, setPrivLicExp] = useState('');
  const [privServices, setPrivServices] = useState('General OPD, Antenatal Care, Laboratory');
  const [privBusy, setPrivBusy] = useState(false);

  const filtered = useMemo(() => {
    return facilities.filter((f) => {
      if (statusFilter !== 'all' && f.enrollmentStatus !== statusFilter) return false;
      if (boardFilter !== 'all' && f.board !== boardFilter) return false;
      if (opFilter !== 'all' && f.operationalStatus !== opFilter) return false;
      if (licFilter !== 'all' && f.licenseAlert !== licFilter) return false;
      if (ownershipFilter === 'public' && !f.ownership.startsWith('public')) return false;
      if (ownershipFilter === 'private' && f.ownership !== 'private' && f.ownership !== 'ppp') return false;
      if (ownershipFilter === 'mission' && f.ownership !== 'mission') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          f.facilityName.toLowerCase().includes(q) ||
          f.facilityId.toLowerCase().includes(q) ||
          f.lga.toLowerCase().includes(q) ||
          f.hfrCode.toLowerCase().includes(q) ||
          f.licenseNo.toLowerCase().includes(q) ||
          f.approvedServices.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [facilities, statusFilter, boardFilter, opFilter, licFilter, ownershipFilter, search]);

  const exportCsv = () => {
    const header = [
      'Facility ID',
      'Name',
      'District',
      'LGA',
      'Ownership',
      'Operational Status',
      'Board',
      'HFR Code',
      'License No',
      'License Expiry',
      'Approved Services',
      'Compliance %',
      'Beds Occupied',
      'Total Beds',
      'Active Staff',
    ];
    const rows = filtered.map((f) => [
      f.facilityId,
      `"${f.facilityName.replace(/"/g, '""')}"`,
      f.district,
      `"${f.lga}"`,
      f.ownership,
      f.operationalStatus,
      f.supervisoryBoard,
      f.hfrCode || 'Pending',
      f.licenseNo || 'Pending',
      f.licenseExpiry || 'Pending',
      `"${f.approvedServices.join('; ')}"`,
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRegisterPrivateFacility || !privName.trim() || !privLga) return;
    setPrivBusy(true);
    try {
      await onRegisterPrivateFacility({
        facilityName: privName.trim(),
        lga: privLga,
        ownership: privOwnership,
        facilityType: privType.trim() || 'Private Clinic',
        licenseNo: privLicNo.trim(),
        licenseExpiry: privLicExp,
        approvedServices: privServices
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        registeredBy: officerName || 'MOH Registry Desk',
      });
      setPrivName('');
      setPrivLicNo('');
      setPrivLicExp('');
      setPrivateOpen(false);
    } finally {
      setPrivBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Master Facility Registry &amp; Licensing</h1>
          <p className="moh-view-sub">
            Canonical directory of Akwa Ibom public, faith-based, and licensed private health facilities ({facilities.length} total).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onRegisterPrivateFacility && (
            <button type="button" className="moh-btn-outline" onClick={() => setPrivateOpen(true)}>
              <Plus size={15} />
              <span>Register Private Clinic</span>
            </button>
          )}
          <button type="button" className="moh-btn-primary" onClick={exportCsv}>
            <Download size={15} />
            <span>Export Registry CSV</span>
          </button>
        </div>
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
              placeholder="Search name, ID, LGA, HFR code, license, or approved service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="moh-select" value={opFilter} onChange={(e) => setOpFilter(e.target.value as any)}>
            <option value="all">Operational: All</option>
            <option value="fully_functional">Fully Functional</option>
            <option value="partially_functional">Partially Functional</option>
            <option value="closed">Closed</option>
            <option value="sealed">Sealed</option>
          </select>
          <select className="moh-select" value={licFilter} onChange={(e) => setLicFilter(e.target.value as any)}>
            <option value="all">License: All</option>
            <option value="expired">Expired</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="valid">Valid</option>
            <option value="missing">Pending / Unlicensed</option>
          </select>
          <select className="moh-select" value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value as any)}>
            <option value="all">Ownership: All</option>
            <option value="public">Public (State / Federal)</option>
            <option value="mission">Faith-Based / Mission</option>
            <option value="private">Private / PPP</option>
          </select>
          <select className="moh-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">OS Sync: All</option>
            <option value="active">Connected to OS</option>
            <option value="pending">Pending Onboarding</option>
          </select>
          <select className="moh-select" value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)}>
            <option value="all">All Boards</option>
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
          <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Click any row to open full 360° Hospital Dossier</span>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Facility ID</th>
                <th>Facility, Ownership &amp; LGA</th>
                <th>Approved Scope of Services</th>
                <th>HFR &amp; License Status</th>
                <th>Operational Status</th>
                <th>Capacity</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((fac) => {
                const opMeta = OP_STATUS_BADGE[fac.operationalStatus] || OP_STATUS_BADGE.partially_functional;
                const licMeta = LIC_ALERT_BADGE[fac.licenseAlert] || LIC_ALERT_BADGE.missing;
                return (
                  <tr key={fac.facilityId} className="moh-row-click" onClick={() => onSelectFacility(fac)}>
                    <td>
                      <code style={{ fontWeight: 700, color: '#065F46' }}>{fac.facilityId}</code>
                      <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 2 }}>{fac.district}</div>
                    </td>
                    <td>
                      <strong style={{ color: '#0F172A' }}>{fac.facilityName}</strong>
                      <div style={{ fontSize: '0.73rem', color: '#64748B' }}>
                        {fac.lga} · {fac.facilityType} · <span style={{ textTransform: 'capitalize' }}>{fac.ownership.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {fac.approvedServices.slice(0, 3).map((srv) => (
                          <span key={srv} className="moh-pill slate" style={{ fontSize: '0.69rem' }}>
                            {srv}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {fac.hfrCode || fac.licenseNo || <span style={{ color: '#94A3B8' }}>Not set</span>}
                      </div>
                      <span className={`moh-pill ${licMeta.tone}`} style={{ marginTop: 3, fontSize: '0.68rem' }}>
                        {licMeta.label}
                      </span>
                    </td>
                    <td>
                      <span className={`moh-pill ${opMeta.tone}`}>{opMeta.label}</span>
                    </td>
                    <td>{fac.totalBeds > 0 ? `${fac.occupiedBeds}/${fac.totalBeds} beds` : '—'}</td>
                    <td>
                      <span className={`moh-pill ${fac.complianceScore >= 75 ? 'emerald' : fac.complianceScore > 0 ? 'amber' : 'slate'}`}>
                        {fac.complianceScore}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
                    No facilities match your current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Private Clinic Registration Modal */}
      {privateOpen && (
        <div className="moh-backdrop" onClick={() => !privBusy && setPrivateOpen(false)}>
          <div className="moh-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Register Private Clinic">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Register Private / Faith-Based Facility</h3>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  Enroll a licensed clinic onto the statewide GIS map and regulatory compliance tracker.
                </div>
              </div>
              <button type="button" className="moh-icon-btn" onClick={() => setPrivateOpen(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                Facility Name *
                <input className="moh-input" style={{ marginTop: 4 }} required value={privName} onChange={(e) => setPrivName(e.target.value)} placeholder="e.g. Grace Specialist Clinic, Uyo" />
              </label>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  LGA *
                  <select className="moh-input" style={{ marginTop: 4 }} value={privLga} onChange={(e) => setPrivLga(e.target.value)}>
                    {AKWA_IBOM_LGAS.map((l) => (
                      <option key={l.lga} value={l.lga}>
                        {l.lga} ({l.district})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Ownership
                  <select className="moh-input" style={{ marginTop: 4 }} value={privOwnership} onChange={(e) => setPrivOwnership(e.target.value as any)}>
                    <option value="private">Private For-Profit</option>
                    <option value="mission">Faith-Based / Mission</option>
                    <option value="ppp">Public-Private Partnership</option>
                  </select>
                </label>
              </div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Facility Category
                  <input className="moh-input" style={{ marginTop: 4 }} value={privType} onChange={(e) => setPrivType(e.target.value)} />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  License No.
                  <input className="moh-input" style={{ marginTop: 4 }} value={privLicNo} onChange={(e) => setPrivLicNo(e.target.value)} placeholder="e.g. AKS-PRV-2026-014" />
                </label>
              </div>
              <div className="moh-two-col">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  License Expiry Date
                  <input type="date" className="moh-input" style={{ marginTop: 4 }} value={privLicExp} onChange={(e) => setPrivLicExp(e.target.value)} />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Approved Services (comma separated)
                  <input className="moh-input" style={{ marginTop: 4 }} value={privServices} onChange={(e) => setPrivServices(e.target.value)} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button type="button" className="moh-btn-outline" onClick={() => setPrivateOpen(false)} disabled={privBusy}>Cancel</button>
                <button type="submit" className="moh-btn-primary" disabled={privBusy}>{privBusy ? 'Registering…' : 'Register Facility'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
