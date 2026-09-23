'use client';

import React, { useState } from 'react';
import { HospitalNotificationItem, INITIAL_NOTIFICATIONS } from '../../data/hospitalData';
import {
  Bell, CheckCheck, AlertTriangle, Pill, BedDouble,
  FlaskConical, Settings, Check, Clock
} from 'lucide-react';

interface NotificationsHubProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const NotificationsHub: React.FC<NotificationsHubProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<HospitalNotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'critical') return n.category === 'critical';
    return true;
  });

  const getCategoryIcon = (cat: HospitalNotificationItem['category']) => {
    switch (cat) {
      case 'critical': return <AlertTriangle size={18} color="#EF4444" />;
      case 'rx': return <Pill size={18} color="#38BDF8" />;
      case 'bed': return <BedDouble size={18} color="#F59E0B" />;
      case 'lab': return <FlaskConical size={18} color="#A855F7" />;
      default: return <Bell size={18} color="#10B981" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '18px 22px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={24} color="#1A6EB5" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Real-Time Clinical Notification Centre</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            System-wide critical laboratory values, medication dispatches, emergency intakes & ward alerts
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#FFFFFF', border: '1px solid #1E446B',
              color: '#0A2540', padding: '9px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <CheckCheck size={16} /> Mark All as Read
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'all', label: `All Alerts (${notifications.length})` },
          { key: 'unread', label: `Unread (${notifications.filter(n => !n.read).length})` },
          { key: 'critical', label: `Critical Only (${notifications.filter(n => n.category === 'critical').length})` },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key as any)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: filter === tab.key ? '#1A6EB5' : '#132F4C',
              color: filter === tab.key ? '#FFFFFF' : '#94A8BE',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(notif => (
          <div
            key={notif.id}
            style={{
              background: notif.read ? '#0D223A' : '#132F4C',
              border: notif.category === 'critical' ? '1px solid rgba(239,68,68,0.4)' : '1px solid #1E446B',
              borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: notif.read ? 0.75 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: notif.category === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(26,110,181,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {getCategoryIcon(notif.category)}
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: notif.category === 'critical' ? '#F87171' : '#FFFFFF' }}>
                  {notif.title}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 3 }}>
                  {notif.body}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.72rem', color: '#94A8BE', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {notif.time}
              </span>
              {!notif.read && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8' }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
