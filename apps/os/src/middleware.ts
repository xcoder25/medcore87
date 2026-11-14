import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/serverSession';

/**
 * Next.js Edge Middleware for MedCore OS:
 * Verifies signed HttpOnly session cookies, attaches verified tenant & RBAC headers,
 * and enforces facility tenant isolation on API routes.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public auth endpoints pass through directly
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/ping')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verified = await verifySessionToken(token);

  const requestHeaders = new Headers(req.headers);

  if (verified) {
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
