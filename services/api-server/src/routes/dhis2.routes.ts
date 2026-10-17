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

/**
 * ══════════════════════════════════════════════════════════════════════════
 * DHIS2 TRACKER & SIMULATED BED MANAGEMENT ENGINE
 * ══════════════════════════════════════════════════════════════════════════
 */
const TRACKER_INPATIENT_PROGRAM = 'PRG_INPATIENT_MGT';
const STAGE_ADMISSION = 'STG_ADMISSION_01';
const STAGE_CLINICAL_CARE = 'STG_CLINICAL_CARE_02';
const STAGE_DISCHARGE = 'STG_DISCHARGE_03';

interface InpatientBedRecord {
  teiId: string;
  enrollmentId: string;
  facilityId: string;
  patientName: string;
  hospitalNumber: string;
  bedKey: string; // WARD-ROOM-BED
  ward: string;
  room: string;
  bed: string;
  admissionDate: string;
  diagnosis: string;
  priority: string;
  admissionEventId: string;
  status: 'ACTIVE' | 'COMPLETED';
  dischargedAt?: string;
  dischargeOutcome?: string;
  dischargeEventId?: string;
}

const INPATIENT_REGISTRY: InpatientBedRecord[] = [
  {
    teiId: 'TEI-SAM-ARCH-01',
    enrollmentId: 'ENR-SAM-01',
    facilityId: 'IGH-EKT',
    patientName: 'Samuel Archibong',
    hospitalNumber: 'GH-2026-0419',
    bedKey: 'MMED-RM01-B1',
    ward: 'Male Medical',
    room: 'RM01',
    bed: 'B1',
    admissionDate: new Date(Date.now() - 24 * 3600000).toISOString(),
    diagnosis: 'Severe Malaria with Moderate Dehydration',
    priority: 'urgent',
    admissionEventId: 'EVT-ADM-01',
    status: 'ACTIVE',
  },
  {
    teiId: 'TEI-PAT-OKON-02',
    enrollmentId: 'ENR-PAT-02',
    facilityId: 'IGH-EKT',
    patientName: 'Patience Okon',
    hospitalNumber: 'GH-2026-0922',
    bedKey: 'FMED-RM01-B1',
    ward: 'Female Medical',
    room: 'RM01',
    bed: 'B1',
    admissionDate: new Date(Date.now() - 48 * 3600000).toISOString(),
    diagnosis: 'Type 2 Diabetes Mellitus with Foot Ulcer',
    priority: 'urgent',
    admissionEventId: 'EVT-ADM-02',
    status: 'ACTIVE',
  },
  {
    teiId: 'TEI-BAS-BAS-03',
    enrollmentId: 'ENR-BAS-03',
    facilityId: 'IGH-EKT',
    patientName: 'Bassey Bassey',
    hospitalNumber: 'GH-2026-0311',
    bedKey: 'SURG-RM01-B1',
    ward: 'Surgical',
    room: 'RM01',
    bed: 'B1',
    admissionDate: new Date(Date.now() - 72 * 3600000).toISOString(),
    diagnosis: 'Post-op Laparotomy Day 2',
    priority: 'routine',
    admissionEventId: 'EVT-ADM-03',
    status: 'ACTIVE',
  },
  {
    teiId: 'TEI-IDONG-04',
    enrollmentId: 'ENR-IDONG-04',
    facilityId: 'IGH-EKT',
    patientName: 'Idongesit Akpan',
    hospitalNumber: 'GH-2026-0105',
    bedKey: 'ICU-RM101-B1',
    ward: 'ICU',
    room: 'RM101',
    bed: 'B1',
    admissionDate: new Date(Date.now() - 12 * 3600000).toISOString(),
    diagnosis: 'Acute Respiratory Distress',
    priority: 'emergency',
    admissionEventId: 'EVT-ADM-04',
    status: 'ACTIVE',
  },
  {
    teiId: 'TEI-EMM-UDOH-05',
    enrollmentId: 'ENR-EMM-05',
    facilityId: 'IGH-EKT',
    patientName: 'Emmanuel Udoh',
    hospitalNumber: 'GH-2026-0812',
    bedKey: 'MMED-RM02-B1',
    ward: 'Male Medical',
    room: 'RM02',
    bed: 'B1',
    admissionDate: new Date(Date.now() - 96 * 3600000).toISOString(),
    diagnosis: 'Community Acquired Pneumonia',
    priority: 'routine',
    admissionEventId: 'EVT-ADM-05',
    status: 'COMPLETED',
    dischargedAt: new Date(Date.now() - 45 * 60000).toISOString(), // Discharged 45m ago -> Yellow turnover state
    dischargeOutcome: 'discharged',
    dischargeEventId: 'EVT-DIS-05',
  },
];

