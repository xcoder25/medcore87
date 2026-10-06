/**
 * Cross-role sync bus — every clinical/admin write should publish here
 * so Reception, Doctors, Lab, Pharmacy, Admin, and other PCs stay aligned.
 *
 * Layers:
 *  1. localStorage (same browser, instant)
 *  2. window CustomEvent (same tab subscribers)
 *  3. BroadcastChannel (same origin tabs / same PC)
 *  4. durable outbox → LAN hub → Firestore (other PCs / offline recovery)
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

/** Publish a facility-scoped payload to LAN/cloud peers + other tabs (fast path). */
export function publishFacilityData(facilityId: string, key: string, value: unknown) {
  if (typeof window === 'undefined' || !facilityId) return;
  // 1) Same-origin tabs / same PC — instant
  try {
    broadcastLocal(facilityId, key, value);
  } catch {
    /* ignore */
  }
  // 2) Fast path: push to Firestore immediately when online (sub-second peer updates)
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      void firestoreWriteFacility(facilityId, { [key]: value });
    }
  } catch {
    /* ignore */
  }
  // 3) Durable outbox — retries if the fast write failed / offline
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
