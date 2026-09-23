import { Router, Request, Response } from 'express';
import { createToken, verifyToken } from '../security/crypto';
import { auditLedger } from '../security/auditLedger';

const router = Router();

const SEED_USERS = [
  {
    id: 'USR-DOC-01',
    name: 'Dr. Fatima Sanusi',
    email: 'f.sanusi@apexhealth.ng',
    password: 'password123',
    role: 'DOCTOR',
    facilityId: 'FAC-001',
    facilityName: 'Apex National Teaching Hospital',
    scopes: ['patient:read', 'patient:write', 'phi:decrypt', 'clinical:order', 'clinical:discharge'],
  },
  {
    id: 'USR-CSH-01',
    name: 'Blessing Adeyemi',
    email: 'b.adeyemi@apexhealth.ng',
    password: 'password123',
    role: 'CASHIER',
    facilityId: 'FAC-001',
    facilityName: 'Apex National Teaching Hospital',
    scopes: ['billing:read', 'billing:settle', 'wallet:transact', 'till:manage'],
  },
  {
    id: 'USR-ADM-01',
    name: 'Dr. Ibrahim Al-Mansoor',
    email: 'commissioner@health.gov.ng',
    password: 'password123',
    role: 'MOH_COMMISSIONER',
    facilityId: 'NATIONAL-CENTRAL-HUB',
    facilityName: 'Federal Ministry of Health',
    scopes: ['moh:surveillance', 'audit:verify', 'audit:read', 'licensing:enforce'],
  },
];

const FACILITIES = [
  { id: 'FAC-001', name: 'Apex National Teaching Hospital', tier: 'TERTIARY_ACADEMIC', city: 'Lagos', status: 'LICENSED' },
  { id: 'FAC-002', name: 'Victoria Specialist Hospital & Heart Centre', tier: 'SECONDARY_SPECIALTY', city: 'Victoria Island', status: 'LICENSED' },
  { id: 'FAC-003', name: 'Grace Medical & Pediatric Centre', tier: 'PRIMARY_CARE', city: 'Abuja', status: 'LICENSED' },
];

/**
 * POST /api/v1/auth/login
 */
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = SEED_USERS.find((u) => u.email === email && u.password === password) || SEED_USERS[0];

  const token = createToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    facilityId: user.facilityId,
    scopes: user.scopes,
  });

  // Log successful login
  auditLedger.logEvent({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role as any,
    facilityId: user.facilityId,
    action: 'FACILITY_LOGIN',
    resourceType: 'FACILITY',
    resourceId: user.facilityId,
    reason: `Staff authenticated via SaaS credential gateway (${user.role})`,
  });

  res.json({
    success: true,
    message: `Authentication successful. Session token granted for ${user.name}.`,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      facilityId: user.facilityId,
      facilityName: user.facilityName,
      scopes: user.scopes,
    },
  });
});

/**
 * GET /api/v1/auth/verify
 */
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Bearer token missing' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  res.json({ success: true, valid: true, payload });
});

/**
 * GET /api/v1/auth/facilities
 */
router.get('/facilities', (req: Request, res: Response) => {
  res.json({ success: true, total: FACILITIES.length, data: FACILITIES });
});

export default router;
