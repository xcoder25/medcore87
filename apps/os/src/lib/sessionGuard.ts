import { authLog } from './authLog';
/**
 * Force logout only when the account is clearly deleted/revoked.
 *
 * Design rules (hospital admin / multi-facility safe):
 * - Local PIN sessions never logout on Firebase Auth null (no cloud user required).
 * - hospital_admin is never kicked for "removed_from_directory" (directory lag is common
 *   right after first claim / onboarding / facility switch).
 * - Directory removal only applies after this badge was seen in cloud AND later gone,
 *   past a grace period, and only for non-admin roles.
 * - Auth deletion requires: we saw a Firebase user for THIS session, then token proves
 *   user-not-found / disabled — not a transient null during hydration.
 */

import type { UserSession } from '../components/auth/AuthScreen';

export type ForceLogoutReason =
  | 'auth_deleted'
  | 'auth_disabled'
  | 'revoked'
  | 'removed_from_directory'
  | 'token_invalid';

type LogoutFn = (reason: ForceLogoutReason) => void;

function normBadge(id: string): string {
  return String(id || '')
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isLocalPinSession(session: UserSession): boolean {
  const m = String(session.authMethod || '').toLowerCase();
  return m.includes('pin') || m.includes('local') || m.includes('staff id');
}

function isHospitalAdmin(session: UserSession): boolean {
  const rk = String(session.roleKey || '').toLowerCase();
  const role = String(session.role || '').toLowerCase();
  return (
    rk === 'hospital_admin' ||
    rk === 'admin' ||
    role.includes('hospital administrator') ||
    role.includes('administrator')
  );
}

/**
 * Start live guards for an active OS session.
 * Returns unsubscribe.
 */
export function startSessionGuard(session: UserSession, onForceLogout: LogoutFn): () => void {
  const badgeId = normBadge(session.badgeId || '');
  const hospitalId = session.hospitalId || '';
  if (!badgeId) return () => {};

  const localPin = isLocalPinSession(session);
  const admin = isHospitalAdmin(session);

  let stopped = false;
  const unsubs: Array<() => void> = [];

  // Local immediate revocation & force-logout listeners
  if (typeof window !== 'undefined') {
    const onLocalRevoked = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (normBadge(detail?.badgeId) === badgeId) {
        force('revoked');
      }
    };
    const onForceLogout = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.badgeId || normBadge(detail.badgeId) === badgeId) {
        force(detail?.reason || 'revoked');
      }
    };
    const onStorageSync = (e: StorageEvent) => {
      if (e.key === 'medcore_revoked_staff_badges_v1') {
        try {
          const map = e.newValue ? JSON.parse(e.newValue) : {};
          const k = `${String(hospitalId).toUpperCase()}::${badgeId}`;
          if (map[k]) force('revoked');
        } catch { /* ignore */ }
      }
    };

    window.addEventListener('medcore-staff-revoked', onLocalRevoked);
    window.addEventListener('medcore-force-logout', onForceLogout);
    window.addEventListener('storage', onStorageSync);
    unsubs.push(() => {
      window.removeEventListener('medcore-staff-revoked', onLocalRevoked);
      window.removeEventListener('medcore-force-logout', onForceLogout);
      window.removeEventListener('storage', onStorageSync);
    });
  }

  let authReady = false;
  let sawFirebaseUser = false;
  let sawSelfInDirectory = false;
  const sessionStartedAt = Date.now();
  const DIRECTORY_GRACE_MS = 30_000;
  const AUTH_GRACE_MS = 15_000;

  const force = (reason: ForceLogoutReason) => {
    if (stopped) return;
    // Hospital admin: never auto-kick for directory lag or transient Auth nulls.
    // Only real revoke / disabled account should end an admin session.
    if (admin && (reason === 'removed_from_directory' || reason === 'auth_deleted' || reason === 'token_invalid')) {
      return;
    }
    // Local PIN desk sessions: Firebase Auth is optional
    if (
      localPin &&
      (reason === 'auth_deleted' || reason === 'token_invalid' || reason === 'auth_disabled')
    ) {
      return;
    }
    stopped = true;
    try {
      authLog('session_force_logout', { facilityId: hospitalId, badgeId, reason });
    } catch {
      /* */
    }
    onForceLogout(reason);
  };

  void (async () => {
    try {
      const fb = await import('./firebase');

      // 1) Firebase Auth — only meaningful for email / Firebase sessions
      if (!localPin) {
        try {
          const stopAuth = fb.subscribeFirebaseAuth((user) => {
            if (stopped) return;
            if (user) {
              sawFirebaseUser = true;
              authReady = true;
              return;
            }
            if (!authReady) {
              window.setTimeout(() => {
                if (stopped) return;
                authReady = true;
                // Still no user after hydration — only logout if we had one in this session
                if (sawFirebaseUser && Date.now() - sessionStartedAt > AUTH_GRACE_MS) {
                  force('auth_deleted');
                }
              }, 4000);
              return;
            }
            if (sawFirebaseUser && Date.now() - sessionStartedAt > AUTH_GRACE_MS) {
              force('auth_deleted');
            }
          });
          unsubs.push(stopAuth);
        } catch {
          /* offline */
        }

        const tokenTimer = window.setInterval(() => {
          if (stopped) return;
          if (Date.now() - sessionStartedAt < AUTH_GRACE_MS) return;
          void (async () => {
            try {
              const auth = fb.getFirebaseAuth?.();
              const user = auth?.currentUser;
              if (!user) {
                // No Firebase user is normal for some admins — do not logout unless we had one
                if (sawFirebaseUser) force('auth_deleted');
                return;
              }
              await user.getIdToken(true);
            } catch (e: unknown) {
              const msg = String((e as { message?: string })?.message || e || '');
              const code = String((e as { code?: string })?.code || '');
              if (
                code.includes('user-disabled') ||
                msg.includes('user-disabled') ||
                msg.includes('USER_DISABLED')
              ) {
                force('auth_disabled');
                return;
              }
              if (
                code.includes('user-not-found') ||
                msg.includes('user-not-found') ||
                code.includes('user-token-expired') ||
                code.includes('id-token-revoked')
              ) {
                if (sawFirebaseUser) force('auth_deleted');
              }
              // Other token errors: ignore (network)
            }
          })();
        }, 60_000);
        unsubs.push(() => window.clearInterval(tokenTimer));
      }

      if (hospitalId) {
        // Revoke list — still honor for everyone including admin (real security)
        try {
          const stopRev = fb.firestoreSubscribeRevokedStaff(hospitalId, (ids) => {
            if (stopped) return;
            if (ids.some((id) => normBadge(id) === badgeId)) force('revoked');
          });
          unsubs.push(stopRev);
        } catch {
          /* ignore */
        }

        // Staff directory — skip removal logic for hospital_admin entirely
        if (!admin) {
          try {
            const stopDir = fb.firestoreSubscribeStaffDirectory(hospitalId, (data) => {
              if (stopped) return;
              const cards = data.staffCards;
              const reg = data.staffRegistry;
              const hasCards = Array.isArray(cards);
              const hasReg = Array.isArray(reg);
              if (!hasCards && !hasReg) return;

              const ids = new Set<string>();
              if (hasCards) {
                for (const c of cards as { badgeId?: string }[]) {
                  const id = normBadge(c?.badgeId || '');
                  if (id) ids.add(id);
                }
              }
              if (hasReg) {
                for (const r of reg as { badgeId?: string; id?: string }[]) {
                  const id = normBadge(r?.badgeId || r?.id || '');
                  if (id) ids.add(id);
                }
              }

              if (ids.has(badgeId)) {
                sawSelfInDirectory = true;
                return;
              }

              const inGrace = Date.now() - sessionStartedAt < DIRECTORY_GRACE_MS;
              if (inGrace) return;

              if (ids.size === 0) {
                if (sawSelfInDirectory) force('removed_from_directory');
                return;
              }
              if (sawSelfInDirectory && !ids.has(badgeId)) {
                force('removed_from_directory');
              }
            });
            unsubs.push(stopDir);
          } catch {
            /* ignore */
          }
        }

        try {
          const revoked = await fb.isStaffRevoked(hospitalId, badgeId);
          if (revoked) force('revoked');
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* firebase unavailable */
    }
  })();

  return () => {
    stopped = true;
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
  };
}

export function clearOsSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('medcore_os_session');
  } catch {
    /* ignore */
  }
}
