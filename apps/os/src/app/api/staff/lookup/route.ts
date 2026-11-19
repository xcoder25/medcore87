import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { getStaff, findStaffAnyFacility, upsertStaff } from '../../../../lib/db/staffRepo';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

function badgeAuthEmail(badgeId: string): string {
  const id = (badgeId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

/**
 * GET /api/staff/lookup?facilityId=IGH-EKT&badgeId=AKS-ADM-001
 * Efficient single-badge / email lookup across Aurora PostgreSQL and Firebase Admin Auth.
 * Returns the staff row (without pin_hash) or null if not found.
 */
export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim();
  const badgeId = (req.nextUrl.searchParams.get('badgeId') || '').trim().toUpperCase();
  const queryParam = (req.nextUrl.searchParams.get('query') || '').trim();
  const target = badgeId || queryParam;

  if (!target) {
    return NextResponse.json(
      { ok: false, error: 'badgeId or query is required' },
      { status: 400 }
    );
  }

  // 1) Aurora PostgreSQL lookup
  if (isPostgresConfigured()) {
    try {
      let row = null;
      if (facilityId) {
        row = await getStaff(facilityId, target);
      }
      if (!row) {
        row = await findStaffAnyFacility(target);
      }
      if (row) {
        const { pin_hash: _pinHash, ...safeRow } = row as typeof row & { pin_hash?: string };
        const rowBadge = String(row.badge_id || '').trim().toUpperCase();
        const isDegradedName =
          !row.full_name || row.full_name.trim().toUpperCase() === rowBadge;
        const isDegradedRole = !row.role_key;

        if (isDegradedName || isDegradedRole) {
          try {
            const adminAuth = getAdminAuth();
            if (adminAuth && rowBadge) {
              const fbBadgeUser = await adminAuth.getUserByEmail(badgeAuthEmail(rowBadge)).catch(() => null);
              const rowEmail = String(row.email || '').trim().toLowerCase();
              const hasRealRowEmail = Boolean(
                rowEmail && rowEmail.includes('@') && !rowEmail.endsWith('.firebaseapp.com')
              );
              const fbEmailUser =
                hasRealRowEmail &&
                (!fbBadgeUser ||
                  !fbBadgeUser.displayName ||
                  fbBadgeUser.displayName.trim().toUpperCase() === rowBadge)
                  ? await adminAuth.getUserByEmail(rowEmail).catch(() => null)
                  : null;

              const claims = ((fbBadgeUser?.customClaims || fbEmailUser?.customClaims) ||
                {}) as Record<string, unknown>;
              const fbDisplayName =
                [fbBadgeUser?.displayName, fbEmailUser?.displayName]
                  .map((d) => String(d || '').trim())
                  .find((d) => d && d.toUpperCase() !== rowBadge) || '';
              const repairedName = isDegradedName
                ? fbDisplayName || row.full_name || rowBadge
                : row.full_name;
              const repairedRoleKey = row.role_key || String(claims.role || 'staff');
              const isAdmin =
                repairedRoleKey === 'hospital_admin' || repairedRoleKey === 'sysadmin';
              const repairedClearance =
                (row.clearance_level && row.clearance_level > 1
                  ? row.clearance_level
                  : Number(claims.clearanceLevel)) || (isAdmin ? 5 : 2);
              const repairedRole =
                row.role || (isAdmin ? 'Hospital Administrator' : 'Staff');
              const repairedTitle = row.title || repairedRole;
              const repairedDept =
                row.department || (isAdmin ? 'Hospital Management' : 'Clinical Operations');
              const repairedClearanceLabel =
                row.clearance_label || (isAdmin ? 'Administrator' : `L${repairedClearance}`);
              const existingPerms = Array.isArray(row.permissions) ? (row.permissions as string[]) : [];
              const repairedPerms = existingPerms.length
                ? existingPerms
                : isAdmin
                ? ['*']
                : [];
              const repairedEmail =
                row.email ||
                (claims.workEmail ? String(claims.workEmail).trim().toLowerCase() : null);

              Object.assign(safeRow, {
                full_name: repairedName,
                role: repairedRole,
                role_key: repairedRoleKey,
                title: repairedTitle,
                department: repairedDept,
                clearance_level: repairedClearance,
                clearance_label: repairedClearanceLabel,
                permissions: repairedPerms,
                email: repairedEmail,
              });

              if (fbDisplayName || (isDegradedRole && claims.role)) {
                void upsertStaff({
                  badgeId: rowBadge,
                  facilityId: String(row.facility_id || facilityId || claims.facility_id || 'IGH-EKT').toUpperCase(),
                  fullName: repairedName,
                  role: repairedRole,
                  roleKey: repairedRoleKey,
                  title: repairedTitle,
                  department: repairedDept,
                  clearanceLevel: repairedClearance,
                  clearanceLabel: repairedClearanceLabel,
                  permissions: repairedPerms.length ? repairedPerms : undefined,
                  email: repairedEmail || undefined,
                }).catch(() => {});
              }
            }
          } catch (healErr) {
            console.warn('[api/staff/lookup] Auto-heal warning:', healErr);
          }
        }

        return NextResponse.json({ ok: true, configured: true, staff: safeRow });
      }
    } catch (e) {
      console.warn('[api/staff/lookup] Postgres lookup fallback:', e);
    }
  }

  // 2) Firebase Admin Auth fallback so any user visible in Firebase Console resolves cleanly
  try {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      const lookupEmail = target.includes('@') ? target.toLowerCase() : badgeAuthEmail(target);
      const fbUser = await adminAuth.getUserByEmail(lookupEmail).catch(() => null);
      if (fbUser && !fbUser.disabled) {
        const claims = (fbUser.customClaims || {}) as Record<string, unknown>;
        const resolvedBadge = String(claims.badgeId || (target.includes('@') ? fbUser.uid.slice(0, 10).toUpperCase() : target)).toUpperCase();
        const resolvedRoleKey = String(claims.role || 'staff');
        const resolvedClearance = Number(claims.clearanceLevel) || (resolvedRoleKey === 'hospital_admin' ? 5 : 2);
        const resolvedFacility = String(claims.facility_id || facilityId || 'IGH-EKT').toUpperCase();
        return NextResponse.json({
          ok: true,
          configured: isPostgresConfigured(),
          source: 'firebase_auth',
          staff: {
            badge_id: resolvedBadge,
            badgeId: resolvedBadge,
            facility_id: resolvedFacility,
            facilityId: resolvedFacility,
            full_name: fbUser.displayName || resolvedBadge,
            fullName: fbUser.displayName || resolvedBadge,
            role: resolvedRoleKey === 'hospital_admin' ? 'Hospital Administrator' : 'Staff',
            role_key: resolvedRoleKey,
            roleKey: resolvedRoleKey,
            clearance_level: resolvedClearance,
            clearanceLevel: resolvedClearance,
            clearance_label: `L${resolvedClearance}`,
            email: target.includes('@') ? target.toLowerCase() : fbUser.email,
            status: 'active',
          },
        });
      }
    }
  } catch (e) {
    console.warn('[api/staff/lookup] Firebase Admin fallback warning:', e);
  }

  return NextResponse.json({ ok: true, configured: isPostgresConfigured(), staff: null });
}
