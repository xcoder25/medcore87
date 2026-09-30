/**
 * Per-role module visibility — admin configures what each role can see.
 * Accounts share a dashboard by roleKey; this matrix gates modules inside that role.
 */
export const ROLE_PERMISSIONS_KEY = 'medcore_os_role_permissions_v1';

/** Modules an admin can toggle for clinical/support roles */
export const MODULE_CATALOG: { key: string; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Role dashboard (home)', group: 'Core' },
  { key: 'emr', label: 'EMR / clinical records', group: 'Clinical' },
  { key: 'command', label: 'Hospital command centre', group: 'Operations' },
  { key: 'beds', label: 'Bed & ward occupancy', group: 'Operations' },
  { key: 'patient-flow', label: 'Patient flow visibility', group: 'Operations' },
  { key: 'patient-card', label: 'Patient card / registration', group: 'Front desk' },
  { key: 'cashier', label: 'Cashier / POS', group: 'Finance' },
  { key: 'billing', label: 'Billing', group: 'Finance' },
  { key: 'pharmacy', label: 'Pharmacy', group: 'Clinical' },
  { key: 'lab', label: 'Laboratory', group: 'Clinical' },
  { key: 'theatre', label: 'Operating theatre', group: 'Clinical' },
  { key: 'staffing', label: 'Staffing overview', group: 'Admin' },
  { key: 'my-card', label: 'My staff ID card', group: 'Core' },
  { key: 'ai', label: 'M87 AI assistant', group: 'Core' },
  { key: 'transfer', label: 'Staff transfer (view)', group: 'Admin' },
  { key: 'analytics', label: 'Analytics', group: 'Admin' },
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

const DEFAULTS: Record<string, string[]> = {
  doctor: ['dashboard', 'emr', 'beds', 'patient-flow', 'my-card', 'ai'],
  surgeon: ['dashboard', 'emr', 'theatre', 'beds', 'my-card', 'ai'],
  nurse: ['dashboard', 'emr', 'beds', 'patient-flow', 'my-card', 'ai'],
  midwife: ['dashboard', 'emr', 'beds', 'patient-flow', 'my-card', 'ai'],
  pharmacist: ['dashboard', 'pharmacy', 'emr', 'my-card', 'ai'],
  lab: ['dashboard', 'lab', 'emr', 'my-card', 'ai'],
  radiologist: ['dashboard', 'emr', 'my-card', 'ai'],
  reception: ['dashboard', 'patient-card', 'patient-flow', 'cashier', 'emr', 'my-card'],
  records: ['dashboard', 'emr', 'patient-card', 'my-card'],
  accountant: ['dashboard', 'cashier', 'billing', 'analytics', 'my-card'],
  sysadmin: ['dashboard', 'staffing', 'analytics', 'ai', 'my-card'],
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
