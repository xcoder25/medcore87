/**
 * MedCore NEWS2 Calculator
 * National Early Warning Score 2 — Royal College of Physicians UK standard
 * Used for early detection of patient deterioration
 */

export interface VitalsInput {
  respiratoryRate: number;    // breaths/min
  spO2: number;               // % oxygen saturation
  supplementalOxygen: boolean;
  systolicBP: number;         // mmHg
  heartRate: number;          // bpm
  temperature: number;        // °C
  consciousness: 'A' | 'C' | 'V' | 'P' | 'U'; // ACVPU scale
  // Optional: for Scale 2 (COPD patients)
  isScale2?: boolean;
}

export interface NEWS2Result {
  totalScore: number;
  riskLevel: 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';
  clinicalRisk: string;
  monitoringFrequency: string;
  escalationRequired: boolean;
  breakdown: {
    respiratoryRate: number;
    spO2: number;
    supplementalOxygen: number;
    systolicBP: number;
    heartRate: number;
    temperature: number;
    consciousness: number;
  };
  alerts: string[];
}

function scoreRR(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSpO2Scale1(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function scoreSpO2Scale2(spo2: number, onO2: boolean): number {
  // Scale 2 for COPD/hypercapnic respiratory failure
  if (spo2 <= 83) return 3;
  if (spo2 <= 85) return 2;
  if (spo2 <= 87) return 1;
  if (spo2 >= 93 && onO2) return 3;
  if (spo2 >= 95 && onO2) return 2;
  if (spo2 >= 97 && onO2) return 1;
  return 0;
}

function scoreSBP(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scoreHR(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreTemp(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

function scoreConsciousness(level: string): number {
  if (level === 'A') return 0;   // Alert
  return 3;                       // C/V/P/U all score 3
}

function getRiskLevel(score: number): NEWS2Result['riskLevel'] {
  if (score <= 4) return 'LOW';
  if (score <= 6) return 'LOW_MEDIUM';
  if (score === 5 || score === 6) return 'MEDIUM';
  return 'HIGH';
}

function getMonitoringFrequency(score: number, anyScore3: boolean): string {
  if (score >= 7 || anyScore3) return 'Continuous monitoring — immediate medical review';
  if (score >= 5) return 'Every 1 hour — urgent medical review';
  if (score >= 3) return 'Every 4–6 hours — review';
  return 'Every 12 hours — minimum';
}

export function calculateNEWS2(vitals: VitalsInput): NEWS2Result {
  const rrScore  = scoreRR(vitals.respiratoryRate);
  const spo2Score = vitals.isScale2
    ? scoreSpO2Scale2(vitals.spO2, vitals.supplementalOxygen)
    : scoreSpO2Scale1(vitals.spO2);
  const o2Score  = vitals.supplementalOxygen ? 2 : 0;
  const sbpScore = scoreSBP(vitals.systolicBP);
  const hrScore  = scoreHR(vitals.heartRate);
  const tempScore = scoreTemp(vitals.temperature);
  const consScore = scoreConsciousness(vitals.consciousness);

  const total = rrScore + spo2Score + o2Score + sbpScore + hrScore + tempScore + consScore;
  const anyScore3 = [rrScore, spo2Score, sbpScore, hrScore, tempScore, consScore].some(s => s === 3);
  const riskLevel = total >= 7 || anyScore3 ? 'HIGH'
    : total >= 5 ? 'MEDIUM'
    : total >= 3 ? 'LOW_MEDIUM'
    : 'LOW';

  const alerts: string[] = [];
  if (rrScore === 3) alerts.push(`⚠️ Respiratory rate ${vitals.respiratoryRate}/min — critical range`);
  if (spo2Score >= 2) alerts.push(`⚠️ SpO₂ ${vitals.spO2}% — low oxygen saturation`);
  if (sbpScore === 3) alerts.push(`⚠️ Systolic BP ${vitals.systolicBP} mmHg — critically low`);
  if (hrScore === 3) alerts.push(`⚠️ Heart rate ${vitals.heartRate} bpm — critical range`);
  if (tempScore === 3) alerts.push(`⚠️ Temperature ${vitals.temperature}°C — hypothermia`);
  if (consScore === 3) alerts.push(`⚠️ Altered consciousness (${vitals.consciousness}) — neurological concern`);
  if (total >= 7) alerts.push(`🚨 NEWS2 ≥ 7: Emergency — immediate medical review required`);
  else if (total >= 5) alerts.push(`🔴 NEWS2 ${total}: Urgent — escalate to senior clinician`);

  return {
    totalScore: total,
    riskLevel,
    clinicalRisk:
      riskLevel === 'HIGH'       ? 'HIGH — Continuous monitoring. Immediate senior review. Consider ICU.'
      : riskLevel === 'MEDIUM'   ? 'MEDIUM — Urgent review within 1 hour. Increase monitoring.'
      : riskLevel === 'LOW_MEDIUM' ? 'LOW-MEDIUM — Review within 4–6 hours.'
      : 'LOW — Continue routine monitoring.',
    monitoringFrequency: getMonitoringFrequency(total, anyScore3),
    escalationRequired: total >= 5 || anyScore3,
    breakdown: {
      respiratoryRate: rrScore,
      spO2: spo2Score,
      supplementalOxygen: o2Score,
      systolicBP: sbpScore,
      heartRate: hrScore,
      temperature: tempScore,
      consciousness: consScore,
    },
    alerts,
  };
}

/** qSOFA score for sepsis screening (Sepsis-3 definition) */
export interface qSOFAInput {
  respiratoryRate: number;
  systolicBP: number;
  consciousness: 'A' | 'C' | 'V' | 'P' | 'U';
}

export interface qSOFAResult {
  score: number;
  sepsisRisk: boolean;
  criteria: {
    alteredMental: boolean;
    highRR: boolean;
    lowSBP: boolean;
  };
  recommendation: string;
}

export function calculateQSOFA(vitals: qSOFAInput): qSOFAResult {
  const alteredMental = vitals.consciousness !== 'A';
  const highRR        = vitals.respiratoryRate >= 22;
  const lowSBP        = vitals.systolicBP <= 100;
  const score = [alteredMental, highRR, lowSBP].filter(Boolean).length;

  return {
    score,
    sepsisRisk: score >= 2,
    criteria: { alteredMental, highRR, lowSBP },
    recommendation: score >= 2
      ? '🚨 qSOFA ≥ 2: Sepsis risk — initiate sepsis bundle. Blood cultures, IV access, lactate, broad-spectrum antibiotics.'
      : score === 1
      ? '⚠️ qSOFA 1: Monitor closely. Reassess in 1 hour.'
      : '✅ qSOFA 0: Low risk. Continue routine assessment.',
  };
}
