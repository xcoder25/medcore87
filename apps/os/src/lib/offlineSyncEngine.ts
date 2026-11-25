/**
 * Rural Offline-First Sync Queue & Deterministic Conflict Resolver (`apps/os`).
 * Queues facility writes in persistent browser storage during network blackouts
 * and replays them safely when connectivity returns without double-dispensing or PHI loss.
 */

export type OfflineMutationDomain =
  | 'patient_registration'
  | 'vitals_triage'
  | 'anc_visit'
  | 'lab_result'
  | 'pharmacy_dispense'
  | 'appointment_booking';

export interface OfflineQueuedMutation {
  id: string;
  facilityId: string;
  domain: OfflineMutationDomain;
  entityId: string;
  clientUpdatedAt: string;
  payload: Record<string, unknown>;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  attempts: number;
  status: 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed';
  conflictNote?: string;
  lastError?: string;
}

export interface ConflictResolutionDecision {
  winner: 'client' | 'server' | 'merged';
  mergedPayload: Record<string, unknown>;
  reason: string;
}

const STORAGE_KEY = 'medcore_os_rural_offline_queue_v1';
let memoryQueue: OfflineQueuedMutation[] = [];

function stableId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `OFF-${(h >>> 0).toString(36).toUpperCase().padStart(7, '0')}`;
}

function loadQueue(): OfflineQueuedMutation[] {
  if (typeof window === 'undefined') return [...memoryQueue];
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [...memoryQueue];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryQueue = parsed as OfflineQueuedMutation[];
    }
  } catch {
    // ignore storage errors
  }
  return [...memoryQueue];
}

function saveQueue(next: OfflineQueuedMutation[]): void {
  memoryQueue = [...next];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('medcore:offline-sync-updated'));
    } catch {
      // ignore quota/private mode errors
    }
  }
}

export function resolveOfflineConflictDeterministic(
  clientRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown>,
  domain: OfflineMutationDomain
): ConflictResolutionDecision {
  // Rule 1: Pharmacy dispensing NEVER double-dispenses
  if (domain === 'pharmacy_dispense') {
    if (String(serverRecord.status || '').toLowerCase() === 'dispensed') {
      return {
        winner: 'server',
        mergedPayload: { ...serverRecord },
        reason: 'Dispense already committed on server; duplicate dispense blocked to prevent double stock deduction.',
      };
    }
  }

  // Rule 2: Patient registration performs additive union of allergies & chronic conditions + preserves assigned SHID/hospitalNumber
  if (domain === 'patient_registration') {
    const unionArr = (a: unknown, b: unknown): string[] => {
      const set = new Set<string>();
      for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
        const clean = String(item || '').trim();
        if (clean) set.add(clean);
      }
      return Array.from(set);
    };

    const mergedPayload: Record<string, unknown> = {
      ...serverRecord,
      ...clientRecord,
      hospitalNumber: serverRecord.hospitalNumber || clientRecord.hospitalNumber,
      shid: serverRecord.shid || clientRecord.shid,
      allergies: unionArr(serverRecord.allergies, clientRecord.allergies),
      chronicConditions: unionArr(serverRecord.chronicConditions, clientRecord.chronicConditions),
      currentMedications: unionArr(serverRecord.currentMedications, clientRecord.currentMedications),
    };
    return {
      winner: 'merged',
      mergedPayload,
      reason: 'Merged patient identifiers with union of allergies, chronic conditions, and medications.',
    };
  }

  // Rule 3: Clinical timestamps last-write-wins with combined notes preservation
  const clientMs = Date.parse(String(clientRecord.updatedAt || clientRecord.clientUpdatedAt || '')) || 0;
  const serverMs = Date.parse(String(serverRecord.updatedAt || '')) || 0;
  const winner: 'client' | 'server' = clientMs >= serverMs ? 'client' : 'server';
  const base = winner === 'client' ? { ...serverRecord, ...clientRecord } : { ...clientRecord, ...serverRecord };
  const cNote = String(clientRecord.notes || '').trim();
  const sNote = String(serverRecord.notes || '').trim();
  if (cNote && sNote && cNote !== sNote) {
    base.notes = `${sNote} | Offline addendum: ${cNote}`;
  }

  return {
    winner,
    mergedPayload: base,
    reason: `Resolved via wall-clock timestamp comparison (${winner} newer).`,
  };
}

