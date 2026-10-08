import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getPaystackSecretKey } from '../../../../lib/paystackServer';

export const runtime = 'nodejs';

/**
 * Paystack webhook — charge.success.
 * Returns structured payload so ops can confirm; clients should still /verify
 * then call applyPaystackSuccess on the POS desk (or Accounting).
 */
export async function POST(req: NextRequest) {
  const secret = getPaystackSecretKey();
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';
  const hash = createHmac('sha512', secret).update(raw).digest('hex');
  if (signature && hash !== signature) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  let event: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      channel?: string;
      paid_at?: string;
      metadata?: Record<string, string>;
      customer?: { email?: string };
    };
  } = {};
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  if (event?.event === 'charge.success') {
    const d = event.data || {};
    const amountNgn = typeof d.amount === 'number' ? d.amount / 100 : 0;
    console.log('[paystack webhook] charge.success', d.reference, amountNgn, d.channel);
    return NextResponse.json({
      received: true,
      event: 'charge.success',
      reference: d.reference,
      amountNgn,
      channel: d.channel,
      paidAt: d.paid_at,
      metadata: d.metadata || {},
      // Client: POST /api/paystack/verify then applyPaystackSuccess(...)
      action: 'verify_and_apply',
    });
  }

  return NextResponse.json({ received: true, event: event?.event || 'unknown' });
}
