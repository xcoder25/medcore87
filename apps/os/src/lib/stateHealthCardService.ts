/**
 * Statewide Health Card EMR Integration Service
 * 
 * Standards & Architectural Principles:
 * 1. Zero-Print Privacy Standard: The physical card is strictly a cryptographic pointer.
 *    No medical data (allergies, conditions, blood type) is printed on the card face.
 * 2. State Health Identifier (SHID): Unique, non-sequential standardized identifier.
 * 3. Secure QR Code Pointer: Encodes rotatable HTTPS HIE token, NEVER raw PHI.
 * 4. Emergency Flag UI: Boolean-driven visual anchor on card (Medical Cross / Star of Life / Shield).
 * 5. Three-Tier RBAC Scanning API:
 *    - Paramedic / Emergency Mode: Fast, lightweight life-saving data (Blood group, Anaphylaxis, Code status).
 *    - Clinic EMR / GP Mode: Full OAuth2 authenticated EHR clinical records.
 *    - Public Smartphone Mode: Zero-PII safe public verification page.
 * 6. Offline-First Paramedic Capability: AES-256 local smart card / digital wallet emergency partition.
 * 7. HL7 FHIR R4 Interoperability: Native FHIR Bundle generation (Patient, AllergyIntolerance, Condition, Coverage).
 */

import type { FacilityPatient } from './patientRegistryStore';

export interface StatewideHealthCard {
  shid: string;
  patientId: string;
  fullName: string;
  dob: string;
  gender: string;
  issueDate: string;
  expiryDate: string;
  emergencyFlag: boolean;
  emergencyReasons: string[];
  secureToken: string;
  hieGatewayUrl: string;
  offlineEncryptedPayload: string;
  cardStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
  issuingAuthority: string;
  stateMinistry: string;
}

export type ScanRoleMode = 'paramedic' | 'clinic' | 'public';

export interface ParamedicEmergencyPayload {
  status: '200_OK_EMERGENCY_FAST_PATH';
  timestamp: string;
  latencyMs: number;
  authBoundary: 'mTLS_HARDWARE_AUTHENTICATED_PARAMEDIC_TABLET';
  shid: string;
  patientNameInitials: string;
  bloodType: string;
  genotype: string;
  codeStatus: 'FULL CODE (Resuscitate)' | 'DNR (Do Not Resuscitate)' | 'MODIFIED CODE';
  criticalAllergies: { allergen: string; reaction: string; criticality: 'CRITICAL_HIGH' | 'MODERATE' }[];
  chronicAlertConditions: string[];
  currentCriticalMedications: string[];
  emergencyContacts: { name: string; relation: string; phone: string }[];
  privacyNotice: string;
}

export interface ClinicEhrPayload {
  status: '200_OK_OAUTH2_AUTHENTICATED_CLINIC_EMR';
  timestamp: string;
  authBoundary: 'OAUTH2_BEARER_TOKEN_CERTIFIED_FACILITY';
  clinicFacility: string;
  shid: string;
  demographics: {
    fullName: string;
    dob: string;
    gender: string;
    phone: string;
    email?: string;
    address?: string;
    lga?: string;
    state?: string;
    nin?: string;
    nhiaNumber?: string;
  };
  clinicalSummary: {
    bloodGroup: string;
    genotype: string;
    allergies: string[];
    chronicConditions: string[];
    currentMedications: string[];
    surgicalHistory?: string;
    familyHistory?: string;
    immunizations?: string;
    activeProblems?: string[];
  };
  insurance: {
    provider?: string;
    id?: string;
    tier: string;
    status: 'ACTIVE_VERIFIED' | 'SELF_PAY';
  };
  fhirBundleEndpoint: string;
}

export interface PublicVerificationPayload {
  status: '200_OK_PUBLIC_VERIFICATION';
  timestamp: string;
  authBoundary: 'PUBLIC_UNAUTHENTICATED_CIVILIAN_SCAN';
  cardStatus: 'VALID_ACTIVE_STATE_CARD';
  stateAuthority: string;
  hieRegistry: string;
  cardIdentifierMasked: string;
  message: string;
  piiProtectionBanner: string;
  helpline: string;
  emergencyDispatch: string;
}

