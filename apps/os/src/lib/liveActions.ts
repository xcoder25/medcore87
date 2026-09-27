/**
 * Global realtime action bus for OS UI — every manual button can emit feedback.
 */
export type LiveActionDetail = {
  message: string;
  module?: string;
  role?: string;
  navKey?: string;
  at?: string;
};

export const LIVE_ACTION_EVENT = 'medcore-live-action';

export function emitLiveAction(message: string, extra?: Partial<LiveActionDetail>) {
  if (typeof window === 'undefined') return;
  const detail: LiveActionDetail = {
    message,
    at: new Date().toISOString(),
    ...extra,
  };
  window.dispatchEvent(new CustomEvent(LIVE_ACTION_EVENT, { detail }));
}

export function subscribeLiveActions(handler: (d: LiveActionDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = (e: Event) => {
    const ce = e as CustomEvent<LiveActionDetail>;
    if (ce.detail?.message) handler(ce.detail);
  };
  window.addEventListener(LIVE_ACTION_EVENT, fn);
  return () => window.removeEventListener(LIVE_ACTION_EVENT, fn);
}
