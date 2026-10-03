/**
 * Same-hospital shared data (offline-first on the hospital LAN).
 * On Vercel / public hosts: LAN API is disabled unless NEXT_PUBLIC_API_URL is set.
 */

export type FacilityBlob = Record<string, unknown>;

let lastPullAt = 0;
let lastKnownServerUpdatedAt: string | null = null;
let syncAvailable: boolean | null = null;
let lastProbeFailAt = 0;
const PROBE_COOLDOWN_MS = 120_000;

/** True only when a real hospital hub URL is configured or we are on localhost. */
export function isLanApiEligible(): boolean {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  }
  // SSR: never assume LAN
  return false;
}

export function resolveApiBase(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return String(process.env.NEXT_PUBLIC_API_URL).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:4000';
  }
  return '';
}

function facilityChannel(facilityId: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(`medcore-facility-${facilityId}`);
  } catch {
    return null;
  }
}

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

export async function probeHospitalApi(): Promise<boolean> {
  if (!isLanApiEligible()) {
    syncAvailable = false;
    return false;
  }
  if (syncAvailable === false && Date.now() - lastProbeFailAt < PROBE_COOLDOWN_MS) {
    return false;
  }
  const base = resolveApiBase();
  if (!base) {
    syncAvailable = false;
    return false;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${base}/api/v1/sync/status`, { signal: ctrl.signal });
    clearTimeout(t);
    syncAvailable = res.ok;
    if (!res.ok) lastProbeFailAt = Date.now();
    return res.ok;
  } catch {
    syncAvailable = false;
    lastProbeFailAt = Date.now();
    return false;
  }
}

export function isHospitalApiKnown(): boolean | null {
  return syncAvailable;
}

export async function pushFacilityData(
  facilityId: string,
  partial: FacilityBlob
): Promise<boolean> {
  if (!isLanApiEligible()) return false;
  const base = resolveApiBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/v1/sync/facility/${encodeURIComponent(facilityId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: partial, updatedAt: new Date().toISOString() }),
    });
    if (res.ok) {
      syncAvailable = true;
      return true;
    }
    syncAvailable = false;
    lastProbeFailAt = Date.now();
    return false;
  } catch {
    syncAvailable = false;
    lastProbeFailAt = Date.now();
    return false;
  }
}

export async function pullFacilityData(
  facilityId: string,
  applyKey: (key: string, value: unknown) => void
): Promise<{ ok: boolean; updatedAt: string | null }> {
  if (!isLanApiEligible()) return { ok: false, updatedAt: null };
  const base = resolveApiBase();
  if (!base) return { ok: false, updatedAt: null };
  try {
    const res = await fetch(`${base}/api/v1/sync/facility/${encodeURIComponent(facilityId)}`, {
      method: 'GET',
    });
    if (!res.ok) {
      syncAvailable = false;
      lastProbeFailAt = Date.now();
      return { ok: false, updatedAt: null };
    }
    syncAvailable = true;
    const json = (await res.json()) as { data?: FacilityBlob; updatedAt?: string };
    const data = json.data || {};
    const updatedAt = json.updatedAt || null;
    if (updatedAt && updatedAt === lastKnownServerUpdatedAt) {
      lastPullAt = Date.now();
      return { ok: true, updatedAt };
    }
    lastKnownServerUpdatedAt = updatedAt;
    lastPullAt = Date.now();
    for (const [k, v] of Object.entries(data)) {
      if (k === 'updatedAt') continue;
      applyKey(k, v);
    }
    return { ok: true, updatedAt };
  } catch {
    syncAvailable = false;
    lastProbeFailAt = Date.now();
    return { ok: false, updatedAt: null };
  }
}

/** Background pull — no-ops on hosted sites without NEXT_PUBLIC_API_URL */
export function startFacilitySyncLoop(
  facilityId: string,
  applyKey: (key: string, value: unknown) => void,
  intervalMs = 15000
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const unsubLocal = subscribeLocal(facilityId, applyKey);

  const tick = async () => {
    if (stopped) return;
    if (!isLanApiEligible()) return;
    const ok = await probeHospitalApi();
    if (!ok) return;
    await pullFacilityData(facilityId, applyKey);
  };

  void tick();
  timer = setInterval(tick, Math.max(intervalMs, 15000));

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    unsubLocal();
  };
}

export function getLastPullAgeMs(): number {
  if (!lastPullAt) return -1;
  return Date.now() - lastPullAt;
}
