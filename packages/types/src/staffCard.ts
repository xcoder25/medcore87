/**
 * Shared Staff ID Card — issued at enrolment, used by OS + Clinic staff app.
 * Auth identity (badgeId) is the same key on both clients.
 */

export type StaffCardTemplate =
  | 'TPL_CLINICAL'
  | 'TPL_CONSULTANT'
  | 'TPL_EXEC'
  | 'TPL_SUPPORT'
  | 'TPL_ICT'
  | 'TPL_VISITOR';

export type StaffCardStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

export interface StaffCardRecord {
  badgeId: string;
  fullName: string;
  role: string;
  roleKey: string;
  title: string;
  department: string;
  facilityId: string;
  facilityName: string;
  clearanceLevel: number;
  clearanceLabel: string;
  templateKey: StaffCardTemplate;
  status: StaffCardStatus;
  issuedAt: string;
  expiresAt: string;
  photoUrl?: string;
  initials: string;
  /** QR payload string (JSON) — verified by auth later */
  qrPayload: string;
}

export interface StaffEnrolmentInput {
  fullName: string;
  role: string;
  roleKey: string;
  title: string;
  department: string;
  facilityId: string;
  facilityName: string;
  clearanceLevel: number;
  clearanceLabel: string;
  pin?: string;
  shortRole?: string;
  permissions?: string[];
}

/** Pick visual template from role / clearance */
export function resolveStaffCardTemplate(
  roleKey: string,
  clearanceLevel: number
): StaffCardTemplate {
  if (roleKey === 'sysadmin' || roleKey === 'ict') return 'TPL_ICT';
  if (clearanceLevel >= 6) return 'TPL_EXEC';
  if (
    roleKey === 'hospital_admin' ||
    roleKey === 'admin' ||
    roleKey === 'accountant'
  ) {
    return clearanceLevel >= 5 ? 'TPL_EXEC' : 'TPL_SUPPORT';
  }
  if (
    roleKey === 'surgeon' ||
    roleKey === 'radiologist' ||
    clearanceLevel >= 5
  ) {
    return 'TPL_CONSULTANT';
  }
  if (
    roleKey === 'records' ||
    roleKey === 'cashier' ||
    roleKey === 'reception' ||
    clearanceLevel <= 2
  ) {
    return 'TPL_SUPPORT';
  }
  return 'TPL_CLINICAL';
}

export function buildStaffQrPayload(card: Omit<StaffCardRecord, 'qrPayload'>): string {
  return JSON.stringify({
    v: 1,
    iss: 'medcore',
    badgeId: card.badgeId,
    facilityId: card.facilityId,
    clr: card.clearanceLevel,
    exp: card.expiresAt,
  });
}

export function issueStaffCardFromEnrolment(
  input: StaffEnrolmentInput,
  badgeId: string
): StaffCardRecord {
  const issuedAt = new Date().toISOString();
  const exp = new Date();
  exp.setFullYear(exp.getFullYear() + 2);
  const expiresAt = exp.toISOString().slice(0, 10);
  const parts = input.fullName.trim().split(/\s+/);
  const initials = parts
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const base = {
    badgeId,
    fullName: input.fullName.trim(),
    role: input.role,
    roleKey: input.roleKey,
    title: input.title,
    department: input.department,
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    clearanceLevel: input.clearanceLevel,
    clearanceLabel: input.clearanceLabel,
    templateKey: resolveStaffCardTemplate(input.roleKey, input.clearanceLevel),
    status: 'ACTIVE' as StaffCardStatus,
    issuedAt,
    expiresAt,
    initials,
  };

  return {
    ...base,
    qrPayload: buildStaffQrPayload(base),
  };
}

export const STAFF_CARD_STORAGE_KEY = 'medcore_staff_id_cards';
export const STAFF_REGISTRY_STORAGE_KEY = 'medcore_os_staff_registry';
