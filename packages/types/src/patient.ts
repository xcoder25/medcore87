export interface PatientProfile {
  id: string;
  mrn: string; // Medical Record Number
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'undisclosed';
  preferredLanguage: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  contact: {
    email: string;
    phone: string;
    address: string;
  };
  allergies: Array<{ allergen: string; severity: 'mild' | 'moderate' | 'severe'; reaction: string }>;
  chronicConditions: string[];
  activeMedications: Array<{ name: string; dosage: string; frequency: string; prescribingDoctor: string }>;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  isMedicalTourist: boolean;
  // Enhanced Identity & Master Patient Index
  nin?: string;
  ninStatus?: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
  stateHealthId?: string; // Akwa Ibom State Health ID: AKS-HID-XXXX
  insurancePolicyId?: string;
  insuranceProvider?: string;
}

export type EncounterType =
  | 'ADMISSION'
  | 'DISCHARGE'
  | 'TRANSFER'
  | 'EMERGENCY_TRIAGE'
  | 'OUTPATIENT_CLINIC';

export interface PatientEncounter {
  id: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  type: EncounterType;
  ward?: string;
  bed?: string;
  admittingDoctorId?: string;
  admittingDoctorName?: string;
  admittedAt: string;
  dischargedAt?: string;
  dischargeDisposition?: 'HOME' | 'REFERRED' | 'DECEASED' | 'AGAINST_MEDICAL_ADVICE';
  status: 'ACTIVE' | 'DISCHARGED' | 'TRANSFERRED';
  chiefComplaint?: string;
  workingDiagnosis?: string;
}
