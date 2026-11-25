import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildHieReferralPacket,
  transitionHieReferral,
  type CreateHieReferralInput,
  type HieReferralAction,
  type HieReferralPacket,
} from '../../../../lib/hieReferralEngine';
import {
  ensureSchema,
  isPostgresConfigured,
  withTenantClient,
} from '../../../../lib/db/postgres';
import { publishFacilitySseEvent } from '../../../../lib/sseBroker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VAULT_FILE = path.join(os.tmpdir(), 'medcore-hie-referrals-v1.json');
const KV_KEY = 'medcore_hie_referrals_v1';
let memReferrals: HieReferralPacket[] | null = null;

function readReferralsVault(): HieReferralPacket[] {
  if (memReferrals) return [...memReferrals];
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memReferrals = parsed as HieReferralPacket[];
        return [...memReferrals];
      }
    }
  } catch {
    // ignore vault read error
  }
  memReferrals = [];
  return [];
}

function writeReferralsVault(items: HieReferralPacket[]): void {
  memReferrals = [...items];
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(items), 'utf8');
  } catch {
    // ignore read-only fs
  }
}

async function mirrorFacilityReferrals(facilityId: string, items: HieReferralPacket[]): Promise<void> {
  if (!isPostgresConfigured() || !facilityId) return;
  try {
    await ensureSchema();
    const scoped = items.filter(
      (r) => r.referringFacilityId === facilityId || r.targetFacilityId === facilityId
    );
    await withTenantClient(facilityId, async (c) => {
      await c.query(
        `INSERT INTO facility_kv (facility_id, key, value, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (facility_id, key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [facilityId, KV_KEY, JSON.stringify(scoped.slice(0, 200))]
      );
    });
  } catch {
    // fail soft to server vault
  }
}

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || '').trim().toUpperCase();
  const direction = (req.nextUrl.searchParams.get('direction') || 'all').trim().toLowerCase();

  let list = readReferralsVault();
  if (isPostgresConfigured() && facilityId && list.length === 0) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{ value: HieReferralPacket[] }>(
          `SELECT value FROM facility_kv WHERE facility_id = $1 AND key = $2`,
          [facilityId, KV_KEY]
        );
        if (Array.isArray(res.rows[0]?.value)) {
          list = res.rows[0].value;
          writeReferralsVault(list);
        }
      });
    } catch {
      // keep vault list
    }
  }

  const scoped = list.filter((r) => {
    if (!facilityId) return true;
    if (direction === 'inbound') return r.targetFacilityId === facilityId;
    if (direction === 'outbound') return r.referringFacilityId === facilityId;
    return r.referringFacilityId === facilityId || r.targetFacilityId === facilityId;
  });

  const pendingCount = scoped.filter((r) => r.status === 'pending_acceptance').length;
  const bedLockedCount = scoped.filter((r) => r.status === 'bed_locked' || r.status === 'in_transit').length;
  const closedLoopCount = scoped.filter((r) => r.status === 'arrived_admitted' || r.status === 'completed_discharged').length;

  return NextResponse.json({
    ok: true,
    facilityId: facilityId || 'ALL',
    referrals: scoped,
    metrics: {
      total: scoped.length,
      pendingCount,
      bedLockedCount,
      closedLoopCount,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateHieReferralInput>;
    if (!body.patientName || !body.hospitalNumber || !body.targetFacilityId) {
      return NextResponse.json(
        { ok: false, error: 'patientName, hospitalNumber, and targetFacilityId are required.' },
        { status: 400 }
      );
    }

    const packet = buildHieReferralPacket({
      referringFacilityId: String(body.referringFacilityId || 'IGH-EKT').toUpperCase(),
      referringFacilityName: String(body.referringFacilityName || 'Referring Health Facility'),
      targetFacilityId: String(body.targetFacilityId).toUpperCase(),
      targetFacilityName: String(body.targetFacilityName || body.targetFacilityId),
      specialty: String(body.specialty || 'Emergency / Obstetrics'),
      priority: body.priority || 'urgent',
      patientName: String(body.patientName),
      hospitalNumber: String(body.hospitalNumber),
      patientShid: body.patientShid,
      patientConsentToken: body.patientConsentToken,
      clinicalSummary: String(body.clinicalSummary || 'Acute specialist transfer with FHIR summary attached.'),
      vitalsSnapshot: body.vitalsSnapshot,
      allergies: body.allergies,
      medsGiven: body.medsGiven,
      requestBedLock: Boolean(body.requestBedLock),
      bedCategory: body.bedCategory,
      ward: body.ward,
    });

    const current = readReferralsVault();
    const next = [packet, ...current].slice(0, 300);
    writeReferralsVault(next);

    await Promise.all([
      mirrorFacilityReferrals(packet.referringFacilityId, next),
      mirrorFacilityReferrals(packet.targetFacilityId, next),
    ]);

    try {
      publishFacilitySseEvent({
        facilityId: packet.targetFacilityId,
        key: 'hie_referral',
        value: {
          referralId: packet.id,
          fromFacility: packet.referringFacilityName,
          specialty: packet.specialty,
          priority: packet.priority,
          bedLocked: Boolean(packet.bedReservation),
          bedLockId: packet.bedReservation?.bedLockId,
          createdAt: packet.createdAt,
        },
      });
    } catch {
      // non-fatal SSE notify
    }

    return NextResponse.json({ ok: true, referral: packet }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to create HIE referral packet.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      action?: HieReferralAction;
      actorName?: string;
      bedCategory?: NonNullable<CreateHieReferralInput['bedCategory']>;
      ward?: string;
      outcomeSummary?: string;
    };

    if (!body.id || !body.action) {
      return NextResponse.json({ ok: false, error: 'Referral id and action are required.' }, { status: 400 });
    }

    const list = readReferralsVault();
    const idx = list.findIndex((r) => r.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: `Referral ${body.id} not found.` }, { status: 404 });
    }

    const updated = transitionHieReferral(list[idx], body.action, {
      actorName: body.actorName,
      bedCategory: body.bedCategory,
      ward: body.ward,
      outcomeSummary: body.outcomeSummary,
    });

    list[idx] = updated;
    writeReferralsVault(list);

    await Promise.all([
      mirrorFacilityReferrals(updated.referringFacilityId, list),
      mirrorFacilityReferrals(updated.targetFacilityId, list),
    ]);

    try {
      publishFacilitySseEvent({
        facilityId: updated.referringFacilityId,
        key: 'hie_referral_update',
        value: {
          referralId: updated.id,
          status: updated.status,
          bedLockId: updated.bedReservation?.bedLockId,
          outcomeSummary: updated.receivingFeedback?.outcomeSummary,
        },
      });
    } catch {
      // ignore SSE error
    }

    return NextResponse.json({ ok: true, referral: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to update HIE referral.' },
      { status: 500 }
    );
  }
}
