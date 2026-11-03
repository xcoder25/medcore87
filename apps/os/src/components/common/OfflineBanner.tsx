'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';

/**
 * Honest connectivity & sync banner for offline resilience.
 * - Shows amber warning when offline with persistent local cache notice.
 * - Flashes emerald banner when connection returns to signal sync resumption.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setJustReconnected(false);
      setOffline(true);
    };

    if (typeof navigator !== 'undefined') {
      setOffline(!navigator.onLine);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          background: 'linear-gradient(90deg, #065F46, #047857)',
          color: '#ECFDF5',
          fontSize: 12.5,
          fontWeight: 600,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          transition: 'all 0.3s ease',
        }}
      >
        <CheckCircle2 size={16} />
        <span>Connection restored · Synchronizing queued updates with MedCore cloud.</span>
      </div>
    );
  }

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #92400E, #B45309)',
        color: '#FFFBEB',
        fontSize: 12.5,
        fontWeight: 600,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        letterSpacing: 0.1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      <WifiOff size={16} />
      <span>
        Working Offline ?" Persistent multi-tab local cache active. Records & actions are saved locally and will auto-sync upon reconnection.
      </span>
    </div>
  );
}
