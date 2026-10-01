'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useRealtimeEvents, NotificationItem } from '../../hooks/useRealtimeEvents';

function getTopicMeta(topic: string): { icon: string; color: string; label: string } {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    SEPSIS_ALERT: { icon: '🚨', color: '#ff2d55', label: 'Sepsis Alert' },
    NEWS2_DETERIORATION: { icon: '🔴', color: '#ff3a30', label: 'Patient Deterioration' },
    VITALS_ALERT: { icon: '⚠️', color: '#ff9500', label: 'Vitals Alert' },
    LAB_RESULT_READY: { icon: '🧪', color: '#30d158', label: 'Lab Result Ready' },
    RADIOLOGY_REPORT_READY: { icon: '🩻', color: '#64d2ff', label: 'Radiology Report' },
    PRESCRIPTION_CREATED: { icon: '💊', color: '#5e5ce6', label: 'New Prescription' },
    PRESCRIPTION_DISPENSED: { icon: '✅', color: '#30d158', label: 'Drug Dispensed' },
    DRUG_STOCKOUT: { icon: '📦', color: '#ff9f0a', label: 'Stockout Alert' },
    BED_OCCUPIED: { icon: '🛏️', color: '#0a84ff', label: 'Bed Occupied' },
    BED_VACATED: { icon: '🛏️', color: '#636366', label: 'Bed Vacated' },
    PATIENT_REGISTERED: { icon: '👤', color: '#32ade6', label: 'Patient Registered' },
    DISCHARGE_READY: { icon: '🏠', color: '#30d158', label: 'Discharge Ready' },
    THEATRE_BOOKED: { icon: '🔪', color: '#bf5af2', label: 'Theatre Booked' },
    THEATRE_CASE_STARTED: { icon: '⚡', color: '#ff9500', label: 'Surgery Started' },
    THEATRE_CASE_COMPLETED: { icon: '✅', color: '#30d158', label: 'Surgery Completed' },
    HMO_PREAUTH_APPROVED: { icon: '✅', color: '#30d158', label: 'HMO Pre-Auth Approved' },
    HMO_PREAUTH_REJECTED: { icon: '❌', color: '#ff3a30', label: 'HMO Pre-Auth Rejected' },
    DHIS2_SYNC_COMPLETE: { icon: '📡', color: '#64d2ff', label: 'DHIS2 Sync Done' },
    AI_CDS_ALERT: { icon: '🤖', color: '#bf5af2', label: 'AI Clinical Alert' },
    EPIDEMIC_SURGE_ALERT: { icon: '🦠', color: '#ff2d55', label: 'Epidemic Surge' },
  };
  return map[topic] || { icon: '🔔', color: '#636366', label: topic.replace(/_/g, ' ') };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

interface Props {
  app?: string;
  facilityId?: string;
  /** When true, render only the circular icon trigger (for Hospital OS header) */
  compact?: boolean;
}

export const NotificationBell: React.FC<Props> = ({ app = 'MEDCORE_OS', facilityId, compact = true }) => {
  const { notifications, unreadCount, markRead, markAllRead } = useRealtimeEvents({ app, facilityId });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const list = (notifications || []).slice(0, 40);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="os-top-hud-icon-btn"
        title="Notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="os-hud-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 360,
            maxWidth: '92vw',
            maxHeight: 420,
            overflow: 'hidden',
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            boxShadow: '0 16px 48px rgba(15,23,42,0.16)',
            zIndex: 10050,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Notifications</div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead?.()}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#0284C7',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {list.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              list.map((n: NotificationItem) => {
                const meta = getTopicMeta(n.topic || '');
                return (
                  <button
                    key={n.eventId}
                    type="button"
                    onClick={() => {
                      markRead?.(n.eventId);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: '1px solid #F1F5F9',
                      background: n.read ? '#fff' : '#F0F9FF',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{meta.label}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
                        {String((n as any).payload?.message || n.topic || '')}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        {n.timestamp ? timeAgo(n.timestamp) : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: n.read ? 'transparent' : meta.color,
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
