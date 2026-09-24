/**
 * DHIS2 / NHMIS bridge — Nigeria national routine reporting spine
 * Aligns MedCore facility data with State/Federal HMIS (DHIS2).
 *
 * Env:
 *   DHIS2_BASE_URL   e.g. https://dhis2.aksgov.ng  or national instance
 *   DHIS2_USERNAME
 *   DHIS2_PASSWORD
 *   DHIS2_ORG_UNIT   facility org unit UID
 *   DHIS2_DATASET    dataset UID for NHMIS aggregate
 *
 * Without credentials, endpoints run in SIMULATED mode (safe for hospital pilot).
 */
import { Router, Request, Response } from 'express';
import { syncEventBus } from '../sync/eventBus';
import { auditLedger } from '../security/auditLedger';

const router = Router();

const config = () => ({
  baseUrl: process.env.DHIS2_BASE_URL || '',
  username: process.env.DHIS2_USERNAME || '',
  password: process.env.DHIS2_PASSWORD || '',
  orgUnit: process.env.DHIS2_ORG_UNIT || 'AKS-OU-DEMO',
  dataSet: process.env.DHIS2_DATASET || 'NHMIS-DS-DEMO',
  live: Boolean(process.env.DHIS2_BASE_URL && process.env.DHIS2_USERNAME),
});

/** NHMIS-style aggregate elements (demo mapping — replace with state metadata) */
const DEMO_DATA_ELEMENTS: Record<string, string> = {
  OPD_ATTENDANCE: 'DE_OPD_ATT',
  MALARIA_CONFIRMED: 'DE_MAL_CONF',
  ANC_VISIT: 'DE_ANC',
  DELIVERY_LIVE: 'DE_DEL_LIVE',
  LAB_TESTS: 'DE_LAB',
  ADMISSIONS: 'DE_ADM',
};

interface AggregatePayload {
  period: string; // YYYYMM or YYYYMMDD
  facilityId?: string;
  values: Record<string, number>;
}

const SYNC_LOG: Array<{
  id: string;
  mode: 'LIVE' | 'SIMULATED';
  period: string;
  status: string;
  at: string;
  response?: unknown;
}> = [];

/**
 * GET /api/v1/dhis2/status
 */
router.get('/status', (_req: Request, res: Response) => {
  const c = config();
  res.json({
    success: true,
    mode: c.live ? 'LIVE' : 'SIMULATED',
    orgUnit: c.orgUnit,
    dataSet: c.dataSet,
    baseUrlConfigured: Boolean(c.baseUrl),
    message: c.live
      ? 'DHIS2 credentials present — aggregate/tracker push will call remote instance'
      : 'No DHIS2_BASE_URL/USERNAME — runs simulated (pilot-safe). Set env for live NHMIS.',
    recentSyncs: SYNC_LOG.slice(0, 10),
  });
});

/**
 * POST /api/v1/dhis2/aggregate
 * Push period aggregate data values (NHMIS-compatible shape)
 */
router.post('/aggregate', async (req: Request, res: Response) => {
  const body = req.body as AggregatePayload;
  if (!body?.period || !body?.values) {
    return res.status(400).json({
      success: false,
      error: 'period (YYYYMM) and values{} are required',
    });
  }

  const c = config();
  const dataValues = Object.entries(body.values).map(([key, value]) => ({
    dataElement: DEMO_DATA_ELEMENTS[key] || key,
    period: body.period,
    orgUnit: c.orgUnit,
    value: String(value),
  }));

  const payload = {
    dataSet: c.dataSet,
    completeDate: new Date().toISOString().slice(0, 10),
    orgUnit: c.orgUnit,
    period: body.period,
    dataValues,
  };

  let remoteResult: unknown = null;
  let status = 'SIMULATED_OK';

  if (c.live) {
    try {
      const auth = Buffer.from(`${c.username}:${c.password}`).toString('base64');
      const response = await fetch(`${c.baseUrl.replace(/\/$/, '')}/api/dataValueSets`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      remoteResult = await response.json().catch(() => ({ status: response.status }));
      status = response.ok ? 'LIVE_OK' : 'LIVE_ERROR';
    } catch (err: any) {
      status = 'LIVE_ERROR';
      remoteResult = { error: err?.message || 'DHIS2 request failed' };
    }
  }

  const id = `DHIS2-AGG-${Date.now().toString(36).toUpperCase()}`;
  const entry = {
    id,
    mode: (c.live ? 'LIVE' : 'SIMULATED') as 'LIVE' | 'SIMULATED',
    period: body.period,
    status,
    at: new Date().toISOString(),
    response: remoteResult,
  };
  SYNC_LOG.unshift(entry);

  auditLedger.logEvent({
    actorId: 'DHIS2-BRIDGE',
    actorName: 'NHMIS Aggregate Sync',
    actorRole: 'SYSTEM_DAEMON',
    facilityId: body.facilityId || c.orgUnit,
    action: 'WRITE_PHI',
    resourceType: 'FACILITY',
    resourceId: c.orgUnit,
    reason: `DHIS2 aggregate push period ${body.period} (${status})`,
  });

  syncEventBus.broadcast({
    topic: 'DHIS2_SYNC_COMPLETE',
    facilityId: body.facilityId || c.orgUnit,
    emitterApp: 'API_SERVER',
    payload: { id, period: body.period, status, mode: entry.mode },
  });

  res.status(status.startsWith('LIVE_ERROR') ? 502 : 201).json({
    success: !status.startsWith('LIVE_ERROR'),
    message: c.live
      ? `DHIS2 aggregate ${status}`
      : 'Simulated NHMIS aggregate accepted (configure DHIS2_* env for live push)',
    data: { ...entry, payloadPreview: payload },
  });
});

/**
 * POST /api/v1/dhis2/tracker/event
 * Tracker program event (e.g. notifiable disease) — structure only until program UIDs configured
 */
router.post('/tracker/event', async (req: Request, res: Response) => {
  const { program, programStage, orgUnit, eventDate, dataValues, trackedEntity } = req.body || {};
  if (!program || !dataValues) {
    return res.status(400).json({ success: false, error: 'program and dataValues required' });
  }

  const c = config();
  const eventBody = {
    program,
    programStage: programStage || program,
    orgUnit: orgUnit || c.orgUnit,
    eventDate: eventDate || new Date().toISOString().slice(0, 10),
    status: 'COMPLETED',
    dataValues,
    trackedEntityInstance: trackedEntity,
  };

  let status = 'SIMULATED_OK';
  let remote: unknown = null;

  if (c.live) {
    try {
      const auth = Buffer.from(`${c.username}:${c.password}`).toString('base64');
      const response = await fetch(`${c.baseUrl.replace(/\/$/, '')}/api/tracker/events`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });
      remote = await response.json().catch(() => ({ status: response.status }));
      status = response.ok ? 'LIVE_OK' : 'LIVE_ERROR';
    } catch (err: any) {
      status = 'LIVE_ERROR';
      remote = { error: err?.message };
    }
  }

  res.status(status.startsWith('LIVE_ERROR') ? 502 : 201).json({
    success: !status.startsWith('LIVE_ERROR'),
    mode: c.live ? 'LIVE' : 'SIMULATED',
    status,
    data: { eventBody, remote },
  });
});

export default router;
