import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';
import { findStaffAnyFacility, getStaff } from '../../../../lib/db/staffRepo';
import { getAdminAuth } from '../../../../lib/firebaseAdmin';
import { signMfaToken } from '../../../../lib/serverSession';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

function cleanEnv(v: string | undefined): string {
  let val = String(v || '').trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function isRealWorkEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return Boolean(e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.endsWith('.firebaseapp.com'));
}

function badgeAuthEmail(badgeId: string): string {
  const id = (badgeId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `badge.${id}@naija-bites-1s3y1.firebaseapp.com`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OtpChallengeRecord {
  badgeId: string;
  facilityId: string;
  email: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: string;
}

const OTP_VAULT_FILE = path.join(os.tmpdir(), 'medcore-staff-otp-vault.json');

function readOtpVault(): Record<string, OtpChallengeRecord> {
  try {
    if (fs.existsSync(OTP_VAULT_FILE)) {
      return JSON.parse(fs.readFileSync(OTP_VAULT_FILE, 'utf8')) as Record<string, OtpChallengeRecord>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeOtpVault(map: Record<string, OtpChallengeRecord>): void {
  try {
    fs.writeFileSync(OTP_VAULT_FILE, JSON.stringify(map), 'utf8');
  } catch {
    /* ignore read-only fs */
  }
}

function challengeKey(facilityId: string, badgeId: string): string {
  return `${facilityId.trim().toUpperCase()}::${badgeId.trim().toUpperCase()}`;
}

async function saveOtpChallenge(rec: OtpChallengeRecord): Promise<void> {
  const vault = readOtpVault();
  vault[challengeKey(rec.facilityId, rec.badgeId)] = rec;
  writeOtpVault(vault);

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(rec.facilityId, async (c) => {
        await c.query(
          `INSERT INTO staff_otp_challenges (facility_id, badge_id, email, otp_hash, expires_at, attempts, created_at)
           VALUES ($1, $2, $3, $4, $5, 0, NOW())
           ON CONFLICT (facility_id, badge_id) DO UPDATE SET
             email = EXCLUDED.email,
             otp_hash = EXCLUDED.otp_hash,
             expires_at = EXCLUDED.expires_at,
             attempts = 0,
             created_at = NOW()`,
          [rec.facilityId, rec.badgeId, rec.email, rec.otpHash, rec.expiresAt]
        );
      });
    } catch {
      /* vault fallback already saved */
    }
  }
}

async function loadOtpChallenge(facilityId: string, badgeId: string): Promise<OtpChallengeRecord | null> {
  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      let pgRow: OtpChallengeRecord | null = null;
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{
          email: string;
          otp_hash: string;
          expires_at: string | number;
          attempts: number;
          created_at: Date;
        }>(
          `SELECT email, otp_hash, expires_at, attempts, created_at
           FROM staff_otp_challenges
           WHERE facility_id = $1 AND badge_id = $2`,
          [facilityId, badgeId]
        );
        if (res.rows[0]) {
          const r = res.rows[0];
          pgRow = {
            facilityId,
            badgeId,
            email: r.email,
            otpHash: r.otp_hash,
            expiresAt: Number(r.expires_at),
            attempts: Number(r.attempts || 0),
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          };
        }
      });
      if (pgRow) return pgRow;
    } catch {
      /* fallback to vault */
    }
  }
  return readOtpVault()[challengeKey(facilityId, badgeId)] || null;
}

async function incrementOtpAttempts(facilityId: string, badgeId: string, nextAttempts: number): Promise<void> {
  const vault = readOtpVault();
  const key = challengeKey(facilityId, badgeId);
  if (vault[key]) {
    vault[key].attempts = nextAttempts;
    writeOtpVault(vault);
  }
  if (isPostgresConfigured()) {
    try {
      await withTenantClient(facilityId, async (c) => {
        await c.query(
          `UPDATE staff_otp_challenges SET attempts = $3 WHERE facility_id = $1 AND badge_id = $2`,
          [facilityId, badgeId, nextAttempts]
        );
      });
    } catch {
      /* ignore */
    }
  }
}

async function deleteOtpChallenge(facilityId: string, badgeId: string): Promise<void> {
  const vault = readOtpVault();
  delete vault[challengeKey(facilityId, badgeId)];
  writeOtpVault(vault);
  if (isPostgresConfigured()) {
    try {
      await withTenantClient(facilityId, async (c) => {
        await c.query(
          `DELETE FROM staff_otp_challenges WHERE facility_id = $1 AND badge_id = $2`,
          [facilityId, badgeId]
        );
      });
    } catch {
      /* ignore */
    }
  }
}

function hashOtp(otp: string, badgeId: string, facilityId: string): string {
  return crypto
    .createHash('sha256')
    .update(`MEDCORE-OTP:${facilityId.toUpperCase()}:${badgeId.toUpperCase()}:${otp}`)
    .digest('hex');
}

function maskEmail(email: string): string {
  const clean = email.trim();
  const at = clean.indexOf('@');
  if (at <= 1) return clean ? `***${clean.slice(at)}` : '';
  return `${clean[0]}${'*'.repeat(Math.min(5, at - 1))}${clean.slice(at - 1)}`;
}

