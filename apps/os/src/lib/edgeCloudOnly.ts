/**
 * Edge + Cloud + On-Prem Runtime Mode (Zero-localStorage Architecture).
 *
 * All `medcore_*` clinical, staff, operational, session, and admin keys are
 * strictly prohibited from durable `window.localStorage`.
 *
 * - Source of truth: Cloud (`/api/facility/sync` — Aurora PostgreSQL + Server Vault)
 *   and On-Prem LAN Hub (`hospitalSync`).
 * - Browser runtime cache: Session RAM (`mem` Map) + tab-scoped `sessionStorage`
 *   for active login tab reload continuity.
 * - Only 2 non-PII UI flags are permitted in `localStorage`:
 *   1. `medcore_remember_me` (boolean flag)
 *   2. `medcore_ui_theme` ('light' | 'dark')
 *   (Plus Firebase Auth SDK's internal `firebase:authUser:*` keys).
 */

const ALLOWED_LOCALSTORAGE_KEYS = new Set<string>([
  'medcore_remember_me',
  'medcore_ui_theme',
  'medcore_pilot_version',
]);

/** Keys mirrored to tab-scoped `sessionStorage` so F5 reload in the same tab stays signed in without localStorage */
const SESSION_TAB_PREFIXES = [
  'medcore_os_session',
  'medcore_pilot_version',
  'medcore_claimed_facility_id',
  'medcore_claimed_facility_name',
  'medcore_lan_api_url',
  'medcore_admin_onboarding_done',
  'medcore_os_onboarding',
  'medcore_os_admin_settings_v1',
  'medcore_facility_profile',
  'medcore_os_facilities',
  'medcore_os_staff_cards',
  'medcore_staff_id_cards',
  'medcore_os_staff_registry',
  'medcore_staff_registry',
  'medcore_os_access_control',
  'medcore_access_records',
  'medcore_role_permissions_v1',
  'medcore_role_permissions_v4',
] as const;

function isSessionTabKey(key: string): boolean {
  if (!key) return false;
  return SESSION_TAB_PREFIXES.some((p) => key === p || key.startsWith(p) || key.startsWith(`${p}:`));
}

/** In-memory facility data for this browser tab session */
const mem = new Map<string, string>();

let installed = false;
let rawSessionStorage: Storage | null = null;

/**
 * Returns true for every MedCore key that must NOT live in durable `localStorage`.
 */
export function isHeavyStorageKey(key: string): boolean {
  if (!key) return false;
  if (ALLOWED_LOCALSTORAGE_KEYS.has(key)) return false;
  if (key.startsWith('firebase:')) return false;
  if (
    key.startsWith('medcore_') ||
    key === 'clinical_vitals' ||
    key === 'adminSettings'
  ) {
    return true;
  }
  return false;
}

