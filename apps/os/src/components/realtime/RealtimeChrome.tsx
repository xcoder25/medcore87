/**
 * LIVE status pill + notification bell + critical alert banner
 * for MedCore OS top bar (WebSocket event bus).
 */
'use client';

import React from 'react';
import NotificationBell from './NotificationBell';
import AlertBanner from './AlertBanner';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';

interface RealtimeChromeProps {
  facilityId?: string;
  app?: string;
}

export function RealtimeChrome({ facilityId, app = 'MEDCORE_OS' }: RealtimeChromeProps) {
  const { connected, criticalAlert, dismissCriticalAlert } = useRealtimeEvents({
    app,
    facilityId,
  });

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
      {/* Bell opens its own subscription for the feed panel */}
      <NotificationBell app={app} facilityId={facilityId} />
      <AlertBanner alert={criticalAlert} onDismiss={dismissCriticalAlert} />
    </>
  );
}

export default RealtimeChrome;
