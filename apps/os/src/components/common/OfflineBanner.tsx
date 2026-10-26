'use client';

import React, { useEffect, useState } from 'react';

/**
 * Honest connectivity banner — local-only when offline.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #92400E, #B45309)',
        color: '#FFFBEB',
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 16px',
        textAlign: 'center',
        letterSpacing: 0.2,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      You are offline — working from local data only. Changes will sync when the connection returns.
    </div>
  );
}
