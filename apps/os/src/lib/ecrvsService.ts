/**
 * Electronic Civil Registration and Vital Statistics (e-CRVS) Engine.
 * Aligned with National Population Commission (NPC) and Akwa Ibom State Ministry of Health standards.
 */

export interface EcrvsBirthRecord {
  trackingId: string; // e.g. "CRVS-AKS-B-2026-0041"
  childFullName: string;
  sex: 'Male' | 'Female';
  dateOfBirth: string;
  timeOfBirth: string;
  birthWeightKg: number;
  gestationalWeeks: number;
  typeOfBirth: 'Single' | 'Twin' | 'Triplet' | 'Higher Multiple';
  deliveryMode: 'Spontaneous Vaginal (SVD)' | 'Caesarean Section (C/S)' | 'Assisted Breech';
  
  // Parents Bio-Data (NIN verified)
  motherFullName: string;
  motherNin?: string;
  motherPhone: string;
  motherAge: number;
  fatherFullName: string;
  fatherNin?: string;
  fatherPhone?: string;
  
  // Geographical & Healthcare Registration
  state: 'Akwa Ibom';
  lga: string;
  facilityId: string;
  facilityName: string;
  attendantRole: 'Medical Doctor' | 'Midwife' | 'Nurse' | 'Community Health Worker';
  attendantName: string;
  registrationStatus: 'Submitted to NPC' | 'Pending Cloud Sync' | 'Verified Certificate Issued';
  registeredAt: string;
}

export interface EcrvsDeathRecord {
  trackingId: string; // e.g. "CRVS-AKS-D-2026-0012"
  deceasedFullName: string;
  deceasedHospitalNumber: string;
  deceasedNin?: string;
  sex: 'Male' | 'Female';
  ageAtDeath: number;
  dateOfDeath: string;
  timeOfDeath: string;
  placeOfDeath: 'In-Facility Ward' | 'Emergency / A&E' | 'ICU' | 'Brought in Dead (BID)';
  
  // Medical Certification of Cause of Death (ICD-10)
  underlyingCauseOfDeath: string; // e.g. "Severe Eclampsia", "Cardiogenic Shock"
  immediateCauseOfDeath: string;
  icd10Code: string; // e.g. "O15.0", "I21.9"
  certifyingPhysicianName: string;
  certifyingPhysicianMdcn: string;
  
  // Demographics & Next of Kin
  state: 'Akwa Ibom';
  lga: string;
  facilityId: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  registrationStatus: 'Submitted to NPC' | 'Pending Cloud Sync' | 'Verified Certificate Issued';
  registeredAt: string;
}

const BIRTH_STORAGE_KEY = 'medcore_ecrvs_births_v1';
const DEATH_STORAGE_KEY = 'medcore_ecrvs_deaths_v1';
const EVENT_NAME = 'medcore-ecrvs-sync';

const INITIAL_BIRTHS: EcrvsBirthRecord[] = [
  {
    trackingId: 'CRVS-AKS-B-2026-0041',
    childFullName: 'Emediong Emem Okon',
    sex: 'Female',
    dateOfBirth: '2026-10-24',
    timeOfBirth: '03:45',
    birthWeightKg: 3.4,
    gestationalWeeks: 39,
    typeOfBirth: 'Single',
    deliveryMode: 'Spontaneous Vaginal (SVD)',
    motherFullName: 'Emem Anietie Okon',
    motherNin: '66201948210',
    motherPhone: '08129384019',
    motherAge: 27,
    fatherFullName: 'Anietie Asuquo Okon',
    fatherNin: '44102948210',
    fatherPhone: '08039201940',
    state: 'Akwa Ibom',
    lga: 'Eket',
    facilityId: 'IGH-EKT',
    facilityName: 'Immanuel General Hospital, Eket',
    attendantRole: 'Midwife',
    attendantName: 'Senior Midwife Nsikak Effiong',
    registrationStatus: 'Submitted to NPC',
    registeredAt: '2026-10-24T05:12:00Z',
  },
  {
    trackingId: 'CRVS-AKS-B-2026-0042',
    childFullName: 'Ubongabasi Michael Bassey',
    sex: 'Male',
    dateOfBirth: '2026-10-27',
    timeOfBirth: '14:20',
    birthWeightKg: 3.1,
    gestationalWeeks: 38,
    typeOfBirth: 'Single',
    deliveryMode: 'Caesarean Section (C/S)',
    motherFullName: 'Grace Michael Bassey',
    motherNin: '88102948190',
    motherPhone: '07039201944',
    motherAge: 31,
    fatherFullName: 'Michael Bassey',
    fatherNin: '55102948123',
    fatherPhone: '08029381920',
    state: 'Akwa Ibom',
    lga: 'Eket',
    facilityId: 'IGH-EKT',
    facilityName: 'Immanuel General Hospital, Eket',
    attendantRole: 'Medical Doctor',
    attendantName: 'Dr. Akanimo Udoh',
    registrationStatus: 'Verified Certificate Issued',
    registeredAt: '2026-10-27T16:00:00Z',
  },
];

