import React, { useState, useRef, useEffect } from 'react';
import { useRealtimeEvents, NotificationItem } from '../../hooks/useRealtimeEvents';

// ─── Topic → Icon + Color ───────────────────────────────────────────────────
function getTopicMeta(topic: string): { icon: string; color: string; label: string } {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    SEPSIS_ALERT:           { icon: '🚨', color: '#ff2d55', label: 'Sepsis Alert' },
    NEWS2_DETERIORATION:    { icon: '🔴', color: '#ff3a30', label: 'Patient Deterioration' },
    VITALS_ALERT:           { icon: '⚠️', color: '#ff9500', label: 'Vitals Alert' },
    LAB_RESULT_READY:       { icon: '🧪', color: '#30d158', label: 'Lab Result Ready' },
    RADIOLOGY_REPORT_READY: { icon: '🩻', color: '#64d2ff', label: 'Radiology Report' },
    PRESCRIPTION_CREATED:   { icon: '💊', color: '#5e5ce6', label: 'New Prescription' },
    PRESCRIPTION_DISPENSED: { icon: '✅', color: '#30d158', label: 'Drug Dispensed' },
    DRUG_STOCKOUT:          { icon: '📦', color: '#ff9f0a', label: 'Stockout Alert' },
    BED_OCCUPIED:           { icon: '🛏️', color: '#0a84ff', label: 'Bed Occupied' },
    BED_VACATED:            { icon: '🛏️', color: '#636366', label: 'Bed Vacated' },
    PATIENT_REGISTERED:     { icon: '👤', color: '#32ade6', label: 'Patient Registered' },
    DISCHARGE_READY:        { icon: '🏠', color: '#30d158', label: 'Discharge Ready' },
    THEATRE_BOOKED:         { icon: '🔪', color: '#bf5af2', label: 'Theatre Booked' },
    THEATRE_CASE_STARTED:   { icon: '⚡', color: '#ff9500', label: 'Surgery Started' },
    THEATRE_CASE_COMPLETED: { icon: '✅', color: '#30d158', label: 'Surgery Completed' },
    HMO_PREAUTH_APPROVED:   { icon: '✅', color: '#30d158', label: 'HMO Pre-Auth Approved' },
    HMO_PREAUTH_REJECTED:   { icon: '❌', color: '#ff3a30', label: 'HMO Pre-Auth Rejected' },
    DHIS2_SYNC_COMPLETE:    { icon: '📡', color: '#64d2ff', label: 'DHIS2 Sync Done' },
    AI_CDS_ALERT:           { icon: '🤖', color: '#bf5af2', label: 'AI Clinical Alert' },
    EPIDEMIC_SURGE_ALERT:   { icon: '🦠', color: '#ff2d55', label: 'Epidemic Surge' },
  };
  return map[topic] || { icon: '🔔', color: '#636366', label: topic.replace(/_/g, ' ') };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function NotificationRow({ n, onRead }: { n: NotificationItem; onRead: (id: string) => void }) {
  const meta = getTopicMeta(n.topic);
  const payload = n.payload as Record<string, unknown>;

  const description =
    payload.patientName ? `${payload.patientName}${payload.news2Score !== undefined ? ` — NEWS2: ${payload.news2Score}` : ''}` :
    payload.testName    ? String(payload.testName) :
    payload.procedure   ? String(payload.procedure) :
    n.topic.replace(/_/g, ' ');

  return (
    <div
      onClick={() => onRead(n.eventId)}
      style={{
        display: 'flex', gap: 10, padding: '10px 14px',
        background: n.read ? 'transparent' : 'rgba(255,255,255,0.04)',
        borderLeft: `3px solid ${n.read ? 'transparent' : meta.color}`,
        cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <span style={{ fontSize: 18, minWidth: 24 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, color: meta.color, marginBottom: 2 }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 12, color: '#e5e5ea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {description}
        </div>
        <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>{timeAgo(n.timestamp)}</div>
      </div>
      {!n.read && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, marginTop: 4, flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface NotificationBellProps {
  app?: string;
  facilityId?: string;
}

export default function NotificationBell({ app = 'MEDCORE_OS', facilityId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, connected, markAllRead, markRead } = useRealtimeEvents({ app, facilityId });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasCritical = notifications.some(n =>
    !n.read && ['SEPSIS_ALERT', 'NEWS2_DETERIORATION', 'VITALS_ALERT'].includes(n.topic)
  );

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: '6px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title={connected ? 'Real-time connected' : 'Reconnecting...'}
      >
        <span style={{ fontSize: 22, filter: hasCritical ? 'drop-shadow(0 0 6px #ff2d55)' : 'none' }}>
          {hasCritical ? '🔔' : '🔕'}
        </span>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: hasCritical ? '#ff2d55' : '#0a84ff',
            color: '#fff', fontSize: 10, fontWeight: 700,
            borderRadius: 10, minWidth: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
            animation: hasCritical ? 'pulse 1s ease-in-out infinite' : 'none',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Connection dot */}
        <span style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? '#30d158' : '#ff9500',
        }} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 8,
          width: 340, maxHeight: 480, zIndex: 9999,
          background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Live Alerts</span>
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 6,
                background: connected ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)',
                color: connected ? '#30d158' : '#ff9f0a',
                fontWeight: 600,
              }}>
                {connected ? '● LIVE' : '◌ RECONNECTING'}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: '#0a84ff', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#636366', padding: '32px 16px', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                No alerts yet. System is monitoring.
              </div>
            ) : (
              notifications.map(n => (
                <NotificationRow key={n.eventId} n={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
