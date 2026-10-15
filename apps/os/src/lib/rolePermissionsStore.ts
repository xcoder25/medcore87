/**
 * Per-role module + patient-data visibility — admin configures what each role can see.
 * Accounts share a dashboard by roleKey; this matrix gates modules and patient fields.
 */
export const ROLE_PERMISSIONS_KEY = 'medcore_os_role_permissions_v4';

/** Modules + patient data scopes an admin can toggle */
export const MODULE_CATALOG: { key: string; label: string; group: string }[] = [
  // Core
  { key: 'dashboard', label: 'Role dashboard (home)', group: 'Core' },
  { key: 'my-card', label: 'My staff ID card', group: 'Core' },
  { key: 'ai', label: 'Celestia assistant (chat)', group: 'Core' },
  { key: 'm87-ai', label: 'Celestia suite / insights', group: 'Core' },
  { key: 'doctor-portal', label: 'Doctor clinical portal', group: 'Core' },

  // Clinical & wards
  { key: 'emr', label: 'EMR / clinical records', group: 'Clinical' },
  { key: 'emergency', label: 'Emergency / A&E', group: 'Clinical' },
  { key: 'triage', label: 'Nursing triage & vitals station', group: 'Clinical' },
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
  { key: 'workflow-intelligence', label: '7-Workflow intelligence suite', group: 'Clinical' },

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
  { key: 'desk-settings', label: 'Front desk settings', group: 'Operations' },

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

export interface CustomRoleDefinition {
  roleKey: string;
  label: string;
  shortRole?: string;
  title?: string;
  clearanceLevel: number;
  clearanceLabel?: string;
  department?: string;
  group?: 'Clinical' | 'Nursing' | 'Front desk' | 'Support' | 'Admin' | 'Custom';
  isCustom?: boolean;
}

export const CUSTOM_ROLES_KEY = 'medcore_os_custom_roles_v1';
export const CUSTOM_ROLES_EVT = 'medcore-custom-roles-updated';

export function getCustomRoles(): CustomRoleDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_ROLES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomRoles(roles: CustomRoleDefinition[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_ROLES_KEY, JSON.stringify(roles));
  window.dispatchEvent(new CustomEvent(CUSTOM_ROLES_EVT, { detail: roles }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: CUSTOM_ROLES_KEY } }));
}

export function listConfigurableRoles(): { roleKey: string; label: string; clearanceLevel?: number; department?: string; isCustom?: boolean }[] {
  const custom = getCustomRoles().map((r) => ({
    roleKey: r.roleKey,
    label: r.label,
    clearanceLevel: r.clearanceLevel,
    department: r.department,
    isCustom: true,
  }));
  return [...CONFIGURABLE_ROLES, ...custom];
}

export function createCustomRole(role: CustomRoleDefinition, defaultModules?: string[]): boolean {
  const roles = getCustomRoles();
  const slug = role.roleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!slug) return false;

  // Check exists in presets or custom
  if (CONFIGURABLE_ROLES.some((r) => r.roleKey === slug) || roles.some((r) => r.roleKey === slug)) {
    return false;
  }

  const newRole: CustomRoleDefinition = {
    ...role,
    roleKey: slug,
    label: role.label.trim(),
    clearanceLevel: role.clearanceLevel || 3,
    clearanceLabel: role.clearanceLabel || `Level ${role.clearanceLevel || 3} Custom`,
    department: role.department || 'Clinical Operations',
    group: role.group || 'Custom',
    isCustom: true,
  };

  roles.push(newRole);
  saveCustomRoles(roles);

  // Set default modules for this role
  const map = getRolePermissionsMap();
  map[slug] = defaultModules && defaultModules.length
    ? defaultModules
    : ['dashboard', 'my-card', 'patient-360', 'emr', 'notifications'];
  setRolePermissionsMap(map);

  return true;
}

export function deleteCustomRole(roleKey: string): boolean {
  const roles = getCustomRoles();
  const next = roles.filter((r) => r.roleKey !== roleKey);
  if (next.length === roles.length) return false;
  saveCustomRoles(next);

  const map = getRolePermissionsMap();
  delete map[roleKey];
  setRolePermissionsMap(map);
  return true;
}

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

