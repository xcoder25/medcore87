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
    actorId,
    actorName,
  } = req.body;

  if (!name || !dob || !gender || !nationalId || !phone) {
    return res.status(400).json({
      success: false,
      error: 'name, dob, gender, nationalId, and phone are mandatory fields',
    });
  }

  const patient = dataStore.registerPatient({
    name,
    dob,
    gender,
    nationalId,
    phone,
    address: address || 'Not Provided',
    facilityId: facilityId || 'FAC-001',
    bloodGroup: bloodGroup || 'Unknown',
    allergies: allergies || [],
    chronicConditions: chronicConditions || [],
    insurancePolicyId,
    insuranceProvider,
    actorId: actorId || 'STAFF-REG-01',
    actorName: actorName || 'Reception Registrar',
  });

  res.status(201).json({
    success: true,
    message: `Patient ${patient.name} successfully registered. PII encrypted with AES-256-GCM.`,
    data: patient,
  });
});

export default router;
