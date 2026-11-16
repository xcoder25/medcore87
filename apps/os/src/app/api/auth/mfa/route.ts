import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isPostgresConfigured } from '../../../../lib/db/postgres';
import { findStaffAnyFacility, getStaff } from '../../../../lib/db/staffRepo';
import { signMfaToken } from '../../../../lib/serverSession';

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
  const direct = String(providedEmail || '').trim();
  if (direct && direct.includes('@')) return direct;

  if (isPostgresConfigured()) {
    try {
      const row = (await getStaff(facilityId, badgeId)) || (await findStaffAnyFacility(badgeId));
      const dbEmail = String(row?.email || row?.auth_email || '').trim();
      if (dbEmail && dbEmail.includes('@')) return dbEmail;
    } catch {
      /* ignore */
    }
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
}): Promise<{ delivered: boolean; channel: 'resend' | 'webhook' | 'console_fallback'; error?: string }> {
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

  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const from = (process.env.MEDCORE_EMAIL_FROM || 'MedCore OS Security <onboarding@resend.dev>').trim();
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [opts.to], subject, text, html }),
      });
      if (res.ok) {
        return { delivered: true, channel: 'resend' };
      }
      const errTxt = await res.text().catch(() => '');
      return { delivered: false, channel: 'resend', error: `Resend HTTP ${res.status}: ${errTxt.slice(0, 120)}` };
    } catch (e) {
      return { delivered: false, channel: 'resend', error: (e as Error).message };
    }
  }

  const webhookUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
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
        return { delivered: true, channel: 'webhook' };
      }
      return { delivered: false, channel: 'webhook', error: `Webhook HTTP ${res.status}` };
    } catch (e) {
      return { delivered: false, channel: 'webhook', error: (e as Error).message };
    }
  }

  console.info(`[MedCore MFA Email OTP] ${opts.facilityId} · ${opts.badgeId} (${opts.to || 'no-email'}) -> ${opts.otp}`);
  return { delivered: false, channel: 'console_fallback' };
}

export async function POST(req: NextRequest) {
  try {
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
      const record: OtpChallengeRecord = {
        badgeId,
        facilityId,
        email: resolvedEmail,
        otpHash: hashOtp(otp, badgeId, facilityId),
        expiresAt: now + expiryMinutes * 60 * 1000,
        attempts: 0,
        createdAt: new Date(now).toISOString(),
      };

      const vault = readOtpVault();
      vault[challengeKey(facilityId, badgeId)] = record;
      writeOtpVault(vault);

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
        maskedEmail: maskEmail(resolvedEmail),
        expiresInSeconds: expiryMinutes * 60,
        deliveryError: sendResult.error,
        // Provide preview code only when no external mail provider is configured (pilot/local mode)
        ...(sendResult.channel === 'console_fallback' ? { devPreviewCode: otp } : {}),
      });
    }

    if (action === 'verify_otp') {
      const clean = String(body.code || '').replace(/\D/g, '').trim();
      if (clean.length !== 6) {
        return NextResponse.json({ ok: false, verified: false, error: 'Enter the 6-digit Email OTP.' }, { status: 400 });
      }

      const vault = readOtpVault();
      const key = challengeKey(facilityId, badgeId);
      const record = vault[key];

      if (!record) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'OTP_NOT_FOUND', message: 'No active OTP challenge. Click Resend OTP.' },
          { status: 404 }
        );
      }

      if (Date.now() > record.expiresAt) {
        delete vault[key];
        writeOtpVault(vault);
        return NextResponse.json(
          { ok: false, verified: false, error: 'OTP_EXPIRED', message: 'OTP expired. Click Resend OTP to receive a new code.' },
          { status: 401 }
        );
      }

      if (record.attempts >= 5) {
        delete vault[key];
        writeOtpVault(vault);
        return NextResponse.json(
          { ok: false, verified: false, error: 'OTP_LOCKED', message: 'Too many incorrect attempts. Request a new OTP.' },
          { status: 429 }
        );
      }

      const candidateHash = hashOtp(clean, badgeId, facilityId);
      if (candidateHash !== record.otpHash) {
        record.attempts += 1;
        vault[key] = record;
        writeOtpVault(vault);
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error: 'INVALID_OTP',
            message: `Invalid OTP (${5 - record.attempts} attempts remaining).`,
          },
          { status: 401 }
        );
      }

      // Single-use OTP verified — clear challenge and issue signed MFA proof token
      delete vault[key];
      writeOtpVault(vault);
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
