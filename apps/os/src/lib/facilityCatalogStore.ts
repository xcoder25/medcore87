/**
 * Comprehensive hospital facility catalog — what an EMR needs to know about a facility.
 * One facility per admin; drives bed board, theatre, lab, pharmacy, maternity, etc.
 */
import { createBeds, listBeds, listWards } from './bedBoardStore';
import { emitLiveAction } from './liveActions';
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { firestoreSubscribeFacility, firestoreReadFacility } from './firebase';

export const FACILITY_CATALOG_KEY = 'medcore_facility_catalog_v1';
export const FACILITY_CATALOG_EVT = 'medcore-facility-catalog';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClinicalServiceKey =
  | 'general_medicine'
  | 'surgery'
  | 'paediatrics'
  | 'obstetrics_gynaecology'
  | 'emergency'
  | 'icu_critical_care'
  | 'orthopaedics'
  | 'ophthalmology'
  | 'ent'
  | 'dental'
  | 'psychiatry'
  | 'physiotherapy'
  | 'dialysis'
  | 'oncology'
  | 'cardiology'
  | 'infectious_disease'
  | 'family_medicine'
  | 'anc_pnc'
  | 'immunization'
  | 'hiv_art'
  | 'tb_dots'
  | 'nutrition';

export type LabCapabilityKey =
  | 'haematology'
  | 'chemistry'
  | 'microbiology'
  | 'serology_immunology'
  | 'blood_bank_crossmatch'
  | 'urine_analysis'
  | 'parasitology'
  | 'histopathology'
  | 'point_of_care';

export type RadiologyModalityKey =
  | 'xray'
  | 'ultrasound'
  | 'ct'
  | 'mri'
  | 'mammography'
  | 'fluoroscopy'
  | 'ecg'
  | 'echo';

export type PharmacyCapabilityKey =
  | 'outpatient_dispensary'
  | 'inpatient_pharmacy'
  | 'emergency_pharmacy'
  | 'controlled_substances'
  | 'iv_admixture'
  | 'cold_chain';

export interface TheatreUnit {
  id: string;
  name: string;
  type: 'main' | 'emergency' | 'obstetric' | 'day_case' | 'minor';
  hasLaminarFlow: boolean;
  active: boolean;
}

export interface ClinicUnit {
  id: string;
  name: string;
  specialty: string;
  days: string;
  slotsPerDay: number;
}

export interface WardCapacityRow {
  id: string;
  ward: string;
  prefix: string;
  count: number;
  category: 'general' | 'maternity' | 'paediatric' | 'icu' | 'hdu' | 'isolation' | 'emergency' | 'surgical' | 'other';
}

export interface FacilityCatalog {
  facilityId: string;
  updatedAt: string;
  updatedBy?: string;

  /** Identity (mirrors profile) */
  name: string;
  type: string;
  tier: string;
  lga: string;
  address: string;
  phone: string;
  email: string;
  licenseNo: string;
  licenseExpiry: string;
  medicalDirector: string;
  registrationNo?: string;
  ownership: 'public_state' | 'public_federal' | 'mission' | 'private' | 'ppp';

  /** Operating model */
  operates24x7: boolean;
  emergency24x7: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  defaultOpdFeeNgn: number;
  acceptsNhis: boolean;
  acceptsHmo: boolean;
  acceptedHmoList: string;

  /** Bed / ward plan (source of truth for creation) */
  targetTotalBeds: number;
  wards: WardCapacityRow[];
  icuBeds: number;
  hduBeds: number;
  nicuCots: number;
  isolationBeds: number;
  emergencyBays: number;
  deliverySuites: number;
  theatreCount: number;
  theatres: TheatreUnit[];
  ambulanceCount: number;

  /** Clinical service lines offered */
  services: Partial<Record<ClinicalServiceKey, boolean>>;

