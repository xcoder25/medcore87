import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { hashPin, isPostgresConfigured } from '../../../../lib/db/postgres';
import { findStaffAnyFacility, getStaff } from '../../../../lib/db/staffRepo';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      pin?: string;
    };

    const facilityId = String(body.facilityId || '').trim().toUpperCase();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const rawPin = String(body.pin || '').trim();
    const normPin = rawPin.replace(/\s+/g, '');

    if (!badgeId || !normPin) {
      return NextResponse.json({ ok: false, verified: false, error: 'badgeId and pin required' }, { status: 400 });
    }

    const rl = checkRateLimit(`verify-pin:${ip}:${badgeId}`, 15, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, verified: false, error: 'RATE_LIMITED', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429 }
      );
    }

    if (!isPostgresConfigured()) {
      return NextResponse.json({ ok: true, configured: false, hasPinHash: false, verified: false });
    }

    const row = (facilityId ? await getStaff(facilityId, badgeId) : null) || (await findStaffAnyFacility(badgeId));
    if (!row) {
      return NextResponse.json({ ok: true, configured: true, hasPinHash: false, verified: false });
    }

    const storedHash = String((row as { pin_hash?: string | null }).pin_hash || '').trim();
    if (!storedHash) {
      return NextResponse.json({ ok: true, configured: true, hasPinHash: false, verified: false });
    }

    const verified = safeEqualHex(hashPin(normPin), storedHash) || safeEqualHex(hashPin(rawPin), storedHash);
    return NextResponse.json({ ok: true, configured: true, hasPinHash: true, verified });
  } catch (e) {
    return NextResponse.json({ ok: false, verified: false, error: (e as Error).message }, { status: 500 });
  }
}
