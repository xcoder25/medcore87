/**
 * Same-hospital live sync — workstations share facility data via AWS AppSync / EventBridge
 * and Aurora PostgreSQL without requiring a browser reload.
 *
 * Pipeline (AWS EDA & Real-Time):
 *  Backend write (Aurora Postgres) → EventBridge event → AppSync WebSocket → UI sync
 */
import { startFacilitySyncLoop, probeHospitalApi, isLanApiEligible } from './hospitalSync';
import { startOutboxAutoFlush, flushOutbox } from './durableOutbox';
import { FACILITY_KEYS } from './roleSyncBus';
import { applyHimRemote, HIM_STORAGE_KEY } from './himStore';
import { mergePresenceMaps, STAFF_PRESENCE_KEY } from './staffPresenceStore';
import {
  applyCloudStaffDirectory,
  syncAccessRosterFromSources,
} from './staffCardStore';
import { enableEdgeCloudOnlyRuntime } from './edgeCloudOnly';
import { hydrateFacilityFromCloudAndPrem } from './cloudStore';
import { MedCoreAppSyncSyncManager, type AppSyncRealtimeMessage } from './aws/appsyncRealtime';

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
  medcore_os_admin_settings_v1: ['medcore-admin-settings', 'medcore-admin-sync'],
  adminSettings: ['medcore-admin-settings', 'medcore-admin-sync'],
  [FACILITY_KEYS.onboarding]: ['medcore-onboarding-sync', 'medcore-admin-sync'],
  [FACILITY_KEYS.onboardingDraft]: ['medcore-onboarding-sync', 'medcore-admin-sync'],
  [FACILITY_KEYS.ancPlans]: ['medcore-anc-plans', 'medcore-admin-sync'],
  [FACILITY_KEYS.ancSmsPrefs]: ['medcore-anc-plans', 'medcore-admin-sync'],
  [FACILITY_KEYS.him]: ['medcore-him-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.theatre]: ['medcore-theatre-cases', 'medcore-admin-sync'],
  [FACILITY_KEYS.vitals]: ['medcore-vitals', 'medcore-admin-sync'],
  clinical_vitals: ['medcore-vitals', 'medcore-admin-sync'],
  [FACILITY_KEYS.customRoles]: ['medcore-custom-roles-updated', 'medcore-admin-sync'],
  [FACILITY_KEYS.rolePermissions]: ['medcore-role-permissions', 'medcore-admin-sync'],
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
 * Apply a remote facility document field into session memory and notify UI.
 */
export function applyFacilityRemoteKey(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  if (value === undefined || value === null) return;
  if (key === 'updatedAt' || key === 'resetAt') return;

  if (
    (key === 'medcore_os_admin_settings_v1' || key === 'adminSettings') &&
    value &&
    typeof value === 'object'
  ) {
    try {
      const s = value as { facilityId?: string };
      const fid = String(s.facilityId || '').trim();
      const payload = JSON.stringify(value);
      localStorage.setItem('medcore_os_admin_settings_v1', payload);
      if (fid) localStorage.setItem(`medcore_os_admin_settings_v1:${fid}`, payload);
      window.dispatchEvent(new CustomEvent('medcore-admin-settings', { detail: value }));
      window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key } }));
      emitForKey(key, value);
      return;
    } catch {
      /* fall through */
    }
  }

  // Canonicalize legacy keys
  let canonicalKey = key;
  if (key === 'medcore_os_reception_ops_v1') canonicalKey = FACILITY_KEYS.reception;
  if (key === 'medcore_staff_id_cards') canonicalKey = FACILITY_KEYS.staff;
  if (key === 'clinical_vitals') canonicalKey = FACILITY_KEYS.vitals;

  try {
    if (canonicalKey === FACILITY_KEYS.staff && value && typeof value === 'object') {
      const dir = value as { staffCards?: unknown[]; staffRegistry?: unknown[]; facilityId?: string };
      applyCloudStaffDirectory(dir);
      emitForKey(canonicalKey, value);
      return;
    }
    if (canonicalKey === HIM_STORAGE_KEY) {
      applyHimRemote(value);
      emitForKey(canonicalKey, value);
      return;
    }
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

  enableEdgeCloudOnlyRuntime();
  const applyKey = (key: string, value: unknown) => applyFacilityRemoteKey(key, value);

  // Hydrate all facility clinical & operational state from Cloud + On-Prem LAN Hub into RAM
  void hydrateFacilityFromCloudAndPrem(facilityId, applyKey);

  // Initial fetch from Postgres-backed API
  void (async () => {
    try {
      const res = await fetch(`/api/staff?facilityId=${encodeURIComponent(facilityId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.configured !== false && json.staff && Array.isArray(json.staff) && json.staff.length > 0) {
          const cloudCards = json.staff.map((s: any) => ({
            badgeId: s.badge_id || s.badgeId,
            fullName: s.full_name || s.fullName,
            role: s.role || 'Staff',
            roleKey: s.role_key || s.roleKey || 'staff',
            title: s.title || '',
            department: s.department || 'General',
            facilityId,
            facilityName: s.facility_name || 'Hospital',
            clearanceLevel: Number(s.clearance_level || 1),
            clearanceLabel: s.clearance_label || 'Level 1',
            status: (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
            photoUrl: s.photo_url || s.photoUrl || null,
          }));
          applyCloudStaffDirectory({
            staffCards: cloudCards,
            staffRegistry: json.staff,
            facilityId,
          });
        }
      }
    } catch {
      /* offline / retry */
    }
  })();

  // Outbox only for brief offline catch-up
  const stopOutbox = startOutboxAutoFlush(20000);
  void flushOutbox();

  // LAN hub loop
  const stopLan = startFacilitySyncLoop(facilityId, applyKey, 15000);
  if (isLanApiEligible()) void probeHospitalApi();

  // AWS AppSync Real-Time Subscription Manager
  const syncManager = MedCoreAppSyncSyncManager.getInstance();
  const unsubAppSync = syncManager.subscribe((msg: AppSyncRealtimeMessage) => {
    if (msg.facilityId && msg.facilityId !== facilityId) return;
    if (msg.payload?.key && msg.payload?.value !== undefined) {
      applyKey(msg.payload.key, msg.payload.value);
    }
  });

  const onOnline = () => {
    void flushOutbox();
  };
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('online', onOnline);
    stopLan();
    unsubAppSync();
    stopOutbox();
  };
}
