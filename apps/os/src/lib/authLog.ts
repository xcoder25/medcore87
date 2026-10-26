/**
 * Structured auth logging — never log passwords / PINs / tokens.
 */

export type AuthLogEvent =
  | 'sign_in_start'
  | 'sign_in_ok'
  | 'sign_in_fail'
  | 'first_admin_claim'
  | 'session_force_logout'
  | 'staff_not_enrolled';

export function authLog(
  event: AuthLogEvent,
  detail: {
    mode?: 'badge' | 'email';
    facilityId?: string;
    badgeId?: string;
    emailDomain?: string;
    code?: string;
    reason?: string;
  } = {}
): void {
  try {
    const payload = {
      ts: new Date().toISOString(),
      event,
      mode: detail.mode,
      facilityId: detail.facilityId ? String(detail.facilityId).toUpperCase() : undefined,
      badgeId: detail.badgeId
        ? String(detail.badgeId)
            .toUpperCase()
            .replace(/\s+/g, '')
            .slice(0, 32)
        : undefined,
      emailDomain: detail.emailDomain,
      code: detail.code,
      reason: detail.reason,
    };
    if (event === 'sign_in_fail' || event === 'session_force_logout') {
      console.warn('[auth]', payload);
    } else if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.info('[auth]', payload);
    }
  } catch {
    /* ignore */
  }
}

export function emailDomainOnly(email: string): string | undefined {
  const e = String(email || '').trim().toLowerCase();
  const i = e.indexOf('@');
  if (i < 0) return undefined;
  return e.slice(i + 1).slice(0, 64);
}