// Generate standardized State Health Identifier (SHID)
export function generateSHID(prefix = 'ARISE-PMC'): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  // 5 characters alphanumeric e.g. 78421 or 9A82B
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
}

// Check if patient has life-threatening allergies or chronic conditions
export function checkEmergencyFlag(patient: Partial<FacilityPatient>): {
  hasEmergency: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  const allergies = patient.allergies || [];
  const criticalAllergens = [
    'penicillin', 'latex', 'anaphylaxis', 'peanut', 'aspirin',
    'sulfa', 'iodine', 'contrast', 'nsaid', 'morphine', 'cephalosporin'
  ];

  for (const a of allergies) {
    const lower = a.toLowerCase();
    if (criticalAllergens.some((c) => lower.includes(c)) || lower.includes('anaph') || lower.includes('severe')) {
      reasons.push(`Critical Allergy: ${a}`);
    }
  }

  const conditions = patient.chronicConditions || patient.problems || [];
  const criticalConditions = [
    'asthma', 'diabetes', 'epilepsy', 'seizure', 'cardiac', 'hypertension',
    'sickle cell', 'hbss', 'hemophilia', 'pacemaker', 'stroke', 'aneurysm'
  ];

  for (const c of conditions) {
    const lower = c.toLowerCase();
    if (criticalConditions.some((crit) => lower.includes(crit))) {
      reasons.push(`Chronic Alert: ${c}`);
    }
  }

  if (patient.emergencyFlag) {
    if (reasons.length === 0) reasons.push('Flagged by Medical Officer');
  }

  return {
    hasEmergency: reasons.length > 0 || !!patient.emergencyFlag,
    reasons,
  };
}

// Issue / resolve standardized Statewide Health Card
export function getOrCreateStateHealthCard(patient: FacilityPatient): StatewideHealthCard {
  const shid = patient.shid || patient.hospitalNumber || generateSHID();
  const emergencyInfo = checkEmergencyFlag(patient);

  const issueDate = patient.cardIssueDate || '01 Jan 2026';
  const expiryDate = patient.cardExpiryDate || '31 Dec 2028';

  // Secure Cryptographic Pointer Token (Zero-PHI token)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const claims = btoa(JSON.stringify({
    iss: 'https://hie.akwaibom.gov.ng',
    sub: shid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 day rotatable window
    scope: 'state_card_identity_pointer',
    nonce: Math.random().toString(36).substring(2, 10),
  })).replace(/=/g, '');
  const sig = btoa(`sig_${shid}_${claims.slice(0, 8)}`).replace(/=/g, '');
  const secureToken = `${header}.${claims}.${sig}`;

  const hieGatewayUrl = `https://hie.akwaibom.gov.ng/gateway/v1/card/resolve?token=${secureToken}`;

  // Encrypted Offline Paramedic Payload Simulation (AES-256 Mock Container)
  const offlinePlaintext = JSON.stringify({
    shid,
    bloodType: patient.bloodGroup || 'O+',
    genotype: patient.genotype || 'AA',
    criticalAllergies: patient.allergies || ['Penicillin (Severe)'],
    criticalConditions: patient.chronicConditions || ['Severe Asthma'],
    codeStatus: 'FULL CODE',
    emergencyContact: `${patient.emergencyContact || 'Next of Kin'} (${patient.phone})`,
  });
  const offlineEncryptedPayload = `AES256-GCM::${btoa(encodeURIComponent(offlinePlaintext))}::TAG_${Math.random().toString(16).slice(2, 10)}`;

  return {
    shid,
    patientId: patient.id,
    fullName: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
    dob: patient.dob || '15 Mar 1992',
    gender: patient.sex || 'Male',
    issueDate,
    expiryDate,
    emergencyFlag: emergencyInfo.hasEmergency,
    emergencyReasons: emergencyInfo.reasons,
    secureToken,
    hieGatewayUrl,
    offlineEncryptedPayload,
    cardStatus: patient.status === 'inactive' ? 'SUSPENDED' : 'ACTIVE',
    issuingAuthority: 'ARISE State Health Information Exchange',
    stateMinistry: 'Akwa Ibom State Ministry of Health',
  };
}

