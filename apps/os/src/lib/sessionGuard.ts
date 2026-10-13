/**
 * Force logout when the staff account no longer exists in Firebase Auth
 * or was removed from the facility staff directory / revoked list.
 *
 * Deleting users in Firebase Console does not clear localStorage by itself —
 * this guard watches Auth + cloud staff data and ends the OS session.
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

/**
 * Start live guards for an active OS session.
 * Returns unsubscribe.
 */
export function startSessionGuard(session: UserSession, onForceLogout: LogoutFn): () => void {
  const badgeId = normBadge(session.badgeId || '');
  const hospitalId = session.hospitalId || '';
  if (!badgeId) return () => {};

  let stopped = false;
  const unsubs: Array<() => void> = [];
  /** Avoid logout on the first auth null before Firebase has restored persistence */
  let authReady = false;
  let sawFirebaseUser = false;

  const force = (reason: ForceLogoutReason) => {
    if (stopped) return;
    stopped = true;
    onForceLogout(reason);
  };

  void (async () => {
    try {
      const fb = await import('./firebase');

      // 1) Firebase Auth — user deleted in Console → currentUser becomes null / token fails
      try {
        const stopAuth = fb.subscribeFirebaseAuth((user) => {
          if (stopped) return;
          if (user) {
            sawFirebaseUser = true;
            authReady = true;
            return;
          }
          // null user
          if (!authReady) {
            // First callback may be null before persistence hydrates — wait briefly
            window.setTimeout(() => {
              if (stopped) return;
              authReady = true;
              const cur = fb.getFirebaseAuth?.() ? null : null;
              // Re-check via getIdToken path below; only logout if we previously had a user
              if (sawFirebaseUser) force('auth_deleted');
            }, 2500);
            return;
          }
          if (sawFirebaseUser) force('auth_deleted');
        });
        unsubs.push(stopAuth);
      } catch {
        /* offline */
      }

      // 2) Token refresh — deleted/disabled accounts fail here
      const tokenTimer = window.setInterval(() => {
        if (stopped) return;
        void (async () => {
          try {
            const auth = fb.getFirebaseAuth();
            const u = auth.currentUser;
            if (!u) {
              if (sawFirebaseUser) force('auth_deleted');
              return;
            }
            sawFirebaseUser = true;
            await u.getIdToken(true);
          } catch (e) {
            const code = String((e as { code?: string })?.code || '');
            if (
              code.includes('user-not-found') ||
              code.includes('user-disabled') ||
              code.includes('user-token-expired') ||
              code.includes('invalid-user-token') ||
              code.includes('id-token-revoked')
            ) {
              force(code.includes('disabled') ? 'auth_disabled' : 'token_invalid');
            }
          }
        })();
      }, 45_000);
      unsubs.push(() => clearInterval(tokenTimer));

      // Immediate token check shortly after login/restore
      window.setTimeout(() => {
        if (stopped) return;
        void (async () => {
          try {
            const auth = fb.getFirebaseAuth();
            const u = auth.currentUser;
            if (u) {
              sawFirebaseUser = true;
              await u.getIdToken(true);
            }
          } catch {
            if (sawFirebaseUser) force('token_invalid');
          }
        })();
      }, 4000);

      // 3) Explicit revoke collection (Access Control delete path)
      if (hospitalId) {
        try {
          const stopRev = fb.firestoreSubscribeRevokedStaff(hospitalId, (ids) => {
            if (stopped) return;
            if (ids.some((id) => normBadge(id) === badgeId)) force('revoked');
          });
          unsubs.push(stopRev);
        } catch {
          /* ignore */
        }

        // 4) Staff directory — if cloud publishes a list and this badge is gone, log out
        try {
          const stopDir = fb.firestoreSubscribeStaffDirectory(hospitalId, (data) => {
            if (stopped) return;
            const cards = data.staffCards;
            const reg = data.staffRegistry;
            // Only act when cloud sent an explicit array (including empty = wipe)
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

            // Empty directory after a prior non-empty, or badge missing from non-empty list
            if (ids.size === 0 && (hasCards || hasReg)) {
              // Empty staff directory published → all removed
              force('removed_from_directory');
              return;
            }
            if (ids.size > 0 && !ids.has(badgeId)) {
              force('removed_from_directory');
            }
          });
          unsubs.push(stopDir);
        } catch {
          /* ignore */
        }

        // One-shot revoke check on start
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
