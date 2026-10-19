/**
 * Staff ID cards — issued at enrolment, shared shape with Clinic app.
 * Browser: localStorage. Production: replace with API GET/POST /api/v1/staff/cards.
 */
import type { StaffCardRecord, StaffEnrolmentInput } from '@medcore/types';
import {
  STAFF_CARD_STORAGE_KEY,
  STAFF_REGISTRY_STORAGE_KEY,
  issueStaffCardFromEnrolment,
  buildStaffQrPayload,
} from '@medcore/types';
import {
  firestorePushStaffDirectory,
  firestoreUpsertStaffMember,
  firestoreDeleteStaffMember,
  deleteStaffFirebaseAuth,
  firestoreRevokeStaff,
} from './firebase';
import { removeStaffPresence, markStaffRevokedLocal } from './staffPresenceStore';

let _migrationRan = false;

/**
 * Migration: updates any staff IDs created before with the new format AMC-YYYY-####.
 * Specifically updates both earlier-created staff (Hospital Admin and Kelly) and any
 * legacy IDs stored in cards, staff registry, or access control.
 */
export function migrateStaffIdsToNewFormat(): { migratedCount: number; mapping: Record<string, string> } {
  if (typeof window === 'undefined') return { migratedCount: 0, mapping: {} };

  const mapping: Record<string, string> = {};
  const year = new Date().getFullYear();
  let nextSeq = 1001;

  try {
    const rawCards = localStorage.getItem(STAFF_CARD_STORAGE_KEY);
    let cards: any[] = rawCards ? JSON.parse(rawCards) : [];
    if (!Array.isArray(cards)) cards = [];

    for (const c of cards) {
      const bid = String(c?.badgeId || '').toUpperCase();
      if (bid.startsWith(`AMC-${year}-`)) {
        const n = parseInt(bid.slice(`AMC-${year}-`.length), 10);
        if (!isNaN(n) && n >= nextSeq) nextSeq = n + 1;
      }
    }

    let changed = false;

    const getNewIdFor = (oldId: string, roleKey?: string, name?: string) => {
      const normOld = String(oldId || '').trim().toUpperCase();
      if (!normOld) return '';
      if (/^AMC-\d{4}-\d{4}$/i.test(normOld)) return normOld;
      if (mapping[normOld]) return mapping[normOld];

      const n = String(name || '').toLowerCase();
      const rk = String(roleKey || '').toLowerCase();
      const isAdm = rk === 'hospital_admin' || normOld.includes('ADM') || n.includes('admin');
      const isKelly = n.includes('kelly');

      let newId = '';
      if (isAdm && !Object.values(mapping).includes(`AMC-${year}-1001`)) {
        newId = `AMC-${year}-1001`;
      } else if (isKelly && !Object.values(mapping).includes(`AMC-${year}-1002`)) {
        newId = `AMC-${year}-1002`;
      } else {
        while (Object.values(mapping).includes(`AMC-${year}-${String(nextSeq).padStart(4, '0')}`)) {
          nextSeq++;
        }
        newId = `AMC-${year}-${String(nextSeq).padStart(4, '0')}`;
        nextSeq++;
      }
      mapping[normOld] = newId;
      return newId;
    };

    const updatedCards = cards.map((c: any) => {
      const oldId = String(c?.badgeId || '').trim().toUpperCase();
      if (!oldId || /^AMC-\d{4}-\d{4}$/i.test(oldId)) return c;
      const newId = getNewIdFor(oldId, c.roleKey, c.fullName || c.name);
      changed = true;
      const updated = {
        ...c,
        badgeId: newId,
        legacyBadgeId: oldId,
      };
      try {
        updated.qrPayload = buildStaffQrPayload(updated);
      } catch {
        /* ignore */
      }
      return updated;
    });

    if (changed) {
      localStorage.setItem(STAFF_CARD_STORAGE_KEY, JSON.stringify(updatedCards));
    }

    for (const regKey of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry']) {
      const regRaw = localStorage.getItem(regKey);
      if (!regRaw) continue;
      const reg = JSON.parse(regRaw);
      if (!Array.isArray(reg)) continue;
      let regChanged = false;
      const updatedReg = reg.map((r: any) => {
        const oldBadge = String(r?.badgeId || r?.id || '').trim().toUpperCase();
        if (!oldBadge || /^AMC-\d{4}-\d{4}$/i.test(oldBadge)) return r;
        const newId = getNewIdFor(oldBadge, r.roleKey, r.name || r.fullName);
        regChanged = true;
        return {
          ...r,
          id: newId,
          badgeId: newId,
          legacyBadgeId: oldBadge,
        };
      });
      if (regChanged) {
        localStorage.setItem(regKey, JSON.stringify(updatedReg));
      }
    }

    const accessRaw = localStorage.getItem('medcore_os_access_control');
    if (accessRaw) {
      const access = JSON.parse(accessRaw);
      if (Array.isArray(access)) {
        let accessChanged = false;
        const updatedAccess = access.map((a: any) => {
          const oldId = String(a?.id || '').trim().toUpperCase();
          if (!oldId || /^AMC-\d{4}-\d{4}$/i.test(oldId)) return a;
          const newId = getNewIdFor(oldId, a.roleKey, a.name);
          accessChanged = true;
          return {
            ...a,
            id: newId,
            legacyBadgeId: oldId,
          };
        });
        if (accessChanged) {
          localStorage.setItem('medcore_os_access_control', JSON.stringify(updatedAccess));
        }
      }
    }

    const migratedCount = Object.keys(mapping).length;
    if (migratedCount > 0) {
      try {
        window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: updatedCards }));
        window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated'));
        window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_access_control' } }));
      } catch {
        /* ignore */
      }

      try {
        const facilityId = (updatedCards[0]?.facilityId || 'IGH-EKT');
        const regRaw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
        const finalReg = regRaw ? JSON.parse(regRaw) : [];
        void firestorePushStaffDirectory(facilityId, {
          staffCards: updatedCards,
          staffRegistry: finalReg,
        });
        for (const [oldId, newId] of Object.entries(mapping)) {
          if (oldId !== newId) {
            void firestoreDeleteStaffMember(facilityId, oldId);
          }
        }
      } catch {
        /* ignore */
      }
    }

    return { migratedCount, mapping };
  } catch (err) {
    console.warn('[staffStore] migration error', err);
    return { migratedCount: 0, mapping };
  }
}

