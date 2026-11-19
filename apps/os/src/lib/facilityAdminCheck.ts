import { isPostgresConfigured } from './db/postgres';
import { listStaff } from './db/staffRepo';
import { getAdminAuth } from './firebaseAdmin';

const ADMIN_ROLE_KEYS = new Set(['hospital_admin', 'sysadmin']);
const MAX_FIREBASE_SCAN_PAGES = 10;

function isAdminRole(roleKey: unknown, clearanceLevel: unknown): boolean {
  const rk = String(roleKey || '').trim().toLowerCase();
  const cl = Number(clearanceLevel || 0);
  return ADMIN_ROLE_KEYS.has(rk) || cl >= 5;
}

/**
 * Checks whether a facility already has an active Hospital Administrator without exposing any
 * staff PII (names, badges, or emails).
 */
export async function hasExistingFacilityAdmin(
  facilityId: string
): Promise<{ hasAdmin: boolean }> {
  const fid = String(facilityId || '').trim().toUpperCase();
  if (!fid) return { hasAdmin: false };

  if (isPostgresConfigured()) {
    try {
      const rows = await listStaff(fid);
      const foundInPg = rows.some((row) => {
        const status = String(row.status || 'active').trim().toLowerCase();
        if (status === 'revoked' || status === 'disabled') return false;
        return isAdminRole(row.role_key, row.clearance_level);
      });
      if (foundInPg) return { hasAdmin: true };
    } catch (err) {
      console.warn('[facilityAdminCheck] Postgres admin check warning:', err);
    }
  }

  try {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_FIREBASE_SCAN_PAGES; page++) {
        const result = await adminAuth.listUsers(1000, pageToken);
        const foundInFb = result.users.some((u) => {
          if (u.disabled) return false;
          const claims = (u.customClaims || {}) as Record<string, unknown>;
          const userFid = String(claims.facility_id || '').trim().toUpperCase();
          if (userFid !== fid) return false;
          return isAdminRole(claims.role, claims.clearanceLevel);
        });
        if (foundInFb) return { hasAdmin: true };
        if (!result.pageToken) break;
        pageToken = result.pageToken;
      }
    }
  } catch (err) {
    console.warn('[facilityAdminCheck] Firebase Admin check warning:', err);
  }

  return { hasAdmin: false };
}
