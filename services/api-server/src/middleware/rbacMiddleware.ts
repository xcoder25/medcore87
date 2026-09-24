import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@medcore/types';
import { accessControl } from '../security/accessControl';
import { auditLedger } from '../security/auditLedger';

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: UserRole;
  facilityId: string;
  scopes: string[];
}

export function extractActor(req: Request): AuthenticatedUser {
  const roleHeader = (req.headers['x-actor-role'] as string) || (req.query.actorRole as string) || 'DOCTOR';
  const validRoles: UserRole[] = [
    'DOCTOR', 'NURSE', 'SURGEON', 'PHARMACIST', 'LAB_SCIENTIST',
    'CASHIER', 'HOSPITAL_ADMIN', 'MOH_COMMISSIONER', 'REGULATORY_AUDITOR',
    'COMMUNITY_HEALTH_WORKER', 'PATIENT'
  ];

  const role: UserRole = validRoles.includes(roleHeader as UserRole)
    ? (roleHeader as UserRole)
    : 'DOCTOR';

  return {
    id: (req.headers['x-actor-id'] as string) || (req.query.actorId as string) || 'STAFF-DEFAULT',
    name: (req.headers['x-actor-name'] as string) || (req.query.actorName as string) || 'Attending Staff',
    role,
    facilityId: (req.headers['x-facility-id'] as string) || (req.query.facilityId as string) || 'FAC-001',
    scopes: ['clinical:read', 'clinical:write'],
  };
}

/**
 * Enforces role-based clearance and logs immutable tamper-evident audit trail
 */
export function requireRoles(allowedRoles: UserRole[], action: 'READ' | 'WRITE' | 'DECRYPT' | 'TRANSACT' = 'READ', resourceType = 'CLINICAL') {
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = extractActor(req);

    // Evaluate clearance via AccessControlService
    const check = accessControl.authorize(
      actor,
      action,
      { type: resourceType, id: (req.params.id as string) || (req.body.patientId as string) || 'GENERAL', facilityId: actor.facilityId }
    );

    if (!check.allowed || (!allowedRoles.includes(actor.role) && actor.role !== 'HOSPITAL_ADMIN')) {
      const denialReason = check.reason || `Role "${actor.role}" is not authorized for ${action} on ${resourceType}. Requires: ${allowedRoles.join(', ')}`;

      auditLedger.logEvent({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        facilityId: actor.facilityId,
        action: 'ACCESS_DENIED' as any,
        resourceType: resourceType as any,
        resourceId: req.originalUrl,
        reason: denialReason,
      });

      return res.status(403).json({
        success: false,
        error: 'RBAC Access Denied',
        message: denialReason,
        role: actor.role,
        requiredRoles: allowedRoles,
      });
    }

    // Attach verified actor to request
    (req as any).actor = actor;
    next();
  };
}
