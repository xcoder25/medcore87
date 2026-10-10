/**
 * Facility / hospital admin settings — realtime across workstations.
 * localStorage first → BroadcastChannel / storage events → durable outbox → Firestore.
 */
import { enqueueFacilitySync } from './durableOutbox';
import { getActiveFacilityId } from './adminRealtimeStore';

export const ADMIN_SETTINGS_KEY = 'medcore_os_admin_settings_v1';

export type SyncPreference = 'auto' | 'local_only' | 'lan_preferred' | 'cloud_preferred';

export interface AdminFacilitySettings {
  facilityId: string;
  displayName: string;
  shortCode: string;
  state: string;
  lga: string;
  address: string;
  phone: string;
  email: string;
  /** Hospital LAN hub base URL e.g. http://192.168.1.10:4000 */
  lanApiUrl: string;
  syncPreference: SyncPreference;
  /** Reception / OPD */
  defaultOpdFeeNgn: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  /** Feature toggles */
  aiReceptionEnabled: boolean;
  aiQueueReminders: boolean;
  requireConfirmBeforeCheckIn: boolean;
  allowWalkInWithoutNin: boolean;
  /** Soft notice on dashboards */
  maintenanceMessage: string;
  /** Optional facility fallback only — production must use server GEMINI_API_KEY */
  geminiApiKey: string;
  /** Paystack public key (pk_live_… / pk_test_…) for reception payments */
  paystackPublicKey: string;
  /** Default lab fee NGN when order placed */
  defaultLabFeeNgn: number;
  updatedAt: string;
  updatedBy?: string;
}

const DEFAULTS: Omit<AdminFacilitySettings, 'facilityId' | 'updatedAt'> = {
  displayName: '',
  shortCode: '',
  state: 'Akwa Ibom',
  lga: 'Eket',
  address: '',
  phone: '',
  email: '',
  lanApiUrl: '',
  syncPreference: 'auto',
  defaultOpdFeeNgn: 5000,
  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  aiReceptionEnabled: true,
  aiQueueReminders: true,
  requireConfirmBeforeCheckIn: true,
  allowWalkInWithoutNin: true,
  maintenanceMessage: '',
  geminiApiKey: '',
  paystackPublicKey: '',
  defaultLabFeeNgn: 3500,
  updatedBy: undefined,
};

function facilityKey(facilityId: string) {
  return `${ADMIN_SETTINGS_KEY}:${facilityId || 'DEFAULT'}`;
}

function readRaw(facilityId: string): AdminFacilitySettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(facilityKey(facilityId));
    if (!raw) return null;
    return JSON.parse(raw) as AdminFacilitySettings;
  } catch {
    return null;
  }
}

function writeRaw(settings: AdminFacilitySettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(facilityKey(settings.facilityId), JSON.stringify(settings));
  // Also mirror under generic key for older readers
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('medcore-admin-settings', { detail: settings }));
  window.dispatchEvent(
    new CustomEvent('medcore-admin-sync', { detail: { key: ADMIN_SETTINGS_KEY, settings } })
  );
  try {
    const bc = new BroadcastChannel('medcore_admin');
    bc.postMessage({ type: 'settings', settings });
    bc.close();
  } catch {
    /* ignore */
  }
  // Durable cloud / hub
  void enqueueFacilitySync(settings.facilityId, ADMIN_SETTINGS_KEY, settings);
  void enqueueFacilitySync(settings.facilityId, 'adminSettings', settings);
}

export function getAdminSettings(facilityId?: string): AdminFacilitySettings {
  const fid = facilityId || getActiveFacilityId() || 'DEFAULT-HOSPITAL';
  const existing = readRaw(fid);
  if (existing) {
    return { ...DEFAULTS, ...existing, facilityId: fid };
  }
  return {
    ...DEFAULTS,
    facilityId: fid,
    updatedAt: new Date().toISOString(),
  };
}

export function saveAdminSettings(
  partial: Partial<AdminFacilitySettings> & { facilityId: string },
  updatedBy?: string
): AdminFacilitySettings {
  const current = getAdminSettings(partial.facilityId);
  const next: AdminFacilitySettings = {
    ...current,
    ...partial,
    facilityId: partial.facilityId,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy,
  };
  writeRaw(next);
  // Apply LAN URL immediately for hospital sync if provided
  if (typeof window !== 'undefined' && next.lanApiUrl) {
    try {
      (window as unknown as { __MEDCORE_API_URL?: string }).__MEDCORE_API_URL = next.lanApiUrl;
      localStorage.setItem('medcore_lan_api_url', next.lanApiUrl);
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function subscribeAdminSettings(cb: (s: AdminFacilitySettings) => void): () => void {
  const handler = () => {
    cb(getAdminSettings());
  };
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d && d.facilityId) cb({ ...DEFAULTS, ...d });
    else handler();
  };
  window.addEventListener('medcore-admin-settings', onCustom as EventListener);
  window.addEventListener('medcore-admin-sync', handler);
  window.addEventListener('storage', handler);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('medcore_admin');
    bc.onmessage = () => handler();
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener('medcore-admin-settings', onCustom as EventListener);
    window.removeEventListener('medcore-admin-sync', handler);
    window.removeEventListener('storage', handler);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}

export function resetAdminSettings(facilityId: string, updatedBy?: string) {
  const next: AdminFacilitySettings = {
    ...DEFAULTS,
    facilityId,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  writeRaw(next);
  return next;
}
