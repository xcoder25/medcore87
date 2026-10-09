'use client';

/**
 * Staffing & Rosters — Total on duty = live presence (logged in now).
 * Roster (enrolment) fills identity; online/offline from staffPresenceStore.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Clock, Search, Phone, RefreshCw } from 'lucide-react';
import { getStaffRegistry, getAccessRecords, subscribeAdminSync } from '../../lib/adminRealtimeStore';
import {
  listActiveStaff,
  listOfflineStaff,
  listFacilityPresence,
  subscribeStaffPresence,
  startFacilityPresenceListener,
  STAFF_PRESENCE_EVENT,
  type StaffPresence,
} from '../../lib/staffPresenceStore';
import type { UserSession } from '../auth/AuthScreen';

interface StaffRow {
  id: string;
  name: string;
  role: string;
  specialty: string;
  ward: string;
  shift: string;
  status: 'on-duty' | 'off-duty' | 'on-call' | 'leave';
  since: string;
  phone: string;
  fromPresence: boolean;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  'on-duty': { label: 'On duty (online)', color: '#16A34A' },
  'off-duty': { label: 'Off duty', color: '#64748B' },
  'on-call': { label: 'On call', color: '#F59E0B' },
  leave: { label: 'On leave', color: '#A855F7' },
};

const ROLE_META: Record<string, { label: string; color: string }> = {
  doctor: { label: 'Doctor', color: '#EA580C' },
  nurse: { label: 'Nurse', color: '#3B82F6' },
  support: { label: 'Support', color: '#22C55E' },
  reception: { label: 'Reception', color: '#0D9488' },
  pharmacist: { label: 'Pharmacy', color: '#7C3AED' },
  lab: { label: 'Lab', color: '#0891B2' },
  hospital_admin: { label: 'Admin', color: '#0052D4' },
  accountant: { label: 'Accounts', color: '#D97706' },
  cashier: { label: 'Cashier', color: '#D97706' },
};

function normalizeRole(roleKey?: string, role?: string): string {
  const s = `${roleKey || ''} ${role || ''}`.toLowerCase();
  if (s.includes('doctor') || s.includes('physician') || s.includes('consultant')) return 'doctor';
  if (s.includes('nurse') || s.includes('midwife')) return 'nurse';
  if (s.includes('reception') || s.includes('front')) return 'reception';
  if (s.includes('pharm')) return 'pharmacist';
  if (s.includes('lab') || s.includes('pathol')) return 'lab';
  if (s.includes('account') || s.includes('cashier') || s.includes('finance')) return 'accountant';
  if (s.includes('admin')) return 'hospital_admin';
  return (roleKey || role || 'support').toLowerCase().replace(/\s+/g, '_');
}

function formatSince(ts: number): string {
  if (!ts) return '—';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleString();
}

function buildRows(facilityId: string): StaffRow[] {
  const fid = facilityId || 'IGH-EKT';
  const online = listActiveStaff(fid);
  const onlineIds = new Set(online.map((p) => p.badgeId.toUpperCase()));

  const reg = (getStaffRegistry() as any[]) || [];
  const access = getAccessRecords() || [];
  const byId = new Map<string, any>();

  for (const s of reg) {
    const id = String(s.badgeId || s.id || '')
      .toUpperCase()
      .replace(/\s+/g, '');
    if (id) byId.set(id, s);
  }
  for (const a of access) {
    const id = String(a.id || '')
      .toUpperCase()
      .replace(/\s+/g, '');
    if (id && !byId.has(id)) byId.set(id, a);
  }

  const rows: StaffRow[] = [];

  // 1) Online presence — only if still on facility roster/access (deleted staff excluded)
  for (const p of online) {
    const meta = byId.get(p.badgeId.toUpperCase());
    if (!meta) continue; // deleted from facility — ignore ghost presence
    rows.push({
      id: p.badgeId,
      name: p.name || meta.name || p.badgeId,
      role: normalizeRole(p.roleKey || meta.roleKey, p.role || meta.role),
      specialty: meta.specialty || meta.department || p.role || p.roleKey || '—',
      ward: meta.ward || meta.department || '—',
      shift: meta.shift || 'Live shift',
      status: 'on-duty',
      since: formatSince(p.lastSeen),
      phone: meta.phone || '—',
      fromPresence: true,
    });
  }

  // 2) Roster / access not online → off-duty (or leave if flagged)
  for (const [id, meta] of byId) {
    if (onlineIds.has(id)) continue;
    const st = String(meta.status || '').toLowerCase();
    if (st === 'suspended' || st === 'pending') continue;
    const leave = st === 'on-leave' || st === 'leave';
    rows.push({
      id,
      name: meta.name || meta.fullName || id,
      role: normalizeRole(meta.roleKey, meta.role),
      specialty: meta.specialty || meta.department || meta.role || '—',
      ward: meta.ward || meta.department || '—',
      shift: meta.shift || '—',
      status: leave ? 'leave' : 'off-duty',
      since: formatSince(0),
      phone: meta.phone || '—',
      fromPresence: false,
    });
  }

  // Ghost presence (no roster) intentionally omitted — deleted staff must not reappear

  return rows.sort((a, b) => {
    if (a.status === 'on-duty' && b.status !== 'on-duty') return -1;
    if (b.status === 'on-duty' && a.status !== 'on-duty') return 1;
    return a.name.localeCompare(b.name);
  });
}

interface Props {
  session?: UserSession | null;
}

export const StaffingOverview: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on-duty' | 'off-duty' | 'leave'>('all');
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    setStaff(buildRows(facilityId));
    setTick((n) => n + 1);
  }, [facilityId]);

  useEffect(() => {
    reload();
    const u1 = subscribeAdminSync(reload);
    const u2 = subscribeStaffPresence(reload);
    const stopCloud = startFacilityPresenceListener(facilityId);
    const bump = () => reload();
    window.addEventListener(STAFF_PRESENCE_EVENT, bump);
    window.addEventListener('medcore-admin-sync', bump);
    window.addEventListener('storage', bump);
    window.addEventListener('medcore-facility-cloud', bump);
    const iv = window.setInterval(reload, 10000);
    return () => {
      u1();
      u2();
      stopCloud();
      window.removeEventListener(STAFF_PRESENCE_EVENT, bump);
      window.removeEventListener('medcore-admin-sync', bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('medcore-facility-cloud', bump);
      window.clearInterval(iv);
    };
  }, [facilityId, reload]);

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.ward.toLowerCase().includes(q) &&
          !s.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [staff, roleFilter, statusFilter, search]);

  const onDuty = staff.filter((s) => s.status === 'on-duty');
  const doctorsOnDuty = onDuty.filter((s) => s.role === 'doctor').length;
  const nursesOnDuty = onDuty.filter((s) => s.role === 'nurse').length;
  const offDuty = staff.filter((s) => s.status === 'off-duty').length;

  const roleOptions = useMemo(() => {
    const set = new Set(staff.map((s) => s.role));
    return ['all', ...Array.from(set).sort()];
  }, [staff]);

  return (
    <div className="os-module-layout" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0F172A' }}>Staffing · on duty</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Live presence for {session?.facility || facilityId} · same signal as Active Staff
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            background: '#fff',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            color: '#0F172A',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label">
            <Users size={13} style={{ display: 'inline', marginRight: 4 }} /> Total on duty
          </span>
          <span className="metric-val">{onDuty.length}</span>
          <span className="metric-sub">Logged in now · live</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Doctors on duty</span>
          <span className="metric-val">{doctorsOnDuty}</span>
          <span className="metric-sub">Online clinicians</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Nurses on duty</span>
          <span className="metric-val">{nursesOnDuty}</span>
          <span className="metric-sub">Online nurses</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">
            <Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> Off duty
          </span>
          <span className="metric-val">{offDuty}</span>
          <span className="metric-sub">Roster not online</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            background: '#fff',
            flex: '1 1 200px',
          }}
        >
          <Search size={16} color="#64748B" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, ward…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'on-duty', 'off-duty', 'leave'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: statusFilter === st ? 'none' : '1px solid #E2E8F0',
                background: statusFilter === st ? 'linear-gradient(135deg,#0052D4,#0D9488)' : '#fff',
                color: statusFilter === st ? '#fff' : '#0F172A',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {st === 'all' ? 'All status' : STATUS_META[st]?.label || st}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {roleOptions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: roleFilter === r ? 'none' : '1px solid #E2E8F0',
                background: roleFilter === r ? 'rgba(0,82,212,0.1)' : '#fff',
                color: '#0F172A',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {r === 'all' ? 'All roles' : ROLE_META[r]?.label || r}
            </button>
          ))}
        </div>
      </div>

      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Specialty / unit</th>
              <th>Ward</th>
              <th>Shift</th>
              <th>Status</th>
              <th>Last seen</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: '#64748B' }}>
                  {staff.length === 0
                    ? 'No presence or roster yet. Staff appear here when they log in, or after enrolment.'
                    : 'No rows match this filter.'}
                </td>
              </tr>
            )}
            {filtered.map((s) => {
              const st = STATUS_META[s.status] || { label: s.status, color: '#64748B' };
              const rl = ROLE_META[s.role] || { label: s.role, color: '#64748B' };
              return (
                <tr key={`${s.id}-${s.status}`}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem' }}>{s.id}</td>
                  <td style={{ fontWeight: 600 }}>
                    {s.status === 'on-duty' && (
                      <span style={{ color: '#16A34A', marginRight: 6 }} title="Online">
                        ●
                      </span>
                    )}
                    {s.name}
                  </td>
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
      <div style={{ fontSize: 11, color: '#94A3B8' }}>
        Snapshot #{tick} · on duty = active login heartbeat for this facility (not full HR headcount)
      </div>
    </div>
  );
};

export default StaffingOverview;
