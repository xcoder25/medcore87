/** MFA + SSO config (local TOTP-style challenge; SSO is OIDC redirect ready) */
const MFA_KEY = 'medcore_os_mfa_secrets_v1';
const SSO_KEY = 'medcore_os_sso_config_v1';

export interface MfaSecret {
  badgeId: string;
  secret: string;
  enabled: boolean;
}

export interface SsoConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  redirectUri: string;
}

function readMap(): Record<string, MfaSecret> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(MFA_KEY) || '{}');
  } catch {
    return {};
  }
}

export function enableMfa(badgeId: string): MfaSecret {
  const secret = Math.random().toString(36).slice(2, 10).toUpperCase();
  const map = readMap();
  map[badgeId] = { badgeId, secret, enabled: true };
  localStorage.setItem(MFA_KEY, JSON.stringify(map));
  return map[badgeId];
}

export function isMfaEnabled(badgeId: string) {
  return Boolean(readMap()[badgeId]?.enabled);
}

/** Simple challenge: last 4 of secret + hour slot (demo MFA, not production TOTP) */
export function verifyMfaCode(badgeId: string, code: string): boolean {
  const s = readMap()[badgeId];
  if (!s?.enabled) return true;
  const hour = new Date().getHours().toString().padStart(2, '0');
  const expected = (s.secret.slice(-4) + hour).toUpperCase();
  return code.replace(/\s/g, '').toUpperCase() === expected || code === s.secret;
}

export function getMfaHint(badgeId: string): string {
  const s = readMap()[badgeId];
  if (!s) return 'MFA not enrolled';
  return `Enter ${s.secret.slice(-4)} + current hour (e.g. ${s.secret.slice(-4)}${new Date().getHours().toString().padStart(2, '0')})`;
}

export function getSsoConfig(): SsoConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, issuer: '', clientId: '', redirectUri: '' };
  }
  try {
    return JSON.parse(
      localStorage.getItem(SSO_KEY) ||
        JSON.stringify({
          enabled: false,
          issuer: 'https://login.microsoftonline.com/common/v2.0',
          clientId: '',
          redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
        })
    );
  } catch {
    return { enabled: false, issuer: '', clientId: '', redirectUri: '' };
  }
}

export function saveSsoConfig(c: SsoConfig) {
  localStorage.setItem(SSO_KEY, JSON.stringify(c));
}

export function ssoAuthorizeUrl(): string | null {
  const c = getSsoConfig();
  if (!c.enabled || !c.clientId) return null;
  const params = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.redirectUri,
    scope: 'openid profile email',
  });
  return `${c.issuer.replace(/\/$/, '')}/authorize?${params}`;
}
