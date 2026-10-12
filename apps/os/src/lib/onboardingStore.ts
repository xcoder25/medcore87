/**
 * First-login hospital + staff onboarding state.
 * Admin/facility: organization profile → compliance → integrations → RBAC.
 * Clinical staff: identity → workspace prefs → guided tour.
 */

import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { firestoreSubscribeFacility } from './firebase';

export const FACILITY_ONBOARD_KEY = 'medcore_admin_onboarding_done';
export const STAFF_ONBOARD_PREFIX = 'medcore_os_staff_onboard_';
export const ONBOARD_DRAFT_KEY = 'medcore_os_onboarding';
export const ONBOARD_EVENT = 'medcore-onboarding-sync';

export type SpecialtyKey =
  | 'primary_care'
  | 'internal_medicine'
  | 'surgery'
  | 'paediatrics'
  | 'obstetrics'
  | 'cardiology'
  | 'emergency'
  | 'orthopaedics'
  | 'ophthalmology'
  | 'ent'
  | 'dental'
  | 'psychiatry'
  | 'radiology'
  | 'laboratory'
  | 'pharmacy'
  | 'dialysis'
  | 'icu'
  | 'neonatal';

export const SPECIALTY_OPTIONS: { key: SpecialtyKey; label: string }[] = [
  { key: 'primary_care', label: 'Primary / General OPD' },
  { key: 'internal_medicine', label: 'Internal Medicine' },
  { key: 'surgery', label: 'Surgery' },
  { key: 'paediatrics', label: 'Paediatrics' },
  { key: 'obstetrics', label: 'Obstetrics & Gynaecology' },
  { key: 'cardiology', label: 'Cardiology' },
  { key: 'emergency', label: 'Accident & Emergency' },
  { key: 'orthopaedics', label: 'Orthopaedics' },
  { key: 'ophthalmology', label: 'Ophthalmology' },
  { key: 'ent', label: 'ENT' },
  { key: 'dental', label: 'Dental' },
  { key: 'psychiatry', label: 'Psychiatry' },
  { key: 'radiology', label: 'Radiology / Imaging' },
  { key: 'laboratory', label: 'Laboratory / Pathology' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'dialysis', label: 'Dialysis' },
  { key: 'icu', label: 'ICU / Critical Care' },
  { key: 'neonatal', label: 'Neonatal / NICU' },
];

export type StorageRegion = 'ng-lagos' | 'af-south' | 'eu-west' | 'us-east' | 'local_only';
export type AppointmentType = 'in_person' | 'telehealth' | 'home_visit' | 'outreach';

