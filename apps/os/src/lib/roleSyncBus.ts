/**
 * Cross-role sync bus — every clinical/admin write should publish here
 * so Reception, Doctors, Lab, Pharmacy, Admin, and other PCs stay aligned.
 *
 * ONLINE (edge + cloud only):
 *  1. Firestore write immediately (source of truth for all hospital PCs)
 *  2. BroadcastChannel (same PC tabs) — no durable localStorage for heavy data
 *  3. Outbox only offline (in-memory via edgeCloudOnly)
 *
 * OFFLINE:
 *  1. In-memory + events
 *  2. Outbox queues until online → then cloud
 */

import { broadcastLocal } from './hospitalSync';
import { enqueueFacilitySync } from './durableOutbox';
import { firestoreWriteFacility } from './firebase';

export const FACILITY_KEYS = {
  patients: 'medcore_os_patient_registry_v1',
  reception: 'medcore_os_reception_ops_v2',
  clinical: 'medcore_os_clinical_orders_v1',
  beds: 'medcore_os_bed_board_v1',
  ambulance: 'medcore_os_ambulance_v1',
  staff: 'medcore_os_staff_registry',
  audit: 'medcore_os_audit_log_v1',
  facilityCatalog: 'medcore_facility_catalog_v1',
  notifications: 'medcore_os_notifications_v1',
  onboarding: 'medcore_admin_onboarding_done',
  onboardingDraft: 'medcore_os_onboarding',
  ancPlans: 'medcore_anc_plans_v1',
  ancSmsPrefs: 'medcore_anc_sms_prefs_v1',
  him: 'medcore_os_him_v1',
  theatre: 'medcore_os_theatre_cases_v1',
  vitals: 'medcore_os_nursing_vitals_v1',
} as const;

/** Publish facility data. Online = Firestore only (+ tab broadcast). Offline = memory + outbox. */
export function publishFacilityData(facilityId: string, key: string, value: unknown) {
  if (typeof window === 'undefined' || !facilityId) return;
  const online = typeof navigator === 'undefined' || navigator.onLine;
  // 1) CLOUD FIRST when online — source of truth for other workstations
  if (online) {
    try {
      void firestoreWriteFacility(facilityId, { [key]: value });
    } catch {
      /* ignore */
    }
  }
  // 2) Same-origin tabs / same PC (in-memory peers — no disk)
  try {
    broadcastLocal(facilityId, key, value);
  } catch {
    /* ignore */
  }
  // 3) Outbox only when offline (or cloud path may need retry). Online path skips
  //    durable disk queue — edgeCloudOnly keeps any queue entries in RAM only.
  if (!online) {
    try {
      void enqueueFacilitySync(facilityId, key, value);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Who talks to whom (shared stores):
 * - Reception check-in → Doctor clinic board, Patient Flow, Command Centre
 * - Doctor order lab/Rx → ClinicalOrdersPanel, Lab, Pharmacy
 * - Lab result → Doctor “Results ready”
 * - Admit bed → Bed board, Command Centre
 * - Staff enrolment → RBAC, Staffing, login registry
 * - Presence/gesture → Reception AI card
 */
