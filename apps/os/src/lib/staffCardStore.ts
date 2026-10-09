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
import { removeStaffPresence } from './staffPresenceStore';

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
  const ROLE_BADGE_SEG: Record<string, string> = {
    doctor: 'DOC', surgeon: 'SUR', nurse: 'NUR', midwife: 'MID', pharmacist: 'PHA',
    lab: 'LAB', radiologist: 'RAD', reception: 'REC', records: 'REO', accountant: 'ACC',
    hospital_admin: 'ADM', sysadmin: 'SYS', biomedical: 'BIO', medical_director: 'DIR',
  };
  const roleSeg = (ROLE_BADGE_SEG[input.roleKey] || (input.roleKey || 'STF').slice(0, 3)).toUpperCase();
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
      email: (input.email || '').trim().toLowerCase() || undefined,
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
    // CLOUD-FIRST staff directory + member doc (online peers need this before local-only login)
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



/** Find enrolled staff by work email (local registry) */
export function findStaffByEmail(email: string, facilityId?: string) {
  const mail = (email || '').trim().toLowerCase();
  if (!mail) return null;
  try {
    const keys = [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const hit = arr.find((r: any) => {
        const e = String(r.email || r.workEmail || '').toLowerCase();
        if (e !== mail) return false;
        if (facilityId) {
          const hid = String(r.hospitalId || r.facilityId || '').toUpperCase();
          if (hid && hid !== facilityId.toUpperCase()) return false;
        }
        return true;
      });
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return null;
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

    // Drop access control row so staffing / admin offline list cannot resurrect them
    try {
      const accessRaw = localStorage.getItem('medcore_os_access_control');
      const access = accessRaw ? JSON.parse(accessRaw) : [];
      if (Array.isArray(access)) {
        const filtered = access.filter(
          (r: { id?: string }) =>
            String(r.id || '').toUpperCase().replace(/\s+/g, '') !== id
        );
        localStorage.setItem('medcore_os_access_control', JSON.stringify(filtered));
        window.dispatchEvent(
          new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_access_control' } })
        );
      }
    } catch {
      /* ignore */
    }

    if (facilityId) {
      try {
        removeStaffPresence(id, facilityId);
      } catch {
        /* ignore */
      }
      void firestorePushStaffDirectory(facilityId, {
        staffCards: cards,
        staffRegistry: next,
      });
      void firestoreDeleteStaffMember(facilityId, id);
    } else {
      // Unknown facility — still clear local presence for all matching keys
      try {
        const mapRaw = localStorage.getItem('medcore_os_staff_presence_v1');
        const map = mapRaw ? JSON.parse(mapRaw) : {};
        if (map && typeof map === 'object') {
          for (const key of Object.keys(map)) {
            if (key.includes(id) || map[key]?.badgeId === id) delete map[key];
          }
          localStorage.setItem('medcore_os_staff_presence_v1', JSON.stringify(map));
          window.dispatchEvent(new CustomEvent('medcore-staff-presence', { detail: map }));
        }
      } catch {
        /* ignore */
      }
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
  if (
    s === 'doctor' || s === 'surgeon' || s === 'nurse' || s === 'midwife' ||
    s === 'pharmacist' || s === 'lab' || s === 'radiologist' || s === 'reception' ||
    s === 'records' || s === 'accountant' || s === 'sysadmin' || s === 'hospital_admin' ||
    s === 'biomedical' || s === 'medical_director'
  ) return s;

  // Badge segment is authoritative — stops reception badges becoming "doctor"
  const parts = String(badgeId || '').toUpperCase().split(/[-_/]/).filter(Boolean);
  const badgeMap: Record<string, string> = {
    DOC: 'doctor', SUR: 'surgeon', NUR: 'nurse', MID: 'midwife', PHA: 'pharmacist',
    LAB: 'lab', RAD: 'radiologist', REC: 'reception', RCPT: 'reception', FRO: 'reception',
    FRD: 'reception', DES: 'reception', FDK: 'reception', OPD: 'reception',
    REO: 'records', ACC: 'accountant', CAS: 'accountant', SYS: 'sysadmin', ICT: 'sysadmin',
    ADM: 'hospital_admin', HOS: 'hospital_admin', BIO: 'biomedical', DIR: 'medical_director',
    STF: 'records',
  };
  if (parts.length >= 1) {
    for (let i = parts.length - 2; i >= 0; i--) {
      if (badgeMap[parts[i]]) return badgeMap[parts[i]];
    }
    for (const p of parts) {
      if (badgeMap[p]) return badgeMap[p];
    }
  }

  // Reception BEFORE clinical keywords
  if (
    s.includes('reception') || s.includes('receptionist') || s.includes('front desk') ||
    s.includes('front-desk') || s.includes('frontdesk') || s.includes('front office') ||
    s.includes('desk officer') || s.includes('desk clerk') || s.includes('patient service') ||
    s.includes('patient liaison') || s.includes('appointment clerk') || s.includes('opd clerk') ||
    s.includes('outpatient clerk') || s.includes('registration') || s.includes('cashier desk')
  ) return 'reception';

  if (s.includes('surgeon')) return 'surgeon';
  if (s.includes('nurse')) return 'nurse';
  if (s.includes('midwife')) return 'midwife';
  if (s.includes('pharm')) return 'pharmacist';
  if (s.includes('lab') || s.includes('patholog') || s.includes('scientist')) return 'lab';
  if (s.includes('radio')) return 'radiologist';
  if (s.includes('record') || s.includes('health information')) return 'records';
  if (s.includes('account') || s.includes('finance') || s.includes('cashier') || s.includes('billing')) return 'accountant';
  if (s.includes('biomed')) return 'biomedical';
  if (s.includes('director') || s.includes('superintendent')) return 'medical_director';
  if (s.includes('hospital_admin') || (s.includes('administrator') && !s.includes('system'))) return 'hospital_admin';
  if (s.includes('sysadmin') || s.includes('ict') || s.includes('system admin')) return 'sysadmin';
  if (s.includes('doctor') || s.includes('medical officer') || s.includes('physician') || s.includes('clinician') || s.includes('consultant')) return 'doctor';
  // NEVER default to doctor (opened clinical desk for reception)
  return 'records';
}

/** True when this role should land on reception front-desk workspace */
export function isReceptionRole(roleKey?: string, role?: string, title?: string, badgeId?: string): boolean {
  return inferRoleKey(roleKey || role || title || '', badgeId) === 'reception';
}

export function defaultPermissionsForRole(roleKey: string): string[] {
  const map: Record<string, string[]> = {
    reception: [
      'dashboard', 'patient-flow', 'patient-card', 'appointments', 'cashier', 'billing',
      'desk-settings', 'notifications', 'my-card',
    ],
    doctor: [
      'dashboard', 'doctor-portal', 'patient-360', 'notifications', 'emr', 'pharmacy',
      'laboratory', 'radiology', 'emergency', 'beds', 'nursing', 'icu', 'theatre',
      'm87-ai', 'ai', 'patient-card', 'my-card',
    ],
    surgeon: [
      'dashboard', 'theatre', 'doctor-portal', 'notifications', 'icu', 'beds', 'blood-bank',
      'emergency', 'laboratory', 'radiology', 'emr', 'm87-ai', 'ai', 'patient-card', 'my-card',
    ],
    nurse: [
      'dashboard', 'nursing', 'beds', 'notifications', 'patient-flow', 'emergency', 'pharmacy',
      'blood-bank', 'maternity', 'paediatrics', 'icu', 'm87-ai', 'ai', 'patient-card', 'my-card', 'emr',
    ],
    midwife: [
      'dashboard', 'maternity', 'paediatrics', 'notifications', 'beds', 'nursing', 'emergency',
      'blood-bank', 'pharmacy', 'm87-ai', 'ai', 'patient-card', 'my-card', 'emr',
    ],
    pharmacist: [
      'dashboard', 'pharmacy', 'formulary', 'notifications', 'cashier', 'emr', 'patient-flow',
      'inventory', 'm87-ai', 'ai', 'patient-card', 'my-card',
    ],
    lab: [
      'dashboard', 'laboratory', 'lab', 'notifications', 'blood-bank', 'emr', 'patient-card',
      'my-card', 'm87-ai', 'ai',
    ],
    radiologist: [
      'dashboard', 'radiology', 'notifications', 'emr', 'patient-card', 'my-card', 'm87-ai', 'ai',
    ],
    records: ['dashboard', 'patient-card', 'patient-flow', 'beds', 'emr', 'my-card', 'notifications'],
    accountant: [
      'dashboard', 'cashier', 'billing', 'claims', 'revenue-cycle', 'procurement', 'patient-card',
      'analytics', 'my-card', 'notifications',
    ],
    biomedical: [
      'dashboard', 'biomedical', 'iot-devices', 'facilities', 'environmental', 'inventory',
      'my-card', 'notifications',
    ],
    medical_director: [
      'dashboard', 'command', 'doctor-portal', 'm87-ai', 'ai', 'analytics', 'emergency', 'theatre',
      'icu', 'pharmacy', 'laboratory', 'radiology', 'blood-bank', 'beds', 'nursing', 'notifications',
      'my-card',
    ],
    hospital_admin: [
      'dashboard', 'command', 'emr', 'beds', 'patient-flow', 'staffing', 'enrolment', 'my-card',
      'cashier', 'rbac', 'sysadmin', 'ai', 'm87-ai', 'notifications',
    ],
    sysadmin: [
      'dashboard', 'staffing', 'analytics', 'ai', 'm87-ai', 'sysadmin', 'rbac', 'enrolment',
      'facility', 'auth', 'my-card', 'notifications',
    ],
  };
  return map[roleKey] || ['dashboard', 'my-card'];
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
          permissions: (hit.permissions && hit.permissions.length > 1)
            ? hit.permissions
            : defaultPermissionsForRole(inferRoleKey(hit.roleKey || hit.role, hit.badgeId || hit.id)),
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
        permissions: defaultPermissionsForRole(inferRoleKey(card.roleKey || card.role, card.badgeId)),
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


/** Remove all non-admin staff for a facility (local cards + registry). Returns removed badge IDs. */
export function purgeNonAdminStaffForFacility(facilityId: string): string[] {
  const fid = String(facilityId || '').toUpperCase();
  if (!fid || typeof window === 'undefined') return [];
  const removed: string[] = [];
  const isAdmin = (roleKey?: string, badge?: string, role?: string) => {
    const rk = String(roleKey || '').toLowerCase();
    const b = String(badge || '').toUpperCase();
    const r = String(role || '').toLowerCase();
    return (
      rk === 'hospital_admin' ||
      rk === 'sysadmin' ||
      b.includes('-ADM-') ||
      b === 'AKS-ADM-001' ||
      (r.includes('administrator') && !r.includes('system'))
    );
  };
  try {
    const cards = readCards();
    const keptCards = cards.filter((c) => {
      const sameFac = String(c.facilityId || '').toUpperCase() === fid;
      if (!sameFac) return true;
      if (isAdmin(c.roleKey, c.badgeId, c.role)) return true;
      removed.push(c.badgeId);
      return false;
    });
    writeCards(keptCards);

    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry', 'medcore_staff_registry']) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const reg = JSON.parse(raw);
        if (!Array.isArray(reg)) continue;
        const next = reg.filter((r: any) => {
          const hid = String(r.hospitalId || r.facilityId || '').toUpperCase();
          if (hid && hid !== fid) return true;
          const badge = String(r.badgeId || r.id || '');
          if (isAdmin(r.roleKey, badge, r.role)) return true;
          if (!removed.includes(badge)) removed.push(badge);
          return false;
        });
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* ignore */ }
    }
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated'));
    window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated'));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_staff_registry' } }));
  } catch {
    /* ignore */
  }
  return removed;
}
