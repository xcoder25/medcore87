'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff, CheckCircle2, RefreshCw, AlertTriangle, Database } from 'lucide-react';
import {
  clearSyncedOfflineMutations,
  flushOfflineQueue,
  getOfflineSyncStats,
  listOfflineQueue,
  type OfflineQueuedMutation,
} from '../../lib/offlineSyncEngine';

/**
 * Connectivity, Rural Offline-First Sync Queue & Deterministic Conflict Banner.
 * Strictly vendor-neutral UI.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [syncStats, setSyncStats] = useState(() => getOfflineSyncStats());
  const [queueOpen, setQueueOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [items, setItems] = useState<OfflineQueuedMutation[]>([]);
  const [swEnabled, setSwEnabled] = useState(false);

  const refreshQueue = useCallback(() => {
    setSyncStats(getOfflineSyncStats());
    setItems(listOfflineQueue());
  }, []);

  const triggerSyncNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setSyncBusy(true);
    try {
      await flushOfflineQueue();
      refreshQueue();
    } finally {
      setSyncBusy(false);
    }
  }, [refreshQueue]);

  useEffect(() => {
    refreshQueue();
    const handleOnline = () => {
      setOffline(false);
      setJustReconnected(true);
      void triggerSyncNow();
      setTimeout(() => setJustReconnected(false), 3800);
    };
    const handleOffline = () => {
      setJustReconnected(false);
      setOffline(true);
    };
    const handleQueueChange = () => refreshQueue();

    if (typeof navigator !== 'undefined') {
      setOffline(!navigator.onLine);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          setSwEnabled(regs.some((r) => r.active));
        }).catch(() => {});
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('medcore:offline-sync-updated', handleQueueChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('medcore:offline-sync-updated', handleQueueChange);
    };
  }, [refreshQueue, triggerSyncNow]);

  const toggleRuralPwaCache = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (swEnabled) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      setSwEnabled(false);
    } else {
      try {
        await navigator.serviceWorker.register('/sw.js');
        setSwEnabled(true);
      } catch {
        setSwEnabled(false);
      }
    }
  };

  const hasQueueActivity = syncStats.pendingCount > 0 || syncStats.conflictCount > 0;

  return (
    <>
      {justReconnected && (
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
          }}
        >
          <CheckCircle2 size={16} />
          <span>Connection restored · Synchronizing queued facility writes with MedCore cloud.</span>
        </div>
      )}

      {(offline || hasQueueActivity) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 9998,
            background: offline
              ? 'linear-gradient(90deg, #92400E, #B45309)'
              : syncStats.conflictCount > 0
                ? '#7F1D1D'
                : '#0F172A',
            color: '#FFFBEB',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {offline ? <WifiOff size={15} /> : syncStats.conflictCount > 0 ? <AlertTriangle size={15} /> : <Database size={15} />}
            <span>
              {offline
                ? `Working Offline — Local write queue active (${syncStats.pendingCount} queued).`
                : `Rural Sync Queue: ${syncStats.pendingCount} pending · ${syncStats.conflictCount} conflict(s) · ${syncStats.syncedCount} synced`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => void toggleRuralPwaCache()}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {swEnabled ? 'Offline Cache: ON' : 'Enable Rural Cache'}
            </button>
            {!offline && syncStats.pendingCount > 0 && (
              <button
                type="button"
                disabled={syncBusy}
                onClick={() => void triggerSyncNow()}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#10B981',
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RefreshCw size={12} />
                <span>{syncBusy ? 'Syncing…' : 'Sync Now'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'transparent',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {queueOpen ? 'Hide Queue' : 'Inspect Queue'}
            </button>
          </div>
        </div>
      )}

      {queueOpen && (
        <div
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #CBD5E1',
            padding: '12px 18px',
            fontSize: 12,
            color: '#0F172A',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Offline Mutation Queue &amp; Conflict Resolver ({items.length})</strong>
            <button
              type="button"
              onClick={() => {
                clearSyncedOfflineMutations();
                refreshQueue();
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Clear Synced
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ color: '#64748B' }}>Queue is clean — zero pending offline writes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {items.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: m.status === 'conflict' ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                    background: m.status === 'conflict' ? '#FEF2F2' : '#F8FAFC',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {m.domain} · {m.entityId} ({m.status.toUpperCase()})
                  </div>
                  {m.conflictNote && <div style={{ color: '#B91C1C', fontSize: 11 }}>{m.conflictNote}</div>}
                  {m.lastError && <div style={{ color: '#B45309', fontSize: 11 }}>{m.lastError}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
