export type BedStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance' | 'isolation';

export interface HospitalBed {
  id: string;
  bedNumber: string;
  roomNumber: string;
  ward: string;
  department: 'emergency' | 'icu' | 'general_ward' | 'cardiology' | 'oncology' | 'pediatrics' | 'surgical' | 'maternity' | 'nicu';
  status: BedStatus;
  currentPatientId?: string;
  lastSanitizedAt: string;
  equipmentAssigned: string[];
}

export interface PatientFlowStep {
  patientId: string;
  stage: 'triage' | 'waiting' | 'in_bed' | 'imaging' | 'or' | 'pacu' | 'discharge_lounge';
  enteredAt: string;
  targetDischargeTime?: string;
  acuityScore: 1 | 2 | 3 | 4 | 5; // ESI scale
}

export interface SystemAuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'CONSULT';
  resourceType: 'Patient' | 'ClinicalRecord' | 'Prescription' | 'Bed' | 'Roster';
  resourceId: string;
  ipAddress: string;
  complianceFlags: {
    hipaaAudited: boolean;
    gdprAudited: boolean;
  };
}

// ─── HOSPITAL CORE ─────────────────────────────────────────────────────────────

export interface EmergencyTriagePatient {
  id: string;
  patientName: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  esiLevel: 1 | 2 | 3 | 4 | 5; // 1 = Immediate/Resus, 5 = Non-urgent
  chiefComplaint: string;
  vitals: {
    bp: string;
    pulse: number;
    spo2: number;
    temp: number;
    rr: number;
  };
  arrivalTime: string;
  bayAssigned: string;
  status: 'triage' | 'resuscitation' | 'trauma_bay' | 'awaiting_bed' | 'admitted';
}

export interface PrescriptionOrder {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  prescribingDoctor: string;
  status: 'pending' | 'verified' | 'dispensed' | 'cancelled';
  orderedAt: string;
  interactionAlert?: string;
}

export interface FormularyItem {
  id: string;
  code: string;
  name: string;
  category: string;
  stockOnHand: number;
  unit: string;
  minimumThreshold: number;
  expiryDate: string;
  unitPriceNgn: number;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  testName: string;
  specimenType: 'Blood' | 'Urine' | 'CSF' | 'Swab' | 'Tissue';
  barcode: string;
  status: 'ordered' | 'collected' | 'analyzing' | 'completed' | 'critical';
  orderedAt: string;
  result?: string;
  referenceRange?: string;
  isPanicValue?: boolean;
}

export interface RadiologyStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US' | 'MAMMO';
  bodyPart: string;
  reason: string;
  status: 'scheduled' | 'in_progress' | 'acquired' | 'reported';
  orderedAt: string;
  radiologist?: string;
  findings?: string;
  thumbnailUrl?: string;
}

export interface SurgicalCase {
  id: string;
  patientName: string;
  theatreNumber: string;
  procedure: string;
  leadSurgeon: string;
  anesthetist: string;
  scheduledTime: string;
  status: 'pre_op' | 'in_surgery' | 'closing' | 'pacu' | 'completed';
  whoChecklistCompleted: boolean;
  bloodUnitsCrossmatched: number;
}

export interface ICUStation {
  id: string;
  stationNumber: string;
  patientName: string;
  diagnosis: string;
  ventilatorMode: string;
  peep: number;
  fio2: number;
  arterialPressure: string;
  gcsScore: number; // Glasgow Coma Scale 3-15
  sofaScore: number;
  nurseOnDuty: string;
  alertStatus: 'stable' | 'warning' | 'critical';
}

export interface LabourWardPatient {
  id: string;
  patientName: string;
  gravidaPara: string;
  cervicalDilationCm: number;
  fetalHeartRateBpm: number;
  contractionsPer10Min: number;
  romTime?: string;
  riskStatus: 'low_risk' | 'moderate_risk' | 'emergency_csection';
  midwifeOnDuty: string;
}

export interface PaediatricPatient {
  id: string;
  patientName: string;
  ageMonths: number;
  weightKg: number;
  heightCm: number;
  diagnosis: string;
  immunizationStatus: 'up_to_date' | 'delayed' | 'defaulter';
  wardBed: string;
}

