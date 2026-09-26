import { BedStatus, PharmacyStockItem, StockTransaction, HmoClaim, EncounterType } from '@medcore/types';
import { encryptField, decryptField, EncryptedPayload } from '../security/crypto';
import { auditLedger } from '../security/auditLedger';
import { syncEventBus } from '../sync/eventBus';
import { persistenceService } from './persistence';

// ─── Facility Types ──────────────────────────────────────────────────────────
export type FacilityEnrollmentStatus = 'pending' | 'credentials_issued' | 'active';

export type FacilityTier =
  | 'national_referral'
  | 'regional_general'
  | 'district_hospital'
  | 'cottage_hospital'
  | 'specialized_center'
  | 'comprehensive_health_centre';

export interface FacilityRecord {
  facilityId: string;
  facilityName: string;
  location: string;
  region: string;
  tier: FacilityTier;
  enrollmentStatus: FacilityEnrollmentStatus;
  hospiLogin?: string;
  hospiTempPassword?: string;
  credentialsIssuedAt?: string;
  activatedAt?: string;
  lastSeenAt?: string;
  totalBeds?: number;
  occupiedBeds?: number;
  icuBedsTotal?: number;
  icuBedsOccupied?: number;
  ventilatorsAvailable?: number;
  staffOnDuty?: number;
  complianceScore?: number;
  emergencyStatus?: 'normal' | 'surge_code_yellow' | 'surge_code_red' | 'critical';
  licenseNumber?: string;
  licenseExpires?: string;
  accreditationStatus?: 'accredited' | 'provisional' | 'suspended' | 'pending';
  createdAt: string;
}

/** Official list – Secondary Health Care Facilities in Akwa Ibom State */
const AKS_FACILITIES_RAW: { name: string; location: string }[] = [
  { name: 'Immanuel General Hospital',           location: 'Eket' },
  { name: 'General Hospital',                    location: 'Ikot Ekpene' },
  { name: 'General Hospital',                    location: 'Iquita Oron' },
  { name: 'Methodist General Hospital',          location: 'Ituk Mbang' },
  { name: 'General Hospital',                    location: 'Etinan' },
  { name: 'General Hospital',                    location: 'Ukpom Abak' },
  { name: 'General Hospital',                    location: 'Awa' },
  { name: 'General Hospital',                    location: 'Ikot Okoro' },
  { name: 'General Hospital',                    location: 'Ikono' },
  { name: 'General Hospital',                    location: 'Amammong, Okobo' },
  { name: 'Mount Carmel Hospital',               location: 'Akpa Utong' },
  { name: 'General Hospital',                    location: 'Urue-Offong/Oruko' },
  { name: 'General Hospital',                    location: 'Ikpe Annang' },
  { name: 'General Hospital',                    location: 'Ini' },
  { name: 'General Hospital',                    location: 'Ikot Abasi' },
  { name: 'General Hospital',                    location: 'Mbioto 2' },
  { name: 'Mary Slessor General Hospital',       location: 'Itu' },
  { name: 'General Hospital',                    location: 'Uruk Ata Ikot Ekpor' },
  { name: 'QIC Leprosy Hospital',                location: 'Ekpene Obom' },
  { name: 'Infectious Disease Hospital',         location: 'Ikot Ekpene' },
  { name: 'Psychiatric Hospital',                location: 'Eket' },
  { name: 'Cottage Hospital',                    location: 'Ukana' },
  { name: 'Cottage Hospital',                    location: 'Ibeno' },
  { name: 'Cottage Hospital',                    location: 'Ikot Abia' },
  { name: 'Cottage Hospital',                    location: 'Ikot Ekpaw' },
  { name: 'Cottage Hospital',                    location: 'Asong' },
  { name: 'Cottage Hospital',                    location: 'Ekpene Obo' },
  { name: 'Cottage Hospital',                    location: 'Ikot Eko Ibon' },
  { name: 'Cottage Hospital',                    location: 'Eastern Obolo' },
  { name: 'Cottage Hospital',                    location: 'Ikot Ekpene Udo' },
  { name: 'Redeemer Cottage Hospital',           location: 'Ibesit' },
  { name: 'Cottage Hospital',                    location: 'Akai Ubium' },
  { name: 'Cottage Hospital',                    location: 'Ika' },
  { name: 'Comprehensive Health Care Centre',    location: 'Nto Edino' },
  { name: 'Comprehensive Health Care Centre',    location: 'Mbiaya Uruan' },
];

function _facilityRegion(location: string, name: string): string {
  const t = `${location} ${name}`.toUpperCase();
  if (t.includes('UYO') || t.includes('ITU') || t.includes('IBESIT') || t.includes('NTO EDINO') || t.includes('MBIAYA'))
    return 'Uyo Region';
  if (t.includes('EKET') || t.includes('ORON') || t.includes('OKOBO') || t.includes('IBENO') || t.includes('EASTERN OBOLO') || t.includes('URUE-OFFONG') || t.includes('ORUKO'))
    return 'Eket Region';
  if (t.includes('IKOT EKPENE') || t.includes('ABAK') || t.includes('UKANA') || t.includes('IKPE') || t.includes('EKPENE'))
    return 'Ikot Ekpene Region';
  if (t.includes('IKOT ABASI') || t.includes('EASTERN OBOLO') || t.includes('ORUK'))
    return 'Oruk Anam Region';
  return 'Other Regions';
}

function _facilityTier(name: string): FacilityTier {
  const t = name.toUpperCase();
  if (t.includes('PSYCHIATRIC') || t.includes('INFECTIOUS') || t.includes('LEPROSY')) return 'specialized_center';
  if (t.includes('COTTAGE') || t.includes('REDEEMER'))                                 return 'cottage_hospital';
  if (t.includes('COMPREHENSIVE'))                                                      return 'comprehensive_health_centre';
  return 'district_hospital';
}

function buildFacilityRegistry(): FacilityRecord[] {
  return AKS_FACILITIES_RAW.map((item, idx) => {
    const sn  = idx + 1;
    const id  = `AKS-SEC-${String(sn).padStart(3, '0')}`;
    const displayName = item.name === 'General Hospital'
      ? `General Hospital, ${item.location}`
      : `${item.name}, ${item.location}`;
    return {
      facilityId:          id,
      facilityName:        displayName,
      location:            item.location,
      region:              _facilityRegion(item.location, item.name),
      tier:                _facilityTier(item.name),
      enrollmentStatus:    'pending' as FacilityEnrollmentStatus,
      accreditationStatus: 'pending' as const,
      createdAt:           '2026-01-01T00:00:00Z',
    };
  });
}

