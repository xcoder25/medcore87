import React, { useEffect, useState } from 'react';
import { RealtimeEvent } from '../../hooks/useRealtimeEvents';

interface AlertBannerProps {
  alert: RealtimeEvent | null;
  onDismiss: () => void;
}

interface AlertConfig {
  icon: string;
  bg: string;
  border: string;
  title: string;
  actionLabel?: string;
}

function getAlertConfig(topic: string): AlertConfig {
  switch (topic) {
    case 'SEPSIS_ALERT':
      return { icon: '🚨', bg: 'rgba(255,45,85,0.18)', border: '#ff2d55', title: 'SEPSIS ALERT', actionLabel: 'Initiate Bundle' };
    case 'NEWS2_DETERIORATION':
      return { icon: '🔴', bg: 'rgba(255,58,48,0.15)', border: '#ff3a30', title: 'PATIENT DETERIORATING', actionLabel: 'Review Now' };
    case 'VITALS_ALERT':
      return { icon: '⚠️', bg: 'rgba(255,149,0,0.15)', border: '#ff9500', title: 'CRITICAL VITAL SIGN' };
    case 'EPIDEMIC_SURGE_ALERT':
      return { icon: '🦠', bg: 'rgba(255,45,85,0.18)', border: '#ff2d55', title: 'EPIDEMIC SURGE ALERT' };
    case 'BREAK_GLASS_TRIGGERED':
      return { icon: '🔓', bg: 'rgba(255,45,85,0.2)', border: '#ff2d55', title: 'EMERGENCY ACCESS TRIGGERED' };
    default:
      return { icon: '🔔', bg: 'rgba(10,132,255,0.15)', border: '#0a84ff', title: topic.replace(/_/g, ' ') };
  }
}

export default function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  const [visible, setVisible] = useState(false);
  const [autoDismissProgress, setAutoDismissProgress] = useState(100);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      setAutoDismissProgress(100);

      // Auto-dismiss non-sepsis alerts after 15s
      if (alert.topic !== 'SEPSIS_ALERT') {
        const start = Date.now();
        const duration = 15000;
        const interval = setInterval(() => {
          const elapsed = Date.now() - start;
          const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
          setAutoDismissProgress(remaining);
          if (remaining === 0) {
            clearInterval(interval);
            handleDismiss();
          }
        }, 100);
        return () => clearInterval(interval);
      }
    } else {
      setVisible(false);
    }
  }, [alert]);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  if (!alert) return null;

  const config = getAlertConfig(alert.topic);
  const payload = alert.payload as Record<string, unknown>;

  return (
    <div
      id="alert-banner"
      style={{
        position: 'fixed', top: 16, left: '50%', transform: `translateX(-50%) translateY(${visible ? 0 : -120}px)`,
        zIndex: 99999, width: 480, maxWidth: 'calc(100vw - 32px)',
        background: config.bg, border: `1.5px solid ${config.border}`,
        borderRadius: 14, boxShadow: `0 8px 40px ${config.border}44, 0 2px 8px rgba(0,0,0,0.5)`,
        backdropFilter: 'blur(20px)', transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}
    >
      {/* Auto-dismiss progress bar */}
      {alert.topic !== 'SEPSIS_ALERT' && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          height: 3, background: config.border,
          width: `${autoDismissProgress}%`, transition: 'width 0.1s linear',
          opacity: 0.7,
        }} />
      )}

      <div style={{ padding: '14px 16px', display: 'flex', gap: 12 }}>
        {/* Icon */}
        <div style={{
          fontSize: 28, minWidth: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'alertPulse 1s ease-in-out infinite',
        }}>
          {config.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: config.border, letterSpacing: 1.2, marginBottom: 3 }}>
            {config.title}
          </div>

          {Boolean(payload.patientName) && (
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {String(payload.patientName)}
            </div>
          )}

          {payload.news2Score !== undefined && (
            <div style={{ fontSize: 13, color: '#e5e5ea' }}>
              NEWS2 Score: <strong style={{ color: config.border }}>{Number(payload.news2Score)}</strong>
              {' · '}{String(payload.riskLevel || '')}
            </div>
          )}

          {payload.qsofaScore !== undefined && (
            <div style={{ fontSize: 13, color: '#e5e5ea' }}>
              qSOFA: <strong style={{ color: config.border }}>{Number(payload.qsofaScore)}/3</strong>
              {' · '}Initiate Sepsis Bundle immediately
            </div>
          )}

          {Boolean(payload.recommendation) && (
            <div style={{ fontSize: 12, color: '#aeaeb2', marginTop: 4 }}>
              {String(payload.recommendation)}
            </div>
          )}

          {Boolean(payload.alerts && Array.isArray(payload.alerts)) && (
            <div style={{ marginTop: 4 }}>
              {(payload.alerts as string[]).slice(0, 2).map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: '#aeaeb2' }}>{a}</div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {config.actionLabel && (
              <button style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: config.border, color: '#fff', fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
              }}>
                {config.actionLabel}
              </button>
            )}
            <button
              id="dismiss-alert-btn"
              onClick={handleDismiss}
              style={{
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${config.border}`,
                background: 'transparent', color: config.border, fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes alertPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
