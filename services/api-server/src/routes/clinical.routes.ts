import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

/**
 * GET /api/v1/clinical/beds
 */
router.get('/beds', (req: Request, res: Response) => {
  const { facilityId } = req.query;
  const beds = dataStore.getBeds(facilityId as string);
  res.json({ success: true, total: beds.length, data: beds });
});

/**
 * POST /api/v1/clinical/beds/:id/status
 * Updates bed occupancy & triggers real-time broadcast to Hospital OS & Clinic app
 */
router.post('/beds/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, patientId, patientName } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: 'status is required' });
  }

  try {
    const updatedBed = dataStore.updateBedStatus(
      id as string,
      status,
      patientId ? { id: patientId, name: patientName || 'Inpatient' } : undefined
    );

    res.json({
      success: true,
      message: `Bed ${updatedBed.bedNumber} status updated to ${updatedBed.status}.`,
      data: updatedBed,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/clinical/orders
 */
router.get('/orders', (req: Request, res: Response) => {
  const { patientId } = req.query;
  const orders = dataStore.getOrders(patientId as string);
  res.json({ success: true, total: orders.length, data: orders });
});

/**
 * POST /api/v1/clinical/orders
 * Doctor orders laboratory tests, pharmacy prescriptions, or surgical procedures
 */
router.post('/orders', (req: Request, res: Response) => {
  const { patientId, encounterId, facilityId, orderedByDoctorId, orderedByDoctorName, type, title, details, priority, cost } =
    req.body;

  if (!patientId || !type || !title) {
    return res.status(400).json({ success: false, error: 'patientId, type, and title are required' });
  }

  const order = dataStore.createOrder({
    patientId,
    encounterId: encounterId || 'ENC-GENERAL',
    facilityId: facilityId || 'FAC-001',
    orderedByDoctorId: orderedByDoctorId || 'DOC-DEFAULT',
    orderedByDoctorName: orderedByDoctorName || 'Attending Physician',
    type,
    title,
    details: details || '',
    priority: priority || 'ROUTINE',
    status: 'PENDING',
    billed: false,
    cost: cost || 50.0,
  });

  res.status(201).json({
    success: true,
    message: `Clinical order #${order.id} submitted and synchronized across Clinic & OS.`,
    data: order,
  });
});


// ─── Prescription / Pharmacy Routes ───────────────────────────────────────────

/**
 * POST /api/v1/clinical/prescriptions
 * Doctor creates a new prescription for a patient
 */
router.post('/prescriptions', (req: Request, res: Response) => {
  const {
    patientId, patientName, doctorId, doctorName, facilityId,
    diagnosis, drugs, routedToPharmacyId, routedPharmacyId, routedToPharmacyName, routedPharmacyName, notes,
  } = req.body;
  const targetPharmacyId = routedToPharmacyId || routedPharmacyId;
  const targetPharmacyName = routedToPharmacyName || routedPharmacyName;

  if (!patientId || !drugs || !Array.isArray(drugs) || drugs.length === 0) {
    return res.status(400).json({ success: false, error: 'patientId and at least one drug are required' });
  }

  try {
    const rx = dataStore.createPrescription({
      patientId,
      patientName: patientName || 'Unknown Patient',
      doctorId: doctorId || 'DOC-DEFAULT',
      doctorName: doctorName || 'Attending Physician',
      facilityId: facilityId || 'FAC-001',
      diagnosis: diagnosis || 'Not specified',
      drugs,
      routedToPharmacyId: targetPharmacyId,
      routedToPharmacyName: targetPharmacyName,
      notes,
    });

    res.status(201).json({
      success: true,
      message: `Prescription ${rx.id} created successfully. ${targetPharmacyName ? `Routed to ${targetPharmacyName}.` : 'Patient may present to any pharmacy.'}`,
      data: rx,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/clinical/prescriptions/patient/:patientId
 * Pharmacy scans patient ID — returns all prescriptions
 */
router.get('/prescriptions/patient/:patientId', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const statusQ = req.query.status;
  const statusFilter = typeof statusQ === 'string' ? statusQ.toUpperCase() : undefined;

  let rxList = dataStore.getPrescriptionsByPatient(patientId);
  if (statusFilter) {
    rxList = rxList.filter((rx) => (rx.status as string) === statusFilter);
  }

  res.json({
    success: true,
    patientId,
    total: rxList.length,
    data: rxList,
  });
});

/**
 * GET /api/v1/clinical/prescriptions
 * Get all prescriptions — optionally filter by pharmacyId for routed queue
 */
router.get('/prescriptions', (req: Request, res: Response) => {
  const pharmacyIdQ = req.query.pharmacyId;
  const pharmacyId = typeof pharmacyIdQ === 'string' ? pharmacyIdQ : undefined;
  const rxList = dataStore.getAllPrescriptions(pharmacyId);
  res.json({ success: true, total: rxList.length, data: rxList });
});

/**
 * GET /api/v1/clinical/prescriptions/:rxId
 * Get single prescription by Rx ID
 */
router.get('/prescriptions/:rxId', (req: Request, res: Response) => {
  const rx = dataStore.getPrescriptionById(req.params.rxId as string);
  if (!rx) return res.status(404).json({ success: false, error: 'Prescription not found' });
  res.json({ success: true, data: rx });
});

/**
 * PATCH /api/v1/clinical/prescriptions/:rxId/dispense
 * Pharmacist dispenses a specific drug from a prescription
 */
router.patch('/prescriptions/:rxId/dispense', (req: Request, res: Response) => {
  const { rxId } = req.params;
  const { drugId, dispensedBy } = req.body;

  if (!drugId) {
    return res.status(400).json({ success: false, error: 'drugId is required' });
  }

  try {
    const updatedRx = dataStore.dispenseDrug(rxId as string, drugId as string, (dispensedBy as string) || 'Pharmacist');
    res.json({
      success: true,
      message: `Drug dispensed successfully. Prescription status: ${updatedRx.status}`,
      data: updatedRx,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/v1/clinical/prescriptions/:rxId/route
 * Doctor routes a prescription to a specific pharmacy
 */
router.patch('/prescriptions/:rxId/route', (req: Request, res: Response) => {
  const { rxId } = req.params;
  const { pharmacyId, pharmacyName } = req.body;

  if (!pharmacyId || !pharmacyName) {
    return res.status(400).json({ success: false, error: 'pharmacyId and pharmacyName are required' });
  }

  try {
    const rx = dataStore.routePrescription(rxId as string, pharmacyId as string, pharmacyName as string);
    res.json({
      success: true,
      message: `Prescription ${rxId} routed to ${pharmacyName}. Patient has been notified.`,
      data: rx,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Phase Safety & Deterioration Extensions ────────────────────────────────

/**
 * POST /api/v1/clinical/safety-check
 * Evaluates proposed CPOE medication and lab orders against patient allergies,
 * active prescriptions, and renal function.
 */
router.post('/safety-check', (req: Request, res: Response) => {
  const { patientId, allergies = [], currentMedications = [], newOrders = [], recentLabs } = req.body;

  const alerts: any[] = [];
  const normalizedAllergies = (allergies as string[]).map(a => a.toLowerCase().trim());
  const existingMeds = (currentMedications as string[]).map(m => m.toLowerCase().trim());

  // 1. Allergy Checking
  for (const order of newOrders) {
    const med = (order.name || '').toLowerCase();
    if (normalizedAllergies.some(a => a.includes('penicillin') || a.includes('amox'))) {
      if (['amoxicillin', 'ampicillin', 'augmentin', 'co-amoxiclav', 'penicillin', 'piperacillin', 'cloxacillin'].some(p => med.includes(p))) {
        alerts.push({
          id: `CDS-ALG-PEN-${Date.now()}`,
          type: 'DRUG_ALLERGY',
          severity: 'HARD_STOP',
          title: 'Fatal Anaphylaxis Risk: Penicillin Allergy Conflict',
          message: `Patient has documented allergy to Penicillin. "${order.name}" is a Beta-Lactam Penicillin derivative.`,
          triggerItem: order.name,
          clinicalEvidence: 'Severe IgE-mediated anaphylactic shock or Stevens-Johnson syndrome reported with Beta-lactam re-exposure.',
          recommendedAction: 'Switch to Azithromycin, Ciprofloxacin, or Vancomycin.',
          requiresOverrideReason: true,
        });
      }
    }

    if (normalizedAllergies.some(a => a.includes('sulfa') || a.includes('septrin'))) {
      if (['cotrimoxazole', 'septrin', 'bactrim', 'sulfamethoxazole', 'fansidar'].some(s => med.includes(s))) {
        alerts.push({
          id: `CDS-ALG-SULFA-${Date.now()}`,
          type: 'DRUG_ALLERGY',
          severity: 'HARD_STOP',
          title: 'Allergy Conflict: Sulfonamide Hypersensitivity',
          message: `Patient has documented Sulfa allergy. "${order.name}" contains sulfonamides.`,
          triggerItem: order.name,
          recommendedAction: 'Choose non-sulfonamide antimicrobial.',
          requiresOverrideReason: true,
        });
      }
    }
  }

  // 2. Drug-Drug Interaction
  const allMeds = [...existingMeds, ...newOrders.map((o: any) => (o.name || '').toLowerCase())];
  const hasAce = allMeds.some(m => ['lisinopril', 'ramipril', 'enalapril', 'captopril'].some(d => m.includes(d)));
  const hasArb = allMeds.some(m => ['losartan', 'valsartan', 'telmisartan', 'candesartan'].some(d => m.includes(d)));
  if (hasAce && hasArb) {
    alerts.push({
      id: `CDS-DDI-ACE-ARB-${Date.now()}`,
      type: 'DRUG_DRUG_INTERACTION',
      severity: 'HARD_STOP',
      title: 'Dual RAS Blockade (ACE-Inhibitor + ARB)',
      message: 'Co-prescribing ACE-Inhibitor with ARB produces excessive hyperkalemia and renal failure without added benefit.',
      triggerItem: 'Dual RAS Regimen',
      recommendedAction: 'Discontinue one agent immediately. Add CCB or thiazide instead.',
      requiresOverrideReason: true,
    });
  }

  // 3. Renal checks
  if (recentLabs?.eGfr && recentLabs.eGfr < 30) {
    for (const order of newOrders) {
      if ((order.name || '').toLowerCase().includes('metformin')) {
        alerts.push({
          id: `CDS-RENAL-METFORMIN-${Date.now()}`,
          type: 'RENAL_ADJUSTMENT',
          severity: 'HARD_STOP',
          title: 'Metformin Lactic Acidosis Risk in Renal Failure',
          message: `Patient eGFR is ${recentLabs.eGfr} mL/min (< 30). Metformin is strictly contraindicated.`,
          triggerItem: order.name,
          recommendedAction: 'Discontinue Metformin. Switch to subcutaneous Insulin sliding scale.',
          requiresOverrideReason: true,
        });
      }
    }
  }

  const hasHardStop = alerts.some(a => a.severity === 'HARD_STOP');
  const hasCriticalWarning = alerts.some(a => a.severity === 'CRITICAL_WARNING');

  res.json({
    success: true,
    patientId,
    hasHardStop,
    hasCriticalWarning,
    alerts,
    checkedAt: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/clinical/break-glass
 * Emergency Override Protocol: grants instant access to patient chart & unblocks care-first bypass
 */
router.post('/break-glass', (req: Request, res: Response) => {
  const { patientId, facilityId = 'FAC-001', clinicianBadge, reasonCategory, justificationNote, bypassBilling = true } = req.body;

  if (!clinicianBadge || !justificationNote) {
    return res.status(400).json({ success: false, error: 'clinicianBadge and justificationNote are required' });
  }

  const eventId = `BG-${Date.now()}`;

  // Log to cryptographic audit ledger
  auditLedger.logEvent({
    actorId: clinicianBadge,
    actorName: `Clinician (${clinicianBadge})`,
    actorRole: 'DOCTOR',
    facilityId,
    action: 'EMERGENCY_OVERRIDE',
    resourceType: 'PATIENT',
    resourceId: patientId || 'UNKNOWN_TRAUMA',
    reason: `[BREAK-GLASS ${reasonCategory}]: ${justificationNote}`,
  });

  // Broadcast to realtime event bus
  syncEventBus.broadcast({
    topic: 'BREAK_GLASS_TRIGGERED',
    facilityId,
    emitterApp: 'MEDCORE_CLINICAL_CORE',
    payload: {
      eventId,
      patientId,
      facilityId,
      clinicianBadge,
      reasonCategory,
      justificationNote,
      bypassBilling,
      timestamp: new Date().toISOString(),
    },
  });

  res.json({
    success: true,
    eventId,
    accessGranted: true,
    careFirstUnlocked: bypassBilling,
    message: 'Emergency Break-Glass authorized. Full access unlocked and audit trail established.',
  });
});

/**
 * POST /api/v1/clinical/news2
 * Evaluates vital signs, computes NEWS2 score, and triggers medical emergency escalation
 */
router.post('/news2', (req: Request, res: Response) => {
  const {
    patientId,
    patientName,
    facilityId = 'FAC-001',
    respirationRate,
    spO2Percent,
    onSupplementalOxygen = false,
    spO2Scale = 1,
    systolicBp,
    pulseRate,
    consciousness = 'ALERT',
    temperatureCelsius,
    recordedByBadge = 'RN-DUTY',
  } = req.body;

  // Respiration Rate score
  let respScore = 0;
  if (respirationRate <= 8) respScore = 3;
  else if (respirationRate <= 11) respScore = 1;
  else if (respirationRate <= 20) respScore = 0;
  else if (respirationRate <= 24) respScore = 2;
  else respScore = 3;

  // SpO2 Score
  let spo2Score = 0;
  if (spO2Percent <= 91) spo2Score = 3;
  else if (spO2Percent <= 93) spo2Score = 2;
  else if (spO2Percent <= 95) spo2Score = 1;
  else spo2Score = 0;

  // Supplemental O2
  const airOrOxygenScore = onSupplementalOxygen ? 2 : 0;

  // Systolic BP
  let sbpScore = 0;
  if (systolicBp <= 90) sbpScore = 3;
  else if (systolicBp <= 100) sbpScore = 2;
  else if (systolicBp <= 110) sbpScore = 1;
  else if (systolicBp <= 219) sbpScore = 0;
  else sbpScore = 3;

  // Pulse
  let pulseScore = 0;
  if (pulseRate <= 40) pulseScore = 3;
  else if (pulseRate <= 50) pulseScore = 1;
  else if (pulseRate <= 90) pulseScore = 0;
  else if (pulseRate <= 110) pulseScore = 1;
  else if (pulseRate <= 130) pulseScore = 2;
  else pulseScore = 3;

  // Consciousness
  const consciousnessScore = consciousness === 'ALERT' ? 0 : 3;

  // Temperature
  let tempScore = 0;
  if (temperatureCelsius <= 35.0) tempScore = 3;
  else if (temperatureCelsius <= 36.0) tempScore = 1;
  else if (temperatureCelsius <= 38.0) tempScore = 0;
  else if (temperatureCelsius <= 39.0) tempScore = 1;
  else tempScore = 2;

  const totalScore = respScore + spo2Score + airOrOxygenScore + sbpScore + pulseScore + consciousnessScore + tempScore;
  const isEmergency = totalScore >= 7;

  if (isEmergency) {
    syncEventBus.broadcast({
      topic: 'RAPID_RESPONSE_ESCALATION',
      facilityId,
      emitterApp: 'MEDCORE_CLINICAL_CORE',
      payload: {
        patientId,
        patientName,
        totalScore,
        priority: 'CRITICAL',
        message: `EMERGENCY ALERT: Patient ${patientName || patientId} has reached NEWS2 Score of ${totalScore}. Rapid Response Call Activated.`,
      },
    });
  }

  res.json({
    success: true,
    patientId,
    totalScore,
    riskCategory: isEmergency ? 'HIGH' : totalScore >= 5 ? 'MEDIUM' : 'LOW',
    escalationRequired: isEmergency || totalScore >= 5,
    recommendedAction: isEmergency
      ? 'EMERGENCY: Immediate Medical Emergency Team / ICU Rapid Response call.'
      : totalScore >= 5
      ? 'URGENT: Bedside Medical Officer review within 30 minutes.'
      : 'Routine ward nurse observations.',
  });
});

export default router;
