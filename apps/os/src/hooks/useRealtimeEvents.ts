/**
 * MedCore Real-Time Event Hook
 * Connects to the WebSocket event bus and dispatches events to subscribers
 */

import { useState, useEffect, useCallback, useRef } from 'react';

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

const WS_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WS_URL) ||
  'ws://localhost:4000/ws';
const RECONNECT_DELAY_MS = 3000;
const MAX_NOTIFICATIONS = 100;

interface UseRealtimeEventsOptions {
  app?: string;
  facilityId?: string;
  topics?: string[];
  onEvent?: (event: RealtimeEvent) => void;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [connected, setConnected]         = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<RealtimeEvent | null>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  const addNotification = useCallback((event: RealtimeEvent) => {
    const item: NotificationItem = { ...event, read: false, receivedAt: new Date().toISOString() };
    setNotifications(prev => {
      const next = [item, ...prev].slice(0, MAX_NOTIFICATIONS);
      return next;
    });
    setUnreadCount(c => c + 1);

    // Surface critical alerts as a banner
    const priority = event.priority;
    const criticalTopics = ['SEPSIS_ALERT', 'NEWS2_DETERIORATION', 'VITALS_ALERT', 'EPIDEMIC_SURGE_ALERT', 'BREAK_GLASS_TRIGGERED'];
    if (priority === 'CRITICAL' || criticalTopics.includes(event.topic)) {
      setCriticalAlert(event);
    }

    options.onEvent?.(event);
  }, [options.onEvent]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        // Send subscription handshake
        ws.send(JSON.stringify({
          action: 'SUBSCRIBE',
          app: options.app || 'MEDCORE_OS',
          facilityId: options.facilityId,
          topics: options.topics || [], // Empty = subscribe to all
        }));
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data) as RealtimeEvent;
          if (data.topic && data.eventId) {
            addNotification(data);
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        // Auto-reconnect
        setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch { /* WebSocket not available in SSR */ }
  }, [addNotification, options.app, options.facilityId, options.topics]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((eventId: string) => {
    setNotifications(prev =>
      prev.map(n => n.eventId === eventId ? { ...n, read: true } : n)
    );
    setUnreadCount(c => Math.max(0, c - 1));
  }, []);

  const dismissCriticalAlert = useCallback(() => setCriticalAlert(null), []);

  const criticalNotifications = notifications.filter(n =>
    ['SEPSIS_ALERT', 'NEWS2_DETERIORATION', 'VITALS_ALERT'].includes(n.topic)
  );

  return {
    notifications,
    unreadCount,
    connected,
    criticalAlert,
    criticalNotifications,
    markAllRead,
    markRead,
    dismissCriticalAlert,
  };
}
