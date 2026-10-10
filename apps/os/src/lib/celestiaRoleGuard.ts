/**
 * Celestia role guard — assistant must not exceed the signed-in desk's authority.
 * Refuses out-of-scope actions and names who can handle them.
 */
import { getModulesForRole } from './rolePermissionsStore';

export type CelestiaSessionLike = {
  roleKey?: string;
  role?: string;
  name?: string;
  badgeId?: string;
  hospitalId?: string;
  facility?: string;
};

const ROLE_LABEL: Record<string, string> = {
  reception: 'Reception / Front Desk',
  records: 'Medical Records',
  doctor: 'Doctor',
  surgeon: 'Surgeon',
  nurse: 'Nurse',
  midwife: 'Midwife',
  pharmacist: 'Pharmacist',
  lab: 'Laboratory',
  radiologist: 'Radiologist',
  cashier: 'Cashier / Accounts',
  accountant: 'Accountant / Finance',
  hospital_admin: 'Hospital Administrator',
  admin: 'Administrator',
  medical_director: 'Medical Director',
  sysadmin: 'ICT / System Admin',
  biomedical: 'Biomedical Engineering',
};

/** Human-readable scope for system prompt */
export const ROLE_SCOPE_BLURB: Record<string, string> = {
  reception:
    'Front desk only: registration, check-in, queue, appointments, send invoices to Accounts. Do NOT prescribe, post payments as paid, change clinical orders, or enrol staff.',
  records: 'Records only: patient identity folders, demographics, flow. Do NOT clinical prescribe or finance posting.',
  doctor:
    'Clinical doctor desk: patients, notes, lab/Rx/radiology orders, results review. Do NOT enrol staff, change RBAC, or post cashier payments.',
  surgeon: 'Theatre / surgical desk: lists, OT, post-op. Do NOT general OPD admin finance or staff enrolment.',
  nurse: 'Nursing desk: beds, vitals, tasks, e-MAR support. Do NOT independent prescribing beyond nursing scope or finance.',
  midwife: 'Maternity desk: labour board, maternal–newborn flow. Do NOT hospital-wide admin or staff enrolment.',
  pharmacist: 'Pharmacy: pending Rx, dispense, stock. Do NOT full clinical diagnosis or front-desk registration.',
  lab: 'Laboratory: orders, results, TAT, critical values. Do NOT prescribe drugs or collect cash.',
  radiologist: 'Radiology: imaging studies and reports. Do NOT OPD registration or pharmacy dispense.',
  cashier: 'Accounts collection: take payment on queued invoices, receipts. Do NOT clinical charting or staff RBAC.',
  accountant: 'AR / finance desk: debtors, HMO claims, collections analytics. Do NOT clinical orders.',
  hospital_admin: 'Hospital administrator: staff, access, occupancy, revenue overview. Full operational assist allowed.',
  admin: 'Administrator: staff, access, system settings. Full operational assist allowed.',
  medical_director: 'Medical director: clinical governance and oversight. Prefer clinical and quality topics.',
  sysadmin: 'ICT: systems, access technical. Prefer technical support over clinical decisions.',
};

/** Map intent keywords → roles that own the work */
const INTENT_OWNERS: { test: RegExp; owners: string[]; label: string }[] = [
  {
    test: /\b(enrol|enroll|create\s+staff|bulk\s+enrol|id\s*card|badge\s*login|staff\s+access|rbac|role\s+visibility|allow\s+\w+\s+|deny\s+\w+\s+|set\s+role)\b/i,
    owners: ['hospital_admin', 'admin', 'sysadmin'],
    label: 'staff enrolment / access control / role permissions',
  },
  {
    test: /\b(prescribe|prescription|rx\s+order|drug\s+order|medication\s+order)\b/i,
    owners: ['doctor', 'surgeon', 'medical_director'],
    label: 'prescribing medicines',
  },
  {
    test: /\b(lab\s+order|order\s+lab|blood\s+test|specimen)\b/i,
    owners: ['doctor', 'surgeon', 'lab'],
    label: 'laboratory orders / processing',
  },
  {
    test: /\b(radiology|x-?ray|ct\s+scan|mri|imaging\s+order)\b/i,
    owners: ['doctor', 'surgeon', 'radiologist'],
    label: 'imaging orders / reporting',
  },
  {
    test: /\b(dispense|pharmacy\s+stock|formulary)\b/i,
    owners: ['pharmacist'],
    label: 'pharmacy dispense / stock',
  },
  {
    test: /\b(collect\s+payment|mark\s+paid|post\s+payment|record\s+payment|cashier)\b/i,
    owners: ['cashier', 'accountant'],
    label: 'collecting / posting payments',
  },
  {
    test: /\b(check-?in|queue|walk-?in|register\s+patient|appointment)\b/i,
    owners: ['reception', 'records'],
    label: 'front desk registration / queue',
  },
  {
    test: /\b(admit|discharge|transfer\s+patient|bed\s+assign)\b/i,
    owners: ['doctor', 'nurse', 'hospital_admin', 'admin'],
    label: 'admissions / beds',
  },
  {
    test: /\b(theatre|surgery\s+list|ot\s+schedule)\b/i,
    owners: ['surgeon', 'doctor', 'nurse'],
    label: 'theatre lists',
  },
  {
    test: /\b(hmo\s+claim|debtor|aging|ar\s+desk|remittance)\b/i,
    owners: ['accountant', 'cashier', 'hospital_admin'],
    label: 'claims / debtors / AR',
  },
];

