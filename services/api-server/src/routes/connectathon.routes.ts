/**
 * Phase 4 — DHIN-style Connectathon tracks (Nigeria FHIR community alignment)
 * Immunization · MNCH referral · ePharmacy · Insurance/Claims · Device telemetry stubs
 */
import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

const immunizations: any[] = [];
const mnchReferrals: any[] = [];
const deviceEvents: any[] = [];

router.get('/tracks', (_req, res) => {
  res.json({
    success: true,
    connectathon: 'MedCore × DHIN-aligned tracks',
    tracks: [
      { id: 'immunization', status: 'active', fhir: ['Immunization', 'Patient'] },
      { id: 'mnch-referral', status: 'active', fhir: ['ServiceRequest', 'Encounter'] },
      { id: 'epharmacy', status: 'active', fhir: ['MedicationRequest', 'MedicationDispense'] },
      { id: 'insurance-claims', status: 'active', fhir: ['Claim', 'Coverage'] },
      { id: 'medical-devices', status: 'active', fhir: ['DeviceMetric', 'Observation'] },
    ],
  });
});

/** POST Immunization event */
router.post('/immunization', (req: Request, res: Response) => {
  const { patientId, vaccineCode, vaccineDisplay, doseNumber, facilityId, performer } = req.body || {};
  if (!patientId || !vaccineCode) {
    return res.status(400).json({ success: false, error: 'patientId and vaccineCode required' });
  }
  const patient = dataStore.getPatientById(patientId, true);
  const entry = {
    id: `IMM-${Date.now()}`,
    patientId,
    patientName: (patient as any)?.name,
    stateHealthId: (patient as any)?.stateHealthId,
    vaccineCode,
    vaccineDisplay: vaccineDisplay || vaccineCode,
    doseNumber: doseNumber || 1,
    facilityId: facilityId || (patient as any)?.facilityId,
    performer: performer || 'Nurse',
    occurrenceDateTime: new Date().toISOString(),
    resourceType: 'Immunization',
    status: 'completed',
  };
  immunizations.push(entry);
  syncEventBus.publish('IMMUNIZATION_RECORDED', entry);
  res.status(201).json({
    success: true,
    data: entry,
    fhir: {
      resourceType: 'Immunization',
      status: 'completed',
      vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: vaccineCode, display: entry.vaccineDisplay }] },
      patient: { reference: `Patient/${patientId}` },
      occurrenceDateTime: entry.occurrenceDateTime,
      protocolApplied: [{ doseNumberPositiveInt: entry.doseNumber }],
    },
  });
});

router.get('/immunization', (_req, res) => {
  res.json({ success: true, total: immunizations.length, data: immunizations });
});

/** POST MNCH referral */
router.post('/mnch-referral', (req: Request, res: Response) => {
  const { patientId, reason, fromFacilityId, toFacilityId, urgency, notes } = req.body || {};
  if (!patientId || !toFacilityId) {
    return res.status(400).json({ success: false, error: 'patientId and toFacilityId required' });
  }
  const patient = dataStore.getPatientById(patientId, true);
  const ref = {
    id: `MNCH-${Date.now()}`,
    patientId,
    patientName: (patient as any)?.name,
    stateHealthId: (patient as any)?.stateHealthId,
    reason: reason || 'ANC escalation',
    fromFacilityId: fromFacilityId || (patient as any)?.facilityId,
    toFacilityId,
    urgency: urgency || 'ROUTINE',
    notes,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  mnchReferrals.push(ref);
  syncEventBus.publish('MNCH_REFERRAL_CREATED', ref);
  res.status(201).json({
    success: true,
    data: ref,
    fhir: {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      category: [{ coding: [{ code: 'mnch-referral', display: 'MNCH Referral' }] }],
      subject: { reference: `Patient/${patientId}` },
      reasonCode: [{ text: ref.reason }],
      performer: [{ display: toFacilityId }],
    },
  });
});

router.get('/mnch-referral', (_req, res) => {
  res.json({ success: true, total: mnchReferrals.length, data: mnchReferrals });
});

/** Device telemetry (monitor / ventilator sample) */
router.post('/devices/telemetry', (req: Request, res: Response) => {
  const { deviceId, patientId, metric, value, unit, facilityId } = req.body || {};
  if (!deviceId || metric == null) {
    return res.status(400).json({ success: false, error: 'deviceId and metric required' });
  }
  const evt = {
    id: `DEV-${Date.now()}`,
    deviceId,
    patientId,
    metric,
    value,
    unit: unit || '',
    facilityId,
    at: new Date().toISOString(),
  };
  deviceEvents.push(evt);
  if (deviceEvents.length > 500) deviceEvents.shift();
  syncEventBus.publish('DEVICE_TELEMETRY', evt);
  res.status(201).json({ success: true, data: evt });
});

router.get('/devices/telemetry', (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt(String(req.query.limit || '50'), 10));
  res.json({ success: true, data: deviceEvents.slice(-limit).reverse() });
});

/** Claims track pointer — delegates conceptually to HCX */
router.get('/insurance-claims/info', (_req, res) => {
  res.json({
    success: true,
    message: 'Use /api/v1/hcx/eclaim for FHIR Claim packaging and /api/v1/hmo for eligibility',
    endpoints: ['/api/v1/hcx', '/api/v1/hmo', '/api/v1/fhir/Claim'],
  });
});

export default router;
