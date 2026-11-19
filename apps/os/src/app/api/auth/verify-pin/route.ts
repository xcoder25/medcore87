import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { hashPin, isPostgresConfigured } from '../../../../lib/db/postgres';
import { findStaffAnyFacility, getStaff, upsertStaff } from '../../../../lib/db/staffRepo';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badgeAuthEmail(badgeId: string): string {
  const id = (badgeId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

function normalizeStaffPin(pin: string): string {
  const p = (pin || '').trim();
  if (p.length >= 6) return p;
  return (p + '000000').slice(0, 6);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function resolveFirebaseBadgeForEmail(
  adminAuth: NonNullable<ReturnType<typeof getAdminAuth>>,
  cleanEmail: string,
  badgeId: string
): Promise<{
  fbUser: any;
  badgeUser: any;
  resolvedBadge: string;
  resolvedFacility: string;
  mergedClaims: Record<string, unknown>;
}> {
  let fbUser: any = cleanEmail
    ? await adminAuth.getUserByEmail(cleanEmail).catch(() => null)
    : null;
  let badgeUser: any = badgeId
    ? await adminAuth.getUserByEmail(badgeAuthEmail(badgeId)).catch(() => null)
    : null;

  let fbClaims = (fbUser?.customClaims || {}) as Record<string, unknown>;
  let badgeClaims = (badgeUser?.customClaims || {}) as Record<string, unknown>;
  let resolvedBadge = String(badgeClaims.badgeId || fbClaims.badgeId || badgeId || '')
    .trim()
    .toUpperCase();

  // If signing in with email and customClaims.badgeId wasn't found yet, match workEmail across users
  if (cleanEmail && (!resolvedBadge || !badgeUser)) {
    try {
      const listRes = await adminAuth.listUsers(1000);
      for (const u of listRes.users) {
        const claims = (u.customClaims || {}) as Record<string, unknown>;
        const uWork = String(claims.workEmail || '').trim().toLowerCase();
        const uMail = String(u.email || '').trim().toLowerCase();
        if (uWork === cleanEmail || uMail === cleanEmail) {
          if (uMail.startsWith('badge.')) {
            if (!badgeUser) badgeUser = u;
          } else if (!fbUser) {
            fbUser = u;
          }
          if (!resolvedBadge) {
            if (claims.badgeId) {
              resolvedBadge = String(claims.badgeId).trim().toUpperCase();
            } else if (uMail.startsWith('badge.')) {
              resolvedBadge = uMail.replace(/^badge\./, '').replace(/@.*$/, '').toUpperCase();
            }
          }
        }
      }
      if (resolvedBadge && !badgeUser) {
        badgeUser = await adminAuth.getUserByEmail(badgeAuthEmail(resolvedBadge)).catch(() => null);
      }
      fbClaims = (fbUser?.customClaims || {}) as Record<string, unknown>;
      badgeClaims = (badgeUser?.customClaims || {}) as Record<string, unknown>;
    } catch {
      /* ignore listUsers errors */
    }
  }

  const mergedClaims = { ...badgeClaims, ...fbClaims };
  const resolvedFacility = String(mergedClaims.facility_id || '').trim().toUpperCase();
  return { fbUser, badgeUser, resolvedBadge, resolvedFacility, mergedClaims };
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const body = (await req.json()) as {
      facilityId?: string;
      badgeId?: string;
      email?: string;
      pin?: string;
    };

    const facilityId = String(body.facilityId || '').trim().toUpperCase();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const rawPin = String(body.pin || '').trim();
    const normPin = rawPin.replace(/\s+/g, '');

    if ((!badgeId && !cleanEmail) || !normPin) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'badgeId or email and pin required' },
        { status: 400 }
      );
    }
    if (normPin.length < 6) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'PIN must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const rateKey = badgeId || cleanEmail;
    const rl = checkRateLimit(`verify-pin:${ip}:${rateKey}`, 15, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'RATE_LIMITED', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429 }
      );
    }

    const adminAuth = getAdminAuth();
    let effectiveRow: any = null;
    let fbLookup: Awaited<ReturnType<typeof resolveFirebaseBadgeForEmail>> | null = null;

    // 1) Aurora PostgreSQL check first
    if (isPostgresConfigured()) {
      try {
        const lookupTarget = badgeId || cleanEmail;
        effectiveRow =
          (facilityId && badgeId ? await getStaff(facilityId, badgeId) : null) ||
          (await findStaffAnyFacility(lookupTarget)) ||
          (cleanEmail && badgeId ? await findStaffAnyFacility(cleanEmail) : null);

        // If email wasn't stored on the Postgres row yet, resolve Badge ID via Firebase Admin & re-check Postgres
        if ((!effectiveRow || !effectiveRow.pin_hash) && adminAuth && (cleanEmail || badgeId)) {
          fbLookup = await resolveFirebaseBadgeForEmail(adminAuth, cleanEmail, badgeId);
          const recBadge = fbLookup.resolvedBadge;
          const recFac = fbLookup.resolvedFacility || facilityId;
          if (recBadge) {
            const byBadge =
              (recFac ? await getStaff(recFac, recBadge) : null) ||
              (await findStaffAnyFacility(recBadge));
            if (byBadge) {
              effectiveRow = byBadge;
            }
          }
        }

        if (effectiveRow) {
          const storedHash = String((effectiveRow as { pin_hash?: string | null }).pin_hash || '').trim();
          if (storedHash) {
            const verified =
              safeEqualHex(hashPin(normPin), storedHash) ||
              safeEqualHex(hashPin(rawPin), storedHash);

            // Auto-heal email column & Firebase claims on verified login so future email lookups hit Postgres directly
            if (verified && cleanEmail && !effectiveRow.email) {
              void upsertStaff({
                badgeId: effectiveRow.badge_id,
                facilityId: effectiveRow.facility_id,
                fullName: effectiveRow.full_name,
                role: effectiveRow.role || undefined,
                roleKey: effectiveRow.role_key || undefined,
                title: effectiveRow.title || undefined,
                department: effectiveRow.department || undefined,
                email: cleanEmail,
                status: effectiveRow.status || 'active',
                clearanceLevel: effectiveRow.clearance_level ?? 2,
                clearanceLabel: effectiveRow.clearance_label || undefined,
                permissions: Array.isArray(effectiveRow.permissions)
                  ? (effectiveRow.permissions as string[])
                  : undefined,
                authEmail: effectiveRow.auth_email || undefined,
              }).catch(() => {});

              if (adminAuth && fbLookup?.fbUser && !(fbLookup.fbUser.customClaims as any)?.badgeId) {
                const prev = (fbLookup.fbUser.customClaims || {}) as Record<string, unknown>;
                void adminAuth.setCustomUserClaims(fbLookup.fbUser.uid, {
                  ...prev,
                  facility_id: prev.facility_id || effectiveRow.facility_id,
                  role: prev.role || effectiveRow.role_key || 'staff',
                  badgeId: effectiveRow.badge_id,
                  clearanceLevel: prev.clearanceLevel || effectiveRow.clearance_level || 2,
                  workEmail: cleanEmail,
                }).catch(() => {});
              }
            }

            return NextResponse.json({
              ok: true,
              configured: true,
              hasPinHash: true,
              accountFound: true,
              verified,
              source: 'postgres',
            });
          }
        }
      } catch (pgErr) {
        console.warn('[api/auth/verify-pin] Postgres lookup warning:', pgErr);
      }
    }

    if (!fbLookup && adminAuth && (cleanEmail || badgeId)) {
      fbLookup = await resolveFirebaseBadgeForEmail(adminAuth, cleanEmail, badgeId);
    }

    const fbHasUser = Boolean(fbLookup?.fbUser || fbLookup?.badgeUser);
    if (!effectiveRow && adminAuth && !fbHasUser) {
      return NextResponse.json({
        ok: true,
        configured: isPostgresConfigured(),
        hasPinHash: false,
        accountFound: false,
        verified: false,
      });
    }

    // 2) Server-only Firebase REST verification fallback (no browser NEXT_PUBLIC_* needed)
    const webApiKey = (
      process.env.FIREBASE_WEB_API_KEY ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');

    if (webApiKey) {
      const candidateEmail = cleanEmail || badgeAuthEmail(badgeId);
      const fbPass = normPin;
      const fbRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: candidateEmail,
            password: fbPass,
            returnSecureToken: false,
          }),
        }
      );

      if (fbRes.ok) {
        // Best-effort backfill into Aurora Postgres so future logins verify against Postgres
        if (isPostgresConfigured()) {
          try {
            const fbPrimaryUser =
              fbLookup?.fbUser ||
              (adminAuth ? await adminAuth.getUserByEmail(candidateEmail).catch(() => null) : null);
            const claims = (fbPrimaryUser?.customClaims || {}) as Record<string, unknown>;
            const resolvedBadge = String(claims.badgeId || fbLookup?.resolvedBadge || badgeId || '')
              .trim()
              .toUpperCase();
            const fbBadgeFallback =
              fbLookup?.badgeUser ||
              (adminAuth &&
              resolvedBadge &&
              (!fbPrimaryUser ||
                !fbPrimaryUser.displayName ||
                fbPrimaryUser.displayName.trim().toUpperCase() === resolvedBadge)
                ? await adminAuth.getUserByEmail(badgeAuthEmail(resolvedBadge)).catch(() => null)
                : null);
            const badgeClaims = (fbBadgeFallback?.customClaims || {}) as Record<string, unknown>;
            const mergedClaims = { ...badgeClaims, ...claims };

            const resolvedFid = String(mergedClaims.facility_id || facilityId || 'IGH-EKT')
              .trim()
              .toUpperCase();
            const resolvedRoleKey = String(mergedClaims.role || 'staff').trim() || 'staff';
            const isAdmin =
              resolvedRoleKey === 'hospital_admin' || resolvedRoleKey === 'sysadmin';
            const resolvedClearance =
              Number(mergedClaims.clearanceLevel) || (isAdmin ? 5 : 2);
            const resolvedEmail =
              cleanEmail ||
              (mergedClaims.workEmail ? String(mergedClaims.workEmail).trim().toLowerCase() : undefined);
            const resolvedFullName =
              [fbPrimaryUser?.displayName, fbBadgeFallback?.displayName]
                .map((d) => String(d || '').trim())
                .find((d) => d && d.toUpperCase() !== resolvedBadge) || resolvedBadge;
            const resolvedRole = isAdmin ? 'Hospital Administrator' : 'Staff';

            if (resolvedBadge && resolvedFid) {
              await upsertStaff({
                badgeId: resolvedBadge,
                facilityId: resolvedFid,
                fullName: resolvedFullName,
                role: resolvedRole,
                roleKey: resolvedRoleKey,
                title: resolvedRole,
                department: isAdmin ? 'Hospital Management' : 'Clinical Operations',
                clearanceLevel: resolvedClearance,
                clearanceLabel: isAdmin ? 'Administrator' : `L${resolvedClearance}`,
                permissions: isAdmin ? ['*'] : undefined,
                email: resolvedEmail,
                authEmail: badgeAuthEmail(resolvedBadge),
                pin: fbPass,
              });
            }
          } catch (syncErr) {
            console.warn('[api/auth/verify-pin] Postgres backfill warning:', syncErr);
          }
        }

        return NextResponse.json({
          ok: true,
          configured: isPostgresConfigured(),
          hasPinHash: false,
          accountFound: true,
          verified: true,
          source: 'firebase_server',
        });
      }

      return NextResponse.json({
        ok: true,
        configured: isPostgresConfigured(),
        hasPinHash: false,
        accountFound: fbHasUser || Boolean(effectiveRow),
        verified: false,
        source: 'firebase_server',
      });
    }

    return NextResponse.json({
      ok: true,
      configured: isPostgresConfigured(),
      hasPinHash: false,
      accountFound: fbHasUser || Boolean(effectiveRow),
      verified: false,
      needsServerFirebaseKey: true,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, verified: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
