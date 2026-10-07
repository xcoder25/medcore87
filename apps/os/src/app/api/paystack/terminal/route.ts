import { NextRequest, NextResponse } from 'next/server';
import { paystackFetch, getPaystackSecretKey } from '../../../../lib/paystackServer';

export const runtime = 'nodejs';

/**
 * Charge Paystack Terminal — patient enters card/PIN on the physical device only.
 * Body: { amountNgn, email, reference, deviceId, metadata? }
 */
export async function POST(req: NextRequest) {
  if (!getPaystackSecretKey()) {
    return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY not configured on server' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const amountNgn = Number(body.amountNgn);
  const email = String(body.email || '').trim();
  const reference = String(body.reference || '').trim();
  const deviceId = String(body.deviceId || body.terminalId || '').trim();
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  if (!amountNgn || amountNgn < 1) {
    return NextResponse.json({ error: 'amountNgn required' }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }
  if (!deviceId) {
    return NextResponse.json(
      { error: 'Paystack Terminal device ID required (Front Desk settings → POS Terminal ID)' },
      { status: 400 }
    );
  }
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }

  try {
    // Paystack charge via POS terminal device
    const { ok, data, status } = await paystackFetch('/charge', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: Math.round(amountNgn * 100),
        currency: 'NGN',
        reference,
        device_id: deviceId,
        metadata: {
          ...metadata,
          medcore_channel: 'paystack_terminal',
          no_card_on_hospital_pc: true,
        },
      }),
    });
    if (!ok) {
      return NextResponse.json(
        { error: data?.message || 'Terminal charge failed', paystack: data },
        { status: status || 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      reference,
      status: data?.data?.status || data?.status,
      display_text: data?.data?.display_text || data?.message || 'Complete payment on the terminal',
      data: data?.data,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Terminal request failed' }, { status: 500 });
  }
}
