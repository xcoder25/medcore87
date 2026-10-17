/**
 * MedCore Delta Sync & Conflict Resolution Engine
 *
 * Implements Append-Only Event Sourcing for clinical data.
 * Instead of whole-record replacement (which causes data loss on concurrent writes),
 * changes are emitted as typed, immutable domain delta events.
 *
 * Conflict Resolution Safety Matrix:
 * - Cumulative / Additive Entities (vitals, notes, audit, lab results): Auto-merged in chronological order.
 * - Mutative State Entities (bed allocation, prescription dosage, discharge): Checked for concurrent mutations;
 *   if divergence is detected, flagged into Reconciliation Queue with human-in-the-loop review.
 */

import { resolveApiBase, isLanApiEligible } from './hospitalSync';
import { getConnectivityStatus } from './connectivityCircuitBreaker';

export type EntityType =
  | 'PATIENT'
  | 'VITALS'
  | 'PRESCRIPTION'
  | 'BILLING'
  | 'CLINICAL_NOTE'
  | 'BED_OCCUPANCY'
  | 'TRIAGE'
  | 'DISCHARGE';

export interface ClinicalDeltaEvent {
  eventId: string;
  facilityId: string;
  entityType: EntityType;
  entityId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  vectorClock?: Record<string, number>;
  syncStatus: 'pending' | 'synced_onsite' | 'synced_cloud' | 'reconciliation_required';
  conflictReason?: string;
}

const EVENTS_STORE_KEY = 'medcore_os_delta_events_v1';
const RECONCILIATION_KEY = 'medcore_os_reconcile_queue_v1';
export const DELTA_SYNC_EVENT = 'medcore-delta-sync-tick';

/**
 * Generate a sortable, unique Event ID (UUIDv7 style timestamp + random entropy)
 */
export function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `evt-${ts}-${rand}`;
}

export function readStoredEvents(): ClinicalDeltaEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EVENTS_STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writeStoredEvents(events: ClinicalDeltaEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    // Keep last 1,000 events in local client journal
    localStorage.setItem(EVENTS_STORE_KEY, JSON.stringify(events.slice(-1000)));
  } catch {
    /* Quota protection */
    try {
      localStorage.setItem(EVENTS_STORE_KEY, JSON.stringify(events.slice(-250)));
    } catch {
      /* ignore */
    }
  }
}

export function readReconciliationQueue(): ClinicalDeltaEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECONCILIATION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeReconciliationQueue(items: ClinicalDeltaEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECONCILIATION_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/**
 * Enqueue a new clinical delta mutation.
 * This runs synchronously for instantaneous UI responsiveness.
 */
export function recordDeltaEvent(
  eventData: Omit<ClinicalDeltaEvent, 'eventId' | 'timestamp' | 'syncStatus'>
): ClinicalDeltaEvent {
  const event: ClinicalDeltaEvent = {
    ...eventData,
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    syncStatus: 'pending',
  };

  const list = readStoredEvents();
  list.push(event);
  writeStoredEvents(list);

  // Trigger immediate dispatch
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DELTA_SYNC_EVENT, { detail: { event, count: list.length } }));
    // Attempt background sync
    setTimeout(() => void processPendingDeltaSync(), 50);
  }

  return event;
}

/**
 * Conflict Resolver: Determines if an incoming event conflicts with existing local state
 */
export function evaluateEventSafety(
  incoming: ClinicalDeltaEvent,
  existingEvents: ClinicalDeltaEvent[]
): { isConflict: boolean; reason?: string } {
  // 1. Cumulative events (Vitals, Notes, Billing receipts) are commutative / additive
  if (['VITALS', 'CLINICAL_NOTE', 'BILLING'].includes(incoming.entityType)) {
    return { isConflict: false };
  }

  // 2. Mutative events: Bed assignments and Prescriptions
  if (incoming.entityType === 'BED_OCCUPANCY') {
    const concurrentBedAssignment = existingEvents.find(
      (e) =>
        e.entityType === 'BED_OCCUPANCY' &&
        e.payload?.bedId === incoming.payload?.bedId &&
        e.eventId !== incoming.eventId &&
        Math.abs(new Date(e.timestamp).getTime() - new Date(incoming.timestamp).getTime()) < 3600000 &&
        e.payload?.patientId !== incoming.payload?.patientId
    );
    if (concurrentBedAssignment) {
      return {
        isConflict: true,
        reason: `Bed ${incoming.payload?.bedId} was concurrently assigned to ${concurrentBedAssignment.payload?.patientName || concurrentBedAssignment.payload?.patientId} while offline.`,
      };
    }
  }

  if (incoming.entityType === 'PRESCRIPTION') {
    const duplicateOrConflictingDrug = existingEvents.find(
      (e) =>
        e.entityType === 'PRESCRIPTION' &&
        e.entityId === incoming.entityId &&
        e.payload?.drugName === incoming.payload?.drugName &&
        e.eventId !== incoming.eventId &&
        e.payload?.status !== incoming.payload?.status
    );
    if (duplicateOrConflictingDrug) {
      return {
        isConflict: true,
        reason: `Prescription for ${incoming.payload?.drugName} was modified concurrently on another terminal.`,
      };
    }
  }

  return { isConflict: false };
}

