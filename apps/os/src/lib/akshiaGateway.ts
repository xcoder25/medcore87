/**
 * AKSHIA (Akwa Ibom State Health Insurance Agency) gateway.
 * Live when AKSHIA_API_URL + AKSHIA_API_KEY are set on server; otherwise deterministic offline simulation for pilot.
 */
export type AkshiaMemberStatus = 'active' | 'inactive' | 'suspended' | 'unknown' | 'not_found';

export interface AkshiaEligibility {
  ok: boolean;
  mode: 'live' | 'simulated';
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
  category: 'consult' | 'lab' | 'rx' | 'procedure' | 'admission';
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
  mode: 'live' | 'simulated';
  authCode: string;
  status: 'approved' | 'pending' | 'denied';
  approvedAmountNgn: number;
  message: string;
  expiresAt: string;
}

const TARIFF_V = 'AKSHIA-2026-Q1';

/** Core AKSHIA-style tariff (pilot table — replace with agency feed when live) */
export const AKSHIA_TARIFF: AkshiaTariffItem[] = [
  { code: 'OPD-CONSULT', name: 'OPD consultation', category: 'consult', amountNgn: 1500, requiresPreAuth: false },
  { code: 'LAB-FBC', name: 'Full blood count', category: 'lab', amountNgn: 2500, requiresPreAuth: false },
  { code: 'LAB-MP', name: 'Malaria parasite', category: 'lab', amountNgn: 1500, requiresPreAuth: false },
  { code: 'RX-EML', name: 'EML medicine (per line)', category: 'rx', amountNgn: 2000, requiresPreAuth: false },
  { code: 'PROC-MINOR', name: 'Minor procedure', category: 'procedure', amountNgn: 15000, requiresPreAuth: true },
  { code: 'ADM-WARD', name: 'Ward day (general)', category: 'admission', amountNgn: 8000, requiresPreAuth: true },
  { code: 'ANC-VISIT', name: 'ANC visit', category: 'consult', amountNgn: 1000, requiresPreAuth: false },
  { code: 'IMM-NPI', name: 'NPI immunization dose', category: 'procedure', amountNgn: 0, requiresPreAuth: false },
];

function storeKey(fid: string) {
  return `medcore_akshia_preauth_${fid}`;
}

export function listTariff(): AkshiaTariffItem[] {
  return [...AKSHIA_TARIFF];
}

export function estimateCoveredAmount(codes: string[]): { total: number; needsPreAuth: boolean; lines: AkshiaTariffItem[] } {
  const lines = codes
    .map((c) => AKSHIA_TARIFF.find((t) => t.code === c || t.name.toLowerCase().includes(c.toLowerCase())))
    .filter(Boolean) as AkshiaTariffItem[];
  const total = lines.reduce((s, l) => s + l.amountNgn, 0);
  const needsPreAuth = lines.some((l) => l.requiresPreAuth);
  return { total, needsPreAuth, lines };
}

export async function checkAkshiaEligibility(memberId: string, facilityId?: string): Promise<AkshiaEligibility> {
  const id = String(memberId || '').trim().toUpperCase();
  const checkedAt = new Date().toISOString();
  if (!id) {
    return {
      ok: false,
      mode: 'simulated',
      memberId: '',
      status: 'not_found',
      planName: '',
      category: 'unknown',
      copayPercent: 100,
      capitationRemainingNgn: null,
      preAuthRequired: false,
      message: 'Enter AKSHIA / state scheme member ID',
      tariffVersion: TARIFF_V,
      checkedAt,
    };
  }

  // Prefer server proxy when available
  try {
    const res = await fetch('/api/akshia/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: id, facilityId }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok || json?.status) return { ...json, mode: json.mode || 'live', checkedAt } as AkshiaEligibility;
    }
  } catch {
    /* offline simulation */
  }

  // Deterministic simulation for pilot (civil servants / vulnerable patterns)
  const civil = /CS|CIVIL|AKS-CS/i.test(id);
  const vuln = /VUL|VG|INDIGENT/i.test(id);
  const inactive = /X$|SUSP/i.test(id);
  if (inactive) {
    return {
      ok: false,
      mode: 'simulated',
      memberId: id,
      status: 'suspended',
      planName: 'AKSHIA Standard',
      category: civil ? 'civil_servant' : 'unknown',
      copayPercent: 100,
      capitationRemainingNgn: 0,
      preAuthRequired: true,
      message: 'Member suspended — collect cash or escalate to AKSHIA desk',
      tariffVersion: TARIFF_V,
      checkedAt,
    };
  }
  return {
    ok: true,
    mode: 'simulated',
    memberId: id,
    status: 'active',
    planName: civil ? 'AKSHIA Civil Service' : vuln ? 'AKSHIA Vulnerable Groups' : 'AKSHIA Informal',
    category: civil ? 'civil_servant' : vuln ? 'vulnerable' : 'informal',
    copayPercent: civil ? 10 : vuln ? 0 : 20,
    capitationRemainingNgn: civil ? 45000 : vuln ? 25000 : 15000,
    preAuthRequired: false,
    message: 'Eligible (pilot simulation). Wire AKSHIA_API_URL for live agency responses.',
    tariffVersion: TARIFF_V,
    checkedAt,
  };
}

export async function requestAkshiaPreAuth(req: AkshiaPreAuthRequest): Promise<AkshiaPreAuthResult> {
  try {
    const res = await fetch('/api/akshia/preauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.authCode) return { ...json, mode: json.mode || 'live' } as AkshiaPreAuthResult;
    }
  } catch {
    /* fall through */
  }

  const est = estimateCoveredAmount(req.serviceCodes);
  const authCode = `AKS-PA-${Date.now().toString(36).toUpperCase()}`;
  const row = {
    ok: true,
    mode: 'simulated' as const,
    authCode,
    status: est.total > 50000 ? ('pending' as const) : ('approved' as const),
    approvedAmountNgn: Math.min(req.estimatedAmountNgn || est.total, est.total || req.estimatedAmountNgn),
    message: est.total > 50000 ? 'Pending AKSHIA desk review (high value)' : 'Pre-auth approved (pilot simulation)',
    expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      const key = storeKey(req.facilityId);
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift({ ...row, ...req, savedAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 500)));
    } catch {
      /* ignore */
    }
  }
  return row;
}

export function computeCopay(eligible: AkshiaEligibility, grossNgn: number): { insurerNgn: number; patientNgn: number } {
  const pct = Math.min(100, Math.max(0, eligible.copayPercent));
  const patientNgn = Math.round((grossNgn * pct) / 100);
  return { insurerNgn: grossNgn - patientNgn, patientNgn };
}
