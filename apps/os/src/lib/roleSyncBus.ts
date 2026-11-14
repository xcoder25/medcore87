/**
 * Cross-role sync bus — every clinical/admin write should publish here
 * so Reception, Doctors, Lab, Pharmacy, Admin, and other PCs stay aligned.
 *
 * ONLINE (edge + cloud):
 *  1. Firestore write (internet / multi-site)
 *  2. Onsite hospital hub (LAN) when NEXT_PUBLIC_API_URL is set — survives ISP blackout
 *  3. BroadcastChannel (same PC tabs)
 *
 * OFFLINE / blackout:
 *  1. Still try onsite hub (LAN server on UPS often stays up)
 *  2. Outbox queues until cloud or hub accepts (edgeCloudOnly keeps queue in RAM)
 *  3. flushOutbox prefers hub first, then Firestore
 */

import { broadcastLocal, isLanApiEligible, pushFacilityData } from './hospitalSync';
import { enqueueFacilitySync } from './durableOutbox';
import { isCriticalFacilityKey } from './poorNetwork';
import { syncKeyToCloudAndPrem } from './cloudStore';

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
  customRoles: 'medcore_os_custom_roles_v1',
  rolePermissions: 'medcore_os_role_permissions_v4',
} as const;

/**
 * Publish facility data.
 * Cloud (when online) + onsite LAN hub (when configured) + same-PC tabs.
 * During ISP blackout, hub still receives writes if the hospital server is up.
 */
export function publishFacilityData(facilityId: string, key: string, value: unknown) {
  if (typeof window === 'undefined' || !facilityId) return;
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const payload = { [key]: value };

  // 0) Persist to Cloud (/api/facility/sync -> Aurora Postgres / Server Vault) + On-Prem LAN Hub
  try {
    syncKeyToCloudAndPrem(facilityId, key, value);
  } catch {
    /* ignore */
  }

  // 1) Broadcast to AWS EventBridge / AppSync Realtime sync channels
  if (online) {
    try {
      const bc = new BroadcastChannel('medcore_aws_eventbridge');
      bc.postMessage({
        facilityId,
        source: 'medcore.sync',
        detailType: 'FacilityDataSync',
        payload: { key, value },
        timestamp: new Date().toISOString(),
      });
      bc.close();
    } catch {
      /* ignore */
    }
  }

  // 2) Onsite hospital hub — independent of internet (UPS / local server)
  if (isLanApiEligible()) {
    try {
      void pushFacilityData(facilityId, payload);
    } catch {
      /* ignore */
    }
  }

  // 3) Same-origin tabs / same PC
  try {
    broadcastLocal(facilityId, key, value);
  } catch {
    /* ignore */
  }

  // 4) Critical-path outbox only when offline (orders, vitals, staff, reception…)
  //    Non-critical keys are best-effort cloud/hub — keeps queue small on 2G.
  if (!online && isCriticalFacilityKey(key)) {
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
