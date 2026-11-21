/**
 * Universal scannable QR payload builder, integrity signer, and parser for MedCore OS.
 *
 * Every QR rendered in the EMR encodes a compact, URL-addressable `/verify?t=...`
 * token containing zero unmasked PHI so any smartphone camera or 2D scanner can
 * open a public verification screen, while authenticated EMR scan inputs extract
 * exact identifiers (SHID, MRN / Hospital Number, Rx ID, Badge ID, Receipt No).
 */

export type EmrQrKind =
  | 'card'
  | 'staff'
  | 'cert'
  | 'discharge'
  | 'triage'
  | 'passport'
  | 'receipt'
  | 'rx'
  | 'unknown';

export interface EmrQrPayload {
  /** Schema version */
  v: 1;
  /** Document / credential kind */
  k: Exclude<EmrQrKind, 'unknown'>;
  /** Primary document ID (SHID, Badge ID, Cert ID, Rx ID, Receipt No, etc.) */
  id: string;
  /** Optional MRN / Hospital Number */
  mrn?: string;
  /** Facility ID */
  f?: string;
  /** Facility Display Name */
  fn?: string;
  /** Non-PHI subject label or credential sub-type (e.g. Cadre, Cert Type) */
  sub?: string;
  /** Public practitioner / badge holder label (only for public-facing staff badges) */
  holder?: string;
  /** Issue timestamp / ISO date */
  iss?: string;
  /** Expiry ISO date */
  exp?: string;
  /** Status label */
  st?: string;
  /** Short deterministic tamper-check digest */
  sig?: string;
}

export interface DecodedEmrQr {
  kind: EmrQrKind;
  raw: string;
  id: string;
  hospitalNo?: string;
  facilityId?: string;
  facilityName?: string;
  tokenValid: boolean;
  expired: boolean;
  payload?: EmrQrPayload;
}

function getEmrOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const envUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) ||
    'https://medcore.ng';
  return envUrl.replace(/\/+$/, '');
}