  /** Diagnostics */
  labCapabilities: Partial<Record<LabCapabilityKey, boolean>>;
  radiologyModalities: Partial<Record<RadiologyModalityKey, boolean>>;
  labTurnsAroundHours: number;

  /** Pharmacy & blood */
  pharmacyCapabilities: Partial<Record<PharmacyCapabilityKey, boolean>>;
  hasBloodBank: boolean;
  bloodBankGroups: string;

  /** OPD clinics */
  clinics: ClinicUnit[];

  /** Notes / free text for AI or inspectors */
  notes: string;
  setupComplete: boolean;
}

export const CLINICAL_SERVICE_LABELS: Record<ClinicalServiceKey, string> = {
  general_medicine: 'General / Internal Medicine',
  surgery: 'General Surgery',
  paediatrics: 'Paediatrics',
  obstetrics_gynaecology: 'Obstetrics & Gynaecology',
  emergency: 'Emergency / A&E',
  icu_critical_care: 'ICU / Critical Care',
  orthopaedics: 'Orthopaedics',
  ophthalmology: 'Ophthalmology',
  ent: 'ENT',
  dental: 'Dental',
  psychiatry: 'Psychiatry / Mental Health',
  physiotherapy: 'Physiotherapy / Rehab',
  dialysis: 'Dialysis',
  oncology: 'Oncology',
  cardiology: 'Cardiology',
  infectious_disease: 'Infectious Disease',
  family_medicine: 'Family Medicine / GOPD',
  anc_pnc: 'ANC / PNC',
  immunization: 'Immunization',
  hiv_art: 'HIV / ART Clinic',
  tb_dots: 'TB / DOTS',
  nutrition: 'Nutrition / Therapeutic Feeding',
};

export const LAB_LABELS: Record<LabCapabilityKey, string> = {
  haematology: 'Haematology',
  chemistry: 'Clinical Chemistry',
  microbiology: 'Microbiology',
  serology_immunology: 'Serology / Immunology',
  blood_bank_crossmatch: 'Blood bank / Crossmatch',
  urine_analysis: 'Urinalysis',
  parasitology: 'Parasitology',
  histopathology: 'Histopathology',
  point_of_care: 'Point-of-care testing',
};

export const RADIOLOGY_LABELS: Record<RadiologyModalityKey, string> = {
  xray: 'X-Ray',
  ultrasound: 'Ultrasound',
  ct: 'CT',
  mri: 'MRI',
  mammography: 'Mammography',
  fluoroscopy: 'Fluoroscopy',
  ecg: 'ECG',
  echo: 'Echocardiography',
};

export const PHARMACY_LABELS: Record<PharmacyCapabilityKey, string> = {
  outpatient_dispensary: 'Outpatient dispensary',
  inpatient_pharmacy: 'Inpatient pharmacy',
  emergency_pharmacy: 'Emergency pharmacy',
  controlled_substances: 'Controlled substances vault',
  iv_admixture: 'IV admixture / sterile compounding',
  cold_chain: 'Cold-chain vaccines / biologics',
};

function storageKey(facilityId: string) {
  return `${FACILITY_CATALOG_KEY}:${facilityId || 'DEFAULT'}`;
}

