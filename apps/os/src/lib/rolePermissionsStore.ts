/**
 * Per-role module + patient-data visibility — admin configures what each role can see.
 * Accounts share a dashboard by roleKey; this matrix gates modules and patient fields.
 */
export const ROLE_PERMISSIONS_KEY = 'medcore_os_role_permissions_v3';

/** Modules + patient data scopes an admin can toggle */
export const MODULE_CATALOG: { key: string; label: string; group: string }[] = [
  // Core
  { key: 'dashboard', label: 'Role dashboard (home)', group: 'Core' },
  { key: 'my-card', label: 'My staff ID card', group: 'Core' },
  { key: 'ai', label: 'M87 AI assistant (chat)', group: 'Core' },
  { key: 'm87-ai', label: 'M87 AI suite / insights', group: 'Core' },
  { key: 'doctor-portal', label: 'Doctor clinical portal', group: 'Core' },

  // Clinical & wards
  { key: 'emr', label: 'EMR / clinical records', group: 'Clinical' },
  { key: 'emergency', label: 'Emergency / A&E', group: 'Clinical' },
  { key: 'nursing', label: 'Nursing workstation', group: 'Clinical' },
  { key: 'maternity', label: 'Maternity', group: 'Clinical' },
  { key: 'paediatrics', label: 'Paediatrics', group: 'Clinical' },
  { key: 'icu', label: 'ICU & critical care', group: 'Clinical' },
  { key: 'theatre', label: 'Operating theatre', group: 'Clinical' },
  { key: 'pharmacy', label: 'Pharmacy', group: 'Clinical' },
  { key: 'laboratory', label: 'Laboratory (LIS)', group: 'Clinical' },
  { key: 'lab', label: 'Laboratory (legacy key)', group: 'Clinical' },
  { key: 'radiology', label: 'Radiology / imaging', group: 'Clinical' },
  { key: 'blood-bank', label: 'Blood bank', group: 'Clinical' },

  // Operations
  { key: 'command', label: 'Hospital command centre', group: 'Operations' },
  { key: 'beds', label: 'Bed & ward occupancy', group: 'Operations' },
  { key: 'patient-flow', label: 'Check-in, queue & patient flow', group: 'Operations' },
  { key: 'patient-card', label: 'Patient registration / MPI', group: 'Operations' },
  { key: 'appointments', label: 'Appointments', group: 'Operations' },
  { key: 'ambulance', label: 'Ambulance & transfers', group: 'Operations' },
  { key: 'staffing', label: 'Staffing & rosters', group: 'Operations' },
  { key: 'transfer', label: 'Inter-facility staff transfer', group: 'Operations' },

  // Finance
  { key: 'cashier', label: 'Cashier / POS', group: 'Finance' },
  { key: 'billing', label: 'Billing office', group: 'Finance' },
  { key: 'claims', label: 'Insurance / HMO claims', group: 'Finance' },
  { key: 'revenue-cycle', label: 'Revenue cycle & accounting', group: 'Finance' },
  { key: 'procurement', label: 'Procurement & payroll', group: 'Finance' },

  // Facilities & engineering
  { key: 'inventory', label: 'Inventory / medical store', group: 'Facilities' },
  { key: 'biomedical', label: 'Biomedical equipment', group: 'Facilities' },
  { key: 'facilities', label: 'Plant & utilities', group: 'Facilities' },
  { key: 'environmental', label: 'Environmental health & safety', group: 'Facilities' },
  { key: 'iot-devices', label: 'Connected medical IoT', group: 'Facilities' },

  // Data & compliance
  { key: 'analytics', label: 'Reports & analytics', group: 'Governance' },
  { key: 'data-hub', label: 'Data hub / integrations', group: 'Governance' },
  { key: 'fhir', label: 'FHIR / interoperability', group: 'Governance' },
  { key: 'compliance', label: 'Compliance & audit', group: 'Governance' },
  { key: 'safety', label: 'Safety / incident', group: 'Governance' },
  { key: 'auth', label: 'Staff sign-in & identity', group: 'Governance' },

  // Admin
  { key: 'facility', label: 'Hospital / facility profile', group: 'Admin' },
  { key: 'rbac', label: 'Role visibility matrix', group: 'Admin' },
  { key: 'enrolment', label: 'Staff enrolment & ID cards', group: 'Admin' },
  { key: 'sysadmin', label: 'System settings', group: 'Admin' },

  // Patient data scopes
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
  { key: 'patient.billing', label: 'Bills, receipts, balances', group: 'Patient data' },
  { key: 'patient.insurance', label: 'HMO / NHIA eligibility', group: 'Patient data' },
  { key: 'patient.full_chart', label: 'Full clinical chart (all patient data)', group: 'Patient data' },
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
  { roleKey: 'biomedical', label: 'Biomedical / engineering' },
  { roleKey: 'medical_director', label: 'Medical director' },
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
];

