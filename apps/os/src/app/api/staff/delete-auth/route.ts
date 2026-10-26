import { NextRequest, NextResponse } from 'next/server';
import {
  adminDeleteAuthUsersByEmail,
  adminVerifyIdToken,
  adminApiSecretOk,
  isFirebaseAdminConfigured,
} from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

/**
 * POST /api/staff/delete-auth
 * Body: { badgeId: string, email?: string }
 * Deletes that staff member's Firebase Auth accounts (badge synthetic + optional work email).
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

  // Prefer authenticated admin; if token present but invalid, reject when secret is required
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (token) {
    const who = await adminVerifyIdToken(token);
    if (!who) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired ID token' }, { status: 401 });
    }
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
    const result = await adminDeleteAuthUsersByEmail(emails);
    return NextResponse.json({
      ok: result.errors.length === 0 || result.deleted.length > 0,
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
