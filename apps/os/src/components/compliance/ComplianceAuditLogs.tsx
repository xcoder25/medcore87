'use client';
import React, { useState } from 'react';
import { FileText, Search, Download, CheckCircle2, AlertCircle, Clock, Filter, Shield } from 'lucide-react';

type AuditCategory = 'clinical' | 'financial' | 'access' | 'pharmacy' | 'records';

interface AuditEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  action: string;
  performedBy: string;
  badgeId: string;
  ward: string;
  detail: string;
  severity: 'normal' | 'notable' | 'critical';
  patientId?: string;
}

const AUDIT_LOG: AuditEntry[] = [
  { id: 'AUD-9901', timestamp: '16 Sep 09:14', category: 'clinical', action: 'Patient Record Viewed', performedBy: 'Dr. Nkechi Bassey', badgeId: 'ISH-MED-019', ward: 'Male Medical', detail: 'Viewed full treatment history for patient PT-4880 (Chidi Okonkwo)', severity: 'normal', patientId: 'PT-4880' },
  { id: 'AUD-9900', timestamp: '16 Sep 09:08', category: 'access', action: 'Permission Override Used', performedBy: 'Dr. Evelyn Vance', badgeId: 'ISH-EXEC-001', ward: 'Administration', detail: 'Executive override to access restricted audit log AUD-0081 (Finance review)', severity: 'notable' },
  { id: 'AUD-9899', timestamp: '16 Sep 08:55', category: 'access', action: 'Failed Login (Lockout)', performedBy: 'Unknown', badgeId: 'ISH-ADM-044', ward: 'Records Office', detail: '3 consecutive failed login attempts — account in pending status', severity: 'critical' },
  { id: 'AUD-9898', timestamp: '16 Sep 08:30', category: 'financial', action: 'Bill Payment Collected', performedBy: 'Amaka Oguike', badgeId: 'ISH-REV-009', ward: 'Billing Office', detail: '₦42,000 collected for BL-8828 (Grace Udoh) — POS Payment', severity: 'normal', patientId: 'PT-4878' },
  { id: 'AUD-9897', timestamp: '16 Sep 08:22', category: 'pharmacy', action: 'Drug Dispensed', performedBy: 'Funmi Adeola', badgeId: 'ISH-PHAR-007', ward: 'Pharmacy', detail: 'IV Artesunate 3mg/kg dispensed for patient PT-4888 (Ekpenyong Sunday, Paediatric)', severity: 'normal', patientId: 'PT-4888' },
  { id: 'AUD-9896', timestamp: '16 Sep 08:05', category: 'clinical', action: 'Discharge Processed', performedBy: 'Dr. Emeka Adeyemi', badgeId: 'ISH-SURG-042', ward: 'Surgical Ward', detail: 'Patient PT-4874 (Akon Effiong) discharged post-appendicectomy — reviewed and signed', severity: 'normal', patientId: 'PT-4874' },
  { id: 'AUD-9895', timestamp: '16 Sep 07:50', category: 'records', action: 'Record Modified', performedBy: 'Nurse Aisha Bello', badgeId: 'ISH-NUR-118', ward: 'Female Medical', detail: 'Nursing notes updated for PT-4880 — added vital signs 07:45 reading', severity: 'normal', patientId: 'PT-4880' },
  { id: 'AUD-9894', timestamp: '16 Sep 07:30', category: 'pharmacy', action: 'Stock Level Alert', performedBy: 'System', badgeId: 'SYS-AUTO', ward: 'Pharmacy', detail: 'Insulin stock dropped below 20% threshold — automated procurement alert raised', severity: 'notable' },
];

const CATEGORY_META: Record<AuditCategory, { label: string; color: string }> = {
  clinical: { label: 'Clinical', color: '#22C55E' },
  financial: { label: 'Financial', color: '#EA580C' },
  access: { label: 'Access Control', color: '#A855F7' },
  pharmacy: { label: 'Pharmacy', color: '#3B82F6' },
  records: { label: 'Records', color: '#F59E0B' },
};

const SEVERITY_META = {
  normal: { label: 'Normal', color: '#64748B' },
  notable: { label: 'Notable', color: '#F59E0B' },
  critical: { label: 'Critical', color: '#EF4444' },
};

