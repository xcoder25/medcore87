import { NextRequest, NextResponse } from 'next/server';
import {
  getFirebaseAdminApp,
  isFirebaseAdminConfigured,
  adminVerifyIdToken,
  adminApiSecretOk,
} from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

/**
 * POST /api/staff/flush-facility
 * Body: { facilityId: string, confirm: "FLUSH_FACILITY_STAFF" }
 * Clears staffCards + staffRegistry on the facility Firestore doc (Admin SDK).
 */
export async function POST(req: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' },
      { status: 503 }
    );
  }

  const secret = req.headers.get('x-admin-secret');
  if (!adminApiSecretOk(secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid admin secret' }, { status: 401 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const who = token ? await adminVerifyIdToken(token) : null;
  if (!who) {
    return NextResponse.json({ ok: false, error: 'Valid ID token required' }, { status: 401 });
  }

  let body: { facilityId?: string; confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (String(body.confirm || '') !== 'FLUSH_FACILITY_STAFF') {
    return NextResponse.json(
      { ok: false, error: 'Send { confirm: "FLUSH_FACILITY_STAFF", facilityId }' },
      { status: 400 }
    );
  }

  const facilityId = String(body.facilityId || 'IGH-EKT').replace(/[\/#?]/g, '_');
  const app = getFirebaseAdminApp();
  if (!app) {
    return NextResponse.json({ ok: false, error: 'Admin app failed' }, { status: 503 });
  }

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore(app);
    const ref = db.collection('facilities').doc(facilityId);
    await ref.set(
      {
        staffCards: [],
        staffRegistry: [],
        staffUpdatedAt: new Date().toISOString(),
        flushAt: new Date().toISOString(),
        flushedBy: who.email || who.uid,
      },
      { merge: true }
    );

    // Best-effort: delete staff subcollection docs (batch)
    try {
      const staffCol = ref.collection('staff');
      const snap = await staffCol.limit(500).get();
      const batch = db.batch();
      let n = 0;
      snap.docs.forEach((d) => {
        if (String(d.id).toUpperCase().includes('ADM-001')) return;
        batch.delete(d.ref);
        n++;
      });
      if (n > 0) await batch.commit();
    } catch {
      /* rules / missing */
    }

    return NextResponse.json({
      ok: true,
      facilityId,
      flushedBy: who.email || who.uid,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'flush failed' },
      { status: 500 }
    );
  }
}