export interface FacilityOnboardDraft {
  // Step 1 — Organization profile
  facilityName: string;
  primaryContact: string;
  contactPhone: string;
  contactEmail: string;
  physicalAddress: string;
  state: string;
  lga: string;
  licenceNumber: string;
  nhiaFacilityCode: string;
  taxId: string;
  specialties: SpecialtyKey[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
  defaultConsultMins: number;
  appointmentTypes: AppointmentType[];
  // Step 2 — Regulatory
  baaAccepted: boolean;
  baaSignedBy: string;
  baaSignedAt?: string;
  ndprAccepted: boolean;
  storageRegion: StorageRegion;
  auditRetentionYears: number;
  // Step 3 — Integrations
  enableFhir: boolean;
  enableHl7: boolean;
  enablePacs: boolean;
  enableLis: boolean;
  enableEprescribe: boolean;
  enableNhisBilling: boolean;
  enablePaystack: boolean;
  // Step 4 — RBAC seeds
  seedRoles: string[];
  requireMfa: boolean;
  enableSso: boolean;
  ssoProvider: 'none' | 'azure_ad' | 'okta' | 'hospital_ad';
  completedAt?: string;
  completedBy?: string;
  facilityId: string;
}

export interface StaffOnboardDraft {
  badgeId: string;
  facilityId: string;
  // Step 1 — Identity
  medicalLicence?: string;
  npiOrMdcn?: string;
  specialty?: string;
  mfaEnabled: boolean;
  mfaMethod: 'none' | 'authenticator' | 'sms' | 'security_key';
  // Step 2 — Workspace
  preferredTemplate: 'soap' | 'progress' | 'specialty_flowsheet' | 'anc_partograph';
  quickOrders: string[];
  eSignatureDrawn: boolean;
  eSignatureDataUrl?: string;
  // Step 3 — Tour
  tourCompleted: boolean;
  sandboxPracticeDone: boolean;
  completedAt?: string;
}

const DEFAULT_FACILITY = (facilityId: string, name?: string): FacilityOnboardDraft => ({
  facilityName: name || '',
  primaryContact: '',
  contactPhone: '',
  contactEmail: '',
  physicalAddress: '',
  state: 'Akwa Ibom',
  lga: '',
  licenceNumber: '',
  nhiaFacilityCode: '',
  taxId: '',
  specialties: ['primary_care', 'emergency', 'obstetrics', 'paediatrics', 'laboratory', 'pharmacy'],
  operatingHoursStart: '08:00',
  operatingHoursEnd: '18:00',
  defaultConsultMins: 15,
  appointmentTypes: ['in_person', 'telehealth'],
  baaAccepted: false,
  baaSignedBy: '',
  ndprAccepted: false,
  storageRegion: 'ng-lagos',
  auditRetentionYears: 7,
  enableFhir: true,
  enableHl7: true,
  enablePacs: false,
  enableLis: true,
  enableEprescribe: true,
  enableNhisBilling: true,
  enablePaystack: true,
  seedRoles: [
    'Physician',
    'Registered Nurse',
    'Midwife',
    'Front Desk / Reception',
    'Billing / Cashier',
    'Pharmacist',
    'Lab Scientist',
    'Practice Admin',
  ],
  requireMfa: true,
  enableSso: false,
  ssoProvider: 'none',
  facilityId,
});

function emit() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(ONBOARD_EVENT));
  } catch {
    /* ignore */
  }
}

export function isFacilityOnboarded(facilityId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(FACILITY_ONBOARD_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, boolean | string>;
    const v = map[facilityId] ?? map[facilityId.toUpperCase()];
    return v === true || (typeof v === 'string' && v.length > 0);
  } catch {
    return false;
  }
}

export function markFacilityOnboarded(facilityId: string, by?: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(FACILITY_ONBOARD_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[facilityId] = by || new Date().toISOString();
    localStorage.setItem(FACILITY_ONBOARD_KEY, JSON.stringify(map));
    try {
      publishFacilityData(facilityId, FACILITY_KEYS.onboarding, map);
    } catch {
      /* offline ok */
    }
  } catch {
    /* ignore */
  }
  emit();
}

export function isStaffOnboarded(badgeId: string): boolean {
  if (typeof window === 'undefined' || !badgeId) return true;
  try {
    return localStorage.getItem(STAFF_ONBOARD_PREFIX + badgeId) === '1';
  } catch {
    return false;
  }
}

export function markStaffOnboarded(badgeId: string) {
  if (typeof window === 'undefined' || !badgeId) return;
  try {
    localStorage.setItem(STAFF_ONBOARD_PREFIX + badgeId, '1');
  } catch {
    /* ignore */
  }
  emit();
}

export function loadFacilityDraft(facilityId: string, facilityName?: string): FacilityOnboardDraft {
  if (typeof window === 'undefined') return DEFAULT_FACILITY(facilityId, facilityName);
  try {
    const raw = localStorage.getItem(ONBOARD_DRAFT_KEY);
    if (raw) {
      const all = JSON.parse(raw) as Record<string, FacilityOnboardDraft>;
      if (all[facilityId]) return { ...DEFAULT_FACILITY(facilityId, facilityName), ...all[facilityId] };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FACILITY(facilityId, facilityName);
}

export function saveFacilityDraft(draft: FacilityOnboardDraft) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ONBOARD_DRAFT_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, FacilityOnboardDraft>) : {};
    all[draft.facilityId] = draft;
    localStorage.setItem(ONBOARD_DRAFT_KEY, JSON.stringify(all));
    try {
      publishFacilityData(draft.facilityId, FACILITY_KEYS.onboardingDraft, all);
    } catch {
      /* offline ok */
    }
  } catch {
    /* ignore */
  }
  emit();
}