export interface StoredPatientRecord {
  id: string;
  facilityId: string;
  mrn: string;
  name: string;
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  encryptedNationalId: EncryptedPayload;
  encryptedPhone: EncryptedPayload;
  encryptedAddress: EncryptedPayload;
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  insurancePolicyId: string;
  insuranceProvider: string;
  walletId: string;
  lastVisit: string;
  createdAt: string;
  nin?: string;
  ninStatus?: 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
  stateHealthId?: string;
}

export interface BedRecord {
  id: string;
  bedNumber: string;
  ward: string;
  facilityId: string;
  type: 'GENERAL' | 'ICU' | 'SURGICAL' | 'PEDIATRIC' | 'ISOLATION';
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING';
  currentPatientId?: string;
  currentPatientName?: string;
  assignedAt?: string;
}

export interface ClinicalOrder {
  id: string;
  patientId: string;
  encounterId: string;
  facilityId: string;
  orderedByDoctorId: string;
  orderedByDoctorName: string;
  type: 'LABORATORY' | 'PHARMACY' | 'RADIOLOGY' | 'PROCEDURE';
  title: string;
  details: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: 'PENDING' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  billed: boolean;
  cost: number;
  timestamp: string;
}

export interface PrescribedDrug {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: 'ORAL' | 'IV' | 'IM' | 'TOPICAL' | 'INHALED' | 'SUBLINGUAL';
  quantity: number;
  instructions: string;
  dispensed: boolean;
  dispensedAt?: string;
  dispensedBy?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  facilityId: string;
  drugs: PrescribedDrug[];
  diagnosis: string;
  status: 'ACTIVE' | 'DISPENSED' | 'PARTIAL' | 'CANCELLED';
  routedToPharmacyId?: string;
  routedToPharmacyName?: string;
  notes?: string;
  createdAt: string;
  dispensedAt?: string;
}

export interface EncounterRecord {
  id: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  type: EncounterType;
  ward?: string;
  bed?: string;
  admittingDoctorId?: string;
  admittingDoctorName?: string;
  status: 'ACTIVE' | 'DISCHARGED' | 'TRANSFERRED';
  admittedAt: string;
  dischargedAt?: string;
  dischargeDisposition?: string;
  chiefComplaint?: string;
  workingDiagnosis?: string;
}

export class CentralDataStore {
  private patients: Map<string, StoredPatientRecord> = new Map();
  private beds: Map<string, BedRecord> = new Map();
  private encounters: Map<string, EncounterRecord> = new Map();
  private orders: Map<string, ClinicalOrder> = new Map();
  private prescriptions: Map<string, Prescription> = new Map();
  private facilities: Map<string, FacilityRecord> = new Map();
  private pharmacyStock: Map<string, PharmacyStockItem> = new Map();
  private stockTransactions: StockTransaction[] = [];
  private hmoClaims: Map<string, HmoClaim> = new Map();

  constructor() {
    const loaded = this.loadFromDisk();
    if (!loaded) {
      this.seedStore();
      this.seedFacilities();
      this.seedPharmacyStock();
      this.saveToDisk();
    }
  }

  private seedStore(): void {
    // 1. Seed Patients with AES-256-GCM encrypted PII fields
    const p1: StoredPatientRecord = {
      id: 'PAT-849201',
      facilityId: 'FAC-001',
      mrn: 'MRN-78401',
      name: 'Amina Bello',
      dob: '1988-06-14',
      gender: 'FEMALE',
      encryptedNationalId: encryptField('NIN-8942-1084-9923'),
      encryptedPhone: encryptField('+234-803-492-8819'),
      encryptedAddress: encryptField('14 Victoria Island Boulevard, Lagos'),
      bloodGroup: 'O+',
      allergies: ['Penicillin', 'Sulfa Drugs'],
      chronicConditions: ['Hypertension Type 2', 'Hyperlipidemia'],
      insurancePolicyId: 'AXA-POL-88219',
      insuranceProvider: 'AXA Mansard Health',
      walletId: 'WAL-PAT-001',
      lastVisit: '2026-02-28',
      createdAt: '2026-01-10T08:00:00Z',
    };

    const p2: StoredPatientRecord = {
      id: 'PAT-620194',
      facilityId: 'FAC-001',
      mrn: 'MRN-99201',
      name: 'Emeka Okafor',
      dob: '1976-11-03',
      gender: 'MALE',
      encryptedNationalId: encryptField('NIN-5519-7712-4401'),
      encryptedPhone: encryptField('+234-802-119-4820'),
      encryptedAddress: encryptField('42 Garki II Crescent, Abuja'),
      bloodGroup: 'A+',
      allergies: ['NSAIDs', 'Aspirin'],
      chronicConditions: ['Type 2 Diabetes Mellitus'],
      insurancePolicyId: 'HYG-POL-39102',
      insuranceProvider: 'Hygeia HMO',
      walletId: 'WAL-PAT-002',
      lastVisit: '2026-03-01',
      createdAt: '2026-01-12T10:00:00Z',
    };

    this.patients.set(p1.id, p1);
    this.patients.set(p2.id, p2);

    // 2. Seed Beds
    const bedsData: BedRecord[] = [
      { id: 'BED-101', bedNumber: '101', ward: 'Cardiology Ward A', facilityId: 'FAC-001', type: 'GENERAL', status: 'OCCUPIED', currentPatientId: 'PAT-849201', currentPatientName: 'Amina Bello', assignedAt: '2026-03-02T08:30:00Z' },
      { id: 'BED-102', bedNumber: '102', ward: 'Cardiology Ward A', facilityId: 'FAC-001', type: 'GENERAL', status: 'AVAILABLE' },
      { id: 'BED-201', bedNumber: 'ICU-1', ward: 'Critical Care / ICU', facilityId: 'FAC-001', type: 'ICU', status: 'OCCUPIED', currentPatientId: 'PAT-620194', currentPatientName: 'Emeka Okafor', assignedAt: '2026-03-03T01:15:00Z' },
      { id: 'BED-202', bedNumber: 'ICU-2', ward: 'Critical Care / ICU', facilityId: 'FAC-001', type: 'ICU', status: 'AVAILABLE' },
      { id: 'BED-301', bedNumber: 'ISO-1', ward: 'Infectious Disease Unit', facilityId: 'FAC-001', type: 'ISOLATION', status: 'AVAILABLE' },
    ];
    for (const b of bedsData) this.beds.set(b.id, b);

    // 3. Seed Clinical Orders
    const order1: ClinicalOrder = {
      id: 'ORD-LAB-01',
      patientId: 'PAT-849201',
      encounterId: 'ENC-9942',
      facilityId: 'FAC-001',
      orderedByDoctorId: 'DOC-101',
      orderedByDoctorName: 'Dr. Fatima Sanusi (Cardiologist)',
      type: 'LABORATORY',
      title: 'Full Blood Count + Troponin-T STAT',
      details: 'Check for acute myocardial infarction indicators',
      priority: 'STAT',
      status: 'COMPLETED',
      billed: true,
      cost: 65.0,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    };
    this.orders.set(order1.id, order1);

    // 4. Seed Sample Prescription
    const rx1: Prescription = {
      id: 'RX-849201-001',
      patientId: 'PAT-849201',
      patientName: 'Amina Bello',
      doctorId: 'DOC-101',
      doctorName: 'Dr. Fatima Sanusi',
      facilityId: 'FAC-001',
      diagnosis: 'Hypertension Type 2 + Hyperlipidemia',
      drugs: [
        {
          id: 'DRUG-001',
          name: 'Amlodipine',
          dosage: '5mg',
          frequency: 'Once daily',
          duration: '30 days',
          route: 'ORAL',
          quantity: 30,
          instructions: 'Take in the morning with or without food',
          dispensed: false,
        },
        {
          id: 'DRUG-002',
          name: 'Atorvastatin',
          dosage: '20mg',
          frequency: 'Once nightly',
          duration: '30 days',
          route: 'ORAL',
          quantity: 30,
          instructions: 'Take at bedtime',
          dispensed: false,
        },
        {
          id: 'DRUG-003',
          name: 'Aspirin',
          dosage: '75mg',
          frequency: 'Once daily',
          duration: '30 days',
          route: 'ORAL',
          quantity: 30,
          instructions: 'Take with food',
          dispensed: false,
        },
      ],
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    };
    this.prescriptions.set(rx1.id, rx1);
  }

