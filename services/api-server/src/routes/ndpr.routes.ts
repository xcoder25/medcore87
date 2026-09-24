/**
 * NDPR / data-protection controls (Nigeria Data Protection Act / NDPR spirit)
 * Consent, processing register, retention, breach log — operational compliance layer.
 * Not a substitute for formal DPO appointment or NITDA filings.
 */
import { Router, Request, Response } from 'express';
import { auditLedger } from '../security/auditLedger';

const router = Router();

interface ConsentRecord {
  id: string;
  patientId: string;
  patientName?: string;
  purposes: string[];
  granted: boolean;
  channel: 'IN_PERSON' | 'APP' | 'USSD' | 'PROXY';
  capturedBy: string;
  facilityId: string;
  at: string;
  withdrawnAt?: string;
}

interface BreachRecord {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  systemsAffected: string[];
  notifiedAuthority: boolean;
  notifiedSubjects: boolean;
  at: string;
  status: 'OPEN' | 'CONTAINED' | 'CLOSED';
}

const CONSENTS: ConsentRecord[] = [];
const BREACHES: BreachRecord[] = [];

const PROCESSING_ACTIVITIES = [
  {
    activity: 'Clinical care documentation (EMR)',
    legalBasis: 'Vital interests / medical care',
    categories: 'Health data (special category)',
    retention: 'Minimum 7 years post last encounter (clinical records practice)',
    processors: 'MedCore OS facility instance',
  },
  {
    activity: 'Health insurance eligibility & claims (AKSHIA/NHIA)',
    legalBasis: 'Contract / legal obligation (insurance)',
    categories: 'Identity, policy, service utilization',
    retention: 'Claims cycle + statutory period',
    processors: 'Facility billing; SSHIA/NHIA interfaces',
  },
  {
    activity: 'Public health reporting (DHIS2/NHMIS)',
    legalBasis: 'Public interest / legal obligation',
    categories: 'Aggregate + limited identifiable for notifiable conditions',
    retention: 'Per FMOH/State HMIS policy',
    processors: 'DHIS2 bridge',
  },
  {
    activity: 'SMS / USSD patient notifications',
    legalBasis: 'Legitimate interest / consent where required',
    categories: 'Phone number, appointment/lab status',
    retention: 'Message logs 12–24 months',
    processors: 'Comms gateway (Termii/AT when live)',
  },
  {
    activity: 'AI clinical decision support (Gemini-backed)',
    legalBasis: 'Legitimate interest in care quality; human oversight required',
    categories: 'De-identified or encounter-context clinical text',
    retention: 'Prompt/audit logs per security policy',
    processors: 'AI engine with HITL',
  },
];

/**
 * GET /api/v1/ndpr/status
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    framework: 'Nigeria Data Protection Act / NDPR-aligned controls',
    dpoRequired: true,
    note: 'Appoint facility/state DPO and complete NITDA processes separately',
    consentsOnFile: CONSENTS.filter((c) => c.granted && !c.withdrawnAt).length,
    openBreaches: BREACHES.filter((b) => b.status !== 'CLOSED').length,
    endpoints: {
      consent: 'POST /api/v1/ndpr/consent',
      withdraw: 'POST /api/v1/ndpr/consent/withdraw',
      processingRegister: 'GET /api/v1/ndpr/processing-register',
      breach: 'POST /api/v1/ndpr/breach',
      retention: 'GET /api/v1/ndpr/retention-policy',
    },
  });
});

/**
 * GET /api/v1/ndpr/processing-register
 */
router.get('/processing-register', (_req: Request, res: Response) => {
  res.json({
    success: true,
    controller: 'Hospital facility operating MedCore OS (Akwa Ibom)',
    activities: PROCESSING_ACTIVITIES,
  });
});

/**
 * GET /api/v1/ndpr/retention-policy
 */
