import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  generateDueCareReminders,
  type ScheduledCareReminder,
} from '../../../../lib/careReminderScheduler';
import {
  ensureSchema,
  isPostgresConfigured,
  withTenantClient,
} from '../../../../lib/db/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REMINDERS_VAULT = path.join(os.tmpdir(), 'medcore-care-reminders-v1.json');
let memReminders: ScheduledCareReminder[] | null = null;

function readRemindersVault(): ScheduledCareReminder[] {
  if (memReminders) return [...memReminders];
  try {
    if (fs.existsSync(REMINDERS_VAULT)) {
      const parsed = JSON.parse(fs.readFileSync(REMINDERS_VAULT, 'utf8'));
      if (Array.isArray(parsed)) {
        memReminders = parsed as ScheduledCareReminder[];
        return [...memReminders];
      }
    }
  } catch {
    // ignore
  }
  memReminders = generateDueCareReminders([
    {
      id: 'PAT-ANC-DEMO',
      facilityId: 'IGH-EKT',
      firstName: 'Idara',
      lastName: 'Ekpo',
      phone: '08035129044',
      shid: 'SHID-EKT-0041',
      preferredLanguage: 'pidgin',
      chronicConditions: ['Antenatal Pregnancy (28 wks)'],
    },
    {
      id: 'PAT-HTN-DEMO',
      facilityId: 'IGH-EKT',
      firstName: 'Nsikak',
      lastName: 'Udo',
      phone: '08064412239',
      shid: 'SHID-EKT-0192',
      preferredLanguage: 'english',
      chronicConditions: ['Hypertension'],
    },
  ]);
  return [...memReminders];
}

function writeRemindersVault(items: ScheduledCareReminder[]): void {
  memReminders = [...items];
  try {
    fs.writeFileSync(REMINDERS_VAULT, JSON.stringify(items), 'utf8');
  } catch {
    // ignore
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT').trim().toUpperCase();
  let list = readRemindersVault().filter((r) => !facilityId || r.facilityId === facilityId);

  if (isPostgresConfigured() && facilityId) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{ payload: ScheduledCareReminder }>(
          `SELECT payload FROM care_reminders WHERE facility_id = $1 ORDER BY due_date ASC, created_at DESC LIMIT 200`,
          [facilityId]
        );
        if (res.rows.length > 0) {
          list = res.rows.map((r) => r.payload);
        }
      });
    } catch {
      // keep vault fallback
    }
  }

  return NextResponse.json({
    ok: true,
    facilityId,
    reminders: list,
    dueCount: list.filter((r) => r.status === 'due').length,
    dispatchedCount: list.filter((r) => r.status === 'dispatched').length,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      facilityId?: string;
      reminderIds?: string[];
      patients?: Array<{
        id: string;
        facilityId: string;
        firstName: string;
        lastName: string;
        phone?: string;
        shid?: string;
        dob?: string;
        preferredLanguage?: string;
        chronicConditions?: string[];
      }>;
    };

    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    let list = readRemindersVault();

    if (Array.isArray(body.patients) && body.patients.length > 0) {
      const fresh = generateDueCareReminders(body.patients);
      const existingIds = new Set(list.map((r) => r.id));
      for (const item of fresh) {
        if (!existingIds.has(item.id)) list.unshift(item);
      }
    }

    const nowIso = new Date().toISOString();
    const targetIds = Array.isArray(body.reminderIds) && body.reminderIds.length > 0 ? new Set(body.reminderIds) : null;
    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    let dispatchedNow = 0;
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (item.facilityId !== facilityId) continue;
      if (targetIds && !targetIds.has(item.id)) continue;
      if (item.status !== 'due') continue;

      if (whatsappToken && whatsappPhoneId && item.phone) {
        try {
          await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(whatsappPhoneId)}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: item.phone.replace(/^0/, '234').replace(/\D/g, ''),
              type: 'text',
              text: { body: item.messageBody.slice(0, 4000) },
            }),
          });
        } catch {
          // continue batch safely
        }
      }

      list[i] = {
        ...item,
        status: 'dispatched',
        dispatchedAt: nowIso,
      };
      dispatchedNow += 1;
    }

    writeRemindersVault(list);

    if (isPostgresConfigured()) {
      try {
        await ensureSchema();
        await withTenantClient(facilityId, async (c) => {
          for (const rem of list.filter((r) => r.facilityId === facilityId)) {
            await c.query(
              `INSERT INTO care_reminders (
                 id, facility_id, patient_id, patient_name, phone, shid,
                 track, due_date, channel, language, message_body, status, dispatched_at, payload
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13::timestamptz,$14::jsonb)
               ON CONFLICT (facility_id, id) DO UPDATE SET
                 status = EXCLUDED.status,
                 dispatched_at = EXCLUDED.dispatched_at,
                 payload = EXCLUDED.payload`,
              [
                rem.id,
                facilityId,
                rem.patientId,
                rem.patientName,
                rem.phone,
                rem.shid || null,
                rem.track,
                rem.dueDate || null,
                rem.channel,
                rem.language,
                rem.messageBody,
                rem.status,
                rem.dispatchedAt || null,
                JSON.stringify(rem),
              ]
            );
          }
        });
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      ok: true,
      facilityId,
      dispatchedCount: dispatchedNow,
      deliveryMode: whatsappToken && whatsappPhoneId ? 'whatsapp_cloud_api' : 'care_portal_push',
      reminders: list.filter((r) => r.facilityId === facilityId),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to schedule/dispatch care reminders.' },
      { status: 500 }
    );
  }
}