function readCards(): StaffCardRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    if (!_migrationRan) {
      _migrationRan = true;
      migrateStaffIdsToNewFormat();
    }
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
  try {
    localStorage.setItem(STAFF_CARD_STORAGE_KEY, JSON.stringify(cards));
  } catch {
    return;
  }
  // Broadcast so OS + browser Clinic tab can refresh (never throw into React)
  try {
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: cards }));
  } catch {
    /* ignore */
  }
}

export function listStaffCards(): StaffCardRecord[] {
  return readCards();
}

const FLUSH_LOCK_KEY = 'medcore_staff_flush_lock_until';

/** While locked, ignore non-empty cloud staff pushes (prevents UI freeze rehydrate loops). */
export function setStaffFlushLock(ms = 90_000): void {
  try {
    localStorage.setItem(FLUSH_LOCK_KEY, String(Date.now() + ms));
  } catch {
    /* ignore */
  }
}

export function isStaffFlushLocked(): boolean {
  try {
    const until = Number(localStorage.getItem(FLUSH_LOCK_KEY) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}



/** Remove every staff ID card (optionally one facility only). */
export function clearAllStaffIdCards(facilityId?: string): number {
  const fid = (facilityId || '').trim().toUpperCase();
  const before = readCards();
  const next = fid
    ? before.filter((c) => String(c.facilityId || '').toUpperCase() !== fid)
    : [];
  writeCards(next);
  // Full card wipe for a facility unlocks re-onboarding / first admin claim
  if (fid || !facilityId) {
    try {
      const { clearFacilityOnboarded } = require('./onboardingStore') as typeof import('./onboardingStore');
      if (facilityId) clearFacilityOnboarded(facilityId);
    } catch { /* */ }
  }
  return before.length - next.length;
}


/** Active staff ID cards for one facility only (UI counters / facility desks). */

/**
 * Rebuild access-control rows from ID cards + registry for one facility.
 * Fixes Access list (few) vs ID cards (many) mismatch.
 */
export function syncAccessRosterFromSources(facilityId: string): {
  count: number;
  badgeIds: string[];
} {
  if (typeof window === 'undefined') return { count: 0, badgeIds: [] };
  if (isStaffFlushLocked()) {
    try {
      const access = JSON.parse(localStorage.getItem('medcore_os_access_control') || '[]');
      const ids = Array.isArray(access) ? access.map((r: { id?: string }) => String(r.id || '')) : [];
      return { count: ids.length, badgeIds: ids };
    } catch {
      return { count: 0, badgeIds: [] };
    }
  }
  const fid = String(facilityId || '').trim();
  const byId = new Map<string, Record<string, unknown>>();

  const ingest = (raw: Record<string, unknown>) => {
    const id = String(raw.badgeId || raw.id || '')
      .toUpperCase()
      .replace(/\s+/g, '');
    if (!id) return;
    const rowFid = String(raw.hospitalId || raw.facilityId || '').trim();
    // Skip other facilities when we know the row's facility; allow legacy empty
    if (fid && rowFid && rowFid !== fid) return;
    const prev = byId.get(id) || {};
    byId.set(id, {
      ...prev,
      ...raw,
      badgeId: id,
      id,
      name: raw.name || raw.fullName || prev.name || id,
      fullName: raw.fullName || raw.name || prev.fullName || id,
      role: raw.role || raw.shortRole || prev.role || 'Staff',
      roleKey: raw.roleKey || prev.roleKey,
      department: raw.department || prev.department || '—',
      clearance: Number(raw.clearanceLevel || raw.clearance || prev.clearance || 2),
      status: String(raw.status || prev.status || 'active').toLowerCase() === 'suspended'
        ? 'suspended'
        : String(raw.status || '').toLowerCase() === 'pending'
          ? 'pending'
          : 'active',
      lastLogin: raw.lastLoginAt || raw.lastLogin || prev.lastLogin || '—',
      permissions: Array.isArray(raw.permissions)
        ? raw.permissions
        : prev.permissions || [],
      email: raw.email || raw.workEmail || prev.email,
      hospitalId: fid || rowFid,
      facilityId: fid || rowFid,
    });
  };

  try {
    for (const c of listStaffCards()) {
      if (fid && c.facilityId && c.facilityId !== fid) continue;
      ingest({
        badgeId: c.badgeId,
        fullName: c.fullName,
        name: c.fullName,
        role: c.role,
        roleKey: c.roleKey,
        department: c.department,
        clearanceLevel: c.clearanceLevel,
        status: c.status === 'ACTIVE' ? 'active' : String(c.status || 'active').toLowerCase(),
        email: (c as { email?: string }).email,
        permissions: (c as { permissions?: string[] }).permissions,
        facilityId: c.facilityId || fid,
        hospitalId: c.facilityId || fid,
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const regRaw =
      localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY) ||
      localStorage.getItem('medcore_os_staff_registry');
    const reg = regRaw ? JSON.parse(regRaw) : [];
    if (Array.isArray(reg)) {
      for (const s of reg) {
        const rowFid = String(s.hospitalId || s.facilityId || '');
        if (fid && rowFid && rowFid !== fid) continue;
        ingest(s as Record<string, unknown>);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const accessRaw = localStorage.getItem('medcore_os_access_control');
    const access = accessRaw ? JSON.parse(accessRaw) : [];
    if (Array.isArray(access)) {
      for (const a of access) ingest(a as Record<string, unknown>);
    }
  } catch {
    /* ignore */
  }

  const rows = Array.from(byId.values()).map((s) => ({
    id: String(s.id || s.badgeId),
    name: String(s.name || s.fullName || s.id),
    role: String(s.role || 'Staff'),
    department: String(s.department || '—'),
    clearance: Number(s.clearance || 2),
    status: (String(s.status || 'active').toLowerCase() === 'suspended'
      ? 'suspended'
      : String(s.status || '').toLowerCase() === 'pending'
        ? 'pending'
        : 'active') as 'active' | 'suspended' | 'pending',
    lastLogin: String(s.lastLogin || '—'),
    permissions: Array.isArray(s.permissions) ? (s.permissions as string[]) : [],
    email: s.email ? String(s.email) : undefined,
  }));

  try {
    localStorage.setItem('medcore_os_access_control', JSON.stringify(rows));
    window.dispatchEvent(
      new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_access_control' } })
    );
  } catch {
    /* ignore */
  }

  try {
    void import('./adminRealtimeStore').then((m) => {
      try {
        m.setAccessRecords(rows as never);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }

  return { count: rows.length, badgeIds: rows.map((r) => r.id) };
}

/**
 * Remove ID cards that are not on the access/registry roster for this facility
 * (true orphans), OR remove duplicate cards with the same name+role keeping the newest.
 */
export function purgeOrphanAndDuplicateIdCards(facilityId: string): {
  removedOrphans: string[];
  removedDuplicates: string[];
} {
  const fid = String(facilityId || '').trim();
  const removedOrphans: string[] = [];
  const removedDuplicates: string[] = [];

  // Ensure access roster exists first
  const synced = syncAccessRosterFromSources(fid);
  const keep = new Set(synced.badgeIds.map((b) => b.toUpperCase()));

  let cards = listStaffCards().filter((c) => {
    if (fid && c.facilityId && c.facilityId !== fid) return true; // keep other facilities
    const id = String(c.badgeId || '').toUpperCase();
    // Keep admin / platform badges
    if (id.includes('ADM-001') || id === 'AKS-ADM-001') return true;
    if (!keep.has(id) && fid && (!c.facilityId || c.facilityId === fid)) {
      // Card not on roster — after sync, keep should include all cards; so orphans are rare.
      // Treat cards with empty name or badge-as-name and no roleKey as junk
      const name = String(c.fullName || '').trim();
      if (!name || name === id) {
        removedOrphans.push(id);
        return false;
      }
    }
    return true;
  });

  // Deduplicate same fullName + roleKey within facility — keep newest issuedAt / highest id
  const groups = new Map<string, StaffCardRecord[]>();
  for (const c of cards) {
    if (fid && c.facilityId && c.facilityId !== fid) continue;
    const key = `${String(c.fullName || '').trim().toLowerCase()}|${String(c.roleKey || c.role || '').toLowerCase()}`;
    if (!key.startsWith('|') && String(c.fullName || '').trim()) {
      const arr = groups.get(key) || [];
      arr.push(c);
      groups.set(key, arr);
    }
  }
  const drop = new Set<string>();
  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => {
      const ta = Date.parse(String((a as { issuedAt?: string; createdAt?: string }).issuedAt || (a as { createdAt?: string }).createdAt || 0)) || 0;
      const tb = Date.parse(String((b as { issuedAt?: string; createdAt?: string }).issuedAt || (b as { createdAt?: string }).createdAt || 0)) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.badgeId).localeCompare(String(a.badgeId));
    });
    // keep first (newest)
    for (const extra of arr.slice(1)) {
      const id = String(extra.badgeId || '').toUpperCase();
      if (id.includes('ADM-001')) continue;
      drop.add(id);
      removedDuplicates.push(id);
    }
  }

  cards = cards.filter((c) => !drop.has(String(c.badgeId || '').toUpperCase()));
  writeCards(cards);

  // Drop registry + access rows for removed badges
  const gone = new Set([...removedOrphans, ...removedDuplicates]);
  if (gone.size) {
    try {
      const regRaw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
      const reg = regRaw ? JSON.parse(regRaw) : [];
      if (Array.isArray(reg)) {
        const next = reg.filter((r: { badgeId?: string; id?: string }) => {
          const b = String(r.badgeId || r.id || '')
            .toUpperCase()
            .replace(/\s+/g, '');
          return !gone.has(b);
        });
        localStorage.setItem(STAFF_REGISTRY_STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem('medcore_os_staff_registry', JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }
    try {
      const accessRaw = localStorage.getItem('medcore_os_access_control');
      const access = accessRaw ? JSON.parse(accessRaw) : [];
      if (Array.isArray(access)) {
        const next = access.filter(
          (r: { id?: string }) =>
            !gone.has(String(r.id || '').toUpperCase().replace(/\s+/g, ''))
        );
        localStorage.setItem('medcore_os_access_control', JSON.stringify(next));
      }
    } catch {
      /* ignore */
    }
    // Cloud push best-effort
    try {
      void import('./firebase').then((m) => {
        void m.firestorePushStaffDirectory(fid, {
          staffCards: listStaffCards().filter((c) => !c.facilityId || c.facilityId === fid),
          staffRegistry: JSON.parse(localStorage.getItem('medcore_os_staff_registry') || '[]'),
        });
        for (const bid of gone) {
          void m.firestoreDeleteStaffMember(fid, bid);
          void m.firestoreRevokeStaff(fid, bid, { name: bid });
        }
      });
    } catch {
      /* ignore */
    }
  }

  syncAccessRosterFromSources(fid);
  window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated'));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_staff_registry' } }));

  return { removedOrphans, removedDuplicates };
}

/**
 * Nuclear: clear every non-admin ID card + registry + access for facility.
 */
/**
 * Hard flush: remove ALL non-admin staff for this facility (and unscoped/legacy cards).
 * Local work is synchronous and minimal; cloud/API runs in background so the UI stays responsive.
 */
export function wipeFacilityStaffExceptAdmin(facilityId: string): number {
  const fid = String(facilityId || '').trim();
  setStaffFlushLock(90_000);

  const before = listStaffCards();
  const kept = before.filter((c) => {
    const id = String(c.badgeId || '').toUpperCase();
    if (id.includes('ADM-001') || id === 'AKS-ADM-001') return true;
    const cf = String(c.facilityId || '').trim();
    if (fid && cf && cf !== fid) return true;
    return false;
  });
  const removed = before.length - kept.length;

  // Fast local writes only — clear primary + legacy keys so ID CARDS counter drops
  try {
    localStorage.setItem(STAFF_CARD_STORAGE_KEY, JSON.stringify(kept));
    localStorage.setItem('medcore_os_staff_cards', JSON.stringify(kept));
    localStorage.setItem('medcore_staff_cards', JSON.stringify(kept));
    localStorage.setItem('ibom_staff_id_cards', JSON.stringify(kept));
    // also via writeCards for in-memory consistency (event deferred)
  } catch {
    /* ignore */
  }
  try {
    // Direct assign without extra events during wipe — already set keys above
  } catch {
    /* ignore */
  }

  try {
    const regRaw =
      localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY) ||
      localStorage.getItem('medcore_os_staff_registry');
    const reg = regRaw ? JSON.parse(regRaw) : [];
    const nextReg = Array.isArray(reg)
      ? reg.filter((r: { badgeId?: string; id?: string; hospitalId?: string; facilityId?: string }) => {
        const b = String(r.badgeId || r.id || '').toUpperCase();
        if (b.includes('ADM-001') || b === 'AKS-ADM-001') return true;
        const rowFid = String(r.hospitalId || r.facilityId || '').trim();
        if (fid && rowFid && rowFid !== fid) return true;
        return false;
      })
      : [];
    localStorage.setItem(STAFF_REGISTRY_STORAGE_KEY, JSON.stringify(nextReg));
    localStorage.setItem('medcore_os_staff_registry', JSON.stringify(nextReg));
  } catch {
    /* ignore */
  }

  try {
    const accessRaw = localStorage.getItem('medcore_os_access_control');
    const access = accessRaw ? JSON.parse(accessRaw) : [];
    const nextAccess = Array.isArray(access)
      ? access.filter((r: { id?: string }) => {
        const b = String(r.id || '').toUpperCase();
        return b.includes('ADM-001') || b === 'AKS-ADM-001';
      })
      : [];
    localStorage.setItem('medcore_os_access_control', JSON.stringify(nextAccess));
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem('medcore_os_staff_presence_v1', '{}');
  } catch {
    /* ignore */
  }

  // Defer events + cloud so click handler returns immediately
  const adminCards = kept.filter((c) => {
    const id = String(c.badgeId || '').toUpperCase();
    return id.includes('ADM-001') || id === 'AKS-ADM-001';
  });

  window.setTimeout(() => {
    try {
      window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: kept }));
      window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_access_control' } }));
      window.dispatchEvent(new CustomEvent('medcore-staff-presence', { detail: {} }));
    } catch {
      /* ignore */
    }

    void (async () => {
      try {
        const { getFirebaseAuth } = await import('./firebase');
        const u = getFirebaseAuth().currentUser;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (u) {
          try {
            headers.Authorization = `Bearer ${await Promise.race([
              u.getIdToken(true),
              new Promise<string>((_, rej) => setTimeout(() => rej(new Error('token timeout')), 4000)),
            ])}`;
          } catch {
            /* no token */
          }
        }
        const secret =
          (typeof window !== 'undefined' && window.localStorage.getItem('medcore_admin_api_secret')) ||
          '';
        if (secret) headers['x-admin-secret'] = secret;
        await Promise.race([
          fetch('/api/staff/flush-facility', {
            method: 'POST',
            headers,
            body: JSON.stringify({ facilityId: fid, confirm: 'FLUSH_FACILITY_STAFF' }),
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('flush timeout')), 15000)),
        ]).catch(() => null);
      } catch {
        /* ignore */
      }

      try {
        const m = await import('./firebase');
        await Promise.race([
          m.firestoreWriteFacility(fid, {
            staffCards: adminCards,
            staffRegistry: [],
            staffUpdatedAt: new Date().toISOString(),
            flushAt: new Date().toISOString(),
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('fs timeout')), 10000)),
        ]).catch(() => null);
      } catch {
        /* ignore */
      }
    })();
  }, 0);

  return removed;
}

