'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listNotifications,
  markRead,
  markAllRead,
  notificationSummary,
  subscribeNotifications,
  pushNotification,
  type HospitalNotification,
  type NotifLevel,
} from '../../lib/notificationEngine';
import { scanEarlyWarnings } from '../../lib/clinicalEarlyWarning';
import { buildOpsIntelligence } from '../../lib/opsIntelligence';
import {
  getRoleInBasketFolders,
  classifyNotificationForRole,
  getRoleInBasketMeta,
  type InBasketFolderDef,
} from '../../lib/inBasketTaxonomy';
import { inferRoleKey } from '../../lib/staffCardStore';
import { listAppointments, todayVisits } from '../../lib/receptionOpsStore';
import { listAccountsRequests } from '../../lib/frontDeskAccountsBridge';
import {
  AlertCircle,
  HeartPulse,
  ClipboardList,
  MessageSquare,
  Megaphone,
  Bell,
  CheckCheck,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Inbox,
} from 'lucide-react';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

interface Props {
  session?: UserSession;
  onNavigate?: (k: string) => void;
}

export const NotificationCentre: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const roleKey = inferRoleKey(session?.roleKey || session?.role || session?.title, session?.badgeId);
  const isReception = roleKey === 'reception' || roleKey.includes('front');
  const sessionOpts = { staffName: session?.name, roleKey: session?.roleKey || roleKey };

  const folders = useMemo(() => getRoleInBasketFolders(roleKey), [roleKey]);
  const roleMeta = useMemo(() => getRoleInBasketMeta(roleKey), [roleKey]);

  const [items, setItems] = useState<HospitalNotification[]>([]);
  const [sum, setSum] = useState({ critical: 0, important: 0, info: 0, total: 0 });
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<'all' | NotifLevel>('all');
  const [refreshing, setRefreshing] = useState(false);

  const reload = () => {
    setItems(listNotifications(facilityId, false, sessionOpts));
    setSum(notificationSummary(facilityId, sessionOpts));
  };

  useEffect(() => {
    // If reception, synchronize live operational attention items into notifications
    if (isReception) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        // 1. Arriving booked appointments scheduled today
        const appts = listAppointments(facilityId).filter(
          (a) => a.scheduledAt.startsWith(todayStr) && a.status === 'booked'
        );
        for (const a of appts.slice(0, 6)) {
          pushNotification({
            facilityId,
            level: 'important',
            title: `Arriving Appointment · ${a.patientName}`,
            body: `Scheduled for ${a.scheduledAt.slice(11, 16)} with ${a.doctor || 'Clinician'} (${a.department || 'OPD'}) · Check-in pending`,
            module: 'appointments',
            patientId: a.patientId,
            roleHint: 'reception',
          });
        }

        // 2. Overdue waiting queue (> 20 mins)
        const overdue = todayVisits(facilityId).filter((v) => {
          if (v.status !== 'waiting') return false;
          const mins = Math.max(0, Math.round((Date.now() - new Date(v.checkedInAt).getTime()) / 60000));
          return mins >= 20;
        });
        for (const v of overdue.slice(0, 6)) {
          const mins = Math.max(0, Math.round((Date.now() - new Date(v.checkedInAt).getTime()) / 60000));
          pushNotification({
            facilityId,
            level: 'important',
            title: `Overdue Wait Alert (${mins}m) · ${v.department}`,
            body: `${v.queueNumber} · ${v.patientName} (${v.hospitalNumber}) waiting without being called`,
            module: 'patient-flow',
            patientId: v.patientId,
            roleHint: 'reception',
          });
        }

        // 3. Paid accounts requests recently cleared
        const paidReqs = listAccountsRequests(facilityId, { status: 'paid' }).slice(0, 4);
        for (const p of paidReqs) {
          pushNotification({
            facilityId,
            level: 'info',
            title: `Payment Cleared · ₦${p.amountNgn.toLocaleString()}`,
            body: `${p.patientName} (${p.hospitalNumber}) · Cleared at Accounts & auto-transferred to Triage Queue`,
            module: 'patient-flow',
            patientId: p.patientId,
            roleHint: 'reception',
          });
        }
      } catch {
        /* ignore */
      }
    }

    // Seed role-specific intelligence notifications if store is empty
    const existing = listNotifications(facilityId, false, sessionOpts);
    if (existing.length === 0) {
      if (isReception) {
        pushNotification({
          facilityId,
          level: 'important',
          title: 'Appointment Arriving · Chief Okon',
          body: 'Booked 10:00 AM consultation with Dr. Udoh (Cardiology) — patient due at Front Desk',
          module: 'appointments',
          roleHint: 'reception',
        });
        pushNotification({
          facilityId,
          level: 'important',
          title: 'Queue Overdue Alert (>20m)',
          body: 'Patient Sarah Bassey (IGH-2026-0042) waiting 24 minutes in General OPD queue without call',
          module: 'patient-flow',
          roleHint: 'reception',
        });
        pushNotification({
          facilityId,
          level: 'info',
          title: 'Payment Cleared · Accounts Desk',
          body: '₦5,000 consult fee for Emmanuel Victor confirmed paid — auto-promoted to Triage Queue',
          module: 'patient-flow',
          roleHint: 'reception',
        });
        pushNotification({
          facilityId,
          level: 'info',
          title: 'State Digital Health Card Issued',
          body: 'Akwa Ibom State Health ID AKSHIA-8419 issued for new registration Mercy Effiong',
          module: 'patient-card',
          roleHint: 'reception',
        });
        pushNotification({
          facilityId,
          level: 'info',
          title: 'Front Desk Daily Handover',
          body: 'Morning shift reconciliation complete · 42 check-ins registered, 8 booked clinics active',
          module: 'patient-flow',
          roleHint: 'reception',
        });
      } else {
        // Clinical roles seed clinical alerts
        for (const w of scanEarlyWarnings(facilityId).slice(0, 5)) {
          pushNotification({
            facilityId,
            level: w.level === 'high' ? 'critical' : w.level === 'medium' ? 'important' : 'info',
            title: 'Early Warning — NEWS2',
            body: `${w.patientName}: ${w.message}`,
            module: w.module,
            patientId: w.patientId,
            roleHint: roleKey,
          });
        }
        for (const r of buildOpsIntelligence(facilityId)
          .filter((x) => x.level === 'critical' || x.level === 'warn')
          .slice(0, 3)) {
          pushNotification({
            facilityId,
            level: r.level === 'critical' ? 'critical' : 'important',
            title: r.title,
            body: r.detail,
            module: r.module,
            roleHint: roleKey,
          });
        }
      }
    }
    reload();
    return subscribeNotifications(reload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, isReception, roleKey]);

  // Memoised folder counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, { total: number; unread: number }> = {
      all: { total: items.length, unread: items.filter((n) => !n.read).length },
    };
    for (const f of folders) {
      const matched = items.filter((n) => f.matcher(n));
      counts[f.id] = { total: matched.length, unread: matched.filter((n) => !n.read).length };
    }
    return counts;
  }, [items, folders]);

  // Visible items based on active folder + level filter
  const visibleItems = useMemo(() => {
    let list =
      activeFolder === 'all'
        ? items
        : items.filter((n) => classifyNotificationForRole(n, folders).id === activeFolder);
    if (filterLevel !== 'all') list = list.filter((n) => n.level === filterLevel);
    return list;
  }, [items, activeFolder, filterLevel, folders]);

  const handleRefresh = () => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Pill color
  const levelToken = (l: NotifLevel) =>
    l === 'critical' ? { bg: '#FEE2E2', color: '#DC2626' } : l === 'important' ? { bg: '#FEF3C7', color: '#D97706' } : { bg: '#DBEAFE', color: '#2563EB' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Page header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
          padding: '20px 24px 0',
          borderRadius: '16px 16px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <Inbox size={20} color="#93C5FD" />
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>
                {roleMeta.title}
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.18)',
                  color: '#FFFFFF',
                }}
              >
                {roleMeta.scopeBadge}
              </span>
              {sum.critical > 0 && (
                <span
                  style={{
                    background: '#DC2626',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    borderRadius: 8,
                    padding: '2px 8px',
                    animation: 'pulse 1.5s infinite',
                    letterSpacing: '0.04em',
                  }}
                >
                  {sum.critical} STAT
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#93C5FD' }}>
              {roleMeta.subtitle} · {sum.total} open · {sum.critical} critical · {sum.important} important
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh"
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                borderRadius: 8,
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
            {sum.total > 0 && (
              <button
                type="button"
                onClick={() => { markAllRead(facilityId); reload(); }}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* ── Stat chips ── */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 0 }}>
          {[
            { label: 'Critical', value: sum.critical, color: '#DC2626', bg: 'rgba(220,38,38,0.2)' },
            { label: 'Important', value: sum.important, color: '#D97706', bg: 'rgba(217,119,6,0.2)' },
            { label: 'Info', value: sum.info, color: '#93C5FD', bg: 'rgba(147,197,253,0.2)' },
            { label: 'Total', value: sum.critical + sum.important + sum.info, color: '#fff', bg: 'rgba(255,255,255,0.1)' },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                background: chip.bg,
                borderRadius: '8px 8px 0 0',
                padding: '6px 12px',
                textAlign: 'center',
                minWidth: 64,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18, color: chip.color, lineHeight: 1 }}>{chip.value}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: chip.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{chip.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Folder tabs (Epic In Basket left-panel style, rendered as horizontal tabs) ── */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          background: '#F8FAFC',
          borderBottom: '2px solid #E2E8F0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* All */}
        <button
          type="button"
          onClick={() => setActiveFolder('all')}
          style={{
            flexShrink: 0,
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeFolder === 'all' ? '2px solid #1D4ED8' : '2px solid transparent',
            background: activeFolder === 'all' ? '#EFF6FF' : 'transparent',
            color: activeFolder === 'all' ? '#1D4ED8' : '#64748B',
            fontWeight: activeFolder === 'all' ? 800 : 600,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            marginBottom: -2,
          }}
        >
          <Bell size={13} />
          All
          {folderCounts.all?.unread > 0 && (
            <span style={{ background: '#1D4ED8', color: '#fff', borderRadius: 9, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>
              {folderCounts.all.unread}
            </span>
          )}
        </button>

        {folders.map((folder) => {
          const FIcon = folder.icon;
          const cnt = folderCounts[folder.id];
          const active = activeFolder === folder.id;
          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => setActiveFolder(folder.id)}
              style={{
                flexShrink: 0,
                padding: '10px 14px',
                border: 'none',
                borderBottom: active ? `2px solid ${folder.color}` : '2px solid transparent',
                background: active ? folder.bg : 'transparent',
                color: active ? folder.color : '#64748B',
                fontWeight: active ? 800 : 600,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
                marginBottom: -2,
              }}
            >
              <FIcon size={12} />
              {folder.epicLabel}
              {cnt?.unread > 0 && (
                <span
                  style={{
                    background: folder.color,
                    color: '#fff',
                    borderRadius: 9,
                    padding: '1px 5px',
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {cnt.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Level filter pills ── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          background: '#fff',
          borderBottom: '1px solid #F1F5F9',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginRight: 4 }}>Priority:</span>
        {(['all', 'critical', 'important', 'info'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilterLevel(f)}
            style={{
              border: filterLevel === f ? '1.5px solid #1D4ED8' : '1.5px solid #E2E8F0',
              background: filterLevel === f ? '#EFF6FF' : '#fff',
              color: filterLevel === f ? '#1D4ED8' : '#64748B',
              borderRadius: 999,
              padding: '3px 11px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>{visibleItems.length} shown</span>
      </div>

      {/* ── Notification rows ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        {visibleItems.length === 0 && (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: '#94A3B8',
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <CheckCheck size={40} color="#CBD5E1" />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#64748B' }}>In Basket clear</p>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>No notifications for this filter.</p>
            </div>
          </div>
        )}

        {visibleItems.map((n) => {
          const folder = classifyNotificationForRole(n, folders);
          const FIcon = folder.icon;
          const tok = levelToken(n.level);
          return (
            <div
              key={n.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '13px 16px',
                borderBottom: '1px solid #F1F5F9',
                background: n.read ? '#fff' : folder.bg,
                borderLeft: n.read ? '3px solid transparent' : `3px solid ${folder.color}`,
                transition: 'background 0.15s',
              }}
            >
              {/* Folder icon pill */}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: `${folder.color}15`,
                  border: `1px solid ${folder.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <FIcon size={16} color={folder.color} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontWeight: n.read ? 600 : 800,
                      fontSize: 13,
                      color: '#0F172A',
                      flex: 1,
                    }}
                  >
                    {n.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: tok.color,
                      background: tok.bg,
                      borderRadius: 5,
                      padding: '1px 6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                    }}
                  >
                    {n.level === 'critical' ? '🚨 STAT' : n.level === 'important' ? '⚠ URGENT' : 'INFO'}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>{n.body}</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>{timeAgo(n.createdAt)}</span>
                  {n.module && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: folder.color,
                        background: `${folder.color}15`,
                        borderRadius: 4,
                        padding: '1px 6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {n.module}
                    </span>
                  )}
                  {n.targetStaff && (
                    <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>→ {n.targetStaff}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => { markRead(n.id); reload(); }}
                    style={{
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      borderRadius: 7,
                      padding: '4px 9px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#64748B',
                    }}
                  >
                    Read
                  </button>
                )}
                {n.module && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate(n.module!)}
                    style={{
                      border: 'none',
                      background: '#EFF6FF',
                      color: '#2563EB',
                      borderRadius: 7,
                      padding: '4px 9px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    Go <ChevronRight size={10} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '0 0 16px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
            }}
          />
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
            {session?.name ? `${session.name.split(' ')[0]} · ` : ''}Live
          </span>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
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
  );
};

export default NotificationCentre;
