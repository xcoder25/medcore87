import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/serverSession';

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/staff/lookup',
  '/api/db/health',
  '/api/health',
  '/api/ping',
  '/api/akwaremit/webhook',
  '/api/paystack/webhook',
];

const ADMIN_ONLY_API_PREFIXES = [
  '/api/staff/create',
  '/api/staff/delete-auth',
  '/api/staff/delete-all-auth',
  '/api/staff/flush-facility',
  '/api/akwaremit/configure',
];

/**
 * Next.js Edge Middleware for MedCore OS:
 * 1. Enforces signed HttpOnly session authentication on all protected /api/* routes.
 * 2. Enforces multi-tenant facility isolation (Hospital A cannot read/write Hospital B).
 * 3. Enforces administrative clearance (>= 4 or hospital_admin/sysadmin) on privileged endpoints.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = await verifySessionToken(token);

  if (!verified) {
    return NextResponse.json(
      {
        ok: false,
        error: 'UNAUTHORIZED',
        message: 'Valid authenticated hospital session required.',
      },
      { status: 401 }
    );
  }

  const isAdmin =
    verified.roleKey === 'hospital_admin' ||
    verified.roleKey === 'sysadmin' ||
    verified.roleKey === 'medical_director' ||
    verified.clearanceLevel >= 4;

  const isPrivilegedRoute =
    ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    (pathname === '/api/staff' && req.method === 'DELETE');

  if (isPrivilegedRoute && !isAdmin) {
    return NextResponse.json(
      {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Administrator clearance required for this operation.',
      },
      { status: 403 }
    );
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-medcore-facility-id', verified.facilityId);
  requestHeaders.set('x-medcore-staff-badge', verified.badgeId);
  requestHeaders.set('x-medcore-staff-name', verified.name);
  requestHeaders.set('x-medcore-role-key', verified.roleKey);
  requestHeaders.set('x-medcore-clearance', String(verified.clearanceLevel));

  // Tenant Isolation Guard: non-superadmin users cannot query another facility's records
  const requestedFacility = (req.nextUrl.searchParams.get('facilityId') || '').trim().toUpperCase();
  const isSuperAdmin =
    verified.roleKey === 'hospital_admin' ||
    verified.roleKey === 'sysadmin' ||
    verified.clearanceLevel >= 5;

  if (
    requestedFacility &&
    requestedFacility !== 'DEFAULT' &&
    requestedFacility !== verified.facilityId &&
    !isSuperAdmin
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: `Cross-facility tenant isolation violation: session belongs to ${verified.facilityId}`,
      },
      { status: 403 }
    );
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
