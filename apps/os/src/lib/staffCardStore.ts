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
import { firestorePushStaffDirectory, firestoreUpsertStaffMember, firestoreDeleteStaffMember } from './firebase';

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
  // Facility-owned prefix: full facilityId (e.g. IGH-EKT-ADM-001) so every hospital has its own ID space
  const facilityPrefix = (input.facilityId || 'FAC').trim().toUpperCase().replace(/\s+/g, '');
  const roleSeg = (input.roleKey || 'STF').slice(0, 3).toUpperCase();
  const id = (
    badgeId ||
    `${facilityPrefix}-${roleSeg}-${Date.now().toString(36).slice(-4).toUpperCase()}`
  ).trim().toUpperCase();

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
    try {
      localStorage.setItem('medcore_os_staff_registry', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_staff_registry' } }));
      window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated', { detail: next }));
      window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: cards }));
    } catch {
      /* ignore */
    }
    // Realtime Firebase (facility shared store) — non-blocking
    void firestorePushStaffDirectory(input.facilityId, {
      staffCards: cards,
      staffRegistry: next,
    });
    void firestoreUpsertStaffMember(input.facilityId, entry);
  } catch {
    /* ignore */
  }

  return { card, badgeId: id };
}


/** Admin: permanently remove staff from cards, registry, and cloud */
export function deleteStaffMember(badgeId: string): boolean {
  const id = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
  if (!id) return false;

  let facilityId = '';
  try {
    const cards = readCards().filter((c) => {
      if (c.badgeId.toUpperCase().replace(/\s+/g, '') === id) {
        facilityId = c.facilityId || facilityId;
        return false;
      }
      return true;
    });
    writeCards(cards);

    const regRaw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
    const reg = regRaw ? JSON.parse(regRaw) : [];
    const next = Array.isArray(reg)
      ? reg.filter(
          (r: { badgeId?: string; id?: string; hospitalId?: string; facilityId?: string }) => {
            const b = String(r.badgeId || r.id || '').toUpperCase().replace(/\s+/g, '');
            if (b === id) {
              facilityId = r.hospitalId || r.facilityId || facilityId;
              return false;
            }
            return true;
          }
        )
      : [];
    localStorage.setItem(STAFF_REGISTRY_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem('medcore_os_staff_registry', JSON.stringify(next));

    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_staff_registry' } }));
    window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: cards }));

    if (facilityId) {
      void firestorePushStaffDirectory(facilityId, {
        staffCards: cards,
        staffRegistry: next,
      });
      void firestoreDeleteStaffMember(facilityId, id);
    }
    return true;
  } catch (e) {
    console.warn('[staff] delete failed', e);
    return false;
  }
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

/** Map role labels / badge middle segment → canonical roleKey */
export function inferRoleKey(raw?: string, badgeId?: string): string {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'doctor' || s === 'surgeon' || s === 'nurse' || s === 'midwife' ||
      s === 'pharmacist' || s === 'lab' || s === 'radiologist' || s === 'reception' ||
      s === 'records' || s === 'accountant' || s === 'sysadmin' || s === 'hospital_admin' ||
      s === 'biomedical' || s === 'medical_director') return s;
  if (s.includes('surgeon')) return 'surgeon';
  if (s.includes('nurse')) return 'nurse';
  if (s.includes('midwife')) return 'midwife';
  if (s.includes('pharm')) return 'pharmacist';
  if (s.includes('lab')) return 'lab';
  if (s.includes('radio')) return 'radiologist';
  if (s.includes('reception') || s.includes('front desk')) return 'reception';
  if (s.includes('record')) return 'records';
  if (s.includes('account') || s.includes('finance') || s.includes('cashier')) return 'accountant';
  if (s.includes('biomed')) return 'biomedical';
  if (s.includes('director') || s.includes('superintendent')) return 'medical_director';
  if (s.includes('hospital_admin') || (s.includes('administrator') && !s.includes('system'))) return 'hospital_admin';
  if (s.includes('sysadmin') || s.includes('ict') || s.includes('system admin')) return 'sysadmin';
  if (s.includes('doctor') || s.includes('medical officer') || s.includes('physician') || s.includes('clinician')) return 'doctor';
  // Badge pattern: IGH-REC-XXXX → middle token
  const parts = String(badgeId || '').toUpperCase().split('-');
  if (parts.length >= 2) {
    const mid = parts[1];
    const map: Record<string, string> = {
      DOC: 'doctor', SUR: 'surgeon', NUR: 'nurse', MID: 'midwife', PHA: 'pharmacist',
      LAB: 'lab', RAD: 'radiologist', REC: 'reception', REO: 'records', ACC: 'accountant',
      SYS: 'sysadmin', ADM: 'hospital_admin', BIO: 'biomedical', DIR: 'medical_director',
    };
    if (map[mid]) return map[mid];
  }
  return 'doctor';
}

