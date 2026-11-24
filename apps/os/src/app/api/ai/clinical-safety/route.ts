import { NextRequest, NextResponse } from 'next/server';
import {
  evaluatePrescriptionSafetyGuard,
  evaluateVitalDeterioration,
  type PrescriptionSafetyInput,
  type VitalPatientContext,
  type VitalSnapshotInput,
} from '../../../../lib/clinicalSafetyEngine';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';
import { publishFacilitySseEvent } from '../../../../lib/sseBroker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseBpString(bp?: string | null): { bpSystolic?: number; bpDiastolic?: number } {
  const m = String(bp || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return {};
  return {
    bpSystolic: Number(m[1]),
    bpDiastolic: Number(m[2]),
  };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body.action || '').trim();
  const facilityId = String(body.facilityId || req.headers.get('x-facility-id') || 'IGH-EKT')
    .trim()
    .toUpperCase();

  if (action === 'evaluate_vitals') {
    const vitals = (body.vitals || {}) as VitalSnapshotInput;
    const patientId = String(body.patientId || '').trim();
    const patientName = String(body.patientName || 'Patient').trim();
    const hospitalNumber = String(body.hospitalNumber || patientId || '').trim();
    const clientPrior = Array.isArray(body.priorVitals) ? (body.priorVitals as VitalSnapshotInput[]) : [];
    const patientContext = (body.patientContext || {}) as VitalPatientContext;

    const mergedPrior: VitalSnapshotInput[] = [...clientPrior];
    let mergedCtx: VitalPatientContext = { ...patientContext };

    if (patientId && isPostgresConfigured()) {
      try {
        await ensureSchema();
        await withTenantClient(facilityId, async (c) => {
          const priorRows = await c.query<{
            bp: string | null;
            pulse: number | null;
            temp: number | null;
            spo2: number | null;
            recorded_at: Date | null;
            payload: Record<string, unknown> | null;
          }>(
            `SELECT bp, pulse, temp, spo2, recorded_at, payload
             FROM vital_signs
             WHERE facility_id = $1 AND patient_id = $2
             ORDER BY recorded_at DESC
             LIMIT 5`,
            [facilityId, patientId]
          );
          for (const row of priorRows.rows) {
            const parsedBp = parseBpString(row.bp);
            const p = (row.payload || {}) as Record<string, unknown>;
            mergedPrior.push({
              bpSystolic: typeof p.bpSystolic === 'number' ? p.bpSystolic : parsedBp.bpSystolic,
              bpDiastolic: typeof p.bpDiastolic === 'number' ? p.bpDiastolic : parsedBp.bpDiastolic,
              pulse: typeof row.pulse === 'number' ? row.pulse : undefined,
              tempC: row.temp !== null && row.temp !== undefined ? Number(row.temp) : undefined,
              spo2: typeof row.spo2 === 'number' ? row.spo2 : undefined,
              respRate: typeof p.respRate === 'number' ? p.respRate : undefined,
              avpu: typeof p.avpu === 'string' ? (p.avpu as VitalSnapshotInput['avpu']) : undefined,
              recordedAt: row.recorded_at ? new Date(row.recorded_at).toISOString() : undefined,
            });
          }

          if (!mergedCtx.dob || !mergedCtx.sex || !mergedCtx.chronicConditions?.length) {
            const ptRes = await c.query<{
              sex: string | null;
              date_of_birth: string | null;
              meta: Record<string, unknown> | null;
            }>(
              `SELECT sex, date_of_birth::text AS date_of_birth, meta
               FROM patients
               WHERE facility_id = $1 AND id = $2
               LIMIT 1`,
              [facilityId, patientId]
            );
            const pt = ptRes.rows[0];
            if (pt) {
              const meta = (pt.meta || {}) as Record<string, unknown>;
              mergedCtx = {
                ...mergedCtx,
                sex: mergedCtx.sex || pt.sex || undefined,
                dob: mergedCtx.dob || pt.date_of_birth || undefined,
                chronicConditions:
                  mergedCtx.chronicConditions?.length
                    ? mergedCtx.chronicConditions
                    : Array.isArray(meta.chronicConditions)
                      ? (meta.chronicConditions as string[])
                      : undefined,
              };
            }
          }
        });
      } catch (err) {
        console.warn('[api/ai/clinical-safety evaluate_vitals] DB lookup skipped:', (err as Error).message);
      }
    }

    const assessment = evaluateVitalDeterioration(vitals, mergedPrior, mergedCtx);
    const shouldEscalate =
      assessment.urgency === 'critical' ||
      assessment.news2.total >= 7 ||
      assessment.qsofa.sepsisScreenPositive;

    if (shouldEscalate) {
      const lead = assessment.alerts[0] || `NEWS2 ${assessment.news2.total} critical deterioration`;
      const notifId = `NTF-CS-${Date.now().toString(36).toUpperCase()}`;
      const title = `CRITICAL Deterioration · ${patientName}`;
      const notifBody = `${hospitalNumber ? `${hospitalNumber} — ` : ''}NEWS2 ${assessment.news2.total}, qSOFA ${assessment.qsofa.score}/3 · ${lead}`;

      if (isPostgresConfigured()) {
        try {
          await ensureSchema();
          await withTenantClient(facilityId, async (c) => {
            await c.query(
              `INSERT INTO notifications (id, facility_id, level, title, body, role_hint, read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
               ON CONFLICT (id) DO NOTHING`,
              [notifId, facilityId, 'critical', title, notifBody, 'doctor']
            );
          });
        } catch (err) {
          console.warn('[api/ai/clinical-safety] Notification persist skipped:', (err as Error).message);
        }
      }

      try {
        publishFacilitySseEvent({
          facilityId,
          key: 'clinical_safety_escalation',
          value: {
            notificationId: notifId,
            patientId: patientId || undefined,
            hospitalNumber: hospitalNumber || undefined,
            patientName,
            urgency: assessment.urgency,
            news2: assessment.news2.total,
            qsofa: assessment.qsofa.score,
            shockIndex: assessment.shockIndex,
            bundleKey: assessment.recommendedBundleKey,
            leadAlert: lead,
          },
          actor: 'Clinical Safety Engine',
        });
      } catch {
        /* ignore SSE error */
      }
    }

    return NextResponse.json({
      ok: true,
      facilityId,
      escalated: shouldEscalate,
      assessment,
    });
  }

  if (action === 'audit_prescription') {
    const rxInput = (body.prescription || body) as PrescriptionSafetyInput & { patientId?: string };
    const patientId = String(rxInput.patientId || body.patientId || '').trim();
    const enriched: PrescriptionSafetyInput = {
      ...rxInput,
      drugName: String(rxInput.drugName || '').trim(),
    };

    if (!enriched.drugName) {
      return NextResponse.json({ ok: false, error: 'drugName is required' }, { status: 400 });
    }

    if (patientId && isPostgresConfigured()) {
      try {
        await ensureSchema();
        await withTenantClient(facilityId, async (c) => {
          const ptRes = await c.query<{
            sex: string | null;
            date_of_birth: string | null;
            meta: Record<string, unknown> | null;
          }>(
            `SELECT sex, date_of_birth::text AS date_of_birth, meta
             FROM patients
             WHERE facility_id = $1 AND id = $2
             LIMIT 1`,
            [facilityId, patientId]
          );
          const pt = ptRes.rows[0];
          if (pt) {
            const meta = (pt.meta || {}) as Record<string, unknown>;
            enriched.sex = enriched.sex || pt.sex || undefined;
            enriched.dob = enriched.dob || pt.date_of_birth || undefined;
            if (!enriched.allergies?.length && Array.isArray(meta.allergies)) {
              enriched.allergies = meta.allergies as string[];
            }
            if (!enriched.chronicConditions?.length && Array.isArray(meta.chronicConditions)) {
              enriched.chronicConditions = meta.chronicConditions as string[];
            }
            if (!enriched.otherDrugs?.length && Array.isArray(meta.currentMedications)) {
              enriched.otherDrugs = meta.currentMedications as string[];
            }
            if (!enriched.genotype && typeof meta.genotype === 'string') {
              enriched.genotype = meta.genotype;
            }
          }
        });
      } catch (err) {
        console.warn('[api/ai/clinical-safety audit_prescription] DB lookup skipped:', (err as Error).message);
      }
    }

    const report = evaluatePrescriptionSafetyGuard(enriched);
    return NextResponse.json({
      ok: true,
      facilityId,
      report,
    });
  }

  return NextResponse.json(
    { ok: false, error: 'Unsupported action. Expected evaluate_vitals or audit_prescription.' },
    { status: 400 }
  );
}
