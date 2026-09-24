import { Router, Request, Response } from 'express';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

// In-memory lab results store
interface LabResult {
  id: string;
  orderId: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  testName: string;
  referringDoctorId: string;
  referringDoctorName: string;
  results: Array<{ parameter: string; value: string; unit: string; referenceRange: string; flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL' }>;
  interpretation?: string;
  verifiedBy: string;
  verifiedAt: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'RELEASED';
  createdAt: string;
}

const labResults: Map<string, LabResult> = new Map();

/**
 * POST /api/v1/lab/results
 * Lab technician records and verifies a result — broadcasts LAB_RESULT_READY to referring doctor
 */
router.post('/results', (req: Request, res: Response) => {
  const {
    orderId, patientId, patientName, facilityId, testName,
    referringDoctorId, referringDoctorName, results, interpretation, verifiedBy,
  } = req.body;

  if (!patientId || !testName || !results || !Array.isArray(results)) {
    return res.status(400).json({ success: false, error: 'patientId, testName, and results[] are required' });
  }

  const hasCriticalValue = results.some((r: any) => r.flag === 'CRITICAL');
  const id = `RES-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)}`;

  const result: LabResult = {
    id,
    orderId: orderId || 'ORD-MANUAL',
    patientId,
    patientName: patientName || 'Unknown',
    facilityId:  facilityId  || 'FAC-001',
    testName,
    referringDoctorId:   referringDoctorId   || 'DOC-DEFAULT',
    referringDoctorName: referringDoctorName || 'Attending Physician',
    results,
    interpretation,
    verifiedBy: verifiedBy || 'Lab Technician',
    verifiedAt: new Date().toISOString(),
    status: 'RELEASED',
    createdAt: new Date().toISOString(),
  };

  labResults.set(id, result);

  // Broadcast to referring doctor + OS
  syncEventBus.broadcast({
    topic: 'LAB_RESULT_READY',
    facilityId,
    emitterApp: 'API_SERVER',
    payload: {
      resultId: id,
      orderId: result.orderId,
      patientId,
      patientName: result.patientName,
      testName,
      referringDoctorId: result.referringDoctorId,
      hasCriticalValue,
      criticalParams: results.filter((r: any) => r.flag === 'CRITICAL').map((r: any) => r.parameter),
      verifiedBy: result.verifiedBy,
      timestamp: result.verifiedAt,
    },
  });

  res.status(201).json({
    success: true,
    message: hasCriticalValue
      ? `🚨 Critical lab value — ${referringDoctorName || 'doctor'} notified immediately`
      : `✅ Lab result verified and sent to ${referringDoctorName || 'referring doctor'}`,
    data: result,
  });
});

/**
 * POST /api/v1/lab/radiology-report
 * Radiologist signs off imaging report — broadcasts RADIOLOGY_REPORT_READY
 */
router.post('/radiology-report', (req: Request, res: Response) => {
  const { patientId, patientName, facilityId, modality, bodyPart, impression, radiologistName, referringDoctorId } = req.body;

  if (!patientId || !impression) {
    return res.status(400).json({ success: false, error: 'patientId and impression are required' });
  }

  const reportId = `RAD-${Date.now().toString(36).toUpperCase()}`;

  syncEventBus.broadcast({
    topic: 'RADIOLOGY_REPORT_READY',
    facilityId: facilityId || 'FAC-001',
    emitterApp: 'API_SERVER',
    payload: {
      reportId,
      patientId,
      patientName: patientName || 'Unknown',
      modality: modality || 'X-RAY',
      bodyPart: bodyPart || 'Chest',
      impression,
      radiologistName: radiologistName || 'Radiologist',
      referringDoctorId,
      signedAt: new Date().toISOString(),
    },
  });

  res.status(201).json({
    success: true,
    message: `Radiology report signed and sent to referring doctor`,
    data: { reportId, patientId, modality, impression },
  });
});

/**
 * GET /api/v1/lab/results/patient/:patientId
 */
router.get('/results/patient/:patientId', (req: Request, res: Response) => {
  const results = Array.from(labResults.values()).filter(r => r.patientId === req.params.patientId);
  res.json({ success: true, total: results.length, data: results });
});

/**
 * GET /api/v1/lab/results/:id
 */
router.get('/results/:id', (req: Request, res: Response) => {
  const result = labResults.get(String(req.params.id));
  if (!result) return res.status(404).json({ success: false, error: 'Result not found' });
  res.json({ success: true, data: result });
});

export default router;
