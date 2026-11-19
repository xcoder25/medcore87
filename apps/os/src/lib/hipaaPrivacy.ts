/**
 * HIPAA Privacy & Shared-Workstation PHI Scrubbing Utilities (§164.312).
 * Ensures no patient health information (PHI) or session credentials remain in
 * browser storage after manual sign-out or inactivity auto-logoff.
 */
import { appendAudit } from './auditLogStore';

export const SECRET_FIELD_KEYS = [
  'pin',
  'password',
  'pass',
  'pinHash',
  'pin_hash',
  'token',
  'idToken',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'webhookSecret',
  'akwaremitApiKey',
  'akwaremitWebhookSecret',
  'paystackSecretKey',
  'privateKey',
] as const;

const SECRET_FIELD_KEYS_LOWER = new Set(SECRET_FIELD_KEYS.map((k) => k.toLowerCase()));

/**
 * Recursively strips all secret fields (PINs, passwords, tokens, API/webhook secrets)
 * before serializing objects into browser storage or client caches.
 */
export function stripSecretsDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripSecretsDeep(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELD_KEYS_LOWER.has(k.toLowerCase())) continue;
    out[k] = stripSecretsDeep(v);
  }
  return out as T;
}

/**
 * Parses JSON payloads (when applicable) and strips all secret keys recursively.
 */
export function sanitizeStorageString(raw: string): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return raw;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(stripSecretsDeep(parsed));
  } catch {
    return raw;
  }
}

export const PHI_LOCAL_STORAGE_KEYS: readonly string[] = [
  'medcore_os_patient_registry_v1',
  'medcore_os_reception_ops_v2',
  'medcore_os_clinical_orders_v1',
  'medcore_os_nursing_vitals_v1',
  'medcore_os_vitals_v1',
  'medcore_os_bed_board_v1',
  'medcore_os_patient_bills_v1',
  'medcore_os_fd_accounts_requests_v1',
  'medcore_os_notifications_v1',
  'medcore_os_him_v1',
  'medcore_os_theatre_cases_v1',
  'medcore_os_patient_context_v1',
  'medcore_os_patient_wallets_v1',
  'medcore_os_akwaremit_ledger_v1',
  'medcore_os_ambulance_v1',
  'medcore_anc_plans_v1',
  'medcore_os_session',
  'medcore_platform_admin_override',
  'medcore_os_staff_registry',
  'medcore_staff_registry',
  'medcore_staff_id_cards',
  'medcore_os_staff_cards',
  'medcore_staff_cards',
];

export function scrubPhiOnLogout(opts?: {
  reason?: 'manual_logout' | 'inactivity_timeout' | 'session_lock';
  facilityId?: string;
  actor?: string;
  actorBadge?: string;
}): void {
  if (typeof window === 'undefined') return;

  const reason = opts?.reason || 'manual_logout';
  try {
    if (opts?.facilityId && opts?.actor) {
      appendAudit({
        facilityId: opts.facilityId,
        actor: opts.actor,
        actorBadge: opts.actorBadge,
        category: 'access',
        severity: reason === 'inactivity_timeout' ? 'notable' : 'normal',
        action: reason === 'inactivity_timeout' ? 'HIPAA_INACTIVITY_AUTOLOCK' : 'HIPAA_WORKSTATION_LOGOUT',
        entity: 'workstation_session',
        entityId: opts.actorBadge || opts.actor,
        detail:
          reason === 'inactivity_timeout'
            ? 'Workstation automatically locked & PHI scrubbed after inactivity timeout'
            : 'Staff signed out & local browser PHI caches scrubbed',
      });
    }
  } catch {
    /* ignore */
  }

  for (const key of PHI_LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  try {
    sessionStorage.removeItem('medcore_focus_patient');
    sessionStorage.removeItem('medcore_os_patient_context_v1');
    sessionStorage.removeItem('medcore_session_pin');
  } catch {
    /* ignore */
  }

  if (typeof fetch !== 'undefined') {
    void fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
  }
}
