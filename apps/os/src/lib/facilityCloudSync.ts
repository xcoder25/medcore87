/**
 * Same-hospital live sync — when online, all workstations share facility data via Firestore
 * without requiring a browser reload.
 *
 * Pipeline:
 *  local write → publishFacilityData → outbox → Firestore
 *  Firestore onSnapshot → apply to localStorage → domain events → UI subscribers
 */
import { firestoreSubscribeFacility, enableFirestoreOffline } from './firebase';
import { startFacilitySyncLoop, probeHospitalApi } from './hospitalSync';
import { startOutboxAutoFlush, flushOutbox } from './durableOutbox';
import { FACILITY_KEYS } from './roleSyncBus';

/** Map storage keys → CustomEvents so existing subscribe*() hooks refresh live */
const KEY_EVENTS: Record<string, string[]> = {
  [FACILITY_KEYS.patients]: ['medcore-patients-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.reception]: ['medcore-reception-ops', 'medcore-admin-sync'],
  medcore_os_reception_ops_v1: ['medcore-reception-ops', 'medcore-admin-sync'],
  [FACILITY_KEYS.clinical]: ['medcore-clinical-orders', 'medcore-admin-sync'],
  [FACILITY_KEYS.beds]: ['medcore-bed-board', 'medcore-admin-sync'],
  [FACILITY_KEYS.ambulance]: ['medcore-ambulance', 'medcore-admin-sync'],
  [FACILITY_KEYS.staff]: ['medcore-staff-cards-updated', 'medcore-admin-sync'],
  medcore_staff_id_cards: ['medcore-staff-cards-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.notifications]: ['medcore-notifications', 'medcore-admin-sync'],
  medcore_os_notifications_v1: ['medcore-notifications', 'medcore-admin-sync'],
  [FACILITY_KEYS.audit]: ['medcore-admin-sync'],
  [FACILITY_KEYS.facilityCatalog]: ['medcore-facility-catalog', 'medcore-admin-sync'],
};

function emitForKey(key: string, value: unknown) {
  const events = KEY_EVENTS[key] || ['medcore-admin-sync'];
  for (const name of events) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: name.includes('sync') ? { key } : value }));
    } catch {
      /* ignore */
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('medcore-facility-cloud', { detail: { key } }));
  } catch {
    /* ignore */
  }
}

/**
 * Apply a remote facility document field into localStorage and notify UI.
 * Skips identical payloads to avoid feedback loops.
 */
export function applyFacilityRemoteKey(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  if (value === undefined || value === null) return;
  if (key === 'updatedAt' || key === 'resetAt') return;
  try {
    const next = JSON.stringify(value);
    const prev = localStorage.getItem(key);
    if (prev === next) return;
    localStorage.setItem(key, next);
    emitForKey(key, value);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Start hospital-wide cloud + LAN sync for this facility.
 * Safe to call once per session; returns cleanup.
 */
export function startHospitalCloudSync(facilityId: string): () => void {
  if (typeof window === 'undefined' || !facilityId) return () => {};

  void enableFirestoreOffline();
  const stopOutbox = startOutboxAutoFlush(2500);
  void flushOutbox();

  const applyKey = (key: string, value: unknown) => applyFacilityRemoteKey(key, value);

  // LAN hub (when available on hospital network)
  const stopLan = startFacilitySyncLoop(facilityId, applyKey, 2500);
  void probeHospitalApi();

  // Cloud realtime — other PCs / phones on same hospital
  const stopFs = firestoreSubscribeFacility(facilityId, (data) => {
    for (const [k, v] of Object.entries(data || {})) {
      applyKey(k, v);
    }
  });

  const onOnline = () => {
    void flushOutbox();
  };
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('online', onOnline);
    stopLan();
    stopFs();
    stopOutbox();
  };
}
