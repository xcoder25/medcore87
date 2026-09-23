import React from 'react';
import { NotificationItem } from '../../hooks/useRealtimeEvents';

const TOPIC_META: Record<string, { icon: string; color: string; label: string }> = {
  SEPSIS_ALERT:           { icon: '🚨', color: '#ff2d55', label: 'Sepsis Alert' },
  NEWS2_DETERIORATION:    { icon: '🔴', color: '#ff3a30', label: 'Deterioration' },
  VITALS_ALERT:           { icon: '⚠️', color: '#ff9500', label: 'Vitals Alert' },
  LAB_RESULT_READY:       { icon: '🧪', color: '#30d158', label: 'Lab Result' },
  RADIOLOGY_REPORT_READY: { icon: '🩻', color: '#64d2ff', label: 'Radiology' },
  PRESCRIPTION_CREATED:   { icon: '💊', color: '#5e5ce6', label: 'Prescription' },
  PRESCRIPTION_DISPENSED: { icon: '✅', color: '#30d158', label: 'Dispensed' },
  DRUG_STOCKOUT:          { icon: '📦', color: '#ff9f0a', label: 'Stockout' },
  BED_OCCUPIED:           { icon: '🛏️', color: '#0a84ff', label: 'Bed' },
  PATIENT_REGISTERED:     { icon: '👤', color: '#32ade6', label: 'Patient' },
  THEATRE_CASE_STARTED:   { icon: '⚡', color: '#bf5af2', label: 'Surgery' },
  THEATRE_CASE_COMPLETED: { icon: '✅', color: '#30d158', label: 'Surgery Done' },
  AI_CDS_ALERT:           { icon: '🤖', color: '#bf5af2', label: 'AI Alert' },
  DHIS2_SYNC_COMPLETE:    { icon: '📡', color: '#64d2ff', label: 'DHIS2' },
};

function getMeta(topic: string) {
  return TOPIC_META[topic] || { icon: '🔔', color: '#636366', label: topic.replace(/_/g, ' ') };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

interface LiveEventFeedProps {
  notifications: NotificationItem[];
  maxVisible?: number;
}

export default function LiveEventFeed({ notifications, maxVisible = 30 }: LiveEventFeedProps) {
  const visible = notifications.slice(0, maxVisible);

  return (
    <div style={{
      background: '#111113', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Live Event Feed</span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 10,
            background: 'rgba(48,209,88,0.15)', color: '#30d158', fontWeight: 600,
          }}>
            ● REAL-TIME
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#636366' }}>{notifications.length} events</span>
      </div>

      {/* Event stream */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#636366', padding: '40px 16px', fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
            Monitoring all clinical events...
          </div>
        ) : (
          visible.map((n, i) => {
            const meta = getMeta(n.topic);
            const payload = n.payload as Record<string, unknown>;
            return (
              <div
                key={n.eventId}
                style={{
                  display: 'flex', gap: 10, padding: '8px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  animation: i === 0 ? 'feedSlide 0.3s ease-out' : 'none',
                  background: i === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                  transition: 'background 0.5s',
                }}
              >
                {/* Timeline dot + line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: meta.color, flexShrink: 0, marginTop: 4,
                    boxShadow: i === 0 ? `0 0 6px ${meta.color}` : 'none',
                  }} />
                  {i < visible.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: 3 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#48484a' }}>{timeAgo(n.timestamp)}</span>
                  </div>

                  <div style={{ fontSize: 12, color: '#aeaeb2', lineHeight: 1.4 }}>
                    {payload.patientName ? `${payload.patientName}` : ''}
                    {payload.news2Score  !== undefined ? ` · NEWS2: ${payload.news2Score}` : ''}
                    {payload.testName   ? ` · ${payload.testName}` : ''}
                    {payload.procedure  ? ` · ${payload.procedure}` : ''}
                    {payload.drugName   ? ` · ${payload.drugName}` : ''}
                    {!payload.patientName && !payload.testName && !payload.procedure && !payload.drugName
                      ? n.topic.replace(/_/g, ' ')
                      : ''}
                  </div>

                  <div style={{ fontSize: 10, color: '#636366', marginTop: 1 }}>
                    {String(n.emitterApp).replace(/_/g, ' ')}
                    {payload.facilityId ? ` · ${payload.facilityId}` : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes feedSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
