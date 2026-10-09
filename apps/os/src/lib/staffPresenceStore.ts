/**
 * Staff presence — who is currently logged in (Facebook-style "active").
 * Each user writes facilities/{fid}/presence/{badgeId} so multi-PC never clobbers.
 * Live onSnapshot → local map → KPI without reload.
 */
import { publishFacilityData } from './roleSyncBus';

export const STAFF_PRESENCE_KEY = 'medcore_os_staff_presence_v1';
export const STAFF_PRESENCE_EVENT = 'medcore-staff-presence';
/** Consider online if heartbeat within this window */
export const PRESENCE_TTL_MS = 75_000;
const HEARTBEAT_MS = 12_000;

export type StaffPresence = {
  badgeId: string;
  facilityId: string;
  name: string;
  roleKey: string;
  role?: string;
  lastSeen: number;
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
    return p && typeof p === 'object' ? (p as PresenceMap) : {};
  } catch {
    return {};
  }
}

export function mergePresenceMaps(a: PresenceMap, b: PresenceMap): PresenceMap {
  const out: PresenceMap = { ...a };
  for (const [k, row] of Object.entries(b || {})) {
    const prev = out[k];
    if (!prev || (row.lastSeen || 0) >= (prev.lastSeen || 0)) {
      out[k] = row;
    }
  }
  return out;
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

/** Treat stale heartbeats as offline (admin + KPI accuracy) */
function normalizePresence(p: StaffPresence, now = Date.now()): StaffPresence {
  if (p.online && !isFresh(p, now)) {
    return { ...p, online: false };
  }
  return p;
}

function rowFromCloud(r: Record<string, unknown>): StaffPresence | null {
  const badgeId = String(r.badgeId || r.id || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!badgeId) return null;
  return {
    badgeId,
    facilityId: String(r.facilityId || '').toUpperCase(),
    name: String(r.name || badgeId),
    roleKey: String(r.roleKey || ''),
    role: r.role ? String(r.role) : undefined,
    lastSeen: Number(r.lastSeen || 0),
    online: r.online === true || r.online === 'true',
  };
}

/** Apply cloud presence rows into local map (realtime KPI) */
export function applyCloudPresenceRows(rows: Record<string, unknown>[]): void {
  const now = Date.now();
  const remote: PresenceMap = {};
  for (const r of rows) {
    const row = rowFromCloud(r);
    if (!row) continue;
    // Stale online from crashed tabs → offline for this facility
    remote[mapKey(row.facilityId, row.badgeId)] = normalizePresence(row, now);
  }
  const merged = mergePresenceMaps(readAll(), remote);
  // Re-normalize entire map after merge
  for (const k of Object.keys(merged)) {
    merged[k] = normalizePresence(merged[k], now);
  }
  writeAll(merged);
}

/** Mark current staff online — per-user Firestore doc (no map clobber) */
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
  const k = mapKey(fid, badge);
  const self: StaffPresence = {
    badgeId: badge,
    facilityId: fid,
    name: opts.name || badge,
    roleKey: opts.roleKey || '',
    role: opts.role,
    lastSeen: Date.now(),
    online: true,
  };
  const map = mergePresenceMaps(readAll(), { [k]: self });
  map[k] = self;
  writeAll(map);

  // Cloud: one doc per user
  void (async () => {
    try {
      const { firestoreUpsertPresence } = await import('./firebase');
      await firestoreUpsertPresence(fid, { ...self });
    } catch {
      /* offline */
    }
  })();

  // Legacy shared-map publish (best-effort, peers still get collection snapshot)
  try {
    publishFacilityData(fid, STAFF_PRESENCE_KEY, map);
  } catch {
    /* ignore */
  }
}

/** Fully remove presence (staff deleted from facility — not merely offline) */
export function removeStaffPresence(badgeId: string, facilityId: string): void {
  const badge = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
  const fid = String(facilityId || '').toUpperCase();
  if (!badge) return;
  const k = mapKey(fid, badge);
  const map = readAll();
  if (map[k]) {
    delete map[k];
    writeAll(map);
  }
  // Also drop any key variants
  for (const key of Object.keys(map)) {
    if (key.endsWith('::' + badge) || map[key]?.badgeId === badge) {
      if (String(map[key]?.facilityId || '').toUpperCase() === fid || key.startsWith(fid + '::')) {
        delete map[key];
      }
    }
  }
  writeAll(map);
  void (async () => {
    try {
      const { firestoreDeletePresence } = await import('./firebase');
      await firestoreDeletePresence(fid, badge);
    } catch {
      /* ignore */
    }
  })();
  try {
    publishFacilityData(fid, STAFF_PRESENCE_KEY, readAll());
  } catch {
    /* ignore */
  }
}

export function markStaffOffline(badgeId: string, facilityId: string): void {
  const badge = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
  const fid = String(facilityId || '').toUpperCase();
  if (!badge) return;
  const k = mapKey(fid, badge);
  const map = readAll();
  const row: StaffPresence = {
    badgeId: badge,
    facilityId: fid,
    name: map[k]?.name || badge,
    roleKey: map[k]?.roleKey || '',
    role: map[k]?.role,
    lastSeen: Date.now(),
    online: false,
  };
  map[k] = row;
  writeAll(map);
  void (async () => {
    try {
      const { firestoreUpsertPresence } = await import('./firebase');
      await firestoreUpsertPresence(fid, { ...row });
    } catch {
      /* ignore */
    }
  })();
  try {
    publishFacilityData(fid, STAFF_PRESENCE_KEY, map);
  } catch {
    /* ignore */
  }
}