export function defaultCatalog(facilityId: string, name?: string): FacilityCatalog {
  return {
    facilityId,
    updatedAt: new Date().toISOString(),
    name: name || '',
    type: 'General Hospital',
    tier: 'Secondary Care',
    lga: '',
    address: '',
    phone: '',
    email: '',
    licenseNo: '',
    licenseExpiry: '',
    medicalDirector: '',
    ownership: 'public_state',
    operates24x7: true,
    emergency24x7: true,
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    defaultOpdFeeNgn: 5000,
    acceptsNhis: true,
    acceptsHmo: true,
    acceptedHmoList: '',
    targetTotalBeds: 0,
    wards: [],
    icuBeds: 0,
    hduBeds: 0,
    nicuCots: 0,
    isolationBeds: 0,
    emergencyBays: 0,
    deliverySuites: 0,
    theatreCount: 0,
    theatres: [],
    ambulanceCount: 0,
    services: {
      general_medicine: true,
      surgery: true,
      paediatrics: true,
      obstetrics_gynaecology: true,
      emergency: true,
      family_medicine: true,
      anc_pnc: true,
      immunization: true,
    },
    labCapabilities: {
      haematology: true,
      chemistry: true,
      urine_analysis: true,
      parasitology: true,
      point_of_care: true,
    },
    radiologyModalities: {
      xray: true,
      ultrasound: true,
      ecg: true,
    },
    labTurnsAroundHours: 24,
    pharmacyCapabilities: {
      outpatient_dispensary: true,
      inpatient_pharmacy: true,
      emergency_pharmacy: true,
      cold_chain: true,
    },
    hasBloodBank: false,
    bloodBankGroups: 'A+, A-, B+, B-, AB+, AB-, O+, O-',
    clinics: [
      { id: 'cl-gopd', name: 'GOPD', specialty: 'Family Medicine', days: 'Mon–Fri', slotsPerDay: 40 },
      { id: 'cl-anc', name: 'ANC Clinic', specialty: 'Obstetrics', days: 'Mon / Wed / Fri', slotsPerDay: 30 },
    ],
    notes: '',
    setupComplete: false,
  };
}

export function loadFacilityCatalog(facilityId: string, name?: string): FacilityCatalog {
  const blank = defaultCatalog(facilityId, name);
  if (typeof window === 'undefined') return blank;
  try {
    const raw = localStorage.getItem(storageKey(facilityId));
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as FacilityCatalog;
    return {
      ...blank,
      ...parsed,
      facilityId,
      services: { ...blank.services, ...(parsed.services || {}) },
      labCapabilities: { ...blank.labCapabilities, ...(parsed.labCapabilities || {}) },
      radiologyModalities: { ...blank.radiologyModalities, ...(parsed.radiologyModalities || {}) },
      pharmacyCapabilities: { ...blank.pharmacyCapabilities, ...(parsed.pharmacyCapabilities || {}) },
      wards: Array.isArray(parsed.wards) ? parsed.wards : [],
      theatres: Array.isArray(parsed.theatres) ? parsed.theatres : [],
      clinics: Array.isArray(parsed.clinics) ? parsed.clinics : blank.clinics,
    };
  } catch {
    return blank;
  }
}

export function saveFacilityCatalog(catalog: FacilityCatalog, actor?: string): FacilityCatalog {
  const next: FacilityCatalog = {
    ...catalog,
    updatedAt: new Date().toISOString(),
    updatedBy: actor || catalog.updatedBy,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey(next.facilityId), JSON.stringify(next));
    // legacy profile mirror for older readers
    try {
      localStorage.setItem(
        `medcore_hospital_profile_${next.facilityId}`,
        JSON.stringify({
          id: next.facilityId,
          name: next.name,
          type: next.type,
          lga: next.lga,
          address: next.address,
          beds: next.targetTotalBeds || listBeds(next.facilityId).length,
          phone: next.phone,
          email: next.email,
          licenseNo: next.licenseNo,
          licenseExpiry: next.licenseExpiry,
          status: 'active',
          tier: next.tier,
          medicalDirector: next.medicalDirector,
        })
      );
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(FACILITY_CATALOG_EVT, { detail: next }));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: FACILITY_CATALOG_KEY } }));
    // Realtime: other tabs (BroadcastChannel) + durable outbox → LAN/Firestore
    try {
      publishFacilityData(next.facilityId, FACILITY_KEYS.facilityCatalog, next);
    } catch {
      /* offline ok — local already saved */
    }
  }
  return next;
}

/**
 * Subscribe to live facility catalog updates (Firestore + storage + custom events).
 * Returns unsubscribe function.
 */
