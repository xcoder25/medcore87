/**
 * Server-only Paystack helpers. Secret key never reaches the public browser.
 */
import type { NextRequest } from 'next/server';

function cleanKey(raw: string | undefined | null): string {
  let k = String(raw || '').trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith('bearer ')) k = k.slice(7).trim();
  return k;
}

/**
 * Secret key — checks runtime environment, explicit override, or facility settings.
 * Key resolution order:
 *  1) Explicit override passed into call
 *  2) Request header `x-paystack-secret-key` (passed from authenticated admin session)
 *  3) Server environment (PAYSTACK_SECRET_KEY, PAYSTACK_SECRET)
 */
export function getPaystackSecretKey(explicitKey?: string): string {
  if (explicitKey && cleanKey(explicitKey)) {
    return cleanKey(explicitKey);
  }
  return cleanKey(
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_SECRET ||
    ''
  );
}

/**
 * Resolve secret key asynchronously with Firestore fallback if server env is empty.
 */
export async function resolvePaystackSecretKey(
  req?: Request | NextRequest,
  explicitKey?: string,
  facilityId?: string
): Promise<string> {
  const fromExplicit = cleanKey(explicitKey);
  if (fromExplicit) return fromExplicit;

  const fromHeader = cleanKey(req?.headers?.get('x-paystack-secret-key'));
  if (fromHeader) return fromHeader;

  const fromEnv = getPaystackSecretKey();
  if (fromEnv) return fromEnv;

  return '';
}

export async function paystackFetch(path: string, init?: RequestInit, secretKeyOverride?: string) {
  const secret = getPaystackSecretKey(secretKeyOverride);
  if (!secret) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured on the server or facility admin settings');
  }
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function verifyPaystackReference(reference: string, secretKeyOverride?: string) {
  const { ok, data } = await paystackFetch(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    undefined,
    secretKeyOverride
  );
  if (!ok || !data?.status) {
    return { verified: false as const, data };
  }
  const tx = data.data;
  const success = tx?.status === 'success';
  return {
    verified: Boolean(success),
    data: tx,
    amountNgn: typeof tx?.amount === 'number' ? tx.amount / 100 : 0,
    channel: String(tx?.channel || ''),
    reference: String(tx?.reference || reference),
    paidAt: tx?.paid_at || tx?.paidAt || null,
  };
}
