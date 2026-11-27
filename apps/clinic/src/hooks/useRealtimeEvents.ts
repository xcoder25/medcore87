/**
 * MedCore Real-Time Event Hook (Mobile <-> MedCore OS)
 * Uses OS SSE stream (/api/facility/stream) with authenticated sync poll fallback.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getEmrBaseUrl, fetchFacilityState } from '../services/emrSyncClient';

export type EventPriority = 'INFO' | 'HIGH' | 'CRITICAL';

export interface RealtimeEvent {
  eventId: string;
  topic: string;
  facilityId?: string;
  emitterApp: string;
  timestamp: string;
  payload: Record<string, unknown>;
  priority?: EventPriority;
  traceId: string;
}

export interface NotificationItem extends RealtimeEvent {
  read: boolean;
  receivedAt: string;
}

const MAX_NOTIFICATIONS = 100;

export function useRealtimeEvents(
  options: { app?: string; facilityId?: string; sessionToken?: string; topics?: string[] } = {}
) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<RealtimeEvent | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const addNotification = useCallback((event: RealtimeEvent) => {
    if (seenIdsRef.current.has(event.eventId)) return;
    seenIdsRef.current.add(event.eventId);

    const item: NotificationItem = {
      ...event,
      read: false,
      receivedAt: new Date().toISOString(),
    };
    setNotifications((prev) => [item, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((c) => c + 1);
    const criticalTopics = ['SEPSIS_ALERT', 'NEWS2_DETERIORATION', 'VITALS_ALERT', 'AI_CDS_ALERT', 'CODE_BLUE'];
    if (event.priority === 'CRITICAL' || criticalTopics.includes(event.topic)) {
      setCriticalAlert(event);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const base = getEmrBaseUrl();
    const facilityId = options.facilityId || 'IGH-EKT';
    if (!base) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        es = new EventSource(`${base}/api/facility/stream?facilityId=${encodeURIComponent(facilityId)}`);
        es.onopen = () => {
          if (mountedRef.current) setConnected(true);
        };
        es.onmessage = (evt) => {
          if (!mountedRef.current) return;
          setConnected(true);
          try {
            const data = JSON.parse(evt.data) as Record<string, unknown>;
            const key = String(data.key || data.topic || 'EMR_UPDATE');
            if (key === 'heartbeat') return;
            const sentAt = String((data.value as any)?.sentAt || data.timestamp || new Date().toISOString());
            addNotification({
              eventId: String(data.eventId || `${key}:${sentAt}`),
              topic: key.toUpperCase(),
              facilityId,
              emitterApp: 'MEDCORE_OS',
              timestamp: sentAt,
              payload: (data.value as Record<string, unknown>) || data,
              priority: /alert|emergency|critical/i.test(key) ? 'CRITICAL' : 'INFO',
              traceId: `SSE-${Date.now().toString(36)}`,
            });
          } catch {
            /* ignore non-JSON frame */
          }
        };
        es.onerror = () => {
          if (mountedRef.current) setConnected(false);
        };
      } catch {
        setConnected(false);
      }
    }

    const pollTimer = setInterval(() => {
      if (!options.sessionToken) return;
      void fetchFacilityState(facilityId, 'medcore_mobile_admin_broadcast_v1', options.sessionToken).then((res) => {
        if (!mountedRef.current || !res.ok || !res.value) return;
        setConnected(true);
        const val = res.value as { message?: string; actor?: string; sentAt?: string };
        if (val?.message && val?.sentAt) {
          addNotification({
            eventId: `BCAST:${val.sentAt}`,
            topic: 'FACILITY_BROADCAST',
            facilityId,
            emitterApp: 'MEDCORE_OS',
            timestamp: val.sentAt,
            payload: val,
            priority: 'HIGH',
            traceId: `POLL-${Date.now().toString(36)}`,
          });
        }
      });
    }, 20_000);

    return () => {
      mountedRef.current = false;
      es?.close();
      clearInterval(pollTimer);
    };
  }, [addNotification, options.facilityId, options.sessionToken]);

  const markAllRead = useCallback(() => {
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((p) => p.map((n) => (n.eventId === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const dismissCriticalAlert = useCallback(() => setCriticalAlert(null), []);

  return {
    notifications,
    unreadCount,
    connected,
    criticalAlert,
    markAllRead,
    markRead,
    dismissCriticalAlert,
  };
}