export function subscribeFacilityCatalog(
  facilityId: string,
  onUpdate: (catalog: FacilityCatalog) => void
): () => void {
  if (typeof window === 'undefined' || !facilityId) return () => {};

  const handleLocal = (raw: unknown) => {
    try {
      if (!raw || typeof raw !== 'object') return;
      const c = raw as FacilityCatalog;
      if (c.facilityId && c.facilityId !== facilityId) return;
      onUpdate(loadFacilityCatalog(facilityId, c.name));
    } catch {
      /* ignore */
    }
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey(facilityId) && e.newValue) {
      try {
        handleLocal(JSON.parse(e.newValue));
      } catch {
        /* ignore */
      }
    }
  };

  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.facilityId === facilityId || detail?.key === FACILITY_CATALOG_KEY) {
      onUpdate(loadFacilityCatalog(facilityId));
    }
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(FACILITY_CATALOG_EVT, onCustom as EventListener);
  window.addEventListener('medcore-admin-sync', onCustom as EventListener);

  // Live Firestore listener
  const unsubFs = firestoreSubscribeFacility(facilityId, (data) => {
    const remote = data?.[FACILITY_KEYS.facilityCatalog] ?? data?.facilityCatalog;
    if (remote && typeof remote === 'object') {
      try {
        const merged = { ...loadFacilityCatalog(facilityId), ...(remote as FacilityCatalog), facilityId };
        localStorage.setItem(storageKey(facilityId), JSON.stringify(merged));
        onUpdate(merged);
      } catch {
        /* ignore */
      }
    }
  });

  // One-shot pull in case listener is slow
  void firestoreReadFacility(facilityId).then((data) => {
    if (!data) return;
    const remote = data[FACILITY_KEYS.facilityCatalog] ?? data.facilityCatalog;
    if (remote && typeof remote === 'object') {
      const merged = { ...loadFacilityCatalog(facilityId), ...(remote as FacilityCatalog), facilityId };
      try {
        localStorage.setItem(storageKey(facilityId), JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      onUpdate(merged);
    }
  });

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(FACILITY_CATALOG_EVT, onCustom as EventListener);
    window.removeEventListener('medcore-admin-sync', onCustom as EventListener);
    unsubFs();
  };
}

export function catalogCompleteness(c: FacilityCatalog): { score: number; missing: string[] } {
  const missing: string[] = [];
  if (!c.name?.trim()) missing.push('Hospital name');
  if (!c.lga?.trim()) missing.push('LGA');
  if (!c.licenseNo?.trim()) missing.push('License number');
  if (!c.medicalDirector?.trim()) missing.push('Medical Director');
  if (!(c.targetTotalBeds > 0) && listBeds(c.facilityId).length === 0) missing.push('Bed capacity / wards');
  if (!Object.values(c.services || {}).some(Boolean)) missing.push('Clinical services');
  if (!Object.values(c.labCapabilities || {}).some(Boolean)) missing.push('Laboratory capabilities');
  if (!Object.values(c.pharmacyCapabilities || {}).some(Boolean)) missing.push('Pharmacy capabilities');
  if (c.emergency24x7 === undefined) missing.push('Emergency hours');
  const score = Math.max(0, Math.round(((8 - missing.length) / 8) * 100));
  return { score, missing };
}

