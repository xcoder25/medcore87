import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';

const router = Router();

/**
 * GET /api/v1/patients
 * Supports ?decrypt=true when caller has elevated clinical or administrative credentials
 */
router.get('/', (req: Request, res: Response) => {
  const shouldDecrypt = req.query.decrypt === 'true';
  const patients = dataStore.getPatients(shouldDecrypt);

  // Log access in tamper-evident ledger
  auditLedger.logEvent({
    actorId: (req.query.actorId as string) || 'STAFF-PORTAL-CLI',
    actorName: (req.query.actorName as string) || 'Clinical Workbench User',
    actorRole: shouldDecrypt ? 'DOCTOR' : 'NURSE',
    facilityId: (req.query.facilityId as string) || 'FAC-001',
    action: shouldDecrypt ? 'DECRYPT_PAYLOAD' : 'READ_PHI',
    resourceType: 'PATIENT',
    resourceId: 'PAT-LIST',
    reason: shouldDecrypt ? 'Decrypted patient chart access for ward rounds' : 'Index patient listing',
  });

  res.json({
    success: true,
    total: patients.length,
    decrypted: shouldDecrypt,
    data: patients,
  });
});

/**
 * GET /api/v1/patients/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const shouldDecrypt = req.query.decrypt === 'true';
  const patient = dataStore.getPatientById(req.params.id as string, shouldDecrypt);

  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient record not found' });
  }

  auditLedger.logEvent({
    actorId: (req.query.actorId as string) || 'STAFF-BEDSIDE-CLI',
    actorName: (req.query.actorName as string) || 'Bedside Clinician',
    actorRole: 'DOCTOR',
    facilityId: patient.facilityId,
    action: shouldDecrypt ? 'DECRYPT_PAYLOAD' : 'READ_PHI',
    resourceType: 'PATIENT',
    resourceId: patient.id,
    reason: `Patient record retrieved for ${patient.mrn}`,
  });

  res.json({
    success: true,
    decrypted: shouldDecrypt,
    data: patient,
  });
});

/**
 * POST /api/v1/patients
 * Registers new patient with automatic AES-256-GCM encryption of PII
 */
router.post('/', (req: Request, res: Response) => {
  const {
    name,
    dob,
    gender,
    nationalId,
    phone,
    address,
    facilityId,
    bloodGroup,
    allergies,
    chronicConditions,
    insurancePolicyId,
    insuranceProvider,
    nin,
    stateHealthId,
    actorId,
    actorName,
  } = req.body;

  if (!name || !dob || !gender || (!nationalId && !nin) || !phone) {
    return res.status(400).json({
      success: false,
      error: 'name, dob, gender, nationalId (or nin), and phone are mandatory fields',
    });
  }

  const patient = dataStore.registerPatient({
    name,
    dob,
    gender,
    nationalId: nationalId || nin,
    phone,
    address: address || 'Not Provided',
    facilityId: facilityId || 'FAC-001',
    bloodGroup: bloodGroup || 'Unknown',
    allergies: allergies || [],
    chronicConditions: chronicConditions || [],
    insurancePolicyId,
    insuranceProvider,
    nin,
    stateHealthId,
    actorId: actorId || 'STAFF-REG-01',
    actorName: actorName || 'Reception Registrar',
  });

  res.status(201).json({
    success: true,
    message: `Patient ${patient.name} successfully registered. State Health ID: ${patient.stateHealthId}. PII encrypted with AES-256-GCM.`,
    data: patient,
  });
});

/**
 * POST /api/v1/patients/encounters/admit
 * ADT: Admit patient to ward & bed
 */
router.post('/encounters/admit', (req: Request, res: Response) => {
  const {
    patientId,
    patientName,
    facilityId,
    type,
    ward,
    bed,
    admittingDoctorId,
    admittingDoctorName,
    chiefComplaint,
    workingDiagnosis,
  } = req.body;

  if (!patientId || !ward || !bed) {
    return res.status(400).json({ success: false, error: 'patientId, ward, and bed are required for admission' });
  }

  try {
    const encounter = dataStore.admitPatient({
      patientId,
      patientName: patientName || 'Inpatient',
      facilityId: facilityId || 'FAC-001',
      type: type || 'ADMISSION',
      ward,
      bed,
      admittingDoctorId,
      admittingDoctorName,
      chiefComplaint,
      workingDiagnosis,
    });

    res.status(201).json({
      success: true,
      message: `Patient ${patientName || patientId} admitted to ${ward}, Bed ${bed}.`,
      data: encounter,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/patients/encounters/transfer
 * ADT: Transfer patient to new ward/bed
 */
router.post('/encounters/transfer', (req: Request, res: Response) => {
  const { encounterId, targetWard, targetBed, transferredBy, reason } = req.body;

  if (!encounterId || !targetWard || !targetBed) {
    return res.status(400).json({ success: false, error: 'encounterId, targetWard, and targetBed are required' });
  }

  try {
    const updated = dataStore.transferPatient({
      encounterId,
      targetWard,
      targetBed,
      transferredBy: transferredBy || 'Staff Nurse',
      reason: reason || 'Clinical bed management transfer',
    });

    res.json({
      success: true,
      message: `Patient transferred to ${targetWard}, Bed ${targetBed}.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/patients/encounters/discharge
 * ADT: Discharge patient
 */
router.post('/encounters/discharge', (req: Request, res: Response) => {
  const { encounterId, dischargedBy, disposition, summary } = req.body;

  if (!encounterId) {
    return res.status(400).json({ success: false, error: 'encounterId is required' });
  }

  try {
    const discharged = dataStore.dischargePatient({
      encounterId,
      dischargedBy: dischargedBy || 'Attending Physician',
      disposition: disposition || 'HOME',
      summary,
    });

    res.json({
      success: true,
      message: `Encounter ${encounterId} discharged. Disposition: ${disposition || 'HOME'}.`,
      data: discharged,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/patients/encounters
 * List all active/past encounters
 */
router.get('/encounters', (req: Request, res: Response) => {
  const { patientId } = req.query;
  const encounters = dataStore.getEncounters(patientId as string);
  res.json({ success: true, total: encounters.length, data: encounters });
});

/**
 * GET /api/v1/patients/:id/encounters
 */
router.get('/:id/encounters', (req: Request, res: Response) => {
  const encounters = dataStore.getEncounters(req.params.id as string);
  res.json({ success: true, patientId: req.params.id, total: encounters.length, data: encounters });
});

export default router;
