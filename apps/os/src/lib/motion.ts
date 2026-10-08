/**
 * Lightweight motion helpers — View Transitions, FLIP, reduced-motion, visibility pause.
 * No external animation libraries.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Run a React state update inside a View Transition when supported */
export function withViewTransition(update: () => void): void {
  if (typeof document === 'undefined') {
    update();
    return;
  }
  if (prefersReducedMotion()) {
    update();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === 'function') {
    try {
      doc.startViewTransition(() => {
        update();
      });
      return;
    } catch {
      /* fall through */
    }
  }
  update();
}

type FlipRect = { top: number; left: number; width: number; height: number };

/** FLIP a single element after a layout change (call before DOM update with first snapshot) */
export function flipElement(
  el: HTMLElement | null,
  first: FlipRect | null,
  opts?: { duration?: number; easing?: string }
): void {
  if (!el || !first || prefersReducedMotion()) return;
  const last = el.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / (last.width || 1);
  const sy = first.height / (last.height || 1);
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02) {
    return;
  }
  const duration = opts?.duration ?? 320;
  const easing = opts?.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
  try {
    el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: 'top left',
        },
        { transform: 'translate(0, 0) scale(1, 1)', transformOrigin: 'top left' },
      ],
      { duration, easing, fill: 'both' }
    );
  } catch {
    /* WAAPI unavailable */
  }
}

export function measureRect(el: HTMLElement | null): FlipRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Pause CSS animations on a subtree when not visible */
export function pauseAnimationsWhenHidden(
  root: HTMLElement | null,
  opts?: { rootMargin?: string }
): () => void {
  if (!root || typeof IntersectionObserver === 'undefined') return () => {};
  const apply = (hidden: boolean) => {
    root.style.setProperty('animation-play-state', hidden ? 'paused' : 'running');
    root.querySelectorAll<HTMLElement>('*').forEach((node) => {
      if (getComputedStyle(node).animationName !== 'none') {
        node.style.animationPlayState = hidden ? 'paused' : 'running';
      }
    });
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        apply(!e.isIntersecting);
      }
    },
    { threshold: 0.05, rootMargin: opts?.rootMargin || '0px' }
  );
  io.observe(root);
  // Also pause when tab hidden
  const onVis = () => {
    if (document.visibilityState === 'hidden') apply(true);
    else apply(false);
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    apply(false);
  };
}
