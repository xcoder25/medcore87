import { NextRequest, NextResponse } from 'next/server';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { getStaff, findStaffAnyFacility, upsertStaff } from '../../../../lib/db/staffRepo';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { extractStaffCredentials } from '../../../../lib/publicHospitalCompliance';

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

        return NextResponse.json({
          ok: true,
          configured: true,
          staff: {
            ...safeRow,
            ...extractStaffCredentials(safeRow),
          },
        });
      }
    } catch (e) {
      console.warn('[api/staff/lookup] Postgres lookup fallback:', e);
    }
  }

  // 2) Firebase Admin Auth fallback so any user visible in Firebase Console resolves cleanly
  try {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      const isEmailTarget = target.includes('@');
      const lookupEmail = isEmailTarget ? target.toLowerCase() : badgeAuthEmail(target);
      let fbUser = await adminAuth.getUserByEmail(lookupEmail).catch(() => null);
      let badgeUser = !isEmailTarget ? fbUser : null;

      if (isEmailTarget) {
        const directClaims = (fbUser?.customClaims || {}) as Record<string, unknown>;
        if (!fbUser || !directClaims.badgeId) {
          const listRes = await adminAuth.listUsers(1000).catch(() => null);
          if (listRes) {
            for (const u of listRes.users) {
              const uClaims = (u.customClaims || {}) as Record<string, unknown>;
              const uWork = String(uClaims.workEmail || '').trim().toLowerCase();
              const uMail = String(u.email || '').trim().toLowerCase();
              if (uWork === lookupEmail || uMail === lookupEmail) {
                if (uMail.startsWith('badge.')) {
                  if (!badgeUser) badgeUser = u;
                } else if (!fbUser) {
                  fbUser = u;
                }
              }
            }
          }
        }
      }

      const activeUser = badgeUser || fbUser;
      if (activeUser && !activeUser.disabled) {
        const claims = {
          ...((fbUser?.customClaims || {}) as Record<string, unknown>),
          ...((badgeUser?.customClaims || {}) as Record<string, unknown>),
        };
        const rawMail = String(badgeUser?.email || fbUser?.email || '').trim().toLowerCase();
        const badgeFromEmail = rawMail.startsWith('badge.')
          ? rawMail.replace(/^badge\./, '').replace(/@.*$/, '').toUpperCase()
          : '';
        const resolvedBadge = String(
          claims.badgeId || badgeFromEmail || (isEmailTarget ? activeUser.uid.slice(0, 10) : target)
        ).toUpperCase();
        const resolvedFacility = String(claims.facility_id || facilityId || 'IGH-EKT').toUpperCase();

        // Check if Postgres holds the full staff record under the recovered Badge ID
        if (isPostgresConfigured() && resolvedBadge) {
          const pgRow =
            (await getStaff(resolvedFacility, resolvedBadge).catch(() => null)) ||
            (await findStaffAnyFacility(resolvedBadge).catch(() => null));
          if (pgRow) {
            const { pin_hash: _pinHash, ...safePg } = pgRow as typeof pgRow & { pin_hash?: string };
            if (isEmailTarget && !pgRow.email) {
              void upsertStaff({
                badgeId: pgRow.badge_id,
                facilityId: pgRow.facility_id,
                fullName: pgRow.full_name,
                role: pgRow.role || undefined,
                roleKey: pgRow.role_key || undefined,
                title: pgRow.title || undefined,
                department: pgRow.department || undefined,
                email: lookupEmail,
                status: pgRow.status || 'active',
                clearanceLevel: pgRow.clearance_level ?? 2,
                clearanceLabel: pgRow.clearance_label || undefined,
                permissions: Array.isArray(pgRow.permissions)
                  ? (pgRow.permissions as string[])
                  : undefined,
                authEmail: pgRow.auth_email || undefined,
              }).catch(() => {});
            }
            return NextResponse.json({
              ok: true,
              configured: true,
              staff: {
                ...safePg,
                ...extractStaffCredentials(safePg),
                email: safePg.email || (isEmailTarget ? lookupEmail : null),
              },
            });
          }
        }

        const resolvedRoleKey = String(claims.role || 'staff');
        const resolvedClearance = Number(claims.clearanceLevel) || (resolvedRoleKey === 'hospital_admin' ? 5 : 2);
        const resolvedDisplayName =
          [badgeUser?.displayName, fbUser?.displayName]
            .map((d) => String(d || '').trim())
            .find((d) => d && d.toUpperCase() !== resolvedBadge) || resolvedBadge;
        return NextResponse.json({
          ok: true,
          configured: isPostgresConfigured(),
          source: 'firebase_auth',
          staff: {
            badge_id: resolvedBadge,
            badgeId: resolvedBadge,
            facility_id: resolvedFacility,
            facilityId: resolvedFacility,
            full_name: resolvedDisplayName,
            fullName: resolvedDisplayName,
            role: resolvedRoleKey === 'hospital_admin' ? 'Hospital Administrator' : 'Staff',
            role_key: resolvedRoleKey,
            roleKey: resolvedRoleKey,
            clearance_level: resolvedClearance,
            clearanceLevel: resolvedClearance,
            clearance_label: resolvedRoleKey === 'hospital_admin' ? 'Administrator' : `L${resolvedClearance}`,
            email: isEmailTarget ? lookupEmail : (claims.workEmail || activeUser.email),
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