/** Apply ward plan from catalog into the live bed board */
export function applyCatalogWardsToBedBoard(
  catalog: FacilityCatalog,
  actor?: string
): { created: number; total: number; wards: number } {
  let created = 0;
  for (const row of catalog.wards || []) {
    if (!row.ward?.trim() || !row.prefix?.trim() || !(row.count > 0)) continue;
    const beds = createBeds({
      facilityId: catalog.facilityId,
      ward: row.ward.trim(),
      prefix: row.prefix.trim().toUpperCase(),
      count: Math.max(1, Math.min(200, Number(row.count) || 1)),
      actor: actor || 'Hospital Administrator',
    });
    created += beds.length;
  }
  // Specialty capacity as dedicated wards if counts set and not already in plan
  const extras: { ward: string; prefix: string; count: number }[] = [];
  if (catalog.icuBeds > 0 && !catalog.wards.some((w) => /icu/i.test(w.ward))) {
    extras.push({ ward: 'ICU', prefix: 'ICU', count: catalog.icuBeds });
  }
  if (catalog.hduBeds > 0 && !catalog.wards.some((w) => /hdu/i.test(w.ward))) {
    extras.push({ ward: 'HDU', prefix: 'HDU', count: catalog.hduBeds });
  }
  if (catalog.nicuCots > 0 && !catalog.wards.some((w) => /nicu/i.test(w.ward))) {
    extras.push({ ward: 'NICU', prefix: 'NICU', count: catalog.nicuCots });
  }
  if (catalog.isolationBeds > 0 && !catalog.wards.some((w) => /isolat/i.test(w.ward))) {
    extras.push({ ward: 'Isolation', prefix: 'ISO', count: catalog.isolationBeds });
  }
  if (catalog.emergencyBays > 0 && !catalog.wards.some((w) => /emerg|a&e|ae/i.test(w.ward))) {
    extras.push({ ward: 'Emergency / A&E', prefix: 'AE', count: catalog.emergencyBays });
  }
  for (const ex of extras) {
    created += createBeds({
      facilityId: catalog.facilityId,
      ward: ex.ward,
      prefix: ex.prefix,
      count: ex.count,
      actor: actor || 'Hospital Administrator',
    }).length;
  }

  const total = listBeds(catalog.facilityId).length;
  const wards = listWards(catalog.facilityId).length;
  emitLiveAction(`Facility catalog applied · ${total} beds · ${wards} wards`, { module: 'facility-catalog' });
  return { created, total, wards };
}

