import { NextRequest, NextResponse } from 'next/server';
import {
  adminDeleteAllAuthUsers,
  adminListAllAuthUsers,
  adminVerifyIdToken,
  adminApiSecretOk,
  isFirebaseAdminConfigured,
} from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';

const CONFIRM_PHRASE = 'DELETE_ALL_AUTH_USERS';

/**
 * GET /api/staff/delete-all-auth
 * Lists Auth users (count + sample). Requires Bearer ID token.
 */
export async function GET(req: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured on server' },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const secret = req.headers.get('x-admin-secret');
  if (!adminApiSecretOk(secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid admin secret' }, { status: 401 });
  }
  const who = token ? await adminVerifyIdToken(token) : null;
  if (!who) {
    return NextResponse.json(
      { ok: false, error: 'Valid Firebase ID token required (Authorization: Bearer …)' },
      { status: 401 }
    );
  }

  try {
    const { users, errors } = await adminListAllAuthUsers(500);
    return NextResponse.json({
      ok: true,
      count: users.length,
      users: users.slice(0, 50),
      truncated: users.length >= 500,
      errors,
      requestedBy: who.email || who.uid,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'list failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staff/delete-all-auth
 * Body: { confirm: "DELETE_ALL_AUTH_USERS" }
 * Headers: Authorization: Bearer <idToken>, optional x-admin-secret
 *
 * Deletes EVERY Firebase Authentication user in the project via Admin SDK.
 */
export async function POST(req: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_BASE64) not set on the server. Add the service account in Vercel env.',
      },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const secret = req.headers.get('x-admin-secret');
  if (!adminApiSecretOk(secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid admin secret' }, { status: 401 });
  }

  const who = token ? await adminVerifyIdToken(token) : null;
  if (!who) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Sign in required. Pass your Firebase ID token as Authorization: Bearer <token>.',
      },
      { status: 401 }
    );
  }

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (String(body.confirm || '').trim() !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        ok: false,
        error: `Confirmation required. Send { "confirm": "${CONFIRM_PHRASE}" }`,
      },
      { status: 400 }
    );
  }

  try {
    const result = await adminDeleteAllAuthUsers();
    return NextResponse.json({
      ok: result.errors.length === 0 && result.deleted > 0,
      deleted: result.deleted,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 20),
      requestedBy: who.email || who.uid,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'delete all failed' },
      { status: 500 }
    );
  }
}
