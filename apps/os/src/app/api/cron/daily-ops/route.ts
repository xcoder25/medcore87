import { NextRequest, NextResponse } from 'next/server';
import {
  isCronAuthorized,
  runDailyFacilityOps,
} from '../../../../lib/dailyOpsCronEngine';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../../../../lib/serverSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleCron(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const isAdminSession = Boolean(
    session &&
      (session.roleKey === 'hospital_admin' ||
        session.roleKey === 'sysadmin' ||
        session.clearanceLevel >= 4)
  );

  if (!isCronAuthorized(req, (process.env.CRON_SECRET || '').trim(), isAdminSession)) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED', message: 'Valid CRON_SECRET bearer token or admin session required.' },
      { status: 401 }
    );
  }

  const facilityParam = (req.nextUrl?.searchParams?.get('facilityId') || '').trim();
  const report = await runDailyFacilityOps({
    facilityIds: facilityParam ? [facilityParam] : session?.facilityId ? [session.facilityId] : undefined,
  });

  return NextResponse.json(report);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
