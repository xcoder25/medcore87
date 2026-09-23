import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';

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

export default router;
