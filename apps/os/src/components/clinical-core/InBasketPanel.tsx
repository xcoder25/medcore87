'use client';

/**
 * Epic In Basket–style unified attention list for the role.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, FlaskConical, AlertTriangle, Pill, ClipboardList, ChevronRight } from 'lucide-react';
import { listOrders, subscribeOrders } from '../../lib/clinicalEventBus';
import { listPendingCriticalAcks, subscribeIntelligence } from '../../lib/clinicalIntelligenceEngine';
import { isReviewed, subscribeResultReviews } from '../../lib/resultReviewStore';
import { todayVisits, subscribeReceptionOps } from '../../lib/receptionOpsStore';
import { setPatientContext } from '../../lib/patientContextStore';
import { getPatient } from '../../lib/patientRegistryStore';

export type BasketItem = {
  id: string;
  kind: 'critical' | 'result' | 'rx' | 'queue' | 'task';
  title: string;
  detail: string;
  patientId?: string;
  patientName?: string;
  at: string;
  module?: string;
};

interface Props {
  facilityId: string;
  roleKey?: string;
  onNavigate?: (moduleKey: string) => void;
  limit?: number;
}

export const InBasketPanel: React.FC<Props> = ({ facilityId, roleKey, onNavigate, limit = 12 }) => {
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const u1 = subscribeOrders(reload);
    const u2 = subscribeIntelligence(reload);
    const u3 = subscribeResultReviews(reload);
    const u4 = subscribeReceptionOps(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const items = useMemo(() => {
    const out: BasketItem[] = [];
    const role = (roleKey || '').toLowerCase();

    for (const a of listPendingCriticalAcks(facilityId)) {
      out.push({
        id: `crit-${a.orderId}`,
        kind: 'critical',
        title: 'Critical result — acknowledge',
        detail: a.summary,
        patientId: a.patientId,
        patientName: a.patientName,
        at: a.resultAt,
        module: 'doctor-portal',
      });
    }

    const resulted = listOrders(facilityId).filter((o) => o.status === 'resulted' && !isReviewed(o.id));
    for (const o of resulted.slice(0, 20)) {
      if (o.type === 'rx') continue;
      out.push({
        id: `res-${o.id}`,
        kind: 'result',
        title: `${o.type === 'imaging' ? 'Imaging' : 'Lab'} result ready`,
        detail: `${o.name} · ${o.resultSummary || 'Available'}`,
        patientId: o.patientId,
        patientName: o.patientName,
        at: o.resultAt || o.updatedAt,
        module: 'doctor-portal',
      });
    }

    if (role.includes('pharm') || role.includes('admin') || !role) {
      for (const o of listOrders(facilityId).filter((x) => x.type === 'rx' && x.status === 'ordered')) {
        out.push({
          id: `rx-${o.id}`,
          kind: 'rx',
          title: 'Prescription to dispense',
          detail: o.name,
          patientId: o.patientId,
          patientName: o.patientName,
          at: o.createdAt,
          module: 'pharmacy',
        });
      }
    }

    if (role.includes('recep') || role.includes('doctor') || role.includes('admin') || !role) {
      for (const v of todayVisits(facilityId).filter((x) => x.status === 'waiting' || x.status === 'called')) {
        out.push({
          id: `q-${v.id}`,
          kind: 'queue',
          title: `Waiting · ${v.department}`,
          detail: `${v.queueNumber} · ${v.visitType}`,
          patientId: v.patientId,
          patientName: v.patientName,
          at: v.checkedInAt,
          module: role.includes('doctor') ? 'doctor-portal' : 'patient-flow',
        });
      }
    }

    out.sort((a, b) => {
      const rank = { critical: 0, result: 1, rx: 2, queue: 3, task: 4 };
      const d = rank[a.kind] - rank[b.kind];
      if (d !== 0) return d;
      return b.at.localeCompare(a.at);
    });
    return out.slice(0, limit);
  }, [facilityId, roleKey, tick, limit]);

  const icon = (k: BasketItem['kind']) => {
    if (k === 'critical') return <AlertTriangle size={14} color="#DC2626" />;
    if (k === 'result') return <FlaskConical size={14} color="#D97706" />;
    if (k === 'rx') return <Pill size={14} color="#7C3AED" />;
    if (k === 'queue') return <ClipboardList size={14} color="#2563EB" />;
    return <Inbox size={14} />;
  };

  const openItem = (item: BasketItem) => {
    if (item.patientId) {
      const p = getPatient(item.patientId);
      if (p) setPatientContext(p);
      else
        setPatientContext({
          id: item.patientId,
          facilityId,
          hospitalNumber: '',
          firstName: item.patientName || 'Patient',
          lastName: '',
        });
    }
    if (item.module && onNavigate) onNavigate(item.module);
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Inbox size={16} color="#0052D4" />
        <span style={{ fontWeight: 800, fontSize: 14 }}>Needs attention</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 800,
            background: items.length ? '#FEE2E2' : '#ECFDF5',
            color: items.length ? '#991B1B' : '#065F46',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: '#64748B', padding: '8px 0' }}>Nothing waiting — good time to clear the queue.</div>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => openItem(item)}
          style={{
            width: '100%',
            textAlign: 'left',
            border: 'none',
            borderBottom: '1px solid #F1F5F9',
            background: 'transparent',
            padding: '10px 4px',
            cursor: 'pointer',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ marginTop: 2 }}>{icon(item.kind)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {item.patientName ? `${item.patientName} · ` : ''}
              {item.detail}
            </div>
          </div>
          <ChevronRight size={14} color="#94A3B8" style={{ marginTop: 4 }} />
        </button>
      ))}
    </div>
  );
};

export default InBasketPanel;
