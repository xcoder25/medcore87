/**
 * External gateway adapters — env-driven; safe pilot fallbacks when keys missing.
 * Secrets belong on server/hub; browser only uses publishable keys where allowed.
 */

export type GatewayMode = 'pilot' | 'live';

function env(name: string): string {
  if (typeof process === 'undefined') return '';
  return (process.env[name] || process.env[`NEXT_PUBLIC_${name.replace(/^NEXT_PUBLIC_/, '')}`] || '') as string;
}

// ── NIN (licensed aggregator or NIMC path) ──────────────────────────────────

export async function verifyNinLive(nin: string): Promise<{
  ok: boolean;
  mode: GatewayMode;
  message: string;
  data?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dob?: string;
    sex?: string;
    phone?: string;
    photoUrl?: string;
  };
}> {
  const digits = nin.replace(/\D/g, '');
  if (digits.length < 11) {
    return { ok: false, mode: 'pilot', message: 'NIN must be 11 digits' };
  }

  const base = env('NEXT_PUBLIC_NIN_GATEWAY_URL') || env('NIN_GATEWAY_URL');
  const key = env('NEXT_PUBLIC_NIN_GATEWAY_KEY') || env('NIN_GATEWAY_KEY');

  if (base && key) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ nin: digits }),
      });
      if (!res.ok) {
        return { ok: false, mode: 'live', message: `NIN gateway HTTP ${res.status}` };
      }
      const json = (await res.json()) as Record<string, unknown>;
      const entity = (json.data || json.entity || json) as Record<string, unknown>;
      return {
        ok: true,
        mode: 'live',
        message: 'NIN verified via licensed gateway',
        data: {
          firstName: String(entity.firstname || entity.firstName || entity.first_name || ''),
          lastName: String(entity.surname || entity.lastname || entity.lastName || entity.last_name || ''),
          middleName: String(entity.middlename || entity.middleName || ''),
          dob: String(entity.date_of_birth || entity.dob || ''),
          sex: String(entity.gender || entity.sex || ''),
          phone: String(entity.phone || entity.mobile || ''),
          photoUrl: String(entity.photo || entity.image || ''),
        },
      };
    } catch (e) {
      return {
        ok: false,
        mode: 'live',
        message: `NIN gateway error: ${(e as Error).message}`,
      };
    }
  }

  // Pilot directory (same as receptionConstants)
  const { lookupNin } = await import('../receptionConstants');
  const hit = lookupNin(digits);
  if (hit) {
    return {
      ok: true,
      mode: 'pilot',
      message: 'Pilot NIN match (set NIN_GATEWAY_URL for live)',
      data: {
        firstName: hit.firstName,
        lastName: hit.lastName,
        middleName: hit.middleName,
        dob: hit.dob,
        sex: hit.sex,
        phone: hit.phone,
      },
    };
  }
  return {
    ok: false,
    mode: 'pilot',
    message: 'No pilot match — configure licensed NIN gateway for production',
  };
}

// ── NHIA / HMO eligibility ──────────────────────────────────────────────────

export async function verifyInsuranceLive(
  providerId: string,
  memberId: string
): Promise<{
  ok: boolean;
  mode: GatewayMode;
  status: string;
  message: string;
  plan?: string;
  expiry?: string;
}> {
  if (!providerId || providerId === 'NONE') {
    return { ok: true, mode: 'pilot', status: 'self_pay', message: 'Self-pay' };
  }

  const base = env('NEXT_PUBLIC_NHIA_GATEWAY_URL') || env('NHIA_GATEWAY_URL');
  const key = env('NEXT_PUBLIC_NHIA_GATEWAY_KEY') || env('NHIA_GATEWAY_KEY');

  if (base && key) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ providerId, memberId }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      return {
        ok: !!json.ok || res.ok,
        mode: 'live',
        status: String(json.status || 'unknown'),
        message: String(json.message || 'Eligibility checked'),
        plan: json.plan ? String(json.plan) : undefined,
        expiry: json.expiry ? String(json.expiry) : undefined,
      };
    } catch (e) {
      return {
        ok: false,
        mode: 'live',
        status: 'error',
        message: (e as Error).message,
      };
    }
  }

  const { verifyInsurance } = await import('../receptionConstants');
  const r = verifyInsurance(providerId, memberId);
  return {
    ok: r.ok,
    mode: 'pilot',
    status: r.status,
    message: r.message + ' (pilot)',
    plan: r.plan,
    expiry: r.expiry,
  };
}

