import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '../../../../lib/firebaseAdmin';

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
  const adminDb = getAdminFirestore();

  // -------------------------------------------------------------
  // ACTION 1: LOOKUP ACCOUNT
  // -------------------------------------------------------------
  if (action === 'lookup') {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
    let matchedBadge = isEmail ? '' : normalizeBadgeId(query);
    let matchedStaff: any = null;

    if (adminDb && facilityId) {
      const fidNorm = facilityId.replace(/[\/#?]/g, '_');
      try {
        if (matchedBadge) {
          const docSnap = await adminDb
            .collection('facilities')
            .doc(fidNorm)
            .collection('staff')
            .doc(matchedBadge)
            .get();
          if (docSnap.exists) {
            matchedStaff = { badgeId: docSnap.id, ...docSnap.data() };
          }
        } else if (isEmail) {
          // Search by email in staff subcollection
          const querySnap = await adminDb
            .collection('facilities')
            .doc(fidNorm)
            .collection('staff')
            .where('email', '==', query.toLowerCase())
            .limit(1)
            .get();
          if (!querySnap.empty) {
            const first = querySnap.docs[0];
            matchedStaff = { badgeId: first.id, ...first.data() };
            matchedBadge = first.id;
          }
        }

        // Check facility shared doc if not yet found
        // Check root staff collection (written atomically during create)
        if (!matchedStaff && matchedBadge) {
          try {
            const rootSnap = await adminDb.collection('staff').doc(matchedBadge).get();
            if (rootSnap.exists) {
              matchedStaff = { badgeId: rootSnap.id, ...rootSnap.data() };
            }
          } catch { /* ignore */ }
        }

        if (!matchedStaff) {
          const facSnap = await adminDb.collection('facilities').doc(fidNorm).get();
          if (facSnap.exists) {
            const data = facSnap.data() || {};
            const cards = Array.isArray(data.staffCards) ? data.staffCards : [];
            const reg = Array.isArray(data.staffRegistry) ? data.staffRegistry : [];
            const all = [...cards, ...reg];
            const hit = all.find((item: any) => {
              const b = normalizeBadgeId(item.badgeId || item.id);
              const e = String(item.email || item.workEmail || '').toLowerCase();
              if (matchedBadge && b === matchedBadge) return true;
              if (isEmail && e === query.toLowerCase()) return true;
              return false;
            });
            if (hit) {
              matchedStaff = hit;
              matchedBadge = normalizeBadgeId(hit.badgeId || hit.id);
            }
          }
        }
      } catch (e) {
        console.warn('[reset-pin lookup] Firestore error:', e);
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

    const officialEmail = String(matchedStaff?.email || matchedStaff?.workEmail || (isEmail ? query : '')).trim();
    const displayName = matchedStaff?.fullName || matchedStaff?.name || (isEmail ? query.split('@')[0] : 'Healthcare Staff');
    const role = matchedStaff?.role || matchedStaff?.title || 'Staff Member';
    const department = matchedStaff?.department || '';

    const roleKey = matchedStaff?.roleKey || matchedStaff?.role || '';
    const clearanceLevel = matchedStaff?.clearanceLevel;
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
      // Generate password reset link
      const resetLink = await adminAuth.generatePasswordResetLink(emailToSend);
      console.log(`[reset-pin] Generated password reset link for ${emailToSend}`);
      return NextResponse.json({
        ok: true,
        message: `Password reset link generated successfully.`,
        resetLink, // returned for verification / test environments
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
          // Try custom email if provided
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
          // If not in Firebase Auth yet, provision now with new PIN
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

    // 2. Update in Firestore
    if (adminDb && facilityId) {
      const fidNorm = facilityId.replace(/[\/#?]/g, '_');
      try {
        // Update staff subcollection document
        const staffDocRef = adminDb.collection('facilities').doc(fidNorm).collection('staff').doc(badgeId);
        await staffDocRef.set(
          {
            pin: pinNorm,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Also update root staff collection and backfill profile metadata
        try {
          const rootRef = adminDb.collection('staff').doc(badgeId);
          const rSnap = await rootRef.get();
          if (rSnap.exists) {
            await rootRef.set({ pin: pinNorm, updatedAt: new Date().toISOString() }, { merge: true });
            const rData = rSnap.data() || {};
            await staffDocRef.set({
              fullName: rData.fullName || rData.name,
              name: rData.name || rData.fullName,
              role: rData.role || (badgeId.startsWith('AMC-') ? 'Hospital Administrator' : 'Staff'),
              roleKey: rData.roleKey || (badgeId.startsWith('AMC-') ? 'hospital_admin' : 'doctor'),
              clearanceLevel: rData.clearanceLevel || (badgeId.startsWith('AMC-') ? 5 : 3),
              clearanceLabel: rData.clearanceLabel || (badgeId.startsWith('AMC-') ? 'Administrator' : 'L3'),
              department: rData.department || 'Hospital Management',
              facilityId: rData.facilityId || facilityId,
              facilityName: rData.facilityName,
            }, { merge: true });
          } else if (badgeId.startsWith('AMC-')) {
            // Auto-heal admin profile metadata so it never defaults to HIM / records
            await staffDocRef.set({
              role: 'Hospital Administrator',
              roleKey: 'hospital_admin',
              clearanceLevel: 5,
              clearanceLabel: 'Administrator',
              department: 'Hospital Management',
            }, { merge: true });
          }
        } catch (rErr) {
          console.warn('[reset-pin] root staff backfill note:', rErr);
        }

        // Update in facility shared document
        const sharedDocRef = adminDb.collection('facilities').doc(fidNorm);
        const sharedDocSnap = await sharedDocRef.get();
        if (sharedDocSnap.exists) {
          const data = sharedDocSnap.data() || {};
          let modified = false;

          const cards = Array.isArray(data.staffCards)
            ? data.staffCards.map((c: any) => {
              if (normalizeBadgeId(c.badgeId || c.id) === badgeId) {
                modified = true;
                return { ...c, pin: pinNorm };
              }
              return c;
            })
            : [];

          const registry = Array.isArray(data.staffRegistry)
            ? data.staffRegistry.map((r: any) => {
              if (normalizeBadgeId(r.badgeId || r.id) === badgeId) {
                modified = true;
                return { ...r, pin: pinNorm };
              }
              return r;
            })
            : [];

          if (modified) {
            await sharedDocRef.set(
              {
                staffCards: cards,
                staffRegistry: registry,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      } catch (fsErr) {
        console.warn('[reset-pin] Firestore write error:', fsErr);
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

