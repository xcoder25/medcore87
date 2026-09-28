// ─── Bedside eMAR & Barcode Medication Administration (BCMA) Types ─────────

export type MedicationAdminStatus = 
  | 'DUE' 
  | 'GIVEN' 
  | 'HELD' 
  | 'REFUSED' 
  | 'OMITTED';

export interface EmarOrder {
  id: string;
  prescriptionId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  bedNumber: string;
  drugName: string;
  dosage: string;
  route: string;
  frequency: string;
  instructions?: string;
  isControlledSubstance: boolean;
  scheduledTime: string;
  status: MedicationAdminStatus;
  prescribedBy: string;
  holdingReason?: string;
}

export interface EmarAdminRecord {
  id: string;
  emarOrderId: string;
  patientId: string;
  mrn: string;
  bedNumber: string;
  drugName: string;
  doseGiven: string;
  route: string;
  administeredAt: string;
  administeredByBadge: string;
  administeredByName: string;
  verifiedViaBarcode: boolean;
  patientBarcodeScanned: string;
  drugBarcodeScanned: string;
  vitalsAtAdministration?: {
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    bloodGlucose?: number;
    painScore?: number;
  };
  // Dangerous Drugs Register (DDR) / Controlled substance dual sign-off
  isControlledSubstance: boolean;
  witnessBadge?: string;
  witnessName?: string;
  narcoticBatchNumber?: string;
  remainingAmpoulesOrTablets?: number;
  notes?: string;
}

export interface ControlledSubstanceRegisterEntry {
  id: string;
  drugName: string;
  strength: string;
  facilityId: string;
  wardId: string;
  batchNumber: string;
  expiryDate: string;
  startingBalance: number;
  quantityAdministered: number;
  remainingBalance: number;
  patientName: string;
  mrn: string;
  prescribedByDoctor: string;
  primaryNurseName: string;
  witnessNurseName: string;
  timestamp: string;
  verified: boolean;
}
