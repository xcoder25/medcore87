'use client';

/**
 * Staffing & Rosters — Total on duty = live presence (logged in now).
 * Roster (enrolment) fills identity; online/offline from staffPresenceStore.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';
import { Users, Clock, Search, Phone, RefreshCw, Sparkles, Brain, AlertTriangle } from 'lucide-react';
import {
  formatExactLastSeen,
  analyzeStaffRosterIntelligence,
  generateAiRosterBriefing,
} from '../../lib/staffPresenceIntelligence';

function offDutyLastSeen(storedTs?: number, lastLogin?: unknown) {
  const parsed = lastLogin && lastLogin !== 'Never' ? Date.parse(String(lastLogin)) : 0;
  const raw = storedTs || (Number.isFinite(parsed) ? parsed : 0) || 0;
  const fmt = formatExactLastSeen(raw);
  return { raw, ...fmt };
}
import { getStaffRegistry, getAccessRecords, subscribeAdminSync } from '../../lib/adminRealtimeStore';
import { listStaffCards, syncAccessRosterFromSources } from '../../lib/staffCardStore';
import {
  listActiveStaff,
  listOfflineStaff,
  listFacilityPresence,
  subscribeStaffPresence,
  startFacilityPresenceListener,
  isStaffRevokedLocal,
  isStaffNameHidden,
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
  exactLastSeen: string;
  relativeLastSeen: string;
  lastSeenMs: number;
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

function sameFacility(rowFid: string, facilityId: string): boolean {
  const a = String(rowFid || '').toUpperCase().replace(/\s+/g, '');
  const b = String(facilityId || '').toUpperCase().replace(/\s+/g, '');
  if (!b) return true;
  if (!a) return true; // legacy rows without facility still show for this desk
  return a === b;
}

function buildRows(facilityId: string): StaffRow[] {
  const fid = facilityId || 'IGH-EKT';
  const online = listActiveStaff(fid);
  const presenceById = new Map<string, StaffPresence>();
  for (const pr of listFacilityPresence(fid)) {
    const pid = String(pr.badgeId || '').toUpperCase().replace(/\s+/g, '');
    if (!pid) continue;
    const prev = presenceById.get(pid);
    if (!prev || (pr.lastSeen || 0) > (prev.lastSeen || 0)) presenceById.set(pid, pr);
  }
  const onlineIds = new Set(online.map((p) => String(p.badgeId || '').toUpperCase()));

  const reg = (getStaffRegistry() as any[]) || [];
  const access = getAccessRecords() || [];
  const cards = listStaffCards();
  const byId = new Map<string, any>();

  const ingest = (s: any, source: string) => {
    const id = String(s.badgeId || s.id || '')
      .toUpperCase()
      .replace(/\s+/g, '');
    if (!id) return;
    const rowFid = String(s.hospitalId || s.facilityId || '');
    if (!sameFacility(rowFid, fid)) return;
    const prev = byId.get(id) || {};
    byId.set(id, {
      ...prev,
      ...s,
      badgeId: id,
      name: s.name || s.fullName || prev.name || id,
      role: s.role || s.shortRole || prev.role,
      roleKey: s.roleKey || prev.roleKey,
      department: s.department || prev.department,
      specialty: s.specialty || prev.specialty,
      ward: s.ward || prev.ward,
      phone: s.phone || prev.phone,
      status: s.status || prev.status || 'active',
      _source: source,
    });
  };

  for (const s of reg) ingest(s, 'registry');
  for (const a of access) ingest({ ...a, badgeId: a.id }, 'access');
  for (const c of cards) {
    ingest(
      {
        badgeId: c.badgeId,
        fullName: c.fullName,
        name: c.fullName,
        role: c.role,
        roleKey: c.roleKey,
        department: c.department,
        facilityId: c.facilityId,
        hospitalId: c.facilityId,
        status: c.status === 'ACTIVE' ? 'active' : String(c.status || 'active').toLowerCase(),
        phone: (c as any).phone,
      },
      'card'
    );
  }

  const rows: StaffRow[] = [];

  // 1) Online presence — show active staff (skip only if explicitly revoked or hidden)
  for (const p of online) {
    const bid = String(p.badgeId || '').toUpperCase();
    if (isStaffRevokedLocal(bid, fid) || isStaffNameHidden(fid, p.name)) continue;
    const meta = byId.get(bid);
    rows.push({
      id: p.badgeId,
      name: p.name || meta?.name || p.badgeId,
      role: normalizeRole(p.roleKey || meta?.roleKey, p.role || meta?.role),
      specialty: meta?.specialty || meta?.department || p.role || p.roleKey || '—',
      ward: meta?.ward || meta?.department || '—',
      shift: meta?.shift || 'Live shift',
      status: 'on-duty',
      since: formatExactLastSeen(p.lastSeen).exactDateTime,
      exactLastSeen: formatExactLastSeen(p.lastSeen).exactDateTime,
      relativeLastSeen: formatExactLastSeen(p.lastSeen).relative,
      lastSeenMs: p.lastSeen || 0,
      phone: meta?.phone || '—',
      fromPresence: true,
    });
  }

  // 2) Roster / cards not online → off-duty (or leave if flagged)
  for (const [id, meta] of byId) {
    if (onlineIds.has(id)) continue;
    const st = String(meta.status || '').toLowerCase();
    if (st === 'suspended' || st === 'pending' || st === 'revoked') continue;
    if (st === 'expired' || st === 'revoked') continue;
    const leave = st === 'on-leave' || st === 'leave';
    rows.push({
      id,
      name: meta.name || meta.fullName || id,
      role: normalizeRole(meta.roleKey, meta.role),
      specialty: meta.specialty || meta.department || meta.role || '—',
      ward: meta.ward || meta.department || '—',
      shift: meta.shift || '—',
      status: leave ? 'leave' : 'off-duty',
      since: offDutyLastSeen(presenceById.get(id)?.lastSeen, meta.lastLogin).exactDateTime,
      exactLastSeen: offDutyLastSeen(presenceById.get(id)?.lastSeen, meta.lastLogin).exactDateTime,
      relativeLastSeen: offDutyLastSeen(presenceById.get(id)?.lastSeen, meta.lastLogin).relative,
      lastSeenMs: offDutyLastSeen(presenceById.get(id)?.lastSeen, meta.lastLogin).raw,
      phone: meta.phone || '—',
      fromPresence: false,
    });
  }

  return rows.sort((a, b) => {
    if (a.status === 'on-duty' && b.status !== 'on-duty') return -1;
    if (b.status === 'on-duty' && a.status !== 'on-duty') return 1;
    return String(a.name).localeCompare(String(b.name));
  });
}

interface Props {
  session?: UserSession;
}

export const StaffingOverview: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on-duty' | 'off-duty' | 'leave'>('all');
  const [aiBriefing, setAiBriefing] = useState<string>('');
  const [aiBusy, setAiBusy] = useState(false);

  const rosterIntelligence = useMemo(
    () =>
      analyzeStaffRosterIntelligence(
        staff.map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          specialty: s.specialty,
          ward: s.ward,
          status: s.status === 'on-call' ? 'off-duty' : s.status,
          lastSeenMs: s.lastSeenMs,
        })),
        listFacilityPresence(facilityId)
      ),
    [staff, facilityId]
  );

  const runAiBriefing = async () => {
    setAiBusy(true);
    try {
      const text = await generateAiRosterBriefing(rosterIntelligence, session?.facility || facilityId);
      setAiBriefing(text);
    } finally {
      setAiBusy(false);
    }
  };

  // reload is READ-ONLY — never writes to localStorage to avoid triggering its own listeners
  const reload = useCallback(() => {
    setStaff(buildRows(facilityId));
  }, [facilityId]);

  useEffect(() => {
    // One-time roster sync on mount — writes to localStorage, so kept OUT of the
    // reload callback to prevent the storage-event → reload → storage-event loop.
    try { syncAccessRosterFromSources(facilityId); } catch { /* ignore */ }

    reload();
    const u1 = subscribeAdminSync(reload);
    const u2 = subscribeStaffPresence(reload);
    const stopCloud = startFacilityPresenceListener(facilityId);
    const bump = () => reload();
    // Live updates: presence, admin registry, ID cards, cloud directory
    // NOTE: 'storage' event intentionally OMITTED — it fires on every localStorage write
    // (including our own syncAccessRosterFromSources calls) and would create an infinite loop.
    // Cross-tab sync is handled by custom events dispatched after writes.
    window.addEventListener(STAFF_PRESENCE_EVENT, bump);
    window.addEventListener('medcore-admin-sync', bump);
    window.addEventListener('medcore-staff-cards-updated', bump);
    window.addEventListener('medcore-staff-registry-updated', bump);
    window.addEventListener('medcore-data-reset', bump);
    window.addEventListener('medcore-facility-cloud', bump);
    // Periodic refresh every 30s (read-only buildRows — no writes)
    const iv = window.setInterval(reload, 30_000);
    // Pull staff directory from cloud when online
    let stopDir = () => {};
    void (async () => {
      try {
        const { firestoreSubscribeStaffDirectory } = await import('../../lib/firebase');
        const { applyCloudStaffDirectory } = await import('../../lib/staffCardStore');
        stopDir = firestoreSubscribeStaffDirectory(facilityId, (data) => {
          try {
            applyCloudStaffDirectory({ ...data, facilityId });
          } catch {
            /* ignore */
          }
          reload();
        });
      } catch {
        /* offline */
      }
    })();
    return () => {
      u1();
      u2();
      stopCloud();
      stopDir();
      window.removeEventListener(STAFF_PRESENCE_EVENT, bump);
      window.removeEventListener('medcore-admin-sync', bump);
      window.removeEventListener('medcore-staff-cards-updated', bump);
      window.removeEventListener('medcore-staff-registry-updated', bump);
      window.removeEventListener('medcore-data-reset', bump);
      window.removeEventListener('medcore-facility-cloud', bump);
      window.clearInterval(iv);
    };
  }, [facilityId, reload]);

  const staffingSuggestions = useMemo<SearchSuggestion[]>(() => {
    return staff.slice(0, 30).map((s) => ({
      id: s.id,
      label: s.name,
      sub: `${s.role.toUpperCase()} · Ward: ${s.ward} · Shift: ${s.shift}`,
      category: s.status === 'on-duty' ? 'On Duty' : 'Off Duty',
      badge: s.status === 'on-duty' ? 'Online' : undefined,
      onClick: () => setSearch(s.name),
    }));
  }, [staff]);

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

      <div
        style={{
          background: 'linear-gradient(135deg, #F5F3FF 0%, #EFF6FF 100%)',
          border: '1px solid #C4B5FD',
          borderRadius: 16,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                Celestia AI Shift & Presence Intelligence
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: rosterIntelligence.statusSeverity === 'optimal' ? '#DCFCE7' : rosterIntelligence.statusSeverity === 'watch' ? '#FEF3C7' : '#FEE2E2',
                    color: rosterIntelligence.statusSeverity === 'optimal' ? '#15803D' : rosterIntelligence.statusSeverity === 'watch' ? '#B45309' : '#B91C1C',
                  }}
                >
                  {rosterIntelligence.coveragePct}% LIVE COVERAGE
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                {rosterIntelligence.onlineCount}/{rosterIntelligence.totalRoster} active · {rosterIntelligence.neverLoggedInCount} never logged in
                {rosterIntelligence.uncoveredCriticalRoles.length > 0 ? ` · ${rosterIntelligence.uncoveredCriticalRoles.length} uncovered core desk(s)` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={aiBusy}
            onClick={() => void runAiBriefing()}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#4F46E5',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 800,
              cursor: aiBusy ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={14} /> {aiBusy ? 'Analyzing Shift Telemetry…' : 'Run AI Roster Analysis'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rosterIntelligence.recommendedActions.map((rec, idx) => (
            <div key={idx} style={{ fontSize: 12, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} color={rosterIntelligence.statusSeverity === 'optimal' ? '#059669' : '#D97706'} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
        {aiBriefing && (
          <div style={{ background: '#FFFFFF', border: '1px solid #DDD6FE', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#0F172A', lineHeight: 1.5 }}>
            <strong>AI Workforce Briefing:</strong> {aiBriefing}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px' }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, ID, ward…"
            suggestions={staffingSuggestions}
            size="sm"
            themeColor="#0052D4"
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
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: s.exactLastSeen === 'Never logged in' ? '#94A3B8' : '#0F172A' }}>
                      {s.exactLastSeen}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: s.status === 'on-duty' ? '#16A34A' : '#64748B' }}>
                      {s.status === 'on-duty' ? `Active · ${s.relativeLastSeen}` : s.relativeLastSeen}
                    </div>
                  </td>
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
        Live snapshot · on duty = active login heartbeat for this facility (not full HR headcount)
      </div>
    </div>
  );
};

export default StaffingOverview;
