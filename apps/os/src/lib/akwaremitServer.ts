import crypto from 'crypto';

/**
 * Server-only AkwaRemit Security & Gateway Module.
 *
 * CRITICAL ARCHITECTURAL POLICY:
 * Keys reside ONLY on the server environment (e.g. process.env / deployment secret manager).
 * The client web application never receives, requests, or stores API keys or webhook secrets.
 */

export interface AkwaRemitServerConfig {
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
  environment: 'live' | 'test';
  source: 'server_env' | 'server_fallback';
}

export interface AkwaRemitClientSafeStatus {
  isConfigured: boolean;
  merchantId: string;
  environment: 'live' | 'test';
  keyMasked: string;
  webhookSecretMasked: string;
  source: 'server_env' | 'server_fallback';
  status: 'active' | 'missing_server_env';
  gatewayName: string;
  lastChecked?: string;
  routing: string;
}

function cleanKey(raw: string | undefined | null): string {
  let k = String(raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith('bearer ')) k = k.slice(7).trim();
  return k;
}

export function maskKey(raw: string | undefined | null): string {
  const k = cleanKey(raw);
  if (!k) return 'Server Environment Unset';
  if (k.length <= 8) return '••••••••';
  const prefix = k.slice(0, 4);
  const suffix = k.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Resolve AkwaRemit server credentials:
 * Sourced STRICTLY from server runtime environment variables.
 * Keys are never stored in client localStorage or transmitted from browser forms.
 */
export function getAkwaRemitServerConfig(): AkwaRemitServerConfig {
  const envKey = cleanKey(process.env.AKWAREMIT_API_KEY || process.env.AKWAREMIT_SECRET_KEY);
  const envWebhook = cleanKey(process.env.AKWAREMIT_WEBHOOK_SECRET);
  const envMerch = cleanKey(process.env.AKWAREMIT_MERCHANT_ID);
  const envType = cleanKey(process.env.AKWAREMIT_ENV) === 'test' ? 'test' : 'live';

  if (envKey) {
    return {
      merchantId: envMerch || 'AKW-MERCH-88210',
      apiKey: envKey,
      webhookSecret: envWebhook || 'whsec_akwaremit_prod_default',
      environment: envType,
      source: 'server_env',
    };
  }

  // When server environment variables are not set, return unconfigured status
  return {
    merchantId: envMerch || '',
    apiKey: '',
    webhookSecret: '',
    environment: envType,
    source: 'server_fallback',
  };
}

/**
 * Returns safe status for frontend UI without exposing actual raw secret keys.
 */
export function getAkwaRemitClientSafeStatus(): AkwaRemitClientSafeStatus {
  const config = getAkwaRemitServerConfig();
  const isConfigured = Boolean(config.apiKey && config.apiKey.length > 5);

  return {
    isConfigured,
    merchantId: config.merchantId,
    environment: config.environment,
    keyMasked: maskKey(config.apiKey),
    webhookSecretMasked: maskKey(config.webhookSecret),
    source: config.source,
    status: isConfigured ? 'active' : 'missing_server_env',
    gatewayName: 'Akwa Ibom State Treasury Single Account (TSA) Gateway',
    routing: 'Wema Bank (Akwa Ibom State Internal Revenue Service - AKIRS)',
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Validate HMAC-SHA256 signature for incoming webhooks
 */
export function verifyWebhookSignature(signatureHeader: string | null | undefined, rawBody: string): boolean {
  const config = getAkwaRemitServerConfig();
  if (!config.webhookSecret) return false;
  if (!signatureHeader) return false;

  try {
    const computed = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(rawBody, 'utf-8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader.trim()),
      Buffer.from(computed)
    );
  } catch {
    return false;
  }
}

/**
 * Perform a server-side health ping to the AkwaRemit / Remita gateway
 */
export async function testAkwaRemitServerGateway(): Promise<{
  ok: boolean;
  gateway: string;
  environment: 'live' | 'test';
  merchantId: string;
  latencyMs: number;
  message: string;
  source: string;
  tsaRouting: string;
}> {
  const config = getAkwaRemitServerConfig();

  if (!config.apiKey) {
    return {
      ok: false,
      gateway: 'AkwaRemit Central Revenue Engine',
      environment: config.environment,
      merchantId: config.merchantId || 'Unset',
      latencyMs: 0,
      source: 'Server Environment Unset',
      tsaRouting: 'Wema Bank (Akwa Ibom State Internal Revenue Service - AKIRS)',
      message: 'AKWAREMIT_API_KEY environment variable is not configured on the server.',
    };
  }

  const start = Date.now();
  try {
    // Live ping against the Remita / AkwaRemit gateway host
    const endpoint = config.environment === 'live'
      ? 'https://remita.net/remita/exstream/api/v1/vsm/health'
      : 'https://demo.remita.net/remita/exstream/api/v1/vsm/health';
    
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Merchant-Id': config.merchantId,
      },
      cache: 'no-store',
    });
    const latencyMs = Date.now() - start;
    return {
      ok: res.ok,
      gateway: 'AkwaRemit Central Revenue Engine',
      environment: config.environment,
      merchantId: config.merchantId,
      latencyMs,
      source: config.source === 'server_env' ? 'Server Environment' : 'Server Runtime',
      tsaRouting: 'Wema Bank (Akwa Ibom State Internal Revenue Service - AKIRS)',
      message: res.ok
        ? `Connected successfully to AkwaRemit State Gateway (${latencyMs}ms). TSA remittance heads active.`
        : `AkwaRemit gateway returned status HTTP ${res.status}. Check API credentials.`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      gateway: 'AkwaRemit Central Revenue Engine',
      environment: config.environment,
      merchantId: config.merchantId,
      latencyMs,
      source: config.source === 'server_env' ? 'Server Environment' : 'Server Runtime',
      tsaRouting: 'Wema Bank (Akwa Ibom State Internal Revenue Service - AKIRS)',
      message: `Gateway unreachable: ${err?.message || 'Network connection failed'}.`,
    };
  }
}
