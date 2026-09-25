'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ArrowRight, 
  Clock, 
  ShieldAlert 
} from 'lucide-react';

export interface AdminNotification {
  id: string;
  type: 'action_required' | 'success' | 'alert' | 'info';
  title: string;
  description: string;
  time: string;
  read: boolean;
  actionLabel?: string;
  actionHandler?: () => void;
}

interface AdminNotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AdminNotification[];
  onMarkAllAsRead: () => void;
  onClearNotification: (id: string) => void;
}

export const AdminNotificationsDrawer: React.FC<AdminNotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearNotification,
}) => {
  const [filter, setFilter] = useState<'all' | 'action_required' | 'unread'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter(n => {
    if (filter === 'action_required') return n.type === 'action_required' || n.type === 'alert';
    if (filter === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="ha-drawer-backdrop" onClick={onClose}>
      <aside 
        className="ha-drawer" 
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440 }}
      >
        <div className="ha-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(0, 102, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}>
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Notifications
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                {unreadCount > 0 ? `${unreadCount} unread administrative alerts` : 'All notifications caught up'}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                background: filter === 'all' ? 'rgba(0, 102, 255, 0.2)' : 'transparent',
                color: filter === 'all' ? '#FFFFFF' : '#94A3B8',
                border: filter === 'all' ? '1px solid rgba(0, 102, 255, 0.4)' : '1px solid transparent',
                borderRadius: 9999,
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('action_required')}
              style={{
                background: filter === 'action_required' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: filter === 'action_required' ? '#EF4444' : '#94A3B8',
                border: filter === 'action_required' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                borderRadius: 9999,
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Action Required
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              style={{
                background: filter === 'unread' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                color: filter === 'unread' ? '#F59E0B' : '#94A3B8',
                border: filter === 'unread' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                borderRadius: 9999,
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38BDF8',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="ha-drawer-body" style={{ padding: '16px 20px', gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#94A3B8' }}>
              <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', color: '#FFFFFF' }}>No notifications here</h4>
              <p style={{ margin: 0, fontSize: '0.78rem' }}>
                All administrative operational items have been resolved or reviewed.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              return (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: item.read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 102, 255, 0.06)',
                    border: item.read ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 102, 255, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.type === 'action_required' && <AlertTriangle size={15} color="#EF4444" />}
                      {item.type === 'alert' && <ShieldAlert size={15} color="#F59E0B" />}
                      {item.type === 'success' && <CheckCircle2 size={15} color="#10B981" />}
                      {item.type === 'info' && <Info size={15} color="#38BDF8" />}
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                        {item.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} />
                      {item.time}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.4 }}>
                    {item.description}
                  </p>

                  {item.actionLabel && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          item.actionHandler?.();
                          onClose();
                        }}
                        style={{
                          background: 'rgba(0, 102, 255, 0.15)',
                          border: '1px solid rgba(0, 102, 255, 0.3)',
                          color: '#38BDF8',
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {item.actionLabel}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};
