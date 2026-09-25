/**
 * Durable outbox — survives power loss / offline on this PC.
 *
 * Order of safety:
 * 1. Write to localStorage immediately (sync) — data is on disk in the browser profile.
 * 2. Enqueue the same change for cloud/LAN sync.
 * 3. When online, flush the outbox to Firestore (and optional LAN API).
 * 4. Firestore IndexedDB persistence also keeps a second offline copy.
 *
 * Power outage mid-type: only the last uncommitted keystroke may be lost;
 * every completed Save/Approve/Enrol is already in localStorage before the UI confirms.
 */

import { firestoreWriteFacility } from './firebase';
import { pushFacilityData } from './hospitalSync';

const OUTBOX_KEY = 'medcore_os_sync_outbox_v1';

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
  // Opportunistic flush
  void flushOutbox();
}

export function getOutboxPendingCount(): number {
  return readOutbox().length;
}

/** Push pending items to Firestore + LAN; remove only on success */
export async function flushOutbox(): Promise<{ synced: number; remaining: number }> {
  if (typeof window === 'undefined') return { synced: 0, remaining: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, remaining: readOutbox().length };
  }

  const items = readOutbox();
  if (items.length === 0) return { synced: 0, remaining: 0 };

  // Group by facility for fewer writes
  const byFacility = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const bag = byFacility.get(item.facilityId) || {};
    bag[item.key] = item.value;
    byFacility.set(item.facilityId, bag);
  }

  let synced = 0;
  const failedFacilities = new Set<string>();

  for (const [facilityId, partial] of byFacility) {
    const okFs = await firestoreWriteFacility(facilityId, partial);
    // LAN is best-effort
    try {
      await pushFacilityData(facilityId, partial);
    } catch {
      /* ignore */
    }
    if (okFs) {
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
export function startOutboxAutoFlush(intervalMs = 15000): () => void {
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
