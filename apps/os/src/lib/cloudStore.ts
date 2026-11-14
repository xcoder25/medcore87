/**
 * Unified Cloud + On-Prem LAN Hub Storage Layer (`cloudStore.ts`).
 *
 * Replaces browser `localStorage` completely as a data store.
 * - Source of truth: Cloud API (`/api/facility/sync` → Aurora Postgres / Server Vault)
 *   + On-Prem LAN Hub (`hospitalSync` `/api/v1/sync/facility/:facilityId`).
 * - In-browser cache: Session RAM only (`memGet` / `memSet` in `edgeCloudOnly.ts`).
 * - Nothing clinical, operational, or sensitive is ever written to `window.localStorage`.
 */

import { memGet, memSet, memRemove } from './edgeCloudOnly';
import { pushFacilityData, pullFacilityData, isLanApiEligible, broadcastLocal } from './hospitalSync';

type SubscriberCallback<T = unknown> = (val: T | null) => void;
const keySubscribers = new Map<string, Set<SubscriberCallback>>();

function scopedRamKey(facilityId: string, key: string): string {
  if (!facilityId || key.includes(facilityId)) return key;
  return `${key}:${facilityId}`;
}

function notifySubscribers(key: string, value: unknown): void {
  const subs = keySubscribers.get(key);
  if (subs) {
    subs.forEach((cb) => {
      try {
        cb(value);
      } catch {
        /* ignore */
      }
    });
  }
}

/**
 * Synchronous read from Session RAM cache (hydrated from Cloud + On-Prem on boot).
 */
export function csGet<T>(facilityId: string, key: string, fallback?: T): T | null {
  if (typeof window === 'undefined') return fallback ?? null;
  const scoped = scopedRamKey(facilityId, key);
  const raw = memGet(scoped) ?? memGet(key);
  if (!raw) return fallback ?? null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return (raw as unknown as T) ?? fallback ?? null;
  }
}

/**
 * Write to Session RAM immediately + asynchronously persist to Cloud & On-Prem LAN Hub.
 */
export function csSet<T>(facilityId: string, key: string, value: T): void {
  if (typeof window === 'undefined') return;
  const fid = facilityId || 'DEFAULT';
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const scoped = scopedRamKey(fid, key);

  memSet(scoped, serialized);
  memSet(key, serialized);
  notifySubscribers(key, value);
  notifySubscribers(scoped, value);

  // Sync to Cloud + On-Prem LAN Hub
  syncKeyToCloudAndPrem(fid, key, value);
}

/**
 * Remove a key from Session RAM, Cloud, and On-Prem LAN Hub.
 */
export function csRemove(facilityId: string, key: string): void {
  if (typeof window === 'undefined') return;
  const fid = facilityId || 'DEFAULT';
  const scoped = scopedRamKey(fid, key);
  memRemove(scoped);
  memRemove(key);
  notifySubscribers(key, null);
  notifySubscribers(scoped, null);

  void (async () => {
    try {
      await fetch(
        `/api/facility/sync?facilityId=${encodeURIComponent(fid)}&key=${encodeURIComponent(key)}`,
        { method: 'DELETE' }
      );
    } catch {
      /* ignore */
    }
  })();
}

/**
 * Subscribe to live updates for a key across Cloud, On-Prem LAN, and same-PC tabs.
 */
export function csSubscribe<T = unknown>(
  facilityId: string,
  key: string,
  cb: SubscriberCallback<T>
): () => void {
  const scoped = scopedRamKey(facilityId, key);
  if (!keySubscribers.has(key)) keySubscribers.set(key, new Set());
  if (!keySubscribers.has(scoped)) keySubscribers.set(scoped, new Set());
  keySubscribers.get(key)!.add(cb as SubscriberCallback);
  keySubscribers.get(scoped)!.add(cb as SubscriberCallback);

  return () => {
    keySubscribers.get(key)?.delete(cb as SubscriberCallback);
    keySubscribers.get(scoped)?.delete(cb as SubscriberCallback);
  };
}

// Debounced batch queue for Cloud + On-Prem writes
const pendingCloudWrites = new Map<string, Record<string, unknown>>();
let cloudFlushTimer: ReturnType<typeof setTimeout> | null = null;

export function syncKeyToCloudAndPrem(facilityId: string, key: string, value: unknown): void {
  if (typeof window === 'undefined' || !facilityId || !key) return;
  // Do not sync transient outbox or internal lock keys
  if (key.startsWith('medcore_os_sync_outbox')) return;

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
  }

  const bag = pendingCloudWrites.get(facilityId) || {};
  bag[key] = parsed;
  pendingCloudWrites.set(facilityId, bag);

  // Same-PC tab broadcast
  try {
    broadcastLocal(facilityId, key, parsed);
  } catch {
    /* ignore */
  }

  if (cloudFlushTimer) clearTimeout(cloudFlushTimer);
  cloudFlushTimer = setTimeout(() => {
    cloudFlushTimer = null;
    void flushCloudAndPremWrites();
  }, 120);
}

export async function flushCloudAndPremWrites(): Promise<void> {
  if (pendingCloudWrites.size === 0) return;
  const entries = Array.from(pendingCloudWrites.entries());
  pendingCloudWrites.clear();

  await Promise.all(
    entries.map(async ([facilityId, data]) => {
      // 1) Cloud API (/api/facility/sync -> Aurora Postgres + Server Vault)
      const cloudPromise = fetch('/api/facility/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, data }),
      }).catch(() => null);

      // 2) On-Prem LAN Hub (when reachable)
      const premPromise = isLanApiEligible()
        ? pushFacilityData(facilityId, data).catch(() => false)
        : Promise.resolve(false);

      await Promise.all([cloudPromise, premPromise]);
    })
  );
}

/**
 * Hydrate all facility state from Cloud (`/api/facility/sync`) and On-Prem LAN Hub
 * directly into Session RAM (`mem`), then invoke `applyKey` so all UI subscribers update.
 */
export async function hydrateFacilityFromCloudAndPrem(
  facilityId: string,
  applyKey: (key: string, value: unknown) => void
): Promise<void> {
  if (typeof window === 'undefined' || !facilityId) return;

  // 1) Pull from Cloud API (/api/facility/sync)
  try {
    const res = await fetch(`/api/facility/sync?facilityId=${encodeURIComponent(facilityId)}`);
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; data?: Record<string, unknown> };
      const data = json.data || {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) {
          applyKey(k, v);
          notifySubscribers(k, v);
        }
      }
    }
  } catch {
    /* offline — fall back to On-Prem LAN Hub */
  }

  // 2) Pull from On-Prem LAN Hub (if configured/reachable)
  if (isLanApiEligible()) {
    try {
      await pullFacilityData(facilityId, (k, v) => {
        applyKey(k, v);
        notifySubscribers(k, v);
      });
    } catch {
      /* ignore */
    }
  }
}