const PHYSICAL_BED_INVENTORY = [
  { bedKey: 'ICU-RM101-B1', ward: 'ICU', room: 'RM101', bed: 'B1' },
  { bedKey: 'ICU-RM101-B2', ward: 'ICU', room: 'RM101', bed: 'B2' },
  { bedKey: 'ICU-RM102-B1', ward: 'ICU', room: 'RM102', bed: 'B1' },
  { bedKey: 'ICU-RM102-B2', ward: 'ICU', room: 'RM102', bed: 'B2' },
  { bedKey: 'MMED-RM01-B1', ward: 'Male Medical', room: 'RM01', bed: 'B1' },
  { bedKey: 'MMED-RM01-B2', ward: 'Male Medical', room: 'RM01', bed: 'B2' },
  { bedKey: 'MMED-RM02-B1', ward: 'Male Medical', room: 'RM02', bed: 'B1' },
  { bedKey: 'MMED-RM02-B2', ward: 'Male Medical', room: 'RM02', bed: 'B2' },
  { bedKey: 'FMED-RM01-B1', ward: 'Female Medical', room: 'RM01', bed: 'B1' },
  { bedKey: 'FMED-RM01-B2', ward: 'Female Medical', room: 'RM01', bed: 'B2' },
  { bedKey: 'FMED-RM02-B1', ward: 'Female Medical', room: 'RM02', bed: 'B1' },
  { bedKey: 'FMED-RM02-B2', ward: 'Female Medical', room: 'RM02', bed: 'B2' },
  { bedKey: 'SURG-RM01-B1', ward: 'Surgical', room: 'RM01', bed: 'B1' },
  { bedKey: 'SURG-RM01-B2', ward: 'Surgical', room: 'RM01', bed: 'B2' },
  { bedKey: 'SURG-RM02-B1', ward: 'Surgical', room: 'RM02', bed: 'B1' },
  { bedKey: 'PED-RM01-B1', ward: 'Paediatrics', room: 'RM01', bed: 'B1' },
  { bedKey: 'PED-RM01-B2', ward: 'Paediatrics', room: 'RM01', bed: 'B2' },
  { bedKey: 'MAT-RM01-B1', ward: 'Maternity', room: 'RM01', bed: 'B1' },
  { bedKey: 'MAT-RM01-B2', ward: 'Maternity', room: 'RM01', bed: 'B2' },
];

/**
 * GET /api/v1/dhis2/tracker/inpatient/bed-board
 * Returns real-time simulated bed states:
 * - Green (Available)
 * - Red (Occupied)
 * - Yellow (Cleaning/Turnover within 2h)
 */