/** Normalize badge for comparison */
export function normalizeBadgeId(badgeId: string): string {
  return String(badgeId || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Find staff profile by badge from all local stores (registry, cards, access).
 * Used by AuthScreen so generated IDs always resolve on the same browser.
 */
export function resolveStaffByBadge(badgeId: string): {
  badgeId: string;
  name: string;
  role: string;
  roleKey: string;
  title: string;
  department: string;
  clearanceLevel: number;
  clearanceLabel: string;
  initials: string;
  permissions: string[];
  pin: string;
  hospitalId: string;
  hospitalName: string;
} | null {
  const q = normalizeBadgeId(badgeId);
  if (!q || typeof window === 'undefined') return null;

  const match = (b: string) => normalizeBadgeId(b) === q;

  // 1) Staff registry
  try {
    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry']) {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) continue;
      const hit = arr.find((r: any) => match(String(r.badgeId || r.id || '')));
      if (hit) {
        return {
          badgeId: normalizeBadgeId(hit.badgeId || hit.id),
          name: hit.name || hit.fullName || 'Staff',
          role: hit.role || 'Staff',
          roleKey: inferRoleKey(hit.roleKey || hit.role, hit.badgeId || hit.id),
          title: hit.title || hit.role || 'Staff',
          department: hit.department || '',
          clearanceLevel: hit.clearanceLevel ?? 2,
          clearanceLabel: hit.clearanceLabel || 'L2',
          initials: hit.initials || 'ST',
          permissions: hit.permissions || ['dashboard'],
          pin: String(hit.pin || '123456'),
          hospitalId: hit.hospitalId || hit.facilityId || '',
          hospitalName: hit.hospitalName || hit.facilityName || '',
        };
      }
    }
  } catch { /* ignore */ }

  // 2) ID cards + pin from registry if needed
  try {
    const cards = listStaffCards();
    const card = cards.find((c) => match(c.badgeId));
    if (card) {
      let pin = '123456';
      try {
        const raw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        const hit = Array.isArray(arr)
          ? arr.find((r: any) => match(String(r.badgeId || r.id || '')))
          : null;
        if (hit?.pin) pin = String(hit.pin);
      } catch { /* ignore */ }
      return {
        badgeId: normalizeBadgeId(card.badgeId),
        name: card.fullName,
        role: card.role,
        roleKey: inferRoleKey(card.roleKey || card.role, card.badgeId),
        title: card.title,
        department: card.department,
        clearanceLevel: card.clearanceLevel,
        clearanceLabel: card.clearanceLabel,
        initials: card.initials,
        permissions: ['dashboard'],
        pin,
        hospitalId: card.facilityId,
        hospitalName: card.facilityName,
      };
    }
  } catch { /* ignore */ }

  // 3) Access control list (no PIN — caller may still use Firebase)
  try {
    const raw = localStorage.getItem('medcore_os_access_control');
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      const hit = arr.find((r: any) => match(String(r.id || '')));
      if (hit) {
        return {
          badgeId: normalizeBadgeId(hit.id),
          name: hit.name || 'Staff',
          role: hit.role || 'Staff',
          roleKey: inferRoleKey(hit.role, hit.id),
          title: hit.role || 'Staff',
          department: hit.department || '',
          clearanceLevel: hit.clearance ?? 2,
          clearanceLabel: `L${hit.clearance ?? 2}`,
          initials: String(hit.name || 'ST').split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
          permissions: hit.permissions || ['dashboard'],
          pin: '', // unknown — require Firebase or re-enrol
          hospitalId: '',
          hospitalName: '',
        };
      }
    }
  } catch { /* ignore */ }

  return null;
}