export interface NicuIncubator {
  id: string;
  unitNumber: string;
  babyName: string;
  gestationalWeeks: number;
  birthWeightGrams: number;
  tempCelsius: number;
  phototherapyActive: boolean;
  oxygenLpm: number;
  apgar10Min: number;
}

export interface BloodStockUnit {
  id: string;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  component: 'Whole Blood' | 'Packed RBC' | 'Fresh Frozen Plasma' | 'Platelets';
  unitsAvailable: number;
  criticalThreshold: number;
  nearestExpiry: string;
  testingStatus: 'cleared_hiv_hep_syphilis' | 'quarantine';
}

export interface NursingCareItem {
  id: string;
  bedNumber: string;
  patientName: string;
  careActivity: string;
  frequency: string;
  nextScheduledTime: string;
  status: 'pending' | 'completed' | 'overdue';
  assignedNurse: string;
}

// ─── HOSPITAL OPERATIONS ───────────────────────────────────────────────────────

export interface AmbulanceUnit {
  id: string;
  callSign: string;
  vehicleType: 'Type C Advanced Life Support' | 'Type B Basic Life Support' | 'Neonatal Transport';
  status: 'available' | 'en_route_scene' | 'patient_onboard' | 'at_hospital' | 'maintenance';
  crew: string[];
  currentLocation: string;
  etaMinutes?: number;
  destination: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  itemName: string;
  category: 'Pharmaceuticals' | 'Surgical Consumables' | 'PPE & Linen' | 'Lab Reagents';
  stockOnHand: number;
  reorderPoint: number;
  unitCostNgn: number;
  supplier: string;
  leadTimeDays: number;
}

export interface BiomedicalDevice {
  id: string;
  assetTag: string;
  deviceName: string;
  department: string;
  manufacturer: string;
  model: string;
  status: 'operational' | 'calibration_due' | 'under_repair' | 'decommissioned';
  lastCalibratedAt: string;
  nextServiceDue: string;
}

export interface FacilityTelemetry {
  oxygenManifoldPsi: number;
  oxygenStatus: 'NORMAL' | 'LOW' | 'CRITICAL';
  backupGeneratorKw: number;
  generatorFuelPercent: number;
  medicalVacuumBar: number;
  waterSupplyLiters: number;
  hvacHepaPressurePa: number;
}

export interface SafetyIncidentReport {
  id: string;
  incidentType: 'Needlestick' | 'Patient Fall' | 'Medication Error' | 'Chemical Spill' | 'Equipment Failure';
  department: string;
  severity: 'Near Miss' | 'Minor' | 'Moderate' | 'Major';
  reportedAt: string;
  reporterRole: string;
  status: 'open_investigation' | 'containment_active' | 'resolved';
}

// ─── FINANCE & ADMINISTRATION ──────────────────────────────────────────────────

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  admissionDate: string;
  dischargeDate?: string;
  totalChargesNgn: number;
  hmoCoveredNgn: number;
  patientCopayNgn: number;
  amountPaidNgn: number;
  status: 'unbilled' | 'pending_payment' | 'settled' | 'hmo_dispute';
}

export interface HmoInsuranceClaim {
  id: string;
  claimNumber: string;
  hmoProvider: 'AKSHIA (State Scheme)' | 'Hygeia HMO' | 'Reliance HMO' | 'AXA Mansard';
  patientNhiaId: string;
  amountNgn: number;
  submittedDate: string;
  status: 'submitted' | 'under_review' | 'preauthorized' | 'paid' | 'denied';
  denialReason?: string;
}

export interface ProcurementOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  itemSummary: string;
  totalAmountNgn: number;
  orderedAt: string;
  deliveryStatus: 'draft' | 'approved' | 'in_transit' | 'received_inspected';
}

// ─── INTEROPERABILITY & CONNECTED IOT ──────────────────────────────────────────

export interface FhirResourceHeader {
  resourceType: 'Patient' | 'Encounter' | 'Observation' | 'Condition' | 'MedicationRequest';
  id: string;
  fhirVersion: 'R4';
  lastUpdated: string;
  identifierSystem: string;
  identifierValue: string;
}

export interface ConnectedMonitorFeed {
  deviceId: string;
  bedId: string;
  patientName: string;
  heartRateBpm: number;
  spo2Percent: number;
  respiratoryRate: number;
  nibpSysDia: string;
  connectionState: 'online' | 'packet_loss' | 'offline';
  lastPing: string;
}
