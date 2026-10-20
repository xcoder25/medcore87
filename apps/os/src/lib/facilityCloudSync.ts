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
import { applyHimRemote, HIM_STORAGE_KEY } from './himStore';
import { mergePresenceMaps, STAFF_PRESENCE_KEY } from './staffPresenceStore';
import {
  applyCloudStaffDirectory,
  isStaffFlushLocked,
  syncAccessRosterFromSources,
} from './staffCardStore';

/** Map storage keys → CustomEvents so existing subscribe*() hooks refresh live */
const KEY_EVENTS: Record<string, string[]> = {
  [FACILITY_KEYS.patients]: ['medcore-patients-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.reception]: ['medcore-reception-ops', 'medcore-admin-sync'],
  medcore_os_reception_ops_v1: ['medcore-reception-ops', 'medcore-admin-sync'], // legacy key
  [FACILITY_KEYS.clinical]: ['medcore-clinical-orders', 'medcore-admin-sync'],
  [FACILITY_KEYS.beds]: ['medcore-bed-board', 'medcore-admin-sync'],
  [FACILITY_KEYS.ambulance]: ['medcore-ambulance', 'medcore-admin-sync'],
  [FACILITY_KEYS.staff]: ['medcore-staff-cards-updated', 'medcore-admin-sync'],
  medcore_staff_id_cards: ['medcore-staff-cards-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.notifications]: ['medcore-notifications', 'medcore-admin-sync'],
  medcore_os_staff_presence_v1: ['medcore-staff-presence', 'medcore-admin-sync'],
  medcore_os_transfers: ['medcore-transfers-updated', 'medcore-admin-sync'],
  medcore_os_payment_receipts_v1: ['medcore-payment-receipts', 'medcore-admin-sync'],
  medcore_os_fd_accounts_requests_v1: ['medcore-fd-accounts', 'medcore-admin-sync'],
  medcore_os_patient_bills_v1: ['medcore-patient-bills', 'medcore-admin-sync'],
  medcore_os_formulary_v1: ['medcore-formulary', 'medcore-admin-sync'],
  medcore_os_drug_stock_v1: ['medcore-formulary', 'medcore-admin-sync'],
  medcore_os_pharmacy_stock_log_v1: ['medcore-pharmacy-log', 'medcore-formulary', 'medcore-admin-sync'],
  [FACILITY_KEYS.audit]: ['medcore-admin-sync'],
  [FACILITY_KEYS.facilityCatalog]: ['medcore-facility-catalog', 'medcore-admin-sync'],
  [FACILITY_KEYS.onboarding]: ['medcore-onboarding-sync', 'medcore-admin-sync'],
  [FACILITY_KEYS.onboardingDraft]: ['medcore-onboarding-sync', 'medcore-admin-sync'],
  [FACILITY_KEYS.ancPlans]: ['medcore-anc-plans', 'medcore-admin-sync'],
  [FACILITY_KEYS.ancSmsPrefs]: ['medcore-anc-plans', 'medcore-admin-sync'],
  [FACILITY_KEYS.him]: ['medcore-him-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.theatre]: ['medcore-theatre-cases', 'medcore-admin-sync'],
  // Nursing vitals — triage station on separate device writes here
  [FACILITY_KEYS.vitals]: ['medcore-vitals', 'medcore-admin-sync'],
  clinical_vitals: ['medcore-vitals', 'medcore-admin-sync'],
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
  if (key === HIM_STORAGE_KEY || key === FACILITY_KEYS.him || key === 'medcore_os_him_v1') {
    applyHimRemote(value);
    emitForKey(key, value);
    return;
  }
  // Redirect the 'clinical_vitals' alias to the canonical localStorage key used by nursingVitalsStore
  const canonicalKey =
    key === 'clinical_vitals' ? FACILITY_KEYS.vitals : key;

  // Protect staff data from destructive overwrite
  const cKey = String(canonicalKey);
  if (
    cKey === 'medcore_os_access_control' ||
    cKey === 'medcore_os_staff_registry' ||
    cKey === 'medcore_staff_id_cards' ||
    cKey === 'medcore_os_staff_cards' ||
    cKey === 'medcore_staff_cards'
  ) {
    if (!Array.isArray(value) || value.length === 0) {
      if (!isStaffFlushLocked()) return;
    }
    try {
      if (
        cKey === 'medcore_staff_id_cards' ||
        cKey === 'medcore_os_staff_cards' ||
        cKey === 'medcore_staff_cards'
      ) {
        applyCloudStaffDirectory({ staffCards: value as any[] });
        return;
      }
      if (cKey === 'medcore_os_staff_registry') {
        applyCloudStaffDirectory({ staffRegistry: value as any[] });
        return;
      }
      if (cKey === 'medcore_os_access_control') {
        syncAccessRosterFromSources('');
        return;
      }
    } catch {
      /* ignore */
    }
  }
  try {
    // Presence maps must MERGE (not replace) so multi-PC logins all stay visible
    if (canonicalKey === STAFF_PRESENCE_KEY && value && typeof value === 'object') {
      let local: Record<string, unknown> = {};
      try {
        local = JSON.parse(localStorage.getItem(canonicalKey) || '{}') || {};
      } catch {
        local = {};
      }
      const merged = mergePresenceMaps(
        local as Parameters<typeof mergePresenceMaps>[0],
        value as Parameters<typeof mergePresenceMaps>[0]
      );
      const next = JSON.stringify(merged);
      const prev = localStorage.getItem(canonicalKey);
      if (prev === next) return;
      localStorage.setItem(canonicalKey, next);
      emitForKey(key, merged);
      return;
    }
    const next = JSON.stringify(value);
    const prev = localStorage.getItem(canonicalKey);
    if (prev === next) return;
    localStorage.setItem(canonicalKey, next);
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
  const applyKey = (key: string, value: unknown) => applyFacilityRemoteKey(key, value);

  // CLOUD-FIRST bootstrap: pull shared facility doc before relying on local cache
  void (async () => {
    try {
      const { firestoreReadFacility } = await import('./firebase');
      if (typeof navigator === 'undefined' || navigator.onLine) {
        const data = await firestoreReadFacility(facilityId);
        if (data) {
          for (const [k, v] of Object.entries(data)) {
            applyKey(k, v);
          }
        }
      }
    } catch {
      /* offline / deny */
    }
  })();

  const stopOutbox = startOutboxAutoFlush(2500);
  void flushOutbox();

  // LAN hub (when available on hospital network)
  const stopLan = startFacilitySyncLoop(facilityId, applyKey, 2500);
  void probeHospitalApi();

  // Cloud realtime — other PCs / phones on same hospital (overrides local when newer)
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
