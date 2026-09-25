'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  title?: string;
  subtitle?: string;
}

const BOOT_STATUSES = [
  'Initializing Secure Hospital Gateway...',
  'Connecting State Health EHR Database...',
  'Syncing Inpatient Ward Telemetry...',
  'Verifying Staff IAM & Clearance Levels...',
  'M87 Clinical Intelligence Ready',
];

/** Hard cap: splash finishes in ~1.8s (always under 5s). */
const SPLASH_MS = 1800;

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(BOOT_STATUSES[0]);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    doneRef.current = false;
    const startTime = Date.now();

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setProgress(100);
      setStatusText(BOOT_STATUSES[4]);
      onCompleteRef.current();
    };

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / SPLASH_MS) * 100), 100);
      setProgress(pct);

      if (pct < 25) setStatusText(BOOT_STATUSES[0]);
      else if (pct < 50) setStatusText(BOOT_STATUSES[1]);
      else if (pct < 75) setStatusText(BOOT_STATUSES[2]);
      else if (pct < 95) setStatusText(BOOT_STATUSES[3]);
      else setStatusText(BOOT_STATUSES[4]);

      if (elapsed >= SPLASH_MS) {
        clearInterval(timer);
        finish();
      }
    }, 32);

    const hardCap = setTimeout(finish, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(hardCap);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #F0F6FD 0%, #E7F1FB 45%, #EEF6FC 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '8%',
          opacity: 0.16,
          color: '#0284C7',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        <svg width="76" height="76" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
        </svg>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '22%',
          right: '18%',
          opacity: 0.18,
          color: '#0284C7',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
          padding: '0 24px',
        }}
      >
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
          <img
            src="/hospital-os-main-brand.png"
            alt="Hospital OS - ARISE"
            width={480}
            height={160}
            decoding="async"
            
            fetchPriority="high"
            style={{
              width: '100%',
              maxWidth: 'min(420px, 82vw)',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 20px rgba(15, 41, 69, 0.06))',
              userSelect: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 'clamp(200px, 25vw, 240px)',
              height: 7,
              borderRadius: 9999,
              background: 'rgba(203, 213, 225, 0.65)',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #0052D4 0%, #0099FF 50%, #00C9A7 100%)',
                borderRadius: 9999,
                transition: 'width 0.05s linear',
                boxShadow: '0 0 12px rgba(0, 153, 255, 0.55)',
              }}
            />
          </div>

          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334D6E', letterSpacing: '0.015em' }}>
            {statusText}
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          lineHeight: 0,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <svg
          viewBox="0 0 1440 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#0052D4" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#0084FF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00C9A7" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="waveGrad2" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#003E99" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#00A896" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#02C39A" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <path
            d="M0,130 C320,50 620,180 1020,100 C1240,55 1360,90 1440,110 L1440,220 L0,220 Z"
            fill="url(#waveGrad2)"
          />
          <path
            d="M0,170 C280,100 580,210 960,135 C1180,95 1340,130 1440,140 L1440,220 L0,220 Z"
            fill="url(#waveGrad1)"
          />
          <path
            d="M0,170 C280,100 580,210 960,135 C1180,95 1340,130 1440,140"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
};
