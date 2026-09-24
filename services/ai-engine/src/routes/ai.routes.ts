import { Router, Request, Response } from 'express';
import { checkDrugInteractions } from '../cds/drugInteractionChecker';
import { getDifferentialDiagnosis } from '../cds/differentialDiagnosis';
import { searchICD11, getICD11ByCode } from '../cds/icd11Suggester';
import { formatSOAP } from '../scribe/soapFormatter';
import { calculateNEWS2, calculateQSOFA } from '../cds/newsProxy';

const router = Router();

/**
 * POST /api/ai/drug-interactions
 * Check a list of drug names for interactions
 */
router.post('/drug-interactions', (req: Request, res: Response) => {
  const { drugs } = req.body;
  if (!drugs || !Array.isArray(drugs)) {
    return res.status(400).json({ success: false, error: 'drugs[] array required' });
  }
  const result = checkDrugInteractions(drugs);
  res.json({ success: true, data: result });
});

/**
 * POST /api/ai/differential-diagnosis
 * Get ranked differential diagnoses from symptoms + vitals
 */
router.post('/differential-diagnosis', (req: Request, res: Response) => {
  const { symptoms, vitals, demographics, contextClues } = req.body;
  if (!symptoms || !Array.isArray(symptoms)) {
    return res.status(400).json({ success: false, error: 'symptoms[] array required' });
  }
  const results = getDifferentialDiagnosis({ symptoms, vitals, demographics, contextClues });
  res.json({
    success: true,
    count: results.length,
    topDiagnosis: results[0] || null,
    differentials: results,
  });
});

/**
 * GET /api/ai/icd11/search?q=malaria
 * Search ICD-11 codes by text
 */
router.get('/icd11/search', (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  if (q.length < 2) return res.status(400).json({ success: false, error: 'q must be at least 2 characters' });
  const results = searchICD11(q);
  res.json({ success: true, query: q, count: results.length, data: results });
});

/**
 * GET /api/ai/icd11/:code
 * Get ICD-11 entry by code
 */
router.get('/icd11/:code', (req: Request, res: Response) => {
  const entry = getICD11ByCode(String(req.params.code));
  if (!entry) return res.status(404).json({ success: false, error: 'ICD-11 code not found' });
  res.json({ success: true, data: entry });
});

/**
 * POST /api/ai/soap
 * Convert raw clinical text to structured SOAP note
 */
router.post('/soap', (req: Request, res: Response) => {
  const { text, patientContext } = req.body;
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'text required (min 10 chars)' });
  }

  // Append patient context if provided
  const fullText = patientContext ? `${patientContext}\n\n${text}` : text;
  const soap = formatSOAP(fullText);

  res.json({
    success: true,
    message: `SOAP note generated with ${soap.confidence}% confidence`,
    data: soap,
  });
});

/**
 * POST /api/ai/news2
 * Compute NEWS2 score from vitals
 */
router.post('/news2', (req: Request, res: Response) => {
  const { respiratoryRate, spO2, supplementalOxygen, systolicBP, heartRate, temperature, consciousness, isScale2 } = req.body;

  if (!respiratoryRate || !spO2 || !systolicBP || !heartRate || !temperature) {
    return res.status(400).json({ success: false, error: 'respiratoryRate, spO2, systolicBP, heartRate, temperature required' });
  }

  const news2 = calculateNEWS2({ respiratoryRate: Number(respiratoryRate), spO2: Number(spO2), supplementalOxygen: Boolean(supplementalOxygen), systolicBP: Number(systolicBP), heartRate: Number(heartRate), temperature: Number(temperature), consciousness: consciousness || 'A', isScale2: Boolean(isScale2) });
  const qsofa = calculateQSOFA({ respiratoryRate: Number(respiratoryRate), systolicBP: Number(systolicBP), consciousness: consciousness || 'A' });

  res.json({ success: true, data: { news2, qsofa } });
});

/**
 * GET /api/ai/health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'MedCore AI Clinical Decision Support Engine',
    version: '1.0.0',
    capabilities: ['drug-interactions', 'differential-diagnosis', 'icd11-search', 'soap-formatter', 'news2-calculator'],
    mode: 'OFFLINE — no external API required',
  });
});

export default router;