export function memGet(key: string): string | null {
  if (mem.has(key)) return mem.get(key) ?? null;
  if (rawSessionStorage && isSessionTabKey(key)) {
    try {
      const fromTab = rawSessionStorage.getItem(key);
      if (fromTab !== null) {
        mem.set(key, fromTab);
        return fromTab;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function memSet(key: string, value: string): void {
  const str = String(value);
  mem.set(key, str);
  if (rawSessionStorage && isSessionTabKey(key)) {
    try {
      rawSessionStorage.setItem(key, str);
    } catch {
      /* quota */
    }
  }
}

export function memRemove(key: string): void {
  mem.delete(key);
  if (rawSessionStorage) {
    try {
      rawSessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
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

// Background cloud-sync queue for any intercepted writes
const pendingSyncBag: Record<string, unknown> = {};
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let suppressCloudMirrorDepth = 0;

/**
 * Run a callback while suppressing Cloud mirror write-backs (used when hydrating remote state).
 */
export function withRemoteHydration<T>(fn: () => T): T {
  suppressCloudMirrorDepth++;
  try {
    return fn();
  } finally {
    suppressCloudMirrorDepth = Math.max(0, suppressCloudMirrorDepth - 1);
  }
}

function resolveActiveFacilityForSync(): string {
  try {
    const sessRaw = memGet('medcore_os_session');
    if (sessRaw) {
      const parsed = JSON.parse(sessRaw) as { hospitalId?: string };
      if (parsed?.hospitalId) return String(parsed.hospitalId).trim();
    }
    const claimed = memGet('medcore_claimed_facility_id');
    if (claimed) return claimed.trim();
  } catch {
    /* ignore */
  }
  return 'DEFAULT';
}

function queueCloudMirror(key: string, rawVal: string): void {
  if (typeof window === 'undefined' || suppressCloudMirrorDepth > 0) return;
  if (
    key.startsWith('medcore_os_sync_outbox') ||
    key === 'medcore_os_session' ||
    key === 'medcore_os_admin_activity' ||
    key === 'medcore_os_staff_presence_v1' ||
    key.includes('secret')
  ) {
    return;
  }
  try {
    pendingSyncBag[key] = JSON.parse(rawVal);
  } catch {
    pendingSyncBag[key] = rawVal;
  }
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const facilityId = resolveActiveFacilityForSync();
    const batch = { ...pendingSyncBag };
    for (const k of Object.keys(pendingSyncBag)) delete pendingSyncBag[k];
    if (Object.keys(batch).length === 0) return;
    void fetch('/api/facility/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, data: batch }),
    }).catch(() => {});
  }, 600);
}

/**
 * Migrate any legacy `medcore_*` keys out of `window.localStorage` into Session RAM + Cloud,
 * then wipe them from `window.localStorage` so disk storage is clean.
 */
export function purgeHeavyLocalStorage(): number {
  if (typeof window === 'undefined') return 0;
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && isHeavyStorageKey(k)) keys.push(k);
    }
    for (const k of keys) {
      try {
        const existingVal = window.localStorage.getItem(k);
        if (existingVal !== null && !mem.has(k)) {
          memSet(k, existingVal);
          queueCloudMirror(k, existingVal);
        }
        window.localStorage.removeItem(k);
        removed++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* private mode */
  }
  return removed;
}

/**
 * Patch `window.localStorage` so all `medcore_*` keys live in Session RAM + Cloud/On-Prem only.
 */
export function installEdgeCloudOnlyStorage(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  try {
    rawSessionStorage = window.sessionStorage;
  } catch {
    rawSessionStorage = null;
  }

  const raw = window.localStorage;
  const protoGet = raw.getItem.bind(raw);
  const protoSet = raw.setItem.bind(raw);
  const protoRemove = raw.removeItem.bind(raw);
  const protoClear = raw.clear.bind(raw);

  // Hydrate Session RAM from tab sessionStorage if reloading the tab
  if (rawSessionStorage) {
    try {
      for (let i = 0; i < rawSessionStorage.length; i++) {
        const k = rawSessionStorage.key(i);
        if (k && isHeavyStorageKey(k)) {
          const v = rawSessionStorage.getItem(k);
          if (v !== null) mem.set(k, v);
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Migrate and wipe all legacy medcore_* keys from disk localStorage
  const n = purgeHeavyLocalStorage();
  if (n > 0 && typeof console !== 'undefined') {
    console.info(
      `[edgeCloudOnly] migrated & purged ${n} localStorage keys — Cloud & On-Prem are sole source of truth`
    );
  }

  raw.getItem = (key: string) => {
    if (isHeavyStorageKey(key)) {
      return memGet(key);
    }
    return protoGet(key);
  };

  raw.setItem = (key: string, value: string) => {
    if (isHeavyStorageKey(key)) {
      const str = String(value);
      if (mem.get(key) === str) return;
      memSet(key, str);
      queueCloudMirror(key, str);
      return;
    }
    return protoSet(key, value);
  };

  raw.removeItem = (key: string) => {
    if (isHeavyStorageKey(key)) {
      memRemove(key);
      try {
        protoRemove(key);
      } catch {
        /* ignore */
      }
      return;
    }
    return protoRemove(key);
  };

  raw.clear = () => {
    mem.clear();
    if (rawSessionStorage) {
      try {
        rawSessionStorage.clear();
      } catch {
        /* ignore */
      }
    }
    return protoClear();
  };
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
