import type { Request, Response, NextFunction } from 'express';

/**
 * Statewide multi-facility scope.
 * Prefer X-Facility-Id header; fall back to query/body.
 */
export function facilityScope(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('x-facility-id') || req.header('X-Facility-Id');
  const q = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
  const bodyId = req.body && typeof req.body.facilityId === 'string' ? req.body.facilityId : undefined;
  const facilityId = header || q || bodyId || undefined;
  (req as any).facilityId = facilityId;
  next();
}

export function requireFacility(req: Request, res: Response, next: NextFunction) {
  const facilityId = (req as any).facilityId;
  if (!facilityId) {
    return res.status(400).json({
      success: false,
      error: 'facilityId required (header X-Facility-Id or query/body facilityId)',
      code: 'FACILITY_SCOPE_REQUIRED',
    });
  }
  next();
}
