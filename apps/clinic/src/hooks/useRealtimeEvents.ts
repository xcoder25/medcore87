/**
 * MedCore Real-Time Event Hook (Clinic App)
 * Mirrors the OS hook, connects to same WebSocket bus
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

const WS_URL = 'ws://localhost:4000/ws';
const MAX_NOTIFICATIONS = 100;

export function useRealtimeEvents(options: { app?: string; facilityId?: string; topics?: string[] } = {}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [connected, setConnected]         = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<RealtimeEvent | null>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  const addNotification = useCallback((event: RealtimeEvent) => {
    const item: NotificationItem = { ...event, read: false, receivedAt: new Date().toISOString() };
    setNotifications(prev => [item, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount(c => c + 1);
    const criticalTopics = ['SEPSIS_ALERT', 'NEWS2_DETERIORATION', 'VITALS_ALERT', 'AI_CDS_ALERT'];
    if (event.priority === 'CRITICAL' || criticalTopics.includes(event.topic)) setCriticalAlert(event);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        ws.send(JSON.stringify({ action: 'SUBSCRIBE', app: options.app || 'MEDCORE_CLINIC', facilityId: options.facilityId, topics: options.topics || [] }));
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data) as RealtimeEvent;
          if (data.topic && data.eventId) addNotification(data);
        } catch { /**/ }
      };
      ws.onclose = () => { if (!mountedRef.current) return; setConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    } catch { /**/ }
  }, [addNotification, options.app, options.facilityId, options.topics]);

  useEffect(() => { mountedRef.current = true; connect(); return () => { mountedRef.current = false; wsRef.current?.close(); }; }, []);

  const markAllRead = useCallback(() => { setNotifications(p => p.map(n => ({ ...n, read: true }))); setUnreadCount(0); }, []);
  const markRead = useCallback((id: string) => {
    setNotifications(p => p.map(n => n.eventId === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  }, []);
  const dismissCriticalAlert = useCallback(() => setCriticalAlert(null), []);

  return { notifications, unreadCount, connected, criticalAlert, markAllRead, markRead, dismissCriticalAlert };
}
