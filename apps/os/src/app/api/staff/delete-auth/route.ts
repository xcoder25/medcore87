import { NextRequest, NextResponse } from 'next/server';
import {
  adminDeleteAuthUsers,
  adminVerifyIdToken,
  adminApiSecretOk,
  isFirebaseAdminConfigured,
} from '../../../../lib/firebaseAdmin';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { deleteStaff } from '../../../../lib/db/staffRepo';

export const runtime = 'nodejs';

/**
 * POST /api/staff/delete-auth
 * Body: { badgeId: string, email?: string, facilityId?: string }
 * Deletes that staff member's Firebase Auth accounts and removes them from Aurora Postgres.
 */
export async function POST(req: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured on server',
      },
      { status: 503 }
    );
  }

  const secret = req.headers.get('x-admin-secret');
  if (!adminApiSecretOk(secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid admin secret' }, { status: 401 });
  }

  // Verify ID token if supplied, but do not block session/PIN tokens in pilot OS
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (token && !token.startsWith('PIN-')) {
    try {
      await adminVerifyIdToken(token);
    } catch {
      /* non-blocking */
    }
  }

  let body: { badgeId?: string; email?: string; facilityId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const badge = String(body.badgeId || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!badge) {
    return NextResponse.json({ ok: false, error: 'badgeId required' }, { status: 400 });
  }

  // Must match client badgeAuthEmail() in firebase.ts
  const id = badge.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const project =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'naija-bites-1s3y1';
  const badgeEmail = `badge.${id}@${project}.firebaseapp.com`;
  const canonicalBadgeEmail = `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
  const emails: string[] = [badgeEmail];
  if (!emails.includes(canonicalBadgeEmail)) {
    emails.push(canonicalBadgeEmail);
  }
  if (body.email?.includes('@')) {
    emails.push(String(body.email).trim().toLowerCase());
  }

  try {
    const result = await adminDeleteAuthUsers(emails);

    // If facilityId provided, also delete from Aurora Postgres
    const fid = (body.facilityId || '').trim();
    if (fid && isPostgresConfigured()) {
      try {
        await deleteStaff(fid, badge);
      } catch (pgErr) {
        console.warn('[delete-auth] Postgres staff deletion notice:', pgErr);
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      badgeId: badge,
      badgeEmail,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'delete failed' },
      { status: 500 }
    );
  }
}
