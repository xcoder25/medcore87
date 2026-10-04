'use client';

import React, { useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listNotifications,
  markRead,
  markAllRead,
  notificationSummary,
  subscribeNotifications,
  type HospitalNotification,
} from '../../lib/notificationEngine';
import { scanEarlyWarnings } from '../../lib/clinicalEarlyWarning';
import { buildOpsIntelligence } from '../../lib/opsIntelligence';
import { pushNotification } from '../../lib/notificationEngine';

interface Props {
  session?: UserSession;
  onNavigate?: (k: string) => void;
}

export const NotificationCentre: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [items, setItems] = useState<HospitalNotification[]>([]);
  const [sum, setSum] = useState(notificationSummary(facilityId));

  const reload = () => {
    setItems(listNotifications(facilityId));
    setSum(notificationSummary(facilityId));
  };

  useEffect(() => {
    // Seed from live intelligence once per mount if empty
    const existing = listNotifications(facilityId);
    if (existing.length === 0) {
      for (const w of scanEarlyWarnings(facilityId).slice(0, 5)) {
        pushNotification({
          facilityId,
          level: w.level === 'high' ? 'critical' : w.level === 'medium' ? 'important' : 'info',
          title: 'Early warning',
          body: `${w.patientName}: ${w.message}`,
          module: w.module,
          patientId: w.patientId,
        });
      }
      for (const r of buildOpsIntelligence(facilityId).filter((x) => x.level === 'critical' || x.level === 'warn').slice(0, 3)) {
        pushNotification({
          facilityId,
          level: r.level === 'critical' ? 'critical' : 'important',
          title: r.title,
          body: r.detail,
          module: r.module,
        });
      }
    }
    reload();
    return subscribeNotifications(reload);
  }, [facilityId]);

  const levelColor = (l: string) =>
    l === 'critical' ? '#DC2626' : l === 'important' ? '#D97706' : '#2563EB';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800 }}>Notification Centre</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Prioritised alerts — {sum.total} need attention ({sum.critical} critical · {sum.important} important · {sum.info} info)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            markAllRead(facilityId);
            reload();
          }}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          Mark all read
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0' }}>
        {items.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748B' }}>No notifications</div>
        )}
        {items.map((n) => (
          <div
            key={n.id}
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #F1F5F9',
              opacity: n.read ? 0.55 : 1,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: levelColor(n.level),
                marginTop: 6,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                {n.title}{' '}
                <span style={{ fontWeight: 600, color: levelColor(n.level), fontSize: 11 }}>{n.level}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                {n.createdAt.slice(0, 16).replace('T', ' ')}
                {n.module ? ` · ${n.module}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    reload();
                  }}
                  style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #E2E8F0', borderRadius: 8, padding: '4px 8px', background: '#fff' }}
                >
                  Read
                </button>
              )}
              {n.module && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(n.module!)}
                  style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 8, padding: '4px 8px', background: '#EFF6FF', color: '#2563EB' }}
                >
                  Open
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationCentre;
