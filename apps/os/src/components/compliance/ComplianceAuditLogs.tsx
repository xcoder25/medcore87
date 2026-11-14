'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Shield,
  Lock,
  RefreshCw,
  Hash,
} from 'lucide-react';
import {
  listAudit,
  hydrateAuditLedger,
  subscribeAudit,
  exportAuditCsv,
  verifyAuditChain,
  appendAudit,
  type AuditEvent,
  type AuditCategory,
  type AuditSeverity,
} from '../../lib/auditLogStore';
import type { UserSession } from '../auth/AuthScreen';

const CATEGORY_META: Record<AuditCategory, { label: string; color: string }> = {
  clinical: { label: 'Clinical', color: '#059669' },
  financial: { label: 'Financial', color: '#EA580C' },
  access: { label: 'Access Control', color: '#7C3AED' },
  pharmacy: { label: 'Pharmacy', color: '#2563EB' },
  records: { label: 'Records', color: '#D97706' },
};

const SEVERITY_META: Record<AuditSeverity, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#475569' },
  notable: { label: 'Notable', color: '#D97706' },
  critical: { label: 'Critical', color: '#DC2626' },
};

interface Props {
  session?: UserSession;
}

export const ComplianceAuditLogs: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [events, setEvents] = useState<AuditEvent[]>(() => listAudit(facilityId, 300));
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<AuditCategory | 'all'>('all');
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setEvents(listAudit(facilityId, 300));
    void hydrateAuditLedger(facilityId).then((list) => {
      setEvents(list);
    });
    const unsub = subscribeAudit(() => {
      setEvents(listAudit(facilityId, 300));
    });
    return unsub;
  }, [facilityId]);

  const chainStatus = useMemo(() => verifyAuditChain(events), [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const cat = e.category || 'clinical';
      if (catFilter !== 'all' && cat !== catFilter) return false;
      if (
        q &&
        !e.action.toLowerCase().includes(q) &&
        !e.actor.toLowerCase().includes(q) &&
        !e.id.toLowerCase().includes(q) &&
        !(e.detail || '').toLowerCase().includes(q) &&
        !(e.entityId || '').toLowerCase().includes(q) &&
        !(e.rowHash || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [events, catFilter, search]);

  const handleVerifyChain = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      const res = verifyAuditChain(events);
      setToast(
        res.verified
          ? `SHA-256 Hash Chain Verified (${res.checkedCount} blocks intact · Root ${res.chainRootHash.slice(0, 12)}…)`
          : `Hash Chain Integrity Alert at ${res.brokenAtId}`
      );
      setTimeout(() => setToast(null), 4000);
    }, 300);
  };

  const handleRecordSeal = () => {
    const ev = appendAudit({
      facilityId,
      actor: session?.name || 'Compliance Officer',
      actorBadge: session?.badgeId || 'ADM-001',
      category: 'access',
      severity: 'normal',
      action: 'CRYPTOGRAPHIC_LEDGER_SEAL_CHECK',
      entity: 'clinical_audit_ledger',
      entityId: facilityId,
      detail: `Tamper-evident NDPR / 21 CFR Part 11 ledger checkpoint verified by ${session?.name || 'Compliance Officer'}.`,
    });
    setSelected(ev);
    setToast(`Recorded cryptographic audit seal ${ev.id}`);
    setTimeout(() => setToast(null), 3500);
  };

  const handleExportCsv = () => {
    const csv = exportAuditCsv(facilityId);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medcore-audit-ledger-${facilityId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '12px 18px',
            borderRadius: 12,
            fontSize: '0.82rem',
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(15,23,42,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toast}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label">
            <FileText size={13} style={{ display: 'inline', marginRight: 4 }} />
            Tamper-Evident Ledger Entries
          </span>
          <span className="metric-val">{events.length}</span>
          <span className="metric-sub">Hash-chained in Postgres RLS</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label">
            <AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />
            Critical Events
          </span>
          <span className="metric-val">{events.filter((e) => e.severity === 'critical').length}</span>
          <span className="metric-sub">Overrides, voids & emergency actions</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label">Notable Events</span>
          <span className="metric-val">{events.filter((e) => e.severity === 'notable').length}</span>
          <span className="metric-sub">Discharges, transfers & waivers</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label">
            <Shield size={13} style={{ display: 'inline', marginRight: 4 }} />
            SHA-256 Chain Integrity
          </span>
          <span className="metric-val">{chainStatus.verified ? '100% VERIFIED' : 'ALERT'}</span>
          <span className="metric-sub" style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.7rem' }}>
            Head: {chainStatus.chainRootHash.slice(0, 16)}…
          </span>
        </div>
      </div>

      {/* Filters & Cryptographic Verification Bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="os-search-wrap" style={{ flex: 1, minWidth: 240 }}>
          <Search size={14} />
          <input
            className="os-search-input"
            placeholder="Search audit ID, staff actor, action, patient ID, or SHA-256 hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'clinical', 'financial', 'access', 'pharmacy', 'records'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className="os-ghost-btn"
              style={{
                background: catFilter === cat ? 'rgba(2, 132, 199, 0.12)' : undefined,
                borderColor: catFilter === cat ? '#0284C7' : undefined,
                color: catFilter === cat ? '#0369A1' : undefined,
                fontSize: '0.78rem',
                fontWeight: catFilter === cat ? 700 : 600,
              }}
            >
              {cat === 'all' ? 'All Categories' : CATEGORY_META[cat].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleVerifyChain}
          className="os-ghost-btn"
          style={{ borderColor: '#059669', color: '#059669', fontWeight: 700, fontSize: '0.78rem' }}
        >
          <RefreshCw size={13} className={verifying ? 'animate-spin' : ''} /> Verify Hash Chain
        </button>
        <button
          type="button"
          onClick={handleRecordSeal}
          className="os-ghost-btn"
          style={{ fontWeight: 700, fontSize: '0.78rem' }}
        >
          <Lock size={13} /> Seal Checkpoint
        </button>
        <button type="button" onClick={handleExportCsv} className="os-ghost-btn" style={{ fontSize: '0.78rem' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        {/* Log Table */}
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Row Hash (SHA-256)</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748B' }}>
                    No audit ledger entries match the current filter. Click &ldquo;Seal Checkpoint&rdquo; to record a live cryptographic audit block.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const cat = e.category || 'clinical';
                  const sev = e.severity || 'normal';
                  const catMeta = CATEGORY_META[cat] || CATEGORY_META.clinical;
                  const sevMeta = SEVERITY_META[sev] || SEVERITY_META.normal;
                  const isSelected = selected?.id === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(isSelected ? null : e)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#F0F9FF' : undefined,
                      }}
                    >
                      <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.76rem', color: '#0F172A', fontWeight: 700 }}>
                        {e.id}
                      </td>
                      <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.75rem', color: '#475569' }}>
                        {new Date(e.at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td>
                        <span
                          style={{
                            background: `${catMeta.color}15`,
                            color: catMeta.color,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 9999,
                          }}
                        >
                          {catMeta.label}
                        </span>
                      </td>
                      <td style={{ color: '#0F172A', fontSize: '0.83rem', fontWeight: 700 }}>{e.action}</td>
                      <td style={{ color: '#334155', fontSize: '0.8rem', fontWeight: 600 }}>
                        {e.actor} {e.actorBadge ? `(${e.actorBadge})` : ''}
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.78rem' }}>
                        {e.entity || '—'} {e.entityId ? `· ${e.entityId}` : ''}
                      </td>
                      <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.72rem', color: '#059669' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Hash size={11} />
                          {(e.rowHash || 'GENESIS').slice(0, 14)}…
                        </span>
                      </td>
                      <td>
                        <span style={{ color: sevMeta.color, fontSize: '0.78rem', fontWeight: 700 }}>
                          {sevMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Cryptographic Block Inspector */}
        {selected && (
          <div
            className="os-card"
            style={{
              padding: 20,
              alignSelf: 'flex-start',
              borderColor: SEVERITY_META[selected.severity || 'normal'].color,
              background: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0F172A' }}>
                Cryptographic Audit Block
              </h4>
              <button
                className="os-ghost-btn"
                style={{ padding: '4px 8px' }}
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[
                { label: 'Audit ID', value: selected.id, mono: true },
                { label: 'ISO Timestamp', value: selected.at, mono: true },
                { label: 'Facility Tenant', value: selected.facilityId, mono: true },
                { label: 'Action', value: selected.action },
                {
                  label: 'Performed By',
                  value: `${selected.actor}${selected.actorBadge ? ` (${selected.actorBadge})` : ''}`,
                },
                {
                  label: 'Target Entity',
                  value: `${selected.entity || 'System'}${selected.entityId ? ` · ${selected.entityId}` : ''}`,
                  mono: true,
                },
                { label: 'Previous Block Hash', value: selected.prevHash || 'GENESIS', mono: true },
                { label: 'Current Row Hash (SHA-256)', value: selected.rowHash || '—', mono: true },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#0F172A',
                      fontWeight: 600,
                      wordBreak: 'break-all',
                      fontFamily: item.mono ? 'var(--os-font-mono)' : undefined,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
              {selected.detail && (
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, marginBottom: 4 }}>
                    EVENT PAYLOAD / DETAIL
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      color: '#334155',
                      lineHeight: 1.5,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      padding: 10,
                      borderRadius: 8,
                    }}
                  >
                    {selected.detail}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
