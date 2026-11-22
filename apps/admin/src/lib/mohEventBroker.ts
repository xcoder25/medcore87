/**
 * In-process server pub/sub broker for pushing MOH mutation notifications
 * over Server-Sent Events (/api/moh/stream).
 */

export interface MohBrokerEvent {
  id: string;
  type: 'connected' | 'directive' | 'audit' | 'transfer' | 'facility' | 'alert' | 'sync_tick';
  at: string;
  detail?: Record<string, unknown>;
}

type Listener = (ev: MohBrokerEvent) => void;

const globalKey = '__medcore_moh_event_listeners_v1__';

function getListenerSet(): Set<Listener> {
  const g = globalThis as unknown as Record<string, Set<Listener> | undefined>;
  if (!g[globalKey]) {
    g[globalKey] = new Set<Listener>();
  }
  return g[globalKey]!;
}

export function publishMohEvent(
  type: MohBrokerEvent['type'],
  detail?: Record<string, unknown>
): MohBrokerEvent {
  const event: MohBrokerEvent = {
    id: `MOH-EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    type,
    at: new Date().toISOString(),
    detail,
  };
  for (const listener of getListenerSet()) {
    try {
      listener(event);
    } catch {
      /* isolate listener errors */
    }
  }
  return event;
}

export function subscribeMohEvents(listener: Listener): () => void {
  const set = getListenerSet();
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