const INITIAL_DEATHS: EcrvsDeathRecord[] = [
  {
    trackingId: 'CRVS-AKS-D-2026-0012',
    deceasedFullName: 'Elder Ekpenyong Etim Akpan',
    deceasedHospitalNumber: 'HOSP-2104',
    deceasedNin: '33102948102',
    sex: 'Male',
    ageAtDeath: 72,
    dateOfDeath: '2026-10-21',
    timeOfDeath: '21:15',
    placeOfDeath: 'ICU',
    underlyingCauseOfDeath: 'End-Stage Renal Disease with Chronic Hypertension',
    immediateCauseOfDeath: 'Cardiopulmonary Arrest',
    icd10Code: 'N18.6 / I10',
    certifyingPhysicianName: 'Dr. Idongesit Archibong',
    certifyingPhysicianMdcn: 'MDCN-AK-58291',
    state: 'Akwa Ibom',
    lga: 'Eket',
    facilityId: 'IGH-EKT',
    nextOfKinName: 'Pastor Nsikak Ekpenyong',
    nextOfKinPhone: '08039201948',
    registrationStatus: 'Submitted to NPC',
    registeredAt: '2026-10-22T08:30:00Z',
  },
];

export function listEcrvsBirths(facilityId?: string): EcrvsBirthRecord[] {
  if (typeof window === 'undefined') return INITIAL_BIRTHS;
  try {
    const raw = localStorage.getItem(BIRTH_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BIRTH_STORAGE_KEY, JSON.stringify(INITIAL_BIRTHS));
      return INITIAL_BIRTHS;
    }
    const all = JSON.parse(raw) as EcrvsBirthRecord[];
    if (facilityId) return all.filter((b) => !b.facilityId || b.facilityId.toUpperCase() === facilityId.toUpperCase());
    return all;
  } catch {
    return INITIAL_BIRTHS;
  }
}

export function listEcrvsDeaths(facilityId?: string): EcrvsDeathRecord[] {
  if (typeof window === 'undefined') return INITIAL_DEATHS;
  try {
    const raw = localStorage.getItem(DEATH_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DEATH_STORAGE_KEY, JSON.stringify(INITIAL_DEATHS));
      return INITIAL_DEATHS;
    }
    const all = JSON.parse(raw) as EcrvsDeathRecord[];
    if (facilityId) return all.filter((d) => !d.facilityId || d.facilityId.toUpperCase() === facilityId.toUpperCase());
    return all;
  } catch {
    return INITIAL_DEATHS;
  }
}

export function saveEcrvsBirth(record: EcrvsBirthRecord) {
  if (typeof window === 'undefined') return;
  const all = listEcrvsBirths();
  const next = [record, ...all.filter((r) => r.trackingId !== record.trackingId)];
  localStorage.setItem(BIRTH_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function saveEcrvsDeath(record: EcrvsDeathRecord) {
  if (typeof window === 'undefined') return;
  const all = listEcrvsDeaths();
  const next = [record, ...all.filter((r) => r.trackingId !== record.trackingId)];
  localStorage.setItem(DEATH_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeEcrvs(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Export National Population Commission (NPC) compatible JSON */
export function exportNpcVitalStatistics(facilityId: string) {
  const births = listEcrvsBirths(facilityId);
  const deaths = listEcrvsDeaths(facilityId);

  const payload = {
    NationalPopulationCommission: {
      StateOffice: 'Akwa Ibom State',
      FacilityId: facilityId,
      TransmissionTimestamp: new Date().toISOString(),
      CivilRegistrationData: {
        LiveBirthCount: births.length,
        DeathCount: deaths.length,
        Births: births,
        Deaths: deaths,
      },
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `NPC_eCRVS_${facilityId}_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
