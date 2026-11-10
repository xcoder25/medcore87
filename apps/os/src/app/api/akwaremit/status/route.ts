import { NextResponse } from 'next/server';
import { getAkwaRemitClientSafeStatus } from '../../../../lib/akwaremitServer';

export const runtime = 'nodejs';

/**
 * Returns safe server-side gateway status.
 * NEVER exposes raw secret keys to the browser.
 */
export async function GET() {
  try {
    const status = getAkwaRemitClientSafeStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to retrieve gateway status' },
      { status: 500 }
    );
  }
}

