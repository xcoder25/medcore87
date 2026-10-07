/**
 * Cross-role sync bus — every clinical/admin write should publish here
 * so Reception, Doctors, Lab, Pharmacy, Admin, and other PCs stay aligned.
 *
 * ONLINE (cloud-first):
 *  1. Firestore write immediately (other hospital PCs)
 *  2. localStorage + events (this browser)
 *  3. BroadcastChannel (same PC tabs)
 *  4. durable outbox (retry if cloud write failed)
 *
 * OFFLINE:
 *  1. localStorage + events
 *  2. outbox queues until online → then cloud
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
} as const;

/** Publish facility data. Online = cloud first, then local peers. Offline = local + queue. */
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
  // 2) Same-origin tabs / same PC
  try {
    broadcastLocal(facilityId, key, value);
  } catch {
    /* ignore */
  }
  // 3) Durable outbox (always) — retries failed cloud writes / offline catch-up
  try {
    void enqueueFacilitySync(facilityId, key, value);
  } catch {
    /* ignore */
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
