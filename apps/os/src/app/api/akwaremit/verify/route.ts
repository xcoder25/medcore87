import { NextRequest, NextResponse } from 'next/server';
import { getAkwaRemitServerConfig } from '../../../../lib/akwaremitServer';

export const runtime = 'nodejs';

/**
 * AkwaRemit Verification & Status Check Endpoint
 */
export async function GET(req: NextRequest) {
  const arn = req.nextUrl.searchParams.get('arn') || '';
  if (!arn.trim()) {
    return NextResponse.json({ error: 'arn query parameter required' }, { status: 400 });
  }

  const config = getAkwaRemitServerConfig();
  if (!config.apiKey) {
    return NextResponse.json(
      {
        ok: false,
        arn: arn.trim(),
        status: 'unconfigured',
        gateway: 'AkwaRemit TSA State Gateway',
        message: 'AKWAREMIT_API_KEY is not configured on the server.',
      },
      { status: 503 }
    );
  }

  try {
    const endpoint = config.environment === 'live'
      ? `https://remita.net/remita/exstream/api/v1/vsm/status/${encodeURIComponent(arn.trim())}`
      : `https://demo.remita.net/remita/exstream/api/v1/vsm/status/${encodeURIComponent(arn.trim())}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Merchant-Id': config.merchantId,
      },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    const isPaid = data?.status === 'paid' || data?.status === 'success' || data?.paymentStatus === 'PAID';

    return NextResponse.json({
      ok: res.ok,
      arn: arn.trim(),
      status: isPaid ? 'paid' : 'pending',
      gateway: 'AkwaRemit TSA State Gateway',
      data,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        arn: arn.trim(),
        status: 'pending',
        gateway: 'AkwaRemit TSA State Gateway',
        error: err?.message || 'Gateway verification failed',
        verifiedAt: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}

