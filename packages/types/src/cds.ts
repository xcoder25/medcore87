// ─── Clinical Decision Support (CDS) & Patient Safety Types ────────────────

export type CdsSeverity = 'HARD_STOP' | 'CRITICAL_WARNING' | 'MODERATE_WARNING' | 'INFORMATIONAL';

export type CdsAlertType = 
  | 'DRUG_ALLERGY'
  | 'DRUG_DRUG_INTERACTION'
  | 'DUPLICATE_THERAPY'
  | 'RENAL_ADJUSTMENT'
  | 'DOSE_RANGE_CHECK'
  | 'PAEDIATRIC_CONTRAINDICATION'
  | 'PREGNANCY_WARNING';

export interface CdsAlert {
  id: string;
  type: CdsAlertType;
  severity: CdsSeverity;
  title: string;
  message: string;
  triggerItem: string;
  conflictingItem?: string;
  clinicalEvidence: string;
  recommendedAction: string;
  requiresOverrideReason: boolean;
}

export interface CdsCheckRequest {
  patientId: string;
  patientAgeYears?: number;
  patientWeightKg?: number;
  isPregnant?: boolean;
  allergies: string[];
  currentMedications: string[];
  newOrders: Array<{
    name: string;
    category?: string;
    dosage?: string;
    route?: string;
  }>;
  recentLabs?: {
    creatinineMgDl?: number;
    eGfr?: number;
    potassiumMeqL?: number;
  };
}

export interface CdsCheckResponse {
  patientId: string;
  hasHardStop: boolean;
  hasCriticalWarning: boolean;
  alerts: CdsAlert[];
  checkedAt: string;
}

export interface CdsOverrideRecord {
  alertId: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  reason: string;
  acknowledgedAt: string;
}
