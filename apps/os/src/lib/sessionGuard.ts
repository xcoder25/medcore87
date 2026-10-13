/**
 * Force logout when the staff account no longer exists in Firebase Auth
 * or was removed from the facility staff directory / revoked list.
 *
 * Important: do NOT treat an empty or lagging cloud directory as removal.
 * Only logout after this badge was seen in the directory and later disappears
 * (or after an explicit wipe following a non-empty directory that included us).
 * Switching facilities / first admin claim must not kick the user out.
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
  /**
   * Only treat directory absence as removal after we have positively seen
   * this badge in the cloud staff list for this facility.
   */
  let sawSelfInDirectory = false;
  let directorySnapshots = 0;
  const sessionStartedAt = Date.now();
  /** Ignore empty/missing directory for a short grace period after login */
  const DIRECTORY_GRACE_MS = 12_000;

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
            window.setTimeout(() => {
              if (stopped) return;
              authReady = true;
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
            const auth = fb.getFirebaseAuth?.();
            const user = auth?.currentUser;
            if (!user) {
              if (sawFirebaseUser && authReady) force('auth_deleted');
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
              code.includes('user-token-expired') ||
              code.includes('id-token-revoked') ||
              msg.includes('user-not-found') ||
              msg.includes('user-token-expired')
            ) {
              force(sawFirebaseUser ? 'auth_deleted' : 'token_invalid');
            }
          }
        })();
      }, 45_000);
      unsubs.push(() => window.clearInterval(tokenTimer));

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

        // 4) Staff directory — only logout after we saw this badge, then it vanished
        try {
          const stopDir = fb.firestoreSubscribeStaffDirectory(hospitalId, (data) => {
            if (stopped) return;
            const cards = data.staffCards;
            const reg = data.staffRegistry;
            const hasCards = Array.isArray(cards);
            const hasReg = Array.isArray(reg);
            if (!hasCards && !hasReg) return;

            directorySnapshots += 1;

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

            // Positive membership
            if (ids.has(badgeId)) {
              sawSelfInDirectory = true;
              return;
            }

            const inGrace = Date.now() - sessionStartedAt < DIRECTORY_GRACE_MS;

            // Empty directory: only treat as wipe if we previously saw ourselves here
            if (ids.size === 0) {
              if (sawSelfInDirectory && !inGrace) {
                force('removed_from_directory');
              }
              // First empty snapshot on a new/empty facility — do not kick out
              return;
            }

            // Non-empty directory without this badge
            if (!ids.has(badgeId)) {
              // Never kick until we had confirmed membership (avoids wrong-facility /
              // lagging cloud false positives on first login to another hospital)
              if (sawSelfInDirectory && !inGrace) {
                force('removed_from_directory');
              }
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
