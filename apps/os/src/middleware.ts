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
  '/api/whatsapp/triage',
  '/api/care/',
  '/api/audit/anchor',
  '/api/cron/daily-ops',
];

const ADMIN_ONLY_API_PREFIXES = [
  '/api/staff/create',
  '/api/staff/delete-auth',
  '/api/staff/delete-all-auth',
  '/api/staff/flush-facility',
  '/api/akwaremit/configure',
];

function extractBearerToken(authHeader: string | null): string | undefined {
  if (!authHeader) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1]?.trim() || undefined;
}

function withCors(res: NextResponse, origin: string | null): NextResponse {
  if (origin && res?.headers && typeof res.headers.set === 'function') {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

/**
 * Next.js Edge Middleware for MedCore OS:
 * 1. Enforces signed HttpOnly cookie OR Bearer session token authentication on all protected /api/* routes.
 * 2. Enforces multi-tenant facility isolation (Hospital A cannot read/write Hospital B).
 * 3. Enforces administrative clearance (>= 4 or hospital_admin/sysadmin) on privileged endpoints.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (req.method === 'OPTIONS') {
    return withCors(new NextResponse(null, { status: 204 }), origin);
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return withCors(NextResponse.next(), origin);
  }

  const token =
    req.cookies.get(SESSION_COOKIE_NAME)?.value ||
    extractBearerToken(req.headers.get('authorization'));
  const verified = await verifySessionToken(token);

  if (!verified) {
    return withCors(
      NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
          message: 'Valid authenticated hospital session required.',
        },
        { status: 401 }
      ),
      origin
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
    return withCors(
      NextResponse.json(
        {
          ok: false,
          error: 'FORBIDDEN',
          message: 'Administrator clearance required for this operation.',
        },
        { status: 403 }
      ),
      origin
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
    return withCors(
      NextResponse.json(
        {
          ok: false,
          error: `Cross-facility tenant isolation violation: session belongs to ${verified.facilityId}`,
        },
        { status: 403 }
      ),
      origin
    );
  }

  return withCors(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    origin
  );
}

export const config = {
  matcher: ['/api/:path*'],
};
