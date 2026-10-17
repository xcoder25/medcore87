/**
 * Facility / hospital admin settings — realtime across workstations.
 * localStorage first → BroadcastChannel / storage events → durable outbox → Firestore.
 */
import { enqueueFacilitySync } from './durableOutbox';
import { getActiveFacilityId } from './adminRealtimeStore';

export const ADMIN_SETTINGS_KEY = 'medcore_os_admin_settings_v1';

export type SyncPreference = 'auto' | 'local_only' | 'lan_preferred' | 'cloud_preferred';

export interface PosTerminalConfig {
  id: string;
  terminalId: string;
  serialNumber?: string;
  tillNumber: string;
  department: string;
  subaccountCode?: string;
  active: boolean;
  notes?: string;
}

export interface AdminFacilitySettings {
  facilityId: string;
  displayName: string;
  shortCode: string;
  state: string;
  lga: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  hospitalTier: 'district_general' | 'secondary_specialist' | 'tertiary_teaching' | 'primary_health_centre';
  receiptFooterText: string;

  /** Hospital LAN hub base URL e.g. http://192.168.1.10:4000 */
  lanApiUrl: string;
  syncPreference: SyncPreference;

  /** Revenue & AkwaRemit / POS */
  akwaremitEnabled: boolean;
  akwaremitRevenueHead: string;
  akwaremitRevenueSubhead: string;
  dualControlShiftEnforced: boolean;
  cashHoldingLimitNgn: number;
  defaultOpdFeeNgn: number;
  emergencyTriageFeeNgn: number;
  defaultLabFeeNgn: number;
  pharmacyMarkupPercent: number;
  posTerminals: PosTerminalConfig[];

  /** Operations & Hours */
  workingHoursStart: string;
  workingHoursEnd: string;

  /** Clinical Governance & Protocols */
  triageProtocol: 'NEWS2' | 'ESI';
  requireVitalsBeforeConsult: boolean;
  unattendedQueueAlertMins: number;
  requireBillingClearanceBeforeDischarge: boolean;

  /** Insurance & NHIA / AKSHIA */
  nhiaProviderCode: string;
  akshiaProviderId: string;
  insuranceCopayPercent: number;
  preAuthThresholdNgn: number;
  autoVerifyInsuranceOnCheckin: boolean;

  /** Feature toggles & AI */
  aiReceptionEnabled: boolean;
  aiQueueReminders: boolean;
  requireConfirmBeforeCheckIn: boolean;
  allowWalkInWithoutNin: boolean;
  maintenanceMessage: string;
  geminiApiKey: string;
  paystackPublicKey: string;

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
  emergencyPhone: '0800-MEDCORE-911',
  email: '',
  hospitalTier: 'district_general',
  receiptFooterText: 'Official State Revenue Receipt. Thank you for your service.',

  lanApiUrl: '',
  syncPreference: 'auto',

  akwaremitEnabled: true,
  akwaremitRevenueHead: 'REV-HEAD-AKS-HEALTH',
  akwaremitRevenueSubhead: 'SUB-HEAD-004-HOSPITAL-OPS',
  dualControlShiftEnforced: true,
  cashHoldingLimitNgn: 200000,
  defaultOpdFeeNgn: 5000,
  emergencyTriageFeeNgn: 3000,
  defaultLabFeeNgn: 3500,
  pharmacyMarkupPercent: 10,
  posTerminals: [
    {
      id: 'POS-01',
      terminalId: 'TERM-IGH-01',
      serialNumber: 'PS-6481029',
      tillNumber: 'TILL-01',
      department: 'Central Cashier',
      subaccountCode: 'ACCT_eket01',
      active: true,
      notes: 'Main Reception Desk POS',
    },
    {
      id: 'POS-02',
      terminalId: 'TERM-IGH-02',
      serialNumber: 'PS-9923841',
      tillNumber: 'TILL-02',
      department: 'Pharmacy Cashier',
      subaccountCode: 'ACCT_eket01',
      active: true,
      notes: 'Pharmacy Dispensing POS',
    },
    {
      id: 'POS-03',
      terminalId: 'TERM-IGH-03',
      serialNumber: 'PS-1184920',
      tillNumber: 'TILL-03',
      department: 'Emergency & A&E',
      subaccountCode: 'ACCT_eket01',
      active: true,
      notes: 'A&E Surge POS',
    },
  ],

  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',

  triageProtocol: 'NEWS2',
  requireVitalsBeforeConsult: true,
  unattendedQueueAlertMins: 45,
  requireBillingClearanceBeforeDischarge: true,

  nhiaProviderCode: 'NHIA-AKS-0042',
  akshiaProviderId: 'AKSHIA-SEC-019',
  insuranceCopayPercent: 10,
  preAuthThresholdNgn: 50000,
  autoVerifyInsuranceOnCheckin: true,

  aiReceptionEnabled: true,
  aiQueueReminders: true,
  requireConfirmBeforeCheckIn: true,
  allowWalkInWithoutNin: true,
  maintenanceMessage: '',
  geminiApiKey: '',
  paystackPublicKey: '',
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
