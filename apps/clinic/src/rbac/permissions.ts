/**
 * MedCore Mobile — unified Patient + Staff app RBAC
 */

export type Persona = 'patient' | 'staff';

export type StaffRoleKey =
  | 'doctor'
  | 'nurse'
  | 'surgeon'
  | 'midwife'
  | 'pharmacist'
  | 'lab'
  | 'radiologist'
  | 'physiotherapist'
  | 'admin'
  | 'hospital_admin'
  | 'cashier'
  | 'records'
  | 'biomedical';

export type Permission =
  | 'patient.home'
  | 'patient.appointments'
  | 'patient.records'
  | 'patient.health_card'
  | 'patient.billing'
  | 'patient.emergency'
  | 'patient.chat'
  | 'staff.admin_hub'
  | 'staff.enrol'
  | 'staff.ward'
  | 'staff.patients'
  | 'staff.tasks'
  | 'staff.orders'
  | 'staff.emar'
  | 'staff.prescription'
  | 'staff.notes'
  | 'staff.results'
  | 'staff.discharge'
  | 'staff.theatre'
  | 'staff.referrals'
  | 'staff.nursing'
  | 'staff.emergency'
  | 'staff.portering'
  | 'staff.handover'
  | 'staff.chat'
  | 'staff.roster'
  | 'staff.alerts'
  | 'staff.assistant'
  | 'staff.activity'
  | 'staff.id_card';

const PATIENT_PERMS: Permission[] = [
  'patient.home',
  'patient.appointments',
  'patient.records',
  'patient.health_card',
  'patient.billing',
  'patient.emergency',
  'patient.chat',
];

/** Role → allowed staff permissions */
const STAFF_MATRIX: Record<StaffRoleKey, Permission[]> = {
  doctor: [
    'staff.ward',
    'staff.patients',
    'staff.tasks',
    'staff.orders',
    'staff.prescription',
    'staff.notes',
    'staff.results',
    'staff.discharge',
    'staff.referrals',
    'staff.emergency',
    'staff.handover',
    'staff.chat',
    'staff.roster',
    'staff.alerts',
    'staff.assistant',
    'staff.activity',
    'staff.id_card',
  ],
  surgeon: [
    'staff.ward',
    'staff.patients',
    'staff.tasks',
    'staff.orders',
    'staff.notes',
    'staff.results',
    'staff.discharge',
    'staff.theatre',
    'staff.referrals',
    'staff.emergency',
    'staff.handover',
    'staff.chat',
    'staff.roster',
    'staff.alerts',
    'staff.assistant',
    'staff.activity',
    'staff.id_card',
  ],
  nurse: [
    'staff.ward',
    'staff.patients',
    'staff.tasks',
    'staff.emar',
    'staff.notes',
    'staff.results',
    'staff.nursing',
    'staff.emergency',
    'staff.portering',
    'staff.handover',
    'staff.chat',
    'staff.roster',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
  ],
  midwife: [
    'staff.ward',
    'staff.patients',
    'staff.tasks',
    'staff.emar',
    'staff.notes',
    'staff.nursing',
    'staff.emergency',
    'staff.handover',
    'staff.chat',
    'staff.roster',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
  ],
  pharmacist: [
    'staff.patients',
    'staff.tasks',
    'staff.emar',
    'staff.prescription',
    'staff.orders',
    'staff.chat',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
  ],
  lab: [
    'staff.patients',
    'staff.tasks',
    'staff.orders',
    'staff.results',
    'staff.chat',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
  ],
  radiologist: [
    'staff.patients',
    'staff.tasks',
    'staff.orders',
    'staff.results',
    'staff.chat',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
  ],
  physiotherapist: [
    'staff.patients',
    'staff.tasks',
    'staff.notes',
    'staff.chat',
    'staff.roster',
    'staff.activity',
    'staff.id_card',
  ],
  admin: [
    'staff.admin_hub',
    'staff.enrol',
    'staff.ward',
    'staff.patients',
    'staff.tasks',
    'staff.orders',
    'staff.discharge',
    'staff.referrals',
    'staff.roster',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
    'staff.chat',
  ],
  hospital_admin: [
    'staff.admin_hub',
    'staff.enrol',
    'staff.ward',
    'staff.patients',
    'staff.tasks',
    'staff.orders',
    'staff.discharge',
    'staff.referrals',
    'staff.roster',
    'staff.alerts',
    'staff.activity',
    'staff.id_card',
    'staff.chat',
  ],
  cashier: ['staff.tasks', 'staff.activity', 'staff.id_card', 'staff.chat'],
  records: [
    'staff.patients',
    'staff.tasks',
    'staff.discharge',
    'staff.referrals',
    'staff.activity',
    'staff.id_card',
    'staff.chat',
  ],
  biomedical: ['staff.tasks', 'staff.alerts', 'staff.activity', 'staff.id_card', 'staff.chat'],
};

