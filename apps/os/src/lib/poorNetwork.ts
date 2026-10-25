/**
 * Poor-network helpers for hospital desks on 2G / flaky 3G / high RTT.
 * No permanent banners — callers use page sizes, deferred loads, and critical outbox.
 */

export type NetworkTier = 'good' | 'fair' | 'poor' | 'offline';

/** Facility keys that must survive blackout (queue offline). Everything else is best-effort cloud. */
export const CRITICAL_FACILITY_KEYS = new Set<string>([
  'medcore_os_patient_registry_v1',
  'medcore_os_reception_ops_v2',
  'medcore_os_reception_ops_v1',
  'medcore_os_clinical_orders_v1',
  'medcore_os_nursing_vitals_v1',
  'clinical_vitals',
  'medcore_os_bed_board_v1',
  'medcore_os_staff_registry',
  'medcore_staff_id_cards',
  'medcore_os_staff_cards',
  'medcore_os_access_control',
  'medcore_os_notifications_v1',
  'medcore_os_him_v1',
  'medcore_os_theatre_cases_v1',
  'medcore_os_payment_receipts_v1',
  'medcore_os_patient_bills_v1',
  'medcore_os_fd_accounts_requests_v1',
  'medcore_os_formulary_v1',
  'medcore_os_drug_stock_v1',
]);

export function isCriticalFacilityKey(key: string): boolean {
  if (!key) return false;
  if (CRITICAL_FACILITY_KEYS.has(key)) return true;
  // Staff / clinical prefixes that must not be dropped offline
  return (
    key.startsWith('medcore_os_staff') ||
    key.startsWith('medcore_staff') ||
    key.includes('clinical_orders') ||
    key.includes('nursing_vitals') ||
    key.includes('reception_ops')
  );
}

export function getNetworkTier(): NetworkTier {
  if (typeof navigator === 'undefined') return 'good';
  if (!navigator.onLine) return 'offline';
  try {
    const conn =
      (navigator as Navigator & { connection?: NetworkInformation }).connection ||
      (navigator as Navigator & { mozConnection?: NetworkInformation }).mozConnection ||
      (navigator as Navigator & { webkitConnection?: NetworkInformation }).webkitConnection;
    if (conn) {
      const type = String(conn.effectiveType || '').toLowerCase();
      if (conn.saveData) return 'poor';
      if (type === 'slow-2g' || type === '2g') return 'poor';
      if (typeof conn.rtt === 'number' && conn.rtt > 800) return 'poor';
      if (type === '3g' || (typeof conn.rtt === 'number' && conn.rtt > 400)) return 'fair';
    }
  } catch {
    /* ignore */
  }
  return 'good';
}

/** Row limits for lists / workqueues by network quality */
export function listPageSize(tier?: NetworkTier): number {
  const t = tier ?? getNetworkTier();
  if (t === 'offline' || t === 'poor') return 15;
  if (t === 'fair') return 30;
  return 60;
}

/** Defer non-critical module prefetch on poor links */
export function shouldPrefetchModules(tier?: NetworkTier): boolean {
  const t = tier ?? getNetworkTier();
  return t === 'good' || t === 'fair';
}

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};