export function enqueueOfflineMutation(input: {
  facilityId: string;
  domain: OfflineMutationDomain;
  entityId: string;
  payload: Record<string, unknown>;
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  clientUpdatedAt?: string;
}): OfflineQueuedMutation {
  const queue = loadQueue();
  const clientUpdatedAt = input.clientUpdatedAt || new Date().toISOString();
  const id = stableId(`${input.facilityId}|${input.domain}|${input.entityId}|${clientUpdatedAt}|${queue.length}`);
  const item: OfflineQueuedMutation = {
    id,
    facilityId: input.facilityId,
    domain: input.domain,
    entityId: input.entityId,
    clientUpdatedAt,
    payload: input.payload,
    endpoint: input.endpoint,
    method: input.method || 'POST',
    attempts: 0,
    status: 'queued',
  };
  saveQueue([...queue, item]);
  return item;
}

export function listOfflineQueue(facilityId?: string): OfflineQueuedMutation[] {
  const all = loadQueue();
  return facilityId ? all.filter((m) => m.facilityId === facilityId) : all;
}

export function getOfflineSyncStats(facilityId?: string) {
  const rows = listOfflineQueue(facilityId);
  return {
    total: rows.length,
    pendingCount: rows.filter((r) => r.status === 'queued' || r.status === 'syncing' || r.status === 'failed').length,
    conflictCount: rows.filter((r) => r.status === 'conflict').length,
    syncedCount: rows.filter((r) => r.status === 'synced').length,
  };
}

export async function flushOfflineQueue(
  facilityId?: string,
  fetchImpl: typeof fetch = fetch
): Promise<{
  processed: number;
  synced: number;
  conflicts: number;
  failed: number;
}> {
  const queue = loadQueue();
  let processed = 0;
  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    if (facilityId && item.facilityId !== facilityId) continue;
    if (item.status === 'synced') continue;

    processed += 1;
    item.attempts += 1;
    item.status = 'syncing';

    try {
      const res = await fetchImpl(item.endpoint, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { serverRecord?: Record<string, unknown> };
        const decision = resolveOfflineConflictDeterministic(
          item.payload,
          body.serverRecord || {},
          item.domain
        );
        if (decision.winner === 'server') {
          item.status = 'conflict';
          item.conflictNote = decision.reason;
          conflicts += 1;
        } else {
          // Replay merged payload once
          const retry = await fetchImpl(item.endpoint, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(decision.mergedPayload),
          });
          if (retry.ok) {
            item.status = 'synced';
            item.conflictNote = decision.reason;
            synced += 1;
          } else {
            item.status = 'conflict';
            item.conflictNote = decision.reason;
            conflicts += 1;
          }
        }
      } else if (res.ok) {
        item.status = 'synced';
        item.lastError = undefined;
        synced += 1;
      } else {
        item.status = 'failed';
        item.lastError = `HTTP ${res.status}`;
        failed += 1;
      }
    } catch (err) {
      item.status = 'failed';
      item.lastError = (err as Error)?.message || 'Network unavailable';
      failed += 1;
    }
  }

  saveQueue(queue);
  return { processed, synced, conflicts, failed };
}

export function clearSyncedOfflineMutations(facilityId?: string): void {
  const queue = loadQueue().filter((item) => {
    if (facilityId && item.facilityId !== facilityId) return true;
    return item.status !== 'synced';
  });
  saveQueue(queue);
}