  // ─── Facility Registry ──────────────────────────────────────────────────
  private seedFacilities(): void {
    for (const f of buildFacilityRegistry()) {
      this.facilities.set(f.facilityId, f);
    }
  }

  /** Return all facilities, optionally filtered by status or region */
  public getFacilities(params?: {
    status?: FacilityEnrollmentStatus;
    region?: string;
    tier?: FacilityTier;
  }): FacilityRecord[] {
    let list = Array.from(this.facilities.values());
    if (params?.status) list = list.filter(f => f.enrollmentStatus === params.status);
    if (params?.region) list = list.filter(f => f.region === params.region);
    if (params?.tier)   list = list.filter(f => f.tier === params.tier);
    return list;
  }

  public getFacilityById(id: string): FacilityRecord | undefined {
    return this.facilities.get(id);
  }

  /** Issue Hospi OS credentials for a pending facility */
  public issueFacilityCredentials(facilityId: string, actorId: string, actorName: string): FacilityRecord {
    const f = this.facilities.get(facilityId);
    if (!f) throw new Error(`Facility ${facilityId} not found`);
    if (f.enrollmentStatus !== 'pending') throw new Error(`Credentials already issued for ${facilityId}`);

    const slug = f.location.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    f.hospiLogin         = `HOSPI.${slug}.${facilityId.slice(-3)}`;
    f.hospiTempPassword  = `AKS-${rand}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    f.enrollmentStatus   = 'credentials_issued';
    f.credentialsIssuedAt = new Date().toISOString();

    auditLedger.logEvent({
      actorId, actorName,
      actorRole: 'MOH_COMMISSIONER',
      facilityId,
      action: 'CREDENTIALS_ISSUED',
      resourceType: 'FACILITY',
      resourceId: facilityId,
      reason: `Hospi OS credentials issued for ${f.facilityName}`,
    });

    syncEventBus.broadcast({
      topic: 'FACILITY_CREDENTIALS_ISSUED',
      facilityId,
      emitterApp: 'MEDCORE_ADMIN',
      payload: { facilityId, facilityName: f.facilityName, hospiLogin: f.hospiLogin },
    });

    return f;
  }

  /** Activate facility when it first logs into Hospi OS */
  public activateFacility(facilityId: string): FacilityRecord {
    const f = this.facilities.get(facilityId);
    if (!f) throw new Error(`Facility ${facilityId} not found`);

    const beds = f.tier === 'cottage_hospital'            ? 40 + Math.floor(Math.random() * 40)
               : f.tier === 'comprehensive_health_centre' ? 60 + Math.floor(Math.random() * 40)
               : f.tier === 'specialized_center'          ? 80 + Math.floor(Math.random() * 60)
               :                                            120 + Math.floor(Math.random() * 180);

    const occ      = Math.floor(beds * (0.55 + Math.random() * 0.35));
    const icuTotal = Math.max(2, Math.floor(beds / 12));
    const icuOcc   = Math.floor(icuTotal * (0.5 + Math.random() * 0.4));

    Object.assign(f, {
      enrollmentStatus:    'active',
      activatedAt:         new Date().toISOString(),
      lastSeenAt:          new Date().toISOString(),
      totalBeds:           beds,
      occupiedBeds:        occ,
      icuBedsTotal:        icuTotal,
      icuBedsOccupied:     icuOcc,
      ventilatorsAvailable: Math.floor(Math.random() * 6) + 1,
      staffOnDuty:         Math.floor(beds * 0.35) + 20,
      complianceScore:     Math.round((82 + Math.random() * 16) * 10) / 10,
      emergencyStatus:     'normal',
      licenseNumber:       `MOH-LIC-2026-${facilityId.slice(-3)}`,
      licenseExpires:      '2028-12-31',
      accreditationStatus: 'provisional',
    });

    return f;
  }

  /** Get summary counts for admin dashboard */
  public getFacilitySummary() {
    const all = Array.from(this.facilities.values());
    return {
      total:              all.length,
      pending:            all.filter(f => f.enrollmentStatus === 'pending').length,
      credentials_issued: all.filter(f => f.enrollmentStatus === 'credentials_issued').length,
      active:             all.filter(f => f.enrollmentStatus === 'active').length,
      byTier: {
        district_hospital:          all.filter(f => f.tier === 'district_hospital').length,
        cottage_hospital:           all.filter(f => f.tier === 'cottage_hospital').length,
        specialized_center:         all.filter(f => f.tier === 'specialized_center').length,
        comprehensive_health_centre: all.filter(f => f.tier === 'comprehensive_health_centre').length,
      },
      byRegion: {
        'Uyo Region':        all.filter(f => f.region === 'Uyo Region').length,
        'Eket Region':       all.filter(f => f.region === 'Eket Region').length,
        'Ikot Ekpene Region': all.filter(f => f.region === 'Ikot Ekpene Region').length,
        'Oruk Anam Region':  all.filter(f => f.region === 'Oruk Anam Region').length,
        'Other Regions':     all.filter(f => f.region === 'Other Regions').length,
      },
    };
  }

  // ─── Patient Methods with Decryption Controls ───
  public getPatients(decryptPII = false): Array<StoredPatientRecord | (StoredPatientRecord & { nationalId: string; phone: string; address: string })> {
    const list = Array.from(this.patients.values());
    if (!decryptPII) return list;

    return list.map((p) => ({
      ...p,
      nationalId: decryptField(p.encryptedNationalId),
      phone: decryptField(p.encryptedPhone),
      address: decryptField(p.encryptedAddress),
    }));
  }

  public getPatientById(id: string, decryptPII = false) {
    const p = this.patients.get(id);
    if (!p) return undefined;
    if (!decryptPII) return p;

    return {
      ...p,
      nationalId: decryptField(p.encryptedNationalId),
      phone: decryptField(p.encryptedPhone),
      address: decryptField(p.encryptedAddress),
    };
  }

  public registerPatient(params: {
    name: string;
    dob: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    nationalId: string;
    phone: string;
    address: string;
    facilityId: string;
    bloodGroup: string;
    allergies: string[];
    chronicConditions: string[];
    insurancePolicyId?: string;
    insuranceProvider?: string;
    nin?: string;
    stateHealthId?: string;
    actorId: string;
    actorName: string;
  }): StoredPatientRecord {
    const id = `PAT-${Math.floor(100000 + Math.random() * 900000)}`;
    const mrn = `MRN-${Math.floor(10000 + Math.random() * 90000)}`;
    const walletId = `WAL-${id}`;
    const nin = params.nin || params.nationalId;
    const isNinValid = /^\d{11}$/.test(nin.replace(/[^0-9]/g, ''));
    const stateHealthId = params.stateHealthId || `AKS-HID-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const record: StoredPatientRecord = {
      id,
      facilityId: params.facilityId,
      mrn,
      name: params.name,
      dob: params.dob,
      gender: params.gender,
      encryptedNationalId: encryptField(params.nationalId),
      encryptedPhone: encryptField(params.phone),
      encryptedAddress: encryptField(params.address),
      bloodGroup: params.bloodGroup,
      allergies: params.allergies,
      chronicConditions: params.chronicConditions,
      insurancePolicyId: params.insurancePolicyId || 'SELF-PAY',
      insuranceProvider: params.insuranceProvider || 'Self Pay',
      walletId,
      lastVisit: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      nin,
      ninStatus: isNinValid ? 'VERIFIED' : 'PENDING',
      stateHealthId,
    };

    this.patients.set(id, record);

    // Cryptographic audit
    auditLedger.logEvent({
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: 'NURSE',
      facilityId: params.facilityId,
      action: 'WRITE_PHI',
      resourceType: 'PATIENT',
      resourceId: id,
      reason: `New patient registered into Master Patient Index (MRN: ${mrn}, HID: ${stateHealthId})`,
    });

    // Broadcast across event bus
    syncEventBus.broadcast({
      topic: 'PATIENT_REGISTERED',
      facilityId: params.facilityId,
      emitterApp: 'MEDCORE_OS',
      payload: { patientId: id, mrn, stateHealthId, name: params.name, facilityId: params.facilityId },
    });

    this.saveToDisk();
    return record;
  }

