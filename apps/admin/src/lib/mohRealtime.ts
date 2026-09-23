/**
 * MOH Admin realtime engine
 * - Local simulation ticks (beds, ICU, epi cases, staff)
 * - Optional WebSocket to Hospital Gateway when available
 */

export type MohRealtimeHandlers = {
  onFacilitiesTick?: (mutator: (prev: any[]) => any[]) => void;
  onAlertsTick?: (mutator: (prev: any[]) => any[]) => void;
  onNotification?: (title: string, body: string, type?: 'success' | 'info' | 'alert') => void;
  onConnectionChange?: (online: boolean) => void;
  onServerEvent?: (topic: string, payload: unknown) => void;
};

export function startMohRealtime(handlers: MohRealtimeHandlers) {
  let stopped = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const tickFacilities = () => {
    handlers.onFacilitiesTick?.((prev) =>
      prev.map((f) => {
        const delta = Math.random() > 0.55 ? 1 : -1;
        const occupiedBeds = Math.max(
          0,
          Math.min(f.totalBeds, f.occupiedBeds + (Math.random() > 0.4 ? delta : 0))
        );
        const icuDelta = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const icuBedsOccupied = Math.max(
          0,
          Math.min(f.icuBedsTotal, f.icuBedsOccupied + icuDelta)
        );
        const staffOnDuty = Math.max(
          10,
          f.staffOnDuty + (Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : -1) : 0)
        );
        const ventilatorsAvailable = Math.max(
          0,
          f.ventilatorsAvailable + (Math.random() > 0.9 ? (Math.random() > 0.5 ? 1 : -1) : 0)
        );
        return { ...f, occupiedBeds, icuBedsOccupied, staffOnDuty, ventilatorsAvailable };
      })
    );
  };

  const tickAlerts = () => {
    handlers.onAlertsTick?.((prev) =>
      prev.map((a) => {
        if (Math.random() > 0.6) return a;
        const bump = Math.floor(Math.random() * 3);
        const detectedCases = Math.max(0, a.detectedCases + bump);
        const rateOfIncreasePercent = Math.max(
          -5,
          Math.min(40, a.rateOfIncreasePercent + (Math.random() * 2 - 0.8))
        );
        return {
          ...a,
          detectedCases,
          rateOfIncreasePercent: Math.round(rateOfIncreasePercent * 10) / 10,
        };
      })
    );
  };

  const facilityTimer = setInterval(() => {
    if (!stopped) tickFacilities();
  }, 4000);

  const alertTimer = setInterval(() => {
    if (!stopped) tickAlerts();
  }, 7000);

  const notifTimer = setInterval(() => {
    if (stopped || Math.random() > 0.35) return;
    const msgs: [string, string, 'info' | 'alert' | 'success'][] = [
      ['Telemetry sync', 'National facility feed refreshed', 'info'],
      ['Occupancy advisory', 'One facility crossed 90% bed occupancy', 'alert'],
      ['Cold-chain check', 'Regional vaccine logger nominal', 'success'],
      ['Workforce pulse', 'On-duty clinician counts updated', 'info'],
    ];
    const m = msgs[Math.floor(Math.random() * msgs.length)];
    handlers.onNotification?.(m[0], m[1], m[2]);
  }, 14000);

  const connectWs = () => {
    if (typeof window === 'undefined' || stopped) return;
    try {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:4000/ws`;
      ws = new WebSocket(url);
      ws.onopen = () => {
        handlers.onConnectionChange?.(true);
        ws?.send(JSON.stringify({ action: 'SUBSCRIBE', topics: ['*'], app: 'MOH_ADMIN' }));
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.topic) handlers.onServerEvent?.(data.topic, data.payload);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        handlers.onConnectionChange?.(false);
        ws = null;
        if (!stopped) reconnectTimer = setTimeout(connectWs, 5000);
      };
      ws.onerror = () => handlers.onConnectionChange?.(false);
    } catch {
      handlers.onConnectionChange?.(false);
    }
  };

  const wsBoot = setTimeout(connectWs, 800);

  return () => {
    stopped = true;
    clearInterval(facilityTimer);
    clearInterval(alertTimer);
    clearInterval(notifTimer);
    clearTimeout(wsBoot);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try { ws?.close(); } catch { /* ignore */ }
  };
}
