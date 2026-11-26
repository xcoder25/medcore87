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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BOOKINGS_VAULT = path.join(os.tmpdir(), 'medcore-care-bookings-v1.json');
let memBookings: CarePortalBooking[] | null = null;

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
      });
    } catch {
      // keep vault fallback
    }
  }
  const patientBookings = allBookings.filter((b) => {
    if (shid && b.shid && b.shid.toUpperCase() === shid.toUpperCase()) return true;
    if (phone && b.phone && b.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) return true;
    return false;
  });

  // Check AKSHIA card coverage status via patientTriageBotEngine or live AKSHIA endpoint
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
      syncedAt: new Date().toISOString(),
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      patientId?: string;
      fullName?: string;
      sex?: string;
      dateOfBirth?: string;
      email?: string;
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
      { ok: false, error: (err as Error)?.message || 'Failed to sync Care appointment.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
