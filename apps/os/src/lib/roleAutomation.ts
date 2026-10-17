/**
 * Celestia Astra — Executive Role Automation Engine.
 * Allows administrators to create, configure, list, and delete custom roles
 * through natural language prompts.
 */
import {
  createCustomRole,
  deleteCustomRole,
  getCustomRoles,
  listConfigurableRoles,
  getRolePermissionsMap,
  setRolePermissionsMap,
  MODULE_CATALOG,
  type CustomRoleDefinition,
} from './rolePermissionsStore';
import { pushActivity } from './adminRealtimeStore';
import { emitLiveAction } from './liveActions';
import { isPrivilegedAdmin } from './celestiaRoleGuard';

export interface RoleAutomationParseResult {
  handled: boolean;
  action?: 'create' | 'delete' | 'list' | 'info';
  roleName?: string;
  roleKey?: string;
  clearanceLevel?: number;
  department?: string;
  group?: 'Clinical' | 'Nursing' | 'Front desk' | 'Support' | 'Admin' | 'Custom';
  modules?: string[];
  replyIfHandled?: string;
  error?: string;
}

// Module aliases for natural language parsing
const MODULE_ALIASES: Record<string, string> = {
  // Clinical
  'emr': 'emr',
  'chart': 'emr',
  'notes': 'emr',
  'clinical notes': 'emr',
  'emergency': 'emergency',
  'a&e': 'emergency',
  'triage': 'triage',
  'vitals': 'triage',
  'nursing': 'nursing',
  'ward': 'nursing',
  'wards': 'nursing',
  'e-mar': 'nursing',
  'mar': 'nursing',
  'maternity': 'maternity',
  'labour': 'maternity',
  'labor': 'maternity',
  'ctg': 'maternity',
  'paediatrics': 'paediatrics',
  'pediatrics': 'paediatrics',
  'nicu': 'paediatrics',
  'newborn': 'paediatrics',
  'icu': 'icu',
  'critical care': 'icu',
  'theatre': 'theatre',
  'theater': 'theatre',
  'ot': 'theatre',
  'or': 'theatre',
  'surgery': 'theatre',
  'optime': 'theatre',
  'pharmacy': 'pharmacy',
  'rx': 'pharmacy',
  'dispense': 'pharmacy',
  'laboratory': 'laboratory',
  'lab': 'laboratory',
  'lis': 'laboratory',
  'radiology': 'radiology',
  'imaging': 'radiology',
  'pacs': 'radiology',
  'x-ray': 'radiology',
  'xray': 'radiology',
  'blood bank': 'blood-bank',
  'blood-bank': 'blood-bank',
  'blood': 'blood-bank',
  'workflow-intelligence': 'workflow-intelligence',

  // Operations
  'command': 'command',
  'beds': 'beds',
  'census': 'beds',
  'bed': 'beds',
  'patient-flow': 'patient-flow',
  'patient flow': 'patient-flow',
  'queue': 'patient-flow',
  'patient-card': 'patient-card',
  'patient card': 'patient-card',
  'mpi': 'patient-card',
  'appointments': 'appointments',
  'appointment': 'appointments',
  'ambulance': 'ambulance',
  'dispatch': 'ambulance',
  'staffing': 'staffing',
  'rosters': 'staffing',
  'roster': 'staffing',
  'transfer': 'transfer',

  // Finance
  'cashier': 'cashier',
  'pos': 'cashier',
  'till': 'cashier',
  'billing': 'billing',
  'invoice': 'billing',
  'claims': 'claims',
  'hmo': 'claims',
  'nhis': 'claims',
  'nhia': 'claims',
  'revenue-cycle': 'revenue-cycle',
  'revenue': 'revenue-cycle',
  'procurement': 'procurement',

  // Facilities
  'inventory': 'inventory',
  'drug store': 'inventory',
  'cms': 'inventory',
  'biomedical': 'biomedical',
  'equipment': 'biomedical',
  'facilities': 'facilities',
  'oxygen': 'facilities',
  'environmental': 'environmental',
  'waste': 'environmental',
  'iot-devices': 'iot-devices',
  'iot': 'iot-devices',

  // Governance
  'analytics': 'analytics',
  'reports': 'analytics',
  'data-hub': 'data-hub',
  'fhir': 'fhir',
  'compliance': 'compliance',
  'audit': 'compliance',
  'safety': 'safety',
  'auth': 'auth',
  'rbac': 'rbac',
  'enrolment': 'enrolment',
  'sysadmin': 'sysadmin',
  'desk-settings': 'desk-settings',
  'notifications': 'notifications',
  'in basket': 'notifications',
  'inbasket': 'notifications',
  'my-card': 'my-card',
  'staff card': 'my-card',
};

