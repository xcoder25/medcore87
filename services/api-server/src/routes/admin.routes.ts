import { dataStore } from '../store/database';
import { Router, Request, Response } from 'express';
import { commissionerSurveillance } from '../admin/commissionerSurveillance';
import { auditLedger } from '../security/auditLedger';

const router = Router();

/**
 * GET /api/v1/admin/dashboard
 * Master executive command intelligence for the Commissioner of Health
 */
router.get('/dashboard', (req: Request, res: Response) => {
  const data = commissionerSurveillance.getMasterDashboardData();

  // Immutable audit log: Commissioner queried national telemetry
  auditLedger.logEvent({
    actorId: (req.query.actorId as string) || 'MOH-COMMISSIONER-01',
    actorName: (req.query.actorName as string) || 'Dr. Ibrahim Al-Mansoor (Health Commissioner)',
    actorRole: 'MOH_COMMISSIONER',
    facilityId: 'NATIONAL-CENTRAL-HUB',
    action: 'SURVEILLANCE_EXPORT',
    resourceType: 'FACILITY',
    resourceId: 'ALL-FACILITIES',
    reason: 'Executive review of national vital census, mortality ledger, and healthcare financial telemetry',
  });

  res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/v1/admin/vital-census
 * Alive / Dead Census & Vital Statistics breakdown
 */
router.get('/vital-census', (req: Request, res: Response) => {
  const census = commissionerSurveillance.getVitalCensus();
  res.json({ success: true, data: census });
});

/**
 * GET /api/v1/admin/mortality-registry
 * De-identified, cryptographically chained mortality records
 */
router.get('/mortality-registry', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const records = commissionerSurveillance.getMortalityRegistry(limit);
  res.json({ success: true, total: records.length, data: records });
});

/**
 * GET /api/v1/admin/financial-surveillance
 * State/Nationwide financial surveillance across Paystack, AkwaRemit, Cash Tills, and HMOs
 */
router.get('/financial-surveillance', (req: Request, res: Response) => {
  const financial = commissionerSurveillance.getFinancialSurveillance();
  res.json({ success: true, data: financial });
});


/** Phase 3 — Statewide operational census for MOH Admin */
router.get('/statewide-census', (_req: Request, res: Response) => {
  const census = dataStore.getStatewideCensus();
  res.json({ success: true, data: census, scope: 'STATE_NETWORK' });
});

/** Phase 3 — Facility activity rollup */
router.get('/facility-activity', (_req: Request, res: Response) => {
  const census = dataStore.getStatewideCensus();
  const facilities = Object.entries(census.byFacility).map(([facilityId, patients]) => ({
    facilityId,
    registeredPatients: patients,
  }));
  res.json({
    success: true,
    data: {
      facilities,
      totalPatients: census.totalPatients,
      totalEncounters: census.totalEncounters,
      activeEncounters: census.activeEncounters,
      generatedAt: census.generatedAt,
    },
  });
});

export default router;

