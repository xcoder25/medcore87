'use client';
import React, { useState } from 'react';
import { Shield, Lock, User, Plus, Search, Eye, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';

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

const STAFF_ACCESS: StaffAccess[] = [
  {
    id: 'ISH-EXEC-001', name: 'Dr. Evelyn Vance', role: 'Medical Director', department: 'Hospital Administration',
    clearance: 5, status: 'active', lastLogin: '16 Sep 2026 09:02',
    permissions: ['All Clinical', 'Finance & Billing', 'Staff Management', 'Audit Logs', 'System Admin'],
  },
  {
    id: 'ISH-SURG-042', name: 'Dr. Emeka Adeyemi', role: 'Consultant Surgeon', department: 'Surgical Ward',
    clearance: 4, status: 'active', lastLogin: '16 Sep 2026 07:05',
    permissions: ['Patient Records', 'Ward Operations', 'Drug Prescriptions', 'Theatre Booking'],
  },
  {
    id: 'ISH-NUR-118', name: 'Nurse Aisha Bello', role: 'Charge Nurse', department: 'Female Medical',
    clearance: 3, status: 'active', lastLogin: '16 Sep 2026 07:10',
    permissions: ['Patient Records (View)', 'Ward Operations', 'Nursing Notes', 'Bed Management'],
  },
  {
    id: 'ISH-REV-009', name: 'Amaka Oguike', role: 'Revenue Officer', department: 'Billing & Finance',
    clearance: 2, status: 'active', lastLogin: '16 Sep 2026 08:30',
    permissions: ['Billing & Invoicing', 'AKSHIA Claims', 'Revenue Reports'],
  },
  {
    id: 'ISH-LAB-023', name: 'Kelechi Obiora', role: 'Lab Technician', department: 'Medical Laboratory',
    clearance: 2, status: 'active', lastLogin: '15 Sep 2026 16:42',
    permissions: ['Lab Results Entry', 'Specimen Tracking'],
  },
  {
    id: 'ISH-PHAR-007', name: 'Funmi Adeola', role: 'Pharmacist', department: 'Pharmacy',
    clearance: 3, status: 'suspended', lastLogin: '12 Sep 2026 11:08',
    permissions: ['Pharmacy Dispensing', 'Drug Inventory'],
  },
  {
    id: 'ISH-ADM-044', name: 'Nnamdi Obi', role: 'Records Officer', department: 'Medical Records',
    clearance: 2, status: 'pending', lastLogin: 'Never',
    permissions: [],
  },
];

const CLEARANCE_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'L5 — Executive', color: '#EA580C' },
  4: { label: 'L4 — Senior Clinical', color: '#F59E0B' },
  3: { label: 'L3 — Clinical', color: '#22C55E' },
  2: { label: 'L2 — Support', color: '#3B82F6' },
  1: { label: 'L1 — Restricted', color: '#64748B' },
};

const STATUS_META = {
  active: { label: 'Active', color: '#22C55E' },
  suspended: { label: 'Suspended', color: '#EF4444' },
  pending: { label: 'Pending Activation', color: '#F59E0B' },
};

export const AccessControl: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StaffAccess | null>(null);

  const filtered = STAFF_ACCESS.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />Active Staff Accounts</span>
          <span className="metric-val">{STAFF_ACCESS.filter(s => s.status === 'active').length}</span>
          <span className="metric-sub">Across all departments</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><XCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Suspended Accounts</span>
          <span className="metric-val">{STAFF_ACCESS.filter(s => s.status === 'suspended').length}</span>
          <span className="metric-sub">Pending review or reinstatement</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label">Pending Activation</span>
          <span className="metric-val">{STAFF_ACCESS.filter(s => s.status === 'pending').length}</span>
          <span className="metric-sub">Awaiting admin approval</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Shield size={13} style={{ display: 'inline', marginRight: 4 }} />Total Permissions Granted</span>
          <span className="metric-val">{STAFF_ACCESS.flatMap(s => s.permissions).length}</span>
          <span className="metric-sub">Across {STAFF_ACCESS.length} staff accounts</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="os-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input className="os-search-input" placeholder="Search staff name, role or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="os-action-btn-primary"><Plus size={14} /> Create Account</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 20 }}>

        {/* Access Table */}
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
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const clr = CLEARANCE_LABELS[s.clearance];
                const stMeta = STATUS_META[s.status];
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(s)}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{s.id}</td>
                    <td style={{ fontWeight: 600, color: '#0A2540' }}>{s.name}</td>
                    <td style={{ color: '#94A3B8', fontSize: '0.83rem' }}>{s.role}</td>
                    <td style={{ color: '#94A3B8', fontSize: '0.82rem' }}>{s.department}</td>
                    <td><span style={{ background: `${clr.color}20`, color: clr.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{clr.label}</span></td>
                    <td><span style={{ background: `${stMeta.color}20`, color: stMeta.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{stMeta.label}</span></td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.75rem', color: '#64748B' }}>{s.lastLogin}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="os-ghost-btn" style={{ padding: '4px 8px' }}><Edit2 size={13} /></button>
                        <button className="os-ghost-btn" style={{ padding: '4px 8px' }}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="os-card" style={{ padding: 20, alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Access Profile</h4>
              <button className="os-ghost-btn" style={{ padding: '4px 8px' }} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(234,88,12,0.15)', color: '#FB923C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800 }}>
                  {selected.name.split(' ').slice(-2).map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0A2540' }}>{selected.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{selected.role}</div>
                </div>
              </div>
              {[
                { label: 'Badge ID', value: selected.id },
                { label: 'Department', value: selected.department },
                { label: 'Last Login', value: selected.lastLogin },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: '0.84rem', color: '#0A2540', fontFamily: item.label === 'Badge ID' ? 'var(--os-font-mono)' : undefined }}>{item.value}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 6 }}>GRANTED PERMISSIONS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.permissions.length > 0
                    ? selected.permissions.map(p => <span key={p} style={{ background: 'rgba(21,128,61,0.15)', color: '#22C55E', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>{p}</span>)
                    : <span style={{ color: '#64748B', fontSize: '0.8rem' }}>No permissions assigned</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="os-action-btn-primary" style={{ flex: 1, fontSize: '0.78rem' }}>Edit Permissions</button>
                {selected.status === 'active'
                  ? <button className="os-ghost-btn" style={{ flex: 1, fontSize: '0.78rem', color: '#EF4444' }}>Suspend</button>
                  : <button className="os-ghost-btn" style={{ flex: 1, fontSize: '0.78rem', color: '#22C55E' }}>Activate</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
