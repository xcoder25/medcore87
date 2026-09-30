/**
 * Per-role module + patient-data visibility — admin configures what each role can see.
 * Accounts share a dashboard by roleKey; this matrix gates modules and patient fields.
 */
export const ROLE_PERMISSIONS_KEY = 'medcore_os_role_permissions_v2';

/** Modules + patient data scopes an admin can toggle */
export const MODULE_CATALOG: { key: string; label: string; group: string }[] = [
  // Core / screens
  { key: 'dashboard', label: 'Role dashboard (home)', group: 'Core' },
  { key: 'my-card', label: 'My staff ID card', group: 'Core' },
  { key: 'ai', label: 'M87 AI assistant', group: 'Core' },
  // Clinical apps
  { key: 'emr', label: 'EMR / clinical records', group: 'Apps' },
  { key: 'command', label: 'Hospital command centre', group: 'Apps' },
  { key: 'beds', label: 'Bed & ward occupancy', group: 'Apps' },
  { key: 'patient-flow', label: 'Patient flow visibility', group: 'Apps' },
  { key: 'patient-card', label: 'Patient card / registration', group: 'Apps' },
  { key: 'cashier', label: 'Cashier / POS', group: 'Apps' },
  { key: 'billing', label: 'Billing office', group: 'Apps' },
  { key: 'pharmacy', label: 'Pharmacy', group: 'Apps' },
  { key: 'lab', label: 'Laboratory', group: 'Apps' },
  { key: 'theatre', label: 'Operating theatre', group: 'Apps' },
  { key: 'staffing', label: 'Staffing overview', group: 'Apps' },
  { key: 'transfer', label: 'Staff transfer (view)', group: 'Apps' },
  { key: 'analytics', label: 'Analytics', group: 'Apps' },
  // Patient data (what they may see about a patient)
  { key: 'patient.identity', label: 'Name, age, sex, photo, folder/card no.', group: 'Patient data' },
  { key: 'patient.contact', label: 'Phone, address, next of kin', group: 'Patient data' },
  { key: 'patient.demographics', label: 'LGA, occupation, insurance / HMO ID', group: 'Patient data' },
  { key: 'patient.vitals', label: 'Vitals (BP, temp, pulse, SpO₂, weight)', group: 'Patient data' },
  { key: 'patient.allergies', label: 'Allergies & alerts', group: 'Patient data' },
  { key: 'patient.problems', label: 'Diagnoses / problem list', group: 'Patient data' },
  { key: 'patient.notes', label: 'Clinical notes & SOAP', group: 'Patient data' },
  { key: 'patient.meds', label: 'Medications & prescriptions', group: 'Patient data' },
  { key: 'patient.labs', label: 'Lab results', group: 'Patient data' },
  { key: 'patient.imaging', label: 'Imaging / radiology reports', group: 'Patient data' },
  { key: 'patient.procedures', label: 'Procedures & theatre records', group: 'Patient data' },
  { key: 'patient.billing', label: 'Bills, payments, balances', group: 'Patient data' },
  { key: 'patient.insurance', label: 'HMO / insurance claims detail', group: 'Patient data' },
  { key: 'patient.full_chart', label: 'Full chart (all clinical sections)', group: 'Patient data' },
];

export const CONFIGURABLE_ROLES: { roleKey: string; label: string }[] = [
  { roleKey: 'doctor', label: 'Doctor' },
  { roleKey: 'surgeon', label: 'Surgeon' },
  { roleKey: 'nurse', label: 'Nurse' },
  { roleKey: 'midwife', label: 'Midwife' },
  { roleKey: 'pharmacist', label: 'Pharmacist' },
  { roleKey: 'lab', label: 'Lab scientist' },
  { roleKey: 'radiologist', label: 'Radiologist' },
  { roleKey: 'reception', label: 'Reception' },
  { roleKey: 'records', label: 'Records' },
  { roleKey: 'accountant', label: 'Finance / accounts' },
  { roleKey: 'sysadmin', label: 'ICT / SysAdmin' },
];

const CLINICAL_PATIENT = [
  'patient.identity',
  'patient.contact',
  'patient.demographics',
  'patient.vitals',
  'patient.allergies',
  'patient.problems',
  'patient.notes',
  'patient.meds',
  'patient.labs',
  'patient.imaging',
  'patient.procedures',
  'patient.full_chart',
];