export function newWardRow(partial?: Partial<WardCapacityRow>): WardCapacityRow {
  return {
    id: `wr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    ward: partial?.ward || '',
    prefix: partial?.prefix || '',
    count: partial?.count ?? 4,
    category: partial?.category || 'general',
  };
}

export function newTheatre(partial?: Partial<TheatreUnit>): TheatreUnit {
  return {
    id: `th-${Date.now().toString(36)}`,
    name: partial?.name || 'Theatre 1',
    type: partial?.type || 'main',
    hasLaminarFlow: partial?.hasLaminarFlow ?? false,
    active: partial?.active ?? true,
  };
}

export function newClinic(partial?: Partial<ClinicUnit>): ClinicUnit {
  return {
    id: `cl-${Date.now().toString(36)}`,
    name: partial?.name || 'Clinic',
    specialty: partial?.specialty || 'General',
    days: partial?.days || 'Mon–Fri',
    slotsPerDay: partial?.slotsPerDay ?? 20,
  };
}


// ─── AI / bulk automation ────────────────────────────────────────────────────

export type FacilityAiAction =
  | 'full_setup'
  | 'wards_only'
  | 'services_by_tier'
  | 'clinics_bulk'
  | 'theatres_bulk'
  | 'diagnostics_standard'
  | 'pharmacy_standard';

/** Enable a sensible service pack by facility tier/type (no network). */
export function applyServicePackByTier(
  catalog: FacilityCatalog,
  pack: 'cottage' | 'chc' | 'general' | 'tertiary' | 'auto' = 'auto'
): FacilityCatalog {
  const t = (pack === 'auto' ? catalog.type + ' ' + catalog.tier : pack).toLowerCase();
  const isCottage = t.includes('cottage') || t.includes('primary');
  const isChc = t.includes('comprehensive') || t.includes('chc') || t.includes('health care');
  const isTertiary = t.includes('tertiary') || t.includes('teaching') || t.includes('referral');

  const services: FacilityCatalog['services'] = { ...catalog.services };
  const enable = (keys: ClinicalServiceKey[]) => {
    for (const k of Object.keys(CLINICAL_SERVICE_LABELS) as ClinicalServiceKey[]) services[k] = false;
    for (const k of keys) services[k] = true;
  };

  if (isCottage) {
    enable([
      'general_medicine', 'family_medicine', 'paediatrics', 'obstetrics_gynaecology',
      'emergency', 'anc_pnc', 'immunization', 'nutrition',
    ]);
  } else if (isChc) {
    enable([
      'general_medicine', 'family_medicine', 'paediatrics', 'obstetrics_gynaecology',
      'emergency', 'surgery', 'anc_pnc', 'immunization', 'hiv_art', 'tb_dots', 'nutrition',
    ]);
  } else if (isTertiary) {
    enable(Object.keys(CLINICAL_SERVICE_LABELS) as ClinicalServiceKey[]);
  } else {
    enable([
      'general_medicine', 'surgery', 'paediatrics', 'obstetrics_gynaecology', 'emergency',
      'icu_critical_care', 'orthopaedics', 'family_medicine', 'anc_pnc', 'immunization',
      'hiv_art', 'tb_dots', 'physiotherapy', 'infectious_disease',
    ]);
  }
  return { ...catalog, services };
}

/** Bulk-create N theatres with sensible names/types. */
export function bulkCreateTheatres(count: number, start = 1): TheatreUnit[] {
  const n = Math.max(1, Math.min(20, count));
  const types: TheatreUnit['type'][] = ['main', 'emergency', 'obstetric', 'day_case', 'minor'];
  return Array.from({ length: n }, (_, i) =>
    newTheatre({
      name: `Theatre ${start + i}`,
      type: types[i % types.length],
      hasLaminarFlow: i === 0,
      active: true,
    })
  );
}

/** Bulk-create standard OPD clinics for Nigerian secondary hospitals. */
export function bulkCreateStandardClinics(facilityType?: string): ClinicUnit[] {
  const t = (facilityType || '').toLowerCase();
  const base = [
    newClinic({ name: 'GOPD', specialty: 'Family Medicine', days: 'Mon–Fri', slotsPerDay: 40 }),
    newClinic({ name: 'ANC Clinic', specialty: 'Obstetrics', days: 'Mon / Wed / Fri', slotsPerDay: 30 }),
    newClinic({ name: 'Child Welfare / Immunization', specialty: 'Paediatrics', days: 'Tue / Thu', slotsPerDay: 35 }),
    newClinic({ name: 'HIV / ART Clinic', specialty: 'Infectious Disease', days: 'Wed', slotsPerDay: 25 }),
    newClinic({ name: 'TB / DOTS', specialty: 'Pulmonary', days: 'Mon–Fri', slotsPerDay: 15 }),
  ];
  if (t.includes('general') || t.includes('tertiary') || t.includes('specialist')) {
    base.push(
      newClinic({ name: 'Surgical Outpatient', specialty: 'Surgery', days: 'Tue / Thu', slotsPerDay: 20 }),
      newClinic({ name: 'Medical Outpatient', specialty: 'Internal Medicine', days: 'Mon / Wed', slotsPerDay: 25 }),
      newClinic({ name: 'Eye Clinic', specialty: 'Ophthalmology', days: 'Fri', slotsPerDay: 15 }),
    );
  }
  return base;
}

export function applyDiagnosticsStandard(catalog: FacilityCatalog, level: 'basic' | 'standard' | 'advanced' = 'standard'): FacilityCatalog {
  const lab: FacilityCatalog['labCapabilities'] = { ...catalog.labCapabilities };
  const rad: FacilityCatalog['radiologyModalities'] = { ...catalog.radiologyModalities };
  const allLab = Object.keys(LAB_LABELS) as LabCapabilityKey[];
  const allRad = Object.keys(RADIOLOGY_LABELS) as RadiologyModalityKey[];
  for (const k of allLab) lab[k] = false;
  for (const k of allRad) rad[k] = false;

  if (level === 'basic') {
    for (const k of ['haematology', 'chemistry', 'urine_analysis', 'parasitology', 'point_of_care'] as LabCapabilityKey[]) lab[k] = true;
    for (const k of ['xray', 'ultrasound', 'ecg'] as RadiologyModalityKey[]) rad[k] = true;
  } else if (level === 'advanced') {
    for (const k of allLab) lab[k] = true;
    for (const k of allRad) rad[k] = true;
  } else {
    for (const k of ['haematology', 'chemistry', 'microbiology', 'serology_immunology', 'urine_analysis', 'parasitology', 'blood_bank_crossmatch', 'point_of_care'] as LabCapabilityKey[]) lab[k] = true;
    for (const k of ['xray', 'ultrasound', 'ecg', 'echo'] as RadiologyModalityKey[]) rad[k] = true;
  }
  return { ...catalog, labCapabilities: lab, radiologyModalities: rad };
}

export function applyPharmacyStandard(catalog: FacilityCatalog, level: 'basic' | 'standard' | 'full' = 'standard'): FacilityCatalog {
  const ph: FacilityCatalog['pharmacyCapabilities'] = { ...catalog.pharmacyCapabilities };
  const all = Object.keys(PHARMACY_LABELS) as PharmacyCapabilityKey[];
  for (const k of all) ph[k] = false;
  if (level === 'basic') {
    ph.outpatient_dispensary = true;
    ph.cold_chain = true;
  } else if (level === 'full') {
    for (const k of all) ph[k] = true;
  } else {
    ph.outpatient_dispensary = true;
    ph.inpatient_pharmacy = true;
    ph.emergency_pharmacy = true;
    ph.cold_chain = true;
    ph.controlled_substances = true;
  }
  return {
    ...catalog,
    pharmacyCapabilities: ph,
    hasBloodBank: level !== 'basic',
  };
}

/**
 * Parse a free-text or structured AI JSON response into catalog patches.
 * Safe to call with Gemini output or offline templates.
 */
export function mergeAiFacilityPatch(
  catalog: FacilityCatalog,
  patch: Partial<FacilityCatalog> & {
    wards?: Partial<WardCapacityRow>[];
    theatres?: Partial<TheatreUnit>[];
    clinics?: Partial<ClinicUnit>[];
  }
): FacilityCatalog {
  const next: FacilityCatalog = { ...catalog, ...patch, facilityId: catalog.facilityId };
  if (Array.isArray(patch.wards)) {
    next.wards = patch.wards.map((w) =>
      newWardRow({
        ward: w.ward,
        prefix: w.prefix,
        count: w.count,
        category: w.category,
      })
    );
  }
  if (Array.isArray(patch.theatres)) {
    next.theatres = patch.theatres.map((t) =>
      newTheatre({ name: t.name, type: t.type, hasLaminarFlow: t.hasLaminarFlow, active: t.active })
    );
    next.theatreCount = Math.max(next.theatreCount, next.theatres.length);
  }
  if (Array.isArray(patch.clinics)) {
    next.clinics = patch.clinics.map((c) =>
      newClinic({ name: c.name, specialty: c.specialty, days: c.days, slotsPerDay: c.slotsPerDay })
    );
  }
  if (patch.services) next.services = { ...catalog.services, ...patch.services };
  if (patch.labCapabilities) next.labCapabilities = { ...catalog.labCapabilities, ...patch.labCapabilities };
  if (patch.radiologyModalities) next.radiologyModalities = { ...catalog.radiologyModalities, ...patch.radiologyModalities };
  if (patch.pharmacyCapabilities) next.pharmacyCapabilities = { ...catalog.pharmacyCapabilities, ...patch.pharmacyCapabilities };
  return next;
}