function isFrontDeskRole(roleKey?: string, role?: string): boolean {
  const rk = String(roleKey || '').toLowerCase();
  const r = String(role || '').toLowerCase();
  if (rk === 'reception' || rk === 'records') return true;
  if (r.includes('reception') || r.includes('front desk') || r.includes('frontdesk')) return true;
  if (r.includes('records') || r.includes('cashier')) return true;
  return false;
}

export function listActiveStaff(facilityId: string, roleKeys?: string[]): StaffPresence[] {
  const fid = String(facilityId || '').toUpperCase();
  const now = Date.now();
  const map = readAll();
  // Persist normalized offline so admin sees accurate offline set
  let dirty = false;
  for (const [k, row] of Object.entries(map)) {
    const n = normalizePresence(row, now);
    if (n.online !== row.online) {
      map[k] = n;
      dirty = true;
    }
  }
  if (dirty) writeAll(map);

  const roles = roleKeys?.map((r) => r.toLowerCase());
  return Object.values(map).filter((p) => {
    if (String(p.facilityId || '').toUpperCase() !== fid) return false;
    if (!isFresh(p, now)) return false;
    if (roles && roles.length) {
      const rk = String(p.roleKey || '').toLowerCase();
      if (roles.includes(rk)) return true;
      // also accept human role labels
      return isFrontDeskRole(p.roleKey, p.role);
    }
    return true;
  });
}

export function countActiveStaff(facilityId: string, roleKeys?: string[]): number {
  return listActiveStaff(facilityId, roleKeys).length;
}

/** Presence rows for facility that are NOT currently online (logged out or stale) */
export function listOfflineStaff(facilityId: string): StaffPresence[] {
  const fid = String(facilityId || '').toUpperCase();
  const now = Date.now();
  const map = readAll();
  return Object.values(map)
    .map((p) => normalizePresence(p, now))
    .filter((p) => String(p.facilityId || '').toUpperCase() === fid && !isFresh(p, now));
}

/** All presence known for facility (online + offline), normalized */
export function listFacilityPresence(facilityId: string): StaffPresence[] {
  const fid = String(facilityId || '').toUpperCase();
  const now = Date.now();
  return Object.values(readAll())
    .map((p) => normalizePresence(p, now))
    .filter((p) => String(p.facilityId || '').toUpperCase() === fid)
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

export function startStaffPresenceHeartbeat(opts: {
  badgeId: string;
  facilityId: string;
  name: string;
  roleKey: string;
  role?: string;
}): () => void {
  if (typeof window === 'undefined') return () => {};
  let id: number | null = null;
  let hiddenTimer: number | null = null;

  const clearHb = () => {
    if (id != null) {
      window.clearInterval(id);
      id = null;
    }
  };

  const startHb = () => {
    clearHb();
    const tick = () => markStaffOnline(opts);
    tick();
    id = window.setInterval(tick, HEARTBEAT_MS);
  };

  const goOffline = () => {
    try {
      markStaffOffline(opts.badgeId, opts.facilityId);
    } catch {
      /* ignore */
    }
  };

  const onVis = () => {
    if (document.visibilityState === 'visible') {
      if (hiddenTimer != null) {
        window.clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
      startHb();
    } else {
      // Tab hidden / minimized — stop heartbeats; after short delay mark offline
      clearHb();
      if (hiddenTimer != null) window.clearTimeout(hiddenTimer);
      hiddenTimer = window.setTimeout(() => {
        goOffline();
        hiddenTimer = null;
      }, 15_000);
    }
  };

  const onUnload = () => {
    clearHb();
    goOffline();
  };

  startHb();
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('beforeunload', onUnload);
  window.addEventListener('pagehide', onUnload);
  return () => {
    clearHb();
    if (hiddenTimer != null) window.clearTimeout(hiddenTimer);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('beforeunload', onUnload);
    window.removeEventListener('pagehide', onUnload);
    goOffline();
  };
}

export function subscribeStaffPresence(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrap = () => cb();
  window.addEventListener(STAFF_PRESENCE_EVENT, wrap);
  window.addEventListener('storage', wrap);
  window.addEventListener('medcore-admin-sync', wrap);
  window.addEventListener('medcore-facility-cloud', wrap);
  return () => {
    window.removeEventListener(STAFF_PRESENCE_EVENT, wrap);
    window.removeEventListener('storage', wrap);
    window.removeEventListener('medcore-admin-sync', wrap);
    window.removeEventListener('medcore-facility-cloud', wrap);
  };
}

/** Live Firestore presence collection → local map (no browser reload) */
export function startFacilityPresenceListener(facilityId: string): () => void {
  if (typeof window === 'undefined' || !facilityId) return () => {};
  let stop = () => {};
  void (async () => {
    try {
      const { firestoreSubscribePresence } = await import('./firebase');
      stop = firestoreSubscribePresence(facilityId, (rows) => {
        applyCloudPresenceRows(rows);
      });
    } catch {
      /* offline */
    }
  })();
  return () => stop();
}
