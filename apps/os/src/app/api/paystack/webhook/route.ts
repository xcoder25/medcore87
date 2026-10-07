import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getPaystackSecretKey } from '../../../../lib/paystackServer';

export const runtime = 'nodejs';

/**
 * Paystack webhook — charge.success confirms PAID.
 * Client must still call /api/paystack/verify before marking local records paid
 * (webhook is the authoritative bank-side confirmation).
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
  let event: any = {};
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  // Acknowledge — durable paid state is applied client-side after verify
  // or can be extended to write Firestore payment ledger here.
  if (event?.event === 'charge.success') {
    console.log('[paystack webhook] charge.success', event?.data?.reference);
  }
  return NextResponse.json({ received: true });
}
