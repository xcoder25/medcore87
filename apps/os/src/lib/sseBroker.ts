/**
 * Real-Time Server-Sent Events (SSE) Broker for MedCore OS.
 * Provides sub-100ms push notifications to all connected hospital workstations
 * when facility state, clinical orders, vitals, or audit entries change.
 */

export interface FacilitySseEvent {
  id: string;
  facilityId: string;
  key: string;
  value?: unknown;
  updatedAt: string;
  actor?: string;
}

type Listener = (event: FacilitySseEvent) => void;

const globalForSse = globalThis as unknown as {
  __medcoreSseListeners?: Map<string, Set<Listener>>;
};

function getListenerMap(): Map<string, Set<Listener>> {
  if (!globalForSse.__medcoreSseListeners) {
    globalForSse.__medcoreSseListeners = new Map();
  }
  return globalForSse.__medcoreSseListeners;
}

export function subscribeFacilityStream(facilityId: string, listener: Listener): () => void {
  const fid = String(facilityId || 'DEFAULT').trim().toUpperCase();
  const map = getListenerMap();
  if (!map.has(fid)) {
    map.set(fid, new Set());
  }
  const set = map.get(fid)!;
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      map.delete(fid);
    }
  };
}

export function publishFacilitySseEvent(event: Omit<FacilitySseEvent, 'id' | 'updatedAt'> & { updatedAt?: string }): void {
  const fid = String(event.facilityId || 'DEFAULT').trim().toUpperCase();
  const payload: FacilitySseEvent = {
    id: `SSE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    facilityId: fid,
    key: event.key,
    value: event.value,
    updatedAt: event.updatedAt || new Date().toISOString(),
    actor: event.actor,
  };

  const map = getListenerMap();
  const listeners = map.get(fid);
  if (listeners && listeners.size > 0) {
    for (const listener of Array.from(listeners)) {
      try {
        listener(payload);
      } catch {
        /* ignore closed stream */
      }
    }
  }
}
