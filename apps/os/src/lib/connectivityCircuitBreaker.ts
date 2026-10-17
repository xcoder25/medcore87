/**
 * Connectivity Circuit Breaker & Edge Router
 * 
 * Manages the three-tier hybrid connectivity model:
 * 1. CLOUD_PRIMARY: Internet is healthy, real-time cloud services active.
 * 2. ONSITE_FALLBACK: Cloud is unreachable, connected to Hospital Edge Server (LAN).
 * 3. OFFLINE_LOCAL: Both Cloud and Onsite Server are unreachable; running on local browser cache/outbox.
 *
 * Implements hysteresis to prevent connection flapping:
 * - Fail fast: Switch to fallback after 2 consecutive probe failures.
 * - Recover slow: Return to Cloud Primary only after 3 consecutive successful heartbeats (~15s).
 */

import { resolveApiBase, isLanApiEligible } from './hospitalSync';

export type ConnectivityTier = 'CLOUD_PRIMARY' | 'ONSITE_FALLBACK' | 'OFFLINE_LOCAL';

export interface ConnectivityStatus {
  tier: ConnectivityTier;
  cloudHealthy: boolean;
  cloudLatencyMs: number | null;
  onsiteHealthy: boolean;
  onsiteLatencyMs: number | null;
  lastProbeTime: string;
  flappingGuarded: boolean;
  consecutiveCloudSuccesses: number;
}

export const CONNECTIVITY_EVENT = 'medcore-connectivity-changed';

let currentTier: ConnectivityTier = 'CLOUD_PRIMARY';
let cloudHealthy = true;
let cloudLatency: number | null = null;
let onsiteHealthy = false;
let onsiteLatency: number | null = null;

let consecutiveFails = 0;
let consecutiveSuccesses = 0;
const FAIL_THRESHOLD = 2; // Trip circuit to fallback after 2 fails
const RECOVERY_THRESHOLD = 3; // Require 3 clean probes before switching back to Cloud

let monitorTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Ping Cloud API with short timeout
 */
async function probeCloud(): Promise<{ ok: boolean; latency: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, latency: 0 };
  }
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2500);
    // Probe a lightweight cloud endpoint or current origin
    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    }).catch(async () => {
      // Fallback probe to static asset or root if /api/health is unavailable
      return fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    return { ok: res.ok, latency };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

/**
 * Ping Onsite Edge Gateway Server (LAN)
 */
async function probeOnsite(): Promise<{ ok: boolean; latency: number }> {
  if (!isLanApiEligible()) return { ok: false, latency: 0 };
  const base = resolveApiBase();
  if (!base) return { ok: false, latency: 0 };

  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${base}/api/v1/sync/status`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    return { ok: res.ok, latency };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

function broadcastState() {
  if (typeof window === 'undefined') return;
  const status = getConnectivityStatus();
  window.dispatchEvent(new CustomEvent(CONNECTIVITY_EVENT, { detail: status }));
}

/**
 * Probe all tiers and apply hysteresis circuit breaker rules
 */
export async function tickConnectivityCheck(): Promise<ConnectivityStatus> {
  const [cloudRes, onsiteRes] = await Promise.all([probeCloud(), probeOnsite()]);

  cloudHealthy = cloudRes.ok;
  cloudLatency = cloudRes.ok ? cloudRes.latency : null;
  onsiteHealthy = onsiteRes.ok;
  onsiteLatency = onsiteRes.ok ? onsiteRes.latency : null;

  // Hysteresis calculation for Cloud Primary
  if (cloudHealthy) {
    consecutiveFails = 0;
    consecutiveSuccesses++;
    if (consecutiveSuccesses >= RECOVERY_THRESHOLD && currentTier !== 'CLOUD_PRIMARY') {
      console.info('[EdgeRouter] Connection recovered. Switching back to CLOUD_PRIMARY.');
      currentTier = 'CLOUD_PRIMARY';
    }
  } else {
    consecutiveSuccesses = 0;
    consecutiveFails++;
    if (consecutiveFails >= FAIL_THRESHOLD) {
      if (onsiteHealthy) {
        if (currentTier !== 'ONSITE_FALLBACK') {
          console.warn('[EdgeRouter] Cloud unreachable. Circuit tripped to ONSITE_FALLBACK (LAN).');
          currentTier = 'ONSITE_FALLBACK';
        }
      } else {
        if (currentTier !== 'OFFLINE_LOCAL') {
          console.warn('[EdgeRouter] Cloud and LAN unreachable. Operating in OFFLINE_LOCAL mode.');
          currentTier = 'OFFLINE_LOCAL';
        }
      }
    }
  }

  broadcastState();
  return getConnectivityStatus();
}

export function getConnectivityStatus(): ConnectivityStatus {
  return {
    tier: currentTier,
    cloudHealthy,
    cloudLatencyMs: cloudLatency,
    onsiteHealthy,
    onsiteLatencyMs: onsiteLatency,
    lastProbeTime: new Date().toISOString(),
    flappingGuarded: consecutiveSuccesses > 0 && consecutiveSuccesses < RECOVERY_THRESHOLD,
    consecutiveCloudSuccesses: consecutiveSuccesses,
  };
}

export function startConnectivityCircuitBreaker(intervalMs = 6000): () => void {
  if (typeof window === 'undefined') return () => {};

  if (monitorTimer) clearInterval(monitorTimer);
  void tickConnectivityCheck();

  monitorTimer = setInterval(() => {
    void tickConnectivityCheck();
  }, intervalMs);

  const onOnline = () => {
    void tickConnectivityCheck();
  };
  const onOffline = () => {
    cloudHealthy = false;
    currentTier = onsiteHealthy ? 'ONSITE_FALLBACK' : 'OFFLINE_LOCAL';
    broadcastState();
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    if (monitorTimer) clearInterval(monitorTimer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/**
 * Helper to route an API call to the appropriate endpoint based on current tier
 */
export function resolveTargetApiUrl(cloudPath: string, onsitePath: string): string {
  if (currentTier === 'CLOUD_PRIMARY') {
    return cloudPath;
  }
  const base = resolveApiBase();
  return base ? `${base}${onsitePath}` : cloudPath;
}
