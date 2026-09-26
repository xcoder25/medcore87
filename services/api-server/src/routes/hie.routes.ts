/**
 * Phase 3 — Health Information Exchange / Shared Health Record (NDHA-aligned)
 * Consent-gated longitudinal access by State Health ID across facilities.
 */
import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

/** In-memory consent store (production: durable NDPR consent registry) */
const consentStore = new Map<string, {
  stateHealthId: string;
  grantedToFacilityId: string;
  purpose: string;
  grantedBy: string;
  expiresAt: string;
  createdAt: string;
}>();

function hasValidConsent(stateHealthId: string, facilityId: string): boolean {
  const key = `${stateHealthId.toUpperCase()}::${facilityId}`;
  const c = consentStore.get(key);
  if (!c) return false;
  return new Date(c.expiresAt).getTime() > Date.now();
}

/**
 * GET /api/v1/hie/mpi/search?q=&facilityId=
 */
router.get('/mpi/search', (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  const facilityId = req.query.facilityId ? String(req.query.facilityId) : undefined;
  const results = dataStore.searchMpi(q, facilityId, true);
  auditLedger.logEvent({
    actorId: String(req.query.actorId || 'HIE-CLIENT'),
    actorName: String(req.query.actorName || 'MPI Search'),
    actorRole: 'CLINICIAN',
    facilityId: facilityId || 'STATE',
    action: 'READ_PHI',
    resourceType: 'MPI',
    resourceId: 'SEARCH',
    reason: `MPI search: ${q.slice(0, 40)}`,
  });
  res.json({ success: true, total: results.length, data: results });
});

/**
 * GET /api/v1/hie/mpi/state-health-id/:hid
 */
router.get('/mpi/state-health-id/:hid', (req: Request, res: Response) => {
  const hid = String(req.params.hid);
  const matches = dataStore.findByStateHealthId(hid, true);
  res.json({
    success: true,
    stateHealthId: hid,
    total: matches.length,
    data: matches,
    portable: matches.length > 0,
  });
});

/**
 * GET /api/v1/hie/mpi/nin/:nin
 */
router.get('/mpi/nin/:nin', (req: Request, res: Response) => {
  const matches = dataStore.findByNin(String(req.params.nin), true);
  res.json({ success: true, total: matches.length, data: matches });
});

/**
 * POST /api/v1/hie/consent
 * Body: { stateHealthId, facilityId, purpose, grantedBy, hoursValid? }
 */
router.post('/consent', (req: Request, res: Response) => {
  const { stateHealthId, facilityId, purpose, grantedBy, hoursValid } = req.body || {};
  if (!stateHealthId || !facilityId || !grantedBy) {
    return res.status(400).json({ success: false, error: 'stateHealthId, facilityId, grantedBy required' });
  }
  const hours = Number(hoursValid) || 24;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const key = `${String(stateHealthId).toUpperCase()}::${facilityId}`;
  consentStore.set(key, {
    stateHealthId: String(stateHealthId).toUpperCase(),
    grantedToFacilityId: facilityId,
    purpose: purpose || 'TREATMENT',
    grantedBy,
    expiresAt,
    createdAt,
  });
  auditLedger.logEvent({
    actorId: grantedBy,
    actorName: grantedBy,
    actorRole: 'PATIENT_OR_PROXY',
    facilityId,
    action: 'CONSENT_GRANT',
    resourceType: 'SHR',
    resourceId: stateHealthId,
    reason: purpose || 'TREATMENT',
  });
  res.status(201).json({ success: true, key, expiresAt, purpose: purpose || 'TREATMENT' });
});

/**
 * GET /api/v1/hie/shr/:stateHealthId
 * Shared Health Record (longitudinal). Requires consent unless same facility or query bypass for pilot.
 */
router.get('/shr/:stateHealthId', (req: Request, res: Response) => {
  const hid = String(req.params.stateHealthId);
  const facilityId = String(req.query.facilityId || '');
  const pilotBypass = req.query.pilot === 'true';

  if (!pilotBypass && facilityId && !hasValidConsent(hid, facilityId)) {
    return res.status(403).json({
      success: false,
      error: 'Consent required to access Shared Health Record from this facility',
      code: 'CONSENT_REQUIRED',
      hint: 'POST /api/v1/hie/consent then retry',
    });
  }

  const record = dataStore.getLongitudinalRecord(hid);
  if (!record) {
    return res.status(404).json({ success: false, error: 'No Shared Health Record for this State Health ID' });
  }

  auditLedger.logEvent({
    actorId: String(req.query.actorId || 'HIE-SHR'),
    actorName: String(req.query.actorName || 'SHR Access'),
    actorRole: 'CLINICIAN',
    facilityId: facilityId || 'STATE',
    action: 'READ_PHI',
    resourceType: 'SHR',
    resourceId: hid,
    reason: 'Longitudinal shared health record retrieve',
  });

  syncEventBus.publish('HIE_SHR_ACCESSED', {
    stateHealthId: hid,
    facilityId,
    at: new Date().toISOString(),
  });

  res.json({ success: true, data: record });
});

/**
 * GET /api/v1/hie/shr/:stateHealthId/fhir
 * FHIR R4 Bundle (document) for NDHA exchange
 */
