'use client';
import React, { useState } from 'react';
import { Users, Clock, Calendar, Search, CheckCircle2, AlertCircle, Plus, Phone } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  role: 'doctor' | 'nurse' | 'support';
  specialty: string;
  ward: string;
  shift: 'morning' | 'afternoon' | 'night';
  status: 'on-duty' | 'off-duty' | 'on-call' | 'leave';
  since: string;
  phone: string;
}

const STAFF: StaffMember[] = [];

const STATUS_META = {
  'on-duty': { label: 'On Duty', color: '#22C55E' },
  'off-duty': { label: 'Off Duty', color: '#64748B' },
  'on-call': { label: 'On Call', color: '#F59E0B' },
  leave: { label: 'On Leave', color: '#A855F7' },
};

const ROLE_META = {
  doctor: { label: 'Doctor', color: '#EA580C' },
  nurse: { label: 'Nurse', color: '#3B82F6' },
  support: { label: 'Support', color: '#22C55E' },
};

export const StaffingOverview: React.FC = () => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'doctor' | 'nurse' | 'support'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on-duty' | 'off-duty' | 'on-call' | 'leave'>('all');

  const filtered = STAFF.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.ward.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const onDutyCount = STAFF.filter(s => s.status === 'on-duty').length;
  const doctorsOnDuty = STAFF.filter(s => s.status === 'on-duty' && s.role === 'doctor').length;
  const nursesOnDuty = STAFF.filter(s => s.status === 'on-duty' && s.role === 'nurse').length;
  const onCallCount = STAFF.filter(s => s.status === 'on-call').length;

  return (
    <div className="os-module-layout">

      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Total On Duty</span>
          <span className="metric-val">{onDutyCount}</span>
          <span className="metric-sub">Active staff across all wards</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Doctors On Duty</span>
          <span className="metric-val">{doctorsOnDuty}</span>
          <span className="metric-sub">Including residents & consultants</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Nurses On Duty</span>
          <span className="metric-val">{nursesOnDuty}</span>
          <span className="metric-sub">Ward & ICU nursing staff</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />On Call</span>
          <span className="metric-val">{onCallCount}</span>
          <span className="metric-sub">Available if needed</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="os-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input className="os-search-input" placeholder="Search staff name or ward..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'doctor', 'nurse', 'support'] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} className="os-ghost-btn"
              style={{ background: roleFilter === r ? 'rgba(234,88,12,0.15)' : undefined, borderColor: roleFilter === r ? '#EA580C' : undefined, color: roleFilter === r ? '#FB923C' : undefined }}>
              {r === 'all' ? 'All Roles' : ROLE_META[r].label}
            </button>
          ))}
        </div>
        <button className="os-action-btn-primary"><Plus size={14} /> Add Staff</button>
      </div>

      {/* Staff Table */}
      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Specialty</th>
              <th>Ward / Unit</th>
              <th>Shift</th>
              <th>Status</th>
              <th>On Since</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const stMeta = STATUS_META[s.status];
              const roleMeta = ROLE_META[s.role];
              return (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#64748B' }}>{s.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${roleMeta.color}25`, color: roleMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                        {s.name.split(' ').slice(-2).map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontWeight: 600, color: '#0A2540', fontSize: '0.88rem' }}>{s.name}</span>
                    </div>
                  </td>
                  <td><span style={{ background: `${roleMeta.color}20`, color: roleMeta.color, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{roleMeta.label}</span></td>
                  <td style={{ color: '#94A3B8', fontSize: '0.83rem' }}>{s.specialty}</td>
                  <td style={{ color: '#CBD5E1', fontSize: '0.83rem' }}>{s.ward}</td>
                  <td style={{ color: '#64748B', fontSize: '0.8rem', textTransform: 'capitalize' }}>{s.shift}</td>
                  <td><span style={{ background: `${stMeta.color}20`, color: stMeta.color, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{stMeta.label}</span></td>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#64748B' }}>{s.since}</td>
                  <td><a href={`tel:${s.phone}`} style={{ color: '#FB923C', fontSize: '0.78rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{s.phone}</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
