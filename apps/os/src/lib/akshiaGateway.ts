/**
 * AKSHIA gateway — LIVE only via /api/akshia/* (server env AKSHIA_API_URL + AKSHIA_API_KEY).
 * No simulated eligibility or pre-auth.
 */
export type AkshiaMemberStatus = 'active' | 'inactive' | 'suspended' | 'unknown' | 'not_found';

export interface AkshiaEligibility {
  ok: boolean;
  mode: 'live' | 'error' | 'unconfigured';
  memberId: string;
  status: AkshiaMemberStatus;
  planName: string;
  category: 'civil_servant' | 'vulnerable' | 'informal' | 'dependant' | 'unknown';
  copayPercent: number;
  capitationRemainingNgn: number | null;
  preAuthRequired: boolean;
  message: string;
  tariffVersion: string;
  checkedAt: string;
}

export interface AkshiaTariffItem {
  code: string;
  name: string;
  category: 'consult' | 'lab' | 'rx' | 'procedure' | 'admission' | string;
  amountNgn: number;
  requiresPreAuth: boolean;
}

export interface AkshiaPreAuthRequest {
  facilityId: string;
  memberId: string;
  patientName: string;
  serviceCodes: string[];
  clinicalJustification: string;
  estimatedAmountNgn: number;
}

export interface AkshiaPreAuthResult {
  ok: boolean;
  mode: 'live' | 'error' | 'unconfigured';
  authCode: string;
  status: 'approved' | 'pending' | 'denied' | 'error';
  approvedAmountNgn: number;
  message: string;
  expiresAt: string;
}

let cachedTariff: AkshiaTariffItem[] = [];

export function listTariff(): AkshiaTariffItem[] {
  return [...cachedTariff];
}

export async function fetchAkshiaTariff(): Promise<{ ok: boolean; items: AkshiaTariffItem[]; message: string }> {
  try {
    const res = await fetch('/api/akshia/tariff', { method: 'GET', cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      cachedTariff = [];
      return {
        ok: false,
        items: [],
        message: json.message || 'AKSHIA tariff API not available. Configure AKSHIA_API_URL + AKSHIA_API_KEY.',
      };
    }
    const items = Array.isArray(json.items) ? json.items : Array.isArray(json.tariff) ? json.tariff : [];
    cachedTariff = items.map((t: any) => ({
      code: String(t.code || ''),
      name: String(t.name || t.description || ''),
      category: String(t.category || 'consult'),
      amountNgn: Number(t.amountNgn ?? t.amount ?? 0),
      requiresPreAuth: Boolean(t.requiresPreAuth ?? t.preAuth),
    }));
    return { ok: true, items: cachedTariff, message: `Loaded ${cachedTariff.length} tariff lines from AKSHIA` };
  } catch (e) {
    cachedTariff = [];
    return { ok: false, items: [], message: (e as Error).message || 'Tariff fetch failed' };
  }
}

export function estimateCoveredAmount(codes: string[]): { total: number; needsPreAuth: boolean; lines: AkshiaTariffItem[] } {
  const lines = codes
    .map((c) => cachedTariff.find((t) => t.code === c || t.name.toLowerCase().includes(c.toLowerCase())))
    .filter(Boolean) as AkshiaTariffItem[];
  const total = lines.reduce((s, l) => s + l.amountNgn, 0);
  const needsPreAuth = lines.some((l) => l.requiresPreAuth);
  return { total, needsPreAuth, lines };
}

export async function checkAkshiaEligibility(memberId: string, facilityId?: string): Promise<AkshiaEligibility> {
  const id = String(memberId || '').trim().toUpperCase();
  const checkedAt = new Date().toISOString();
  const empty = (message: string, mode: AkshiaEligibility['mode'] = 'unconfigured'): AkshiaEligibility => ({
    ok: false,
    mode,
    memberId: id,
    status: 'unknown',
    planName: '',
    category: 'unknown',
    copayPercent: 100,
    capitationRemainingNgn: null,
    preAuthRequired: true,
    message,
    tariffVersion: '',
    checkedAt,
  });

  if (!id) return empty('Enter AKSHIA member ID');

  try {
    const res = await fetch('/api/akshia/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: id, facilityId }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 503 || json.mode === 'unconfigured') {
      return empty(
        json.message || 'AKSHIA is not configured. Set AKSHIA_API_URL and AKSHIA_API_KEY on the server, then redeploy.',
        'unconfigured'
      );
    }
    if (!res.ok) {
      return empty(json.message || `AKSHIA eligibility failed (HTTP ${res.status})`, 'error');
    }
    return {
      ok: Boolean(json.ok ?? json.status === 'active'),
      mode: 'live',
      memberId: String(json.memberId || id),
      status: (json.status as AkshiaMemberStatus) || 'unknown',
      planName: String(json.planName || json.plan || ''),
      category: json.category || 'unknown',
      copayPercent: Number(json.copayPercent ?? json.copay ?? 0),
      capitationRemainingNgn:
        json.capitationRemainingNgn != null ? Number(json.capitationRemainingNgn) : null,
      preAuthRequired: Boolean(json.preAuthRequired),
      message: String(json.message || 'Live AKSHIA response'),
      tariffVersion: String(json.tariffVersion || ''),
      checkedAt,
    };
  } catch (e) {
    return empty(`AKSHIA network error: ${(e as Error).message}`, 'error');
  }
}

export async function requestAkshiaPreAuth(req: AkshiaPreAuthRequest): Promise<AkshiaPreAuthResult> {
  const fail = (message: string, mode: AkshiaPreAuthResult['mode'] = 'unconfigured'): AkshiaPreAuthResult => ({
    ok: false,
    mode,
    authCode: '',
    status: 'error',
    approvedAmountNgn: 0,
    message,
    expiresAt: '',
  });

  try {
    const res = await fetch('/api/akshia/preauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 503 || json.mode === 'unconfigured') {
      return fail(
        json.message || 'AKSHIA pre-auth not configured. Set AKSHIA_API_URL and AKSHIA_API_KEY.',
        'unconfigured'
      );
    }
    if (!res.ok) {
      return fail(json.message || `Pre-auth failed (HTTP ${res.status})`, 'error');
    }
    return {
      ok: Boolean(json.ok ?? json.status === 'approved' || json.status === 'pending'),
      mode: 'live',
      authCode: String(json.authCode || json.authorizationCode || ''),
      status: (json.status as AkshiaPreAuthResult['status']) || 'pending',
      approvedAmountNgn: Number(json.approvedAmountNgn ?? json.approvedAmount ?? 0),
      message: String(json.message || 'Live AKSHIA pre-auth'),
      expiresAt: String(json.expiresAt || ''),
    };
  } catch (e) {
    return fail(`AKSHIA network error: ${(e as Error).message}`, 'error');
  }
}

export function computeCopay(eligible: AkshiaEligibility, grossNgn: number): { insurerNgn: number; patientNgn: number } {
  if (!eligible.ok) return { insurerNgn: 0, patientNgn: grossNgn };
  const pct = Math.min(100, Math.max(0, eligible.copayPercent));
  const patientNgn = Math.round((grossNgn * pct) / 100);
  return { insurerNgn: grossNgn - patientNgn, patientNgn };
}