// ─── Facility admin auto-provisioning ───────────────────────────────────────

/** True if this facility already has at least one hospital_admin */
export function hasFacilityAdmin(facilityId: string): boolean {
  const fid = String(facilityId || '').toUpperCase();
  if (!fid || typeof window === 'undefined') return false;

  const cards = listStaffCards();
  if (cards.some((c) => String(c.facilityId || '').toUpperCase() === fid && c.roleKey === 'hospital_admin')) {
    return true;
  }

  try {
    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry']) {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) continue;
      if (arr.some((r: any) => {
        const hid = String(r.hospitalId || r.facilityId || '').toUpperCase();
        const rk = String(r.roleKey || '').toLowerCase();
        return hid === fid && (rk === 'hospital_admin' || rk === 'admin');
      })) return true;
    }
  } catch { /* ignore */ }

  return false;
}

/** True if facility has zero enrolled staff (cards or registry) */
export function isFacilityEmpty(facilityId: string): boolean {
  const fid = String(facilityId || '').toUpperCase();
  if (!fid || typeof window === 'undefined') return true;

  const cards = listStaffCards();
  if (cards.some((c) => String(c.facilityId || '').toUpperCase() === fid)) return false;

  try {
    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry']) {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) continue;
      if (arr.some((r: any) => String(r.hospitalId || r.facilityId || '').toUpperCase() === fid)) {
        return false;
      }
    }
  } catch { /* ignore */ }

  return true;
}

export type ProvisionFacilityAdminResult = {
  ok: boolean;
  badgeId?: string;
  pin?: string;
  profile?: ReturnType<typeof resolveStaffByBadge>;
  error?: string;
  created?: boolean;
};

/**
 * Auto-provision a facility-scoped Hospital Administrator on first login
 * to an empty facility. Badge uses the facility's own prefix, e.g. IGH-EKT-ADM-001.
 * After this, that admin manages all further staff creation for the facility.
 */
export function provisionFacilityAdmin(
  facility: { id: string; name: string },
  opts?: { pin?: string; fullName?: string }
): ProvisionFacilityAdminResult {
  const facilityId = String(facility.id || '').trim();
  const facilityName = String(facility.name || facilityId).trim();
  if (!facilityId) return { ok: false, error: 'Missing facility id' };

  if (hasFacilityAdmin(facilityId)) {
    // Already has an admin — do not create another
    const existing = listStaffCards().find(
      (c) => c.facilityId === facilityId && c.roleKey === 'hospital_admin'
    );
    if (existing) {
      const profile = resolveStaffByBadge(existing.badgeId);
      return {
        ok: true,
        badgeId: existing.badgeId,
        pin: profile?.pin,
        profile: profile || undefined,
        created: false,
      };
    }
    return { ok: false, error: 'Facility already has an administrator.' };
  }

  const pin = (opts?.pin || 'AKS-0012442').trim();
  const fullName = (opts?.fullName || 'Hospital Administrator').trim();
  // Deterministic first admin badge: {facilityId}-ADM-001
  const badgeId = `${facilityId.toUpperCase()}-ADM-001`;

  try {
    const { card } = enrolStaffAndIssueCard(
      {
        fullName,
        role: 'Hospital Administrator',
        roleKey: 'hospital_admin',
        title: 'Hospital Administrator',
        department: 'Hospital Management',
        facilityId,
        facilityName,
        clearanceLevel: 5,
        clearanceLabel: 'Administrator',
        pin,
        shortRole: 'Admin',
        permissions: [
          'dashboard', 'command', 'emr', 'beds', 'patient-flow', 'staffing',
          'enrolment', 'my-card', 'cashier', 'patient-card', 'auth', 'facility',
          'data-hub', 'analytics', 'rbac', 'sysadmin', 'compliance', 'transfer', 'ai',
        ],
      },
      badgeId
    );

    const profile = resolveStaffByBadge(card.badgeId);
    return {
      ok: true,
      badgeId: card.badgeId,
      pin,
      profile: profile || undefined,
      created: true,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to provision facility admin' };
  }
}