router.get('/shr/:stateHealthId/fhir', (req: Request, res: Response) => {
  const hid = String(req.params.stateHealthId);
  const facilityId = String(req.query.facilityId || '');
  const pilotBypass = req.query.pilot === 'true';
  if (!pilotBypass && facilityId && !hasValidConsent(hid, facilityId)) {
    return res.status(403).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'forbidden', diagnostics: 'Consent required for SHR FHIR export' }],
    });
  }

  const record = dataStore.getLongitudinalRecord(hid);
  if (!record) {
    return res.status(404).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', diagnostics: `No SHR for ${hid}` }],
    });
  }

  const p = record.profile as any;
  const bundle = {
    resourceType: 'Bundle',
    type: 'document',
    id: `shr-${hid}`,
    meta: {
      profile: ['https://fhir.ndha.gov.ng/StructureDefinition/ng-shared-health-record'],
      lastUpdated: new Date().toISOString(),
      tag: [
        { system: 'https://ndha.gov.ng/CodeSystem/jurisdiction', code: 'NG-AK', display: 'Akwa Ibom' },
        { system: 'https://ndha.gov.ng/CodeSystem/artifact', code: 'SHR', display: 'Shared Health Record' },
      ],
    },
    timestamp: new Date().toISOString(),
    identifier: {
      system: 'https://medcore.ng/state-health-id',
      value: hid,
    },
    entry: [
      {
        fullUrl: `urn:uuid:patient-${p.id}`,
        resource: {
          resourceType: 'Patient',
          id: p.id,
          meta: { profile: ['https://fhir.ndha.gov.ng/StructureDefinition/ng-patient'] },
          identifier: [
            { system: 'https://medcore.ng/mrn', value: p.mrn },
            { system: 'https://medcore.ng/state-health-id', value: hid },
            p.nin ? { system: 'https://nimc.gov.ng/nin', value: p.nin } : null,
          ].filter(Boolean),
          name: [{ use: 'official', text: p.name }],
          gender: (p.gender || 'unknown').toLowerCase(),
          birthDate: p.dob,
          extension: [
            { url: 'https://fhir.ndha.gov.ng/StructureDefinition/facility-id', valueString: p.facilityId },
          ],
        },
      },
      ...record.identities.map((id: any, i: number) => ({
        fullUrl: `urn:uuid:identity-${i}`,
        resource: {
          resourceType: 'Basic',
          id: `facility-reg-${i}`,
          code: { coding: [{ code: 'facility-registration', display: 'Facility registration identity' }] },
          subject: { reference: `Patient/${p.id}` },
          extension: [
            { url: 'facilityId', valueString: id.facilityId },
            { url: 'mrn', valueString: id.mrn },
            { url: 'patientId', valueString: id.patientId },
          ],
        },
      })),
      ...record.encounters.map((enc: any) => ({
        fullUrl: `urn:uuid:enc-${enc.id}`,
        resource: {
          resourceType: 'Encounter',
          id: enc.id,
          meta: { profile: ['https://fhir.ndha.gov.ng/StructureDefinition/ng-encounter'] },
          status: (enc.status || 'finished').toLowerCase(),
          class: { code: enc.type || 'AMB', display: enc.type },
          subject: { reference: `Patient/${enc.patientId}` },
          period: { start: enc.admittedAt || enc.createdAt, end: enc.dischargedAt },
          serviceProvider: { display: enc.facilityId },
        },
      })),
    ],
  };

  res.setHeader('Content-Type', 'application/fhir+json');
  res.json(bundle);
});

/**
 * POST /api/v1/hie/shr/ingest
 * Accept FHIR Bundle / local SHR JSON from peer facility (pilot HIE node)
 */
router.post('/shr/ingest', (req: Request, res: Response) => {
  const body = req.body || {};
  const sourceFacility = body.sourceFacilityId || req.query.facilityId || 'PEER';
  auditLedger.logEvent({
    actorId: String(body.actorId || 'HIE-NODE'),
    actorName: 'HIE Ingest',
    actorRole: 'SYSTEM',
    facilityId: String(sourceFacility),
    action: 'WRITE',
    resourceType: 'SHR',
    resourceId: body.stateHealthId || body.id || 'BUNDLE',
    reason: 'Peer facility SHR ingest',
  });
  syncEventBus.publish('HIE_SHR_INGESTED', {
    sourceFacility,
    resourceType: body.resourceType || 'Bundle',
    at: new Date().toISOString(),
  });
  res.status(202).json({
    success: true,
    message: 'SHR payload accepted for reconciliation (pilot HIE node)',
    receivedResourceType: body.resourceType || typeof body,
  });
});

/**
 * GET /api/v1/hie/status — node readiness for NDHA multi-HIE
 */
router.get('/status', (_req: Request, res: Response) => {
  const census = dataStore.getStatewideCensus();
  res.json({
    success: true,
    node: 'MedCore-State-HIE-Pilot',
    jurisdiction: 'NG-AK',
    standards: ['FHIR-R4', 'NDHA-SHR', 'NDPR-Consent'],
    capabilities: ['MPI', 'SHR', 'FHIR-Document-Bundle', 'Consent', 'Ingest'],
    census,
    consentsActive: consentStore.size,
  });
});

export default router;
