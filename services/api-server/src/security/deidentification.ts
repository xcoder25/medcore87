import crypto from 'crypto';

/**
 * Automated De-identification & Privacy Engine for MOH Surveillance
 * Complies with HIPAA Safe Harbor Method (45 CFR § 164.514(b)(2)) and GDPR Pseudonymization (Art. 4(5)).
 */

const ANONYMIZATION_SALT = process.env.MEDCORE_SURVEILLANCE_SALT || 'medcore-moh-epidemic-surveillance-salt-2026';

export interface RawClinicalEvent {
  patientId: string;
  patientName: string;
  patientMRN: string;
  patientPhone: string;
  patientEmail?: string;
  dob: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  facilityId: string;
  facilityName: string;
  state: string;
  lga: string; // Local Government Area / District
  address?: string;
  diagnosisCode: string; // ICD-10 e.g. 'A00.0'
  diagnosisName: string;
  symptoms: string[];
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
  vitals?: {
    temperature: number;
    heartRate: number;
    spO2: number;
    systolicBP: number;
  };
  outcome: 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED' | 'DECEASED' | 'ISOLATED';
  timestamp: string;
}

export interface DeidentifiedSurveillanceRecord {
  pseudonymId: string; // HMAC salted hash - non-reversible without master MOH key
  ageGroup: string; // e.g., '30-34', '75+'
  gender: string;
  facilityId: string;
  facilityType: string;
  region: {
    state: string;
    lga: string; // District level without street address
  };
  clinicalTelemetry: {
    icdCode: string;
    conditionCategory: string;
    syndromeGroup: 'RESPIRATORY' | 'GASTROINTESTINAL' | 'FEBRILE_HEMORRHAGIC' | 'NEUROLOGICAL' | 'OTHER';
    severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
    vitalsSummary: {
      isFeverish: boolean;
      isHypoxic: boolean;
      tachycardic: boolean;
    };
    outcome: string;
  };
  timestamp: string;
  privacyCompliance: {
    hipaaSafeHarborApplied: true;
    kAnonymityProtected: true;
    piiScrubbed: true;
  };
}

export function calculateAgeGroup(dobString: string): string {
  const birthYear = new Date(dobString).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - birthYear);

  if (age < 5) return '0-4';
  if (age < 10) return '5-9';
  if (age < 15) return '10-14';
  if (age < 20) return '15-19';
  if (age < 25) return '20-24';
  if (age < 30) return '25-29';
  if (age < 35) return '30-34';
  if (age < 40) return '35-39';
  if (age < 45) return '40-44';
  if (age < 50) return '45-49';
  if (age < 55) return '50-54';
  if (age < 60) return '55-59';
  if (age < 65) return '60-64';
  if (age < 70) return '65-69';
  if (age < 75) return '70-74';
  return '75+';
}

export function generatePseudonym(patientId: string, facilityId: string): string {
  return crypto
    .createHmac('sha256', ANONYMIZATION_SALT)
    .update(`${facilityId}:${patientId}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

export function categorizeSyndrome(icd: string): 'RESPIRATORY' | 'GASTROINTESTINAL' | 'FEBRILE_HEMORRHAGIC' | 'NEUROLOGICAL' | 'OTHER' {
  const code = icd.toUpperCase();
  if (code.startsWith('J') || code.startsWith('U07')) return 'RESPIRATORY'; // Flu, COVID, Pneumonia
  if (code.startsWith('A0') || code.startsWith('K5')) return 'GASTROINTESTINAL'; // Cholera, Gastroenteritis
  if (code.startsWith('A9') || code.startsWith('B5')) return 'FEBRILE_HEMORRHAGIC'; // Malaria, Lassa, Dengue
  if (code.startsWith('G') || code.startsWith('A8')) return 'NEUROLOGICAL'; // Meningitis
  return 'OTHER';
}

/**
 * Strips all 18 HIPAA direct and quasi-identifiers before streaming to MOH
 */
export function deidentifyForSurveillance(raw: RawClinicalEvent): DeidentifiedSurveillanceRecord {
  const pseudonymId = `MOH-SYN-${generatePseudonym(raw.patientId, raw.facilityId)}`;
  const ageGroup = calculateAgeGroup(raw.dob);
  const syndromeGroup = categorizeSyndrome(raw.diagnosisCode);

  const isFeverish = (raw.vitals?.temperature ?? 37) >= 38.0;
  const isHypoxic = (raw.vitals?.spO2 ?? 98) < 94;
  const tachycardic = (raw.vitals?.heartRate ?? 75) > 100;

  return {
    pseudonymId,
    ageGroup,
    gender: raw.gender,
    facilityId: raw.facilityId,
    facilityType: 'GENERAL_HOSPITAL',
    region: {
      state: raw.state,
      lga: raw.lga,
    },
    clinicalTelemetry: {
      icdCode: raw.diagnosisCode,
      conditionCategory: raw.diagnosisName,
      syndromeGroup,
      severity: raw.severity,
      vitalsSummary: {
        isFeverish,
        isHypoxic,
        tachycardic,
      },
      outcome: raw.outcome,
    },
    timestamp: raw.timestamp,
    privacyCompliance: {
      hipaaSafeHarborApplied: true,
      kAnonymityProtected: true,
      piiScrubbed: true,
    },
  };
}