// ── Paystack (card / transfer) ──────────────────────────────────────────────

export async function initPaystackPayment(input: {
  amountNgn: number;
  email: string;
  reference?: string;
  metadata?: Record<string, string>;
}): Promise<{
  ok: boolean;
  mode: GatewayMode;
  message: string;
  authorizationUrl?: string;
  reference?: string;
}> {
  const publicKey = env('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY');
  const secret = env('PAYSTACK_SECRET_KEY'); // server-only ideally
  const amountKobo = Math.round(input.amountNgn * 100);
  const reference = input.reference || `MC-${Date.now().toString(36).toUpperCase()}`;

  if (!publicKey) {
    return {
      ok: true,
      mode: 'pilot',
      message: 'Pilot POS — recorded locally (set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY for live)',
      reference,
    };
  }

  // Browser: return data for Paystack Popup / Inline
  if (!secret) {
    return {
      ok: true,
      mode: 'live',
      message: 'Use Paystack Inline with public key',
      reference,
      authorizationUrl: undefined,
    };
  }

  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email || 'patient@medcore.ng',
        amount: amountKobo,
        reference,
        metadata: input.metadata,
        currency: 'NGN',
      }),
    });
    const json = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (!json.status) {
      return { ok: false, mode: 'live', message: json.message || 'Paystack init failed' };
    }
    return {
      ok: true,
      mode: 'live',
      message: 'Payment initialized',
      authorizationUrl: json.data?.authorization_url,
      reference: json.data?.reference || reference,
    };
  } catch (e) {
    return { ok: false, mode: 'live', message: (e as Error).message };
  }
}

// ── SMS / WhatsApp alerts ───────────────────────────────────────────────────

export async function sendPatientAlert(input: {
  phone: string;
  message: string;
  channel?: 'sms' | 'whatsapp';
}): Promise<{ ok: boolean; mode: GatewayMode; message: string }> {
  const phone = input.phone.replace(/\s/g, '');
  if (!phone || phone.length < 10) {
    return { ok: false, mode: 'pilot', message: 'Invalid phone' };
  }

  const base = env('NEXT_PUBLIC_SMS_GATEWAY_URL') || env('SMS_GATEWAY_URL');
  const key = env('NEXT_PUBLIC_SMS_GATEWAY_KEY') || env('SMS_GATEWAY_KEY');

  if (base && key) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          to: phone,
          message: input.message,
          channel: input.channel || 'sms',
        }),
      });
      if (!res.ok) {
        return { ok: false, mode: 'live', message: `SMS gateway HTTP ${res.status}` };
      }
      return { ok: true, mode: 'live', message: 'Alert queued' };
    } catch (e) {
      return { ok: false, mode: 'live', message: (e as Error).message };
    }
  }

  // Pilot: log to local outbox of alerts
  if (typeof window !== 'undefined') {
    try {
      const keyA = 'medcore_os_alert_outbox';
      const prev = JSON.parse(localStorage.getItem(keyA) || '[]');
      prev.unshift({
        id: `AL-${Date.now()}`,
        ...input,
        phone,
        at: new Date().toISOString(),
        status: 'pilot_logged',
      });
      localStorage.setItem(keyA, JSON.stringify(prev.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('medcore-alerts', { detail: prev }));
    } catch {
      /* ignore */
    }
  }
  return {
    ok: true,
    mode: 'pilot',
    message: 'Alert logged locally (configure SMS_GATEWAY_URL for live SMS)',
  };
}
