import { NextResponse } from 'next/server';
import { testAkwaRemitServerGateway } from '../../../../lib/akwaremitServer';

export const runtime = 'nodejs';

/**
 * Execute server-side ping to AkwaRemit State Gateway.
 * Uses the secret keys securely stored on the server.
 */
export async function POST() {
  try {
    const result = await testAkwaRemitServerGateway();
    return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 503 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'AkwaRemit gateway test failed' },
      { status: 502 }
    );
  }
}

