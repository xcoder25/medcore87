import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { getStaff, listStaff, upsertStaff } from '../../../../lib/db/staffRepo';

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

function normalizeStaffPin(pin: string): string {
  const p = (pin || '').trim();
  if (p.length >= 6) return p;
  return (p + '000000').slice(0, 6);
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String(body.action || 'reset_pin').toLowerCase();
  const facilityId = String(body.facilityId || '').trim();
  const query = String(body.query || body.badgeId || body.email || '').trim();

  if (!query) {
    return NextResponse.json({ ok: false, error: 'Staff Badge ID or Email is required.' }, { status: 400 });
  }

  const adminAuth = getAdminAuth();

  // -------------------------------------------------------------
  // ACTION 1: LOOKUP ACCOUNT
  // -------------------------------------------------------------
  if (action === 'lookup') {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
    let matchedBadge = isEmail ? '' : normalizeBadgeId(query);
    let matchedStaff: any = null;

    // Check Postgres if configured
    if (isPostgresConfigured() && facilityId) {
      try {
        if (matchedBadge) {
          const row = await getStaff(facilityId, matchedBadge);
          if (row) matchedStaff = row;
        } else if (isEmail) {
          const all = await listStaff(facilityId);
          const found = all.find(
            (s) => s.email?.toLowerCase() === query.toLowerCase() || s.auth_email?.toLowerCase() === query.toLowerCase()
          );
          if (found) {
            matchedStaff = found;
            matchedBadge = found.badge_id;
          }
        }
      } catch (e) {
        console.warn('[reset-pin lookup] Postgres query error:', e);
      }
    }

    // Also check Firebase Auth user directly
    let hasAuthUser = false;
    let authUserEmail = '';
    if (adminAuth) {
      try {
        const emailToCheck = isEmail ? query : badgeAuthEmail(matchedBadge || query);
        const u = await adminAuth.getUserByEmail(emailToCheck);
        if (u) {
          hasAuthUser = true;
          authUserEmail = u.email || '';
        }
      } catch {
        /* user not found in Firebase Auth */
      }
    }

    if (!matchedStaff && !hasAuthUser) {
      return NextResponse.json({
        ok: false,
        found: false,
        error: `No staff record matching "${query}" was found. Please verify your Staff Badge ID.`,
      });
    }

    const officialEmail = String(
      matchedStaff?.email || matchedStaff?.auth_email || (isEmail ? query : '')
    ).trim();
    const displayName =
      matchedStaff?.full_name || matchedStaff?.name || (isEmail ? query.split('@')[0] : 'Healthcare Staff');
    const role = matchedStaff?.role || matchedStaff?.title || 'Staff Member';
    const department = matchedStaff?.department || '';
    const roleKey = matchedStaff?.role_key || matchedStaff?.roleKey || '';
    const clearanceLevel = matchedStaff?.clearance_level || matchedStaff?.clearanceLevel;

    return NextResponse.json({
      ok: true,
      found: true,
      badgeId: matchedBadge || (isEmail ? '' : query),
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
        message: `Password reset link generated successfully.`,
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
  // ACTION 3: DIRECT PIN RESET
  // -------------------------------------------------------------
  if (action === 'reset_pin') {
    const badgeId = normalizeBadgeId(String(body.badgeId || query));
    const newPinRaw = String(body.newPin || body.pin || '').trim();

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'Staff Badge ID is required.' }, { status: 400 });
    }
    if (!newPinRaw || newPinRaw.length < 4) {
      return NextResponse.json({ ok: false, error: 'New PIN must be at least 4 digits.' }, { status: 400 });
    }

    const pinNorm = normalizeStaffPin(newPinRaw);
    const authEmail = badgeAuthEmail(badgeId);
    let updatedInAuth = false;

    // 1. Update in Firebase Auth
    if (adminAuth) {
      try {
        let user;
        try {
          user = await adminAuth.getUserByEmail(authEmail);
        } catch {
          if (body.email && body.email.includes('@')) {
            try {
              user = await adminAuth.getUserByEmail(body.email.trim());
            } catch {
              /* not found */
            }
          }
        }

        if (user) {
          await adminAuth.updateUser(user.uid, { password: pinNorm });
          updatedInAuth = true;
        } else {
          await adminAuth.createUser({
            email: authEmail,
            password: pinNorm,
            displayName: badgeId,
          });
          updatedInAuth = true;
        }
      } catch (authErr) {
        console.warn('[reset-pin] Firebase Auth update error (non-fatal):', authErr);
      }
    }

    // 2. Update in Aurora PostgreSQL
    if (isPostgresConfigured() && facilityId) {
      try {
        const existing = await getStaff(facilityId, badgeId);
        await upsertStaff({
          badgeId,
          facilityId,
          fullName: existing?.full_name || badgeId,
          role: existing?.role || undefined,
          roleKey: existing?.role_key || undefined,
          title: existing?.title || undefined,
          department: existing?.department || undefined,
          email: existing?.email || undefined,
          phone: existing?.phone || undefined,
          status: existing?.status || 'active',
          clearanceLevel: existing?.clearance_level || 1,
          clearanceLabel: existing?.clearance_label || undefined,
          pin: pinNorm,
          authEmail: existing?.auth_email || authEmail,
        });
      } catch (pgErr) {
        console.warn('[reset-pin] Postgres update error:', pgErr);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `PIN for staff ${badgeId} was reset successfully.`,
      badgeId,
      pin: pinNorm,
      authUpdated: updatedInAuth,
    });
  }

  return NextResponse.json({ ok: false, error: `Unknown action "${action}"` }, { status: 400 });
}
