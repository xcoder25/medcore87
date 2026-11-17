/**
 * HIPAA Privacy & Shared-Workstation PHI Scrubbing Utilities (§164.312).
 * Ensures no patient health information (PHI) or session credentials remain in
 * browser storage after manual sign-out or inactivity auto-logoff.
 */
import { appendAudit } from './auditLogStore';

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
  } catch {
    /* ignore */
  }

  if (typeof fetch !== 'undefined') {
    void fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
  }
}
