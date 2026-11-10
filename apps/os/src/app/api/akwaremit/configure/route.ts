import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * ARCHITECTURAL POLICY:
 * Keys reside ONLY on the server environment (e.g. process.env / deployment secret manager).
 * HTTP endpoints cannot accept or alter server gateway keys.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'SECURITY_POLICY_ENFORCED',
      message: 'Gateway keys are strictly server-side environment variables and cannot be modified via client requests.',
    },
    { status: 403 }
  );
}
