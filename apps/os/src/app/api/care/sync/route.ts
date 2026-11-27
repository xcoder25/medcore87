import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  recordAppointmentFromCarePortal,
  type CarePortalBooking,
} from '../../../../lib/careReminderScheduler';
import { runPatientTriageBot } from '../../../../lib/patientTriageBotEngine';
import {
  ensureSchema,
  isPostgresConfigured,
  withTenantClient,
} from '../../../../lib/db/postgres';
import { upsertPatient } from '../../../../lib/db/patientRepo';
import { publishFacilitySseEvent } from '../../../../lib/sseBroker';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';
import { paystackFetch, resolvePaystackSecretKey } from '../../../../lib/paystackServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BOOKINGS_VAULT = path.join(os.tmpdir(), 'medcore-care-bookings-v1.json');
const PATIENT_OTP_VAULT = path.join(os.tmpdir(), 'medcore-patient-otp-vault.json');

interface PatientOtpChallenge {
  key: string;
  facilityId: string;
  identifier: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
}

let memBookings: CarePortalBooking[] | null = null;
let memPatientOtps: Record<string, PatientOtpChallenge> | null = null;

function readBookings(): CarePortalBooking[] {
  if (memBookings) return [...memBookings];
  try {
    if (fs.existsSync(BOOKINGS_VAULT)) {
      const parsed = JSON.parse(fs.readFileSync(BOOKINGS_VAULT, 'utf8'));
      if (Array.isArray(parsed)) {
        memBookings = parsed as CarePortalBooking[];
        return [...memBookings];
      }
    }
  } catch {
    // ignore
  }
  memBookings = [];
  return [];
}

function writeBookings(items: CarePortalBooking[]): void {
  memBookings = [...items];
  try {
    fs.writeFileSync(BOOKINGS_VAULT, JSON.stringify(items), 'utf8');
  } catch {
    // ignore
  }
}

