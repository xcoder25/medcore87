/**
 * useOpdSync - hospital-wide OPD real-time hook.
 *
 * Subscribes to ALL live data channels that the three OPD desks care about:
 *   1. Reception queue updates   (medcore-reception-ops + BroadcastChannel)
 *   2. Nurse vitals saves        (medcore-vitals)
 *   3. Stage transitions         (medcore-opd-stage)
 *   4. Universal queue           (medcore-universal-queue)
 *   5. localStorage storage      (cross-tab catch-all)
 *   6. BroadcastChannel          (medcore_reception, medcore_triage, medcore_doctor)
 *   7. Auto-heartbeat            (every 30 s to self-heal stale state)
 *
 * Usage:
 *   const { tick, lastEvent } = useOpdSync();
 *   // Re-derive your memos whenever `tick` changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type OpdSyncEvent = {
  source: string;
  at: string;
  detail?: unknown;
};

interface UseOpdSyncOptions {
  /** Heartbeat interval in ms. Default 30 000 ms (30 s). Set 0 to disable. */
  heartbeatMs?: number;
}

export function useOpdSync(opts: UseOpdSyncOptions = {}) {
  const heartbeatMs = opts.heartbeatMs ?? 30_000;

  const [tick, setTick] = useState(0);
  const [lastEvent, setLastEvent] = useState<OpdSyncEvent | null>(null);
  const mountedRef = useRef(true);

  const bump = useCallback((source: string, detail?: unknown) => {
    if (!mountedRef.current) return;
    setTick((t) => t + 1);
    setLastEvent({ source, at: new Date().toISOString(), detail });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // 1. Custom DOM events
    const domEvents = [
      'medcore-reception-ops',
      'medcore-vitals',
      'medcore-opd-stage',
      'medcore-universal-queue',
      'medcore-admin-sync',
      'medcore-reception-sync',
    ];

    const handlers: Array<[string, EventListener]> = domEvents.map((evtName) => {
      const fn = (e: Event) => bump(evtName, (e as CustomEvent).detail);
      window.addEventListener(evtName, fn);
      return [evtName, fn];
    });

    // 2. Cross-tab localStorage
    const storageFn = () => bump('storage');
    window.addEventListener('storage', storageFn);

    // 3. BroadcastChannels
    const channels: BroadcastChannel[] = [];
    const channelNames = ['medcore_reception', 'medcore_triage', 'medcore_doctor'];
    for (const name of channelNames) {
      try {
        const bc = new BroadcastChannel(name);
        bc.onmessage = (e) => bump('bc:' + name, e.data);
        channels.push(bc);
      } catch {
        /* BroadcastChannel unavailable (SSR / old browser) */
      }
    }

    // 4. Heartbeat (self-heal stale state)
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    if (heartbeatMs > 0) {
      heartbeatTimer = setInterval(() => bump('heartbeat'), heartbeatMs);
    }

    return () => {
      mountedRef.current = false;
      for (const [evtName, fn] of handlers) {
        window.removeEventListener(evtName, fn);
      }
      window.removeEventListener('storage', storageFn);
      for (const bc of channels) {
        try { bc.close(); } catch { /* ignore */ }
      }
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [bump, heartbeatMs]);

  return { tick, lastEvent };
}

/**
 * Broadcast an OPD stage change to all connected tabs/desks.
 * Call this after any queue mutation so peer workstations update instantly.
 */
export function broadcastOpdStage(
  channel: 'medcore_reception' | 'medcore_triage' | 'medcore_doctor',
  payload: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;
  try {
    const bc = new BroadcastChannel(channel);
    bc.postMessage({ type: 'opd-stage', ...payload, at: new Date().toISOString() });
    bc.close();
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent('medcore-opd-stage', { detail: payload }));
  } catch { /* ignore */ }
}
