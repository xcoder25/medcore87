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

export function permissionsFor(
  persona: Persona,
  staffRole?: string
): Permission[] {
  if (persona === 'patient') return [...PATIENT_PERMS];
  const key = (staffRole || 'doctor') as StaffRoleKey;
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
  ward: 'staff.ward',
  patients: 'staff.patients',
  tasks: 'staff.tasks',
  orders: 'staff.orders',
  more: 'staff.activity',
};
