'use client';
import React, { useEffect } from 'react';

/**
 * SpeedInsights & Global UI Micro-Interaction Enhancer —
 * Also attaches a zero-overhead delegated click listener so every Refresh / Sync
 * button across the entire OS (containing a Lucide RefreshCw or RotateCw icon)
 * animates with a smooth 360° spin whenever clicked.
 */
export function SpeedInsights(): React.ReactNode {
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('button, [role="button"]') as HTMLElement | null;
      if (!btn || btn.hasAttribute('disabled') || btn.classList.contains('os-nav-item-btn')) return;

      const refreshIcons = btn.querySelectorAll<SVGElement>('svg.lucide-refresh-cw, svg.lucide-rotate-cw');
      if (!refreshIcons.length) return;

      refreshIcons.forEach((icon) => {
        icon.classList.remove('mc-refresh-spinning');
        // Force reflow so rapid consecutive clicks re-trigger the 360° spin cleanly
        void icon.getBoundingClientRect();
        icon.classList.add('mc-refresh-spinning');
        window.setTimeout(() => {
          icon.classList.remove('mc-refresh-spinning');
        }, 680);
      });
    };

    document.addEventListener('click', handleGlobalClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true } as EventListenerOptions);
    };
  }, []);

  return null;
}
