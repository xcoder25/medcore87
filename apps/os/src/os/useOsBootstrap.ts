'use client';

import { useEffect } from 'react';
import { ensureCleanPilot } from '../lib/adminRealtimeStore';
import { enableFirestoreOffline } from '../lib/firebase';
import { startOutboxAutoFlush } from '../lib/durableOutbox';
import { startClinicalPaymentListeners } from '../lib/clinicalEventBus';
import { reconcileAllVisitPayments } from '../lib/frontDeskAccountsBridge';

/**
 * Deferred OS startup — runs after first paint so splash/auth stay responsive.
 */
export function useOsBootstrap(): void {
  useEffect(() => {
    let stopClinicalPay: (() => void) | null = null;
    let stopOutbox: (() => void) | null = null;

    const runStartup = () => {
      try {
        ensureCleanPilot();
      } catch {
        /* ignore */
      }
      void enableFirestoreOffline();
      stopClinicalPay = startClinicalPaymentListeners();
      setTimeout(() => {
        try {
          const fid =
            (typeof window !== 'undefined' &&
              (window as unknown as { __medcoreFacilityId?: string }).__medcoreFacilityId) ||
            'IGH-EKT';
          reconcileAllVisitPayments(fid);
        } catch {
          /* ignore */
        }
      }, 2000);
      setTimeout(() => {
        stopOutbox = startOutboxAutoFlush(20000);
      }, 500);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
        runStartup,
        { timeout: 1500 }
      );
    } else {
      setTimeout(runStartup, 100);
    }

    return () => {
      if (stopOutbox) stopOutbox();
      try {
        if (stopClinicalPay) stopClinicalPay();
      } catch {
        /* */
      }
    };
  }, []);
}