  // ─── Beds ───
  public getBeds(facilityId?: string): BedRecord[] {
    const all = Array.from(this.beds.values());
    if (facilityId) return all.filter((b) => b.facilityId === facilityId);
    return all;
  }

  public updateBedStatus(
    bedId: string,
    status: BedRecord['status'],
    patient?: { id: string; name: string }
  ): BedRecord {
    const bed = this.beds.get(bedId);
    if (!bed) throw new Error(`Bed ${bedId} not found`);

    bed.status = status;
    if (status === 'OCCUPIED' && patient) {
      bed.currentPatientId = patient.id;
      bed.currentPatientName = patient.name;
      bed.assignedAt = new Date().toISOString();
    } else if (status === 'AVAILABLE' || status === 'CLEANING') {
      bed.currentPatientId = undefined;
      bed.currentPatientName = undefined;
      bed.assignedAt = undefined;
    }

    syncEventBus.broadcast({
      topic: status === 'OCCUPIED' ? 'BED_OCCUPIED' : 'BED_VACATED',
      facilityId: bed.facilityId,
      emitterApp: 'MEDCORE_OS',
      payload: { bedId: bed.id, bedNumber: bed.bedNumber, status: bed.status, patientId: bed.currentPatientId },
    });

    this.saveToDisk();
    return bed;
  }

  // ─── Clinical Orders ───
  public createOrder(params: Omit<ClinicalOrder, 'id' | 'timestamp'>): ClinicalOrder {
    const id = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const order: ClinicalOrder = {
      ...params,
      id,
      timestamp: new Date().toISOString(),
    };

    this.orders.set(id, order);

    syncEventBus.broadcast({
      topic: params.type === 'LABORATORY' ? 'LAB_ORDERED' : 'MEDICATION_PRESCRIBED',
      facilityId: params.facilityId,
      emitterApp: 'MEDCORE_CLINIC',
      payload: { orderId: id, patientId: params.patientId, title: params.title, priority: params.priority },
    });

    this.saveToDisk();
    return order;
  }

  public getOrders(patientId?: string): ClinicalOrder[] {
    const all = Array.from(this.orders.values());
    if (patientId) return all.filter((o) => o.patientId === patientId);
    return all;
  }

