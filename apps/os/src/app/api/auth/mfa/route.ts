import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';
import { signMfaToken } from '../../../../lib/serverSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ServerBiometricRecord {
  badgeId: string;
  facilityId: string;
  staffName: string;
  descriptor: number[];
  enrolledAt: string;
  version: number;
}

const VAULT_FILE = path.join(os.tmpdir(), 'medcore-staff-biometrics-vault.json');

function readVault(): Record<string, ServerBiometricRecord> {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')) as Record<string, ServerBiometricRecord>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeVault(map: Record<string, ServerBiometricRecord>): void {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(map), 'utf8');
  } catch {
    /* ignore read-only fs */
  }
}

function vaultKey(facilityId: string, badgeId: string): string {
  return `${facilityId.trim().toUpperCase()}::${badgeId.trim().toUpperCase()}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-8) return 0;
  return Math.max(0, Math.min(1, dot / denom));
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

export async function GET(req: NextRequest) {
  const facilityId = (req.nextUrl.searchParams.get('facilityId') || 'IGH-EKT').trim().toUpperCase();
  const badgeId = (req.nextUrl.searchParams.get('badgeId') || '').trim().toUpperCase();
  if (!badgeId) {
    return NextResponse.json({ ok: false, error: 'badgeId required' }, { status: 400 });
  }

  let record: ServerBiometricRecord | null = readVault()[vaultKey(facilityId, badgeId)] || null;

  if (isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{
          badge_id: string;
          staff_name: string;
          descriptor: number[];
          enrolled_at: Date;
          version: number;
        }>(
          `SELECT badge_id, staff_name, descriptor, enrolled_at, version
           FROM staff_biometrics
           WHERE facility_id = $1 AND badge_id = $2`,
          [facilityId, badgeId]
        );
        if (res.rows[0]) {
          const row = res.rows[0];
          record = {
            badgeId: row.badge_id,
            facilityId,
            staffName: row.staff_name || '',
            descriptor: Array.isArray(row.descriptor) ? row.descriptor : [],
            enrolledAt: row.enrolled_at ? new Date(row.enrolled_at).toISOString() : new Date().toISOString(),
            version: Number(row.version || 1),
          };
        }
      });
    } catch {
      /* fallback to server vault */
    }
  }

  return NextResponse.json({
    ok: true,
    enrolled: Boolean(record && record.descriptor.length > 0),
    template: record,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'enroll' | 'verify_face' | 'verify_code' | 'reset';
      facilityId?: string;
      badgeId?: string;
      staffName?: string;
      descriptor?: number[];
      code?: string;
      thresholdPercent?: number;
    };

    const action = body.action || 'verify_face';
    const facilityId = String(body.facilityId || 'IGH-EKT').trim().toUpperCase();
    const badgeId = String(body.badgeId || '').trim().toUpperCase();
    if (!badgeId) {
      return NextResponse.json({ ok: false, error: 'badgeId required' }, { status: 400 });
    }

    if (action === 'reset') {
      const v = readVault();
      delete v[vaultKey(facilityId, badgeId)];
      writeVault(v);
      if (isPostgresConfigured()) {
        try {
          await ensureSchema();
          await withTenantClient(facilityId, async (c) => {
            await c.query(`DELETE FROM staff_biometrics WHERE facility_id = $1 AND badge_id = $2`, [
              facilityId,
              badgeId,
            ]);
          });
        } catch {
          /* ignore */
        }
      }
      return NextResponse.json({ ok: true, reset: true });
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

    const descriptor = Array.isArray(body.descriptor) ? body.descriptor.map(Number) : [];
    if (descriptor.length < 16) {
      return NextResponse.json({ ok: false, error: 'Valid facial descriptor required' }, { status: 400 });
    }

    if (action === 'enroll') {
      const rec: ServerBiometricRecord = {
        badgeId,
        facilityId,
        staffName: String(body.staffName || 'Staff').trim(),
        descriptor,
        enrolledAt: new Date().toISOString(),
        version: 1,
      };
      const v = readVault();
      v[vaultKey(facilityId, badgeId)] = rec;
      writeVault(v);

      if (isPostgresConfigured()) {
        try {
          await ensureSchema();
          await withTenantClient(facilityId, async (c) => {
            await c.query(
              `INSERT INTO facilities (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
              [facilityId]
            );
            await c.query(
              `INSERT INTO staff_biometrics (badge_id, facility_id, staff_name, descriptor, version, enrolled_at, updated_at)
               VALUES ($1, $2, $3, $4::jsonb, 1, NOW(), NOW())
               ON CONFLICT (facility_id, badge_id) DO UPDATE SET
                 staff_name = EXCLUDED.staff_name,
                 descriptor = EXCLUDED.descriptor,
                 updated_at = NOW()`,
              [badgeId, facilityId, rec.staffName, JSON.stringify(descriptor)]
            );
          });
        } catch {
          /* ignore */
        }
      }

      const mfaToken = await signMfaToken(badgeId, facilityId, 'face');
      return NextResponse.json({ ok: true, enrolled: true, verified: true, mfaToken });
    }

    // verify_face
    let stored: ServerBiometricRecord | null = readVault()[vaultKey(facilityId, badgeId)] || null;
    if (isPostgresConfigured()) {
      try {
        await ensureSchema();
        await withTenantClient(facilityId, async (c) => {
          const res = await c.query<{ descriptor: number[]; staff_name: string; enrolled_at: Date }>(
            `SELECT descriptor, staff_name, enrolled_at FROM staff_biometrics WHERE facility_id = $1 AND badge_id = $2`,
            [facilityId, badgeId]
          );
          if (res.rows[0]) {
            stored = {
              badgeId,
              facilityId,
              staffName: res.rows[0].staff_name || '',
              descriptor: Array.isArray(res.rows[0].descriptor) ? res.rows[0].descriptor : [],
              enrolledAt: res.rows[0].enrolled_at
                ? new Date(res.rows[0].enrolled_at).toISOString()
                : new Date().toISOString(),
              version: 1,
            };
          }
        });
      } catch {
        /* ignore */
      }
    }

    if (!stored || !stored.descriptor.length) {
      return NextResponse.json({ ok: false, verified: false, error: 'NO_ENROLLED_TEMPLATE' }, { status: 404 });
    }

    const threshold = Math.max(0.55, Math.min(0.95, (Number(body.thresholdPercent) || 80) / 100));
    const similarity = cosineSimilarity(descriptor, stored.descriptor);
    const verified = similarity >= threshold;

    if (!verified) {
      return NextResponse.json(
        { ok: false, verified: false, similarityPercent: Math.round(similarity * 100), error: 'FACE_MISMATCH' },
        { status: 401 }
      );
    }

    const mfaToken = await signMfaToken(badgeId, facilityId, 'face');
    return NextResponse.json({
      ok: true,
      verified: true,
      similarityPercent: Math.round(similarity * 100),
      mfaToken,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
