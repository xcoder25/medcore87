'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Clock, LogOut } from 'lucide-react';
import { getAdminSettings, subscribeAdminSettings } from '../../lib/adminSettingsStore';
import { scrubPhiOnLogout } from '../../lib/hipaaPrivacy';
import {
  computeRemainingSeconds,
  isDeadlineExpired,
  subscribeForegroundResume,
} from '../../lib/wallClockTimer';

interface InactivityLockGuardProps {
  facilityId: string;
  staffName: string;
  staffBadge?: string;
  onAutoLogout: () => void;
}

const WARNING_SECONDS = 60;
const LAST_ACTIVITY_KEY = 'medcore_os_last_activity_at_v1';

export const InactivityLockGuard: React.FC<InactivityLockGuardProps> = ({
  facilityId,
  staffName,
  staffBadge,
  onAutoLogout,
}) => {
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(() =>
    Math.max(5, Number(getAdminSettings(facilityId).inactivityTimeoutMinutes) || 15)
  );
  const [warningCountdown, setWarningCountdown] = useState<number | null>(null);
  const lastActivityRef = useRef<number>((() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY) || '0');
        if (stored > 0 && stored <= Date.now()) return stored;
      } catch {
        /* ignore */
      }
    }
    return Date.now();
  })());
  const loggedOutRef = useRef<boolean>(false);

  useEffect(() => {
    setTimeoutMinutes(Math.max(5, Number(getAdminSettings(facilityId).inactivityTimeoutMinutes) || 15));
    return subscribeAdminSettings((next) => {
      setTimeoutMinutes(Math.max(5, Number(next.inactivityTimeoutMinutes) || 15));
    });
  }, [facilityId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastBump = 0;
    const limitMs = timeoutMinutes * 60 * 1000;

    const triggerLogout = () => {
      if (loggedOutRef.current) return;
      loggedOutRef.current = true;
      try {
        window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        /* ignore */
      }
      scrubPhiOnLogout({
        reason: 'inactivity_timeout',
        facilityId,
        actor: staffName,
        actorBadge: staffBadge,
      });
      onAutoLogout();
    };

    const evaluateIdle = () => {
      if (loggedOutRef.current) return;
      const now = Date.now();
      const deadlineMs = lastActivityRef.current + limitMs;
      const remainingSec = computeRemainingSeconds(deadlineMs, now);

      if (remainingSec <= 0 || isDeadlineExpired(deadlineMs, now)) {
        triggerLogout();
        return;
      }

      if (remainingSec <= WARNING_SECONDS) {
        setWarningCountdown(remainingSec);
      } else {
        setWarningCountdown((prev) => (prev !== null ? null : prev));
      }
    };

    const bumpActivity = () => {
      const now = Date.now();
      // If timeout already elapsed while app was minimized/backgrounded, enforce logout immediately
      if (isDeadlineExpired(lastActivityRef.current + limitMs, now)) {
        triggerLogout();
        return;
      }
      if (now - lastBump < 1000) return;
      lastBump = now;
      lastActivityRef.current = now;
      try {
        window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        /* ignore */
      }
      setWarningCountdown((prev) => (prev !== null ? null : prev));
    };

    evaluateIdle();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, bumpActivity, { passive: true }));

    const iv = window.setInterval(evaluateIdle, 1000);
    const unsubResume = subscribeForegroundResume(evaluateIdle);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bumpActivity));
      window.clearInterval(iv);
      unsubResume();
    };
  }, [timeoutMinutes, facilityId, staffName, staffBadge, onAutoLogout]);

  if (warningCountdown === null) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="HIPAA Inactivity Auto-Logoff Warning"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          borderRadius: 18,
          border: '1px solid #FDE68A',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A' }}>
              HIPAA Workstation Auto-Logoff
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              Idle timeout ({timeoutMinutes} min) · Protecting patient records
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Clock size={16} />
          <span>
            Signing out &amp; clearing local PHI in <strong>{warningCountdown}s</strong> due to inactivity.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              loggedOutRef.current = true;
              scrubPhiOnLogout({
                reason: 'manual_logout',
                facilityId,
                actor: staffName,
                actorBadge: staffBadge,
              });
              onAutoLogout();
            }}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LogOut size={14} /> Sign Out Now
          </button>
          <button
            type="button"
            onClick={() => {
              lastActivityRef.current = Date.now();
              setWarningCountdown(null);
            }}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#0284C7',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityLockGuard;