  // ─── Prescription / Pharmacy Methods ───
  public createPrescription(params: {
    patientId: string;
    patientName: string;
    doctorId: string;
    doctorName: string;
    facilityId: string;
    diagnosis: string;
    drugs: Omit<PrescribedDrug, 'dispensed'>[];
    routedToPharmacyId?: string;
    routedToPharmacyName?: string;
    notes?: string;
  }): Prescription {
    const id = `RX-${params.patientId}-${Date.now().toString(36).toUpperCase()}`;
    const prescription: Prescription = {
      id,
      patientId: params.patientId,
      patientName: params.patientName,
      doctorId: params.doctorId,
      doctorName: params.doctorName,
      facilityId: params.facilityId,
      diagnosis: params.diagnosis,
      drugs: params.drugs.map((d) => ({ ...d, dispensed: false })),
      status: 'ACTIVE',
      routedToPharmacyId: params.routedToPharmacyId,
      routedToPharmacyName: params.routedToPharmacyName,
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };
    this.prescriptions.set(id, prescription);

    syncEventBus.broadcast({
      topic: 'PRESCRIPTION_CREATED',
      facilityId: params.facilityId,
      emitterApp: 'MEDCORE_CLINIC',
      payload: {
        rxId: id,
        patientId: params.patientId,
        patientName: params.patientName,
        doctorName: params.doctorName,
        drugCount: params.drugs.length,
        routedToPharmacyId: params.routedToPharmacyId,
        routedToPharmacyName: params.routedToPharmacyName,
      },
    });

    this.saveToDisk();
    return prescription;
  }

  public getPrescriptionsByPatient(patientId: string): Prescription[] {
    return Array.from(this.prescriptions.values()).filter((rx) => rx.patientId === patientId);
  }

  public getPrescriptionById(rxId: string): Prescription | undefined {
    return this.prescriptions.get(rxId);
  }

  public getAllPrescriptions(pharmacyId?: string): Prescription[] {
    const all = Array.from(this.prescriptions.values());
    if (pharmacyId) return all.filter((rx) => rx.routedToPharmacyId === pharmacyId);
    return all;
  }

  public dispenseDrug(
    rxId: string,
    drugId: string,
    dispensedBy: string
  ): Prescription {
    const rx = this.prescriptions.get(rxId);
    if (!rx) throw new Error(`Prescription ${rxId} not found`);

    const drug = rx.drugs.find((d) => d.id === drugId);
    if (!drug) throw new Error(`Drug ${drugId} not found in prescription ${rxId}`);
    if (drug.dispensed) throw new Error(`Drug ${drugId} has already been dispensed`);

    drug.dispensed = true;
    drug.dispensedAt = new Date().toISOString();
    drug.dispensedBy = dispensedBy;

    // Deplete stock in pharmacy stock ledger
    const matchingStock = Array.from(this.pharmacyStock.values()).find(
      (s) => s.genericName.toLowerCase().includes(drug.name.toLowerCase()) || drug.name.toLowerCase().includes(s.genericName.toLowerCase())
    );
    if (matchingStock) {
      try {
        this.depleteStock({
          itemCode: matchingStock.itemCode,
          quantity: drug.quantity || 1,
          referenceId: rxId,
          actorName: dispensedBy,
        });
      } catch (stockErr) {
        console.warn(`[Dispense] Stock depletion notice for ${drug.name}:`, stockErr);
      }
    }

    // Update overall prescription status
    const allDispensed = rx.drugs.every((d) => d.dispensed);
    const anyDispensed = rx.drugs.some((d) => d.dispensed);
    if (allDispensed) {
      rx.status = 'DISPENSED';
      rx.dispensedAt = new Date().toISOString();
    } else if (anyDispensed) {
      rx.status = 'PARTIAL';
    }

    syncEventBus.broadcast({
      topic: 'PRESCRIPTION_DISPENSED',
      facilityId: rx.facilityId,
      emitterApp: 'MEDCORE_OS_PHARMACY',
      payload: {
        rxId,
        patientId: rx.patientId,
        drugName: drug.name,
        dispensedBy,
        status: rx.status,
      },
    });

    this.saveToDisk();
    return rx;
  }

  public routePrescription(
    rxId: string,
    pharmacyId: string,
    pharmacyName: string
  ): Prescription {
    const rx = this.prescriptions.get(rxId);
    if (!rx) throw new Error(`Prescription ${rxId} not found`);
    rx.routedToPharmacyId = pharmacyId;
    rx.routedToPharmacyName = pharmacyName;
    this.saveToDisk();
    return rx;
  }

