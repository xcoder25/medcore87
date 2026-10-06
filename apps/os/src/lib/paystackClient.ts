/**
 * Paystack client for MedCore OS reception payments (NGN).
 * Public key: NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY or admin settings.
 * Inline popup runs under our branded shell; callbacks wire receipts + billing.
 */

export type PaystackChannel = 'card' | 'bank' | 'ussd' | 'bank_transfer' | 'qr' | 'mobile_money';

export type PaystackSuccess = {
  reference: string;
  trans?: string;
  transaction?: string;
  status: string;
  message?: string;
  amount?: number; // kobo
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';
let scriptLoading: Promise<void> | null = null;

export function getPaystackPublicKey(): string {
  try {
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
      return String(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY).trim();
    }
  } catch {
    /* ignore */
  }
  try {
    // dynamic import avoided for sync key read — settings already local
    const raw = localStorage.getItem('medcore_os_admin_settings_v1:' + (localStorage.getItem('medcore_active_facility_id') || ''));
    // fall through to full scan below
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (!k.startsWith('medcore_os_admin_settings_v1')) continue;
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      if (s.paystackPublicKey?.trim()) return String(s.paystackPublicKey).trim();
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem('medcore_os_paystack_public_key');
    if (raw?.trim()) return raw.trim();
  } catch {
    /* ignore */
  }
  return '';
}

export function setPaystackPublicKeyLocal(key: string) {
  try {
    localStorage.setItem('medcore_os_paystack_public_key', key.trim());
  } catch {
    /* ignore */
  }
}

export function hasPaystackKey(): boolean {
  return Boolean(getPaystackPublicKey());
}

export function loadPaystackScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.PaystackPop) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
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
    s.onerror = () => {
      scriptLoading = null;
      reject(new Error('Failed to load Paystack'));
    };
    document.body.appendChild(s);
  });
  return scriptLoading;
}

/** MedCore payment reference */
export function makePaystackReference(facilityCode = 'MC'): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${facilityCode}-${t}-${r}`;
}

export type OpenPaystackOpts = {
  email: string;
  amountNgn: number;
  reference: string;
  metadata?: Record<string, string | number | boolean>;
  channels?: PaystackChannel[];
  label?: string;
  onSuccess: (res: PaystackSuccess) => void;
  onClose?: () => void;
};

/**
 * Opens Paystack Inline (iframe). Call from within our branded shell so the
 * hospital UI frames the Paystack content.
 */
export async function openPaystackCheckout(opts: OpenPaystackOpts): Promise<void> {
  const key = getPaystackPublicKey();
  if (!key) throw new Error('Paystack public key not set');
  if (opts.amountNgn < 1) throw new Error('Amount must be at least ₦1');

  await loadPaystackScript();
  if (!window.PaystackPop) throw new Error('Paystack script not available');

  const amountKobo = Math.round(opts.amountNgn * 100);
  const handler = window.PaystackPop.setup({
    key,
    email: opts.email || 'patient@medcore.ng',
    amount: amountKobo,
    currency: 'NGN',
    ref: opts.reference,
    label: opts.label || 'MedCore Hospital',
    channels: opts.channels || ['card', 'bank', 'ussd', 'bank_transfer'],
    metadata: {
      custom_fields: [
        {
          display_name: 'Hospital',
          variable_name: 'hospital',
          value: String(opts.metadata?.facilityName || 'MedCore'),
        },
        {
          display_name: 'Patient',
          variable_name: 'patient',
          value: String(opts.metadata?.patientName || ''),
        },
        {
          display_name: 'Hospital No',
          variable_name: 'hospital_number',
          value: String(opts.metadata?.hospitalNumber || ''),
        },
      ],
      ...opts.metadata,
    },
    callback: (response: PaystackSuccess) => {
      opts.onSuccess(response);
    },
    onClose: () => {
      opts.onClose?.();
    },
  });
  handler.openIframe();
}

/** Bank-transfer style countdown helper (Paystack windows are typically ~30 min). */
export function transferExpiryMs(minutes = 30): number {
  return Date.now() + minutes * 60 * 1000;
}

export function formatCountdown(expiresAt: number): string {
  const left = Math.max(0, expiresAt - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
