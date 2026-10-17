'use client';

import React, { useEffect, useState } from 'react';
import {
  getConnectivityStatus,
  tickConnectivityCheck,
  CONNECTIVITY_EVENT,
  type ConnectivityStatus,
  type ConnectivityTier,
} from '../../lib/connectivityCircuitBreaker';
import {
  readStoredEvents,
  readReconciliationQueue,
  processPendingDeltaSync,
  DELTA_SYNC_EVENT,
  type ClinicalDeltaEvent,
} from '../../lib/deltaSyncEngine';
import { flushOutbox, getOutboxPendingCount } from '../../lib/durableOutbox';
import {
  Cloud,
  Server,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Activity,
  ShieldCheck,
  Zap,
  Radio,
} from 'lucide-react';

export const HybridConnectivityDrawer: React.FC = () => {
  const [status, setStatus] = useState<ConnectivityStatus>(getConnectivityStatus);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [reconcileQueue, setReconcileQueue] = useState<ClinicalDeltaEvent[]>([]);
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null);

  const reloadData = () => {
    setStatus(getConnectivityStatus());
    const evts = readStoredEvents();
    const pendEvts = evts.filter((e) => e.syncStatus === 'pending').length;
    const obxCount = getOutboxPendingCount();
    setPendingCount(pendEvts + obxCount);
    setReconcileQueue(readReconciliationQueue());
  };

  useEffect(() => {
    reloadData();
    const onConn = (e: Event) => {
      const detail = (e as CustomEvent<ConnectivityStatus>).detail;
      setStatus(detail || getConnectivityStatus());
      reloadData();
    };
    const onDelta = () => reloadData();

    window.addEventListener(CONNECTIVITY_EVENT, onConn);
    window.addEventListener(DELTA_SYNC_EVENT, onDelta);
    window.addEventListener('online', reloadData);
    window.addEventListener('offline', reloadData);

    const iv = setInterval(reloadData, 3000);

    return () => {
      window.removeEventListener(CONNECTIVITY_EVENT, onConn);
      window.removeEventListener(DELTA_SYNC_EVENT, onDelta);
      window.removeEventListener('online', reloadData);
      window.removeEventListener('offline', reloadData);
      clearInterval(iv);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    setLastSyncMsg(null);
    try {
      await tickConnectivityCheck();
      const deltaRes = await processPendingDeltaSync();
      const outboxRes = await flushOutbox();
      setLastSyncMsg(
        `Synchronized ${deltaRes.synced} events & ${outboxRes.synced} facility keys. ${deltaRes.conflicts} conflicts flagged.`
      );
    } catch {
      setLastSyncMsg('Sync cycle attempted; offline changes preserved in durable ledger.');
    } finally {
      reloadData();
      setSyncing(false);
    }
  };

  const getTierMeta = (tier: ConnectivityTier) => {
    switch (tier) {
      case 'CLOUD_PRIMARY':
        return {
          label: 'Cloud Primary',
          subtext: 'Realtime active',
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.28)',
          Icon: Cloud,
        };
      case 'ONSITE_FALLBACK':
        return {
          label: 'Onsite Server Active',
          subtext: 'Hospital LAN Fallback',
          color: '#0284C7',
          bg: 'rgba(2, 132, 199, 0.12)',
          border: 'rgba(2, 132, 199, 0.28)',
          Icon: Server,
        };
      case 'OFFLINE_LOCAL':
      default:
        return {
          label: 'Local Isolated',
          subtext: 'Client Journal Active',
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.14)',
          border: 'rgba(245, 158, 11, 0.32)',
          Icon: Smartphone,
        };
    }
  };

  const currentMeta = getTierMeta(status.tier);
  const CurrentIcon = currentMeta.Icon;

  return (
    <>
      {/* ─── Topbar Pill Trigger ─── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Click to view Edge-Cloud Sync Topology & Health"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 10px',
          borderRadius: 20,
          background: currentMeta.bg,
          border: `1px solid ${currentMeta.border}`,
          color: currentMeta.color,
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: currentMeta.color,
            boxShadow: `0 0 8px ${currentMeta.color}`,
          }}
        />
        <CurrentIcon size={13} />
        <span>{currentMeta.label}</span>
        {status.cloudLatencyMs && status.tier === 'CLOUD_PRIMARY' && (
          <span style={{ opacity: 0.8, fontSize: '0.68rem', fontWeight: 600 }}>
            {status.cloudLatencyMs}ms
          </span>
        )}
        {status.onsiteLatencyMs && status.tier === 'ONSITE_FALLBACK' && (
          <span style={{ opacity: 0.8, fontSize: '0.68rem', fontWeight: 600 }}>
            {status.onsiteLatencyMs}ms (LAN)
          </span>
        )}
        {pendingCount > 0 && (
          <span
            style={{
              padding: '1px 5px',
              borderRadius: 8,
              background: currentMeta.color,
              color: '#FFFFFF',
              fontSize: '0.65rem',
              fontWeight: 800,
            }}
          >
            {pendingCount} queued
          </span>
        )}
      </button>

      {/* ─── Edge-Cloud Modal Drawer ─── */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              width: '100%',
              maxWidth: 580,
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                color: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38BDF8',
                  }}
                >
                  <Radio size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                    Hybrid Edge-Cloud Sync Topology
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 2 }}>
                    Realtime Cloud Primary with Onsite Server Resilience
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Active Tier Banner */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: currentMeta.bg,
                  border: `1px solid ${currentMeta.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CurrentIcon size={22} color={currentMeta.color} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: currentMeta.color }}>
                      {currentMeta.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {currentMeta.subtext} · {status.flappingGuarded ? 'Anti-Flap Guard Active' : 'Stable'}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: '#FFFFFF',
                    color: currentMeta.color,
                    border: `1px solid ${currentMeta.border}`,
                  }}
                >
                  CIRCUIT: CLOSED
                </div>
              </div>

              {/* Topology Nodes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {/* Node 1: Cloud */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: status.cloudHealthy ? '#F0FDF4' : '#FEF2F2',
                    textAlign: 'center',
                  }}
                >
                  <Cloud size={18} color={status.cloudHealthy ? '#16A34A' : '#DC2626'} />
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, marginTop: 4 }}>AWS Cloud</div>
                  <div style={{ fontSize: '0.68rem', color: status.cloudHealthy ? '#16A34A' : '#DC2626' }}>
                    {status.cloudHealthy ? `Active (${status.cloudLatencyMs}ms)` : 'Unreachable'}
                  </div>
                </div>

                {/* Node 2: Onsite Edge Server */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: status.onsiteHealthy ? '#F0F9FF' : '#F8FAFC',
                    textAlign: 'center',
                  }}
                >
                  <Server size={18} color={status.onsiteHealthy ? '#0284C7' : '#94A3B8'} />
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, marginTop: 4 }}>Hospital Hub</div>
                  <div style={{ fontSize: '0.68rem', color: status.onsiteHealthy ? '#0284C7' : '#94A3B8' }}>
                    {status.onsiteHealthy ? `LAN Hub (${status.onsiteLatencyMs}ms)` : 'Standby / LAN'}
                  </div>
                </div>

                {/* Node 3: Local Terminal */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#FAF5FF',
                    textAlign: 'center',
                  }}
                >
                  <Smartphone size={18} color="#9333EA" />
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, marginTop: 4 }}>Client Ledger</div>
                  <div style={{ fontSize: '0.68rem', color: '#9333EA' }}>
                    {pendingCount === 0 ? 'Fully Synced' : `${pendingCount} In Outbox`}
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {lastSyncMsg && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#15803D',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>{lastSyncMsg}</span>
                </div>
              )}

              {/* Reconciliation / Clinical Conflict Queue */}
              {reconcileQueue.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309', fontWeight: 800, fontSize: '0.8rem' }}>
                    <AlertTriangle size={15} />
                    <span>Clinical Convergence Alerts ({reconcileQueue.length})</span>
                  </div>
                  <p style={{ margin: '4px 0 8px', fontSize: '0.72rem', color: '#78350F' }}>
                    Concurrent offline updates require clinical confirmation to prevent conflicting orders.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {reconcileQueue.map((item) => (
                      <div
                        key={item.eventId}
                        style={{
                          background: '#FFFFFF',
                          padding: 8,
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          border: '1px solid #FCD34D',
                        }}
                      >
                        <strong>{item.entityType} ({item.entityId})</strong>: {item.conflictReason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Controls */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={syncing}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 82, 212, 0.25)',
                  }}
                >
                  <RefreshCw size={15} className={syncing ? 'auth-spin' : undefined} />
                  <span>{syncing ? 'Synchronizing…' : 'Force Bidirectional Sync'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
