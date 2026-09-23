'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Download,
  Key,
  CheckCircle2,
  Clock,
  Radio,
  Filter,
  Copy,
  Shield,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AkwaIbomFacility, FacilityEnrollmentStatus } from '../data/akwaIbomFacilities';

interface FacilityRegistryViewProps {
  registry: AkwaIbomFacility[];
  onIssueCredentials: (facilityId: string) => void;
  onSimulateActivation: (facilityId: string) => void;
  selectedRegion: string;
}

const STATUS_META: Record<FacilityEnrollmentStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    cls: 'exec-status--elevated',
    icon: <Clock size={12} />,
  },
  credentials_issued: {
    label: 'Credentials Issued',
    cls: 'exec-status--elevated',
    icon: <Key size={12} />,
  },
  active: {
    label: 'Active · Live',
    cls: 'exec-status--normal',
    icon: <Wifi size={12} />,
  },
};

export const FacilityRegistryView: React.FC<FacilityRegistryViewProps> = ({
  registry,
  onIssueCredentials,
  onSimulateActivation,
  selectedRegion,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FacilityEnrollmentStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return registry.filter((f) => {
      if (selectedRegion !== 'All National Jurisdictions' && selectedRegion !== 'Other Regions') {
        if (f.region !== selectedRegion) return false;
      }
      if (statusFilter !== 'all' && f.enrollmentStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          f.facilityName.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q) ||
          f.facilityId.toLowerCase().includes(q) ||
          f.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [registry, selectedRegion, statusFilter, search]);

  const counts = useMemo(() => {
    const active = registry.filter((f) => f.enrollmentStatus === 'active').length;
    const issued = registry.filter((f) => f.enrollmentStatus === 'credentials_issued').length;
    const pending = registry.filter((f) => f.enrollmentStatus === 'pending').length;
    return { active, issued, pending, total: registry.length };
  }, [registry]);

  const copyCreds = (f: AkwaIbomFacility) => {
    if (!f.hospiLogin || !f.hospiTempPassword) return;
    const text = `Facility: ${f.facilityName}\nLogin: ${f.hospiLogin}\nTemp Password: ${f.hospiTempPassword}\n(Change on first Hospi OS login)`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(f.facilityId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="exec-view anim-fade-up">
      <div className="exec-view-header">
        <div className="exec-view-title-block">
          <div className="exec-view-icon-wrap exec-icon-vital">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="exec-view-title">Facility Registry & Surveillance</h1>
            <p className="exec-view-subtitle">
              Official secondary health facilities · Enrollment & Hospi OS activation status
            </p>
          </div>
        </div>
        <button type="button" className="exec-export-btn">
          <Download size={15} />
          Export Registry
        </button>
      </div>

      {/* KPI ribbon */}
      <div className="exec-kpi-ribbon">
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Total Registered</div>
          <div className="exec-kpi-value">{counts.total}</div>
          <div className="exec-kpi-sub">Secondary facilities</div>
        </div>
        <div className="exec-kpi-card exec-kpi-clean">
          <div className="exec-kpi-label">Active · Live</div>
          <div className="exec-kpi-value">{counts.active}</div>
          <div className="exec-kpi-sub">Streaming telemetry</div>
        </div>
        <div className="exec-kpi-card">
          <div className="exec-kpi-label">Credentials Issued</div>
          <div className="exec-kpi-value">{counts.issued}</div>
          <div className="exec-kpi-sub">Awaiting first login</div>
        </div>
        <div className="exec-kpi-card exec-kpi-alert">
          <div className="exec-kpi-label">Pending</div>
          <div className="exec-kpi-value">{counts.pending}</div>
          <div className="exec-kpi-sub">Not yet enrolled</div>
        </div>
      </div>

      {/* Filters */}
      <div className="exec-panel" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div className="exec-search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by name, location, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="exec-search-input"
              style={{ width: '100%' }}
            />
          </div>
          <select
            className="exec-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active · Live</option>
            <option value="credentials_issued">Credentials Issued</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Registry table */}
      <div className="exec-panel">
        <div className="exec-panel-header">
          <Radio size={16} />
          <h2>
            Facility Roll · {filtered.length} shown
          </h2>
        </div>
        <div className="table-responsive">
          <table className="moh-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Facility</th>
                <th>Location</th>
                <th>Region</th>
                <th>Tier</th>
                <th>Enrollment</th>
                <th>Live Data</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const meta = STATUS_META[f.enrollmentStatus];
                return (
                  <tr key={f.facilityId} className="clickable-row">
                    <td>
                      <code className="license-code">{f.facilityId}</code>
                    </td>
                    <td>
                      <strong>{f.facilityName}</strong>
                      {f.enrollmentStatus === 'credentials_issued' && f.hospiLogin && (
                        <div className="table-sub-detail" style={{ marginTop: 4 }}>
                          Login: <code>{f.hospiLogin}</code>
                          {f.hospiTempPassword && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                className="registry-copy-btn"
                                onClick={() => copyCreds(f)}
                                title="Copy credentials"
                              >
                                {copiedId === f.facilityId ? 'Copied' : <Copy size={11} />}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{f.location}</td>
                    <td>{f.region}</td>
                    <td>
                      <span className="tier-tag-pill">
                        {f.tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`exec-status-pill ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td>
                      {f.enrollmentStatus === 'active' ? (
                        <span className="registry-live">
                          <Activity size={12} />
                          {f.occupiedBeds}/{f.totalBeds} beds
                          {f.icuBedsTotal != null && (
                            <> · ICU {f.icuBedsOccupied}/{f.icuBedsTotal}</>
                          )}
                        </span>
                      ) : (
                        <span className="registry-offline">
                          <WifiOff size={12} /> Offline
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="registry-actions">
                        {f.enrollmentStatus === 'pending' && (
                          <button
                            type="button"
                            className="registry-action-btn registry-action-btn--primary"
                            onClick={() => onIssueCredentials(f.facilityId)}
                          >
                            <Key size={12} /> Issue Login
                          </button>
                        )}
                        {f.enrollmentStatus === 'credentials_issued' && (
                          <button
                            type="button"
                            className="registry-action-btn registry-action-btn--activate"
                            onClick={() => onSimulateActivation(f.facilityId)}
                            title="Simulate facility first Hospi OS login"
                          >
                            <CheckCircle2 size={12} /> Mark Active
                          </button>
                        )}
                        {f.enrollmentStatus === 'active' && (
                          <span className="registry-active-badge">
                            <Shield size={12} /> Overseeing
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            No facilities match your filters.
          </div>
        )}
      </div>

      <div className="exec-panel" style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--admin-text)' }}>How enrollment works</strong>
        <br />
        1. Commissioner asks M87 to <em>generate logins</em> for one or more facilities (or uses Issue Login here).
        <br />
        2. Credentials are issued → status becomes <strong>Credentials Issued</strong>. Share login with the facility.
        <br />
        3. When the facility installs Hospi OS and signs in with those credentials, it becomes <strong>Active · Live</strong> and streams telemetry to this console.
        <br />
        4. You receive a notification the moment a facility goes active.
      </div>
    </div>
  );
};
