'use client';

import React, { useMemo, useState } from 'react';
import { ShieldCheck, Lock, Download, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { MohLiveSnapshot } from '../../lib/mohTypes';
import { computeMohLedgerMerkleRoot } from '../../lib/mohMerkle';

interface MohAuditLedgerViewProps {
  snapshot: MohLiveSnapshot;
}

export const MohAuditLedgerView: React.FC<MohAuditLedgerViewProps> = ({ snapshot }) => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const { auditLedger } = snapshot;

  const merkleRoot = useMemo(
    () => computeMohLedgerMerkleRoot(auditLedger.events.map((e) => e.rowHash)),
    [auditLedger.events]
  );

  const filteredEvents = useMemo(() => {
    return auditLedger.events.filter((ev) => {
      if (severityFilter !== 'all' && ev.severity !== severityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ev.facilityName.toLowerCase().includes(q) ||
          ev.facilityId.toLowerCase().includes(q) ||
          ev.action.toLowerCase().includes(q) ||
          ev.category.toLowerCase().includes(q) ||
          ev.detail.toLowerCase().includes(q) ||
          ev.actor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLedger.events, search, severityFilter]);

  const exportCsv = () => {
    const header = [
      'Event ID',
      'Timestamp',
      'Facility ID',
      'Facility Name',
      'Severity',
      'Category',
      'Action',
      'Actor',
      'Redacted Detail',
      'SHA-256 Chain Hash',
    ];
    const body = filteredEvents.map((ev) => [
      ev.id,
      ev.createdAt,
      ev.facilityId,
      ev.facilityName,
      ev.severity,
      ev.category,
      ev.action,
      ev.actor,
      ev.detail,
      ev.rowHash,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aks-moh-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Tamper-Evident Audit Ledger &amp; Privacy Guard</h1>
          <p className="moh-view-sub">
            Live SHA-256 hash-chained regulatory events across Akwa Ibom hospitals, strictly scrubbed under NDPR &amp; HIPAA Safe Harbor.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={exportCsv}>
          <Download size={15} />
          <span>Export Proof Ledger</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="moh-kpi-grid">
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Chain Verification</span>
          <span className="moh-kpi-val" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={20} color="#065F46" />
            <span>{auditLedger.integrityVerified ? 'Verified Intact' : 'Review Required'}</span>
          </span>
          <span className="moh-kpi-sub">Immutable SHA-256 ledger sequence</span>
        </div>
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Tracked Ledger Events</span>
          <span className="moh-kpi-val">{auditLedger.totalEvents.toLocaleString('en-NG')}</span>
          <span className="moh-kpi-sub">Recent state &amp; hospital governance entries</span>
        </div>
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Critical Security / Override Events</span>
          <span className="moh-kpi-val">{auditLedger.criticalEvents}</span>
          <span className="moh-kpi-sub">High-severity events flagged for oversight</span>
        </div>
        <div className="moh-kpi-card">
          <span className="moh-kpi-label">Latest Head Hash</span>
          <span
            className="moh-kpi-val"
            style={{ fontSize: '0.95rem', fontFamily: 'monospace', wordBreak: 'break-all' }}
          >
            {auditLedger.latestHash ? `${auditLedger.latestHash.slice(0, 18)}…` : 'GENESIS'}
          </span>
          <span className="moh-kpi-sub">Latest ledger checkpoint signature</span>
        </div>
      </div>

      {/* NDPR Safe Harbor Assurance Card */}
      <div
        className="moh-panel"
        style={{
          background: '#ECFDF5',
          borderColor: '#A7F3D0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#FFFFFF',
              color: '#065F46',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Lock size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#065F46' }}>
              NDPR &amp; HIPAA Safe Harbor Boundary Active
            </div>
            <div style={{ fontSize: '0.8rem', color: '#047857' }}>
              Patient names, NINs, phone numbers, email addresses, and credential hashes are scrubbed server-side before reaching Ministry views.
            </div>
            <div style={{ fontSize: '0.73rem', fontFamily: 'monospace', color: '#065F46', marginTop: 4 }}>
              Merkle Root Seal ({auditLedger.events.length} leaves): {merkleRoot.slice(0, 24)}…
            </div>
          </div>
        </div>
        <span className="moh-pill emerald">Zero PII Exposed</span>
      </div>

      {/* Ledger Table */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <ShieldCheck size={17} color="#065F46" />
            <span>De-identified Clinical &amp; Governance Ledger ({filteredEvents.length})</span>
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
                placeholder="Search action, hospital, actor..."
              />
            </div>
            <select
              className="moh-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter audit events by severity"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Facility</th>
                <th>Severity</th>
                <th>Action &amp; Actor</th>
                <th>Sanitized Summary</th>
                <th>Hash Proof</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.76rem', color: '#64748B' }}>
                    {new Date(ev.createdAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0F172A' }}>
                      {ev.facilityName}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
                      {ev.facilityId}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`moh-pill ${
                        ev.severity === 'critical'
                          ? 'danger'
                          : ev.severity === 'warning'
                          ? 'amber'
                          : 'slate'
                      }`}
                    >
                      {ev.severity === 'critical' && <AlertTriangle size={11} />}
                      {ev.severity.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.81rem', color: '#0F172A' }}>
                      {ev.action}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      {ev.actor} {ev.actorBadge ? `(${ev.actorBadge})` : ''}
                    </div>
                  </td>
                  <td style={{ maxWidth: 360, fontSize: '0.79rem', color: '#334155' }}>
                    {ev.detail || `${ev.entity} ${ev.entityId}`}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B' }}>
                    {ev.rowHash ? `${ev.rowHash.slice(0, 12)}…` : '—'}
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                    No audit ledger entries recorded for the current filter.
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