/** Default modules per role — mirrors sidebar menus; admin can narrow/widen in RBAC matrix */
const DEFAULTS: Record<string, string[]> = {
  doctor: [
    'dashboard', 'doctor-portal', 'm87-ai', 'ai', 'emr', 'emergency', 'nursing', 'pharmacy',
    'beds', 'theatre', 'icu', 'radiology', 'laboratory', 'lab', 'patient-card', 'staffing', 'my-card',
    ...CLINICAL_PATIENT, 'patient.full_chart',
  ],
  surgeon: [
    'dashboard', 'theatre', 'm87-ai', 'ai', 'icu', 'blood-bank', 'emergency', 'beds',
    'radiology', 'laboratory', 'lab', 'patient-card', 'emr', 'my-card',
    ...CLINICAL_PATIENT, 'patient.procedures',
  ],
  nurse: [
    'dashboard', 'nursing', 'beds', 'emergency', 'patient-flow', 'maternity', 'paediatrics',
    'blood-bank', 'pharmacy', 'm87-ai', 'ai', 'staffing', 'iot-devices', 'patient-card', 'emr', 'my-card',
    'patient.identity', 'patient.contact', 'patient.vitals', 'patient.allergies',
    'patient.problems', 'patient.notes', 'patient.meds', 'patient.labs',
  ],
  midwife: [
    'dashboard', 'maternity', 'paediatrics', 'nursing', 'blood-bank', 'beds', 'patient-flow',
    'm87-ai', 'ai', 'patient-card', 'emr', 'my-card',
    'patient.identity', 'patient.contact', 'patient.vitals', 'patient.allergies',
    'patient.problems', 'patient.notes', 'patient.meds',
  ],
  pharmacist: [
    'dashboard', 'pharmacy', 'inventory', 'nursing', 'facilities', 'm87-ai', 'ai',
    'patient-card', 'emr', 'my-card',
    'patient.identity', 'patient.allergies', 'patient.meds', 'patient.problems',
  ],
  lab: [
    'dashboard', 'laboratory', 'lab', 'blood-bank', 'data-hub', 'iot-devices',
    'patient-card', 'compliance', 'emr', 'my-card', 'ai',
    'patient.identity', 'patient.labs', 'patient.vitals',
  ],
  radiologist: [
    'dashboard', 'radiology', 'm87-ai', 'ai', 'biomedical', 'data-hub', 'patient-card', 'emr', 'my-card',
    'patient.identity', 'patient.imaging', 'patient.problems',
  ],
  reception: [
    'dashboard', 'patient-flow', 'patient-card', 'appointments', 'cashier', 'billing',
    'analytics', 'sysadmin', 'my-card',
    'patient.identity', 'patient.contact', 'patient.demographics', 'patient.billing', 'patient.insurance',
  ],
  records: [
    'dashboard', 'patient-card', 'patient-flow', 'beds', 'claims', 'emr', 'my-card',
    'patient.identity', 'patient.contact', 'patient.demographics',
  ],
  accountant: [
    'dashboard', 'cashier', 'billing', 'claims', 'revenue-cycle', 'procurement',
    'patient-card', 'command', 'analytics', 'my-card',
    'patient.identity', 'patient.billing', 'patient.insurance', 'patient.demographics',
  ],
  biomedical: [
    'dashboard', 'biomedical', 'iot-devices', 'facilities', 'environmental', 'inventory', 'my-card',
  ],
  medical_director: [
    'dashboard', 'command', 'm87-ai', 'ai', 'analytics', 'emergency', 'theatre', 'icu',
    'pharmacy', 'laboratory', 'lab', 'blood-bank', 'ambulance', 'revenue-cycle',
    'compliance', 'rbac', 'sysadmin', 'my-card', 'patient.full_chart', ...CLINICAL_PATIENT,
  ],
  sysadmin: [
    'dashboard', 'staffing', 'analytics', 'ai', 'm87-ai', 'sysadmin', 'rbac', 'enrolment',
    'facility', 'auth', 'compliance', 'data-hub', 'my-card', 'patient.identity',
  ],
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
  if (mods.includes(moduleKey)) return true;
  // legacy aliases
  if (moduleKey === 'laboratory' && mods.includes('lab')) return true;
  if (moduleKey === 'lab' && mods.includes('laboratory')) return true;
  if (moduleKey === 'm87-ai' && mods.includes('ai')) return true;
  if (moduleKey === 'ai' && mods.includes('m87-ai')) return true;
  return false;
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
