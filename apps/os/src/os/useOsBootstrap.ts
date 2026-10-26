'use client';

import { useEffect } from 'react';
import { ensureCleanPilot } from '../lib/adminRealtimeStore';
import { enableFirestoreOffline } from '../lib/firebase';
import { startOutboxAutoFlush } from '../lib/durableOutbox';
import { startClinicalPaymentListeners } from '../lib/clinicalEventBus';
import { reconcileAllVisitPayments } from '../lib/frontDeskAccountsBridge';

/** Roles that need payment reconciliation on boot */
const PAYMENT_BOOT_ROLES = new Set([
  'hospital_admin',
  'admin',
  'reception',
  'receptionist',
  'cashier',
  'accountant',
  'billing',
  'front_desk',
  'frontdesk',
]);

function roleWantsPaymentBoot(): boolean {
  try {
    const raw = localStorage.getItem('medcore_os_session');
    if (!raw) return false;
    const s = JSON.parse(raw) as { roleKey?: string; role?: string; badgeId?: string };
    const rk = String(s.roleKey || s.role || '').toLowerCase().replace(/\s+/g, '_');
    if (PAYMENT_BOOT_ROLES.has(rk)) return true;
    if (String(s.badgeId || '').toUpperCase().includes('-ADM-')) return true;
    if (String(s.badgeId || '').toUpperCase().includes('-RCP-')) return true;
    if (String(s.badgeId || '').toUpperCase().includes('-CSH-')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Deferred OS startup — runs after first paint so splash/auth stay responsive.
 * Payment reconcile only for front-desk / admin / cashier roles.
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

      // Clinical payment listeners only for roles that post/collect
      if (roleWantsPaymentBoot()) {
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
        }, 2500);
      }

      setTimeout(() => {
        stopOutbox = startOutboxAutoFlush(20000);
      }, 800);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
        }
      ).requestIdleCallback(runStartup, { timeout: 2000 });
    } else {
      setTimeout(runStartup, 150);
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
