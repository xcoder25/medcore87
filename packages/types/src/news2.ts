// ─── NEWS2 (National Early Warning Score) & Clinical Deterioration Types ───

export type ConsciousnessLevel = 'ALERT' | 'CVPU' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

export interface VitalSignsReading {
  id?: string;
  patientId: string;
  patientName: string;
  bedNumber: string;
  recordedAt: string;
  recordedByBadge: string;
  recordedByName: string;
  
  respirationRate: number;        // breaths per min
  spO2Percent: number;            // 0 - 100
  onSupplementalOxygen: boolean;  // Air or Oxygen
  spO2Scale: 1 | 2;               // Scale 2 for hypercapnic respiratory failure target 88-92%
  systolicBp: number;             // mmHg
  diastolicBp: number;            // mmHg
  pulseRate: number;              // bpm
  consciousness: ConsciousnessLevel;
  temperatureCelsius: number;     // °C
}

export interface News2Subscores {
  respirationScore: number;
  spO2Score: number;
  airOrOxygenScore: number;
  systolicBpScore: number;
  pulseScore: number;
  consciousnessScore: number;
  temperatureScore: number;
}

export type News2RiskCategory = 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';

export interface News2Evaluation {
  totalScore: number;
  subscores: News2Subscores;
  riskCategory: News2RiskCategory;
  hasSingleTriggerThree: boolean;
  clinicalResponse: string;
  monitoringFrequency: string;
  escalationRequired: boolean;
  recommendedEscalationTarget: 'WARD_NURSE' | 'MEDICAL_OFFICER' | 'RAPID_RESPONSE_TEAM' | 'ICU_CONSULTANT';
}
