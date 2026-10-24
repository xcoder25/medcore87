/**
 * MedCore IndexedDB layer — replaces localStorage for all clinical data stores.
 *
 * WHY IndexedDB over localStorage:
 *  • No 5MB cap — handles hundreds of MBs (patient histories, ICD-10 sets, dense JSON)
 *  • Async / non-blocking — clinicians type notes without keystroke lag
 *  • Multi-tab safe — structured transaction locking prevents data races
 *  • Survives offline — combined with service worker gives full offline-first EMR
 *
 * API surface (intentionally minimal):
 *   idbGet<T>(store, key)         → Promise<T | null>
 *   idbSet(store, key, value)     → Promise<void>
 *   idbGetAll<T>(store)           → Promise<T[]>
 *   idbSetAll(store, records, kf) → Promise<void>   (bulk replace)
 *   idbDelete(store, key)         → Promise<void>
 *   idbClear(store)               → Promise<void>
 *
 * Stores registered — add a new store name and bump DB_VERSION:
 */

export type IDBStoreName =
  | 'staff_cards'
  | 'staff_registry'
  | 'patient_registry'
  | 'bed_board'
  | 'bed_audit'
  | 'reception_ops'
  | 'billing_ledger'
  | 'audit_log'
  | 'role_permissions'
  | 'onboarding'
  | 'access_control'
  | 'facility_catalog';

const DB_NAME = 'medcore_os';
const DB_VERSION = 2; // bump when adding a new store

let _db: IDBDatabase | null = null;
let _opening = false;
let _waiters: Array<(db: IDBDatabase) => void> = [];

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    _waiters.push(resolve);
    if (_opening) return;
    _opening = true;

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const stores: IDBStoreName[] = [
        'staff_cards', 'staff_registry', 'patient_registry',
        'bed_board', 'bed_audit', 'reception_ops', 'billing_ledger',
        'audit_log', 'role_permissions', 'onboarding', 'access_control',
        'facility_catalog',
      ];
      for (const name of stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      _opening = false;
      const waiters = _waiters.splice(0);
      for (const w of waiters) w(_db!);
    };

    req.onerror = () => {
      _opening = false;
      _waiters = [];
      reject(req.error);
    };
  });
}

export async function idbGet<T>(store: IDBStoreName, key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(`idb_fb_${store}_${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

export async function idbSet(store: IDBStoreName, key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(`idb_fb_${store}_${key}`, JSON.stringify(value));
    } catch {
      console.warn('[idb] localStorage fallback also failed — storage quota exceeded?');
    }
  }
}

export async function idbDelete(store: IDBStoreName, key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try { localStorage.removeItem(`idb_fb_${store}_${key}`); } catch { /* ignore */ }
  }
}

export async function idbGetAll<T>(store: IDBStoreName): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Bulk replace — clears the store then writes all records keyed by keyFn.
 * Use for replacing the entire list (e.g. updating all beds after a ward change).
 */
export async function idbSetAll<T>(
  store: IDBStoreName,
  records: T[],
  keyFn: (r: T) => string,
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      os.clear();
      for (const r of records) {
        os.put(r, keyFn(r));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    console.warn('[idb] idbSetAll failed — store:', store);
  }
}

export async function idbClear(store: IDBStoreName): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

/**
 * One-time migration: moves existing localStorage data into IndexedDB after first login.
 * Safe to call multiple times — skips if already done.
 * Does NOT delete localStorage entries (kept as 30-day safety backup).
 */
export async function migrateLocalStorageToIDB(
  migrations: Array<{ lsKey: string; idbStore: IDBStoreName; idbKey: string }>,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const FLAG = 'medcore_idb_migration_v2';
  if (localStorage.getItem(FLAG) === 'done') return;

  const promises: Promise<void>[] = [];
  for (const { lsKey, idbStore, idbKey } of migrations) {
    const raw = localStorage.getItem(lsKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      promises.push(idbSet(idbStore, idbKey, parsed));
    } catch {
      // malformed JSON in localStorage — skip silently
    }
  }
  await Promise.all(promises);
  localStorage.setItem(FLAG, 'done');
}