function readOtpVault(): Record<string, PatientOtpChallenge> {
  if (memPatientOtps) return memPatientOtps;
  try {
    if (fs.existsSync(PATIENT_OTP_VAULT)) {
      const parsed = JSON.parse(fs.readFileSync(PATIENT_OTP_VAULT, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        memPatientOtps = parsed as Record<string, PatientOtpChallenge>;
        return memPatientOtps;
      }
    }
  } catch {
    // ignore
  }
  memPatientOtps = {};
  return memPatientOtps;
}

function writeOtpVault(map: Record<string, PatientOtpChallenge>): void {
  memPatientOtps = map;
  try {
    fs.writeFileSync(PATIENT_OTP_VAULT, JSON.stringify(map), 'utf8');
  } catch {
    // ignore
  }
}

function hashPatientOtp(otp: string, key: string): string {
  const secret = process.env.SESSION_SECRET || 'medcore-patient-otp-pepper-v1';
  return crypto.createHmac('sha256', secret).update(`${key}::${otp}`).digest('hex');
}

function maskTarget(id: string): string {
  const clean = id.trim();
  if (clean.includes('@')) {
    const [u, d] = clean.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
}

function normalizeDigits(val: unknown): string {
  return String(val || '').replace(/\D/g, '');
}

function matchesPatientRecord(
  item: Record<string, unknown>,
  shid: string,
  phone: string
): boolean {
  const sUp = shid.trim().toUpperCase();
  const pDig = normalizeDigits(phone);
  const candidates = [
    item.shid,
    item.hospitalNumber,
    item.patientId,
    item.patient_id,
    item.mrn,
  ]
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean);
  if (sUp && candidates.includes(sUp)) return true;
  if (pDig.length >= 7) {
    const recPhone = normalizeDigits(item.phone || item.patientPhone || '');
    if (recPhone && recPhone === pDig) return true;
  }
  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const shid = (req.nextUrl.searchParams.get('shid') || '').trim();
  const phone = (req.nextUrl.searchParams.get('phone') || '').trim();
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT').trim().toUpperCase();

  // Strictly single-patient scoped lookup: refuse unauthenticated bulk portal reads
  if (!shid && !phone) {
    return NextResponse.json(
      { ok: false, error: 'Patient SHID or phone identifier is required for Care Portal sync.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let allBookings = readBookings();
  const labs: any[] = [];
  const prescriptions: any[] = [];
  const vitals: any[] = [];
  const summaries: any[] = [];
  const bills: any[] = [];

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{ payload: CarePortalBooking }>(
          `SELECT payload FROM care_bookings WHERE facility_id = $1 AND ($2 <> '' AND UPPER(shid) = UPPER($2) OR $3 <> '' AND regexp_replace(COALESCE(phone,''), '\\D', '', 'g') = regexp_replace($3, '\\D', '', 'g')) ORDER BY created_at DESC LIMIT 50`,
          [facilityId, shid, phone]
        );
        if (res.rows.length > 0) {
          allBookings = res.rows.map((r) => r.payload);
        }

        // Single-patient scoped records & vitals lookup
        const patRes = await c.query<{
          id: string;
          hospital_number: string;
          full_name: string;
          phone: string;
          primary_diagnosis: string;
          updated_at: Date;
        }>(
          `SELECT id, hospital_number, full_name, phone, primary_diagnosis, updated_at
           FROM patients
           WHERE facility_id = $1
             AND (($2 <> '' AND (UPPER(id) = UPPER($2) OR UPPER(hospital_number) = UPPER($2)))
               OR ($3 <> '' AND regexp_replace(COALESCE(phone,''), '\\D', '', 'g') = regexp_replace($3, '\\D', '', 'g')))
           LIMIT 3`,
          [facilityId, shid, phone]
        );
        const patIds = patRes.rows.map((r) => r.id);
        for (const p of patRes.rows) {
          if (p.primary_diagnosis) {
            summaries.push({
              id: `SUM-${p.id}`,
              title: p.primary_diagnosis,
              facilityId,
              updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
            });
          }
        }

        if (patIds.length > 0) {
          const vRes = await c.query<Record<string, unknown>>(
            `SELECT * FROM patient_vitals WHERE facility_id = $1 AND patient_id = ANY($2::text[]) ORDER BY recorded_at DESC LIMIT 8`,
            [facilityId, patIds]
          );
          vitals.push(...vRes.rows);
        }

        const stateRes = await c.query<{ key: string; value: unknown }>(
          `SELECT key, value FROM facility_state WHERE facility_id = $1 AND key = ANY($2::text[])`,
          [
            facilityId,
            [
              'medcore_lab_orders_v1',
              'medcore_os_clinical_orders_v1',
              'medcore_prescriptions_v1',
              'medcore_billing_invoices_v1',
            ],
          ]
        );
        for (const row of stateRes.rows) {
          const list = Array.isArray(row.value) ? (row.value as Record<string, unknown>[]) : [];
          for (const item of list) {
            if (!matchesPatientRecord(item, patIds[0] || shid, phone)) continue;
            if (row.key.includes('prescription')) {
              prescriptions.push(item);
            } else if (row.key.includes('billing') || row.key.includes('invoice')) {
              bills.push(item);
            } else {
              labs.push(item);
            }
          }
        }
      });
    } catch {
      // keep vault fallback
    }
  }

  const patientBookings = allBookings.filter((b) => {
    if (shid && b.shid && b.shid.toUpperCase() === shid.toUpperCase()) return true;
    if (phone && b.phone && normalizeDigits(b.phone) === normalizeDigits(phone)) return true;
    return false;
  });

  // Check AKSHIA card coverage status via patientTriageBotEngine
  const coverage = runPatientTriageBot({
    text: `Check AKSHIA status ${shid || ''}`,
    patient: { shid, akshiaId: shid, phone, lga: facilityId === 'IGH-EKT' ? 'Eket' : 'Uyo' },
  }).akshiaStatus;

  const checkinPrompt = runPatientTriageBot({
    text: 'ANC and hypertension check-in reminders',
    patient: { shid, phone, isPregnant: true, chronicConditions: ['Hypertension'] },
  }).careReminders;

  return NextResponse.json(
    {
      ok: true,
      shid: shid || undefined,
      facilityId,
      akshiaCoverage: coverage,
      appointments: patientBookings,
      reminders: checkinPrompt || [],
      records: {
        labs: labs.slice(0, 15),
        prescriptions: prescriptions.slice(0, 15),
        vitals: vitals.slice(0, 10),
        summaries: summaries.slice(0, 10),
      },
      bills: bills.slice(0, 15),
      syncedAt: new Date().toISOString(),
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = req?.headers && typeof req.headers.get === 'function' ? getClientIp(req.headers) : 'mobile-client';
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      identifier?: string;
      code?: string;
      message?: string;
      amountNgn?: number;
      invoiceRef?: string;
      email?: string;
      patientId?: string;
      fullName?: string;
      sex?: string;
      dateOfBirth?: string;
      facilityId?: string;
      facilityName?: string;
      patientName?: string;
      shid?: string;
      phone?: string;
      department?: string;
      preferredSlot?: string;
      bookingRef?: string;
      source?: CarePortalBooking['source'];
    };

    if (body.action === 'request_patient_otp') {
      const identifier = String(body.identifier || body.phone || body.email || body.shid || '').trim();
      const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
      if (identifier.length < 3) {
        return NextResponse.json(
          { ok: false, error: 'Phone number, email, or SHID is required.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const rl = checkRateLimit(`care-otp-send:${ip}:${identifier.toLowerCase()}`, 6, 5 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, error: `Too many code requests. Retry in ${rl.retryAfterSeconds}s.` },
          { status: 429, headers: CORS_HEADERS }
        );
      }
      const key = `${facilityId}::${identifier.toUpperCase()}`;
      const otp = String(crypto.randomInt(100000, 1000000));
      const vault = readOtpVault();
      vault[key] = {
        key,
        facilityId,
        identifier,
        otpHash: hashPatientOtp(otp, key),
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
      };
      writeOtpVault(vault);

      let channel: 'webhook' | 'console_fallback' = 'console_fallback';
      const webhookUrl = process.env.SMS_WEBHOOK_URL || process.env.EMAIL_WEBHOOK_URL || '';
      if (webhookUrl) {
        try {
          const wRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: identifier, otp, facilityId, channel: 'patient_care_portal' }),
          });
          if (wRes.ok) channel = 'webhook';
        } catch {
          // keep console fallback
        }
      }

      return NextResponse.json(
        {
          ok: true,
          sent: true,
          channel,
          maskedTarget: maskTarget(identifier),
          expiresInSeconds: 300,
          ...(channel === 'console_fallback' ? { devPreviewCode: otp } : {}),
        },
        { headers: CORS_HEADERS }
      );
    }

    if (body.action === 'verify_patient_otp') {
      const identifier = String(body.identifier || body.phone || body.email || body.shid || '').trim();
      const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
      const facilityName = String(body.facilityName || 'Immanuel General Hospital, Eket').trim();
      const cleanCode = String(body.code || '').replace(/\D/g, '').trim();

      if (!identifier || cleanCode.length !== 6) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'Identifier and 6-digit verification code are required.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const key = `${facilityId}::${identifier.toUpperCase()}`;
      const vault = readOtpVault();
      const rec = vault[key];
      if (!rec) {
        return NextResponse.json(
          { ok: false, verified: false, error: 'No active verification code found. Request a new code.' },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      if (Date.now() > rec.expiresAt) {
        delete vault[key];
        writeOtpVault(vault);
        return NextResponse.json(
          { ok: false, verified: false, error: 'Verification code expired. Request a new code.' },
          { status: 401, headers: CORS_HEADERS }
        );
      }
      if (rec.attempts >= 5) {
        delete vault[key];
        writeOtpVault(vault);
        return NextResponse.json(
          { ok: false, verified: false, error: 'Too many invalid attempts. Request a new code.' },
          { status: 429, headers: CORS_HEADERS }
        );
      }
      if (hashPatientOtp(cleanCode, key) !== rec.otpHash) {
        rec.attempts += 1;
        vault[key] = rec;
        writeOtpVault(vault);
        return NextResponse.json(
          { ok: false, verified: false, error: 'Invalid verification code.' },
          { status: 401, headers: CORS_HEADERS }
        );
      }

      delete vault[key];
      writeOtpVault(vault);

      const isEmail = identifier.includes('@');
      const cleanShid = identifier.toUpperCase().startsWith('SHID')
        ? identifier.toUpperCase()
        : `SHID-AKS-${crypto.createHash('sha256').update(`${facilityId}:${identifier}`).digest('hex').slice(0, 6).toUpperCase()}`;

      let resolvedPatient = {
        patientId: `PAT-${facilityId.slice(-3)}-${cleanShid.slice(-4)}`,
        shid: cleanShid,
        fullName: 'Verified Care Patient',
        phone: !isEmail && !identifier.toUpperCase().startsWith('SHID') ? identifier : '',
        email: isEmail ? identifier.toLowerCase() : '',
        facilityId,
        facilityName,
      };

      if (isPostgresConfigured()) {
        try {
          await ensureSchema();
          await withTenantClient(facilityId, async (c) => {
            const pRes = await c.query<{
              id: string;
              hospital_number: string;
              full_name: string;
              phone: string;
              email: string;
            }>(
              `SELECT id, hospital_number, full_name, phone, email
               FROM patients
               WHERE facility_id = $1
                 AND (UPPER(hospital_number) = UPPER($2)
                   OR LOWER(COALESCE(email,'')) = LOWER($2)
                   OR regexp_replace(COALESCE(phone,''), '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g'))
               LIMIT 1`,
              [facilityId, identifier]
            );
            if (pRes.rows[0]) {
              const row = pRes.rows[0];
              resolvedPatient = {
                patientId: row.id,
                shid: row.hospital_number || cleanShid,
                fullName: row.full_name || resolvedPatient.fullName,
                phone: row.phone || resolvedPatient.phone,
                email: row.email || resolvedPatient.email,
                facilityId,
                facilityName,
              };
            }
          });
        } catch {
          // keep synthesized fallback
        }
      }

      return NextResponse.json(
        { ok: true, verified: true, patient: resolvedPatient },
        { headers: CORS_HEADERS }
      );
    }

    if (body.action === 'patient_triage') {
      const message = String(body.message || '').trim();
      const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
      if (message.length < 2) {
        return NextResponse.json(
          { ok: false, error: 'Describe your symptoms to run triage.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const triage = runPatientTriageBot({
        text: message,
        patient: {
          name: body.patientName,
          shid: body.shid,
          akshiaId: body.shid,
          phone: body.phone,
          lga: facilityId === 'IGH-EKT' ? 'Eket' : 'Uyo',
        },
      });
      return NextResponse.json(
        {
          ok: true,
          intent: triage.intent,
          urgency: triage.urgency,
          language: triage.language,
          reply: triage.replyText,
          voiceScript: triage.voiceScript,
          redFlags: triage.redFlags,
          recommendedDepartment: triage.appointmentDraft?.department || 'General Outpatient (GOPD)',
          suggestedQuickReplies: triage.suggestedQuickReplies,
          akshiaStatus: triage.akshiaStatus,
          careReminders: triage.careReminders,
        },
        { headers: CORS_HEADERS }
      );
    }

    if (body.action === 'init_patient_payment') {
      const amountNgn = Number(body.amountNgn || 0);
      const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
      if (!Number.isFinite(amountNgn) || amountNgn < 1) {
        return NextResponse.json(
          { ok: false, error: 'Valid positive payment amount (NGN) is required.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const reference = String(
        body.invoiceRef || `MCR-PAY-${facilityId.slice(-3)}-${Date.now().toString(36).toUpperCase()}`
      ).trim();
      const payerEmail = String(body.email || `${(body.shid || 'patient').toLowerCase()}@medcore.ng`).trim();
      const secretKey = await resolvePaystackSecretKey(req, undefined, facilityId);

      let mode: 'paystack' | 'bank_transfer_mandate' = 'bank_transfer_mandate';
      let authorizationUrl: string | undefined;
      let accessCode: string | undefined;

      if (secretKey) {
        try {
          const { ok, data } = await paystackFetch(
            '/transaction/initialize',
            {
              method: 'POST',
              body: JSON.stringify({
                email: payerEmail,
                amount: Math.round(amountNgn * 100),
                currency: 'NGN',
                reference,
                channels: ['bank_transfer', 'ussd', 'bank'],
                metadata: {
                  facilityId,
                  shid: body.shid,
                  patientName: body.patientName,
                  source: 'care_mobile_app',
                },
              }),
            },
            secretKey
          );
          if (ok && data?.data?.authorization_url) {
            mode = 'paystack';
            authorizationUrl = data.data.authorization_url;
            accessCode = data.data.access_code;
          }
        } catch {
          // fall back cleanly to transfer mandate
        }
      }

      try {
        publishFacilitySseEvent({
          facilityId,
          key: 'care_payment_initiated',
          value: { reference, amountNgn, shid: body.shid, mode },
        });
      } catch {
        // ignore SSE failure
      }

      return NextResponse.json(
        {
          ok: true,
          mode,
          reference,
          amountNgn,
          facilityId,
          authorizationUrl,
          accessCode,
          instructions:
            mode === 'paystack'
              ? 'Complete payment via Paystack checkout URL or USSD.'
              : `Pay NGN ${amountNgn.toLocaleString()} via Bank Transfer / AkwaRemit quoting reference ${reference} at Cashiers Desk.`,
        },
        { status: 201, headers: CORS_HEADERS }
      );
    }

    if (body.action === 'register_patient') {
      const fullName = String(body.fullName || body.patientName || '').trim();
      const phone = String(body.phone || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
      const facilityName = String(body.facilityName || 'Immanuel General Hospital, Eket').trim();

      if (fullName.length < 2) {
        return NextResponse.json(
          { ok: false, error: 'Full name (at least 2 characters) is required to sign up.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      if (phone.replace(/\D/g, '').length < 7 && !email.includes('@')) {
        return NextResponse.json(
          { ok: false, error: 'A valid phone number or email address is required to create a patient account.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const patientId = String(
        body.patientId || `PAT-${facilityId.slice(-3)}-${Date.now().toString(36).toUpperCase()}`
      ).trim();
      const shidDigest = crypto
        .createHash('sha256')
        .update(`${facilityId}:${fullName}:${phone || email}`)
        .digest('hex')
        .slice(0, 6)
        .toUpperCase();
      const shid = String(body.shid || `SHID-AKS-${shidDigest}`).trim().toUpperCase();
      const registeredAt = new Date().toISOString();

      if (isPostgresConfigured()) {
        try {
          await upsertPatient({
            id: patientId,
            facilityId,
            facilityName,
            hospitalNumber: shid,
            fullName,
            sex: body.sex ? String(body.sex) : undefined,
            dateOfBirth: body.dateOfBirth ? String(body.dateOfBirth) : undefined,
            phone: phone || undefined,
            email: email || undefined,
            status: 'active',
            meta: {
              source: 'care_mobile_signup',
              shid,
              registeredAt,
            },
          });
        } catch {
          // continue cleanly with local vault fallback
        }
      }

      try {
        publishFacilitySseEvent({
          facilityId,
          key: 'care_patient_registered',
          value: {
            patientId,
            shid,
            fullName,
            facilityId,
            registeredAt,
          },
        });
      } catch {
        // ignore SSE broadcast error
      }

      return NextResponse.json(
        {
          ok: true,
          registered: true,
          patient: {
            patientId,
            shid,
            fullName,
            phone: phone || undefined,
            email: email || undefined,
            facilityId,
            facilityName,
            registeredAt,
          },
        },
        { status: 201, headers: CORS_HEADERS }
      );
    }

    if (!body.patientName && !body.shid && !body.phone) {
      return NextResponse.json(
        { ok: false, error: 'patientName, shid, or phone is required to book an appointment.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const booking = recordAppointmentFromCarePortal({
      bookingRef: body.bookingRef,
      facilityId,
      facilityName: String(body.facilityName || 'Immanuel General Hospital, Eket'),
      patientName: String(body.patientName || body.shid || 'MedCore Care Patient'),
      shid: body.shid,
      phone: body.phone,
      department: String(body.department || 'General Outpatient Department (GOPD)'),
      preferredSlot: String(body.preferredSlot || 'Tomorrow · 09:00 AM'),
      source: body.source || 'care_mobile_app',
    });

    const current = readBookings();
    const next = [booking, ...current.filter((b) => b.bookingRef !== booking.bookingRef)].slice(0, 300);
    writeBookings(next);

    if (isPostgresConfigured()) {
      try {
        await ensureSchema();
        await withTenantClient(facilityId, async (c) => {
          await c.query(
            `INSERT INTO care_bookings (
               id, booking_ref, facility_id, facility_name, patient_name, shid,
               phone, department, preferred_slot, source, status, payload, created_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::timestamptz)
             ON CONFLICT (facility_id, id) DO UPDATE SET
               status = EXCLUDED.status,
               preferred_slot = EXCLUDED.preferred_slot,
               payload = EXCLUDED.payload`,
            [
              booking.id,
              booking.bookingRef,
              facilityId,
              booking.facilityName,
              booking.patientName,
              booking.shid || null,
              booking.phone || null,
              booking.department,
              booking.preferredSlot,
              booking.source,
              booking.status,
              JSON.stringify(booking),
              booking.createdAt,
            ]
          );
        });
      } catch {
        // ignore DB mirror failure
      }
    }

    try {
      publishFacilitySseEvent({
        facilityId,
        key: 'care_portal_booking',
        value: {
          bookingRef: booking.bookingRef,
          department: booking.department,
          preferredSlot: booking.preferredSlot,
          source: booking.source,
        },
      });
    } catch {
      // ignore SSE error
    }

    return NextResponse.json({ ok: true, booking }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to sync Care portal request.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