export function flushFacilityStaff(facilityId: string): number {

  return wipeFacilityStaffExceptAdmin(facilityId);
}


export function listActiveStaffCardsForFacility(facilityId: string): StaffCardRecord[] {
  const fid = (facilityId || '').trim().toUpperCase();
  return readCards().filter((c) => {
    const st = String(c.status || 'ACTIVE').toUpperCase();
    if (st !== 'ACTIVE') return false;
    if (!fid) return true;
    return String(c.facilityId || '').toUpperCase() === fid;
  });
}

/** Count of ACTIVE staff ID cards in a facility (failed creates must not inflate this). */
export function countActiveStaffCards(facilityId?: string): number {
  return listActiveStaffCardsForFacility(facilityId || '').length;
}

export function getStaffCard(badgeId: string): StaffCardRecord | undefined {
  const norm = (badgeId || '').trim().toUpperCase();
  return readCards().find((c) => c.badgeId === norm || (c as any).legacyBadgeId === norm);
}

/** Printed badge format matching official Arise MedCore card: AMC-YYYY-#### */
export function nextPrintedBadgeId(facilityId?: string): string {
  const year = new Date().getFullYear();
  const brand = 'AMC';
  const prefix = `${brand}-${year}-`;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STAFF_CARD_STORAGE_KEY) : null;
    const cards: StaffCardRecord[] = raw ? JSON.parse(raw) : [];
    // Only ACTIVE issued cards consume sequence — failed/rolled-back creates must not advance the count
    const seqs = (Array.isArray(cards) ? cards : [])
      .filter((c) => {
        const st = String((c as { status?: string })?.status || 'ACTIVE').toUpperCase();
        return st === 'ACTIVE';
      })
      .map((c) => {
        const b = String(c?.badgeId || '').toUpperCase();
        if (b.startsWith(prefix)) {
          const n = parseInt(b.slice(prefix.length), 10);
          return isNaN(n) ? 0 : n;
        }
        return 0;
      })
      .filter((n) => n > 0);

    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1001;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  } catch {
    return `${prefix}1001`;
  }
}

