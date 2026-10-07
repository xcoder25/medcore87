/**
 * Paystack client for MedCore OS reception (NGN).
 * - Public key only on the client (inline transfer / USSD when needed).
 * - Secret key stays on the server (verify, terminal charge).
 * - Never collect card numbers or PINs in the hospital app.
 */

export type PaystackChannel = 'card' | 'bank' | 'ussd' | 'bank_transfer' | 'qr' | 'mobile_money';

export type DigitalPayMethod = 'card_terminal' | 'transfer';

export type PaystackSuccess = {
  reference: string;
  trans?: string;
  status?: string;
  message?: string;
  transaction?: string;
  trxref?: string;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';

/**
 * Public key — env only (NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY).
 * Never from localStorage / admin form (avoids key drift and leaks).
 */
export function getPaystackPublicKey(): string {
  const fromEnv =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PAYSTACK_KEY) ||
    '';
  return String(fromEnv || '').trim();
}

/** @deprecated Keys must come from env — no-op kept for call-site compatibility */
export function setPaystackPublicKeyLocal(_key: string) {
  if (typeof console !== 'undefined') {
    console.warn('[Paystack] Public key must be set via NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY env, not localStorage');
  }
}

export function hasPaystackKey(): boolean {
  return Boolean(getPaystackPublicKey());
}

/**
 * Terminal device id:
 * 1) NEXT_PUBLIC_PAYSTACK_TERMINAL_ID (preferred)
 * 2) Front desk POS terminal field (device id only — not a secret)
 */
export function getPaystackTerminalId(): string {
  const fromEnv =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PAYSTACK_TERMINAL_ID) ||
    (typeof process !== 'undefined' && process.env.PAYSTACK_TERMINAL_ID) ||
    '';
  if (String(fromEnv || '').trim()) return String(fromEnv).trim();
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('medcore_os_front_desk_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.posTerminalId?.trim()) return String(s.posTerminalId).trim();
      if (s.paystackTerminalId?.trim()) return String(s.paystackTerminalId).trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

export function loadPaystackScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.PaystackPop) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      if (window.PaystackPop) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(s);
  });
}

export function makePaystackReference(facilityCode = 'MC'): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${facilityCode}-${t}-${r}`;
}

export type OpenPaystackOpts = {
  email: string;
  amountNgn: number;
  reference: string;
  channels?: PaystackChannel[];
  label?: string;
  metadata?: Record<string, string>;
  onSuccess: (res: PaystackSuccess) => void;
  onClose?: () => void;
};

/** Inline popup — Transfer / USSD only (never card on hospital PC) */
export async function openPaystackCheckout(opts: OpenPaystackOpts): Promise<void> {
  const key = getPaystackPublicKey();
  if (!key) throw new Error('Paystack public key missing');
  await loadPaystackScript();
  if (!window.PaystackPop) throw new Error('Paystack not loaded');
  // Strip card from channels — card goes via Terminal only
  const channels = (opts.channels || ['bank_transfer', 'ussd', 'bank']).filter((c) => c !== 'card');
  const handler = window.PaystackPop.setup({
    key,
    email: opts.email,
    amount: Math.round(opts.amountNgn * 100),
    currency: 'NGN',
    ref: opts.reference,
    channels: channels.length ? channels : ['bank_transfer', 'ussd', 'bank'],
    label: opts.label,
    metadata: opts.metadata,
    callback: (response: PaystackSuccess) => opts.onSuccess(response),
    onClose: () => opts.onClose?.(),
  });
  handler.openIframe();
}

/** Server verify — required before marking PAID */
export async function verifyPaystackPayment(reference: string): Promise<{
  verified: boolean;
  amountNgn?: number;
  channel?: string;
  reference?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) return { verified: false, error: data?.error || 'Verify failed' };
    return {
      verified: Boolean(data.verified),
      amountNgn: data.amountNgn,
      channel: data.channel,
      reference: data.reference || reference,
      error: data.verified ? undefined : 'Payment not successful yet',
    };
  } catch (e: any) {
    return { verified: false, error: e?.message || 'Network error' };
  }
}

/** Charge Paystack Terminal — card/PIN only on the physical device */
export async function chargePaystackTerminal(opts: {
  amountNgn: number;
  email: string;
  reference: string;
  deviceId?: string;
  metadata?: Record<string, string>;
}): Promise<{ ok: boolean; displayText?: string; error?: string; data?: unknown }> {
  const deviceId = opts.deviceId || getPaystackTerminalId();
  try {
    const res = await fetch('/api/paystack/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountNgn: opts.amountNgn,
        email: opts.email,
        reference: opts.reference,
        deviceId,
        metadata: opts.metadata,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error || 'Terminal charge failed', data };
    return {
      ok: true,
      displayText: data.display_text || 'Ask patient to complete payment on the terminal',
      data: data.data,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export function transferExpiryMs(minutes = 30): number {
  return Date.now() + minutes * 60 * 1000;
}

export function formatCountdown(expiresAt: number): string {
  const ms = Math.max(0, expiresAt - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
