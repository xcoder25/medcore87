import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * AkwaRemit Verification & Status Check Endpoint
 */
export async function GET(req: NextRequest) {
  const arn = req.nextUrl.searchParams.get('arn') || '';
  if (!arn.trim()) {
    return NextResponse.json({ error: 'arn query parameter required' }, { status: 400 });
  }

  // Simulated verification check against AkwaRemit gateway
  return NextResponse.json({
    ok: true,
    arn: arn.trim(),
    status: 'paid',
    gateway: 'AkwaRemit TSA State Gateway',
    verifiedAt: new Date().toISOString(),
  });
}

