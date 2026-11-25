/**
 * Wall-clock deadline and foreground-resume utilities.
 * Browsers throttle or pause setInterval countdowns when a PWA / tab is minimized or backgrounded.
 * Always compute remaining time from a fixed wall-clock timestamp (deadlineMs - Date.now())
 * and immediately resynchronize on visibilitychange / focus / pageshow.
 */

export function computeRemainingSeconds(deadlineMs: number, nowMs = Date.now()): number {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function isDeadlineExpired(deadlineMs: number, nowMs = Date.now()): boolean {
  return Number.isFinite(deadlineMs) && deadlineMs > 0 && nowMs >= deadlineMs;
}

export function subscribeForegroundResume(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      callback();
    }
  };
  const onFocus = () => callback();
  const onPageShow = () => callback();

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pageshow', onPageShow);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onPageShow);
  };
}