const DEFAULTS: Record<string, string[]> = {
  doctor: [
    'dashboard', 'emr', 'beds', 'patient-flow', 'my-card', 'ai',
    ...CLINICAL_PATIENT,
  ],
  surgeon: [
    'dashboard', 'emr', 'theatre', 'beds', 'my-card', 'ai',
    ...CLINICAL_PATIENT, 'patient.procedures',
  ],
  nurse: [
    'dashboard', 'emr', 'beds', 'patient-flow', 'my-card', 'ai',
    'patient.identity', 'patient.contact', 'patient.vitals', 'patient.allergies',
    'patient.problems', 'patient.notes', 'patient.meds', 'patient.labs',
  ],
  midwife: [
    'dashboard', 'emr', 'beds', 'patient-flow', 'my-card', 'ai',
    'patient.identity', 'patient.contact', 'patient.vitals', 'patient.allergies',
    'patient.problems', 'patient.notes', 'patient.meds',
  ],
  pharmacist: [
    'dashboard', 'pharmacy', 'emr', 'my-card', 'ai',
    'patient.identity', 'patient.allergies', 'patient.meds', 'patient.problems',
  ],
  lab: [
    'dashboard', 'lab', 'emr', 'my-card', 'ai',
    'patient.identity', 'patient.labs', 'patient.vitals',
  ],
  radiologist: [
    'dashboard', 'emr', 'my-card', 'ai',
    'patient.identity', 'patient.imaging', 'patient.problems',
  ],
  reception: [
    'dashboard', 'patient-card', 'patient-flow', 'cashier', 'emr', 'my-card',
    'patient.identity', 'patient.contact', 'patient.demographics', 'patient.billing',
  ],
  records: [
    'dashboard', 'emr', 'patient-card', 'my-card',
    'patient.identity', 'patient.contact', 'patient.demographics',
  ],
  accountant: [
    'dashboard', 'cashier', 'billing', 'analytics', 'my-card',
    'patient.identity', 'patient.billing', 'patient.insurance', 'patient.demographics',
  ],
  sysadmin: ['dashboard', 'staffing', 'analytics', 'ai', 'my-card', 'patient.identity'],
  hospital_admin: ['*'],
};

export type RolePermissionsMap = Record<string, string[]>;

export function getRolePermissionsMap(): RolePermissionsMap {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(ROLE_PERMISSIONS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setRolePermissionsMap(map: RolePermissionsMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROLE_PERMISSIONS_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('medcore-role-permissions', { detail: map }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: ROLE_PERMISSIONS_KEY } }));
}

export function getModulesForRole(roleKey: string): string[] {
  const map = getRolePermissionsMap();
  if (roleKey === 'hospital_admin') return ['*'];
  return map[roleKey] || DEFAULTS[roleKey] || ['dashboard', 'my-card'];
}

export function roleCanAccessModule(roleKey: string, moduleKey: string): boolean {
  if (roleKey === 'hospital_admin') return true;
  const mods = getModulesForRole(roleKey);
  if (mods.includes('*')) return true;
  return mods.includes(moduleKey);
}

/** Patient-data scopes (keys starting with patient.) */
export function roleCanSeePatientData(roleKey: string, scope: string): boolean {
  if (roleKey === 'hospital_admin') return true;
  const mods = getModulesForRole(roleKey);
  if (mods.includes('*') || mods.includes('patient.full_chart')) return true;
  const key = scope.startsWith('patient.') ? scope : `patient.${scope}`;
  return mods.includes(key);
}

export function setRoleModule(roleKey: string, moduleKey: string, enabled: boolean) {
  const map = getRolePermissionsMap();
  const cur = new Set(map[roleKey] || DEFAULTS[roleKey] || ['dashboard']);
  if (enabled) cur.add(moduleKey);
  else cur.delete(moduleKey);
  if (!cur.has('dashboard')) cur.add('dashboard');
  map[roleKey] = Array.from(cur);
  setRolePermissionsMap(map);
  return map[roleKey];
}

export function applyRoleModules(roleKey: string, modules: string[]) {
  const map = getRolePermissionsMap();
  const set = new Set(modules);
  set.add('dashboard');
  map[roleKey] = Array.from(set);
  setRolePermissionsMap(map);
  return map[roleKey];
}