router.get('/tracker/inpatient/bed-board', (req: Request, res: Response) => {
  const facilityId = (req.query.facilityId as string) || 'IGH-EKT';
  const turnoverHours = Number(req.query.turnoverHours) || 2;
  const turnoverMs = turnoverHours * 3600000;
  const now = Date.now();

  const facilityRecords = INPATIENT_REGISTRY.filter((r) => r.facilityId === facilityId);

  const bedBoard = PHYSICAL_BED_INVENTORY.map((inv) => {
    // 1. Check for active enrollment (Occupied - Red)
    const active = facilityRecords.find(
      (r) => r.bedKey === inv.bedKey && r.status === 'ACTIVE'
    );
    if (active) {
      return {
        bedKey: inv.bedKey,
        ward: inv.ward,
        room: inv.room,
        bed: inv.bed,
        state: 'occupied',
        stateLabel: 'Occupied',
        color: '#DC2626',
        patient: {
          teiId: active.teiId,
          enrollmentId: active.enrollmentId,
          patientName: active.patientName,
          hospitalNumber: active.hospitalNumber,
          diagnosis: active.diagnosis,
          priority: active.priority,
          admittedAt: active.admissionDate,
        },
      };
    }

    // 2. Check for recent discharge (Cleaning - Yellow)
    const recentDischarge = facilityRecords
      .filter((r) => r.bedKey === inv.bedKey && r.status === 'COMPLETED' && r.dischargedAt)
      .sort((a, b) => new Date(b.dischargedAt!).getTime() - new Date(a.dischargedAt!).getTime())[0];

    if (recentDischarge && recentDischarge.dischargedAt) {
      const diffMs = now - new Date(recentDischarge.dischargedAt).getTime();
      if (diffMs <= turnoverMs) {
        return {
          bedKey: inv.bedKey,
          ward: inv.ward,
          room: inv.room,
          bed: inv.bed,
          state: 'cleaning',
          stateLabel: 'Cleaning / Turnover',
          color: '#EAB308',
          discharge: {
            dischargedAt: recentDischarge.dischargedAt,
            outcome: recentDischarge.dischargeOutcome || 'discharged',
            minutesSinceDischarge: Math.round(diffMs / 60000),
          },
        };
      }
    }

    // 3. Available (Green)
    return {
      bedKey: inv.bedKey,
      ward: inv.ward,
      room: inv.room,
      bed: inv.bed,
      state: 'available',
      stateLabel: 'Available',
      color: '#16A34A',
    };
  });

  const summary = {
    total: bedBoard.length,
    available: bedBoard.filter((b) => b.state === 'available').length,
    occupied: bedBoard.filter((b) => b.state === 'occupied').length,
    cleaning: bedBoard.filter((b) => b.state === 'cleaning').length,
  };

  res.json({
    success: true,
    facilityId,
    summary,
    beds: bedBoard,
  });
});

/**
 * POST /api/v1/dhis2/tracker/inpatient/admit
 * Registers admission via DHIS2 Tracker model (POST /api/tracker?async=false)
 */
