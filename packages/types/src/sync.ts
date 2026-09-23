// ─── MedCore Real-Time Synchronization Bus Types ───────────────────────────

export type SyncTopic =
  // ── Patient Flow ──────────────────────────────
  | 'PATIENT_REGISTERED'
  | 'PATIENT_ADMITTED'
  | 'PATIENT_DISCHARGED'
  | 'DISCHARGE_READY'
  // ── Beds ──────────────────────────────────────
  | 'BED_OCCUPIED'
  | 'BED_VACATED'
  // ── Vitals & Clinical Alerts ──────────────────
  | 'VITALS_RECORDED'
  | 'VITALS_ALERT'            // Single vital out of range
  | 'NEWS2_SCORE_UPDATED'     // NEWS2 recomputed
  | 'NEWS2_DETERIORATION'     // NEWS2 ≥ 5 — escalate
  | 'SEPSIS_ALERT'            // qSOFA ≥ 2 — sepsis bundle
  // ── Orders / Lab / Radiology ─────────────────
  | 'LAB_ORDERED'
  | 'LAB_RESULT_VERIFIED'
  | 'LAB_RESULT_READY'        // Lab result signed off → notify doctor
  | 'RADIOLOGY_REPORT_READY'  // Radiologist signed report
  // ── Medications / Pharmacy ───────────────────
  | 'MEDICATION_PRESCRIBED'
  | 'PRESCRIPTION_CREATED'
  | 'PRESCRIPTION_DISPENSED'
  | 'DRUG_STOCKOUT'           // Pharmacy inventory critical
  // ── Theatre / Procedures ─────────────────────
  | 'THEATRE_BOOKED'
  | 'THEATRE_SCHEDULE_CHANGE'
  | 'THEATRE_CASE_STARTED'
  | 'THEATRE_CASE_COMPLETED'
  // ── HMO / Finance ────────────────────────────
  | 'BILL_GENERATED'
  | 'PAYMENT_RECEIVED'
  | 'WALLET_BALANCE_UPDATED'
  | 'TILL_SHIFT_OPENED'
  | 'TILL_SHIFT_CLOSED'
  | 'HMO_PREAUTH_APPROVED'
  | 'HMO_PREAUTH_REJECTED'
  // ── Facilities ───────────────────────────────
  | 'FACILITY_CREDENTIALS_ISSUED'
  // ── Security ─────────────────────────────────
  | 'BREAK_GLASS_TRIGGERED'
  | 'EPIDEMIC_SURGE_ALERT'
  // ── DHIS2 / Reporting ────────────────────────
  | 'DHIS2_SYNC_COMPLETE'
  | 'DHIS2_SYNC_FAILED'
  // ── AI Engine ────────────────────────────────
  | 'AI_CDS_ALERT'            // Drug interaction / dosing alert from AI engine
  | 'AI_SCRIBE_COMPLETE';     // AI SOAP note ready for review

export type EmitterApp =
  | 'MEDCORE_CARE'
  | 'MEDCORE_CLINIC'
  | 'MEDCORE_OS'
  | 'MEDCORE_OS_PHARMACY'
  | 'MEDCORE_ADMIN'
  | 'API_SERVER'
  | 'AI_ENGINE'
  | 'DHIS2_BRIDGE';

export interface SyncEnvelope<T = unknown> {
  eventId: string;
  topic: SyncTopic;
  facilityId?: string;
  emitterApp: EmitterApp;
  timestamp: string;
  payload: T;
  traceId: string;
  /** Optional priority: CRITICAL will trigger AlertBanner in frontend */
  priority?: 'INFO' | 'HIGH' | 'CRITICAL';
}

export interface ClientSubscription {
  clientId: string;
  app: EmitterApp;
  facilityId?: string;
  topics: SyncTopic[];
}
