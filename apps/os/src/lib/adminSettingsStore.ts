/**
 * Facility / hospital admin settings — realtime across workstations.
 * localStorage first → BroadcastChannel / storage events → durable outbox → Firestore.
 */
import { enqueueFacilitySync } from './durableOutbox';
import { getActiveFacilityId } from './adminRealtimeStore';
import { publishFacilityData } from './roleSyncBus';

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
  logoUrl?: string;
  state: string;
  lga: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  hospitalTier: 'district_general' | 'secondary_specialist' | 'tertiary_teaching' | 'primary_health_centre';
  facilityType: string;
  ownership: 'public_state' | 'public_federal' | 'mission' | 'private' | 'ppp';
  licenseNo: string;
  licenseExpiry: string;
  registrationNo: string;
  medicalDirector: string;
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
  operates24x7: boolean;
  emergency24x7: boolean;

  /** Clinical Governance & Protocols */
  triageProtocol: 'NEWS2' | 'ESI';
  requireVitalsBeforeConsult: boolean;
  unattendedQueueAlertMins: number;
  requireBillingClearanceBeforeDischarge: boolean;
  allowEmergencyUnpaidOverride?: boolean;

  /** Insurance & NHIA / AKSHIA / HMO */
  nhiaProviderCode: string;
  akshiaProviderId: string;
  insuranceCopayPercent: number;
  preAuthThresholdNgn: number;
  autoVerifyInsuranceOnCheckin: boolean;
  acceptsNhis: boolean;
  acceptsHmo: boolean;
  acceptedHmoList: string;

  /** Feature toggles & AI */
  aiReceptionEnabled: boolean;
  aiQueueReminders: boolean;
  requireConfirmBeforeCheckIn: boolean;
  allowWalkInWithoutNin: boolean;
  maintenanceMessage: string;
  akwaremitMerchantId: string;
  akwaremitEnvironment: 'live' | 'test';

  /** Staff 2FA / Email OTP Security */
  requireStaffMfa: boolean;
  allowMfaBackupCodeFallback: boolean;
  otpExpiryMinutes: number;

  updatedAt: string;
  updatedBy?: string;
}

const DEFAULTS: Omit<AdminFacilitySettings, 'facilityId' | 'updatedAt'> = {
  displayName: '',
  shortCode: '',
  logoUrl: '',
  state: 'Akwa Ibom',
  lga: 'Eket',
  address: '',
  phone: '',
  emergencyPhone: '0800-MEDCORE-911',
  email: '',
  hospitalTier: 'district_general',
  facilityType: 'General Hospital',
  ownership: 'public_state',
  licenseNo: '',
  licenseExpiry: '',
  registrationNo: '',
  medicalDirector: '',
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
  posTerminals: [],

  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  operates24x7: true,
  emergency24x7: true,

  triageProtocol: 'NEWS2',
  requireVitalsBeforeConsult: true,
  unattendedQueueAlertMins: 45,
  requireBillingClearanceBeforeDischarge: true,

  nhiaProviderCode: 'NHIA-AKS-0042',
  akshiaProviderId: 'AKSHIA-SEC-019',
  insuranceCopayPercent: 10,
  preAuthThresholdNgn: 50000,
  autoVerifyInsuranceOnCheckin: true,
  acceptsNhis: true,
  acceptsHmo: true,
  acceptedHmoList: 'Hygeia, AXA Mansard, Leadway, Reliance HMO',

  aiReceptionEnabled: true,
  aiQueueReminders: true,
  requireConfirmBeforeCheckIn: true,
  allowWalkInWithoutNin: true,
  maintenanceMessage: '',
  akwaremitMerchantId: 'AKW-MERCH-88210',
  akwaremitEnvironment: 'live',

  requireStaffMfa: true,
  allowMfaBackupCodeFallback: true,
  otpExpiryMinutes: 5,

  updatedBy: undefined,
};

function facilityKey(facilityId: string) {
  return `${ADMIN_SETTINGS_KEY}:${facilityId || 'DEFAULT'}`;
}

/**
 * SECURITY INVARIANT:
 * Secret API Keys & Webhook Secrets remain strictly on the server (Environment variables / Server Vault).
 * They are stripped before writing to client localStorage, BroadcastChannel, or outbox sync.
 */
function sanitizeClientSettings(settings: AdminFacilitySettings): AdminFacilitySettings {
  const safe = { ...settings };
  delete (safe as any).akwaremitApiKey;
  delete (safe as any).akwaremitWebhookSecret;
  delete (safe as any).paystackSecretKey;
  return safe;
}

function readRaw(facilityId: string): AdminFacilitySettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(facilityKey(facilityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminFacilitySettings;
    return sanitizeClientSettings(parsed);
  } catch {
    return null;
  }
}

