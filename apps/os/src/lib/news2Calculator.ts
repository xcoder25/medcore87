import {
  VitalSignsReading,
  News2Evaluation,
  News2Subscores,
  News2RiskCategory,
} from '@medcore/types';

/**
 * Calculates NEWS2 (National Early Warning Score 2) according to the
 * Royal College of Physicians (UK) guidelines used internationally for clinical deterioration.
 */
export function calculateNews2(vitals: VitalSignsReading): News2Evaluation {
  // 1. Respiration Rate
  let respScore = 0;
  if (vitals.respirationRate <= 8) respScore = 3;
  else if (vitals.respirationRate >= 9 && vitals.respirationRate <= 11) respScore = 1;
  else if (vitals.respirationRate >= 12 && vitals.respirationRate <= 20) respScore = 0;
  else if (vitals.respirationRate >= 21 && vitals.respirationRate <= 24) respScore = 2;
  else if (vitals.respirationRate >= 25) respScore = 3;

  // 2. Oxygen Saturation (SpO2)
  let spo2Score = 0;
  if (vitals.spO2Scale === 2) {
    // Hypercapnic respiratory failure (target 88-92%)
    if (vitals.spO2Percent <= 83) spo2Score = 3;
    else if (vitals.spO2Percent >= 84 && vitals.spO2Percent <= 85) spo2Score = 2;
    else if (vitals.spO2Percent >= 86 && vitals.spO2Percent <= 87) spo2Score = 1;
    else if (vitals.spO2Percent >= 88 && vitals.spO2Percent <= 92) spo2Score = 0;
    else if (vitals.spO2Percent >= 93 && vitals.spO2Percent <= 94) spo2Score = 1;
    else if (vitals.spO2Percent >= 95 && vitals.spO2Percent <= 96) spo2Score = 2;
    else if (vitals.spO2Percent >= 97) spo2Score = 3;
  } else {
    // Standard Scale 1
    if (vitals.spO2Percent <= 91) spo2Score = 3;
    else if (vitals.spO2Percent >= 92 && vitals.spO2Percent <= 93) spo2Score = 2;
    else if (vitals.spO2Percent >= 94 && vitals.spO2Percent <= 95) spo2Score = 1;
    else spo2Score = 0;
  }

  // 3. Air or Oxygen
  const airOrOxygenScore = vitals.onSupplementalOxygen ? 2 : 0;

  // 4. Systolic Blood Pressure
  let sbpScore = 0;
  if (vitals.systolicBp <= 90) sbpScore = 3;
  else if (vitals.systolicBp >= 91 && vitals.systolicBp <= 100) sbpScore = 2;
  else if (vitals.systolicBp >= 101 && vitals.systolicBp <= 110) sbpScore = 1;
  else if (vitals.systolicBp >= 111 && vitals.systolicBp <= 219) sbpScore = 0;
  else if (vitals.systolicBp >= 220) sbpScore = 3;

  // 5. Pulse Rate
  let pulseScore = 0;
  if (vitals.pulseRate <= 40) pulseScore = 3;
  else if (vitals.pulseRate >= 41 && vitals.pulseRate <= 50) pulseScore = 1;
  else if (vitals.pulseRate >= 51 && vitals.pulseRate <= 90) pulseScore = 0;
  else if (vitals.pulseRate >= 91 && vitals.pulseRate <= 110) pulseScore = 1;
  else if (vitals.pulseRate >= 111 && vitals.pulseRate <= 130) pulseScore = 2;
  else if (vitals.pulseRate >= 131) pulseScore = 3;

  // 6. Consciousness (Alert vs CVPU: Confusion, Voice, Pain, Unresponsive)
  const consciousnessScore = vitals.consciousness === 'ALERT' ? 0 : 3;

  // 7. Temperature
  let tempScore = 0;
  if (vitals.temperatureCelsius <= 35.0) tempScore = 3;
  else if (vitals.temperatureCelsius >= 35.1 && vitals.temperatureCelsius <= 36.0) tempScore = 1;
  else if (vitals.temperatureCelsius >= 36.1 && vitals.temperatureCelsius <= 38.0) tempScore = 0;
  else if (vitals.temperatureCelsius >= 38.1 && vitals.temperatureCelsius <= 39.0) tempScore = 1;
  else if (vitals.temperatureCelsius >= 39.1) tempScore = 2;

  const subscores: News2Subscores = {
    respirationScore: respScore,
    spO2Score: spo2Score,
    airOrOxygenScore,
    systolicBpScore: sbpScore,
    pulseScore,
    consciousnessScore,
    temperatureScore: tempScore,
  };

  const totalScore =
    respScore +
    spo2Score +
    airOrOxygenScore +
    sbpScore +
    pulseScore +
    consciousnessScore +
    tempScore;

  const individualScores = [respScore, spo2Score, airOrOxygenScore, sbpScore, pulseScore, consciousnessScore, tempScore];
  const hasSingleTriggerThree = individualScores.some(s => s >= 3);

  let riskCategory: News2RiskCategory = 'LOW';
  let clinicalResponse = 'Routine ward-level monitoring.';
  let monitoringFrequency = 'Minimum 12-hourly observations.';
  let escalationRequired = false;
  let recommendedEscalationTarget: News2Evaluation['recommendedEscalationTarget'] = 'WARD_NURSE';

  if (totalScore >= 7) {
    riskCategory = 'HIGH';
    clinicalResponse = 'EMERGENCY: Immediate assessment by critical care outreach / ICU team or senior registrar.';
    monitoringFrequency = 'Continuous monitoring of vital signs.';
    escalationRequired = true;
    recommendedEscalationTarget = 'RAPID_RESPONSE_TEAM';
  } else if (totalScore >= 5 || hasSingleTriggerThree) {
    riskCategory = totalScore >= 5 ? 'MEDIUM' : 'LOW_MEDIUM';
    clinicalResponse = 'URGENT: Ward nurse immediately informs Medical Officer on duty for bedside clinical review within 30 minutes.';
    monitoringFrequency = 'Minimum hourly observations.';
    escalationRequired = true;
    recommendedEscalationTarget = 'MEDICAL_OFFICER';
  } else if (totalScore >= 1 && totalScore <= 4) {
    riskCategory = 'LOW';
    clinicalResponse = 'Ward-based response. Registered nurse informs charge nurse and decides if frequency increase needed.';
    monitoringFrequency = 'Minimum 4 to 6-hourly observations.';
    escalationRequired = false;
    recommendedEscalationTarget = 'WARD_NURSE';
  }

  return {
    totalScore,
    subscores,
    riskCategory,
    hasSingleTriggerThree,
    clinicalResponse,
    monitoringFrequency,
    escalationRequired,
    recommendedEscalationTarget,
  };
}
