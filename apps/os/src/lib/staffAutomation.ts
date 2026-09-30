/**
 * M87 / admin automation — create staff accounts + ID cards (single or bulk).
 */
import { enrolStaffAndIssueCard, listStaffCards } from './staffCardStore';
import {
  firebaseEnsureBadgeAccount,
  firestoreUpsertStaffMember,
  firestorePushStaffDirectory,
  badgeAuthEmail,
  normalizeStaffPin,
} from './firebase';
import { getAccessRecords, setAccessRecords, pushActivity, type AccessRecord } from './adminRealtimeStore';
import type { StaffCardRecord } from '@medcore/types';

export type RoleSpec = {
  roleKey: string;
  role: string;
  title: string;
  shortRole: string;
  clearanceLevel: number;
  clearanceLabel: string;
  department: string;
};

export const AUTOMATION_ROLES: RoleSpec[] = [
  { roleKey: 'doctor', role: 'Medical Officer', title: 'Medical Officer', shortRole: 'Doctor', clearanceLevel: 4, clearanceLabel: 'L4 Clinical', department: 'Internal Medicine' },
  { roleKey: 'nurse', role: 'Nursing Officer', title: 'Senior Nursing Officer', shortRole: 'Nurse', clearanceLevel: 3, clearanceLabel: 'L3 Nursing', department: 'Inpatient Wards' },
  { roleKey: 'surgeon', role: 'Consultant Surgeon', title: 'Consultant Surgeon', shortRole: 'Surgeon', clearanceLevel: 5, clearanceLabel: 'L5 Consultant', department: 'Surgery & Theatre' },
  { roleKey: 'pharmacist', role: 'Pharmacist', title: 'Pharmacist', shortRole: 'Pharmacist', clearanceLevel: 3, clearanceLabel: 'L3 Pharmacy', department: 'Pharmacy' },
  { roleKey: 'lab', role: 'Lab Scientist', title: 'Lab Scientist', shortRole: 'Lab', clearanceLevel: 3, clearanceLabel: 'L3 Lab', department: 'Pathology' },
  { roleKey: 'radiologist', role: 'Radiologist', title: 'Consultant Radiologist', shortRole: 'Radiology', clearanceLevel: 5, clearanceLabel: 'L5 Radiology', department: 'Radiology' },
  { roleKey: 'records', role: 'Records Officer', title: 'Health Records Officer', shortRole: 'Records', clearanceLevel: 2, clearanceLabel: 'L2 Records', department: 'Medical Records' },
  { roleKey: 'accountant', role: 'Finance Officer', title: 'Finance Officer', shortRole: 'Accounts', clearanceLevel: 3, clearanceLabel: 'L3 Finance', department: 'Billing & Finance' },
  { roleKey: 'reception', role: 'Reception / Front Desk', title: 'Reception Officer', shortRole: 'Reception', clearanceLevel: 2, clearanceLabel: 'L2 Front Desk', department: 'Patient Reception' },
  { roleKey: 'sysadmin', role: 'ICT / System Admin', title: 'System Administrator', shortRole: 'SysAdmin', clearanceLevel: 6, clearanceLabel: 'L6 SysAdmin', department: 'ICT' },
];

export function resolveRoleFromText(text: string): RoleSpec {
  const t = text.toLowerCase();
  const hit = AUTOMATION_ROLES.find(
    (r) =>
      t.includes(r.roleKey) ||
      t.includes(r.shortRole.toLowerCase()) ||
      t.includes(r.role.toLowerCase())
  );
  return hit || AUTOMATION_ROLES.find((r) => r.roleKey === 'nurse')!;
}

export type CreateStaffInput = {
  fullName: string;
  roleKey?: string;
  pin?: string;
  facilityId: string;
  facilityName: string;
};

export type CreateStaffResult = {
  ok: boolean;
  badgeId?: string;
  card?: StaffCardRecord;
  error?: string;
};

export async function createStaffAccountWithCard(
  input: CreateStaffInput
): Promise<CreateStaffResult> {
  const role =
    AUTOMATION_ROLES.find((r) => r.roleKey === input.roleKey) ||
    resolveRoleFromText(input.roleKey || input.fullName);
  const pinNorm = normalizeStaffPin(input.pin || '123456');

  if (role.roleKey === 'hospital_admin') {
    const existing = listStaffCards().filter(
      (c) => c.facilityId === input.facilityId && c.roleKey === 'hospital_admin'
    );
    if (existing.length > 0) {
      return { ok: false, error: 'Hospital already has an administrator.' };
    }
  }

  try {
    const { card } = enrolStaffAndIssueCard({
      fullName: input.fullName.trim(),
      role: role.role,
      roleKey: role.roleKey,
      title: role.title,
      department: role.department,
      facilityId: input.facilityId,
      facilityName: input.facilityName,
      clearanceLevel: role.clearanceLevel,
      clearanceLabel: role.clearanceLabel,
      pin: pinNorm,
      shortRole: role.shortRole,
      permissions: ['dashboard'],
    });

    try {
      await firebaseEnsureBadgeAccount(card.badgeId, pinNorm);
    } catch {
      /* Auth may fail if provider off — card still issued */
    }

    const accessRow: AccessRecord = {
      id: card.badgeId,
      name: input.fullName.trim(),
      role: role.role,
      department: role.department,
      clearance: role.clearanceLevel,
      status: 'active',
      lastLogin: 'Never',
      permissions: ['dashboard', role.roleKey],
    };
    setAccessRecords([accessRow, ...getAccessRecords().filter((r) => r.id !== card.badgeId)]);

    try {
      await firestoreUpsertStaffMember(input.facilityId, {
        badgeId: card.badgeId,
        name: input.fullName.trim(),
        role: role.role,
        roleKey: role.roleKey,
        title: role.title,
        department: role.department,
        pin: pinNorm,
        authEmail: badgeAuthEmail(card.badgeId),
        hospitalId: input.facilityId,
        hospitalName: input.facilityName,
        clearanceLevel: role.clearanceLevel,
        clearanceLabel: role.clearanceLabel,
        permissions: accessRow.permissions,
        status: 'active',
      });
      await firestorePushStaffDirectory(input.facilityId, {
        staffCards: listStaffCards(),
        staffRegistry: JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]'),
      });
    } catch {
      /* offline ok */
    }

    pushActivity(`M87 auto-enrol · ${input.fullName.trim()} · ${card.badgeId}`);
    return { ok: true, badgeId: card.badgeId, card };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message || 'Enrol failed' };
  }
}

