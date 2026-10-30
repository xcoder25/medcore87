/**
 * Edge + cloud only runtime mode.
 *
 * Heavy facility clinical data no longer persists in browser localStorage /
 * IndexedDB (main source of slow boot and quota lag). Source of truth is
 * Firestore; this module keeps a session memory map so existing
 * localStorage.getItem/setItem call sites stay fast without disk I/O.
 *
 * Kept on durable storage (small):
 *  - medcore_os_session
 *  - medcore_admin_api_secret / API secrets
 *  - remember-me / UI prefs (tiny)
 */

const HEAVY_PREFIXES = [
  'medcore_os_',
  'medcore_staff_',
  'medcore_facility_',
  'medcore_anc_',
  'medcore_him',
  'medcore_pilot_',
  'medcore_onboarding',
  'medcore_admin_onboarding',
  'medcore_sync_',
  'medcore_fd_',
  'medcore_payment_',
  'medcore_patient_',
  'medcore_formulary',
  'medcore_drug_',
  'medcore_pharmacy_',
  'medcore_transfers',
  'medcore_os_sync_outbox',
] as const;

const DURABLE_PREFIXES = [
  'medcore_os_session',
  'medcore_admin_api_secret',
  'medcore_admin_api_secret_v1',
  'medcore_remember_facility',
  'medcore_ui_theme',
  'medcore_remember_me',
  // Admin settings, facility configs, and identity must survive reloads
  'medcore_os_admin_settings_v1',
  'medcore_facility_profile',
  'medcore_os_facilities',
  'medcore_role_permissions_v1',
  'medcore_attendance_cameras',
  'medcore_attendance_cam_settings',
  'medcore_admin_onboarding_done',
  'medcore_os_onboarding',
  'medcore_lan_api_url',
  // Staff directory, ID cards, access control, activity, and presence must survive reloads
  'medcore_staff_id_cards',
  'medcore_os_staff_cards',
  'medcore_staff_cards',
  'medcore_os_staff_registry',
  'medcore_os_access_control',
  'medcore_os_staff_presence_v1',
  'medcore_os_revoked_staff_v1',
  'medcore_os_hidden_staff_names_v1',
  'medcore_staff_flush_lock_until',
  'medcore_os_compliance_items',
  'medcore_os_admin_activity',
  'medcore_os_open_positions',
  'medcore_os_transfers',
] as const;

/** In-memory facility data for this browser tab session */
const mem = new Map<string, string>();

let installed = false;

export function isHeavyStorageKey(key: string): boolean {
  if (!key) return false;
  // If key matches or starts with any durable prefix (handles scoped keys like medcore_os_admin_settings_v1:IGH-EKT), allow persistence
  for (const p of DURABLE_PREFIXES) {
    if (key === p || key.startsWith(`${p}:`)) return false;
  }
  return HEAVY_PREFIXES.some((p) => key.startsWith(p));
}

export function memGet(key: string): string | null {
  if (!mem.has(key)) return null;
  return mem.get(key) ?? null;
}

export function memSet(key: string, value: string): void {
  mem.set(key, value);
}

export function memRemove(key: string): void {
  mem.delete(key);
}

export function memGetJson<T>(key: string): T | null {
  const raw = memGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function memSetJson(key: string, value: unknown): void {
  try {
    memSet(key, JSON.stringify(value));
  } catch {
    /* circular / huge */
  }
}

/** Wipe heavy keys from durable browser storage (one-time per boot). */
export function purgeHeavyLocalStorage(): number {
  if (typeof window === 'undefined') return 0;
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isHeavyStorageKey(k)) keys.push(k);
    }
    for (const k of keys) {
      try {
        localStorage.removeItem(k);
        removed++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* private mode */
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && isHeavyStorageKey(k)) keys.push(k);
    }
    for (const k of keys) {
      try {
        sessionStorage.removeItem(k);
        removed++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return removed;
}

/**
 * Patch localStorage so heavy MedCore keys stay in RAM only.
 * Cloud (Firestore onSnapshot / writes) remains source of truth across PCs.
 */
export function installEdgeCloudOnlyStorage(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  const raw = window.localStorage;
  const protoGet = raw.getItem.bind(raw);
  const protoSet = raw.setItem.bind(raw);
  const protoRemove = raw.removeItem.bind(raw);
  const protoClear = raw.clear.bind(raw);
  const protoKey = raw.key.bind(raw);

  // One-time disk purge of stale facility blobs
  const n = purgeHeavyLocalStorage();
  if (n > 0 && typeof console !== 'undefined') {
    console.info(`[edgeCloudOnly] purged ${n} heavy localStorage keys — cloud is source of truth`);
  }

  raw.getItem = (key: string) => {
    if (isHeavyStorageKey(key)) {
      return mem.has(key) ? (mem.get(key) as string) : null;
    }
    return protoGet(key);
  };

  raw.setItem = (key: string, value: string) => {
    if (isHeavyStorageKey(key)) {
      mem.set(key, String(value));
      return;
    }
    return protoSet(key, value);
  };

  raw.removeItem = (key: string) => {
    if (isHeavyStorageKey(key)) {
      mem.delete(key);
      return;
    }
    return protoRemove(key);
  };

  // clear() still clears durable prefs; heavy already only in mem
  raw.clear = () => {
    mem.clear();
    return protoClear();
  };

  // length/key stay disk-oriented; acceptable for our usage
  void protoKey;
}

/** Unregister service worker caches that can serve stale heavy assets. */
export async function dropServiceWorkerCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

/** Call once at app boot (page.tsx). */
export function enableEdgeCloudOnlyRuntime(): void {
  installEdgeCloudOnlyStorage();
  void dropServiceWorkerCaches();
}
