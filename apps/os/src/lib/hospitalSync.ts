/**
 * Same-hospital shared data (offline-first on the hospital LAN).
 *
 * How multi-user works without the public internet:
 * 1. Always write to localStorage (works offline on each PC).
 * 2. BroadcastChannel — same browser / same origin tabs.
 * 3. When a LAN API is available (api-server on hospital Wi‑Fi),
 *    all workstations PUT/GET the same facility blob and see each other.
 *
 * Set NEXT_PUBLIC_API_URL=http://192.168.x.x:4000 on every hospital PC
 * (or leave default to try localhost:4000).
 */

const DEFAULT_API =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000';

export function resolveApiBase(): string {
  return (DEFAULT_API || 'http://localhost:4000').replace(/\/$/, '');
}

export type FacilityBlob = Record<string, unknown>;

let lastPullAt = 0;
let lastKnownServerUpdatedAt: string | null = null;
let syncAvailable: boolean | null = null;

function facilityChannel(facilityId: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(`medcore-facility-${facilityId}`);
  } catch {
    return null;
  }
}

/** Publish key/value to other tabs on this machine */
export function broadcastLocal(facilityId: string, key: string, value: unknown) {
  const ch = facilityChannel(facilityId);
  if (!ch) return;
  try {
    ch.postMessage({ type: 'facility-key', key, value, at: new Date().toISOString() });
  } catch {
    /* ignore */
  }
  ch.close();
}

export function subscribeLocal(
  facilityId: string,
  onMsg: (key: string, value: unknown) => void
): () => void {
  const ch = facilityChannel(facilityId);
  if (!ch) return () => {};
  const handler = (ev: MessageEvent) => {
    const d = ev.data;
    if (d?.type === 'facility-key' && d.key) onMsg(d.key, d.value);
  };
  ch.addEventListener('message', handler);
  return () => {
    ch.removeEventListener('message', handler);
    ch.close();
  };
}

/** Probe LAN API once */
export async function probeHospitalApi(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${resolveApiBase()}/api/v1/sync/status`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    syncAvailable = res.ok;
    return res.ok;
  } catch {
    syncAvailable = false;
    return false;
  }
}

export function isHospitalApiKnown(): boolean | null {
  return syncAvailable;
}

/** Push one or more keys into the shared facility document on the LAN API */
export async function pushFacilityData(
  facilityId: string,
  partial: FacilityBlob
): Promise<boolean> {
  if (!facilityId) return false;
  try {
    const res = await fetch(
      `${resolveApiBase()}/api/v1/sync/facility/${encodeURIComponent(facilityId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: partial }),
      }
    );
    if (res.ok) {
      syncAvailable = true;
      return true;
    }
    syncAvailable = false;
    return false;
  } catch {
    syncAvailable = false;
    return false;
  }
}

/** Pull shared facility document and apply keys into localStorage */
export async function pullFacilityData(
  facilityId: string,
  applyKey: (key: string, value: unknown) => void
): Promise<{ ok: boolean; updatedAt: string | null }> {
  if (!facilityId) return { ok: false, updatedAt: null };
  try {
    const res = await fetch(
      `${resolveApiBase()}/api/v1/sync/facility/${encodeURIComponent(facilityId)}`,
      { method: 'GET' }
    );
    if (!res.ok) {
      syncAvailable = false;
      return { ok: false, updatedAt: null };
    }
    syncAvailable = true;
    const json = await res.json();
    const updatedAt = json?.data?.updatedAt as string | null;
    const data = (json?.data?.data || {}) as FacilityBlob;
    if (updatedAt && updatedAt === lastKnownServerUpdatedAt) {
      return { ok: true, updatedAt };
    }
    lastKnownServerUpdatedAt = updatedAt;
    lastPullAt = Date.now();
    for (const [k, v] of Object.entries(data)) {
      applyKey(k, v);
    }
    return { ok: true, updatedAt };
  } catch {
    syncAvailable = false;
    return { ok: false, updatedAt: null };
  }
}

/** Start background pull every `intervalMs` for the hospital facility */
export function startFacilitySyncLoop(
  facilityId: string,
  applyKey: (key: string, value: unknown) => void,
  intervalMs = 4000
): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    await pullFacilityData(facilityId, applyKey);
  };
  tick();
  const id = setInterval(tick, intervalMs);
  const unsubLocal = subscribeLocal(facilityId, applyKey);
  return () => {
    stopped = true;
    clearInterval(id);
    unsubLocal();
  };
}

export function getLastPullAgeMs(): number {
  if (!lastPullAt) return -1;
  return Date.now() - lastPullAt;
}