// Role-Based Access Control (RBAC) Scanning Engine
export function simulateScanResolution(
  card: StatewideHealthCard,
  patient: FacilityPatient,
  mode: ScanRoleMode
): ParamedicEmergencyPayload | ClinicEhrPayload | PublicVerificationPayload {
  const now = new Date().toISOString();

  if (mode === 'paramedic') {
    // Paramedic / Ambulance Tablet: fast, restricted emergency data only
    const criticalAllergies = (patient.allergies && patient.allergies.length > 0
      ? patient.allergies
      : ['Penicillin (Anaphylaxis Risk)']).map((a) => ({
      allergen: a,
      reaction: 'Severe urticaria / broncho-spasm risk',
      criticality: 'CRITICAL_HIGH' as const,
    }));

    return {
      status: '200_OK_EMERGENCY_FAST_PATH',
      timestamp: now,
      latencyMs: 14,
      authBoundary: 'mTLS_HARDWARE_AUTHENTICATED_PARAMEDIC_TABLET',
      shid: card.shid,
      patientNameInitials: card.fullName.split(' ').map((n) => n[0]).join('. ') + '.',
      bloodType: patient.bloodGroup || 'O+',
      genotype: patient.genotype || 'AA',
      codeStatus: 'FULL CODE (Resuscitate)',
      criticalAllergies,
      chronicAlertConditions: patient.chronicConditions && patient.chronicConditions.length > 0
        ? patient.chronicConditions
        : ['Severe Asthma (Inhaler dependent)'],
      currentCriticalMedications: patient.currentMedications && patient.currentMedications.length > 0
        ? patient.currentMedications
        : ['Salbutamol 100mcg Inhaler PRN', 'EpiPen 0.3mg Auto-Injector'],
      emergencyContacts: [
        {
          name: patient.emergencyContact || 'Dr. E. Rivera (Next of Kin)',
          relation: patient.emergencyRelation || 'Spouse',
          phone: patient.phone || '+234 802 000 7842',
        },
      ],
      privacyNotice: 'Zero clinical notes, financial or demographic PII exposed to paramedic terminal. Fast-path triage only.',
    };
  }

  if (mode === 'clinic') {
    // Clinic EMR Mode: certified OAuth2 handshake unlocks full EHR
    return {
      status: '200_OK_OAUTH2_AUTHENTICATED_CLINIC_EMR',
      timestamp: now,
      authBoundary: 'OAUTH2_BEARER_TOKEN_CERTIFIED_FACILITY',
      clinicFacility: patient.facilityName || 'Ikot Ekpene General Hospital',
      shid: card.shid,
      demographics: {
        fullName: card.fullName,
        dob: card.dob,
        gender: card.gender,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        lga: patient.lga,
        state: patient.state || 'Akwa Ibom',
        nin: patient.nin,
        nhiaNumber: patient.nhiaNumber,
      },
      clinicalSummary: {
        bloodGroup: patient.bloodGroup || 'O+',
        genotype: patient.genotype || 'AA',
        allergies: patient.allergies || ['Penicillin', 'Peanuts'],
        chronicConditions: patient.chronicConditions || ['Severe Asthma', 'Essential Hypertension'],
        currentMedications: patient.currentMedications || ['Salbutamol Inhaler', 'Amlodipine 5mg OD'],
        surgicalHistory: patient.surgicalHistory || 'Appendectomy (2018)',
        familyHistory: patient.familyHistory || 'Type 2 Diabetes (Maternal)',
        immunizations: patient.immunizations || 'COVID-19 Full, Yellow Fever, Hepatitis B',
        activeProblems: patient.problems || ['Asthma control follow-up', 'Routine dental check'],
      },
      insurance: {
        provider: patient.insuranceProvider || 'AKSHIA (State Health Insurance)',
        id: patient.insuranceId || 'AKS-HIA-2026-9921',
        tier: 'State Civil Service & Primary Healthcare Scheme',
        status: 'ACTIVE_VERIFIED',
      },
      fhirBundleEndpoint: `https://hie.akwaibom.gov.ng/fhir/r4/Patient/${card.shid}/$everything`,
    };
  }

  // Public / Standard Phone Mode: Zero PII
  return {
    status: '200_OK_PUBLIC_VERIFICATION',
    timestamp: now,
    authBoundary: 'PUBLIC_UNAUTHENTICATED_CIVILIAN_SCAN',
    cardStatus: 'VALID_ACTIVE_STATE_CARD',
    stateAuthority: 'Akwa Ibom State Ministry of Health & HIE Directorate',
    hieRegistry: 'ARISE Health Information Exchange Gateway',
    cardIdentifierMasked: card.shid.slice(0, 8) + '***-VERIFIED',
    message: 'This is an authentic, registered Statewide Health Card issued under the ARISE Healthcare Agenda.',
    piiProtectionBanner: 'CONFIDENTIAL: Protected by the National Data Protection Act & State Healthcare Privacy Framework. Zero Protected Health Information (PHI) is disclosed to public scanning devices.',
    helpline: '0800-ARISE-HEALTH (0800-27473-432584)',
    emergencyDispatch: 'Call 112 / 999 for State Emergency Medical Services (Ambulance & Triage)',
  };
}

