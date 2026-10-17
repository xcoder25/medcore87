'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertCircle, HeartPulse, ClipboardList, MessageSquare, Megaphone, CheckCheck, ExternalLink, X } from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listNotifications,
  markRead,
  markAllRead,
  subscribeNotifications,
  notificationSummary,
  type HospitalNotification,
} from '../../lib/notificationEngine';

// ── Epic In Basket folder taxonomy ─────────────────────────────────────────
const FOLDERS: {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  matcher: (n: HospitalNotification) => boolean;
}[] = [
  {
    id: 'critical',
    label: 'Critical Results',
    icon: AlertCircle,
    color: '#DC2626',
    bg: '#FEF2F2',
    matcher: (n) => n.level === 'critical',
  },
  {
    id: 'triage',
    label: 'Triage & Early Warnings',
    icon: HeartPulse,
    color: '#D97706',
    bg: '#FFFBEB',
    matcher: (n) =>
      n.level === 'important' &&
      !!['triage', 'vitals', 'news2', 'early', 'deteriorat', 'sepsis'].some((kw) =>
        (n.body + n.title).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'orders',
    label: 'Orders & Consults',
    icon: ClipboardList,
    color: '#2563EB',
    bg: '#EFF6FF',
    matcher: (n) =>
      !!['order', 'prescri', 'consult', 'lab result', 'radiology', 'dispens', 'sign-off', 'cpoe'].some((kw) =>
        (n.body + n.title).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'messages',
    label: 'Messages & Handoffs',
    icon: MessageSquare,
    color: '#7C3AED',
    bg: '#F5F3FF',
    matcher: (n) =>
      !!['message', 'sbar', 'handoff', 'handover', 'staff', 'assign'].some((kw) =>
        (n.body + n.title).toLowerCase().includes(kw)
      ),
  },
  {
    id: 'system',
    label: 'System & Facility',
    icon: Megaphone,
    color: '#0891B2',
    bg: '#ECFEFF',
    matcher: () => true, // catch-all
  },
];

function classifyNotification(n: HospitalNotification): typeof FOLDERS[number] {
  for (const folder of FOLDERS) {
    if (folder.matcher(n)) return folder;
  }
  return FOLDERS[FOLDERS.length - 1];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  app?: string;
  facilityId?: string;
  compact?: boolean;
  session?: UserSession;
  onOpenInbox?: () => void;
}

export const NotificationBell: React.FC<Props> = ({
  app: _app = 'MEDCORE_OS',
  facilityId,
  session,
  onOpenInbox,
}) => {
  const fid = facilityId || session?.hospitalId || 'IGH-EKT';
  const sessionOpts = { staffName: session?.name, roleKey: session?.roleKey };

  const [items, setItems] = useState<HospitalNotification[]>([]);
  const [sum, setSum] = useState({ critical: 0, important: 0, info: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const ref = useRef<HTMLDivElement>(null);

  const reload = () => {
    const list = listNotifications(fid, false, sessionOpts);
    setItems(list);
    setSum(notificationSummary(fid, sessionOpts));
  };

  useEffect(() => {
    reload();
    return subscribeNotifications(reload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, session?.roleKey, session?.name]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unreadCount = sum.total;

  const visibleItems =
    activeFolder === 'all'
      ? items.slice(0, 50)
      : items.filter((n) => {
          const f = FOLDERS.find((x) => x.id === activeFolder);
          return f ? f.matcher(n) : true;
        }).slice(0, 50);

  // Folder counts
  const folderCounts: Record<string, number> = { all: items.filter((n) => !n.read).length };
  for (const folder of FOLDERS) {
    folderCounts[folder.id] = items.filter((n) => !n.read && folder.matcher(n)).length;
  }

  const criticalUnread = sum.critical;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        type="button"
        className="os-top-hud-icon-btn"
        title={`In Basket${unreadCount ? ` — ${unreadCount} unread` : ''}`}
        aria-label={`In Basket${unreadCount ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            className="os-hud-badge"
            style={{
              background: criticalUnread > 0 ? '#DC2626' : '#2563EB',
              minWidth: 16,
              height: 16,
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              top: -4,
              right: -4,
              padding: '0 4px',
              color: '#fff',
              boxShadow: criticalUnread > 0 ? '0 0 0 2px #fff, 0 0 0 4px #DC2626' : undefined,
              animation: criticalUnread > 0 ? 'pulse 1.5s infinite' : undefined,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 420,
            maxWidth: '95vw',
            maxHeight: 580,
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
            zIndex: 10050,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #1E40AF 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} color="#fff" strokeWidth={2.5} />
              <span style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>In Basket</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: criticalUnread > 0 ? '#DC2626' : 'rgba(255,255,255,0.25)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '1px 7px',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  title="Mark all read"
                  onClick={() => { markAllRead(fid); reload(); }}
                  style={{
                    border: 'none',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderRadius: 7,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCheck size={12} />
                  All read
                </button>
              )}
              {onOpenInbox && (
                <button
                  type="button"
                  title="Open full In Basket"
                  onClick={() => { setOpen(false); onOpenInbox(); }}
                  style={{
                    border: 'none',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderRadius: 7,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ExternalLink size={12} />
                  Open
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 7,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* ── Folder tabs ── */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              overflowX: 'auto',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC',
              scrollbarWidth: 'none',
            }}
          >
            {/* All tab */}
            <button
              type="button"
              onClick={() => setActiveFolder('all')}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                border: 'none',
                borderBottom: activeFolder === 'all' ? '2px solid #1D4ED8' : '2px solid transparent',
                background: 'transparent',
                color: activeFolder === 'all' ? '#1D4ED8' : '#64748B',
                fontWeight: activeFolder === 'all' ? 800 : 600,
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              All
              {folderCounts.all > 0 && (
                <span style={{ background: '#1D4ED8', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 9, fontWeight: 800 }}>
                  {folderCounts.all}
                </span>
              )}
            </button>
            {FOLDERS.map((folder) => {
              const FIcon = folder.icon;
              const cnt = folderCounts[folder.id] || 0;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolder(folder.id)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: activeFolder === folder.id ? `2px solid ${folder.color}` : '2px solid transparent',
                    background: 'transparent',
                    color: activeFolder === folder.id ? folder.color : '#64748B',
                    fontWeight: activeFolder === folder.id ? 800 : 600,
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <FIcon size={12} />
                  {folder.label}
                  {cnt > 0 && (
                    <span
                      style={{
                        background: folder.color,
                        color: '#fff',
                        borderRadius: 8,
                        padding: '0 5px',
                        fontSize: 9,
                        fontWeight: 800,
                      }}
                    >
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Notification list ── */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {visibleItems.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: 'center',
                  color: '#94A3B8',
                  fontSize: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <CheckCheck size={32} color="#CBD5E1" />
                <span>No notifications in this folder</span>
              </div>
            ) : (
              visibleItems.map((n) => {
                const folder = classifyNotification(n);
                const FIcon = folder.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { markRead(n.id); reload(); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '11px 14px',
                      border: 'none',
                      borderBottom: '1px solid #F1F5F9',
                      background: n.read ? '#fff' : folder.bg,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = n.read ? '#fff' : folder.bg;
                    }}
                  >
                    {/* Folder icon */}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: `${folder.color}18`,
                        border: `1px solid ${folder.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <FIcon size={14} color={folder.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                        <span
                          style={{
                            fontWeight: n.read ? 600 : 800,
                            fontSize: 12.5,
                            color: '#0F172A',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: folder.color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#475569',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {n.body}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 4,
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>{timeAgo(n.createdAt)}</span>
                        {n.module && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: folder.color,
                              background: `${folder.color}15`,
                              borderRadius: 4,
                              padding: '1px 5px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {n.module}
                          </span>
                        )}
                        {n.level === 'critical' && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: '#DC2626',
                              background: '#FEE2E2',
                              borderRadius: 4,
                              padding: '1px 5px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            STAT
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {session?.role ? `Showing alerts for: ${session.role.split('/')[0].trim()}` : 'All facility alerts'}
            </span>
            {onOpenInbox && (
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenInbox(); }}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#2563EB',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Open full In Basket <ExternalLink size={10} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
