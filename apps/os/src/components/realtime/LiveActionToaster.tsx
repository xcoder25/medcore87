'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { subscribeLiveActions, type LiveActionDetail } from '../../lib/liveActions';

/**
 * Global toast for any OS button that calls emitLiveAction / medcore-live-action.
 * Mount once in page.tsx shell.
 */
export const LiveActionToaster: React.FC = () => {
  const [toast, setToast] = useState<LiveActionDetail | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = subscribeLiveActions((d) => {
      setToast(d);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 3600);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className="os-live-toast"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 10000,
        maxWidth: 380,
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
        border: '1px solid rgba(0, 82, 212, 0.22)',
        borderRadius: 14,
        padding: '12px 16px',
        boxShadow: '0 16px 40px rgba(0, 82, 212, 0.18)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        animation: 'osToastIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #0052D4, #00BFA5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Zap size={16} color="#fff" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0052D4', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Live action
        </div>
        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0A2540', lineHeight: 1.4, marginTop: 2 }}>
          {toast.message}
        </div>
        {toast.module && (
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>{toast.module}</div>
        )}
      </div>
      <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
    </div>
  );
};