function writeRaw(settings: AdminFacilitySettings) {
  if (typeof window === 'undefined') return;
  const safe = sanitizeClientSettings(settings);
  localStorage.setItem(facilityKey(safe.facilityId), JSON.stringify(safe));
  // Also mirror under generic key for older readers
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(safe));
  window.dispatchEvent(new CustomEvent('medcore-admin-settings', { detail: safe }));
  window.dispatchEvent(
    new CustomEvent('medcore-admin-sync', { detail: { key: ADMIN_SETTINGS_KEY, settings: safe } })
  );
  try {
    const bc = new BroadcastChannel('medcore_admin');
    bc.postMessage({ type: 'settings', settings: safe });
    bc.close();
  } catch {
    /* ignore */
  }
  // Realtime cloud + onsite hub (same path as clinical facility data)
  try {
    publishFacilityData(safe.facilityId, ADMIN_SETTINGS_KEY, safe);
    publishFacilityData(safe.facilityId, 'adminSettings', safe);
  } catch {
    void enqueueFacilitySync(safe.facilityId, ADMIN_SETTINGS_KEY, safe);
    void enqueueFacilitySync(safe.facilityId, 'adminSettings', safe);
  }
}

export function getAdminSettings(facilityId?: string): AdminFacilitySettings {
  const fid = facilityId || getActiveFacilityId() || 'DEFAULT-HOSPITAL';
  let existing = readRaw(fid);
  // Fallback: cloud/onboarding may have written the unscoped key
  if (!existing && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ADMIN_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminFacilitySettings;
        if (!parsed.facilityId || parsed.facilityId === fid || parsed.facilityId === 'DEFAULT-HOSPITAL') {
          existing = parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }
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
  // Bi-directionally mirror shared identity, licensing, hours, tariff, and insurance fields into FacilityCatalog
  if (typeof window !== 'undefined') {
    try {
      const catKey = `medcore_facility_catalog_v1:${next.facilityId || 'DEFAULT'}`;
      const rawCat = localStorage.getItem(catKey) || localStorage.getItem('medcore_facility_catalog_v1');
      const existingCat = rawCat ? JSON.parse(rawCat) : { facilityId: next.facilityId };
      const tierLabelMap: Record<string, string> = {
        primary_health_centre: 'Primary Care (PHC)',
        district_general: 'Secondary Care',
        secondary_specialist: 'Secondary Specialist',
        tertiary_teaching: 'Tertiary Care',
      };
      const syncedCat = {
        ...existingCat,
        facilityId: next.facilityId,
        name: next.displayName || existingCat.name || '',
        type: next.facilityType || existingCat.type || 'General Hospital',
        tier: tierLabelMap[next.hospitalTier] || existingCat.tier || 'Secondary Care',
        ownership: next.ownership || existingCat.ownership || 'public_state',
        lga: next.lga || existingCat.lga || '',
        address: next.address || existingCat.address || '',
        phone: next.phone || existingCat.phone || '',
        email: next.email || existingCat.email || '',
        licenseNo: next.licenseNo || existingCat.licenseNo || '',
        licenseExpiry: next.licenseExpiry || existingCat.licenseExpiry || '',
        registrationNo: next.registrationNo || existingCat.registrationNo || '',
        medicalDirector: next.medicalDirector || existingCat.medicalDirector || '',
        workingHoursStart: next.workingHoursStart || existingCat.workingHoursStart || '08:00',
        workingHoursEnd: next.workingHoursEnd || existingCat.workingHoursEnd || '18:00',
        operates24x7: next.operates24x7 ?? existingCat.operates24x7 ?? true,
        emergency24x7: next.emergency24x7 ?? existingCat.emergency24x7 ?? true,
        defaultOpdFeeNgn: next.defaultOpdFeeNgn ?? existingCat.defaultOpdFeeNgn ?? 5000,
        acceptsNhis: next.acceptsNhis ?? existingCat.acceptsNhis ?? true,
        acceptsHmo: next.acceptsHmo ?? existingCat.acceptsHmo ?? true,
        acceptedHmoList: next.acceptedHmoList ?? existingCat.acceptedHmoList ?? '',
        updatedAt: next.updatedAt,
        updatedBy: next.updatedBy,
      };
      localStorage.setItem(catKey, JSON.stringify(syncedCat));
      localStorage.setItem('medcore_facility_catalog_v1', JSON.stringify(syncedCat));
      localStorage.setItem(
        `medcore_hospital_profile_${next.facilityId}`,
        JSON.stringify({
          id: next.facilityId,
          name: syncedCat.name,
          type: syncedCat.type,
          lga: syncedCat.lga,
          address: syncedCat.address,
          phone: syncedCat.phone,
          email: syncedCat.email,
          licenseNo: syncedCat.licenseNo,
          licenseExpiry: syncedCat.licenseExpiry,
          status: 'active',
          tier: syncedCat.tier,
          medicalDirector: syncedCat.medicalDirector,
        })
      );
      window.dispatchEvent(new CustomEvent('medcore-facility-catalog', { detail: syncedCat }));
      const fullFacilityName = next.displayName
        ? (next.lga ? `${next.displayName}, ${next.lga}` : next.displayName)
        : syncedCat.name;
      window.dispatchEvent(
        new CustomEvent('medcore-facility-updated', {
          detail: { ...next, fullFacilityName },
        })
      );
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
