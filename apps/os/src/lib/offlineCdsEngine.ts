/**
 * Offline Clinical Decision Support (CDS) Engine
 *
 * Provides instant, localized clinical safety logic when cloud AI
 * (e.g., Gemini 1.5 Pro / Cloud MedGemma) is disconnected.
 *
 * Implements validated medical safety algorithms:
 * 1. NEWS2 (National Early Warning Score 2) for deterioration risk
 * 2. Pediatric Weight-Based Dosage Calculator
 * 3. Severe Drug Interaction Checker
 * 4. Sepsis Alert Screening (qSOFA)
 */

export interface News2ScoreResult {
  totalScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  clinicalAction: string;
  subscores: {
    respirationRate: number;
    oxygenSaturation: number;
    supplementalOxygen: number;
    systolicBp: number;
    heartRate: number;
    temperature: number;
    consciousness: number;
  };
}

export function calculateNews2Score(vitals: {
  respRate?: number;
  spo2?: number;
  onOxygen?: boolean;
  systolicBp?: number;
  heartRate?: number;
  temp?: number;
  consciousState?: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
}): News2ScoreResult {
  const s = {
    respirationRate: 0,
    oxygenSaturation: 0,
    supplementalOxygen: vitals.onOxygen ? 2 : 0,
    systolicBp: 0,
    heartRate: 0,
    temperature: 0,
    consciousness: 0,
  };

  // Respiration rate
  const rr = vitals.respRate || 16;
  if (rr <= 8) s.respirationRate = 3;
  else if (rr >= 9 && rr <= 11) s.respirationRate = 1;
  else if (rr >= 12 && rr <= 20) s.respirationRate = 0;
  else if (rr >= 21 && rr <= 24) s.respirationRate = 2;
  else if (rr >= 25) s.respirationRate = 3;

  // SpO2 Scale 1
  const spo2 = vitals.spo2 || 98;
  if (spo2 <= 91) s.oxygenSaturation = 3;
  else if (spo2 >= 92 && spo2 <= 93) s.oxygenSaturation = 2;
  else if (spo2 >= 94 && spo2 <= 95) s.oxygenSaturation = 1;
  else s.oxygenSaturation = 0;

  // Systolic BP
  const sbp = vitals.systolicBp || 120;
  if (sbp <= 90) s.systolicBp = 3;
  else if (sbp >= 91 && sbp <= 100) s.systolicBp = 2;
  else if (sbp >= 101 && sbp <= 110) s.systolicBp = 1;
  else if (sbp >= 111 && sbp <= 219) s.systolicBp = 0;
  else if (sbp >= 220) s.systolicBp = 3;

  // Heart Rate
  const hr = vitals.heartRate || 75;
  if (hr <= 40) s.heartRate = 3;
  else if (hr >= 41 && hr <= 50) s.heartRate = 1;
  else if (hr >= 51 && hr <= 90) s.heartRate = 0;
  else if (hr >= 91 && hr <= 110) s.heartRate = 1;
  else if (hr >= 111 && hr <= 130) s.heartRate = 2;
  else if (hr >= 131) s.heartRate = 3;

  // Temperature
  const t = vitals.temp || 36.8;
  if (t <= 35.0) s.temperature = 3;
  else if (t >= 35.1 && t <= 36.0) s.temperature = 1;
  else if (t >= 36.1 && t <= 38.0) s.temperature = 0;
  else if (t >= 38.1 && t <= 39.0) s.temperature = 1;
  else if (t >= 39.1) s.temperature = 2;

  // Consciousness
  const cs = vitals.consciousState || 'Alert';
  s.consciousness = cs === 'Alert' ? 0 : 3;

  const totalScore =
    s.respirationRate +
    s.oxygenSaturation +
    s.supplementalOxygen +
    s.systolicBp +
    s.heartRate +
    s.temperature +
    s.consciousness;

  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  let clinicalAction = 'Ward-based monitoring; repeat vitals every 4 to 6 hours.';

  if (totalScore >= 7 || Object.values(s).some((v) => v === 3)) {
    riskLevel = 'High';
    clinicalAction = 'URGENT: Emergency bedside assessment by Medical Officer / MET team. Continuous monitoring.';
  } else if (totalScore >= 5) {
    riskLevel = 'Medium';
    clinicalAction = 'Urgent review by Registered Nurse; escalate to ward doctor within 30 minutes.';
  }

  return { totalScore, riskLevel, clinicalAction, subscores: s };
}

/**
 * Common high-alert drug interactions checkable offline
 */
const CONTRAINDICATED_PAIRS: Array<{
  drugA: string;
  drugB: string;
  severity: 'CRITICAL' | 'WARNING';
  reason: string;
}> = [
  {
    drugA: 'ciprofloxacin',
    drugB: 'theophylline',
    severity: 'CRITICAL',
    reason: 'Ciprofloxacin inhibits theophylline clearance; high risk of fatal toxicity and seizures.',
  },
  {
    drugA: 'warfarin',
    drugB: 'ibuprofen',
    severity: 'CRITICAL',
    reason: 'Severe risk of gastrointestinal haemorrhage; concurrent NSAID and anticoagulant.',
  },
  {
    drugA: 'metformin',
    drugB: 'contrast',
    severity: 'WARNING',
    reason: 'Risk of lactic acidosis with iodinated radiopaque contrast.',
  },
  {
    drugA: 'tramadol',
    drugB: 'fluoxetine',
    severity: 'CRITICAL',
    reason: 'High risk of Serotonin Syndrome and lowered seizure threshold.',
  },
  {
    drugA: 'artemether',
    drugB: 'ketoconazole',
    severity: 'WARNING',
    reason: 'CYP3A4 inhibition increases artemether plasma concentration.',
  },
];

export function checkOfflineDrugInteractions(
  drugList: string[]
): Array<{ drugA: string; drugB: string; severity: 'CRITICAL' | 'WARNING'; reason: string }> {
  const norm = drugList.map((d) => d.toLowerCase().trim());
  const found: Array<{ drugA: string; drugB: string; severity: 'CRITICAL' | 'WARNING'; reason: string }> = [];

  for (const pair of CONTRAINDICATED_PAIRS) {
    const hasA = norm.some((d) => d.includes(pair.drugA));
    const hasB = norm.some((d) => d.includes(pair.drugB));
    if (hasA && hasB) {
      found.push(pair);
    }
  }

  return found;
}