router.get('/retention-policy', (_req: Request, res: Response) => {
  res.json({
    success: true,
    policy: {
      clinicalRecordsYears: 7,
      billingClaimsYears: 7,
      auditLedgerYears: 10,
      smsLogsMonths: 24,
      aiPromptLogsMonths: 12,
      principle: 'Storage limitation — delete or anonymize when purpose ends',
    },
  });
});

/**
 * POST /api/v1/ndpr/consent
 */
router.post('/consent', (req: Request, res: Response) => {
  const { patientId, patientName, purposes, granted, channel, capturedBy, facilityId } = req.body || {};
  if (!patientId || !Array.isArray(purposes) || typeof granted !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'patientId, purposes[], and granted (boolean) required',
    });
  }

  const record: ConsentRecord = {
    id: `CONS-${Date.now().toString(36).toUpperCase()}`,
    patientId,
    patientName,
    purposes,
    granted,
    channel: channel || 'IN_PERSON',
    capturedBy: capturedBy || 'FRONT_DESK',
    facilityId: facilityId || 'FAC-001',
    at: new Date().toISOString(),
  };
  CONSENTS.unshift(record);

  auditLedger.logEvent({
    actorId: record.capturedBy,
    actorName: record.capturedBy,
    actorRole: 'RECEPTIONIST',
    facilityId: record.facilityId,
    action: 'WRITE_PHI',
    resourceType: 'PATIENT',
    resourceId: patientId,
    reason: `NDPR consent ${granted ? 'granted' : 'refused'}: ${purposes.join(', ')}`,
  });

  res.status(201).json({ success: true, data: record });
});

/**
 * POST /api/v1/ndpr/consent/withdraw
 */
router.post('/consent/withdraw', (req: Request, res: Response) => {
  const { patientId, purpose } = req.body || {};
  if (!patientId) {
    return res.status(400).json({ success: false, error: 'patientId required' });
  }
  const matches = CONSENTS.filter(
    (c) => c.patientId === patientId && c.granted && !c.withdrawnAt && (!purpose || c.purposes.includes(purpose))
  );
  const at = new Date().toISOString();
  matches.forEach((c) => {
    c.withdrawnAt = at;
    c.granted = false;
  });
  res.json({ success: true, withdrawn: matches.length, at });
});

/**
 * GET /api/v1/ndpr/consent/:patientId
 */
router.get('/consent/:patientId', (req: Request, res: Response) => {
  const list = CONSENTS.filter((c) => c.patientId === req.params.patientId);
  res.json({ success: true, total: list.length, data: list });
});

/**
 * POST /api/v1/ndpr/breach
 * Internal breach register (notify NITDA/authority via formal process outside this API)
 */
router.post('/breach', (req: Request, res: Response) => {
  const { severity, summary, systemsAffected, notifiedAuthority, notifiedSubjects } = req.body || {};
  if (!severity || !summary) {
    return res.status(400).json({ success: false, error: 'severity and summary required' });
  }
  const record: BreachRecord = {
    id: `BR-${Date.now().toString(36).toUpperCase()}`,
    severity,
    summary,
    systemsAffected: systemsAffected || ['MedCore OS'],
    notifiedAuthority: Boolean(notifiedAuthority),
    notifiedSubjects: Boolean(notifiedSubjects),
    at: new Date().toISOString(),
    status: 'OPEN',
  };
  BREACHES.unshift(record);

  auditLedger.logEvent({
    actorId: 'DPO',
    actorName: 'Data Protection Officer',
    actorRole: 'ADMIN',
    facilityId: 'FAC-001',
    action: 'WRITE_PHI',
    resourceType: 'FACILITY',
    resourceId: record.id,
    reason: `Breach logged: ${severity} — ${summary}`,
  });

  res.status(201).json({
    success: true,
    message: 'Breach logged. Complete external authority notification per NDPA timelines.',
    data: record,
  });
});

/**
 * GET /api/v1/ndpr/breaches
 */
router.get('/breaches', (_req: Request, res: Response) => {
  res.json({ success: true, total: BREACHES.length, data: BREACHES });
});

export default router;
