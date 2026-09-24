import { Router, Request, Response } from 'express';
import { dataStore, FacilityEnrollmentStatus, FacilityTier } from '../store/database';

const router = Router();

/**
 * GET /api/v1/facilities
 * List all 35 official Akwa Ibom secondary health facilities
 * Query params: ?status=pending|credentials_issued|active  &region=...  &tier=...
 */
router.get('/', (req: Request, res: Response) => {
  const { status, region, tier } = req.query as Record<string, string>;
  const facilities = dataStore.getFacilities({
    status: status as FacilityEnrollmentStatus | undefined,
    region,
    tier: tier as FacilityTier | undefined,
  });
  res.json({ success: true, total: facilities.length, data: facilities });
});

/**
 * GET /api/v1/facilities/summary
 * Enrollment & tier breakdown for admin dashboard widgets
 */
router.get('/summary', (_req: Request, res: Response) => {
  const summary = dataStore.getFacilitySummary();
  res.json({ success: true, data: summary });
});

/**
 * GET /api/v1/facilities/:id
 * Single facility detail
 */
router.get('/:id', (req: Request, res: Response) => {
  const facility = dataStore.getFacilityById(String(req.params.id));
  if (!facility) return res.status(404).json({ success: false, error: `Facility ${req.params.id} not found` });
  return res.json({ success: true, data: facility });
});

/**
 * POST /api/v1/facilities/:id/issue-credentials
 * Commissioner issues Hospi OS login for a pending facility
 * Body: { actorId, actorName }
 */
router.post('/:id/issue-credentials', (req: Request, res: Response) => {
  try {
    const { actorId = 'MOH-COMMISSIONER-01', actorName = 'Commissioner of Health' } = req.body ?? {};
    const facility = dataStore.issueFacilityCredentials(String(req.params.id), actorId, actorName);
    return res.json({
      success: true,
      message: `Hospi OS credentials issued for ${facility.facilityName}`,
      data: {
        facilityId:          facility.facilityId,
        facilityName:        facility.facilityName,
        hospiLogin:          facility.hospiLogin,
        hospiTempPassword:   facility.hospiTempPassword,
        credentialsIssuedAt: facility.credentialsIssuedAt,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/facilities/:id/activate
 * Simulate facility first login into Hospi OS → status becomes active
 */
router.post('/:id/activate', (req: Request, res: Response) => {
  try {
    const facility = dataStore.activateFacility(String(req.params.id));
    return res.json({ success: true, message: `${facility.facilityName} is now ACTIVE on Hospi OS`, data: facility });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
