/**
 * NAFDAC Anti-Counterfeit & GS1 GTIN-14 Batch Verification Engine (`apps/os`).
 * Validates incoming pharmacy stock before formulary admission:
 *  - NAFDAC registration number format (e.g., A4-4821, 04-9102, B4-1189L)
 *  - Mathematical GS1 GTIN / EAN-13 / GTIN-14 check digit verification
 *  - Active NAFDAC recall & counterfeit batch prefix watchlist
 *  - Batch expiry & short-dated quarantine check
 */

export interface NafdacVerificationResult {
  valid: boolean;
  riskLevel: 'verified' | 'caution' | 'blocked_counterfeit' | 'blocked_expired';
  nafdacRegNo: string;
  gtinValid: boolean | null;
  batchNo: string;
  drugName: string;
  expiryStatus: 'ok' | 'short_dated_90d' | 'expired';
  recallAlert?: string;
  reasons: string[];
}

const NAFDAC_RECALL_WATCHLIST: Array<{
  pattern: RegExp;
  bulletin: string;
}> = [
  {
    pattern: /^(?:FAKE|CF-|RECALLED|MYPIKIN|PX-99)/i,
    bulletin: 'NAFDAC Public Alert: Batch prefix matches blacklisted/recalled substandard product.',
  },
  {
    pattern: /^202[0-3]-BAD/i,
    bulletin: 'NAFDAC Safety Recall Notice: Contaminated batch flagged for reverse logistics quarantine.',
  },
];

const BLACKLISTED_REG_NOS = new Set(['00-0000', 'A0-0000', 'FAKE-01']);

export function verifyGs1CheckDigit(code: string): boolean {
  const digits = String(code || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;

  const checkDigit = Number.parseInt(digits[digits.length - 1], 10);
  const body = digits.slice(0, -1);
  let sum = 0;
  // GS1 weights alternate 3, 1 starting from rightmost body digit
  for (let i = 0; i < body.length; i += 1) {
    const posFromRight = body.length - 1 - i;
    const digit = Number.parseInt(body[i], 10);
    const weight = posFromRight % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

export function verifyNafdacBatch(input: {
  drugName: string;
  nafdacRegNo: string;
  batchNo: string;
  expiry?: string;
  gtin14?: string;
  nowMs?: number;
}): NafdacVerificationResult {
  const nowMs = input.nowMs ?? Date.now();
  const reg = String(input.nafdacRegNo || '').trim().toUpperCase();
  const batchNo = String(input.batchNo || '').trim().toUpperCase();
  const drugName = String(input.drugName || '').trim() || 'Unspecified Medicine';
  const gtin = String(input.gtin14 || '').trim();

  const reasons: string[] = [];
  let blockedCounterfeit = false;
  let blockedExpired = false;
  let caution = false;
  let recallAlert: string | undefined;

  if (!/^(?:[A-Z]\d|\d{2})-\d{4,6}[A-Z]?$/.test(reg) || BLACKLISTED_REG_NOS.has(reg)) {
    blockedCounterfeit = true;
    reasons.push(`Invalid or blacklisted NAFDAC registration format "${reg || 'MISSING'}" (expected e.g. A4-4821 or 04-9102).`);
  }

  for (const w of NAFDAC_RECALL_WATCHLIST) {
    if (w.pattern.test(batchNo) || w.pattern.test(reg)) {
      blockedCounterfeit = true;
      recallAlert = w.bulletin;
      reasons.push(w.bulletin);
    }
  }

  let gtinValid: boolean | null = null;
  if (gtin) {
    gtinValid = verifyGs1CheckDigit(gtin);
    if (!gtinValid) {
      blockedCounterfeit = true;
      reasons.push(`GS1 barcode / GTIN "${gtin}" failed mathematical check-digit validation — suspect counterfeit packaging.`);
    }
  }

  let expiryStatus: NafdacVerificationResult['expiryStatus'] = 'ok';
  if (input.expiry) {
    const expMs = Date.parse(input.expiry);
    if (Number.isFinite(expMs)) {
      const days = Math.ceil((expMs - nowMs) / 86_400_000);
      if (days <= 0) {
        expiryStatus = 'expired';
        blockedExpired = true;
        reasons.push(`Batch expired ${Math.abs(days)} day(s) ago (${input.expiry}) — quarantine immediately.`);
      } else if (days <= 90) {
        expiryStatus = 'short_dated_90d';
        caution = true;
        reasons.push(`Short-dated stock (${days} days until ${input.expiry}) — accept only under strict FEFO priority.`);
      }
    }
  }

  const riskLevel: NafdacVerificationResult['riskLevel'] = blockedCounterfeit
    ? 'blocked_counterfeit'
    : blockedExpired
      ? 'blocked_expired'
      : caution
        ? 'caution'
        : 'verified';

  if (reasons.length === 0) {
    reasons.push(`NAFDAC Reg ${reg} & batch ${batchNo || 'N/A'} passed authenticity and shelf-life verification.`);
  }

  return {
    valid: !blockedCounterfeit && !blockedExpired,
    riskLevel,
    nafdacRegNo: reg,
    gtinValid,
    batchNo,
    drugName,
    expiryStatus,
    recallAlert,
    reasons,
  };
}
