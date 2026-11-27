/**
 * Cross-platform persistent storage bridge for MedCore Mobile.
 * Uses window.localStorage on Web and expo-file-system document vault on iOS/Android.
 */
import * as FileSystem from 'expo-file-system';

export const SESSION_STORAGE_KEY = 'medcore_mobile_session_v1';
export const EMR_URL_STORAGE_KEY = 'medcore_mobile_emr_url_v1';
export const OFFLINE_QUEUE_KEY = 'medcore_offline_mutation_queue_v1';

const FS = FileSystem as any;
const VAULT_FILE = FS?.documentDirectory ? `${FS.documentDirectory}medcore_mobile_vault_v1.json` : null;

const memoryStore: Record<string, string> = {};
let initialized = false;

async function persistNativeVault(): Promise<void> {
  if (!VAULT_FILE || typeof FS?.writeAsStringAsync !== 'function') return;
  try {
    await FS.writeAsStringAsync(VAULT_FILE, JSON.stringify(memoryStore));
  } catch {
    /* ignore write error */
  }
}

export async function initNativeStorage(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('medcore_')) {
          const v = window.localStorage.getItem(k);
          if (v !== null) memoryStore[k] = v;
        }
      }
    } catch {
      /* ignore */
    }
    return;
  }
  if (VAULT_FILE && typeof FS?.readAsStringAsync === 'function') {
    try {
      const info = typeof FS?.getInfoAsync === 'function' ? await FS.getInfoAsync(VAULT_FILE) : { exists: true };
      if (info?.exists) {
        const raw = await FS.readAsStringAsync(VAULT_FILE);
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed && typeof parsed === 'object') {
          Object.assign(memoryStore, parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

export function getStoredItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) memoryStore[key] = val;
      return val;
    }
  } catch {
    /* ignore */
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
}

export function setStoredItem(key: string, value: string): void {
  memoryStore[key] = value;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    /* ignore */
  }
  void persistNativeVault();
}

export function removeStoredItem(key: string): void {
  delete memoryStore[key];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  void persistNativeVault();
}

export function clearPhiStorage(): void {
  for (const k of Object.keys(memoryStore)) {
    if (k !== EMR_URL_STORAGE_KEY) {
      delete memoryStore[k];
    }
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith('medcore_') && k !== EMR_URL_STORAGE_KEY) {
          window.localStorage.removeItem(k);
        }
      }
    }
  } catch {
    /* ignore */
  }
  void persistNativeVault();
}
