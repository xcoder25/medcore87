'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Download, Wifi, WifiOff, X, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaManager: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [installedNotice, setInstalledNotice] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already in standalone PWA mode
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let swInterval: any = null;
    let handleFocus: (() => void) | null = null;

    // Register Service Worker with intelligent update detection
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[MedCore PWA] ServiceWorker registered with scope:', reg.scope);

          // If there is already a waiting worker, notify user immediately
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setUpdateAvailable(true);
          }

          // Listen for new worker updates
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[MedCore PWA] New update installed and waiting activation.');
                setWaitingWorker(installing);
                setUpdateAvailable(true);
              }
            });
          });

          // Check for updates when user returns to app/tab
          handleFocus = () => {
            reg.update().catch(() => {});
          };
          window.addEventListener('focus', handleFocus);

          // Periodically check every 10 minutes
          swInterval = setInterval(() => {
            reg.update().catch(() => {});
          }, 10 * 60 * 1000);
        })
        .catch((err) => {
          console.warn('[MedCore PWA] ServiceWorker registration failed:', err);
        });

      // Reload page once new controller takes over
      let refreshing = false;
      const handleControllerChange = () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstalledNotice(true);
      setTimeout(() => setInstalledNotice(false), 4000);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (handleFocus) window.removeEventListener('focus', handleFocus);
      if (swInterval) clearInterval(swInterval);
    };
  }, []);

  const handleApplyUpdate = useCallback(() => {
    setIsUpdating(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }, [waitingWorker]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      {/* Offline Alert Strip */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 20,
            zIndex: 99999,
            background: '#991B1B',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <WifiOff size={16} color="#FECACA" />
          <span>Offline Mode Active • Local station data cache operational</span>
        </aside>
      )}

      {/* Installed Confirmation Toast */}
      {installedNotice && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 99999,
            background: '#064E3B',
            color: '#A7F3D0',
            border: '1px solid #059669',
            borderRadius: 12,
            padding: '12px 18px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={18} color="#34D399" />
          <span>MedCore OS installed successfully as a desktop app!</span>
        </aside>
      )}

      {/* Install Banner — shown on desktop / tablet when install prompt is available */}
      {deferredPrompt && !isStandalone && !dismissed && (
        <aside
          role="region"
          aria-label="Install Application"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 99998,
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: '14px 18px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            maxWidth: 420,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#0284C7,#0D9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Download size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#F8FAFC' }}>
              Install MedCore OS App
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 1.4 }}>
              Add to desktop or tablet for fast offline access and native hospital station performance.
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#0284C7',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss install prompt"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </aside>
      )}

      {/* New Deployment Update Available Floating Notification */}
      {updateAvailable && (
        <aside
          role="status"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 100000,
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            border: '2px solid #0284C7',
            borderRadius: 16,
            padding: '16px 20px',
            color: '#fff',
            boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            maxWidth: 440,
            animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 8px 16px rgba(2, 132, 199, 0.35)',
            }}
          >
            <Sparkles size={22} color="#fff" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                System Update Ready
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: '#0284C7',
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                Live
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3, lineHeight: 1.4 }}>
              A fresh MedCore OS build was deployed. Reload now to apply the latest clinical updates.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #026ca3 100%)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                cursor: isUpdating ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                transition: 'transform 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={isUpdating ? 'spin' : ''} />
              {isUpdating ? 'Updating…' : 'Update & Reload'}
            </button>
            <button
              type="button"
              onClick={() => setUpdateAvailable(false)}
              aria-label="Dismiss update"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </aside>
      )}
    </>
  );
};
