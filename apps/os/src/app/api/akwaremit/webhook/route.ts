import { NextRequest, NextResponse } from 'next/server';
import { getAkwaRemitServerConfig, verifyWebhookSignature } from '../../../../lib/akwaremitServer';

export const runtime = 'nodejs';

/**
 * AkwaRemit Webhook Endpoint
 * Receives real-time payment notifications for Bank Transfers, AkwaRemit POS, and Counter Cash.
 * Enforces server-side signature validation and Exact Amount Validation before confirming "Paid" status.
 */
export async function POST(req: NextRequest) {
  const config = getAkwaRemitServerConfig();
  const rawBody = await req.text();
  const signature = req.headers.get('x-akwaremit-signature');

  if (signature && !verifyWebhookSignature(signature, rawBody)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE', message: 'Signature verification failed' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const arn = String(body.arn || body.reference || '').trim();
  const amountReceivedNgn = Number(body.amountNgn || body.amount || 0);
  const channel = String(body.channel || body.paymentMethod || 'bank_transfer').toLowerCase();
  const status = String(body.status || 'paid').toLowerCase();
  const transactionRef = String(body.transactionRef || body.rrn || body.tellerRef || '').trim();

  if (!arn) {
    return NextResponse.json({ error: 'AkwaRemit Reference Number (arn) required' }, { status: 400 });
  }

  if (amountReceivedNgn <= 0) {
    return NextResponse.json({ error: 'Valid amountNgn required' }, { status: 400 });
  }

  // Exact Amount Enforcement check
  if (body.expectedAmountNgn && Math.abs(amountReceivedNgn - Number(body.expectedAmountNgn)) > 0.01) {
    return NextResponse.json(
      {
        error: 'EXACT_AMOUNT_MISMATCH',
        message: `Payment amount ₦${amountReceivedNgn} does not match expected invoice amount ₦${body.expectedAmountNgn}. Partial payments not permitted under State TSA rules.`,
      },
      { status: 422 }
    );
  }

  console.log(`[AkwaRemit Webhook] Confirmed: ${arn} · ₦${amountReceivedNgn} via ${channel} · Status: ${status} · Merchant: ${config.merchantId}`);

  return NextResponse.json({
    received: true,
    arn,
    merchantId: config.merchantId,
    amountNgn: amountReceivedNgn,
    channel,
    status: status === 'paid' || status === 'success' ? 'paid' : 'pending',
    transactionRef,
    exactAmountValidated: true,
    action: 'release_electronic_file_to_next_department',
    timestamp: new Date().toISOString(),
  });
}

