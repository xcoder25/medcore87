'use client';

/**
 * MedCore Administrator Workspace — live data from adminRealtimeStore + WS events.
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Users, UserPlus, ArrowRightLeft, CalendarDays, AlertTriangle, Shield,
  FileCheck, ChevronRight, Activity, Clock, CheckCircle2,
  UserCheck, BedDouble,
} from 'lucide-react';
import {
  buildAdminSnapshot,
  subscribeAdminSync,
  pushActivity,
  setActiveFacilityId,
  getAccessRecords,
  type AdminSnapshot,
} from '../../lib/adminRealtimeStore';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import {
  subscribeStaffPresence,
  startFacilityPresenceListener,
  STAFF_PRESENCE_EVENT,
  REVOKED_STAFF_EVENT,
  listActiveStaff,
  listOfflineStaff,
  isStaffRevokedLocal,
  applyCloudRevokedBadges,
  type StaffPresence,
} from '../../lib/staffPresenceStore';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const toneBg: Record<string, string> = {
  blue: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
  sky: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
  amber: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
  teal: 'linear-gradient(135deg, #F0FDFA, #CCFBF1)',
  violet: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
  rose: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)',
};
const toneFg: Record<string, string> = {
  blue: '#2563EB', sky: '#0284C7', amber: '#D97706', teal: '#0D9488', violet: '#7C3AED', rose: '#E11D48',
};

export const AdminWorkspace: React.FC<Props> = ({ session, onNavigate }) => {
  const [snap, setSnap] = useState<AdminSnapshot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [onlineStaff, setOnlineStaff] = useState<StaffPresence[]>([]);
  const [offlineStaff, setOfflineStaff] = useState<StaffPresence[]>([]);

  const facility = session.facility || 'Immanuel General Hospital, Eket';
  const firstName = (session.name || 'Administrator').split(' ')[0];

  const facilityId = session.hospitalId || 'IGH-EKT';

  const refresh = useCallback(() => {
    try {
      setActiveFacilityId(facilityId);
    } catch {
      /* ignore */
    }
    try {
      setSnap(buildAdminSnapshot());
    } catch {
      /* ignore */
    }
    try {
      // ONLINE = live presence only (exclude revoked / deleted)
      let online = listActiveStaff(facilityId).filter(
        (s) => !isStaffRevokedLocal(s.badgeId, facilityId)
      );

      // Always count this admin session as online (prevents KPI flash to 0)
      const selfBadge = String(session.badgeId || '')
        .toUpperCase()
        .replace(/\s+/g, '');
      if (selfBadge && !online.some((s) => s.badgeId.toUpperCase() === selfBadge)) {
        if (!isStaffRevokedLocal(selfBadge, facilityId)) {
          online = [
            {
              badgeId: selfBadge,
              facilityId: String(facilityId).toUpperCase(),
              name: session.name || selfBadge,
              roleKey: session.roleKey || 'hospital_admin',
              role: session.role,
              lastSeen: Date.now(),
              online: true,
            },
            ...online,
          ];
        }
      }

      // Stable update: only setState when content actually changes (stops KPI shake)
      setOnlineStaff((prev) => {
        const nextIds = online.map((s) => s.badgeId).sort().join('|');
        const prevIds = prev.map((s) => s.badgeId).sort().join('|');
        if (nextIds === prevIds && prev.length === online.length) {
          // refresh lastSeen names if same set
          if (prev.length === 0 && online.length === 0) return prev;
          if (nextIds === prevIds) return online.length ? online : prev;
        }
        return online;
      });

      const onlineIds = new Set(
        online.map((s) => String(s.badgeId || '').toUpperCase().replace(/\s+/g, ''))
      );

      // Enrolled staff only: registry + cards for this facility (not bare access ghosts)
      const enrolled = new Map<string, { name: string; role: string; roleKey: string }>();
      try {
        const reg = JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]');
        if (Array.isArray(reg)) {
          for (const r of reg) {
            const bid = String(r.badgeId || r.id || '')
              .toUpperCase()
              .replace(/\s+/g, '');
            const hid = String(r.hospitalId || r.facilityId || facilityId).toUpperCase();
            if (!bid || isStaffRevokedLocal(bid, facilityId)) continue;
            if (hid && hid !== String(facilityId).toUpperCase()) continue;
            enrolled.set(bid, {
              name: String(r.name || r.fullName || bid),
              role: String(r.role || ''),
              roleKey: String(r.roleKey || ''),
            });
          }
        }
      } catch {
        /* ignore */
      }
      try {
        const cards = JSON.parse(localStorage.getItem('medcore_staff_cards') || localStorage.getItem('medcore_os_staff_cards') || '[]');
        // try both keys
      } catch {
        /* ignore */
      }
      try {
        for (const key of ['medcore_os_staff_cards', 'medcore_staff_cards', 'medcore_staff_id_cards']) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const cards = JSON.parse(raw);
          if (!Array.isArray(cards)) continue;
          for (const c of cards) {
            const bid = String(c.badgeId || c.id || '')
              .toUpperCase()
              .replace(/\s+/g, '');
            const fid = String(c.facilityId || facilityId).toUpperCase();
            if (!bid || isStaffRevokedLocal(bid, facilityId)) continue;
            if (fid && fid !== String(facilityId).toUpperCase()) continue;
            if (!enrolled.has(bid)) {
              enrolled.set(bid, {
                name: String(c.fullName || c.name || bid),
                role: String(c.role || c.title || ''),
                roleKey: String(c.roleKey || ''),
              });
            }
          }
        }
      } catch {
        /* ignore */
      }
      // Access only if badge still enrolled (skip deleted leftovers)
      try {
        for (const a of getAccessRecords().filter((x) => x.status === 'active')) {
          const bid = String(a.id || '')
            .toUpperCase()
            .replace(/\s+/g, '');
          if (!bid || isStaffRevokedLocal(bid, facilityId)) continue;
          if (!enrolled.has(bid)) continue; // not on roster/cards → deleted residue, hide
        }
      } catch {
        /* ignore */
      }

      const offline: StaffPresence[] = [];
      const seen = new Set<string>();
      for (const [bid, meta] of enrolled) {
        if (onlineIds.has(bid) || seen.has(bid)) continue;
        seen.add(bid);
        offline.push({
          badgeId: bid,
          facilityId: String(facilityId).toUpperCase(),
          name: meta.name,
          roleKey: meta.roleKey,
          role: meta.role,
          lastSeen: 0,
          online: false,
        });
      }

      setOfflineStaff((prev) => {
        const nextIds = offline.map((s) => s.badgeId).sort().join('|');
        const prevIds = prev.map((s) => s.badgeId).sort().join('|');
        if (nextIds === prevIds) return prev;
        return offline;
      });
    } catch {
      /* keep previous lists on error — never flash to 0 */
    }
  }, [facilityId, session.badgeId, session.name, session.roleKey, session.role]);

  const { connected } = useRealtimeEvents({
    app: 'MEDCORE_OS_ADMIN',
    facilityId: session.hospitalId || facility,
    onEvent: (evt) => {
      pushActivity(`Live: ${evt.topic.replace(/_/g, ' ').toLowerCase()}`);
      refresh();
    },
  });

  useEffect(() => {
    refresh();
    let debounceTimer: number | null = null;
    const bump = () => {
      // Debounce bursts (presence + storage + admin-sync) so KPI does not shake
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        refresh();
        debounceTimer = null;
      }, 300);
    };
    const unsub = subscribeAdminSync(bump);
    const unsubPresence = subscribeStaffPresence(bump);
    const stopCloud = startFacilityPresenceListener(facilityId);
    let stopRevoked = () => {};
    void (async () => {
      try {
        const { firestoreSubscribeRevokedStaff } = await import('../../lib/firebase');
        stopRevoked = firestoreSubscribeRevokedStaff(facilityId, (ids) => {
          applyCloudRevokedBadges(facilityId, ids);
          // Strip revoked from access so they never reappear offline
          try {
            const next = getAccessRecords().filter((a) => {
              const bid = String(a.id || '')
                .toUpperCase()
                .replace(/\s+/g, '');
              return !ids.some((id) => String(id).toUpperCase().replace(/\s+/g, '') === bid);
            });
            if (next.length < getAccessRecords().length) {
              void import('../../lib/adminRealtimeStore').then((m) => m.setAccessRecords(next));
            }
          } catch {
            /* ignore */
          }
          bump();
        });
      } catch {
        /* offline */
      }
    })();
    window.addEventListener(STAFF_PRESENCE_EVENT, bump);
    window.addEventListener(REVOKED_STAFF_EVENT, bump);
    window.addEventListener('medcore-admin-sync', bump);
    window.addEventListener('storage', bump);
    window.addEventListener('medcore-facility-cloud', bump);
    window.addEventListener('medcore-staff-cards-updated', bump);
    window.addEventListener('medcore-staff-registry-updated', bump);
    const iv = setInterval(() => {
      setTick((t) => t + 1);
      refresh();
    }, 10000);
    return () => {
      unsub();
      unsubPresence();
      stopCloud();
      stopRevoked();
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      window.removeEventListener(STAFF_PRESENCE_EVENT, bump);
      window.removeEventListener(REVOKED_STAFF_EVENT, bump);
      window.removeEventListener('medcore-admin-sync', bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('medcore-facility-cloud', bump);
      window.removeEventListener('medcore-staff-cards-updated', bump);
      window.removeEventListener('medcore-staff-registry-updated', bump);
      clearInterval(iv);
    };
  }, [refresh, facilityId]);

  const notify = (msg: string, nav?: string) => {
    setToast(msg);
    pushActivity(msg);
    setTimeout(() => setToast(null), 2800);
    if (nav) setTimeout(() => onNavigate(nav), 400);
  };

  if (!snap) {
    return (
      <div className="admin-workspace">
        <div className="admin-card" style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
          Loading administrator workspace…
        </div>
      </div>
    );
  }

  const kpis = [
    { key: 'staff', label: 'Active Staff', value: String(onlineStaff.length), trend: 'Logged in now · live', tone: 'blue', icon: Users, nav: 'staffing' },
    { key: 'open', label: 'Open Positions', value: String(snap.openPositions), trend: 'Recruitment', tone: 'sky', icon: UserPlus, nav: 'rbac' },
    { key: 'transfer', label: 'Pending Transfer', value: String(snap.pendingTransfers), trend: snap.pendingTransfers ? 'Needs review' : 'Clear', tone: 'amber', icon: ArrowRightLeft, nav: 'transfer' },
    { key: 'logged', label: 'Staff Logged In', value: String(snap.staffLoggedIn), trend: connected ? 'Live' : 'Active', tone: 'teal', icon: UserCheck, nav: 'staffing' },
    { key: 'leave', label: 'On Leave', value: String(snap.onLeave), trend: 'Roster', tone: 'violet', icon: CalendarDays, nav: 'staffing' },
    { key: 'access', label: 'Access Issues', value: String(snap.accessIssues), trend: snap.accessIssues ? 'Needs review' : 'Clear', tone: 'rose', icon: Shield, nav: 'rbac' },
  ];

  const sevStyle = {
    High: { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA' },
    Medium: { bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A' },
    Low: { bg: '#EFF6FF', fg: '#2563EB', border: '#BFDBFE' },
  };

  const ageSec = Math.max(0, Math.floor((Date.now() - new Date(snap.updatedAt).getTime()) / 1000));

  return (
    <div className="admin-workspace">
      {toast && (
        <div className="admin-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}

      <section className="admin-hero">
        <div className="admin-hero-copy">
          <h1>
            {greeting()}, {session.roleKey === 'hospital_admin' ? 'Administrator' : firstName}{' '}
            <span aria-hidden>👋</span>
          </h1>
          <p>
            Here&apos;s what&apos;s happening at <strong>{facility}</strong> today.
          </p>
        </div>
      </section>

      <section className="admin-kpi-row" aria-label="Key metrics">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              type="button"
              className="admin-kpi"
              style={{ background: toneBg[k.tone] }}
              onClick={() => onNavigate(k.nav)}
            >
              <div className="admin-kpi-top">
                <span className="admin-kpi-icon" style={{ color: toneFg[k.tone], background: '#fff' }}>
                  <Icon size={16} />
                </span>
                <span className="admin-kpi-label">{k.label}</span>
              </div>
              <div className="admin-kpi-value" style={{ color: toneFg[k.tone] }}>
                {k.value}
              </div>
              <div className="admin-kpi-trend">{k.trend}</div>
            </button>
          );
        })}
      </section>

      <section className="admin-quick">
        <div className="admin-quick-title">Quick Actions</div>
        <div className="admin-quick-row">
          <button type="button" className="admin-qa primary" onClick={() => onNavigate('transfer')}>
            <ArrowRightLeft size={14} /> New Staff Transfer
          </button>
          <button type="button" className="admin-qa" onClick={() => onNavigate('rbac')}>
            <UserPlus size={14} /> Add Staff
          </button>
          <button type="button" className="admin-qa" onClick={() => notify('Open staffing to edit rosters', 'staffing')}>
            <CalendarDays size={14} /> Create Roster
          </button>
          <button
            type="button"
            className="admin-qa"
            onClick={() => {
              pushActivity('Incident reported from admin dashboard');
              notify('Incident noted — open Compliance to follow up', 'compliance');
            }}
          >
            <AlertTriangle size={14} /> Report Incident
          </button>
          <button type="button" className="admin-qa" onClick={() => onNavigate('beds')}>
            <BedDouble size={14} /> Assign Bed
          </button>
        </div>
      </section>

      <section className="admin-grid-3">
        <div className="admin-card admin-card-attention">
          <div className="admin-card-head">
            <div className="admin-card-title danger">
              <AlertTriangle size={15} /> Needs Your Attention
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('transfer')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <ul className="admin-attention-list">
            {snap.attention.map((a) => (
              <li key={a.id}>
                <div>
                  <span
                    className="admin-sev"
                    style={{
                      background: sevStyle[a.severity].bg,
                      color: sevStyle[a.severity].fg,
                      borderColor: sevStyle[a.severity].border,
                    }}
                  >
                    {a.severity}
                  </span>
                  <div className="admin-att-title">{a.title}</div>
                  <div className="admin-att-when">{a.when}</div>
                </div>
                <button type="button" className="admin-link" onClick={() => onNavigate(a.nav)}>
                  {a.action} <ChevronRight size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Users size={15} /> Staff Overview
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('staffing')}>
              View staff <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-staff-total" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <span className="big" style={{ color: '#16A34A' }}>{onlineStaff.length}</span>
              <span className="muted">Online now</span>
            </div>
            <div>
              <span className="big" style={{ color: '#64748B' }}>{offlineStaff.length}</span>
              <span className="muted">Offline (this facility)</span>
            </div>
          </div>
          <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#16A34A', marginBottom: 6 }}>ONLINE</div>
            {onlineStaff.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>No one logged in</div>
            ) : (
              onlineStaff.slice(0, 12).map((s) => (
                <div
                  key={`on-${s.badgeId}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    padding: '4px 0',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    <span style={{ color: '#16A34A', marginRight: 6 }}>●</span>
                    {s.name}
                  </span>
                  <span style={{ color: '#64748B' }}>{s.roleKey || s.role || '—'}</span>
                </div>
              ))
            )}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '12px 0 6px' }}>OFFLINE</div>
            {offlineStaff.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8' }}>No offline presence yet</div>
            ) : (
              offlineStaff.slice(0, 12).map((s) => (
                <div
                  key={`off-${s.badgeId}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    padding: '4px 0',
                    borderBottom: '1px solid #F1F5F9',
                    opacity: 0.85,
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#475569' }}>
                    <span style={{ color: '#94A3B8', marginRight: 6 }}>○</span>
                    {s.name}
                  </span>
                  <span style={{ color: '#94A3B8' }}>{s.roleKey || s.role || '—'}</span>
                </div>
              ))
            )}
          </div>
          <ul className="admin-dept-list">
            {snap.depts.map((d) => (
              <li key={d.name}>
                <div className="admin-dept-row">
                  <span className="admin-dept-name">{d.name}</span>
                  <span className="admin-dept-count">{d.count}</span>
                </div>
                <div className="admin-bar-track">
                  <div className="admin-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <div className="admin-dept-pct">{d.pct}% coverage</div>
              </li>
            ))}
          </ul>
          <button type="button" className="admin-ghost-full" onClick={() => onNavigate('staffing')}>
            Open full roster
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Shield size={15} /> Access &amp; Security
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('rbac')}>
              Manage access <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-access-stats">
            <div className="admin-access-row ok">
              <span className="dot" /> {snap.accessActive} Active accounts
            </div>
            <div className="admin-access-row warn">
              <span className="dot" /> {snap.accessPending} Pending requests
            </div>
            <div className="admin-access-row bad">
              <span className="dot" /> {snap.accessSuspended} Suspended accounts
            </div>
            <div className="admin-access-row info">
              <span className="dot" /> Live permission changes recorded
            </div>
          </div>
          <button type="button" className="admin-cta" onClick={() => onNavigate('rbac')}>
            Review access requests
          </button>
        </div>
      </section>

      <section className="admin-grid-3">
        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Users size={15} /> Staff by Department
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('staffing')}>
              View details <ChevronRight size={14} />
            </button>
          </div>
          {snap.depts.length === 0 ? (
            <div style={{ padding: '28px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
              No staff enrolled yet.<br />
              <button type="button" className="admin-link" style={{ marginTop: 8 }} onClick={() => onNavigate('rbac')}>
                Enrol first staff member →
              </button>
            </div>
          ) : (
          <div className="admin-bar-chart" role="img" aria-label="Staff counts by department">
            {snap.depts.map((d) => (
              <div key={d.name} className="admin-bar-col">
                <div className="admin-bar-val">{d.count}</div>
                <div className="admin-bar-stem" style={{ height: `${Math.max(12, d.count * 2.2)}px`, background: d.color }} />
                <div className="admin-bar-label">{d.name}</div>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <FileCheck size={15} /> Compliance Health
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('compliance')}>
              View compliance <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-compliance">
            <div className="admin-ring" aria-label={`${snap.compliancePct} percent compliance`}>
              <span>{snap.compliancePct}%</span>
            </div>
            <ul>
              <li>
                <span className="dot amber" /> Documents expiring <strong>{snap.complianceExpiring}</strong>
              </li>
              <li>
                <span className="dot rose" /> Overdue reviews <strong>{snap.complianceOverdue}</strong>
              </li>
              <li>
                <span className="dot blue" /> Pending audits <strong>{snap.compliancePending}</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Activity size={15} /> Recent Admin Activity
            </div>
            <button type="button" className="admin-link" onClick={refresh}>
              Refresh <ChevronRight size={14} />
            </button>
          </div>
          <ul className="admin-activity">
            {snap.activity.slice(0, 6).map((a) => (
              <li key={a.id}>
                <span className="time">{a.time}</span>
                <span className="text">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <ArrowRightLeft size={15} /> Recent Transfers
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('transfer')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>From → To</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {snap.transfers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#94A3B8', padding: 20 }}>
                      No transfers yet — create one from Staff Transfer.
                    </td>
                  </tr>
                )}
                {(snap.transfers.length === 0
                  ? []
                  : snap.transfers
                ).map((r: any, i: number) => (
                  <tr key={r.id || i}>
                    <td>{r.staffName || r.staff}</td>
                    <td className="muted">
                      {(r.fromHospitalName || r.from || '—')} → {(r.toHospitalName || r.to || '—')}
                    </td>
                    <td className="muted">{r.effectiveDate || r.date || '—'}</td>
                    <td>
                      <span className={`admin-badge ${String(r.status).toLowerCase() === 'pending' ? 'pending' : 'done'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-card-title">
              <Shield size={15} /> Access &amp; Permissions
            </div>
            <button type="button" className="admin-link" onClick={() => onNavigate('rbac')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {snap.perms.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="muted">{r.role}</td>
                    <td>
                      <span className={`admin-badge ${r.status === 'active' ? 'done' : 'pending'}`}>
                        ● {r.status}
                      </span>
                    </td>
                    <td className="muted">{r.lastLogin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="admin-footnote">
        <Clock size={12} /> Updated {ageSec < 5 ? 'just now' : `${ageSec}s ago`}
        {' · '}
        {connected ? 'Event bus connected' : 'Browser realtime active'}
        {' · '}
        {facility}
      </p>
    </div>
  );
};

export default AdminWorkspace;