export function normalizeStaffRoleKey(staffRole?: string): StaffRoleKey {
  const raw = String(staffRole || 'doctor').trim().toLowerCase();
  if (raw === 'sysadmin' || raw === 'medical_director' || raw === 'hospital_admin') {
    return 'hospital_admin';
  }
  return (raw in STAFF_MATRIX ? raw : 'doctor') as StaffRoleKey;
}

export function permissionsFor(
  persona: Persona,
  staffRole?: string
): Permission[] {
  if (persona === 'patient') return [...PATIENT_PERMS];
  const key = normalizeStaffRoleKey(staffRole);
  return STAFF_MATRIX[key] ? [...STAFF_MATRIX[key]] : [...STAFF_MATRIX.doctor];
}

export function can(
  persona: Persona,
  staffRole: string | undefined,
  permission: Permission
): boolean {
  return permissionsFor(persona, staffRole).includes(permission);
}

/** Map More-menu tool keys to permissions */
export const TOOL_PERMISSION: Record<string, Permission> = {
  'admin-hub': 'staff.admin_hub',
  'staff-enrol': 'staff.enrol',
  emar: 'staff.emar',
  prescription: 'staff.prescription',
  notes: 'staff.notes',
  results: 'staff.results',
  discharge: 'staff.discharge',
  theatre: 'staff.theatre',
  referrals: 'staff.referrals',
  nursing: 'staff.nursing',
  emergency: 'staff.emergency',
  portering: 'staff.portering',
  handover: 'staff.handover',
  chat: 'staff.chat',
  roster: 'staff.roster',
  alerts: 'staff.alerts',
  assistant: 'staff.assistant',
  activity: 'staff.activity',
  'staff-id': 'staff.id_card',
};

export const TAB_PERMISSION: Record<string, Permission> = {
  admin: 'staff.admin_hub',
  ward: 'staff.ward',
  patients: 'staff.patients',
  tasks: 'staff.tasks',
  orders: 'staff.orders',
  more: 'staff.activity',
};

export interface EmrOnlyCapability {
  key: string;
  title: string;
  emrPath: string;
  reason: string;
}

/**
 * Administrative & compliance functions restricted exclusively to the Desktop MedCore OS EMR.
 * Mobile admin sessions surface their lock status and direct administrators to the workstation.
 */
export const EMR_ONLY_ADMIN_CAPABILITIES: EmrOnlyCapability[] = [
  {
    key: 'rbac_matrix',
    title: 'RBAC Role Matrix & Clearance Rules',
    emrPath: 'MedCore OS → Admin Settings → Role Visibility Matrix',
    reason: 'System-wide role capability overrides require full desktop workstation verification.',
  },
  {
    key: 'treasury_settlement',
    title: 'AkwaRemit Treasury Configuration & Batch Settlement',
    emrPath: 'MedCore OS → Revenue & Accounts → AkwaRemit Settlement',
    reason: 'Dual-control treasury settlement and merchant keys are locked to hospital EMR terminals.',
  },
  {
    key: 'destructive_auth_flush',
    title: 'Bulk Staff Credential Revocation & Facility Flush',
    emrPath: 'MedCore OS → Staff Access Control → Revoke / Reset',
    reason: 'Destructive credential deletion and facility purge actions require 2FA on desktop EMR.',
  },
  {
    key: 'audit_merkle_export',
    title: 'Tamper-Evident Audit CSV Export & Merkle Seal',
    emrPath: 'MedCore OS → Compliance & Audit → Export & Anchor',
    reason: 'Full cryptographic audit ledger export and sealing must run from audited EMR terminals.',
  },
  {
    key: 'statutory_onboarding_dhis2',
    title: 'Statutory Hospital Onboarding, HFR & DHIS2 Submission',
    emrPath: 'MedCore OS → Admin Settings → Facility Profile & DHIS2',
    reason: 'HFR accreditation uploads, CMD approvals, and DHIS2 reporting run on Desktop EMR.',
  },
  {
    key: 'badge_printer_2fa_policy',
    title: 'Admin Face ID 2FA Policy & Hardware ID Card Printing',
    emrPath: 'MedCore OS → Admin Settings → Security & 2FA / Card Printer',
    reason: 'Hardware badge printing and facility-wide 2FA policy toggles are desktop EMR workflows.',
  },
];

export function isEmrOnlyCapability(key: string): boolean {
  return EMR_ONLY_ADMIN_CAPABILITIES.some((c) => c.key === key);
}
