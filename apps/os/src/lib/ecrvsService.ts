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

const INITIAL_BIRTHS: EcrvsBirthRecord[] = [];

const INITIAL_DEATHS: EcrvsDeathRecord[] = [];

export function listEcrvsBirths(facilityId?: string): EcrvsBirthRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BIRTH_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const all = JSON.parse(raw) as EcrvsBirthRecord[];
    if (facilityId) return all.filter((b) => !b.facilityId || b.facilityId.toUpperCase() === facilityId.toUpperCase());
    return all;
  } catch {
    return [];
  }
}

export function listEcrvsDeaths(facilityId?: string): EcrvsDeathRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEATH_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const all = JSON.parse(raw) as EcrvsDeathRecord[];
    if (facilityId) return all.filter((d) => !d.facilityId || d.facilityId.toUpperCase() === facilityId.toUpperCase());
    return all;
  } catch {
    return [];
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
