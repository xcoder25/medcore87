'use client';

/**
 * Staffing & Rosters — live from enrolled staff registry only (no mock roster).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Users, Clock, Calendar, Search, Plus, Phone } from 'lucide-react';
import { getStaffRegistry, subscribeAdminSync } from '../../lib/adminRealtimeStore';

interface StaffMember {
  id: string;
  name: string;
  role: 'doctor' | 'nurse' | 'support' | string;
  specialty: string;
  ward: string;
  shift: 'morning' | 'afternoon' | 'night' | string;
  status: 'on-duty' | 'off-duty' | 'on-call' | 'leave' | 'active' | string;
  since: string;
  phone: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  'on-duty': { label: 'On Duty', color: '#22C55E' },
  active: { label: 'Active', color: '#22C55E' },
  'off-duty': { label: 'Off Duty', color: '#64748B' },
  'on-call': { label: 'On Call', color: '#F59E0B' },
  leave: { label: 'On Leave', color: '#A855F7' },
};

const ROLE_META: Record<string, { label: string; color: string }> = {
  doctor: { label: 'Doctor', color: '#EA580C' },
  nurse: { label: 'Nurse', color: '#3B82F6' },
  support: { label: 'Support', color: '#22C55E' },
  reception: { label: 'Reception', color: '#0D9488' },
  pharmacist: { label: 'Pharmacy', color: '#7C3AED' },
  lab: { label: 'Lab', color: '#0891B2' },
};

function mapRegistry(): StaffMember[] {
  const reg = getStaffRegistry() as any[];
  if (!Array.isArray(reg) || reg.length === 0) return [];
  return reg.map((s) => ({
    id: s.badgeId || s.id || '—',
    name: s.name || s.fullName || 'Staff',
    role: (s.roleKey || s.role || 'support').toLowerCase().includes('doctor')
      ? 'doctor'
      : (s.roleKey || s.role || '').toLowerCase().includes('nurse')
        ? 'nurse'
        : (s.roleKey || s.role || 'support').toLowerCase(),
    specialty: s.specialty || s.department || s.role || '—',
    ward: s.ward || s.department || '—',
    shift: s.shift || '—',
    status: s.status === 'active' || !s.status ? 'on-duty' : s.status,
    since: s.since || s.lastLogin || '—',
    phone: s.phone || '—',
  }));
}

export const StaffingOverview: React.FC = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');

  const reload = useCallback(() => setStaff(mapRegistry()), []);

  useEffect(() => {
    reload();
    return subscribeAdminSync(reload);
  }, [reload]);

  const filtered = staff.filter((s) => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (
      search &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.ward.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const onDutyCount = staff.filter((s) => s.status === 'on-duty' || s.status === 'active').length;
  const doctorsOnDuty = staff.filter(
    (s) => (s.status === 'on-duty' || s.status === 'active') && s.role === 'doctor'
  ).length;
  const nursesOnDuty = staff.filter(
    (s) => (s.status === 'on-duty' || s.status === 'active') && s.role === 'nurse'
  ).length;
  const onCallCount = staff.filter((s) => s.status === 'on-call').length;

  return (
    <div className="os-module-layout" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label">
            <Users size={13} style={{ display: 'inline', marginRight: 4 }} /> Total on duty
          </span>
          <span className="metric-val">{onDutyCount}</span>
          <span className="metric-sub">From enrolled staff only</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Doctors on duty</span>
          <span className="metric-val">{doctorsOnDuty}</span>
          <span className="metric-sub">Enrolled doctors</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Nurses on duty</span>
          <span className="metric-val">{nursesOnDuty}</span>
          <span className="metric-sub">Enrolled nurses</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">
            <Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> On call
          </span>
          <span className="metric-val">{onCallCount}</span>
          <span className="metric-sub">Available if needed</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999, padding: '8px 14px' }}>
          <Search size={15} color="#94A3B8" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff name or ward..."
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.88rem' }}
          />
        </div>
        {(['all', 'doctor', 'nurse', 'support'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className="os-ghost-btn"
            onClick={() => setRoleFilter(r)}
            style={{
              borderColor: roleFilter === r ? '#0052D4' : undefined,
              color: roleFilter === r ? '#0052D4' : undefined,
              background: roleFilter === r ? 'rgba(0,82,212,0.08)' : undefined,
            }}
          >
            {r === 'all' ? 'All roles' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Specialty</th>
              <th>Ward / unit</th>
              <th>Shift</th>
              <th>Status</th>
              <th>On since</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: '#64748B' }}>
                  No staff on roster yet. Enrol staff under <strong>Staff Enrolment &amp; ID</strong> — this list stays empty until then (no demo data).
                </td>
              </tr>
            )}
            {filtered.map((s) => {
              const st = STATUS_META[s.status] || { label: s.status, color: '#64748B' };
              const rl = ROLE_META[s.role] || { label: s.role, color: '#64748B' };
              return (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem' }}>{s.id}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <span style={{ color: rl.color, fontWeight: 700, fontSize: '0.78rem' }}>{rl.label}</span>
                  </td>
                  <td>{s.specialty}</td>
                  <td>{s.ward}</td>
                  <td>{s.shift}</td>
                  <td>
                    <span style={{ color: st.color, fontWeight: 700, fontSize: '0.78rem' }}>{st.label}</span>
                  </td>
                  <td>{s.since}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} /> {s.phone}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffingOverview;