export async function bulkCreateStaff(
  people: CreateStaffInput[]
): Promise<{ created: CreateStaffResult[]; summary: string }> {
  const created: CreateStaffResult[] = [];
  for (const p of people) {
    // sequential to avoid badge id collisions on same ms
    // eslint-disable-next-line no-await-in-loop
    const r = await createStaffAccountWithCard(p);
    created.push(r);
    await new Promise((res) => setTimeout(res, 30));
  }
  const ok = created.filter((c) => c.ok).length;
  const fail = created.length - ok;
  const lines = created
    .filter((c) => c.ok)
    .map((c) => `• ${c.card?.fullName || 'Staff'} → ${c.badgeId}`)
    .join('\n');
  const summary = `M87 bulk enrol complete: ${ok} created${fail ? `, ${fail} failed` : ''}.\n${lines}`;
  return { created, summary };
}

/** Parse natural language into staff create jobs */
export function parseStaffAutomationIntent(
  query: string,
  facilityId: string,
  facilityName: string
): { handled: boolean; jobs: CreateStaffInput[]; replyIfEmpty?: string } {
  const q = query.trim();
  const lower = q.toLowerCase();

  const isStaffCmd =
    /\b(enrol|enroll|create|add|register|onboard|bulk)\b/.test(lower) &&
    /\b(staff|nurse|doctor|reception|pharmacist|lab|account|surgeon|radiolog|sysadmin|officer|employee|workers?)\b/.test(
      lower
    );

  if (!isStaffCmd) {
    return { handled: false, jobs: [] };
  }

  // bulk: Name Role, Name Role | or lines
  const bulkMatch = q.match(/bulk\s*(?:enrol|enroll|create|add)?\s*:?\s*([\s\S]+)/i);
  if (bulkMatch) {
    const body = bulkMatch[1];
    const parts = body.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    const jobs: CreateStaffInput[] = parts.map((part) => {
      const role = resolveRoleFromText(part);
      // remove role words from name
      let name = part
        .replace(new RegExp(role.roleKey, 'ig'), '')
        .replace(new RegExp(role.shortRole, 'ig'), '')
        .replace(new RegExp(role.role, 'ig'), '')
        .replace(/\b(pin\s*\d+)\b/ig, '')
        .replace(/[,:-]+/g, ' ')
        .trim();
      if (!name || name.length < 2) name = `${role.shortRole} Staff`;
      const pinM = part.match(/pin\s*[:=]?\s*(\d{4,12})/i);
      return {
        fullName: name,
        roleKey: role.roleKey,
        pin: pinM?.[1] || '123456',
        facilityId,
        facilityName,
      };
    });
    return { handled: true, jobs };
  }

  // create N nurses
  const countMatch = lower.match(
    /(?:create|add|enrol|enroll|register)\s+(\d{1,2})\s+(nurses?|doctors?|receptionists?|pharmacists?|lab\s*scientists?|staff)/
  );
  if (countMatch) {
    const n = Math.min(20, parseInt(countMatch[1], 10) || 1);
    const role = resolveRoleFromText(countMatch[2]);
    const jobs: CreateStaffInput[] = Array.from({ length: n }, (_, i) => ({
      fullName: `${role.shortRole} ${String.fromCharCode(65 + (i % 26))}${i + 1}`,
      roleKey: role.roleKey,
      pin: '123456',
      facilityId,
      facilityName,
    }));
    return { handled: true, jobs };
  }

  // enrol doctor Jane Doe pin 123456
  const single = q.match(
    /(?:enrol|enroll|create|add|register)\s+(?:a\s+)?(?:staff\s+)?(.+?)(?:\s+pin\s*[:=]?\s*(\d{4,12}))?\s*$/i
  );
  if (single) {
    const rest = single[1].trim();
    const role = resolveRoleFromText(rest);
    let name = rest
      .replace(new RegExp(role.roleKey, 'ig'), '')
      .replace(new RegExp(role.shortRole, 'ig'), '')
      .replace(/\b(named?|called)\b/ig, '')
      .trim();
    if (!name) name = rest;
    return {
      handled: true,
      jobs: [
        {
          fullName: name,
          roleKey: role.roleKey,
          pin: single[2] || '123456',
          facilityId,
          facilityName,
        },
      ],
    };
  }

  return {
    handled: true,
    jobs: [],
    replyIfEmpty:
      'To enrol staff say e.g. “enrol nurse Ada Okon pin 123456” or “bulk enrol: Ada nurse; Emeka doctor; Chioma reception” or “create 5 nurses”.',
  };
}