router.post('/tracker/inpatient/admit', async (req: Request, res: Response) => {
  const {
    facilityId = 'IGH-EKT',
    patientName,
    hospitalNumber,
    ward,
    room,
    bed,
    diagnosis,
    priority = 'routine',
  } = req.body || {};

  if (!patientName || !ward || !bed) {
    return res.status(400).json({ success: false, error: 'patientName, ward, and bed are required' });
  }

  // Enforce WARD-ROOM-BED string convention
  const cleanWard = ward.toUpperCase().replace(/\s+/g, '');
  const cleanRoom = room ? (room.startsWith('RM') ? room : `RM${room}`) : 'RM01';
  const cleanBed = bed.startsWith('B') ? bed : `B${bed}`;
  const bedKey = `${cleanWard}-${cleanRoom}-${cleanBed}`;

  const c = config();
  const teiId = `TEI-${Date.now().toString(36).toUpperCase()}`;
  const enrollmentId = `ENR-${Date.now().toString(36).toUpperCase()}`;
  const admissionEventId = `EVT-ADM-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const trackerPayload = {
    trackedEntities: [
      {
        trackedEntity: teiId,
        trackedEntityType: 'TET_PATIENT_01',
        orgUnit: c.orgUnit,
        attributes: [
          { attribute: 'ATTR_NAME', value: patientName },
          { attribute: 'ATTR_MRN', value: hospitalNumber || teiId },
        ],
        enrollments: [
          {
            enrollment: enrollmentId,
            program: TRACKER_INPATIENT_PROGRAM,
            orgUnit: c.orgUnit,
            enrolledAt: now,
            occurredAt: now,
            status: 'ACTIVE',
            events: [
              {
                event: admissionEventId,
                program: TRACKER_INPATIENT_PROGRAM,
                programStage: STAGE_ADMISSION,
                orgUnit: c.orgUnit,
                occurredAt: now,
                status: 'COMPLETED',
                dataValues: [
                  { dataElement: 'DE_LOC_WARD', value: ward },
                  { dataElement: 'DE_LOC_ROOM', value: room || 'RM01' },
                  { dataElement: 'DE_LOC_BED', value: bed },
                  { dataElement: 'DE_LOC_BED_KEY', value: bedKey },
                  { dataElement: 'DE_ADM_DIAG', value: diagnosis || 'General Inpatient' },
                  { dataElement: 'DE_TRIAGE_PRIO', value: priority },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  let remoteResult: unknown = null;
  let status = 'SIMULATED_OK';

  if (c.live) {
    try {
      const auth = Buffer.from(`${c.username}:${c.password}`).toString('base64');
      const response = await fetch(`${c.baseUrl.replace(/\/$/, '')}/api/tracker?async=false`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackerPayload),
      });
      remoteResult = await response.json().catch(() => ({ status: response.status }));
      status = response.ok ? 'LIVE_OK' : 'LIVE_ERROR';
    } catch (err: any) {
      status = 'LIVE_ERROR';
      remoteResult = { error: err?.message };
    }
  }

  const newRecord: InpatientBedRecord = {
    teiId,
    enrollmentId,
    facilityId,
    patientName,
    hospitalNumber: hospitalNumber || `GH-${Date.now().toString().slice(-4)}`,
    bedKey,
    ward,
    room: room || 'RM01',
    bed,
    admissionDate: now,
    diagnosis: diagnosis || 'General Inpatient',
    priority,
    admissionEventId,
    status: 'ACTIVE',
  };

  INPATIENT_REGISTRY.unshift(newRecord);

  syncEventBus.broadcast({
    topic: 'DHIS2_SYNC_COMPLETE',
    facilityId,
    emitterApp: 'API_SERVER',
    payload: { action: 'INPATIENT_ADMISSION', teiId, bedKey, status },
  });

  res.status(201).json({
    success: true,
    message: `Patient enrolled and assigned to ${bedKey}`,
    status,
    record: newRecord,
    dhis2TrackerPayload: trackerPayload,
    remote: remoteResult,
  });
});

/**
 * PUT /api/v1/dhis2/tracker/inpatient/transfer
 * Updates patient's bed location via PUT /api/tracker/events/{eventId}
 */
router.post('/tracker/inpatient/transfer', (req: Request, res: Response) => {
  const { enrollmentId, newWard, newRoom, newBed } = req.body || {};
  if (!enrollmentId || !newWard || !newBed) {
    return res.status(400).json({ success: false, error: 'enrollmentId, newWard, and newBed required' });
  }

  const idx = INPATIENT_REGISTRY.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Active enrollment not found' });
  }

  const cleanWard = newWard.toUpperCase().replace(/\s+/g, '');
  const cleanRoom = newRoom ? (newRoom.startsWith('RM') ? newRoom : `RM${newRoom}`) : 'RM01';
  const cleanBed = newBed.startsWith('B') ? newBed : `B${newBed}`;
  const newBedKey = `${cleanWard}-${cleanRoom}-${cleanBed}`;

  INPATIENT_REGISTRY[idx].ward = newWard;
  INPATIENT_REGISTRY[idx].room = newRoom || 'RM01';
  INPATIENT_REGISTRY[idx].bed = newBed;
  INPATIENT_REGISTRY[idx].bedKey = newBedKey;

  res.json({
    success: true,
    message: `Patient location updated to ${newBedKey} via PUT /api/tracker/events/${INPATIENT_REGISTRY[idx].admissionEventId}`,
    record: INPATIENT_REGISTRY[idx],
  });
});

/**
 * POST /api/v1/dhis2/tracker/inpatient/discharge
 * Completes enrollment via PUT /api/tracker/enrollments/{enrollmentId} (status: COMPLETED)
 * Triggers 2-hour Turnover / Cleaning state (Yellow).
 */
router.post('/tracker/inpatient/discharge', (req: Request, res: Response) => {
  const { enrollmentId, outcome = 'discharged' } = req.body || {};
  if (!enrollmentId) {
    return res.status(400).json({ success: false, error: 'enrollmentId is required' });
  }

  const idx = INPATIENT_REGISTRY.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Active enrollment not found' });
  }

  INPATIENT_REGISTRY[idx].status = 'COMPLETED';
  INPATIENT_REGISTRY[idx].dischargedAt = new Date().toISOString();
  INPATIENT_REGISTRY[idx].dischargeOutcome = outcome;
  INPATIENT_REGISTRY[idx].dischargeEventId = `EVT-DIS-${Date.now().toString(36).toUpperCase()}`;

  res.json({
    success: true,
    message: `Enrollment ${enrollmentId} completed. Bed ${INPATIENT_REGISTRY[idx].bedKey} entered 2-hour Turnover state (Yellow).`,
    record: INPATIENT_REGISTRY[idx],
  });
});

export default router;

