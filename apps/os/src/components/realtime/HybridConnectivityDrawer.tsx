'use client';

/**
 * Hospital Connectivity Status Badge.
 * Displays a quiet, non-intrusive status indicator (Online / LAN Hub / Offline) in the header.
 * No distracting popups or debug drawers.
 */
import React, { useEffect, useState } from 'react';
import {
  getConnectivityStatus,
  CONNECTIVITY_EVENT,
  type ConnectivityStatus,
  type ConnectivityTier,
} from '../../lib/connectivityCircuitBreaker';
import {
  readStoredEvents,
  DELTA_SYNC_EVENT,
} from '../../lib/deltaSyncEngine';
import { getOutboxPendingCount } from '../../lib/durableOutbox';

export const HybridConnectivityDrawer: React.FC = () => {
  const [status, setStatus] = useState<ConnectivityStatus>(getConnectivityStatus);
  const [pendingCount, setPendingCount] = useState(0);

  const reloadData = () => {
    setStatus(getConnectivityStatus());
    const evts = readStoredEvents();
    const pendEvts = evts.filter((e) => e.syncStatus === 'pending').length;
    const obxCount = getOutboxPendingCount();
    setPendingCount(pendEvts + obxCount);
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

  const getTierMeta = (tier: ConnectivityTier) => {
    switch (tier) {
      case 'CLOUD_PRIMARY':
        return {
          label: 'Online',
          subtext: 'Hospital Cloud active · Realtime connected',
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.1)',
          border: 'rgba(16, 185, 129, 0.25)',
        };
      case 'ONSITE_FALLBACK':
        return {
          label: 'LAN Hub',
          subtext: 'Hospital LAN active · Local fallback engaged',
          color: '#0284C7',
          bg: 'rgba(2, 132, 199, 0.1)',
          border: 'rgba(2, 132, 199, 0.25)',
        };
      case 'OFFLINE_LOCAL':
      default:
        return {
          label: 'Offline',
          subtext: 'Zero network · Saved to local durable ledger',
          color: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.1)',
          border: 'rgba(239, 68, 68, 0.25)',
        };
    }
  };

  const meta = getTierMeta(status.tier);

  return (
    <div
      className="admin-shell-online"
      title={meta.subtext}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        fontSize: '0.76rem',
        fontWeight: 700,
        cursor: 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: meta.color,
          boxShadow: `0 0 6px ${meta.color}`,
        }}
      />
      <span>{meta.label}</span>
      {pendingCount > 0 && (
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 8,
            background: meta.color,
            color: '#FFFFFF',
            fontSize: '0.65rem',
            fontWeight: 800,
          }}
        >
          {pendingCount} queued
        </span>
      )}
    </div>
  );
};

export default HybridConnectivityDrawer;