  // ─── ADT / Encounter Lifecycle Methods ──────────────────────────────────────
  public admitPatient(params: {
    patientId: string;
    patientName: string;
    facilityId: string;
    type: EncounterType;
    ward: string;
    bed: string;
    admittingDoctorId?: string;
    admittingDoctorName?: string;
    chiefComplaint?: string;
    workingDiagnosis?: string;
  }): EncounterRecord {
    const encounterId = `ENC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const encounter: EncounterRecord = {
      id: encounterId,
      patientId: params.patientId,
      patientName: params.patientName,
      facilityId: params.facilityId,
      type: params.type,
      ward: params.ward,
      bed: params.bed,
      admittingDoctorId: params.admittingDoctorId || 'DOC-DEFAULT',
      admittingDoctorName: params.admittingDoctorName || 'Attending Physician',
      status: 'ACTIVE',
      admittedAt: new Date().toISOString(),
      chiefComplaint: params.chiefComplaint,
      workingDiagnosis: params.workingDiagnosis,
    };

    this.encounters.set(encounterId, encounter);

    // Update bed if exists
    const bedMatch = Array.from(this.beds.values()).find(
      (b) => b.ward.toLowerCase() === params.ward.toLowerCase() && b.bedNumber.toLowerCase() === params.bed.toLowerCase()
    );
    if (bedMatch) {
      this.updateBedStatus(bedMatch.id, 'OCCUPIED', { id: params.patientId, name: params.patientName });
    }

    syncEventBus.broadcast({
      topic: 'PATIENT_ADMITTED',
      facilityId: params.facilityId,
      emitterApp: 'MEDCORE_CLINIC',
      payload: {
        encounterId,
        patientId: params.patientId,
        patientName: params.patientName,
        ward: params.ward,
        bed: params.bed,
        workingDiagnosis: params.workingDiagnosis,
      },
    });

    this.saveToDisk();
    return encounter;
  }

  public transferPatient(params: {
    encounterId: string;
    targetWard: string;
    targetBed: string;
    transferredBy: string;
    reason: string;
  }): EncounterRecord {
    const enc = this.encounters.get(params.encounterId);
    if (!enc) throw new Error(`Encounter ${params.encounterId} not found`);

    const prevWard = enc.ward;
    const prevBed = enc.bed;
    enc.ward = params.targetWard;
    enc.bed = params.targetBed;

    // Vacate previous bed
    if (prevWard && prevBed) {
      const oldBed = Array.from(this.beds.values()).find(
        (b) => b.ward.toLowerCase() === prevWard.toLowerCase() && b.bedNumber.toLowerCase() === prevBed.toLowerCase()
      );
      if (oldBed) this.updateBedStatus(oldBed.id, 'AVAILABLE');
    }

    // Occupy new bed
    const newBed = Array.from(this.beds.values()).find(
      (b) => b.ward.toLowerCase() === params.targetWard.toLowerCase() && b.bedNumber.toLowerCase() === params.targetBed.toLowerCase()
    );
    if (newBed) {
      this.updateBedStatus(newBed.id, 'OCCUPIED', { id: enc.patientId, name: enc.patientName });
    }

    syncEventBus.broadcast({
      topic: 'BED_OCCUPIED',
      facilityId: enc.facilityId,
      emitterApp: 'MEDCORE_OS',
      payload: {
        encounterId: enc.id,
        patientId: enc.patientId,
        fromWard: prevWard,
        fromBed: prevBed,
        toWard: params.targetWard,
        toBed: params.targetBed,
        transferredBy: params.transferredBy,
        reason: params.reason,
      },
    });

    this.saveToDisk();
    return enc;
  }

  public dischargePatient(params: {
    encounterId: string;
    dischargedBy: string;
    disposition: 'HOME' | 'REFERRED' | 'DECEASED' | 'AGAINST_MEDICAL_ADVICE';
    summary?: string;
  }): EncounterRecord {
    const enc = this.encounters.get(params.encounterId);
    if (!enc) throw new Error(`Encounter ${params.encounterId} not found`);

    enc.status = 'DISCHARGED';
    enc.dischargedAt = new Date().toISOString();
    enc.dischargeDisposition = params.disposition;

    // Free bed
    if (enc.ward && enc.bed) {
      const bed = Array.from(this.beds.values()).find(
        (b) => b.ward.toLowerCase() === enc.ward?.toLowerCase() && b.bedNumber.toLowerCase() === enc.bed?.toLowerCase()
      );
      if (bed) this.updateBedStatus(bed.id, 'AVAILABLE');
    }

    syncEventBus.broadcast({
      topic: 'PATIENT_DISCHARGED',
      facilityId: enc.facilityId,
      emitterApp: 'MEDCORE_CLINIC',
      payload: {
        encounterId: enc.id,
        patientId: enc.patientId,
        patientName: enc.patientName,
        disposition: params.disposition,
        dischargedBy: params.dischargedBy,
      },
    });

    this.saveToDisk();
    return enc;
  }


  // ─── Phase 3: Statewide MPI / State Health ID ───────────────────────────────

  /** Lookup by State Health ID (cross-facility longitudinal key) */
  public findByStateHealthId(stateHealthId: string, decryptPII = false) {
    const id = (stateHealthId || '').trim().toUpperCase();
    if (!id) return [];
    return this.getPatients(decryptPII).filter(
      (p: any) => (p.stateHealthId || '').toUpperCase() === id
    );
  }

  /** Lookup by NIN (11 digits) */
  public findByNin(nin: string, decryptPII = false) {
    const n = (nin || '').replace(/\D/g, '');
    if (n.length < 8) return [];
    return Array.from(this.patients.values())
      .filter((p) => (p.nin || '').replace(/\D/g, '') === n || decryptField(p.encryptedNationalId).replace(/\D/g, '') === n)
      .map((p) => (decryptPII ? this.getPatientById(p.id, true) : p));
  }

  /** Search MPI across facilities */
  public searchMpi(q: string, facilityId?: string, decryptPII = false) {
    const term = (q || '').trim().toLowerCase();
    if (!term) return [];
    let list = this.getPatients(decryptPII) as any[];
    if (facilityId) list = list.filter((p) => p.facilityId === facilityId);
    return list.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.mrn || '').toLowerCase().includes(term) ||
        (p.stateHealthId || '').toLowerCase().includes(term) ||
        (p.id || '').toLowerCase().includes(term) ||
        (p.nin || '').includes(term)
    );
  }

  /**
   * Longitudinal shared health record view for a State Health ID
   * (all facility registrations + encounters + orders linked to matching patients)
   */
  public getLongitudinalRecord(stateHealthId: string) {
    const matches = this.findByStateHealthId(stateHealthId, true) as any[];
    if (!matches.length) return null;
    const patientIds = new Set(matches.map((m) => m.id));
    const encounters = this.getEncounters().filter((e) => patientIds.has(e.patientId));
    const orders = Array.from(this.clinicalOrders?.values?.() || this.getAllClinicalOrders?.() || []);
    // clinicalOrders may be private Map
    return {
      stateHealthId: stateHealthId.toUpperCase(),
      identities: matches.map((m) => ({
        patientId: m.id,
        mrn: m.mrn,
        facilityId: m.facilityId,
        name: m.name,
        nin: m.nin,
        registeredAt: m.createdAt,
      })),
      encounters,
      profile: matches[0],
      generatedAt: new Date().toISOString(),
      profileMeta: {
        resourceType: 'SharedHealthRecord',
        standard: 'NDHA-FHIR-R4',
        jurisdiction: 'NG-AK',
      },
    };
  }

  public getStatewideCensus() {
    const patients = Array.from(this.patients.values());
    const byFacility: Record<string, number> = {};
    for (const p of patients) {
      byFacility[p.facilityId] = (byFacility[p.facilityId] || 0) + 1;
    }
    const openEncounters = this.getEncounters().filter((e) => e.status === 'IN_PROGRESS' || e.status === 'ARRIVED' || (e as any).status === 'ACTIVE');
    return {
      totalPatients: patients.length,
      totalEncounters: this.encounters.size,
      activeEncounters: openEncounters.length,
      byFacility,
      generatedAt: new Date().toISOString(),
    };
  }


  public getEncounters(patientId?: string): EncounterRecord[] {
    const all = Array.from(this.encounters.values());
    if (patientId) return all.filter((e) => e.patientId === patientId);
    return all;
  }

  // ─── Pharmacy Stock Ledger & EML Formulary ──────────────────────────────────
  private seedPharmacyStock(): void {
    const items: PharmacyStockItem[] = [
      {
        id: 'STOCK-001',
        itemCode: 'MED-CEF-2G',
        genericName: 'Ceftriaxone Powder for Injection',
        brandName: 'Rocephin',
        form: 'INJECTION',
        strength: '2g',
        emlTier: 'SECONDARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-CFX-2026A',
        expiryDate: '2027-08-31',
        quantityOnHand: 340,
        allocatedQuantity: 15,
        reorderLevel: 100,
        unitCostNgn: 1400,
        unitPriceNgn: 1850,
        locationRack: 'Bay A-04 (Antibiotics Cold)',
        supplier: 'Chi Pharmaceuticals Lagos',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-002',
        itemCode: 'MED-ACT-80',
        genericName: 'Artemether + Lumefantrine Dispersible',
        brandName: 'Coartem',
        form: 'TABLET',
        strength: '80/480mg',
        emlTier: 'PRIMARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-ACT-9912',
        expiryDate: '2026-12-15',
        quantityOnHand: 890,
        allocatedQuantity: 30,
        reorderLevel: 250,
        unitCostNgn: 850,
        unitPriceNgn: 1200,
        locationRack: 'Bay M-01 (Antimalarials)',
        supplier: 'Novartis Nigeria',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-003',
        itemCode: 'MED-ART-60',
        genericName: 'Artesunate Powder for Injection',
        brandName: 'Artesun',
        form: 'INJECTION',
        strength: '60mg',
        emlTier: 'SECONDARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-ART-4421',
        expiryDate: '2027-11-20',
        quantityOnHand: 450,
        allocatedQuantity: 12,
        reorderLevel: 120,
        unitCostNgn: 1800,
        unitPriceNgn: 2400,
        locationRack: 'Bay M-02 (Severe Malaria)',
        supplier: 'Fosun Pharma / Guilin',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-004',
        itemCode: 'MED-MGSO4-50',
        genericName: 'Magnesium Sulfate Injection 50%',
        brandName: 'Mag-Sulf',
        form: 'INJECTION',
        strength: '50% (5g/10mL)',
        emlTier: 'SECONDARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-MGS-1092',
        expiryDate: '2027-04-30',
        quantityOnHand: 200,
        allocatedQuantity: 8,
        reorderLevel: 50,
        unitCostNgn: 650,
        unitPriceNgn: 950,
        locationRack: 'Labour & Delivery Crash Cart / Bay O-01',
        supplier: 'Juhel Healthcare Awka',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-005',
        itemCode: 'MED-HYD-20',
        genericName: 'Hydralazine Hydrochloride Injection',
        brandName: 'Apresoline',
        form: 'INJECTION',
        strength: '20mg/mL',
        emlTier: 'SECONDARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-HYD-3381',
        expiryDate: '2026-10-15',
        quantityOnHand: 110,
        allocatedQuantity: 4,
        reorderLevel: 40,
        unitCostNgn: 1150,
        unitPriceNgn: 1600,
        locationRack: 'Bay C-03 (Hypertensive Emergencies)',
        supplier: 'Emzor Pharmaceuticals Lagos',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-006',
        itemCode: 'MED-TRAM-100',
        genericName: 'Tramadol Hydrochloride Injection',
        brandName: 'Tramal',
        form: 'INJECTION',
        strength: '50mg/mL',
        emlTier: 'SECONDARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-TRM-8802',
        expiryDate: '2027-09-30',
        quantityOnHand: 160,
        allocatedQuantity: 6,
        reorderLevel: 50,
        unitCostNgn: 800,
        unitPriceNgn: 1100,
        locationRack: 'Controlled Substance Safe (DDA Safe #2)',
        supplier: 'Fidson Healthcare Lagos',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-007',
        itemCode: 'MED-PAR-1G',
        genericName: 'Paracetamol IV Infusion 10mg/mL',
        brandName: 'Perfalgan',
        form: 'INFUSION',
        strength: '1000mg/100mL',
        emlTier: 'PRIMARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-PAR-2201',
        expiryDate: '2026-10-01',
        quantityOnHand: 18,
        allocatedQuantity: 4,
        reorderLevel: 60,
        unitCostNgn: 700,
        unitPriceNgn: 950,
        locationRack: 'Bay A-01 (Analgesics)',
        supplier: 'May & Baker Nigeria',
        status: 'LOW_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'STOCK-008',
        itemCode: 'MED-OXY-10',
        genericName: 'Oxytocin Injection 10 IU/mL',
        brandName: 'Pitocin',
        form: 'INJECTION',
        strength: '10 IU/mL',
        emlTier: 'PRIMARY',
        isOnStateFormulary: true,
        batchNumber: 'BATCH-OXY-9011',
        expiryDate: '2027-05-15',
        quantityOnHand: 145,
        allocatedQuantity: 8,
        reorderLevel: 40,
        unitCostNgn: 550,
        unitPriceNgn: 800,
        locationRack: 'Cold Chain Refrigerator 2-8°C #1',
        supplier: 'Swiss Pharma Nigeria',
        status: 'IN_STOCK',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    for (const item of items) {
      this.pharmacyStock.set(item.itemCode, item);
    }
  }

  public getAllStockItems(filter?: { category?: string; lowStockOnly?: boolean }): PharmacyStockItem[] {
    let items = Array.from(this.pharmacyStock.values());
    if (filter?.lowStockOnly) {
      items = items.filter((i) => i.quantityOnHand <= i.reorderLevel);
    }
    return items;
  }

  public getStockItem(code: string): PharmacyStockItem | undefined {
    return this.pharmacyStock.get(code);
  }

  public depleteStock(params: {
    itemCode: string;
    quantity: number;
    referenceId: string;
    actorId?: string;
    actorName?: string;
  }): PharmacyStockItem {
    const item = this.pharmacyStock.get(params.itemCode);
    if (!item) throw new Error(`Stock item ${params.itemCode} not found`);

    if (item.quantityOnHand < params.quantity) {
      throw new Error(`Insufficient stock for ${item.genericName}: requested ${params.quantity}, available ${item.quantityOnHand}`);
    }

    item.quantityOnHand -= params.quantity;
    if (item.quantityOnHand <= 0) {
      item.status = 'STOCKOUT';
    } else if (item.quantityOnHand <= item.reorderLevel) {
      item.status = 'LOW_STOCK';
    }
    item.updatedAt = new Date().toISOString();

    const tx: StockTransaction = {
      id: `TX-STOCK-${Date.now().toString(36).toUpperCase()}`,
      itemCode: item.itemCode,
      genericName: item.genericName,
      type: 'DISPENSE',
      quantity: params.quantity,
      balanceAfter: item.quantityOnHand,
      referenceId: params.referenceId,
      actorId: params.actorId || 'PHARM-CLI',
      actorName: params.actorName || 'Clinical Pharmacist',
      timestamp: new Date().toISOString(),
    };
    this.stockTransactions.push(tx);

    // Auto emit DRUG_STOCKOUT if stock level reaches critical reorder threshold
    if (item.quantityOnHand <= item.reorderLevel) {
      syncEventBus.broadcast({
        topic: 'DRUG_STOCKOUT',
        facilityId: 'FAC-001',
        emitterApp: 'MEDCORE_OS_PHARMACY',
        payload: {
          itemCode: item.itemCode,
          genericName: item.genericName,
          remainingQuantity: item.quantityOnHand,
          reorderLevel: item.reorderLevel,
          status: item.status,
          urgency: item.quantityOnHand === 0 ? 'CRITICAL_DEPLETED' : 'WARNING_LOW',
        },
      });
    }

    this.saveToDisk();
    return item;
  }

  public restockItem(params: {
    itemCode: string;
    quantity: number;
    batchNumber: string;
    expiryDate: string;
    actorName: string;
  }): PharmacyStockItem {
    let item = this.pharmacyStock.get(params.itemCode);
    if (!item) throw new Error(`Stock item ${params.itemCode} not found in formulary`);

    item.quantityOnHand += params.quantity;
    item.batchNumber = params.batchNumber;
    item.expiryDate = params.expiryDate;
    item.status = item.quantityOnHand <= item.reorderLevel ? 'LOW_STOCK' : 'IN_STOCK';
    item.updatedAt = new Date().toISOString();

    const tx: StockTransaction = {
      id: `TX-STOCK-${Date.now().toString(36).toUpperCase()}`,
      itemCode: item.itemCode,
      genericName: item.genericName,
      type: 'RECEIVE',
      quantity: params.quantity,
      balanceAfter: item.quantityOnHand,
      referenceId: `GRN-${Date.now().toString(36).toUpperCase()}`,
      actorId: 'SUPPLY-CHAIN',
      actorName: params.actorName,
      timestamp: new Date().toISOString(),
    };
    this.stockTransactions.push(tx);

    this.saveToDisk();
    return item;
  }

  public getStockTransactions(itemCode?: string): StockTransaction[] {
    if (itemCode) return this.stockTransactions.filter((tx) => tx.itemCode === itemCode);
    return this.stockTransactions.slice().reverse();
  }

  // ─── HMO / AKSHIA Claims Adjudication ───────────────────────────────────────
  public createHmoClaim(claim: Omit<HmoClaim, 'id' | 'createdAt' | 'status'>): HmoClaim {
    const id = `CLM-AKSHIA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const fullClaim: HmoClaim = {
      ...claim,
      id,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    };
    this.hmoClaims.set(id, fullClaim);

    syncEventBus.broadcast({
      topic: 'BILL_GENERATED',
      facilityId: fullClaim.facilityId,
      emitterApp: 'MEDCORE_OS',
      payload: {
        claimId: id,
        patientId: fullClaim.patientId,
        scheme: fullClaim.scheme,
        totalHmoPayableNgn: fullClaim.totalHmoPayableNgn,
        copayNgn: fullClaim.totalCopayNgn,
      },
    });

    this.saveToDisk();
    return fullClaim;
  }

