import { Router, Request, Response } from 'express';
import { dataStore } from '../store/database';
import { auditLedger } from '../security/auditLedger';
import { HmoEligibilityResult, DenialReasonCode } from '@medcore/types';

const router = Router();

// Simulated AKSHIA & NHIA Beneficiary Registry
const BENEFICIARY_REGISTRY: Record<string, {
  name: string;
  scheme: 'AKSHIA_STATE' | 'NHIA_FORMAL' | 'NHIA_VULNERABLE' | 'PRIVATE_HMO';
  tier: 'BASIC' | 'COMPREHENSIVE' | 'EXECUTIVE';
  primaryFacility: string;
  copayPercent: number;
  remainingCapNgn: number;
  coveredCategories: string[];
  active: boolean;
}> = {
  'AKSHIA-POL-88219': {
    name: 'Amina Bello',
    scheme: 'AKSHIA_STATE',
    tier: 'COMPREHENSIVE',
    primaryFacility: 'Immanuel General Hospital, Eket',
    copayPercent: 10,
    remainingCapNgn: 450000,
    coveredCategories: ['OUTPATIENT', 'ANTIMALARIALS', 'MATERNAL', 'LAB_BASIC', 'SURGERY_MINOR'],
    active: true,
  },
  'AKSHIA-POL-39102': {
    name: 'Emeka Okafor',
    scheme: 'AKSHIA_STATE',
    tier: 'BASIC',
    primaryFacility: 'General Hospital, Ikot Ekpene',
    copayPercent: 10,
    remainingCapNgn: 280000,
    coveredCategories: ['OUTPATIENT', 'ANTIMALARIALS', 'LAB_BASIC', 'CHRONIC_CARE'],
    active: true,
  },
  'NHIA-VULN-00412': {
    name: 'Mfoniso Uwem Akpabio',
    scheme: 'NHIA_VULNERABLE',
    tier: 'BASIC',
    primaryFacility: 'Methodist General Hospital, Ituk Mbang',
    copayPercent: 0, // 100% subsidized by Federal Vulnerable Group Fund
    remainingCapNgn: 300000,
    coveredCategories: ['OUTPATIENT', 'ANTIMALARIALS', 'PEDIATRICS', 'ANTIBIOTICS', 'LAB_BASIC'],
    active: true,
  },
  'AKSHIA-POL-EXPIRED': {
    name: 'Bassey Effiong',
    scheme: 'AKSHIA_STATE',
    tier: 'BASIC',
    primaryFacility: 'General Hospital, Etinan',
    copayPercent: 10,
    remainingCapNgn: 0,
    coveredCategories: [],
    active: false,
  },
};

/**
 * POST /api/v1/hmo/eligibility
 * Real-time eligibility check for NHIA / AKSHIA HMO
 */
