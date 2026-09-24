/**
 * Health Claims Exchange (HCX) — NDHA / NHIA-aligned eClaim packaging
 * Produces FHIR R4 Claim resources suitable for future HCX submission.
 * Does not claim live federal HCX connectivity until credentials + endpoint set.
 *
 * Env: HCX_BASE_URL, HCX_API_KEY (optional)
 */
import { Router, Request, Response } from 'express';
import { syncEventBus } from '../sync/eventBus';
import { auditLedger } from '../security/auditLedger';

const router = Router();

const CLAIMS_STORE: Array<Record<string, unknown>> = [];

function buildFhirClaim(input: {
  claimId: string;
  patientId: string;
  patientName: string;
  policyId: string;
  facilityId: string;
  facilityName?: string;
  diagnosisCodes: string[];
  items: Array<{ description: string; tariffCode: string; amountNgn: number; quantity?: number }>;
  totalNgn: number;
  scheme: string;
}): Record<string, unknown> {
  return {
    resourceType: 'Claim',
    id: input.claimId,
    meta: {
      profile: [
        'http://fhir.nigeriahealth.gov.ng/StructureDefinition/ng-claim',
        'http://hl7.org/fhir/StructureDefinition/Claim',
      ],
      lastUpdated: new Date().toISOString(),
      tag: [
        { system: 'http://medcore.ng/scheme', code: input.scheme },
        { system: 'http://medcore.ng/hcx', code: 'eClaim-v1' },
      ],
    },
    status: 'active',
    type: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'institutional' }],
    },
    use: 'claim',
    patient: {
      reference: `Patient/${input.patientId}`,
      display: input.patientName,
    },
    created: new Date().toISOString(),
    provider: {
      reference: `Organization/${input.facilityId}`,
      display: input.facilityName || input.facilityId,
    },
    priority: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          identifier: {
            system: 'http://nhia.gov.ng/policy',
            value: input.policyId,
          },
          display: input.scheme,
        },
      },
    ],
    diagnosis: input.diagnosisCodes.map((code, i) => ({
      sequence: i + 1,
      diagnosisCodeableConcept: {
        coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code }],
        text: code,
      },
    })),
    item: input.items.map((it, i) => ({
      sequence: i + 1,
      productOrService: {
        coding: [{ system: 'http://nhia.gov.ng/tariff', code: it.tariffCode }],
        text: it.description,
      },
      quantity: { value: it.quantity || 1 },
      unitPrice: { value: it.amountNgn, currency: 'NGN' },
      net: { value: it.amountNgn * (it.quantity || 1), currency: 'NGN' },
    })),
    total: { value: input.totalNgn, currency: 'NGN' },
  };
}

/**
 * GET /api/v1/hcx/status
 */
router.get('/status', (_req: Request, res: Response) => {
  const live = Boolean(process.env.HCX_BASE_URL);
  res.json({
    success: true,
    mode: live ? 'LIVE_ENDPOINT_CONFIGURED' : 'LOCAL_ECLAIM_PACKAGER',
    standard: 'FHIR R4 Claim (NDHA / HCX-oriented profile tags)',
    claimsPackaged: CLAIMS_STORE.length,
    message: live
      ? 'HCX_BASE_URL set — submit will POST eClaim'
      : 'Packages FHIR eClaims locally; set HCX_BASE_URL for exchange submit',
  });
});

/**
 * POST /api/v1/hcx/eclaim
 * Build NHIA/AKSHIA-oriented FHIR Claim from encounter billing lines
 */
router.post('/eclaim', (req: Request, res: Response) => {
  const {
    patientId,
    patientName,
    policyId,
    facilityId,
    facilityName,
    diagnosisCodes,
    items,
    scheme,
  } = req.body || {};

  if (!patientId || !policyId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'patientId, policyId, and items[] required',
    });
  }

  const normalized = items.map((it: any) => ({
    description: it.description || it.itemDescription || 'Service',
    tariffCode: it.tariffCode || 'TAR-GEN-01',
    amountNgn: Number(it.amountNgn ?? it.grossAmountNgn) || 0,
    quantity: Number(it.quantity) || 1,
  }));
  const totalNgn = normalized.reduce((s: number, it: any) => s + it.amountNgn * it.quantity, 0);
  const claimId = `CLM-${Date.now().toString(36).toUpperCase()}`;

  const fhirClaim = buildFhirClaim({
    claimId,
    patientId,
    patientName: patientName || 'Beneficiary',
    policyId,
    facilityId: facilityId || 'FAC-001',
    facilityName,
    diagnosisCodes: diagnosisCodes || ['B54'],
    items: normalized,
    totalNgn,
    scheme: scheme || 'AKSHIA_STATE',
  });

  CLAIMS_STORE.unshift({
    id: claimId,
    createdAt: new Date().toISOString(),
    status: 'PACKAGED',
    fhirClaim,
  });

  auditLedger.logEvent({
    actorId: 'HCX-PACKAGER',
    actorName: 'Health Claims Exchange Adapter',
    actorRole: 'SYSTEM_DAEMON',
    facilityId: facilityId || 'FAC-001',
    action: 'WRITE_PHI',
    resourceType: 'BILL',
    resourceId: claimId,
    reason: 'FHIR eClaim packaged for NHIA/AKSHIA / HCX path',
  });

  syncEventBus.broadcast({
    topic: 'HMO_PREAUTH_APPROVED',
    facilityId: facilityId || 'FAC-001',
    emitterApp: 'API_SERVER',
    payload: { claimId, policyId, totalNgn, status: 'PACKAGED' },
  });

  res.setHeader('Content-Type', 'application/fhir+json');
  res.status(201).json({
    success: true,
    message: 'FHIR R4 Claim packaged (HCX-ready structure)',
    data: {
      claimId,
      totalNgn,
      fhirClaim,
    },
  });
});

/**
 * POST /api/v1/hcx/submit/:claimId
 * Optional remote submit when HCX_BASE_URL is set
 */
router.post('/submit/:claimId', async (req: Request, res: Response) => {
  const claim = CLAIMS_STORE.find((c) => c.id === req.params.claimId);
  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found — package with POST /hcx/eclaim first' });
  }

  const base = process.env.HCX_BASE_URL;
  if (!base) {
    return res.json({
      success: true,
      mode: 'SIMULATED',
      message: 'No HCX_BASE_URL — claim remains PACKAGED locally',
      data: claim,
    });
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: process.env.HCX_API_KEY ? `Bearer ${process.env.HCX_API_KEY}` : '',
      },
      body: JSON.stringify(claim.fhirClaim),
    });
    const remote = await response.json().catch(() => ({ status: response.status }));
    claim.status = response.ok ? 'SUBMITTED' : 'SUBMIT_FAILED';
    res.status(response.ok ? 200 : 502).json({
      success: response.ok,
      mode: 'LIVE',
      data: { claim, remote },
    });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err?.message || 'HCX submit failed' });
  }
});

/**
 * GET /api/v1/hcx/claims
 */
router.get('/claims', (_req: Request, res: Response) => {
  res.json({
    success: true,
    total: CLAIMS_STORE.length,
    data: CLAIMS_STORE.map(({ id, createdAt, status }) => ({ id, createdAt, status })),
  });
});

export default router;
