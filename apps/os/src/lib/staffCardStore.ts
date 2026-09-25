/**
 * Staff ID cards — issued at enrolment, shared shape with Clinic app.
 * Browser: localStorage. Production: replace with API GET/POST /api/v1/staff/cards.
 */
import type { StaffCardRecord, StaffEnrolmentInput } from '@medcore/types';
import {
  STAFF_CARD_STORAGE_KEY,
  STAFF_REGISTRY_STORAGE_KEY,
  issueStaffCardFromEnrolment,
} from '@medcore/types';

function readCards(): StaffCardRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STAFF_CARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCards(cards: StaffCardRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STAFF_CARD_STORAGE_KEY, JSON.stringify(cards));
  // Broadcast so OS + browser Clinic tab can refresh
  try {
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: cards }));
  } catch {
    /* ignore */
  }
}

export function listStaffCards(): StaffCardRecord[] {
  return readCards();
}

export function getStaffCard(badgeId: string): StaffCardRecord | undefined {
  return readCards().find((c) => c.badgeId === badgeId);
}

/** Enrol staff: create registry row + issue ID card in one step */
export function enrolStaffAndIssueCard(
  input: StaffEnrolmentInput,
  badgeId?: string
): { card: StaffCardRecord; badgeId: string } {
  const id =
    badgeId ||
    `${input.facilityId.slice(0, 3).toUpperCase()}-${input.roleKey.slice(0, 3).toUpperCase()}-${Date.now()
      .toString(36)
      .slice(-4)
      .toUpperCase()}`;

  const card = issueStaffCardFromEnrolment(input, id);
  const cards = readCards().filter((c) => c.badgeId !== id);
  cards.unshift(card);
  writeCards(cards);

  // Mirror into staff registry used by AuthScreen
  try {
    const regRaw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
    const reg = regRaw ? JSON.parse(regRaw) : [];
    const entry = {
      id,
      badgeId: id,
      name: input.fullName,
      role: input.role,
      shortRole: input.shortRole || input.role,
      title: input.title,
      roleKey: input.roleKey,
      clearanceLevel: input.clearanceLevel,
      clearanceLabel: input.clearanceLabel,
      department: input.department,
      initials: card.initials,
      permissions: input.permissions || [],
      pin: input.pin || '1234',
      hospitalId: input.facilityId,
      hospitalName: input.facilityName,
      status: 'active',
    };
    const next = Array.isArray(reg)
      ? [entry, ...reg.filter((r: { id?: string; badgeId?: string }) => r.id !== id && r.badgeId !== id)]
      : [entry];
    localStorage.setItem(STAFF_REGISTRY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }

  return { card, badgeId: id };
}

export function setStaffCardStatus(
  badgeId: string,
  status: StaffCardRecord['status']
): StaffCardRecord | undefined {
  const cards = readCards();
  const idx = cards.findIndex((c) => c.badgeId === badgeId);
  if (idx < 0) return undefined;
  cards[idx] = { ...cards[idx], status };
  writeCards(cards);
  return cards[idx];
}

export function ensureCardForSession(session: {
  badgeId?: string;
  id?: string;
  name: string;
  role: string;
  roleKey: string;
  title: string;
  department: string;
  facility: string;
  hospitalId: string;
  clearanceLevel: number;
  clearanceLabel: string;
  avatarInitials: string;
}): StaffCardRecord {
  const badgeId = session.badgeId || session.id || 'UNKNOWN';
  const existing = getStaffCard(badgeId);
  if (existing) return existing;
  const { card } = enrolStaffAndIssueCard(
    {
      fullName: session.name,
      role: session.role,
      roleKey: session.roleKey,
      title: session.title,
      department: session.department,
      facilityId: session.hospitalId,
      facilityName: session.facility,
      clearanceLevel: session.clearanceLevel,
      clearanceLabel: session.clearanceLabel,
    },
    badgeId
  );
  return card;
}
