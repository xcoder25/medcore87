import { NextRequest, NextResponse } from 'next/server';
import { paystackFetch, getPaystackSecretKey } from '../../../../lib/paystackServer';

export const runtime = 'nodejs';

/**
 * Initialize Paystack transaction for Transfer / USSD only (no card on hospital PC).
 */
export async function POST(req: NextRequest) {
  if (!getPaystackSecretKey()) {
    return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY not configured on server' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const amountNgn = Number(body.amountNgn);
  const email = String(body.email || '').trim();
  const reference = String(body.reference || '').trim();
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const channels = Array.isArray(body.channels) && body.channels.length
    ? body.channels
    : ['bank_transfer', 'ussd', 'bank'];

  if (!amountNgn || amountNgn < 1) {
    return NextResponse.json({ error: 'amountNgn required' }, { status: 400 });
  }
  if (!email || !reference) {
    return NextResponse.json({ error: 'email and reference required' }, { status: 400 });
  }

  try {
    const { ok, data, status } = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: Math.round(amountNgn * 100),
        currency: 'NGN',
        reference,
        channels,
        metadata: {
          ...metadata,
          medcore_channel: 'paystack_transfer',
          no_card_on_hospital_pc: true,
        },
      }),
    });
    if (!ok) {
      return NextResponse.json(
        { error: data?.message || 'Initialize failed', paystack: data },
        { status: status || 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      authorization_url: data?.data?.authorization_url,
      access_code: data?.data?.access_code,
      reference: data?.data?.reference || reference,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Initialize failed' }, { status: 500 });
  }
}
