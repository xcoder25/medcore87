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
}