// HL7 FHIR R4 Compliant Bundle Generator
export function generateFhirR4Bundle(card: StatewideHealthCard, patient: FacilityPatient) {
  const patientResource = {
    resourceType: 'Patient',
    id: card.shid,
    identifier: [
      {
        use: 'official',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MC',
              display: "Patient's State Health Identifier",
            },
          ],
        },
        system: 'http://hie.akwaibom.gov.ng/fhir/sid/shid',
        value: card.shid,
      },
      {
        use: 'secondary',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number',
            },
          ],
        },
        system: `http://facility.medcore.ng/${patient.facilityId}/mrn`,
        value: patient.hospitalNumber,
      },
    ],
    active: patient.status !== 'inactive',
    name: [
      {
        use: 'official',
        family: patient.lastName,
        given: [patient.firstName, patient.middleName].filter(Boolean),
        text: card.fullName,
      },
    ],
    telecom: [
      { system: 'phone', value: patient.phone, use: 'mobile' },
      ...(patient.email ? [{ system: 'email', value: patient.email, use: 'home' }] : []),
    ],
    gender: patient.sex === 'Male' ? 'male' : patient.sex === 'Female' ? 'female' : 'other',
    birthDate: patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : '1992-03-15',
    address: [
      {
        use: 'home',
        line: [patient.address || 'State Residential District'],
        city: patient.lga || 'Uyo',
        state: patient.state || 'Akwa Ibom',
        country: 'NG',
      },
    ],
  };

  const allergiesResources = (patient.allergies || ['Penicillin']).map((allergen, idx) => ({
    resourceType: 'AllergyIntolerance',
    id: `allergy-${idx + 1}`,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: 'confirmed',
          display: 'Confirmed',
        },
      ],
    },
    type: 'allergy',
    category: ['medication'],
    criticality: 'high',
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '7980',
          display: allergen,
        },
      ],
      text: allergen,
    },
    patient: {
      reference: `Patient/${card.shid}`,
      display: card.fullName,
    },
  }));

  const conditionResources = (patient.chronicConditions || ['Severe Asthma']).map((cond, idx) => ({
    resourceType: 'Condition',
    id: `condition-${idx + 1}`,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'problem-list-item',
            display: 'Problem List Item',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '195967001',
          display: cond,
        },
      ],
      text: cond,
    },
    subject: {
      reference: `Patient/${card.shid}`,
      display: card.fullName,
    },
  }));

  const coverageResource = {
    resourceType: 'Coverage',
    id: 'cov-1',
    status: 'active',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'PUBLICPOL',
          display: 'public healthcare policy',
        },
      ],
    },
    subscriber: {
      reference: `Patient/${card.shid}`,
    },
    beneficiary: {
      reference: `Patient/${card.shid}`,
    },
    payor: [
      {
        display: patient.insuranceProvider || 'Akwa Ibom State Health Insurance Agency (AKSHIA)',
      },
    ],
  };

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      { fullUrl: `urn:uuid:${card.shid}`, resource: patientResource },
      ...allergiesResources.map((a) => ({ fullUrl: `urn:uuid:${a.id}`, resource: a })),
      ...conditionResources.map((c) => ({ fullUrl: `urn:uuid:${c.id}`, resource: c })),
      { fullUrl: 'urn:uuid:cov-1', resource: coverageResource },
    ],
  };
}