/** Default modules per role — specialty scopes (admin can widen in RBAC matrix) */
const DEFAULTS: Record<string, string[]> = {
  // General physician / MO — full clinical desk, not platform admin tools
  doctor: [
    'dashboard', 'doctor-portal', 'workflow-intelligence', 'patient-360', 'notifications',
    'emr', 'pharmacy', 'laboratory', 'lab', 'radiology',
    'emergency', 'beds', 'nursing', 'icu', 'theatre',
    'm87-ai', 'ai', 'patient-card', 'my-card',
    ...CLINICAL_PATIENT, 'patient.full_chart',
  ],
  // Surgeons — OT-first; no general pharmacy inventory / finance / admin
  surgeon: [
    'dashboard', 'theatre', 'doctor-portal', 'workflow-intelligence', 'notifications',
    'icu', 'beds', 'blood-bank', 'emergency',
    'laboratory', 'lab', 'radiology', 'emr',
    'm87-ai', 'ai', 'patient-card', 'my-card',
    ...CLINICAL_PATIENT, 'patient.procedures',
  ],
  nurse: [
    'dashboard', 'nursing', 'triage', 'workflow-intelligence', 'beds', 'notifications',
    'patient-flow', 'emergency', 'pharmacy', 'blood-bank',
    'maternity', 'paediatrics', 'icu',
    'm87-ai', 'ai', 'patient-card', 'my-card', 'emr',
    'patient.identity', 'patient.contact', 'patient.vitals', 'patient.allergies',
    'patient.problems', 'patient.notes', 'patient.meds', 'patient.labs',
  ],
  midwife: [
    'dashboard', 'maternity', 'paediatrics', 'notifications',
    'beds', 'emergency', 'my-card', 'patient-360',
    'm87-ai', 'ai',
    'patient.identity', 'patient.contact', 'patient.demographics', 'patient.vitals',
    'patient.allergies', 'patient.problems', 'patient.notes', 'patient.meds',
    'patient.labs',
  ],
  // Pharmacists — dispense & formulary only (not theatre / ICU control)
  pharmacist: [
    'dashboard', 'pharmacy', 'formulary', 'notifications',
    'cashier', 'emr', 'patient-flow', 'inventory',
    'm87-ai', 'ai', 'patient-card', 'my-card',
    'patient.identity', 'patient.allergies', 'patient.meds', 'patient.problems',
  ],
  // Lab — LIS, specimens, blood bank & analyzers
  lab: [
    'dashboard', 'laboratory', 'lab', 'lis', 'notifications',
    'blood-bank', 'iot-devices', 'my-card',
    'm87-ai', 'ai', 'him', 'him-deficiency', 'him-coding', 'him-roi', 'him-chart', 'him-merge', 'him-docs',
    'patient.identity', 'patient.labs', 'patient.vitals',
  ],
  // Radiologists — imaging only (not full OPD / prescribing)
  radiologist: [
    'dashboard', 'radiology', 'notifications',
    'emr', 'patient-card', 'my-card',
    'm87-ai', 'ai', 'him', 'him-deficiency', 'him-coding', 'him-roi', 'him-chart', 'him-merge', 'him-docs',
    'patient.identity', 'patient.imaging', 'patient.problems',
  ],
  reception: [
    'dashboard', 'patient-flow', 'patient-card', 'triage', 'appointments',
    'desk-settings', 'notifications', 'my-card',
    'patient.identity', 'patient.contact', 'patient.demographics', 'patient.insurance',
  ],
  records: [
    'dashboard', 'patient-card', 'patient-flow', 'beds', 'emr', 'my-card', 'notifications', 'claims',
    'm87-ai', 'ai', 'him', 'him-deficiency', 'him-coding', 'him-roi', 'him-chart', 'him-merge', 'him-docs',
    'patient.identity', 'patient.contact', 'patient.demographics',
  ],
  accountant: [
    'dashboard', 'cashier', 'billing', 'claims', 'revenue-cycle', 'procurement',
    'patient-card', 'analytics', 'my-card', 'notifications',
    'patient.identity', 'patient.billing', 'patient.insurance', 'patient.demographics',
  ],
  biomedical: [
    'dashboard', 'biomedical', 'iot-devices', 'facilities', 'environmental', 'inventory',
    'my-card', 'notifications',
  ],
  medical_director: [
    'dashboard', 'command', 'doctor-portal', 'm87-ai', 'ai', 'analytics',
    'emergency', 'theatre', 'icu', 'pharmacy', 'laboratory', 'lab', 'radiology',
    'blood-bank', 'beds', 'nursing', 'ambulance', 'notifications',
    'compliance', 'my-card', 'patient.full_chart', ...CLINICAL_PATIENT,
  ],
  sysadmin: [
    'dashboard', 'staffing', 'analytics', 'ai', 'm87-ai', 'sysadmin', 'rbac', 'enrolment',
    'facility', 'auth', 'fhir', 'data-hub', 'compliance', 'my-card', 'notifications',
  ],
  hospital_admin: ['*'],
};

