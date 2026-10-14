import { Router, Request, Response } from 'express';
import { auditLedger } from '../security/auditLedger';
import { commissionerSecurity } from '../security/commissionerBriefing';
import { accessControl } from '../security/accessControl';
import { deidentifyForSurveillance, RawClinicalEvent } from '../security/deidentification';
import { syncEventBus } from '../sync/eventBus';
import { getPublicJwks } from '../security/crypto';
import { getKeyInfo } from '../security/jwtKeys';

const router = Router();

/**
 * GET /api/v1/security/jwks
 * JSON Web Key Set — exposes the RS256 public key so external services (MOH portal,
 * FHIR clients, HMO gateways) can verify MedCore-issued tokens without the private key.
 * Mirrors the standard /.well-known/jwks.json convention (RFC 7517).
 */
router.get('/jwks', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Keys rotate infrequently; 1-hour cache is safe
  res.json(getPublicJwks());
});

/**
 * GET /api/v1/security/key-info
 * Returns non-sensitive metadata about the active signing key: algorithm, modulus size,
 * kid, source (env/file/ephemeral), and creation timestamp. Never returns the private key.
 */
router.get('/key-info', (_req: Request, res: Response) => {
  res.json({ success: true, data: getKeyInfo() });
});

/**
 * GET /api/v1/security/commissioner-briefing
 * Dedicated dossier answering the Health Commissioner's questions on data security,
 * field-level encryption, zero-trust controls, and statutory compliance.
 */
router.get('/commissioner-briefing', (req: Request, res: Response) => {
  const dossier = commissionerSecurity.generateDossier();
  const executiveReport = commissionerSecurity.generateExecutiveReport();

  res.json({
    success: true,
    data: {
      dossier,
      executiveReport,
    },
  });
});

/**
 * GET /api/v1/security/verify-ledger
 * Cryptographically verifies every SHA-256 block in the audit chain from Genesis to Head.
 * Returns mathematical proof of 0% tampering.
 */
router.get('/verify-ledger', (req: Request, res: Response) => {
  const verification = auditLedger.verifyChainIntegrity();
  res.json({
    success: true,
    data: verification,
  });
});

/**
 * GET /api/v1/security/audit-trail
 * Retrieves immutable audit records with pagination
 */
router.get('/audit-trail', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const offset = parseInt((req.query.offset as string) || '0', 10);

  const blocks = auditLedger.getBlocks(limit, offset);
  const total = auditLedger.getBlockCount();

  res.json({
    success: true,
    data: {
      totalBlocks: total,
      blocks,
    },
  });
});

/**
 * POST /api/v1/security/break-glass
 * Emergency protocol for unconscious trauma patients across hospital boundaries.
 */
router.post('/break-glass', (req: Request, res: Response) => {
  const { doctorId, doctorName, patientId, patientMRN, facilityId, justification, clinicalIndication } = req.body;

  if (!doctorId || !patientId || !justification || !clinicalIndication) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: doctorId, patientId, justification, and clinicalIndication are mandatory.',
    });
  }

  const event = accessControl.triggerBreakGlass({
    doctorId,
    doctorName: doctorName || 'Attending ER Physician',
    patientId,
    patientMRN: patientMRN || 'UNKNOWN-MRN',
    facilityId: facilityId || 'FAC-001',
    justification,
    clinicalIndication,
  });

  // Broadcast high-priority alert across real-time bus
  syncEventBus.broadcast({
    topic: 'BREAK_GLASS_TRIGGERED',
    facilityId: event.facilityId,
    emitterApp: 'API_SERVER',
    payload: {
      breakGlassId: event.id,
      patientId: event.patientId,
      patientMRN: event.patientMRN,
      doctorName: event.doctorName,
      indication: event.clinicalIndication,
      timestamp: event.timestamp,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Emergency Break-Glass authorized. Tamper-evident audit block posted and supervisor notified.',
    data: event,
  });
});

/**
 * POST /api/v1/security/break-glass/:id/acknowledge
 * Supervisor acknowledgement of an emergency break-glass event
 */
router.post('/break-glass/:id/acknowledge', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reviewerName } = req.body;

  const ok = accessControl.acknowledgeBreakGlass(id as string, reviewerName || 'Chief Medical Director');
  if (!ok) {
    return res.status(404).json({ success: false, error: `Break-glass event ${id} not found` });
  }

  res.json({
    success: true,
    message: `Break-glass event ${id} acknowledged by supervisor.`,
  });
});

/**
 * POST /api/v1/security/deidentify-preview
 * Demonstrates real-time HIPAA 18-identifier scrub before telemetry is transmitted to MOH
 */
router.post('/deidentify-preview', (req: Request, res: Response) => {
  const raw: RawClinicalEvent = req.body;
  if (!raw.patientId || !raw.dob || !raw.diagnosisCode) {
    return res.status(400).json({ success: false, error: 'patientId, dob, and diagnosisCode are required' });
  }

  const deidentified = deidentifyForSurveillance(raw);
  res.json({
    success: true,
    originalIdentifiersStripped: ['name', 'phone', 'address', 'mrn', 'email', 'exact DOB', 'nationalId'],
    data: deidentified,
  });
});

export default router;
