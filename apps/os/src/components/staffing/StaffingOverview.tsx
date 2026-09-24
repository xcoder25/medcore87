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

const STAFF: StaffMember[] = [
  { id: 'DOC-042', name: 'Dr. Emeka Adeyemi', role: 'doctor', specialty: 'General Surgery', ward: 'Surgical Ward', shift: 'morning', status: 'on-duty', since: '07:00', phone: '0803-XXX-1042' },
  { id: 'DOC-019', name: 'Dr. Nkechi Bassey', role: 'doctor', specialty: 'Internal Medicine', ward: 'Male Medical', shift: 'morning', status: 'on-duty', since: '07:00', phone: '0805-XXX-1019' },
  { id: 'DOC-033', name: 'Dr. Abosede Okafor', role: 'doctor', specialty: 'Paediatrics', ward: 'Paediatric Ward', shift: 'morning', status: 'on-duty', since: '07:30', phone: '0808-XXX-1033' },
  { id: 'DOC-055', name: 'Dr. Uche Ekpo', role: 'doctor', specialty: 'Obstetrics & Gynaecology', ward: 'O&G Ward', shift: 'morning', status: 'on-duty', since: '07:00', phone: '0701-XXX-1055' },
  { id: 'DOC-012', name: 'Dr. Chukwuma Nwachukwu', role: 'doctor', specialty: 'Emergency Medicine', ward: 'A&E', shift: 'morning', status: 'on-duty', since: '08:00', phone: '0806-XXX-1012' },
  { id: 'DOC-028', name: 'Dr. Iniobong Edem', role: 'doctor', specialty: 'Intensive Care (ICU)', ward: 'ICU', shift: 'morning', status: 'on-call', since: '07:00', phone: '0812-XXX-1028' },
  { id: 'DOC-041', name: 'Dr. Femi Lawal', role: 'doctor', specialty: 'Orthopaedics', ward: 'Orthopaedic Ward', shift: 'afternoon', status: 'off-duty', since: '15:00', phone: '0703-XXX-1041' },
  { id: 'DOC-009', name: 'Dr. Chiamaka Ogbu', role: 'doctor', specialty: 'Ophthalmology', ward: 'Outpatient Clinic', shift: 'morning', status: 'leave', since: '—', phone: '0802-XXX-1009' },
  { id: 'NUR-118', name: 'Nurse Aisha Bello', role: 'nurse', specialty: 'Ward Charge Nurse', ward: 'Female Medical', shift: 'morning', status: 'on-duty', since: '07:00', phone: '0805-XXX-2118' },
  { id: 'NUR-204', name: 'Nurse Efua Mensah', role: 'nurse', specialty: 'ICU Critical Care', ward: 'ICU', shift: 'morning', status: 'on-duty', since: '07:00', phone: '0703-XXX-2204' },
  { id: 'NUR-087', name: 'Nurse Grace Obi', role: 'nurse', specialty: 'Neonatal Nursing', ward: 'NICU', shift: 'morning', status: 'on-duty', since: '07:00', phone: '0806-XXX-2087' },
  { id: 'NUR-156', name: 'Nurse Blessing Udoh', role: 'nurse', specialty: 'Theatre / Scrub Nurse', ward: 'Operating Theatre', shift: 'morning', status: 'on-duty', since: '07:30', phone: '0812-XXX-2156' },
  { id: 'SPT-301', name: 'Amara Onyekwere', role: 'support', specialty: 'Medical Lab Technician', ward: 'Laboratory', shift: 'morning', status: 'on-duty', since: '08:00', phone: '0701-XXX-3301' },
  { id: 'SPT-302', name: 'Kelechi Obiora', role: 'support', specialty: 'Radiology Technician', ward: 'Radiology / X-Ray', shift: 'morning', status: 'on-duty', since: '08:00', phone: '0802-XXX-3302' },
];

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