export type RolePermissionsMap = Record<string, string[]>;

export function getRolePermissionsMap(): RolePermissionsMap {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(ROLE_PERMISSIONS_KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw) as RolePermissionsMap;
    // Merge: defaults first, then saved overrides — never drop a role's baseline list entirely if key missing
    const merged: RolePermissionsMap = { ...DEFAULTS };
    for (const [rk, mods] of Object.entries(saved)) {
      if (Array.isArray(mods) && mods.length) merged[rk] = mods;
    }
    return merged;
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

/** Hard denials — win over stale localStorage grants */
const ROLE_MODULE_DENY: Record<string, string[]> = {
  records: [
    'pharmacy', 'formulary', 'doctor-portal', 'theatre', 'icu', 'laboratory', 'lab',
    'radiology', 'nursing', 'maternity', 'paediatrics', 'blood-bank', 'emergency',
    'cashier', 'billing', 'revenue-cycle', 'rbac', 'sysadmin', 'enrolment', 'staffing',
  ],
  reception: [
    'pharmacy', 'formulary', 'doctor-portal', 'theatre', 'icu', 'laboratory', 'lab',
    'radiology', 'nursing', 'rbac', 'sysadmin',
  ],
  radiologist: ['pharmacy', 'formulary', 'theatre', 'nursing', 'cashier', 'billing'],
  lab: ['pharmacy', 'formulary', 'theatre', 'doctor-portal', 'cashier', 'billing'],
  accountant: ['pharmacy', 'formulary', 'doctor-portal', 'theatre', 'icu', 'laboratory', 'lab'],
};

export function roleCanAccessModule(roleKey: string, moduleKey: string): boolean {
  if (roleKey === 'hospital_admin') return true;
  const deny = ROLE_MODULE_DENY[roleKey] || [];
  if (deny.includes(moduleKey)) return false;
  const mods = getModulesForRole(roleKey);
  if (mods.includes('*')) return true;
  // lab role direct module access
  if (roleKey === 'lab' && ['dashboard', 'laboratory', 'lab', 'lis', 'blood-bank', 'iot-devices', 'notifications', 'm87-ai', 'ai', 'my-card'].includes(moduleKey)) return true;
  // legacy aliases
  if (moduleKey === 'laboratory' && mods.includes('lab') && !deny.includes('laboratory')) return true;
  if (moduleKey === 'lab' && mods.includes('laboratory') && !deny.includes('lab')) return true;
  if (moduleKey === 'm87-ai' && mods.includes('ai')) return true;
  if (moduleKey === 'ai' && mods.includes('m87-ai')) return true;
  // Always allow staff card + home desk
  if (moduleKey === 'dashboard' || moduleKey === 'my-card' || moduleKey === 'notifications') return true;
  return mods.includes(moduleKey);
}

/** Doctors / surgeons / medical director only — not records or pharmacy techs */
export function roleCanPrescribe(roleKey: string): boolean {
  const r = String(roleKey || '').toLowerCase();
  return r === 'doctor' || r === 'surgeon' || r === 'medical_director' || r === 'hospital_admin';
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
