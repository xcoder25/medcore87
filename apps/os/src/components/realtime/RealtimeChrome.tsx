'use client';

/**
 * LIVE status pill + notification bell + critical alert banner
 * for MedCore OS top bar. Includes subtle hub/outbox state for poor networks.
 */

import React, { useEffect, useState } from 'react';
import NotificationBell from './NotificationBell';
import AlertBanner from './AlertBanner';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { isLanApiEligible, isHospitalApiKnown, probeHospitalApi } from '../../lib/hospitalSync';
import { getOutboxPendingCount } from '../../lib/durableOutbox';
import { getNetworkTier, type NetworkTier } from '../../lib/poorNetwork';

interface RealtimeChromeProps {
  facilityId?: string;
  app?: string;
}

export function RealtimeChrome({ facilityId, app = 'MEDCORE_OS' }: RealtimeChromeProps) {
  const { connected, criticalAlert, dismissCriticalAlert } = useRealtimeEvents({
    app,
    facilityId,
  });
  const [tier, setTier] = useState<NetworkTier>('good');
  const [hubOk, setHubOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const tick = () => {
      setTier(getNetworkTier());
      setPending(getOutboxPendingCount());
      setHubOk(isHospitalApiKnown());
    };
    tick();
    const id = setInterval(tick, 8000);
    const onNet = () => tick();
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    if (isLanApiEligible()) {
      void probeHospitalApi().then((ok) => setHubOk(ok));
    }
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, []);

  const pathTitle =
    hubOk === true
      ? 'Onsite hub reachable (LAN)'
      : isLanApiEligible()
        ? 'Onsite hub configured — probing…'
        : tier === 'offline'
          ? 'Offline — critical writes queued'
          : tier === 'poor'
            ? 'Slow link — smaller lists, critical sync only'
            : 'Cloud sync';

  const pathLabel =
    hubOk === true
      ? 'HUB'
      : pending > 0
        ? `Q${pending}`
        : tier === 'offline'
          ? 'OFF'
          : tier === 'poor'
            ? '2G'
            : null;

  return (
    <>
      <span
        className="os-pill os-pill-live"
        title={connected ? 'Connected to MedCore event bus' : 'Reconnecting to event bus…'}
      >
        <span
          className="dot"
          style={{
            background: connected ? '#4ADE80' : '#F59E0B',
            boxShadow: connected ? '0 0 8px rgba(74, 222, 128, 0.55)' : undefined,
          }}
        />
        {connected ? 'LIVE' : 'SYNC…'}
      </span>
      {pathLabel && (
        <span
          className="os-pill"
          title={pathTitle}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            opacity: 0.9,
            border: '1px solid rgba(148,163,184,0.35)',
            color:
              hubOk === true ? '#6EE7B7' : pending > 0 ? '#FCD34D' : tier === 'offline' ? '#FCA5A5' : '#93C5FD',
          }}
        >
          {pathLabel}
        </span>
      )}
      <NotificationBell app={app} facilityId={facilityId} />
      <AlertBanner alert={criticalAlert} onDismiss={dismissCriticalAlert} />
    </>
  );
}

export default RealtimeChrome;