  public getHmoClaims(patientId?: string): HmoClaim[] {
    const all = Array.from(this.hmoClaims.values());
    if (patientId) return all.filter((c) => c.patientId === patientId);
    return all.slice().reverse();
  }

  public getHmoClaimById(id: string): HmoClaim | undefined {
    return this.hmoClaims.get(id);
  }

  // ─── Persistence Snapshot (Disk Sync) ───────────────────────────────────────
  public saveToDisk(): void {
    try {
      const snapshotData = {
        patients: Array.from(this.patients.entries()),
        beds: Array.from(this.beds.entries()),
        encounters: Array.from(this.encounters.entries()),
        orders: Array.from(this.orders.entries()),
        prescriptions: Array.from(this.prescriptions.entries()),
        facilities: Array.from(this.facilities.entries()),
        pharmacyStock: Array.from(this.pharmacyStock.entries()),
        stockTransactions: this.stockTransactions,
        hmoClaims: Array.from(this.hmoClaims.entries()),
      };
      persistenceService.saveSnapshot(snapshotData);
    } catch (err) {
      console.warn('[DataStore] Error saving snapshot to disk:', err);
    }
  }

  public loadFromDisk(): boolean {
    try {
      const snapshot = persistenceService.loadSnapshot<any>();
      if (!snapshot || !snapshot.data) return false;

      const d = snapshot.data;
      if (d.patients) this.patients = new Map(d.patients);
      if (d.beds) this.beds = new Map(d.beds);
      if (d.encounters) this.encounters = new Map(d.encounters);
      if (d.orders) this.orders = new Map(d.orders);
      if (d.prescriptions) this.prescriptions = new Map(d.prescriptions);
      if (d.facilities) this.facilities = new Map(d.facilities);
      if (d.pharmacyStock) this.pharmacyStock = new Map(d.pharmacyStock);
      if (d.stockTransactions) this.stockTransactions = d.stockTransactions;
      if (d.hmoClaims) this.hmoClaims = new Map(d.hmoClaims);

      return true;
    } catch (err) {
      console.warn('[DataStore] Failed to hydrate snapshot:', err);
      return false;
    }
  }
}

export const dataStore = new CentralDataStore();