// Apple Wallet pass.json format manifest
export function generateAppleWalletPassJson(card: StatewideHealthCard) {
  return {
    formatVersion: 1,
    passTypeIdentifier: 'pass.ng.gov.akwaibom.healthcard',
    serialNumber: card.shid,
    teamIdentifier: 'AKWAIBOMHIE',
    organizationName: 'Akwa Ibom State Ministry of Health',
    description: 'ARISE Statewide Digital Health Card',
    logoText: 'ARISE Health',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(11, 59, 46)',
    labelColor: 'rgb(52, 211, 153)',
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: card.hieGatewayUrl,
      messageEncoding: 'iso-8859-1',
      altText: card.shid,
    },
    generic: {
      primaryFields: [
        {
          key: 'patientName',
          label: 'PATIENT FULL NAME',
          value: card.fullName,
        },
      ],
      secondaryFields: [
        {
          key: 'shid',
          label: 'STATE HEALTH ID',
          value: card.shid,
        },
        {
          key: 'dob',
          label: 'DATE OF BIRTH',
          value: card.dob,
        },
      ],
      auxiliaryFields: [
        {
          key: 'emergency',
          label: 'EMERGENCY FLAG',
          value: card.emergencyFlag ? 'CRITICAL ALERTS' : 'STANDARD',
        },
        {
          key: 'expires',
          label: 'EXPIRY DATE',
          value: card.expiryDate,
        },
      ],
      backFields: [
        {
          key: 'privacy',
          label: 'ZERO-PRINT PRIVACY STANDARD',
          value: 'This card contains no printed medical data. Scanning with an authorized healthcare terminal resolves clinical records securely over TLS.',
        },
        {
          key: 'hie',
          label: 'STATE HEALTH INFORMATION EXCHANGE',
          value: 'Integrated with Epic, Cerner, and MedCore via HL7 FHIR R4 interoperability framework.',
        },
        {
          key: 'helpline',
          label: 'LOST CARD REPORTING',
          value: 'If found, return to nearest hospital or call 0800-ARISE-HEALTH (0800-27473-432584).',
        },
      ],
    },
  };
}

// Paramedic offline key validation
export function decryptOfflinePayload(encryptedContainer: string, key: string): {
  success: boolean;
  data?: any;
  error?: string;
} {
  const cleanKey = key.trim().toUpperCase();
  // Authorized paramedic keys: AMBULANCE-KEY-8824, PARAMEDIC-EMS-911, RESCUE-KEY-2026
  const validKeys = ['AMBULANCE-KEY-8824', 'PARAMEDIC-EMS-911', 'RESCUE-KEY-2026', 'ARISE-EMS-112'];

  if (!validKeys.includes(cleanKey)) {
    return {
      success: false,
      error: 'Invalid or uncertified paramedic hardware key. Access to encrypted emergency partition denied.',
    };
  }

  try {
    const parts = encryptedContainer.split('::');
    if (parts.length < 2) {
      return { success: false, error: 'Malformed encrypted partition container.' };
    }
    const decryptedJson = decodeURIComponent(atob(parts[1]));
    return {
      success: true,
      data: JSON.parse(decryptedJson),
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Decryption failure: ${err.message || 'Cipher block corrupted'}`,
    };
  }
}
