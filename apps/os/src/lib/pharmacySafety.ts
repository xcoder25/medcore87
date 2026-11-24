/**
 * Pharmacy clinical safety checks — assistive, not autonomous.
 * Delegates to the isomorphic Clinical Safety Guard engine so prescription placement,
 * pharmacist dispensing, Ambient SOAP, and server audits share one source of truth.
 */
import {
  evaluatePrescriptionSafetyGuard,
  type PrescriptionSafetyInput,
  type PrescriptionSafetyReport,
  type SafetyGuardAlert,
} from './clinicalSafetyEngine';

export { evaluatePrescriptionSafetyGuard, type PrescriptionSafetyInput, type PrescriptionSafetyReport, type SafetyGuardAlert };

export interface SafetyFlag {
  level: 'high' | 'medium' | 'low';
  message: string;
}

export function checkPrescriptionSafety(input: {
  drugName: string;
  allergies?: string[];
  otherDrugs?: string[];
  notes?: string;
  ageYears?: number;
  dob?: string;
  weightKg?: number;
  sex?: string;
  isPregnant?: boolean;
  chronicConditions?: string[];
  genotype?: string;
  egfr?: number;
  creatinineMgDl?: number;
}): SafetyFlag[] {
  const report = evaluatePrescriptionSafetyGuard(input);
  return report.alerts.map((a) => ({
    level: a.level === 'hard_stop' ? 'high' : a.level === 'warning' ? 'medium' : 'low',
    message: `${a.title}: ${a.detail}`,
  }));
}
