import { Router, Request, Response } from 'express';
import { vitalsEngine } from '../realtime/vitalsEngine';

const router = Router();

/**
 * POST /api/v1/vitals
 * Record patient vitals — auto-computes NEWS2, qSOFA and broadcasts alerts
 */
router.post('/', (req: Request, res: Response) => {
  const {
    patientId, patientName, facilityId, wardId, bedId, recordedBy,
    temperature, systolicBP, diastolicBP, heartRate,
    respiratoryRate, spO2, supplementalOxygen, consciousness,
    painScore, bloodGlucose, weight, height,
  } = req.body;

  if (!patientId || !temperature || !systolicBP || !heartRate || !respiratoryRate || !spO2) {
    return res.status(400).json({
      success: false,
      error: 'Required: patientId, temperature, systolicBP, heartRate, respiratoryRate, spO2',
    });
  }

  try {
    const record = vitalsEngine.processVitals({
      patientId,
      patientName: patientName || 'Unknown Patient',
      facilityId:  facilityId  || 'FAC-001',
      wardId,
      bedId,
      recordedBy:  recordedBy  || 'Nurse',
      temperature:        Number(temperature),
      systolicBP:         Number(systolicBP),
      diastolicBP:        Number(diastolicBP) || Number(systolicBP) - 20,
      heartRate:          Number(heartRate),
      respiratoryRate:    Number(respiratoryRate),
      spO2:               Number(spO2),
      supplementalOxygen: Boolean(supplementalOxygen),
      consciousness:      (consciousness as 'A'|'C'|'V'|'P'|'U') || 'A',
      painScore:          Number(painScore) || 0,
      bloodGlucose:       bloodGlucose ? Number(bloodGlucose) : undefined,
      weight:             weight ? Number(weight) : undefined,
      height:             height ? Number(height) : undefined,
    });

    const responseMsg = record.sepsisRisk
      ? `🚨 SEPSIS ALERT: qSOFA ${record.qsofaScore} — bundle initiated`
      : record.news2Score! >= 5
      ? `🔴 NEWS2 ${record.news2Score} — ${record.news2Risk} risk. Escalation broadcast sent.`
      : `✅ Vitals recorded. NEWS2 score: ${record.news2Score} (${record.news2Risk})`;

    res.status(201).json({
      success: true,
      message: responseMsg,
      data: record,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/vitals/:patientId
 * Get vitals history for a patient
 */
router.get('/:patientId', (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  const history = vitalsEngine.getPatientVitalsHistory(patientId);
  const latest  = vitalsEngine.getLatestVitals(patientId);

  res.json({
    success: true,
    patientId,
    totalReadings: history.length,
    latest: latest || null,
    history: history.slice().reverse(), // Most recent first
  });
});

/**
 * GET /api/v1/vitals/:patientId/latest
 * Get most recent vitals + NEWS2 score
 */
router.get('/:patientId/latest', (req: Request, res: Response) => {
  const latest = vitalsEngine.getLatestVitals(String(req.params.patientId));
  if (!latest) return res.status(404).json({ success: false, error: 'No vitals recorded for this patient' });
  res.json({ success: true, data: latest });
});

export default router;
