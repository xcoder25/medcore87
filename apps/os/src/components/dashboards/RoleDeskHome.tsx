'use client';

/**
 * Shared desk pattern for every clinical/ops role — same UX as Reception & Doctor:
 * Hero · KPIs · Quick actions · Live board · Right rail.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Activity, Brain, ChevronRight, RefreshCw, CheckCircle2, Users, Clock,
  type LucideIcon,
} from 'lucide-react';
import { todayVisits, subscribeReceptionOps } from '../../lib/receptionOpsStore';
import { listOrders, subscribeOrders } from '../../lib/clinicalEventBus';
import { listPatients, subscribePatients } from '../../lib/patientRegistryStore';
import { emitLiveAction } from '../../lib/liveActions';
import { InBasketPanel } from '../clinical-core/InBasketPanel';

export type DeskQuick = { label: string; desc: string; icon: LucideIcon; go: string };
export type DeskKpi = { label: string; value: number | string; sub: string; icon: LucideIcon; tint: string; iconColor: string };

export type RoleDeskConfig = {
  title: string;
  subtitle: string;
  badge: string;
  quick: DeskQuick[];
  boardTitle: string;
  boardEmpty: string;
  /** Filter visits for the board */
  visitFilter?: (status: string) => boolean;
  orderType?: 'lab' | 'rx' | 'imaging' | 'all';
};

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
  config: RoleDeskConfig;
  extraKpis?: DeskKpi[];
}

const C = {
  text: '#0F172A',
  muted: '#64748B',
  border: '#E8EEF5',
  blue: '#2563EB',
};

export const RoleDeskHome: React.FC<Props> = ({ session, onNavigate, config, extraKpis }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const firstName = (session.name || 'Staff').split(' ')[0];
  const [tick, setTick] = useState(0);

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeReceptionOps(reload);
    const u2 = subscribeOrders(reload);
    const u3 = subscribePatients(reload);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const visits = useMemo(() => todayVisits(facilityId), [facilityId, tick]);
  const orders = useMemo(() => listOrders(facilityId), [facilityId, tick]);
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);

  const boardVisits = visits.filter((v) =>
    config.visitFilter ? config.visitFilter(v.status) : v.status !== 'completed' && v.status !== 'cancelled'
  );

  const filteredOrders = orders.filter((o) => {
    if (!config.orderType || config.orderType === 'all') return true;
    return o.type === config.orderType;
  });

  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called').length;
  const done = visits.filter((v) => v.status === 'completed').length;
  const openOrders = filteredOrders.filter((o) => o.status === 'ordered' || o.status === 'in_progress').length;
  const results = filteredOrders.filter((o) => o.status === 'resulted').length;

  const kpis: DeskKpi[] = extraKpis || [
    {
      label: 'Waiting today',
      value: waiting,
      sub: 'Queue / clinic',
      icon: Users,
      tint: '#EFF6FF',
      iconColor: C.blue,
    },
    {
      label: 'Completed',
      value: done,
      sub: 'Visits closed',
      icon: CheckCircle2,
      tint: '#ECFDF5',
      iconColor: '#16A34A',
    },
    {
      label: 'Open work',
      value: openOrders,
      sub: config.orderType === 'lab' ? 'Lab orders' : config.orderType === 'rx' ? 'Prescriptions' : 'Orders',
      icon: Activity,
      tint: '#FEF3C7',
      iconColor: '#D97706',
    },
    {
      label: 'Results / done',
      value: results,
      sub: 'On clinical bus',
      icon: Clock,
      tint: '#F5F3FF',
      iconColor: '#7C3AED',
    },
    {
      label: 'Patients on file',
      value: patients.length,
      sub: 'Registry',
      icon: Users,
      tint: '#F0FDFA',
      iconColor: '#0D9488',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      <InBasketPanel
        facilityId={facilityId}
        roleKey={session.roleKey}
        staffName={session.name}
        onNavigate={onNavigate}
      />
      <div
        className="mc-hero-fluid"
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          color: '#fff',
          position: 'relative',
          minHeight: 140,
          padding: '22px 28px',
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.9 }}>Welcome back, {firstName} 👋</div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4, marginTop: 4 }}>{config.title}</div>
        <div style={{ fontSize: 13, opacity: 0.88, maxWidth: 480, marginTop: 6, lineHeight: 1.45 }}>
          {config.subtitle}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80' }} />
            Systems online
          </span>
          <span
            style={{
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 999,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {config.badge}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              style={{
                background: '#fff',
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: k.tint,
                  color: k.iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: 18,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15 }}>Quick Actions</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Jump to tools for this role</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {config.quick.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                type="button"
                className="mc-btn-live"
                onClick={() => {
                  emitLiveAction(`Open ${q.label}`, { module: q.go });
                  onNavigate(q.go);
                }}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  background: '#F8FAFC',
                  padding: '14px 10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: '#EFF6FF',
                    color: C.blue,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                  }}
                >
                  <Icon size={18} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{q.label}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{q.desc}</div>
              </button>
            );
          })}
          <button
            type="button"
            className="mc-btn-live"
            onClick={() => onNavigate('m87-ai')}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              background: '#F5F3FF',
              padding: '14px 10px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#EDE9FE',
                color: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
              }}
            >
              <Brain size={18} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>M87 AI</div>
            <div style={{ fontSize: 10, color: C.muted }}>Assistant</div>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>{config.boardTitle}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Live from shared hospital data</div>
            </div>
            <button type="button" className="os-ghost-btn mc-btn-live" onClick={reload}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          {boardVisits.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>{config.boardEmpty}</div>
          )}
          {boardVisits.slice(0, 10).map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{v.patientName}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {v.queueNumber} · {v.department}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.blue }}>{v.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Orders / work on bus</div>
          {filteredOrders.length === 0 && (
            <div style={{ fontSize: 12, color: C.muted }}>No orders yet — they appear when clinicians place them.</div>
          )}
          {filteredOrders.slice(0, 8).map((o) => (
            <div key={o.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>{o.patientName}</div>
              <div style={{ color: C.muted }}>
                {o.name} · {o.status}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onNavigate(config.orderType === 'lab' ? 'laboratory' : config.orderType === 'rx' ? 'pharmacy' : 'emr')}
            style={{
              marginTop: 12,
              border: 'none',
              background: 'none',
              color: C.blue,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Open workspace <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleDeskHome;