/** Parse natural language for role management intents */
export function parseRoleAutomationIntent(
  query: string,
  actorRole: string
): RoleAutomationParseResult {
  const q = query.trim();
  const lower = q.toLowerCase();

  // Guard: Must be admin
  const isPrivileged = isPrivilegedAdmin(actorRole);

  // Check if intent is role management
  const isRoleCreate =
    /\b(create|add|new|setup|register|define|build)\s+(?:a\s+)?(?:new\s+)?role\b/i.test(lower) ||
    lower.startsWith('create role') ||
    lower.startsWith('add role') ||
    lower.startsWith('new role');

  const isRoleList =
    /\b(list|show|view|display|what are the)\s+(?:all\s+)?(?:custom\s+)?roles\b/i.test(lower) ||
    lower === 'roles' ||
    lower === 'custom roles' ||
    lower === 'list roles';

  const isRoleDelete =
    /\b(delete|remove|destroy|drop)\s+(?:custom\s+)?role\b/i.test(lower);

  if (!isRoleCreate && !isRoleList && !isRoleDelete) {
    return { handled: false };
  }

  if (!isPrivileged) {
    return {
      handled: true,
      error:
        `Role creation, deletion, and governance are restricted exclusively to **Celestia Astra** under administrative clearance.\n\n` +
        `Your signed-in role does not possess permissions to modify the hospital role catalog. Please contact your Hospital Administrator.`,
    };
  }

  // Handle List Roles
  if (isRoleList) {
    return { handled: true, action: 'list' };
  }

  // Handle Delete Role
  if (isRoleDelete) {
    const match = q.match(/(?:delete|remove|destroy|drop)\s+(?:custom\s+)?role\s+(?:named\s+|called\s+)?[:"']?([a-zA-Z0-9_\s-]+)["']?/i);
    const target = match ? match[1].trim() : '';
    if (!target) {
      return {
        handled: true,
        action: 'delete',
        error: 'Please specify which role to delete, e.g. "delete role dialysis_nurse".',
      };
    }
    return {
      handled: true,
      action: 'delete',
      roleName: target,
      roleKey: target.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    };
  }

  // Handle Create Role
  // Extract role name
  // e.g. "create role Dialysis Nurse with access to nursing, beds, icu..."
  // e.g. "create a new role called Triage Specialist: emergency, triage..."
  let roleName = '';
  const nameMatch = q.match(/(?:create|add|new|setup|define|build)\s+(?:a\s+)?(?:new\s+)?role\s+(?:for\s+|called\s+|named\s+)?[:"']?([^,\n:;()]+?)(?:["']|\s+with\b|\s+for\b|\s+having\b|\s+clearance\b|\s+department\b|:|$)/i);
  if (nameMatch) {
    roleName = nameMatch[1].trim();
    // remove leftover keywords
    roleName = roleName.replace(/^(for|called|named)\s+/i, '').trim();
  }

  if (!roleName || roleName.length < 2) {
    return {
      handled: true,
      action: 'create',
      error:
        'Please provide a role name. E.g.:\n' +
        '• "Create role Dialysis Nurse with access to nursing, beds, icu, emr and clearance level 3 in Inpatient Wards"\n' +
        '• "Create role Anesthetist: theatre, icu, emergency, emr, clearance 5, Surgery"',
    };
  }

  // Generate slug
  const roleKey = roleName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  // Extract clearance level (1 to 6)
  let clearanceLevel = 3;
  const clearanceMatch = lower.match(/(?:clearance|level|tier)\s*(?:level)?\s*[:=]?\s*([1-6])/i);
  if (clearanceMatch) {
    clearanceLevel = parseInt(clearanceMatch[1], 10);
  }

  // Extract department
  let department = 'Clinical Operations';
  const deptMatch = q.match(/(?:in|department|dept|unit)\s*[:=]?\s*([A-Za-z0-9\s&/-]+?)(?:with\b|having\b|clearance\b|modules\b|$)/i);
  if (deptMatch && deptMatch[1].trim().length > 2) {
    const d = deptMatch[1].trim();
    if (!['with', 'having', 'clearance', 'level', 'modules'].includes(d.toLowerCase())) {
      department = d;
    }
  }

  // Extract group
  let group: CustomRoleDefinition['group'] = 'Clinical';
  if (/nurs|matern|midwif|ward/i.test(roleName + department)) group = 'Nursing';
  else if (/reception|front|record|admiss/i.test(roleName + department)) group = 'Front desk';
  else if (/account|financ|cashier|bill|biomed|store|invent/i.test(roleName + department)) group = 'Support';
  else if (/admin|director|govern|ict|sys/i.test(roleName + department)) group = 'Admin';

  // Extract modules mentioned in query
  const modules = new Set<string>(['dashboard', 'my-card', 'notifications']);
  for (const [alias, modKey] of Object.entries(MODULE_ALIASES)) {
    // word boundary check
    const reg = new RegExp(`\\b${alias.replace('-', '[- ]')}\\b`, 'i');
    if (reg.test(lower)) {
      modules.add(modKey);
    }
  }

  // If no specific modules were detected from text, seed sensible defaults
  if (modules.size <= 3) {
    if (group === 'Nursing') {
      ['nursing', 'beds', 'patient-360', 'emr', 'triage'].forEach((m) => modules.add(m));
    } else if (group === 'Clinical') {
      ['patient-360', 'emr', 'doctor-portal', 'laboratory', 'pharmacy'].forEach((m) => modules.add(m));
    } else if (group === 'Support') {
      ['cashier', 'billing', 'claims'].forEach((m) => modules.add(m));
    } else {
      ['patient-360', 'emr', 'patient-flow'].forEach((m) => modules.add(m));
    }
  }

  return {
    handled: true,
    action: 'create',
    roleName,
    roleKey,
    clearanceLevel,
    department,
    group,
    modules: Array.from(modules),
  };
}

/** Execute role creation autonomously */
export function executeCreateRoleAutomation(
  parsed: RoleAutomationParseResult,
  actorName: string
): { success: boolean; message: string } {
  if (!parsed.roleName || !parsed.roleKey) {
    return { success: false, message: 'Invalid role definition.' };
  }

  const def: CustomRoleDefinition = {
    roleKey: parsed.roleKey,
    label: parsed.roleName,
    shortRole: parsed.roleName.slice(0, 15),
    title: parsed.roleName,
    clearanceLevel: parsed.clearanceLevel || 3,
    clearanceLabel: `Level ${parsed.clearanceLevel || 3} Authorization`,
    department: parsed.department || 'Clinical Operations',
    group: parsed.group || 'Custom',
    isCustom: true,
  };

  const ok = createCustomRole(def, parsed.modules);
  if (!ok) {
    return {
      success: false,
      message: `A role with identifier **"${parsed.roleKey}"** already exists in the hospital registry. Choose a distinct role name.`,
    };
  }

  // Update permissions map with exact modules
  if (parsed.modules && parsed.modules.length > 0) {
    const map = getRolePermissionsMap();
    map[parsed.roleKey] = parsed.modules;
    setRolePermissionsMap(map);
  }

  // Log activity and broadcast
  try {
    pushActivity(`Celestia Astra created role: ${parsed.roleName} (${parsed.roleKey}) · Level ${parsed.clearanceLevel}`);
    emitLiveAction(`Role created · ${parsed.roleKey}`, { module: 'role-permissions' });
  } catch {
    /* ignore */
  }

  const modList = (parsed.modules || [])
    .map((m) => {
      const cat = MODULE_CATALOG.find((c) => c.key === m);
      return `• **${cat?.label || m}** (\`${m}\`)`;
    })
    .join('\n');

  const message = [
    `✨ **Celestia Astra: Role Created Successfully**`,
    ``,
    `The new hospital role has been provisioned and registered in the RBAC matrix:`,
    `- **Role Name**: ${parsed.roleName}`,
    `- **Identifier Key**: \`${parsed.roleKey}\``,
    `- **Department**: ${parsed.department}`,
    `- **Category Group**: ${parsed.group}`,
    `- **Clearance**: Level ${parsed.clearanceLevel} Authorization`,
    ``,
    `**Authorized Workstation Modules (${parsed.modules?.length || 0}):**`,
    modList,
    ``,
    `🛡️ **Next Steps**:`,
    `1. You can immediately enrol staff members under this role in **Staff Enrolment & ID Cards**.`,
    `2. Any staff logging in with this role will automatically receive their tailored **${parsed.roleName} Desk** workstation.`,
    `3. You can fine-tune patient data scopes anytime in **Staff Access Control / Role Permissions Matrix**.`,
  ].join('\n');

  return { success: true, message };
}

/** Execute listing of custom roles */
export function executeListRolesAutomation(): string {
  const custom = getCustomRoles();
  const all = listConfigurableRoles();

  if (!custom.length) {
    return [
      `🏛️ **Hospital Role Catalog (Celestia Astra)**`,
      ``,
      `There are currently **${all.length}** preset hospital roles configured (Doctor, Surgeon, Nurse, Midwife, Pharmacist, Lab, Radiologist, Reception, Records, Accountant, Biomedical, Medical Director, SysAdmin).`,
      ``,
      `No custom roles have been created yet. You can create one anytime by saying:`,
      `*"Create role Dialysis Nurse with access to nursing, beds, icu, emr and clearance level 3 in Inpatient Wards"*`,
    ].join('\n');
  }

  const lines = custom.map((r, i) => {
    const map = getRolePermissionsMap();
    const mods = map[r.roleKey] || [];
    return `${i + 1}. **${r.label}** (\`${r.roleKey}\`)\n   - Department: ${r.department || 'Clinical Operations'} (${r.group || 'Custom'})\n   - Clearance: Level ${r.clearanceLevel}\n   - Modules (${mods.length}): ${mods.slice(0, 6).join(', ')}${mods.length > 6 ? '…' : ''}`;
  }).join('\n\n');

  return [
    `🏛️ **Custom Hospital Roles (${custom.length}) — Celestia Astra**`,
    ``,
    lines,
    ``,
    `To remove a role, say: *"Delete role [role_name]"*. To add another, say *"Create role [name]..."*.`,
  ].join('\n');
}

/** Execute deletion of a custom role */
export function executeDeleteRoleAutomation(roleKey: string): { success: boolean; message: string } {
  const roles = getCustomRoles();
  const hit = roles.find((r) => r.roleKey === roleKey || r.label.toLowerCase() === roleKey.toLowerCase());

  if (!hit) {
    return {
      success: false,
      message: `Custom role **"${roleKey}"** was not found in the custom role registry. Say *"List custom roles"* to see active roles.`,
    };
  }

  const ok = deleteCustomRole(hit.roleKey);
  if (!ok) {
    return { success: false, message: `Could not delete role ${hit.label}.` };
  }

  try {
    pushActivity(`Celestia Astra deleted custom role: ${hit.label} (${hit.roleKey})`);
    emitLiveAction(`Role deleted · ${hit.roleKey}`, { module: 'role-permissions' });
  } catch {
    /* ignore */
  }

  return {
    success: true,
    message: `🗑️ **Celestia Astra**: Custom role **${hit.label}** (\`${hit.roleKey}\`) has been deleted. Its permissions have been removed from the RBAC visibility matrix.`,
  };
}