router.post('/eligibility', (req: Request, res: Response) => {
  const { policyId, patientId, facilityId } = req.body;

  if (!policyId) {
    return res.status(400).json({ success: false, error: 'policyId is required' });
  }

  const record = BENEFICIARY_REGISTRY[policyId];
  const now = new Date().toISOString();

  if (!record) {
    const result: HmoEligibilityResult = {
      eligible: false,
      policyId,
      scheme: 'OUT_OF_POCKET',
      beneficiaryName: 'Unknown Enrollee',
      enrolleeTier: 'BASIC',
      primaryFacility: 'None',
      copayPercent: 100,
      remainingAnnualCapNgn: 0,
      coveredCategories: [],
      denialReason: 'INVALID_BENEFICIARY_ID',
      verifiedAt: now,
    };
    return res.json({ success: true, eligible: false, data: result, message: 'Policy ID not found in AKSHIA/NHIA central database. Direct patient to Help Desk.' });
  }

  if (!record.active) {
    const result: HmoEligibilityResult = {
      eligible: false,
      policyId,
      scheme: record.scheme,
      beneficiaryName: record.name,
      enrolleeTier: record.tier,
      primaryFacility: record.primaryFacility,
      copayPercent: 100,
      remainingAnnualCapNgn: 0,
      coveredCategories: [],
      denialReason: 'POLICY_EXPIRED',
      verifiedAt: now,
    };
    return res.json({ success: true, eligible: false, data: result, message: 'HMO Policy has expired. Renewal required before subsidized dispensing.' });
  }

  const result: HmoEligibilityResult = {
    eligible: true,
    policyId,
    scheme: record.scheme,
    beneficiaryName: record.name,
    enrolleeTier: record.tier,
    primaryFacility: record.primaryFacility,
    copayPercent: record.copayPercent,
    remainingAnnualCapNgn: record.remainingCapNgn,
    coveredCategories: record.coveredCategories,
    verifiedAt: now,
  };

  auditLedger.logEvent({
    actorId: 'HMO-DESK',
    actorName: 'HMO Desk Officer',
    actorRole: 'CASHIER',
    facilityId: facilityId || 'FAC-001',
    action: 'READ_PHI',
    resourceType: 'BILL',
    resourceId: policyId,
    reason: `HMO Eligibility verified for ${record.name} (${policyId}) - Scheme: ${record.scheme}`,
  });

  res.json({
    success: true,
    eligible: true,
    message: `Verified eligible under ${record.scheme}. Patient co-pay is ${record.copayPercent}%.`,
    data: result,
  });
});

/**
 * POST /api/v1/hmo/claims
 * Draft or submit HMO claim
 */
router.post('/claims', (req: Request, res: Response) => {
  const {
    patientId,
    patientName,
    scheme,
    policyId,
    facilityId,
    diagnosisCodes,
    encounterId,
    items,
    preauthCode,
  } = req.body;

  if (!patientId || !policyId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'patientId, policyId, and claim items array are required' });
  }

  // Calculate totals
  let totalGross = 0;
  let totalCopay = 0;
  let totalHmo = 0;

  const processedItems = items.map((item: any) => {
    const gross = Number(item.grossAmountNgn) || 0;
    const copay = Number(item.copayAmountNgn) || Math.round(gross * 0.1); // default 10%
    const hmo = gross - copay;
    totalGross += gross;
    totalCopay += copay;
    totalHmo += hmo;
    return {
      itemDescription: item.itemDescription,
      tariffCode: item.tariffCode || 'TAR-GEN-01',
      grossAmountNgn: gross,
      copayAmountNgn: copay,
      hmoPayableNgn: hmo,
    };
  });

  const claim = dataStore.createHmoClaim({
    patientId,
    patientName: patientName || 'Beneficiary',
    scheme: scheme || 'AKSHIA_STATE',
    policyId,
    facilityId: facilityId || 'FAC-001',
    diagnosisCodes: diagnosisCodes || ['B54 (Unspecified Malaria)'],
    encounterId: encounterId || 'ENC-ACTIVE',
    items: processedItems,
    totalGrossNgn: totalGross,
    totalCopayNgn: totalCopay,
    totalHmoPayableNgn: totalHmo,
    preauthCode,
  });

  res.status(201).json({
    success: true,
    message: `Claim #${claim.id} generated. HMO portion: ₦${totalHmo.toLocaleString()}, Patient co-pay: ₦${totalCopay.toLocaleString()}.`,
    data: claim,
  });
});

/**
 * GET /api/v1/hmo/claims
 */
router.get('/claims', (req: Request, res: Response) => {
  const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
  const claims = dataStore.getHmoClaims(patientId);
  res.json({ success: true, total: claims.length, data: claims });
});

/**
 * GET /api/v1/hmo/claims/:id
 */
router.get('/claims/:id', (req: Request, res: Response) => {
  const claim = dataStore.getHmoClaimById(req.params.id as string);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
  res.json({ success: true, data: claim });
});

export default router;