export function normalizeRoleKey(session?: CelestiaSessionLike | null): string {
  return String(session?.roleKey || session?.role || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

export function roleDisplayName(roleKey: string): string {
  return ROLE_LABEL[roleKey] || roleKey || 'this desk';
}

export function isPrivilegedAdmin(roleKey: string): boolean {
  return roleKey === 'hospital_admin' || roleKey === 'admin' || roleKey === 'sysadmin';
}

export function canAutomateStaff(roleKey: string): boolean {
  return isPrivilegedAdmin(roleKey);
}

export function canChangeRoleVisibility(roleKey: string): boolean {
  return isPrivilegedAdmin(roleKey);
}

export function allowedModulesBlurb(roleKey: string): string {
  if (roleKey === 'hospital_admin' || roleKey === 'admin') return 'all hospital modules (admin)';
  try {
    const mods = getModulesForRole(roleKey);
    return mods.slice(0, 16).join(', ') + (mods.length > 16 ? '…' : '');
  } catch {
    return 'role-limited modules';
  }
}

/** If query asks for work outside this role, return a refusal message */
export function refuseIfOutOfRole(query: string, roleKey: string): string | null {
  if (isPrivilegedAdmin(roleKey)) return null;

  for (const row of INTENT_OWNERS) {
    if (!row.test.test(query)) continue;
    if (row.owners.includes(roleKey)) continue;
    // Special: lab can talk about lab orders status; doctor owns ordering
    if (row.label.includes('laboratory') && roleKey === 'lab' && !/\border\s+(a\s+)?(lab|blood)/i.test(query)) {
      continue;
    }
    const who = row.owners.map(roleDisplayName).join(' or ');
    return (
      `That is outside your **${roleDisplayName(roleKey)}** desk.\n\n` +
      `I can only help with work your role is authorised for. ` +
      `**${row.label}** should be handled by **${who}**.\n\n` +
      `Ask me something on your desk instead, or hand this to ${who}.`
    );
  }
  return null;
}

export function staffAutomationRefusal(roleKey: string): string {
  return (
    `Staff enrolment and ID cards are limited to **Hospital Administrator** (or ICT Admin).\n\n` +
    `You are signed in as **${roleDisplayName(roleKey)}**, so I cannot create or change staff accounts for you.\n` +
    `Ask an administrator to enrol the person under **Staff Enrolment & ID** or **Staff Access Control**.`
  );
}

export function roleVisibilityRefusal(roleKey: string): string {
  return (
    `Changing role permissions / module visibility is limited to **Hospital Administrator**.\n\n` +
    `You are **${roleDisplayName(roleKey)}** — I will not allow or deny modules for other roles from this desk.\n` +
    `Ask an administrator to open **Staff Access Control** or **Role Visibility**.`
  );
}

/** System instruction injected into Gemini for every Celestia reply */
export function buildCelestiaSystemPrompt(session?: CelestiaSessionLike | null): string {
  const rk = normalizeRoleKey(session);
  const scope = ROLE_SCOPE_BLURB[rk] || 'Stay within this user hospital desk responsibilities.';
  const name = session?.name || 'staff';
  const first = String(name).split(/\s+/)[0] || 'there';
  return [
    `You are Celestia, the in-app assistant inside MedCore Hospital OS (Nigerian public hospitals).`,
    `User: ${name} (use first name ${first} only when natural). Role: ${roleDisplayName(rk)} (${rk || 'unknown'}).`,
    `Desk scope: ${scope}`,
    `Modules they can use: ${allowedModulesBlurb(rk)}.`,
    ``,
    `CONVERSATION STYLE:`,
    `- Chat like a sharp hospital colleague — natural, warm, brief. Not a scripted bot.`,
    `- Do NOT re-introduce yourself ("Hello, I am Celestia…") on every message. Only a short greeting if they say hi/hello.`,
    `- Do NOT dump a full capability menu every turn. Answer what they asked; optionally one next step.`,
    `- For "ok", "thanks", "yes", "no" — reply in one short natural line, then wait.`,
    `- Match their energy: short in → short out. Plain language.`,
    ``,
    `HARD LIMITS (always):`,
    `1. Stay inside this role. If asked outside scope, refuse politely in 1–2 sentences and name which desk handles it (Front Desk, Doctor, Pharmacy, Accounts, Admin).`,
    `2. Never invent patient IDs, lab results, vitals, or payment status.`,
    `3. Never claim you enrolled staff, marked a bill paid, or prescribed unless admin automation truly ran in-product.`,
    `4. Prefer pointing to the right MedCore screen for their role.`,
    `5. No medical diagnosis beyond "see the clinician" style guidance.`,
    `6. Front Desk / Records: the product can automate register, folder fee → Accounts, check-in, queue list, assign doctor, book appointment, patient lookup. Do not only give UI instructions when automation can run. Keep follow-ups grounded in the last patient discussed.`,
  ].join('\n');
}