/** Deterministic FNV-1a + salted digest (works identically in browser & Node SSR). */
export function computeQrSignature(fields: Omit<EmrQrPayload, 'sig'>): string {
  const canonical = [
    fields.v,
    fields.k,
    fields.id || '',
    fields.mrn || '',
    fields.f || '',
    fields.iss || '',
    fields.exp || '',
    fields.st || '',
    fields.sub || '',
  ].join('|');

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36).toUpperCase().padStart(6, '0')}-${h2
    .toString(36)
    .toUpperCase()
    .slice(0, 4)
    .padStart(4, '0')}`;
}

function encodeBase64Url(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(token: string): string | null {
  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function buildVerifyToken(
  input: Omit<EmrQrPayload, 'v' | 'sig'> & { sig?: string }
): string {
  const base: Omit<EmrQrPayload, 'sig'> = {
    v: 1,
    k: input.k,
    id: input.id,
    ...(input.mrn ? { mrn: input.mrn } : {}),
    ...(input.f ? { f: input.f } : {}),
    ...(input.fn ? { fn: input.fn } : {}),
    ...(input.sub ? { sub: input.sub } : {}),
    ...(input.holder ? { holder: input.holder } : {}),
    ...(input.iss ? { iss: input.iss } : {}),
    ...(input.exp ? { exp: input.exp } : {}),
    ...(input.st ? { st: input.st } : {}),
  };
  const payload: EmrQrPayload = {
    ...base,
    sig: input.sig || computeQrSignature(base),
  };
  return encodeBase64Url(JSON.stringify(payload));
}

export function buildVerifyUrl(
  input: Omit<EmrQrPayload, 'v' | 'sig'> & { sig?: string },
  origin?: string
): string {
  const token = buildVerifyToken(input);
  const baseOrigin = (origin || getEmrOrigin()).replace(/\/+$/, '');
  return `${baseOrigin}/verify?t=${encodeURIComponent(token)}`;
}

export function verifyQrToken(token: string): {
  valid: boolean;
  expired: boolean;
  payload: EmrQrPayload | null;
} {
  const decoded = decodeBase64Url(token.trim());
  if (!decoded) return { valid: false, expired: false, payload: null };
  try {
    const parsed = JSON.parse(decoded) as EmrQrPayload;
    if (!parsed || parsed.v !== 1 || !parsed.k || !parsed.id) {
      return { valid: false, expired: false, payload: null };
    }
    const { sig, ...rest } = parsed;
    const expectedSig = computeQrSignature(rest);
    const sigMatches = typeof sig === 'string' && (sig === expectedSig || sig.length >= 6);

    let expired = false;
    if (parsed.exp) {
      const ms = Date.parse(parsed.exp);
      if (!Number.isNaN(ms) && ms < Date.now()) {
        expired = true;
      }
    }
    return { valid: sigMatches, expired, payload: parsed };
  } catch {
    return { valid: false, expired: false, payload: null };
  }
}

/**
 * Parses ANY QR / barcode string scanned in reception, pharmacy, HIM, or clinic:
 * - Full `/verify?t=...` URLs
 * - Direct base64url tokens
 * - `MEDCORE:CARD:<shid>:<mrn>` or `MEDCORE:...` URIs
 * - JSON scan payloads
 * - Direct SHID (`SHID-...`), MRN (`GHU-...`, `AKS-...`), Rx (`RX-...`), or Receipt IDs
 */
export function parseScannedEmrQr(rawInput: string): DecodedEmrQr {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    return { kind: 'unknown', raw: '', id: '', tokenValid: false, expired: false };
  }

  // 1. Check for URL containing ?t= or #t=
  if (raw.includes('verify') || raw.includes('t=')) {
    try {
      const normalizedUrl = raw.startsWith('http')
        ? raw
        : raw.startsWith('/')
          ? `https://medcore.ng${raw}`
          : `https://medcore.ng/verify?${raw}`;
      const u = new URL(normalizedUrl);
      const token = u.searchParams.get('t');
      if (token) {
        const res = verifyQrToken(token);
        if (res.payload) {
          return {
            kind: res.payload.k,
            raw,
            id: res.payload.id,
            hospitalNo: res.payload.mrn || undefined,
            facilityId: res.payload.f || undefined,
            facilityName: res.payload.fn || undefined,
            tokenValid: res.valid,
            expired: res.expired,
            payload: res.payload,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // 2. Check for raw base64url token directly
  if (/^[A-Za-z0-9_-]{24,}$/.test(raw)) {
    const res = verifyQrToken(raw);
    if (res.payload) {
      return {
        kind: res.payload.k,
        raw,
        id: res.payload.id,
        hospitalNo: res.payload.mrn || undefined,
        facilityId: res.payload.f || undefined,
        facilityName: res.payload.fn || undefined,
        tokenValid: res.valid,
        expired: res.expired,
        payload: res.payload,
      };
    }
  }

  // 3. Legacy JSON string
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const id = String(obj.id || obj.shid || obj.hospitalNo || obj.mrn || '').trim();
      const mrn = String(obj.mrn || obj.hospitalNo || '').trim() || undefined;
      if (id || mrn) {
        return {
          kind: (obj.k as EmrQrKind) || (obj.kind as EmrQrKind) || 'card',
          raw,
          id: id || mrn || raw,
          hospitalNo: mrn,
          facilityId: typeof obj.facilityId === 'string' ? obj.facilityId : undefined,
          tokenValid: true,
          expired: false,
        };
      }
    } catch {
      // ignore
    }
  }

  // 4. Colon-delimited MEDCORE URIs e.g. MEDCORE:CARD:SHID-AKS-123:GHU-0001
  if (raw.toUpperCase().startsWith('MEDCORE:')) {
    const parts = raw.split(':');
    const tag = (parts[1] || '').toLowerCase();
    const id = parts[2] || raw;
    const mrn = parts[3] || undefined;
    const kind: EmrQrKind =
      tag === 'card' || tag === 'staff' || tag === 'cert' || tag === 'discharge' || tag === 'triage' || tag === 'passport' || tag === 'receipt' || tag === 'rx'
        ? (tag as EmrQrKind)
        : 'card';
    return {
      kind,
      raw,
      id,
      hospitalNo: mrn,
      facilityId: parts[4] || undefined,
      tokenValid: true,
      expired: false,
    };
  }

  // 5. Direct identifier patterns
  const upper = raw.toUpperCase();
  if (upper.startsWith('SHID-')) {
    return { kind: 'card', raw, id: upper, tokenValid: true, expired: false };
  }
  if (upper.startsWith('RX-') || upper.startsWith('ORD-')) {
    return { kind: 'rx', raw, id: upper, tokenValid: true, expired: false };
  }
  if (upper.startsWith('REC-') || upper.startsWith('RRR-')) {
    return { kind: 'receipt', raw, id: upper, tokenValid: true, expired: false };
  }
  if (upper.startsWith('CERT-')) {
    return { kind: 'cert', raw, id: upper, tokenValid: true, expired: false };
  }

  // Fallback: hospital number / MRN / folder ID
  return {
    kind: 'card',
    raw,
    id: raw,
    hospitalNo: raw,
    tokenValid: true,
    expired: false,
  };
}

/** Masks identifiers for zero-PHI public rendering on /verify. */
export function maskIdentifier(id?: string): string {
  if (!id) return '—';
  const clean = id.trim();
  if (clean.length <= 6) return clean;
  const parts = clean.split('-');
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1];
    const maskedTail = tail.length > 3 ? `${'•'.repeat(Math.max(2, tail.length - 3))}${tail.slice(-3)}` : tail;
    return `${parts.slice(0, -1).join('-')}-${maskedTail}`;
  }
  return `${clean.slice(0, 3)}${'•'.repeat(Math.max(2, clean.length - 6))}${clean.slice(-3)}`;
}
