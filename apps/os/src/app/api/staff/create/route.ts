import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { upsertStaff } from '../../../../lib/db/staffRepo';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      badgeId,
      facilityId,
      fullName,
      email,
      password,
      pin,
      role = 'Staff',
      roleKey = 'general_staff',
      title = '',
      department = 'General',
      facilityName = 'Default Hospital',
      clearanceLevel = 1,
      clearanceLabel = 'Level 1 - General',
      templateKey = 'TPL_CLINICAL',
      photoUrl,
    } = body;

    const bId = String(badgeId || '').trim().toUpperCase();
    const fId = String(facilityId || 'DEFAULT-HOSPITAL').trim();
    const name = String(fullName || '').trim();

    if (!bId || !name) {
      return NextResponse.json(
        { success: false, error: 'badgeId and fullName are required' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin SDK is not initialized' },
        { status: 503 }
      );
    }

    // Determine primary auth email and password
    const authEmail = (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ? email.trim().toLowerCase()
      : `${bId.toLowerCase()}@medcore.internal`;
    const authPassword = String(password || pin || '123456');

    // 1. Create or update Auth User
    let userRecord;
    let newlyCreated = false;
    try {
      userRecord = await adminAuth.getUserByEmail(authEmail);
      // Update password and display name if user already exists
      userRecord = await adminAuth.updateUser(userRecord.uid, {
        displayName: name,
        password: authPassword.length >= 6 ? authPassword : `${authPassword}000000`.slice(0, 6),
      });
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || '');
      if (code.includes('user-not-found')) {
        userRecord = await adminAuth.createUser({
          email: authEmail,
          password: authPassword.length >= 6 ? authPassword : `${authPassword}000000`.slice(0, 6),
          displayName: name,
        });
        newlyCreated = true;
      } else {
        throw err;
      }
    }

    const issuedAt = new Date().toISOString();
    const expiresDate = new Date();
    expiresDate.setFullYear(expiresDate.getFullYear() + 2);
    const expiresAt = expiresDate.toISOString();

    const initials = name
      .split(' ')
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'ST';

    const staffRecord: StaffCardRecord = {
      badgeId: bId,
      fullName: name,
      role: String(role),
      roleKey: String(roleKey),
      title: String(title),
      department: String(department),
      facilityId: fId,
      facilityName: String(facilityName),
      clearanceLevel: Number(clearanceLevel) || 1,
      clearanceLabel: String(clearanceLabel),
      templateKey: (templateKey as StaffCardTemplate) || 'TPL_CLINICAL',
      status: 'ACTIVE',
      issuedAt,
      expiresAt,
      photoUrl: photoUrl || undefined,
      initials,
      qrPayload: JSON.stringify({
        badgeId: bId,
        uid: userRecord.uid,
        facilityId: fId,
        issuedAt,
      }),
    };

    // 2. Persist to Firestore atomically
    try {
      const fidNormalized = fId.replace(/[\/#?]/g, '_');
      const staffDocRef = adminDb
        .collection('facilities')
        .doc(fidNormalized)
        .collection('staff')
        .doc(bId);

      await staffDocRef.set({
        ...staffRecord,
        uid: userRecord.uid,
        email: authEmail,
        createdAt: issuedAt,
        updatedAt: issuedAt,
        isActive: true,
      });

      // Also index in root staff collection for direct lookups by UID and badgeId
      const staffDocPayload = {
        ...staffRecord,
        uid: userRecord.uid,
        email: authEmail,
        createdAt: issuedAt,
        updatedAt: issuedAt,
        isActive: true,
      };
      await adminDb.collection('staff').doc(userRecord.uid).set(staffDocPayload);
      await adminDb.collection('staff').doc(bId).set(staffDocPayload);

      // Update facility root document staff directory for instant onSnapshot sync to other devices
      try {
        const facilityRef = adminDb.collection('facilities').doc(fidNormalized);
        const facilitySnap = await facilityRef.get();
        const facilityData = facilitySnap.exists ? facilitySnap.data() || {} : {};
        const currentCards = Array.isArray(facilityData.staffCards) ? facilityData.staffCards : [];
        const currentReg = Array.isArray(facilityData.staffRegistry) ? facilityData.staffRegistry : [];

        const nextCards = [staffRecord, ...currentCards.filter((c: any) => String(c.badgeId || '').toUpperCase() !== bId)];
        const nextReg = [
          {
            ...staffRecord,
            id: bId,
            name: name,
            pin: String(pin || '123456'),
            authEmail,
          },
          ...currentReg.filter((r: any) => String(r.badgeId || r.id || '').toUpperCase() !== bId),
        ];

        await facilityRef.set(
          {
            staffCards: nextCards,
            staffRegistry: nextReg,
            staffUpdatedAt: issuedAt,
          },
          { merge: true }
        );
      } catch (dirErr) {
        console.warn('[api/staff/create] Facility directory sync warning:', dirErr);
      }
    } catch (fsErr) {
      console.error('[api/staff/create] Firestore write failed:', fsErr);
      // Rollback newly created Auth user to prevent split-brain state
      if (newlyCreated && userRecord?.uid) {
        try {
          await adminAuth.deleteUser(userRecord.uid);
        } catch (rbErr) {
          console.warn('[api/staff/create] Auth rollback failed:', rbErr);
        }
      }
      throw fsErr;
    }

    // 3. Sync to Postgres repo if configured
    if (isPostgresConfigured()) {
      try {
        await upsertStaff({
          badgeId: bId,
          facilityId: fId,
          fullName: name,
          role: String(role),
          roleKey: String(roleKey),
          title: String(title),
          department: String(department),
          email: authEmail,
          clearanceLevel: Number(clearanceLevel) || 1,
          clearanceLabel: String(clearanceLabel),
          photoUrl: photoUrl || undefined,
          authEmail,
        });
      } catch (pgErr) {
        console.warn('[api/staff/create] Postgres sync warning:', pgErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        uid: userRecord.uid,
        badgeId: bId,
        staff: staffRecord,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[api/staff/create] Staff creation failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Staff creation failed' },
      { status: 500 }
    );
  }
}

