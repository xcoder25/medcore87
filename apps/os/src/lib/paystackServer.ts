/**
 * Server-only Paystack helpers. Secret key never reaches the browser.
 */
export function getPaystackSecretKey(): string {
  return (
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_SECRET ||
    ''
  ).trim();
}

export async function paystackFetch(path: string, init?: RequestInit) {
  const secret = getPaystackSecretKey();
  if (!secret) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured on the server');
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

export async function verifyPaystackReference(reference: string) {
  const { ok, data } = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
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
