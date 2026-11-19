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

    const rateKey = badgeId || cleanEmail;
    const rl = checkRateLimit(`verify-pin:${ip}:${rateKey}`, 15, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'RATE_LIMITED', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429 }
      );
    }

    // 1) Aurora PostgreSQL check first
    if (isPostgresConfigured()) {
      try {
        const lookupTarget = badgeId || cleanEmail;
        const row =
          (facilityId && badgeId ? await getStaff(facilityId, badgeId) : null) ||
          (await findStaffAnyFacility(lookupTarget)) ||
          (cleanEmail && badgeId ? await findStaffAnyFacility(cleanEmail) : null);

        if (row) {
          const storedHash = String((row as { pin_hash?: string | null }).pin_hash || '').trim();
          if (storedHash) {
            const verified =
              safeEqualHex(hashPin(normPin), storedHash) ||
              safeEqualHex(hashPin(rawPin), storedHash) ||
              safeEqualHex(hashPin(normalizeStaffPin(normPin)), storedHash);
            return NextResponse.json({
              ok: true,
              configured: true,
              hasPinHash: true,
              verified,
              source: 'postgres',
            });
          }
        }
      } catch (pgErr) {
        console.warn('[api/auth/verify-pin] Postgres lookup warning:', pgErr);
      }
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
      const fbPass = normalizeStaffPin(normPin);
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
            const adminAuth = getAdminAuth();
            const fbPrimaryUser = adminAuth
              ? await adminAuth.getUserByEmail(candidateEmail).catch(() => null)
              : null;
            const claims = (fbPrimaryUser?.customClaims || {}) as Record<string, unknown>;
            const resolvedBadge = String(claims.badgeId || badgeId || '').trim().toUpperCase();
            const fbBadgeFallback =
              adminAuth &&
              resolvedBadge &&
              (!fbPrimaryUser ||
                !fbPrimaryUser.displayName ||
                fbPrimaryUser.displayName.trim().toUpperCase() === resolvedBadge)
                ? await adminAuth.getUserByEmail(badgeAuthEmail(resolvedBadge)).catch(() => null)
                : null;
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
          verified: true,
          source: 'firebase_server',
        });
      }

      return NextResponse.json({
        ok: true,
        configured: isPostgresConfigured(),
        hasPinHash: false,
        verified: false,
        source: 'firebase_server',
      });
    }

    return NextResponse.json({
      ok: true,
      configured: isPostgresConfigured(),
      hasPinHash: false,
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
