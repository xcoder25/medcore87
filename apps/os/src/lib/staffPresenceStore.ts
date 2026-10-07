/**
 * Staff presence — who is currently logged in (Facebook-style "active").
 * Heartbeat while session is open; offline on logout / close / timeout.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';

export const STAFF_PRESENCE_KEY = 'medcore_os_staff_presence_v1';
export const STAFF_PRESENCE_EVENT = 'medcore-staff-presence';
/** Consider online if heartbeat within this window */
export const PRESENCE_TTL_MS = 90_000;
const HEARTBEAT_MS = 25_000;

export type StaffPresence = {
  badgeId: string;
  facilityId: string;
  name: string;
  roleKey: string;
  role?: string;
  lastSeen: number; // epoch ms
  online: boolean;
};

type PresenceMap = Record<string, StaffPresence>;

function mapKey(facilityId: string, badgeId: string) {
  return `${String(facilityId).toUpperCase()}::${String(badgeId).toUpperCase().replace(/\s+/g, '')}`;
}

function readAll(): PresenceMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STAFF_PRESENCE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function writeAll(map: PresenceMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_PRESENCE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(STAFF_PRESENCE_EVENT, { detail: map }));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: STAFF_PRESENCE_KEY } }));
  } catch {
    /* ignore */
  }
}

function isFresh(p: StaffPresence, now = Date.now()) {
  return Boolean(p.online) && now - (p.lastSeen || 0) < PRESENCE_TTL_MS;
}

/** Mark current staff online + optional cloud publish */
export function markStaffOnline(opts: {
  badgeId: string;
  facilityId: string;
  name: string;
  roleKey: string;
  role?: string;
}): void {
  const badge = String(opts.badgeId || '').toUpperCase().replace(/\s+/g, '');
  const fid = String(opts.facilityId || '').toUpperCase();
  if (!badge || !fid) return;
  const map = readAll();
  const k = mapKey(fid, badge);
  map[k] = {
    badgeId: badge,
    facilityId: fid,
    name: opts.name || badge,
    roleKey: opts.roleKey || '',
    role: opts.role,
    lastSeen: Date.now(),
    online: true,
  };
  writeAll(map);
  try {
    publishFacilityData(fid, STAFF_PRESENCE_KEY, map);
  } catch {
    /* ignore */
  }
}

/** Mark offline (logout / tab close) */
export function markStaffOffline(badgeId: string, facilityId: string): void {
  const badge = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
  const fid = String(facilityId || '').toUpperCase();
  if (!badge) return;
  const map = readAll();
  const k = mapKey(fid, badge);
  if (map[k]) {
    map[k] = { ...map[k], online: false, lastSeen: Date.now() };
    writeAll(map);
    try {
      publishFacilityData(fid, STAFF_PRESENCE_KEY, map);
    } catch {
      /* ignore */
    }
  }
}

/** Active (online now) staff for a facility, optional role filter */
export function listActiveStaff(facilityId: string, roleKeys?: string[]): StaffPresence[] {
  const fid = String(facilityId || '').toUpperCase();
  const now = Date.now();
  const map = readAll();
  const roles = roleKeys?.map((r) => r.toLowerCase());
  return Object.values(map).filter((p) => {
    if (String(p.facilityId || '').toUpperCase() !== fid) return false;
    if (!isFresh(p, now)) return false;
    if (roles && roles.length) {
      const rk = String(p.roleKey || '').toLowerCase();
      if (!roles.includes(rk)) return false;
    }
    return true;
  });
}

export function countActiveStaff(facilityId: string, roleKeys?: string[]): number {
  return listActiveStaff(facilityId, roleKeys).length;
}

/** Start heartbeat for a logged-in session; returns stop() */
export function startStaffPresenceHeartbeat(opts: {
  badgeId: string;
  facilityId: string;
  name: string;
  roleKey: string;
  role?: string;
}): () => void {
  if (typeof window === 'undefined') return () => {};
  const tick = () => markStaffOnline(opts);
  tick();
  const id = window.setInterval(tick, HEARTBEAT_MS);
  const onVis = () => {
    if (document.visibilityState === 'visible') tick();
  };
  const onUnload = () => {
    try {
      markStaffOffline(opts.badgeId, opts.facilityId);
    } catch {
      /* ignore */
    }
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('beforeunload', onUnload);
  window.addEventListener('pagehide', onUnload);
  return () => {
    window.clearInterval(id);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('beforeunload', onUnload);
    window.removeEventListener('pagehide', onUnload);
  };
}

export function subscribeStaffPresence(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrap = () => cb();
  window.addEventListener(STAFF_PRESENCE_EVENT, wrap);
  window.addEventListener('storage', wrap);
  window.addEventListener('medcore-admin-sync', wrap);
  return () => {
    window.removeEventListener(STAFF_PRESENCE_EVENT, wrap);
    window.removeEventListener('storage', wrap);
    window.removeEventListener('medcore-admin-sync', wrap);
  };
}