export type StaffRegistryEntry = {
  id: string;
  badgeId: string;
  name: string;
  role: string;
  shortRole: string;
  title: string;
  roleKey: string;
  clearanceLevel: number;
  clearanceLabel: string;
  department: string;
  initials: string;
  permissions: string[];
  pin: string;
  hospitalId: string;
  hospitalName: string;
  status: string;
  email?: string;
};

/** Build card + registry entry in memory — does NOT write local or cloud (no ID consumed until commit). */
export function prepareStaffEnrolment(
  input: StaffEnrolmentInput,
  badgeId?: string
): { card: StaffCardRecord; badgeId: string; entry: StaffRegistryEntry } {
  const id = (badgeId || nextPrintedBadgeId(input.facilityId)).trim().toUpperCase();
  const card = issueStaffCardFromEnrolment(input, id);
  const entry: StaffRegistryEntry = {
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
  return { card, badgeId: id, entry };
}

/**
 * Persist enrolment only after cloud profile succeeds.
 * Writes local cards + registry, then pushes directory (card already has ACTIVE status).
 */
export function commitStaffEnrolment(
  input: StaffEnrolmentInput,
  card: StaffCardRecord,
  entry: StaffRegistryEntry
): void {
  const id = card.badgeId;
  const cards = readCards().filter((c) => c.badgeId !== id);
  cards.unshift(card);
  writeCards(cards);

  try {
    const regRaw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
    const reg = regRaw ? JSON.parse(regRaw) : [];
    const next = Array.isArray(reg)
      ? [entry, ...reg.filter((r: { id?: string; badgeId?: string }) => r.id !== id && r.badgeId !== id)]
      : [entry];
    localStorage.setItem(STAFF_REGISTRY_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem('medcore_os_staff_registry', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_staff_registry' } }));
    window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated', { detail: cards }));
    void firestorePushStaffDirectory(input.facilityId, {
      staffCards: cards,
      staffRegistry: next,
    });
  } catch {
    /* ignore */
  }
}


/**
 * Enrol staff in one step (local commit). Prefer Access Control flow:
 * prepareStaffEnrolment → cloud save → commitStaffEnrolment so failed cloud leaves no ID.
 */
export function enrolStaffAndIssueCard(
  input: StaffEnrolmentInput,
  badgeId?: string
): { card: StaffCardRecord; badgeId: string } {
  const prepared = prepareStaffEnrolment(input, badgeId);
  commitStaffEnrolment(input, prepared.card, prepared.entry);
  return { card: prepared.card, badgeId: prepared.badgeId };
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

/**
 * Apply Firestore staff directory onto local cards + registry + access control.
 * Used by Access Control so every workstation sees the same live list.
 */
export function applyCloudStaffDirectory(payload: {
  staffCards?: unknown[];
  staffRegistry?: unknown[];
  /** When set, only replace cards/registry rows for this facility (keeps other hospitals). */
  facilityId?: string;
}): void {
  if (typeof window === 'undefined') return;
  if (isStaffFlushLocked()) {
    const cards = payload.staffCards;
    const reg = payload.staffRegistry;
    const cardLen = Array.isArray(cards) ? cards.length : -1;
    const regLen = Array.isArray(reg) ? reg.length : -1;
    // During intentional wipe lock, ignore non-empty rehydrate storms only
    if (cardLen > 0 || regLen > 0) return;
  }
  try {
    if (Array.isArray(payload.staffCards)) {
      const cards = payload.staffCards as StaffCardRecord[];
      // Empty cloud snapshot must NOT wipe all local cards unless flush lock
      // (switching facility / new hospital often publishes [] briefly)
      if (cards.length === 0) {
        if (isStaffFlushLocked()) {
          const fid = String(payload.facilityId || '').toUpperCase();
          if (fid) {
            writeCards(
              readCards().filter((c) => String(c.facilityId || '').toUpperCase() !== fid)
            );
          } else {
            writeCards([]);
          }
        }
        // else: ignore empty — protect multi-facility local cache
      } else {
        const byId = new Map<string, StaffCardRecord>();
        for (const c of cards) {
          const id = String(c?.badgeId || '').toUpperCase();
          if (!id) continue;
          byId.set(id, c as StaffCardRecord);
        }
        const incoming = Array.from(byId.values());
        // Facilities represented in this payload
        const fids = new Set(
          incoming
            .map((c) => String(c.facilityId || payload.facilityId || '').toUpperCase())
            .filter(Boolean)
        );
        if (payload.facilityId) fids.add(String(payload.facilityId).toUpperCase());
        if (fids.size > 0) {
          // Keep cards from other facilities; replace only this facility set
          const kept = readCards().filter(
            (c) => !fids.has(String(c.facilityId || '').toUpperCase())
          );
          writeCards([...kept, ...incoming]);
        } else {
          writeCards(incoming);
        }
      }
    }
  } catch {
    /* ignore */
  }
  try {
    if (Array.isArray(payload.staffRegistry)) {
      const incoming = payload.staffRegistry as any[];
      // Empty registry: only clear under flush lock
      if (incoming.length === 0 && !isStaffFlushLocked()) {
        /* keep local registry */
      } else {
        const fid = String(payload.facilityId || '').toUpperCase();
        let nextReg = incoming;
        if (fid && incoming.length >= 0) {
          try {
            const prevRaw =
              localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY) ||
              localStorage.getItem('medcore_os_staff_registry') ||
              '[]';
            const prev = JSON.parse(prevRaw);
            if (Array.isArray(prev)) {
              const kept = prev.filter((r: any) => {
                const rowFid = String(r.hospitalId || r.facilityId || '').toUpperCase();
                return rowFid && rowFid !== fid;
              });
              nextReg = [...kept, ...incoming];
            }
          } catch {
            nextReg = incoming;
          }
        }
        const regJson = JSON.stringify(nextReg);
        const prevReg = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY) || '';
        if (prevReg !== regJson) {
          localStorage.setItem(STAFF_REGISTRY_STORAGE_KEY, regJson);
          localStorage.setItem('medcore_os_staff_registry', regJson);
          window.dispatchEvent(
            new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_staff_registry' } })
          );
          window.dispatchEvent(
            new CustomEvent('medcore-staff-registry-updated', { detail: nextReg })
          );
        }
      }
    }
  } catch {
    /* ignore */
  }
  // Rebuild access control rows from registry so Access UI matches DB
  try {
    const regRaw = localStorage.getItem('medcore_os_staff_registry');
    const reg = regRaw ? JSON.parse(regRaw) : [];
    if (!Array.isArray(reg)) return;
    const access = reg
      .map((s: any) => {
        const id = String(s.badgeId || s.id || '')
          .toUpperCase()
          .replace(/\s+/g, '');
        if (!id) return null;
        const st = String(s.status || 'active').toLowerCase();
        const status =
          st === 'suspended' ? 'suspended' : st === 'pending' ? 'pending' : 'active';
        return {
          id,
          name: s.name || s.fullName || id,
          role: s.role || s.shortRole || s.roleKey || 'Staff',
          department: s.department || '—',
          clearance: Number(s.clearanceLevel || 2),
          status,
          lastLogin: s.lastLoginAt || s.lastLogin || '—',
          permissions: Array.isArray(s.permissions) ? s.permissions : [],
          email: s.email || s.workEmail || undefined,
        };
      })
      .filter(Boolean);
    const prev = localStorage.getItem('medcore_os_access_control') || '';
    const next = JSON.stringify(access);
    if (prev !== next) {
      localStorage.setItem('medcore_os_access_control', next);
      window.dispatchEvent(
        new CustomEvent('medcore-admin-sync', { detail: { key: 'medcore_os_access_control' } })
      );
    }
  } catch {
    /* ignore */
  }
}

export function deleteStaffMember(badgeId: string): boolean {
  const id = String(badgeId || '').toUpperCase().replace(/\s+/g, '');
  if (!id) return false;

  let facilityId = '';
  let savedPin = '';
  let savedEmail = '';
  let savedName = '';
  try {
    // Capture credentials BEFORE removing card (needed to delete Firebase Auth)
    for (const c of readCards()) {
      if (c.badgeId.toUpperCase().replace(/\s+/g, '') === id) {
        facilityId = c.facilityId || facilityId;
        savedPin = String((c as any).pin || '');
        savedEmail = String((c as any).email || '');
        savedName = String(c.fullName || (c as any).name || '');
        break;
      }
    }
    try {
      const regRaw = localStorage.getItem(STAFF_REGISTRY_STORAGE_KEY);
      const reg = regRaw ? JSON.parse(regRaw) : [];
      if (Array.isArray(reg)) {
        const hit = reg.find(
          (r: any) => String(r.badgeId || r.id || '').toUpperCase().replace(/\s+/g, '') === id
        );
        if (hit) {
          if (!savedPin && hit.pin) savedPin = String(hit.pin);
          if (!savedEmail && (hit.email || hit.workEmail))
            savedEmail = String(hit.email || hit.workEmail || '');
          if (!savedName && hit.name) savedName = String(hit.name);
          facilityId = hit.hospitalId || hit.facilityId || facilityId;
        }
      }
    } catch {
      /* ignore */
    }

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

    // Drop access control row + mark revoked so offline list cannot resurrect them
    try {
      markStaffRevokedLocal(id, facilityId || 'IGH-EKT');
    } catch {
      /* ignore */
    }
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
        void import('./adminRealtimeStore')
          .then((m) => {
            try {
              m.setAccessRecords(filtered);
            } catch {
              /* ignore */
            }
          })
          .catch(() => { });
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
      // Firebase Auth delete (badge synthetic email + optional work email) + force-logout signal
      void (async () => {
        try {
          await firestoreRevokeStaff(facilityId, id, { name: savedName });
        } catch {
          /* ignore */
        }
        try {
          await deleteStaffFirebaseAuth({
            badgeId: id,
            pin: savedPin || undefined,
            email: savedEmail || undefined,
          });
        } catch {
          /* Auth delete best-effort when PIN known */
        }
      })();
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
      'dashboard', 'patient-flow', 'patient-card', 'appointments',
      'desk-settings', 'notifications', 'my-card', 'universal-queue', 'm87-ai', 'ai',
      'front-desk-wq',
    ],
    doctor: [
      'dashboard', 'doctor-portal', 'universal-queue', 'patient-flow', 'appointments',
      'patient-360', 'notifications', 'emr', 'pharmacy',
      'laboratory', 'radiology', 'emergency', 'beds', 'icu', 'theatre',
      'm87-ai', 'ai', 'patient-card', 'my-card',
    ],
    surgeon: [
      'dashboard', 'theatre', 'doctor-portal', 'universal-queue', 'patient-flow', 'appointments',
      'notifications', 'icu', 'beds', 'blood-bank',
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
      'dashboard', 'laboratory', 'lab', 'lis', 'notifications', 'blood-bank', 'emr',
      'patient-card', 'my-card', 'm87-ai', 'ai', 'device-gateway', 'iot-devices',
    ],
    radiologist: [
      'dashboard', 'radiology', 'notifications', 'emr', 'patient-card', 'my-card', 'm87-ai', 'ai',
    ],
    records: ['dashboard', 'patient-card', 'patient-flow', 'beds', 'emr', 'my-card', 'notifications', 'claims', 'm87-ai', 'ai', 'him', 'him-deficiency', 'him-coding', 'him-roi', 'him-chart', 'him-merge', 'him-docs'],
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
  if (map[roleKey]) return map[roleKey];
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('medcore_os_role_permissions_v4');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[roleKey] && Array.isArray(parsed[roleKey]) && parsed[roleKey].length > 0) {
          return parsed[roleKey];
        }
      }
    }
  } catch {
    /* ignore */
  }
  return ['dashboard', 'my-card', 'patient-360', 'emr', 'notifications'];
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
  opts?: { pin?: string; fullName?: string; email?: string; phone?: string; force?: boolean }
): ProvisionFacilityAdminResult {
  const facilityId = String(facility.id || '').trim();
  const facilityName = String(facility.name || facilityId).trim();
  if (!facilityId) return { ok: false, error: 'Missing facility id' };

  // After hospital onboarding, never auto-mint another admin unless force
  // (force only when Firebase Auth for this facility was wiped).
  try {
    const { isFacilityOnboarded } = require('./onboardingStore') as typeof import('./onboardingStore');
    if (!opts?.force && isFacilityOnboarded(facilityId)) {
      const existing = listStaffCards().find(
        (c) =>
          String(c.facilityId || '').toUpperCase() === facilityId.toUpperCase() &&
          c.roleKey === 'hospital_admin'
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
      return {
        ok: false,
        error:
          'This facility is already onboarded. Sign in with the existing hospital admin credentials. A new admin is only created after Firebase Auth accounts for this facility are deleted.',
      };
    }
  } catch {
    /* onboarding store optional during SSR */
  }

  if (hasFacilityAdmin(facilityId)) {
    // Already has an admin — do not create another
    const existing = listStaffCards().find(
      (c) =>
        String(c.facilityId || '').toUpperCase() === facilityId.toUpperCase() &&
        c.roleKey === 'hospital_admin'
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

    if (opts?.email || opts?.phone || opts?.fullName) {
      try {
        bindFacilityOnboardingToAdmin({
          facilityId,
          facilityName,
          adminBadgeId: card.badgeId,
          primaryContact: fullName,
          contactEmail: opts?.email,
          contactPhone: opts?.phone,
        });
      } catch {
        /* ignore */
      }
    }
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




/**
 * After hospital onboarding: bind wizard details to the facility admin card + registry.
 * Ties name, email, phone, facility display name to the admin account permanently.
 */
export function bindFacilityOnboardingToAdmin(input: {
  facilityId: string;
  facilityName?: string;
  adminBadgeId?: string;
  primaryContact?: string;
  contactEmail?: string;
  contactPhone?: string;
  physicalAddress?: string;
  state?: string;
  lga?: string;
}): { ok: boolean; badgeId?: string; error?: string } {
  const facilityId = String(input.facilityId || '').trim();
  if (!facilityId || typeof window === 'undefined') {
    return { ok: false, error: 'Missing facility' };
  }
  const fid = facilityId.toUpperCase();
  const cards = readCards();
  let card =
    (input.adminBadgeId &&
      cards.find((c) => String(c.badgeId || '').toUpperCase() === String(input.adminBadgeId).toUpperCase())) ||
    cards.find(
      (c) =>
        String(c.facilityId || '').toUpperCase() === fid && c.roleKey === 'hospital_admin'
    );

  if (!card) {
    // Ensure one admin exists from onboarding details (first-time only)
    const prov = provisionFacilityAdmin(
      { id: facilityId, name: input.facilityName || facilityId },
      {
        fullName: input.primaryContact || 'Hospital Administrator',
        pin: undefined,
        email: input.contactEmail,
        phone: input.contactPhone,
        force: false,
      }
    );
    if (!prov.ok || !prov.badgeId) {
      return { ok: false, error: prov.error || 'No facility admin to bind' };
    }
    card = readCards().find((c) => c.badgeId === prov.badgeId);
  }

  if (!card) return { ok: false, error: 'Admin card missing' };

  const fullName = (input.primaryContact || card.fullName || 'Hospital Administrator').trim();
  const nextCard: StaffCardRecord = {
    ...card,
    fullName,
    facilityId,
    facilityName: input.facilityName || card.facilityName || facilityId,
    roleKey: 'hospital_admin',
    role: 'Hospital Administrator',
    title: 'Hospital Administrator',
  };

  const nextCards = cards.map((c) =>
    String(c.badgeId || '').toUpperCase() === String(nextCard.badgeId).toUpperCase() ? nextCard : c
  );
  writeCards(nextCards);

  // Mirror into staff registry
  try {
    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry']) {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) continue;
      let found = false;
      const mapped = arr.map((r: any) => {
        const bid = String(r.badgeId || r.id || '').toUpperCase();
        if (bid === String(nextCard.badgeId).toUpperCase()) {
          found = true;
          return {
            ...r,
            badgeId: nextCard.badgeId,
            id: nextCard.badgeId,
            name: fullName,
            fullName,
            email: input.contactEmail || r.email,
            workEmail: input.contactEmail || r.workEmail || r.email,
            phone: input.contactPhone || r.phone,
            hospitalId: facilityId,
            facilityId,
            hospitalName: input.facilityName || r.hospitalName,
            facilityName: input.facilityName || r.facilityName,
            roleKey: 'hospital_admin',
            role: 'Hospital Administrator',
            title: 'Hospital Administrator',
            status: r.status || 'ACTIVE',
          };
        }
        return r;
      });
      if (!found) {
        mapped.push({
          badgeId: nextCard.badgeId,
          id: nextCard.badgeId,
          name: fullName,
          fullName,
          email: input.contactEmail,
          workEmail: input.contactEmail,
          phone: input.contactPhone,
          hospitalId: facilityId,
          facilityId,
          hospitalName: input.facilityName,
          facilityName: input.facilityName,
          roleKey: 'hospital_admin',
          role: 'Hospital Administrator',
          title: 'Hospital Administrator',
          status: 'ACTIVE',
          pin: (nextCard as any).pin,
        });
      }
      localStorage.setItem(key, JSON.stringify(mapped));
    }
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated'));
    window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated'));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync'));
  } catch {
    /* ignore */
  }

  try {
    void firestoreUpsertStaffMember(facilityId, {
      badgeId: nextCard.badgeId,
      fullName,
      facilityId,
      roleKey: 'hospital_admin',
      email: input.contactEmail,
      phone: input.contactPhone,
    });
  } catch {
    /* offline ok */
  }

  return { ok: true, badgeId: nextCard.badgeId };
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

/** Remove staff whose name matches (case-insensitive contains) for a facility. */
export function purgeStaffByNameForFacility(facilityId: string, nameQuery: string): string[] {
  const fid = String(facilityId || '').toUpperCase();
  const q = String(nameQuery || '').trim().toLowerCase();
  if (!fid || !q || typeof window === 'undefined') return [];

  const targets = new Set<string>();

  const consider = (badge: string, name: string, facility?: string) => {
    const bid = String(badge || '').toUpperCase().replace(/\s+/g, '');
    const nm = String(name || '').toLowerCase();
    const hid = String(facility || fid).toUpperCase();
    if (!bid || !nm) return;
    if (hid && hid !== fid) return;
    if (nm === q || nm.includes(q) || q.includes(nm)) targets.add(bid);
  };

  try {
    for (const c of readCards()) {
      consider(c.badgeId, String((c as any).fullName || (c as any).name || ''), c.facilityId);
    }
  } catch { /* ignore */ }

  try {
    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry', 'medcore_staff_registry']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const reg = JSON.parse(raw);
      if (!Array.isArray(reg)) continue;
      for (const r of reg) {
        consider(
          String(r.badgeId || r.id || ''),
          String(r.name || r.fullName || ''),
          String(r.hospitalId || r.facilityId || '')
        );
      }
    }
  } catch { /* ignore */ }

  try {
    const accessRaw = localStorage.getItem('medcore_os_access_control');
    const access = accessRaw ? JSON.parse(accessRaw) : [];
    if (Array.isArray(access)) {
      for (const a of access) {
        consider(String(a.id || ''), String(a.name || ''), fid);
      }
    }
  } catch { /* ignore */ }

  const removed: string[] = [];
  for (const bid of targets) {
    try {
      if (deleteStaffMember(bid)) removed.push(bid);
    } catch {
      removed.push(bid);
    }
  }
  return removed;
}

/**
 * Keep only staff whose name matches keepQueries (or hospital admin) for a facility.
 * Everyone else at that facility is deleted (local + cloud via deleteStaffMember).
 * Example: keepOnlyStaffNamesForFacility('IGH-EKT', ['kelly', 'admin'])
 */
export function keepOnlyStaffNamesForFacility(
  facilityId: string,
  keepQueries: string[]
): string[] {
  const fid = String(facilityId || '').toUpperCase();
  if (!fid || typeof window === 'undefined') return [];
  const queries = keepQueries
    .map((q) => String(q || '').trim().toLowerCase())
    .filter(Boolean);

  const isAdmin = (roleKey?: string, badge?: string, role?: string, name?: string) => {
    const rk = String(roleKey || '').toLowerCase();
    const b = String(badge || '').toUpperCase();
    const r = String(role || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    return (
      rk === 'hospital_admin' ||
      rk === 'sysadmin' ||
      b.includes('-ADM-') ||
      b === 'AKS-ADM-001' ||
      b.endsWith('-ADM-001') ||
      (r.includes('administrator') && !r.includes('system')) ||
      n === 'admin' ||
      n.includes(' administrator') ||
      (n.startsWith('admin ') || n.endsWith(' admin'))
    );
  };

  const shouldKeep = (roleKey?: string, badge?: string, role?: string, name?: string) => {
    if (isAdmin(roleKey, badge, role, name)) return true;
    const n = String(name || '').toLowerCase();
    const b = String(badge || '').toLowerCase();
    for (const q of queries) {
      if (!q) continue;
      if (n === q || n.includes(q) || q.includes(n)) return true;
      if (b.includes(q.replace(/\s+/g, ''))) return true;
      // "admin" query also matches admin roles already handled
      if (q === 'admin' && isAdmin(roleKey, badge, role, name)) return true;
    }
    return false;
  };

  const candidates = new Set<string>();

  try {
    for (const c of readCards()) {
      if (String(c.facilityId || '').toUpperCase() !== fid) continue;
      const name = String((c as any).fullName || (c as any).name || '');
      if (!shouldKeep(c.roleKey, c.badgeId, c.role, name)) {
        candidates.add(String(c.badgeId).toUpperCase().replace(/\s+/g, ''));
      }
    }
  } catch {
    /* ignore */
  }

  try {
    for (const key of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry', 'medcore_staff_registry']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const reg = JSON.parse(raw);
      if (!Array.isArray(reg)) continue;
      for (const r of reg) {
        const hid = String(r.hospitalId || r.facilityId || '').toUpperCase();
        if (hid && hid !== fid) continue;
        const badge = String(r.badgeId || r.id || '')
          .toUpperCase()
          .replace(/\s+/g, '');
        const name = String(r.name || r.fullName || '');
        if (badge && !shouldKeep(r.roleKey, badge, r.role, name)) candidates.add(badge);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const accessRaw = localStorage.getItem('medcore_os_access_control');
    const access = accessRaw ? JSON.parse(accessRaw) : [];
    if (Array.isArray(access)) {
      for (const a of access) {
        const badge = String(a.id || '')
          .toUpperCase()
          .replace(/\s+/g, '');
        const name = String(a.name || '');
        // access rows are facility-scoped loosely — still filter by name
        if (badge && !shouldKeep(undefined, badge, a.role, name)) candidates.add(badge);
      }
    }
  } catch {
    /* ignore */
  }

  const removed: string[] = [];
  for (const bid of candidates) {
    try {
      if (deleteStaffMember(bid)) removed.push(bid);
      else removed.push(bid);
    } catch {
      removed.push(bid);
    }
  }

  // Push trimmed directory so other workstations / Access Control stay aligned
  try {
    const cards = readCards().filter((c) => String(c.facilityId || '').toUpperCase() === fid);
    const regRaw = localStorage.getItem('medcore_os_staff_registry');
    const reg = regRaw ? JSON.parse(regRaw) : [];
    const filteredReg = Array.isArray(reg)
      ? reg.filter((r: any) => {
        const hid = String(r.hospitalId || r.facilityId || '').toUpperCase();
        if (hid && hid !== fid) return true;
        const badge = String(r.badgeId || r.id || '')
          .toUpperCase()
          .replace(/\s+/g, '');
        const name = String(r.name || r.fullName || '');
        return shouldKeep(r.roleKey, badge, r.role, name);
      })
      : [];
    localStorage.setItem('medcore_os_staff_registry', JSON.stringify(filteredReg));
    void firestorePushStaffDirectory(fid, {
      staffCards: cards,
      staffRegistry: filteredReg,
    });
  } catch {
    /* ignore */
  }

  return removed;
}

/**
 * Update staff PIN across cards, registry, and access control.
 */
export function updateStaffPin(badgeId: string, newPin: string, facilityId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const idNorm = String(badgeId || '').trim().toUpperCase();
  if (!idNorm) return false;

  let updated = false;

  // 1. Update staff ID cards in storage
  try {
    const rawCards = localStorage.getItem(STAFF_CARD_STORAGE_KEY);
    const cards = rawCards ? JSON.parse(rawCards) : [];
    if (Array.isArray(cards)) {
      const nextCards = cards.map((c: any) => {
        if (String(c.badgeId || '').trim().toUpperCase() === idNorm) {
          updated = true;
          return { ...c, pin: newPin };
        }
        return c;
      });
      localStorage.setItem(STAFF_CARD_STORAGE_KEY, JSON.stringify(nextCards));
      localStorage.setItem('medcore_os_staff_cards', JSON.stringify(nextCards));
      localStorage.setItem('medcore_staff_cards', JSON.stringify(nextCards));
    }
  } catch (e) {
    console.warn('[staffCardStore] updateStaffPin cards', e);
  }

  // 2. Update staff registry in storage
  for (const regKey of [STAFF_REGISTRY_STORAGE_KEY, 'medcore_os_staff_registry', 'medcore_staff_registry']) {
    try {
      const rawReg = localStorage.getItem(regKey);
      const reg = rawReg ? JSON.parse(rawReg) : [];
      if (Array.isArray(reg)) {
        const nextReg = reg.map((r: any) => {
          if (String(r.badgeId || r.id || '').trim().toUpperCase() === idNorm) {
            updated = true;
            return { ...r, pin: newPin };
          }
          return r;
        });
        localStorage.setItem(regKey, JSON.stringify(nextReg));
      }
    } catch { /* ignore */ }
  }

  // 3. Update access control list
  try {
    const accessRaw = localStorage.getItem('medcore_os_access_control');
    const access = accessRaw ? JSON.parse(accessRaw) : [];
    if (Array.isArray(access)) {
      const nextAccess = access.map((a: any) => {
        if (String(a.id || a.badgeId || '').trim().toUpperCase() === idNorm) {
          return { ...a, pin: newPin };
        }
        return a;
      });
      localStorage.setItem('medcore_os_access_control', JSON.stringify(nextAccess));
    }
  } catch { /* ignore */ }

  // 4. Update in Firestore if facilityId provided
  if (facilityId) {
    try {
      import('./firebase').then((m) => {
        m.firestoreUpsertStaffMember(facilityId, { badgeId: idNorm, pin: newPin });
      }).catch(() => { });
    } catch { /* ignore */ }
  }

  // Broadcast events
  try {
    window.dispatchEvent(new CustomEvent('medcore-staff-cards-updated'));
    window.dispatchEvent(new CustomEvent('medcore-staff-registry-updated'));
  } catch { /* ignore */ }

  return updated;
}


