// ─── MedCore Real-Time Synchronization Bus Types ───────────────────────────

export type SyncTopic =
  | 'PATIENT_REGISTERED'
  | 'PATIENT_ADMITTED'
  | 'BED_OCCUPIED'
  | 'BED_VACATED'
  | 'VITALS_RECORDED'
  | 'MEDICATION_PRESCRIBED'
  | 'LAB_ORDERED'
  | 'LAB_RESULT_VERIFIED'
  | 'BILL_GENERATED'
  | 'PAYMENT_RECEIVED'
  | 'WALLET_BALANCE_UPDATED'
  | 'TILL_SHIFT_OPENED'
  | 'TILL_SHIFT_CLOSED'
  | 'BREAK_GLASS_TRIGGERED'
  | 'EPIDEMIC_SURGE_ALERT'
  | 'PRESCRIPTION_CREATED'
  | 'PRESCRIPTION_DISPENSED';

export type EmitterApp = 'MEDCORE_CARE' | 'MEDCORE_CLINIC' | 'MEDCORE_OS' | 'MEDCORE_ADMIN' | 'API_SERVER' | 'MEDCORE_OS_PHARMACY';

export interface SyncEnvelope<T = unknown> {
  eventId: string;
  topic: SyncTopic;
  facilityId?: string;
  emitterApp: EmitterApp;
  timestamp: string;
  payload: T;
  traceId: string;
}

export interface ClientSubscription {
  clientId: string;
  app: EmitterApp;
  facilityId?: string;
  topics: SyncTopic[];
}