export function loadStaffDraft(badgeId: string, facilityId: string): StaffOnboardDraft {
  if (typeof window === 'undefined') {
    return {
      badgeId,
      facilityId,
      mfaEnabled: false,
      mfaMethod: 'none',
      preferredTemplate: 'soap',
      quickOrders: [],
      eSignatureDrawn: false,
      tourCompleted: false,
      sandboxPracticeDone: false,
    };
  }
  try {
    const raw = localStorage.getItem(STAFF_ONBOARD_PREFIX + 'draft_' + badgeId);
    if (raw) return JSON.parse(raw) as StaffOnboardDraft;
  } catch {
    /* ignore */
  }
  return {
    badgeId,
    facilityId,
    mfaEnabled: false,
    mfaMethod: 'none',
    preferredTemplate: 'soap',
    quickOrders: ['FBC', 'UEC', 'Malaria RDT', 'Paracetamol', 'Amoxicillin'],
    eSignatureDrawn: false,
    tourCompleted: false,
    sandboxPracticeDone: false,
  };
}

export function saveStaffDraft(draft: StaffOnboardDraft) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_ONBOARD_PREFIX + 'draft_' + draft.badgeId, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
  emit();
}

/** Admin / facility owners who must complete hospital onboarding first */
export function isFacilityAdminRole(roleKey?: string, role?: string, title?: string): boolean {
  const s = `${roleKey || ''} ${role || ''} ${title || ''}`.toLowerCase();
  return (
    s.includes('hospital_admin') ||
    s.includes('sysadmin') ||
    s.includes('system admin') ||
    s.includes('medical_director') ||
    s.includes('medical director') ||
    (s.includes('administrator') && !s.includes('nursing')) ||
    s.includes('practice admin') ||
    s.includes('cio') ||
    s.includes('ict')
  );
}

export function subscribeOnboarding(cb: () => void, facilityId?: string): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = () => cb();
  window.addEventListener(ONBOARD_EVENT, h);
  window.addEventListener('storage', h);
  window.addEventListener('medcore-admin-sync', h);

  let unsubFs: (() => void) | undefined;
  if (facilityId) {
    try {
      unsubFs = firestoreSubscribeFacility(facilityId, (data) => {
        let changed = false;
        const remoteDone = data?.[FACILITY_KEYS.onboarding];
        if (remoteDone && typeof remoteDone === 'object') {
          try {
            const raw = localStorage.getItem(FACILITY_ONBOARD_KEY);
            const local = raw ? JSON.parse(raw) : {};
            const merged = { ...local, ...remoteDone };
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              localStorage.setItem(FACILITY_ONBOARD_KEY, JSON.stringify(merged));
              changed = true;
            }
          } catch {
            /* ignore */
          }
        }

        const remoteDrafts = data?.[FACILITY_KEYS.onboardingDraft];
        if (remoteDrafts && typeof remoteDrafts === 'object') {
          try {
            const raw = localStorage.getItem(ONBOARD_DRAFT_KEY);
            const local = raw ? JSON.parse(raw) : {};
            const merged = { ...local, ...remoteDrafts };
            if (JSON.stringify(local) !== JSON.stringify(merged)) {
              localStorage.setItem(ONBOARD_DRAFT_KEY, JSON.stringify(merged));
              changed = true;
            }
          } catch {
            /* ignore */
          }
        }

        if (changed) {
          emit();
          cb();
        }
      });
    } catch {
      /* offline / ignore */
    }
  }

  return () => {
    window.removeEventListener(ONBOARD_EVENT, h);
    window.removeEventListener('storage', h);
    window.removeEventListener('medcore-admin-sync', h);
    if (unsubFs) unsubFs();
  };
}

export function subscribeFacilityDraft(
  facilityId: string,
  onUpdate: (draft: FacilityOnboardDraft) => void
): () => void {
  if (typeof window === 'undefined' || !facilityId) return () => {};
  const handle = () => {
    onUpdate(loadFacilityDraft(facilityId));
  };
  return subscribeOnboarding(handle, facilityId);
}