function computeServerTotpCode(facilityId: string, offsetSteps = 0): string {
  const windowStep = Math.floor(Date.now() / (5 * 60 * 1000)) + offsetSteps;
  const seed = `MEDCORE-MFA:${facilityId || 'IGH-EKT'}:${windowStep}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 1_000_000).padStart(6, '0');
}

async function resolveStaffEmail(facilityId: string, badgeId: string, providedEmail?: string): Promise<string> {
  const direct = String(providedEmail || '').trim().toLowerCase();
  if (isRealWorkEmail(direct)) return direct;

  if (isPostgresConfigured()) {
    try {
      const row = (await getStaff(facilityId, badgeId)) || (await findStaffAnyFacility(badgeId));
      const dbEmail = String(row?.email || '').trim().toLowerCase();
      if (isRealWorkEmail(dbEmail)) return dbEmail;
    } catch {
      /* ignore */
    }
  }

  try {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      const fbUser = await adminAuth.getUserByEmail(badgeAuthEmail(badgeId)).catch(() => null);
      const claims = (fbUser?.customClaims || {}) as Record<string, unknown>;
      const claimsEmail = String(claims.workEmail || '').trim().toLowerCase();
      if (isRealWorkEmail(claimsEmail)) return claimsEmail;
    }
  } catch {
    /* ignore */
  }

  return '';
}

async function dispatchOtpEmail(opts: {
  to: string;
  otp: string;
  staffName: string;
  badgeId: string;
  facilityId: string;
  expiryMinutes: number;
}): Promise<{
  delivered: boolean;
  channel: 'resend' | 'webhook' | 'console_fallback';
  fromConfigured: boolean;
  error?: string;
}> {
  const subject = `MedCore OS Login OTP: ${opts.otp}`;
  const text = `Hello ${opts.staffName},\n\nYour one-time login verification code for MedCore OS (${opts.facilityId}, Badge ${opts.badgeId}) is: ${opts.otp}\n\nThis code expires in ${opts.expiryMinutes} minutes. Do not share it with anyone.`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #E2E8F0;border-radius:12px;">
      <h2 style="margin:0 0 8px;color:#0F172A;font-size:18px;">MedCore OS Login Verification</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;">Hello <strong>${opts.staffName}</strong> (${opts.badgeId}), use the one-time verification code below to complete your sign-in to <strong>${opts.facilityId}</strong>:</p>
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">
        <span style="font-size:28px;font-weight:900;letter-spacing:0.22em;color:#1D4ED8;font-family:monospace;">${opts.otp}</span>
      </div>
      <p style="margin:0;color:#64748B;font-size:12px;">Valid for ${opts.expiryMinutes} minutes. If you did not attempt to sign in, notify your Hospital Administrator immediately.</p>
    </div>
  `;

  const resendKey =
    cleanEnv(process.env.RESEND_API_KEY) || cleanEnv(process.env.MEDCORE_RESEND_API_KEY);
  const rawFrom =
    cleanEnv(process.env.MEDCORE_EMAIL_FROM) ||
    cleanEnv(process.env.RESEND_FROM_EMAIL) ||
    cleanEnv(process.env.RESEND_FROM) ||
    cleanEnv(process.env.EMAIL_FROM);
  const fromConfigured = Boolean(rawFrom);

  if (resendKey) {
    try {
      const from = !rawFrom
        ? 'MedCore OS Security <onboarding@resend.dev>'
        : !rawFrom.includes('@')
        ? `MedCore OS Security <no-reply@${rawFrom.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')}>`
        : rawFrom;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [opts.to], subject, text, html }),
      });
      if (res.ok) {
        return { delivered: true, channel: 'resend', fromConfigured };
      }
      const errTxt = await res.text().catch(() => '');
      let parsedMsg = errTxt.slice(0, 260);
      try {
        const parsed = JSON.parse(errTxt) as { message?: string; name?: string };
        if (parsed?.message) parsedMsg = parsed.message;
      } catch {
        /* use raw snippet */
      }
      const deliveryErr = `Resend HTTP ${res.status}: ${parsedMsg || 'rejected by gateway'}`;
      console.error('[api/auth/mfa] Resend error:', { status: res.status, fromConfigured, message: parsedMsg });
      return { delivered: false, channel: 'resend', fromConfigured, error: deliveryErr };
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[api/auth/mfa] Resend request failed:', msg);
      return { delivered: false, channel: 'resend', fromConfigured, error: msg };
    }
  }

  const webhookUrl = cleanEnv(process.env.EMAIL_WEBHOOK_URL);
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: opts.to,
          subject,
          text,
          html,
          otp: opts.otp,
          badgeId: opts.badgeId,
          facilityId: opts.facilityId,
        }),
      });
      if (res.ok) {
        return { delivered: true, channel: 'webhook', fromConfigured };
      }
      return { delivered: false, channel: 'webhook', fromConfigured, error: `Webhook HTTP ${res.status}` };
    } catch (e) {
      return { delivered: false, channel: 'webhook', fromConfigured, error: (e as Error).message };
    }
  }

  console.info(`[MedCore MFA Email OTP] ${opts.facilityId} · ${opts.badgeId} (${opts.to || 'no-email'}) -> ${opts.otp}`);
  return { delivered: false, channel: 'console_fallback', fromConfigured };
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const body = (await req.json()) as {
      action?: 'send_otp' | 'verify_otp' | 'verify_code';
      facilityId?: string;
      badgeId?: string;
      staffName?: string;
      email?: string;
      code?: string;
      expiryMinutes?: number;
    };

    const action = body.action || 'send_otp';
    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    const staffName = String(body.staffName || 'Staff').trim();

    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'badgeId required' }, { status: 400 });
    }

    if (action === 'send_otp') {
      const rl = checkRateLimit(`otp-send:${ip}:${badgeId}`, 5, 5 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', message: `Too many OTP requests. Retry in ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const resolvedEmail = await resolveStaffEmail(facilityId, badgeId, body.email);
      if (!resolvedEmail) {
        return NextResponse.json(
          {
            ok: false,
            error: 'NO_STAFF_EMAIL',
            message: 'No work email is registered for this staff badge. Contact Hospital Admin or use Offline MFA Code.',
          },
          { status: 400 }
        );
      }

      const expiryMinutes = Math.max(2, Math.min(15, Number(body.expiryMinutes) || 5));
      const otp = String(crypto.randomInt(100000, 1000000));
      const now = Date.now();
      await saveOtpChallenge({
        badgeId,
        facilityId,
        email: resolvedEmail,
        otpHash: hashOtp(otp, badgeId, facilityId),
        expiresAt: now + expiryMinutes * 60 * 1000,
        attempts: 0,
        createdAt: new Date(now).toISOString(),
      });

      const sendResult = await dispatchOtpEmail({
        to: resolvedEmail,
        otp,
        staffName,
        badgeId,
        facilityId,
        expiryMinutes,
      });

      return NextResponse.json({
        ok: true,
        sent: sendResult.delivered,
        channel: sendResult.channel,
        fromConfigured: sendResult.fromConfigured,
        maskedEmail: maskEmail(resolvedEmail),
        expiresInSeconds: expiryMinutes * 60,
        deliveryError: sendResult.error,
        ...(sendResult.channel === 'console_fallback' ? { devPreviewCode: otp } : {}),
      });
    }

    if (action === 'verify_otp') {
      const rl = checkRateLimit(`otp-verify:${ip}:${badgeId}`, 10, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'RATE_LIMITED', message: `Too many attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const clean = String(body.code || '').replace(/\D/g, '').trim();
      if (clean.length !== 6) {
        return NextResponse.json({ ok: false, verified: false, error: 'Enter the 6-digit Email OTP.' }, { status: 400 });
      }

      const record = await loadOtpChallenge(facilityId, badgeId);
      if (!record) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'OTP_NOT_FOUND', message: 'No active OTP challenge. Click Resend OTP.' },
          { status: 404 }
        );
      }

      if (Date.now() > record.expiresAt) {
        await deleteOtpChallenge(facilityId, badgeId);
        return NextResponse.json(
          { ok: false, verified: false, error: 'OTP_EXPIRED', message: 'OTP expired. Click Resend OTP to receive a new code.' },
          { status: 401 }
        );
      }

      if (record.attempts >= 5) {
        await deleteOtpChallenge(facilityId, badgeId);
        return NextResponse.json(
          { ok: false, verified: false, error: 'OTP_LOCKED', message: 'Too many incorrect attempts. Request a new OTP.' },
          { status: 429 }
        );
      }

      const candidateHash = hashOtp(clean, badgeId, facilityId);
      if (candidateHash !== record.otpHash) {
        const nextAttempts = record.attempts + 1;
        await incrementOtpAttempts(facilityId, badgeId, nextAttempts);
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error: 'INVALID_OTP',
            message: `Invalid OTP (${5 - nextAttempts} attempts remaining).`,
          },
          { status: 401 }
        );
      }

      await deleteOtpChallenge(facilityId, badgeId);
      const mfaToken = await signMfaToken(badgeId, facilityId, 'email_otp');
      return NextResponse.json({
        ok: true,
        verified: true,
        method: 'email_otp',
        maskedEmail: maskEmail(record.email),
        mfaToken,
      });
    }

    if (action === 'verify_code') {
      const rl = checkRateLimit(`code-verify:${ip}:${badgeId}`, 10, 10 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'RATE_LIMITED', message: `Too many attempts. Wait ${rl.retryAfterSeconds}s.` },
          { status: 429 }
        );
      }

      const clean = String(body.code || '').replace(/\D/g, '');
      const valid =
        clean.length === 6 &&
        (clean === computeServerTotpCode(facilityId, 0) || clean === computeServerTotpCode(facilityId, -1));
      if (!valid) {
        return NextResponse.json({ ok: false, verified: false, error: 'INVALID_MFA_CODE' }, { status: 401 });
      }
      const mfaToken = await signMfaToken(badgeId, facilityId, 'code');
      return NextResponse.json({ ok: true, verified: true, method: 'code', mfaToken });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported MFA action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
