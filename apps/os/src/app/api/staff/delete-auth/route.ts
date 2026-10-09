import { NextRequest, NextResponse } from 'next/server';
import {
  adminDeleteAuthUsers,
  isFirebaseAdminConfigured,
} from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

/**
 * POST /api/staff/delete-auth
 * Body: { badgeId: string, email?: string }
 * Deletes Firebase Auth accounts via Admin SDK (service account).
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

  let body: { badgeId?: string; email?: string } = {};
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
  const emails: string[] = [badgeEmail];
  if (body.email?.includes('@')) {
    emails.push(String(body.email).trim().toLowerCase());
  }

  try {
    const result = await adminDeleteAuthUsers(emails);
    return NextResponse.json({
      ok: result.errors.length === 0 || result.deleted.length > 0,
      ...result,
      badgeId: badge,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'delete failed' },
      { status: 500 }
    );
  }
}
