/**
 * Sync outbox — brief offline catch-up only (edge + cloud mode).
 *
 * Heavy payloads are NOT written to durable localStorage (edgeCloudOnly shim
 * keeps OUTBOX_KEY in session RAM). When online, publishFacilityData writes
 * Firestore directly and skips enqueue.
 */

import { firestoreWriteFacility } from './firebase';
import { pushFacilityData, isLanApiEligible } from './hospitalSync';
import { isCriticalFacilityKey } from './poorNetwork';

const OUTBOX_KEY = 'medcore_os_sync_outbox_v1';

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush(delayMs = 60) {
  if (typeof window === 'undefined') return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushOutbox();
  }, delayMs);
}


export type OutboxItem = {
  id: string;
  facilityId: string;
  key: string;
  value: unknown;
  createdAt: string;
  attempts: number;
};

function readOutbox(): OutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-200)));
  } catch {
    /* quota — drop oldest */
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-50)));
    } catch {
      /* ignore */
    }
  }
}

/** Call after localStorage write — queues cloud sync without blocking UI */
export function enqueueFacilitySync(
  facilityId: string,
  key: string,
  value: unknown
): void {
  if (typeof window === 'undefined' || !facilityId) return;
  // Drop non-critical keys — poor networks must not queue analytics-sized blobs
  if (!isCriticalFacilityKey(key)) return;
  const items = readOutbox();
  // Coalesce: keep only latest value per facility+key
  const filtered = items.filter(
    (i) => !(i.facilityId === facilityId && i.key === key)
  );
  filtered.push({
    id: `obx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    facilityId,
    key,
    value,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  writeOutbox(filtered);
  // Micro-batch then flush (keeps multi-key writes fast without stampeding)
  scheduleFlush(typeof navigator !== 'undefined' && navigator.onLine ? 40 : 400);
}

export function getOutboxPendingCount(): number {
  return readOutbox().length;
}

/** Push pending items to Firestore + LAN; remove only on success */
export async function flushOutbox(): Promise<{ synced: number; remaining: number }> {
  if (typeof window === 'undefined') return { synced: 0, remaining: 0 };

  const online = typeof navigator === 'undefined' || navigator.onLine;
  // ISP blackout: still try LAN hub if configured; only skip when no path at all
  if (!online && !isLanApiEligible()) {
    return { synced: 0, remaining: readOutbox().length };
  }

  const items = readOutbox().filter((i) => isCriticalFacilityKey(i.key));
  if (items.length === 0) {
    writeOutbox([]);
    return { synced: 0, remaining: 0 };
  }

  // Group by facility for fewer writes
  const byFacility = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const bag = byFacility.get(item.facilityId) || {};
    bag[item.key] = item.value;
    byFacility.set(item.facilityId, bag);
  }

  let synced = 0;
  const failedFacilities = new Set<string>();

  for (const [facilityId, partial] of Array.from(byFacility)) {
    // Hospital hub first (LAN), then cloud — matches "UPS hub is source of truth on site"
    let okLan = false;
    try {
      okLan = await pushFacilityData(facilityId, partial);
    } catch {
      okLan = false;
    }
    // Skip cloud when browser reports offline (avoids long hangs on 2G blackhole routes)
    const okFs = online ? await firestoreWriteFacility(facilityId, partial) : false;
    // Success if either hub or cloud accepted
    if (okLan || okFs) {
      synced += Object.keys(partial).length;
    } else {
      failedFacilities.add(facilityId);
    }
  }

  const remaining = items
    .filter((i) => failedFacilities.has(i.facilityId))
    .map((i) => ({ ...i, attempts: i.attempts + 1 }));
  writeOutbox(remaining);

  return { synced, remaining: remaining.length };
}

/** Start listeners: flush when network returns + periodic retry */
export function startOutboxAutoFlush(intervalMs = 20000): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => {
    void flushOutbox();
  };
  window.addEventListener('online', onOnline);

  // Flush soon after load (covers “power restored, browser reopened”)
  void flushOutbox();
  const id = setInterval(() => {
    void flushOutbox();
  }, intervalMs);

  // Best-effort flush before tab close
  const onUnload = () => {
    void flushOutbox();
  };
  window.addEventListener('beforeunload', onUnload);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('beforeunload', onUnload);
    clearInterval(id);
  };
}
