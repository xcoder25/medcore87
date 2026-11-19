import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { findStaffAnyFacility, getStaff, upsertStaff } from '../../../../lib/db/staffRepo';
import { verifyMfaToken } from '../../../../lib/serverSession';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

function normalizeBadgeId(badge: string): string {
  return String(badge || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function badgeAuthEmail(badgeId: string): string {
  const id = normalizeBadgeId(badgeId)
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String(body.action || 'reset_pin').toLowerCase();
  const facilityId = String(body.facilityId || '').trim().toUpperCase();
  const query = String(body.query || body.badgeId || body.email || '').trim();

  if (!query) {
    return NextResponse.json({ ok: false, error: 'Staff Badge ID or Email is required.' }, { status: 400 });
  }

  const adminAuth = getAdminAuth();

  // -------------------------------------------------------------
  // ACTION 1: REAL-TIME ACCOUNT LOOKUP (Postgres + Firebase Admin)
  // -------------------------------------------------------------
  if (action === 'lookup') {
    const rl = checkRateLimit(`reset-lookup:${ip}`, 15, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: `Too many lookup attempts. Retry in ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
    let matchedBadge = isEmail ? '' : normalizeBadgeId(query);
    let matchedStaff: any = null;
    let resolvedFacilityId = facilityId || 'IGH-EKT';

    // Check Postgres first (scoped facility, then global cross-facility)
    if (isPostgresConfigured()) {
      try {
        if (matchedBadge && facilityId) {
          const row = await getStaff(facilityId, matchedBadge);
          if (row) matchedStaff = row;
        }
        if (!matchedStaff) {
          const anyRow = await findStaffAnyFacility(query);
          if (anyRow) {
            matchedStaff = anyRow;
            matchedBadge = anyRow.badge_id;
          }
        }
        if (matchedStaff?.facility_id) {
          resolvedFacilityId = String(matchedStaff.facility_id).toUpperCase();
        }
      } catch (e) {
        console.warn('[reset-pin lookup] Postgres query error:', e);
      }
    }

    // Check Firebase Auth directly as real-time identity authority
    let fbUserRecord: any = null;
    if (adminAuth) {
      try {
        const emailToCheck = isEmail ? query.toLowerCase() : badgeAuthEmail(matchedBadge || query);
        fbUserRecord = await adminAuth.getUserByEmail(emailToCheck);
        const claims = (fbUserRecord?.customClaims || {}) as Record<string, unknown>;
        if (!matchedBadge && claims.badgeId) {
          matchedBadge = normalizeBadgeId(String(claims.badgeId));
        }
        if (!matchedStaff && claims.facility_id) {
          resolvedFacilityId = String(claims.facility_id).toUpperCase();
        }
      } catch {
        /* user not found in Firebase Auth */
      }
    }

    if (!matchedStaff && !fbUserRecord) {
      return NextResponse.json({
        ok: false,
        found: false,
        error: `No real-time staff record matching "${query}" was found. Verify your Staff Badge ID or Work Email.`,
      });
    }

    const claims = (fbUserRecord?.customClaims || {}) as Record<string, unknown>;
    const officialEmail = String(
      matchedStaff?.email ||
        claims.workEmail ||
        (isEmail ? query.toLowerCase() : '') ||
        (fbUserRecord?.email && !String(fbUserRecord.email).includes('naija-bites-1s3y1.firebaseapp.com')
          ? fbUserRecord.email
          : '')
    ).trim();
    const displayName =
      matchedStaff?.full_name ||
      matchedStaff?.name ||
      fbUserRecord?.displayName ||
      (isEmail ? query.split('@')[0] : matchedBadge || 'Healthcare Staff');
    const role = matchedStaff?.role || matchedStaff?.title || String(claims.role || 'Staff Member');
    const department = matchedStaff?.department || '';
    const roleKey = matchedStaff?.role_key || matchedStaff?.roleKey || String(claims.role || '');
    const clearanceLevel = matchedStaff?.clearance_level || matchedStaff?.clearanceLevel || Number(claims.clearanceLevel || 2);

    return NextResponse.json({
      ok: true,
      found: true,
      badgeId: matchedBadge || (isEmail ? String(fbUserRecord?.uid || '').slice(0, 10).toUpperCase() : query),
      facilityId: resolvedFacilityId,
      name: displayName,
      role,
      roleKey,
      clearanceLevel,
      department,
      registeredEmail: officialEmail,
      maskedEmail: officialEmail ? maskEmail(officialEmail) : '',
      hasRegisteredEmail: Boolean(officialEmail && !officialEmail.includes('naija-bites-1s3y1.firebaseapp.com')),
      canResetPin: true,
    });
  }

  // -------------------------------------------------------------
  // ACTION 2: SEND RESET EMAIL VIA FIREBASE ADMIN
  // -------------------------------------------------------------
  if (action === 'send_email') {
    const emailToSend = String(body.email || query).trim();
    if (!emailToSend || !emailToSend.includes('@')) {
      return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ ok: false, error: 'Auth server not configured.' }, { status: 503 });
    }

    try {
      const resetLink = await adminAuth.generatePasswordResetLink(emailToSend);
      console.log(`[reset-pin] Generated password reset link for ${emailToSend}`);
      return NextResponse.json({
        ok: true,
        message: 'Password reset link generated successfully.',
        resetLink,
        maskedEmail: maskEmail(emailToSend),
      });
    } catch (err: any) {
      console.error('[reset-pin send_email error]', err);
      const code = err?.code || '';
      if (code === 'auth/user-not-found') {
        return NextResponse.json(
          { ok: false, error: 'No account registered with this email address.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { ok: false, error: err?.message || 'Failed to send reset email.' },
        { status: 500 }
      );
    }
  }

  // -------------------------------------------------------------
  // ACTION 3: OTP-VERIFIED 6-DIGIT PIN RESET (Updates BOTH Badge & Email + Postgres)
  // -------------------------------------------------------------
  if (action === 'reset_pin') {
    const badgeId = normalizeBadgeId(String(body.badgeId || query));
    const newPinRaw = String(body.newPin || body.pin || '').trim();
    const mfaToken = typeof body.mfaToken === 'string' ? body.mfaToken : '';
    const resolvedFacility = facilityId || 'IGH-EKT';

    const rl = checkRateLimit(`reset-pin:${ip}:${badgeId}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: `Too many reset attempts. Retry in ${rl.retryAfterSeconds}s.` },
        { status: 429 }
      );
    }

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'Staff Badge ID is required.' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(newPinRaw)) {
      return NextResponse.json(
        { ok: false, error: 'New PIN must be an exact 6-digit numeric PIN (used for both Badge ID and Email login).' },
        { status: 400 }
      );
    }

    // Real-time identity verification required: must present valid Email OTP proof token
    const verifiedProof = await verifyMfaToken(mfaToken, badgeId, resolvedFacility);
    if (!verifiedProof) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED_RESET',
          message: 'Real-time Email OTP verification is required before resetting your 6-digit PIN.',
        },
        { status: 401 }
      );
    }

    const pin6 = newPinRaw;
    const authEmail = badgeAuthEmail(badgeId);
    const workEmail = String(body.email || '').trim().toLowerCase();
    const hasRealWorkEmail = Boolean(
      workEmail && workEmail.includes('@') && !workEmail.endsWith('.firebaseapp.com')
    );
    const rawBodyName = String(body.staffName || '').trim();
    const bodyStaffName =
      rawBodyName && rawBodyName.toUpperCase() !== badgeId ? rawBodyName : '';
    let updatedInAuth = false;
    let badgeUser: any = null;
    let emailUser: any = null;

    // 1. Update BOTH Badge Auth User AND Work Email Auth User in Firebase Auth with the exact same 6-digit PIN
    if (adminAuth) {
      try {
        badgeUser = await adminAuth.getUserByEmail(authEmail).catch(() => null);
        if (hasRealWorkEmail) {
          emailUser = await adminAuth.getUserByEmail(workEmail).catch(() => null);
        }

        const preDisplayName =
          [badgeUser?.displayName, emailUser?.displayName]
            .map((d) => String(d || '').trim())
            .find((d) => d && d.toUpperCase() !== badgeId) ||
          bodyStaffName ||
          badgeId;

        if (badgeUser) {
          await adminAuth.updateUser(badgeUser.uid, { password: pin6 });
          updatedInAuth = true;
        } else {
          badgeUser = await adminAuth.createUser({
            email: authEmail,
            password: pin6,
            displayName: preDisplayName,
          });
          updatedInAuth = true;
        }

        if (hasRealWorkEmail) {
          if (emailUser) {
            await adminAuth.updateUser(emailUser.uid, { password: pin6 });
            updatedInAuth = true;
          } else {
            emailUser = await adminAuth.createUser({
              email: workEmail,
              password: pin6,
              displayName: preDisplayName,
            });
            updatedInAuth = true;
          }
        }
      } catch (authErr) {
        console.warn('[reset-pin] Firebase Auth update error:', authErr);
      }
    }

    const fbClaims = (badgeUser?.customClaims ||
      emailUser?.customClaims ||
      {}) as Record<string, unknown>;
    const fbDisplayName =
      [badgeUser?.displayName, emailUser?.displayName]
        .map((d) => String(d || '').trim())
        .find((d) => d && d.toUpperCase() !== badgeId) || '';
    const fbRoleKey = String(fbClaims.role || '').trim();
    const fbClearance =
      Number(fbClaims.clearanceLevel) ||
      (fbRoleKey === 'hospital_admin' || fbRoleKey === 'sysadmin' ? 5 : 2);
    const fbFacilityId = String(fbClaims.facility_id || '').trim().toUpperCase();
    const fbWorkEmail = String(fbClaims.workEmail || '').trim().toLowerCase();

    // 2. Update in Aurora PostgreSQL while preserving real name, role, clearance, and permissions
    if (isPostgresConfigured() && resolvedFacility) {
      try {
        const existing =
          (await getStaff(resolvedFacility, badgeId)) || (await findStaffAnyFacility(badgeId));
        const existingName =
          existing?.full_name && existing.full_name.trim().toUpperCase() !== badgeId
            ? existing.full_name.trim()
            : '';
        const resolvedFullName = existingName || fbDisplayName || bodyStaffName || badgeId;
        const resolvedRoleKey = existing?.role_key || fbRoleKey || 'staff';
        const isAdmin =
          resolvedRoleKey === 'hospital_admin' || resolvedRoleKey === 'sysadmin';
        const resolvedRole = existing?.role || (isAdmin ? 'Hospital Administrator' : 'Staff');
        const resolvedTitle = existing?.title || resolvedRole;
        const resolvedDept =
          existing?.department || (isAdmin ? 'Hospital Management' : 'Clinical Operations');
        const resolvedClearance =
          existing?.clearance_level && existing.clearance_level > 1
            ? existing.clearance_level
            : fbClearance;
        const resolvedClearanceLabel =
          existing?.clearance_label || (isAdmin ? 'Administrator' : `L${resolvedClearance}`);
        const existingPerms = Array.isArray(existing?.permissions)
          ? (existing.permissions as string[])
          : [];
        const resolvedPermissions = existingPerms.length
          ? existingPerms
          : isAdmin
          ? ['*']
          : undefined;
        const resolvedEmail = existing?.email || (workEmail || fbWorkEmail || undefined);
        const targetFacilityId = existing?.facility_id || fbFacilityId || resolvedFacility;

        await upsertStaff({
          badgeId,
          facilityId: targetFacilityId,
          fullName: resolvedFullName,
          role: resolvedRole,
          roleKey: resolvedRoleKey,
          title: resolvedTitle,
          department: resolvedDept,
          email: resolvedEmail,
          phone: existing?.phone || undefined,
          status: existing?.status || 'active',
          clearanceLevel: resolvedClearance,
          clearanceLabel: resolvedClearanceLabel,
          permissions: resolvedPermissions,
          pin: pin6,
          authEmail: existing?.auth_email || authEmail,
        });
      } catch (pgErr) {
        console.warn('[reset-pin] Postgres update error:', pgErr);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `6-digit PIN for ${badgeId} was updated for both Badge ID and Email sign-in.`,
      badgeId,
      authUpdated: updatedInAuth,
    });
  }

  return NextResponse.json({ ok: false, error: `Unknown action "${action}"` }, { status: 400 });
}
