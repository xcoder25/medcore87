import { NextRequest, NextResponse } from 'next/server';
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

  const allBookings = readBookings();
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
            `INSERT INTO facility_kv (facility_id, key, value, updated_at)
             VALUES ($1, 'medcore_care_portal_bookings_v1', $2::jsonb, NOW())
             ON CONFLICT (facility_id, key)
             DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [facilityId, JSON.stringify(next.filter((x) => x.facilityId === facilityId))]
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
