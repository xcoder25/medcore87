'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  getAccessRecords,
  approveAccess,
  suspendAccess,
  reactivateAccess,
  subscribeAdminSync,
  type AccessRecord,
} from '../../lib/adminRealtimeStore';
import { Shield, Plus, Search, Eye, Edit2, CheckCircle2, XCircle, Lock } from 'lucide-react';

interface StaffAccess {
  id: string;
  name: string;
  role: string;
  department: string;
  clearance: number;
  status: 'active' | 'suspended' | 'pending';
  lastLogin: string;
  permissions: string[];
}

const SEED_STAFF_ACCESS: StaffAccess[] = [];

const CLEARANCE_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'L5 — Executive', color: '#EA580C' },
  4: { label: 'L4 — Senior Clinical', color: '#F59E0B' },
  3: { label: 'L3 — Clinical', color: '#16A34A' },
  2: { label: 'L2 — Support', color: '#0066FF' },
  1: { label: 'L1 — Restricted', color: '#64748B' },
};

const STATUS_META = {
  active: { label: 'Active', color: '#16A34A' },
  suspended: { label: 'Suspended', color: '#EF4444' },
  pending: { label: 'Pending', color: '#EA580C' },
};

export const AccessControl: React.FC = () => {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const reload = useCallback(() => {
    setRecords(getAccessRecords() as AccessRecord[]);
  }, []);
  useEffect(() => {
    reload();
    return subscribeAdminSync(reload);
  }, [reload]);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StaffAccess | null>(null);

  const filtered = records.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="os-module-layout">
      <div className="os-insight-banner">
        <Shield size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>
            Access control · Zero-trust IAM
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            Role and clearance govern clinical APIs, AI actions, and audit visibility. Suspended accounts cannot reach the event bus.
          </div>
        </div>
      </div>

      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />Active accounts</span>
          <span className="metric-val">{records.filter(s => s.status === 'active').length}</span>
          <span className="metric-sub">Across all departments</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><XCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Suspended</span>
          <span className="metric-val">{records.filter(s => s.status === 'suspended').length}</span>
          <span className="metric-sub">Pending review</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label">Pending activation</span>
          <span className="metric-val">{records.filter(s => s.status === 'pending').length}</span>
          <span className="metric-sub">Awaiting admin approval</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Lock size={13} style={{ display: 'inline', marginRight: 4 }} />Permissions granted</span>
          <span className="metric-val">{records.flatMap(s => s.permissions).length}</span>
          <span className="metric-sub">Across {records.length} staff</span>
        </div>
      </div>

      <div className="os-toolbar">
        <div className="os-search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <Search size={14} />
          <input
            className="os-search-input"
            placeholder="Search name, role or staff ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="os-action-btn-primary">
          <Plus size={14} /> Create account
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 18 }}>
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                <th>Clearance</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const clr = CLEARANCE_LABELS[s.clearance];
                const stMeta = STATUS_META[s.status];
                const isSel = selected?.id === s.id;
                return (
                  <tr
                    key={s.id}
                    style={{
                      cursor: 'pointer',
                      background: isSel ? 'rgba(0,102,255,0.04)' : undefined,
                    }}
                    onClick={() => setSelected(s)}
                  >
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>{s.id}</td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>{s.name}</td>
                    <td style={{ color: '#475569', fontSize: '0.83rem' }}>{s.role}</td>
                    <td style={{ color: '#64748B', fontSize: '0.82rem' }}>{s.department}</td>
                    <td>
                      <span style={{
                        background: `${clr.color}14`,
                        color: clr.color,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 9999,
                        border: `1px solid ${clr.color}28`,
                      }}>
                        {clr.label}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: `${stMeta.color}14`,
                        color: stMeta.color,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 9999,
                        border: `1px solid ${stMeta.color}28`,
                      }}>
                        {stMeta.label}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.72rem', color: '#64748B' }}>{s.lastLogin}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button type="button" className="os-ghost-btn" style={{ padding: '5px 8px' }} title="Edit"><Edit2 size={13} /></button>
                        <button type="button" className="os-ghost-btn" style={{ padding: '5px 8px' }} title="View" onClick={() => setSelected(s)}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="os-card" style={{ padding: 20, alignSelf: 'flex-start', borderColor: 'rgba(0,102,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 750, color: '#0F172A', fontFamily: 'var(--os-font-heading)' }}>
                Access profile
              </h4>
              <button type="button" className="os-ghost-btn" style={{ padding: '4px 10px' }} onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0066FF, #00D4A8)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(0,102,255,0.3)',
              }}>
                {selected.name.split(' ').slice(-2).map(n => n[0]).join('')}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{selected.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{selected.role}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Badge ID', value: selected.id },
                { label: 'Department', value: selected.department },
                { label: 'Clearance', value: CLEARANCE_LABELS[selected.clearance].label },
                { label: 'Last login', value: selected.lastLogin },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: 2, fontWeight: 600, letterSpacing: '0.04em' }}>{item.label}</div>
                  <div style={{
                    fontSize: '0.84rem',
                    color: '#0F172A',
                    fontFamily: item.label === 'Badge ID' ? 'var(--os-font-mono)' : undefined,
                    fontWeight: item.label === 'Badge ID' ? 600 : 500,
                  }}>
                    {item.value}
                  </div>
                </div>
              ))}

              <div>
                <div style={{ fontSize: '0.68rem', color: '#64748B', marginBottom: 8, fontWeight: 700, letterSpacing: '0.05em' }}>
                  GRANTED PERMISSIONS
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.permissions.length > 0
                    ? selected.permissions.map(p => (
                      <span
                        key={p}
                        style={{
                          background: 'rgba(22,163,74,0.1)',
                          color: '#16A34A',
                          fontSize: '0.7rem',
                          padding: '4px 10px',
                          borderRadius: 9999,
                          fontWeight: 600,
                          border: '1px solid rgba(22,163,74,0.22)',
                        }}
                      >
                        {p}
                      </span>
                    ))
                    : <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>No permissions assigned</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="os-action-btn-primary" style={{ flex: 1, fontSize: '0.78rem' }}>
                  Edit permissions
                </button>
                {selected.status === 'active' ? (
                  <button type="button" className="os-ghost-btn" style={{ flex: 1, fontSize: '0.78rem', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    onClick={() => { suspendAccess(selected.id); setSelected(null); reload(); }}>
                    Suspend
                  </button>
                ) : selected.status === 'pending' ? (
                  <button type="button" className="os-ghost-btn" style={{ flex: 1, fontSize: '0.78rem', color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)' }}
                    onClick={() => { approveAccess(selected.id); setSelected(null); reload(); }}>
                    Approve access
                  </button>
                ) : (
                  <button type="button" className="os-ghost-btn" style={{ flex: 1, fontSize: '0.78rem', color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)' }}
                    onClick={() => { reactivateAccess(selected.id); setSelected(null); reload(); }}>
                    Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