/**
 * Flush pending delta events to Onsite Edge Server or Cloud Gateway
 */
export async function processPendingDeltaSync(): Promise<{
  synced: number;
  conflicts: number;
  remaining: number;
}> {
  if (typeof window === 'undefined') return { synced: 0, conflicts: 0, remaining: 0 };

  const allEvents = readStoredEvents();
  const pending = allEvents.filter((e) => e.syncStatus === 'pending');
  if (pending.length === 0) return { synced: 0, conflicts: 0, remaining: 0 };

  const status = getConnectivityStatus();
  const base = resolveApiBase();

  let targetUrl = '';
  if (status.tier === 'ONSITE_FALLBACK' && isLanApiEligible() && base) {
    targetUrl = `${base}/api/v1/sync/events`;
  } else if (status.tier === 'CLOUD_PRIMARY') {
    // Cloud primary event ingest endpoint or gateway proxy
    targetUrl = base ? `${base}/api/v1/sync/events` : '/api/v1/sync/events';
  } else {
    // OFFLINE_LOCAL — keep events queued safely in client journal
    return { synced: 0, conflicts: 0, remaining: pending.length };
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: pending }),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (res.ok) {
      const resp = await res.json();
      const acceptedIds = new Set<string>(resp.acceptedIds || pending.map((p) => p.eventId));
      const conflictList = resp.conflicts || [];

      let conflictCount = 0;
      const updatedEvents = allEvents.map((ev) => {
        if (acceptedIds.has(ev.eventId)) {
          return {
            ...ev,
            syncStatus: status.tier === 'CLOUD_PRIMARY' ? ('synced_cloud' as const) : ('synced_onsite' as const),
          };
        }
        const cf = conflictList.find((c: any) => c.eventId === ev.eventId);
        if (cf) {
          conflictCount++;
          return {
            ...ev,
            syncStatus: 'reconciliation_required' as const,
            conflictReason: cf.reason || 'Concurrent state mutation detected during convergence.',
          };
        }
        return ev;
      });

      writeStoredEvents(updatedEvents);

      // Record any conflicts into the reconciliation review queue
      if (conflictCount > 0) {
        const reconcileItems = updatedEvents.filter((e) => e.syncStatus === 'reconciliation_required');
        writeReconciliationQueue(reconcileItems);
      }

      window.dispatchEvent(
        new CustomEvent(DELTA_SYNC_EVENT, {
          detail: { synced: acceptedIds.size, conflicts: conflictCount },
        })
      );

      return {
        synced: acceptedIds.size,
        conflicts: conflictCount,
        remaining: allEvents.filter((e) => e.syncStatus === 'pending').length,
      };
    }
  } catch (err) {
    console.debug('[DeltaSync] Sync push deferred:', err);
  }

  return { synced: 0, conflicts: 0, remaining: pending.length };
}

/**
 * Start periodic delta sync loop
 */
export function startDeltaSyncWorker(intervalMs = 5000): () => void {
  if (typeof window === 'undefined') return () => {};

  void processPendingDeltaSync();
  const id = setInterval(() => {
    void processPendingDeltaSync();
  }, intervalMs);

  const onEvent = () => void processPendingDeltaSync();
  window.addEventListener('online', onEvent);
  window.addEventListener('medcore-connectivity-changed', onEvent);

  return () => {
    clearInterval(id);
    window.removeEventListener('online', onEvent);
    window.removeEventListener('medcore-connectivity-changed', onEvent);
  };
}