export const ComplianceAuditLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<AuditCategory | 'all'>('all');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const filtered = AUDIT_LOG.filter(e => {
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    if (search && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.performedBy.toLowerCase().includes(search.toLowerCase()) && !e.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><FileText size={13} style={{ display: 'inline', marginRight: 4 }} />Total Audit Entries (Today)</span>
          <span className="metric-val">{AUDIT_LOG.length}</span>
          <span className="metric-sub">All modules logged</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Critical Events</span>
          <span className="metric-val">{AUDIT_LOG.filter(e => e.severity === 'critical').length}</span>
          <span className="metric-sub">Require security review</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label">Notable Events</span>
          <span className="metric-val">{AUDIT_LOG.filter(e => e.severity === 'notable').length}</span>
          <span className="metric-sub">Flagged for review</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Shield size={13} style={{ display: 'inline', marginRight: 4 }} />Compliance Score</span>
          <span className="metric-val">97.4%</span>
          <span className="metric-sub">vs 95% national benchmark</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="os-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input className="os-search-input" placeholder="Search audit logs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'clinical', 'financial', 'access', 'pharmacy', 'records'] as const).map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)} className="os-ghost-btn"
              style={{ background: catFilter === cat ? 'rgba(234,88,12,0.15)' : undefined, borderColor: catFilter === cat ? '#EA580C' : undefined, color: catFilter === cat ? '#FB923C' : undefined, fontSize: '0.78rem' }}>
              {cat === 'all' ? 'All Categories' : CATEGORY_META[cat].label}
            </button>
          ))}
        </div>
        <button className="os-ghost-btn"><Download size={14} /> Export CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>

        {/* Log Table */}
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Action</th>
                <th>Performed By</th>
                <th>Ward</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const catMeta = CATEGORY_META[e.category];
                const sevMeta = SEVERITY_META[e.severity];
                const isSelected = selected?.id === e.id;
                return (
                  <tr key={e.id} onClick={() => setSelected(isSelected ? null : e)} style={{ cursor: 'pointer', background: isSelected ? 'rgba(234,88,12,0.05)' : undefined }}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{e.id}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#94A3B8' }}>{e.timestamp}</td>
                    <td><span style={{ background: `${catMeta.color}15`, color: catMeta.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{catMeta.label}</span></td>
                    <td style={{ color: '#0A2540', fontSize: '0.85rem', fontWeight: 600 }}>{e.action}</td>
                    <td style={{ color: '#CBD5E1', fontSize: '0.83rem' }}>{e.performedBy}</td>
                    <td style={{ color: '#94A3B8', fontSize: '0.82rem' }}>{e.ward}</td>
                    <td><span style={{ color: sevMeta.color, fontSize: '0.8rem', fontWeight: 600 }}>{sevMeta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        {selected && (
          <div className="os-card" style={{ padding: 20, alignSelf: 'flex-start', borderColor: SEVERITY_META[selected.severity].color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Audit Record</h4>
              <button className="os-ghost-btn" style={{ padding: '4px 8px' }} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Audit ID', value: selected.id, mono: true },
                { label: 'Timestamp', value: selected.timestamp, mono: true },
                { label: 'Action', value: selected.action },
                { label: 'Performed By', value: `${selected.performedBy} (${selected.badgeId})` },
                { label: 'Ward / Unit', value: selected.ward },
                { label: 'Patient ID', value: selected.patientId || 'N/A', mono: true },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#0A2540', fontFamily: item.mono ? 'var(--os-font-mono)' : undefined }}>{item.value}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 6 }}>DETAIL</div>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#CBD5E1', lineHeight: 1.5, background: '#F8FAFC', padding: 10, borderRadius: 8 }}>
                  {selected.detail}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ background: `${CATEGORY_META[selected.category].color}15`, color: CATEGORY_META[selected.category].color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 9999 }}>
                  {CATEGORY_META[selected.category].label}
                </span>
                <span style={{ background: `${SEVERITY_META[selected.severity].color}15`, color: SEVERITY_META[selected.severity].color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 9999 }}>
                  {SEVERITY_META[selected.severity].label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
