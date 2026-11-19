/**
 * Resilient client helper for verifying staff PIN/password via `/api/auth/verify-pin`.
 *
 * Ensures transient network drops, mobile cellular handoffs, serverless cold starts,
 * and temporary database timeouts NEVER misreport a valid credential as "Incorrect PIN".
 */

export type VerifyPinStatus =
  | 'verified'
  | 'invalid_pin'
  | 'not_found'
  | 'needs_server_key'
  | 'offline'
  | 'timeout'
  | 'network_error'
  | 'rate_limited'
  | 'server_error';

export interface VerifyPinMeta {
  hasPinHash?: boolean;
  accountFound?: boolean;
  verified?: boolean;
  needsServerFirebaseKey?: boolean;
  transientError?: boolean;
  source?: string;
}

export interface VerifyPinResult {
  status: VerifyPinStatus;
  verified: boolean;
  meta?: VerifyPinMeta;
  retryAfterSeconds?: number;
  httpStatus?: number;
  error?: string;
}

export interface VerifyPinOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  isOnline?: () => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutError(err: unknown): boolean {
  const name = String((err as { name?: string })?.name || '').toLowerCase();
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  return (
    name === 'aborterror' ||
    name === 'timeouterror' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted')
  );
}

/**
 * Calls POST `/api/auth/verify-pin` with automatic timeout abort + one transient retry.
 */
export async function verifyPinOnServer(
  payload: {
    facilityId?: string;
    badgeId?: string;
    email?: string;
    pin: string;
  },
  opts: VerifyPinOptions = {}
): Promise<VerifyPinResult> {
  const isOnline =
    opts.isOnline ??
    (() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  if (!isOnline()) {
    return { status: 'offline', verified: false };
  }

  const fetchFn = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxRetries = Math.max(0, opts.maxRetries ?? 1);
  const retryDelayMs = opts.retryDelayMs ?? 600;

  let lastResult: VerifyPinResult = { status: 'network_error', verified: false };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (!isOnline()) {
      return { status: 'offline', verified: false };
    }

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => {
      try {
        controller?.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    try {
      const res = await fetchFn('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        ...(controller ? { signal: controller.signal } : {}),
      });

      const json = (await res.json().catch(() => ({}))) as VerifyPinMeta & {
        error?: string;
        message?: string;
        retryAfterSeconds?: number;
      };

      if (res.status === 429) {
        return {
          status: 'rate_limited',
          verified: false,
          retryAfterSeconds: Number(json.retryAfterSeconds) || 60,
          httpStatus: 429,
          error: json.error,
        };
      }

      if (res.status >= 500 || res.status === 408) {
        lastResult = {
          status: 'server_error',
          verified: false,
          httpStatus: res.status,
          error: json.message || json.error || `HTTP ${res.status}`,
        };
        if (attempt < maxRetries) {
          await sleep(retryDelayMs);
          continue;
        }
        return lastResult;
      }

      if (res.status === 400) {
        return {
          status: 'invalid_pin',
          verified: false,
          httpStatus: 400,
          error: json.message || json.error,
        };
      }

      if (!res.ok) {
        return {
          status: 'server_error',
          verified: false,
          httpStatus: res.status,
          error: json.message || json.error || `HTTP ${res.status}`,
        };
      }

      if (json.verified === true) {
        return { status: 'verified', verified: true, meta: json };
      }

      if (json.transientError === true) {
        lastResult = { status: 'server_error', verified: false, meta: json };
        if (attempt < maxRetries) {
          await sleep(retryDelayMs);
          continue;
        }
        return lastResult;
      }

      if (json.accountFound === false) {
        return { status: 'not_found', verified: false, meta: json };
      }

      if (json.needsServerFirebaseKey === true) {
        return { status: 'needs_server_key', verified: false, meta: json };
      }

      return {
        status: 'invalid_pin',
        verified: false,
        meta: json,
        error: json.message || json.error,
      };
    } catch (err) {
      if (!isOnline()) {
        return { status: 'offline', verified: false };
      }
      lastResult = {
        status: isTimeoutError(err) ? 'timeout' : 'network_error',
        verified: false,
        error: (err as Error)?.message,
      };
      if (attempt < maxRetries) {
        await sleep(retryDelayMs);
        continue;
      }
      return lastResult;
    } finally {
      clearTimeout(timer);
    }
  }

  return lastResult;
}

/**
 * Formats an accurate user-facing error message from `verifyPinOnServer`.
 * Guarantees connectivity/timeout errors NEVER claim "Incorrect PIN".
 */
export function formatVerifyFailureMessage(
  result: VerifyPinResult,
  ctx: { mode: 'badge' | 'email'; isAdmin?: boolean }
): string {
  switch (result.status) {
    case 'offline':
      return 'You are currently offline. Reconnect to the internet (or hospital LAN) and try signing in again.';
    case 'timeout':
      return 'Connection timed out while verifying your PIN. Your PIN was not rejected — check your network and try again.';
    case 'network_error':
      return 'Network connection dropped while verifying your PIN. Check your internet connection and try again.';
    case 'server_error':
      return 'Hospital authentication server temporarily unreachable (connection or database timeout). Please try again in a moment.';
    case 'rate_limited':
      return `Too many sign-in attempts. Please wait ${result.retryAfterSeconds || 60}s and try again.`;
    case 'not_found':
      return ctx.mode === 'email'
        ? 'No staff account was found for this email. Check the email address or ask your administrator to enrol you.'
        : 'No staff account was found for this Staff Badge ID.';
    case 'needs_server_key':
      return 'This legacy account is not yet synced to Aurora Postgres. Add server-only FIREBASE_WEB_API_KEY in Vercel (not NEXT_PUBLIC_) or reset PIN once via Forgot PIN.';
    case 'invalid_pin':
    default:
      if (result.httpStatus === 400 && result.error) return result.error;
      if (ctx.mode === 'email') return 'Incorrect PIN/password for this email account.';
      return ctx.isAdmin ? 'Incorrect administrator PIN. Access denied.' : 'Incorrect Staff ID or PIN.';
  }
}
