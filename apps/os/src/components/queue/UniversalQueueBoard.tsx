'use client';

import React, { useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listQueue,
  callNext,
  updateTicket,
  queueStats,
  subscribeQueue,
  type QueueDept,
  type QueueTicket,
} from '../../lib/universalQueue';
import { emitLiveAction } from '../../lib/liveActions';

const DEPTS: { id: QueueDept; label: string }[] = [
  { id: 'opd', label: 'OPD' },
  { id: 'lab', label: 'Laboratory' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'radiology', label: 'Radiology' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'theatre', label: 'Theatre' },
  { id: 'reception', label: 'Reception' },
  { id: 'specialist', label: 'Specialist' },
];

interface Props {
  session?: UserSession;
  onNavigate?: (k: string) => void;
}

export const UniversalQueueBoard: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [dept, setDept] = useState<QueueDept>('opd');
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [stats, setStats] = useState(queueStats(facilityId));

  const reload = () => {
    setTickets(listQueue(facilityId, { department: dept }).filter((t) => t.status !== 'cancelled'));
    setStats(queueStats(facilityId, dept));
  };

  useEffect(() => {
    reload();
    return subscribeQueue(reload);
  }, [facilityId, dept]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontWeight: 800 }}>Universal Queue Engine</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
          One hospital-wide queue for OPD, lab, pharmacy, radiology, theatre and more.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {DEPTS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDept(d.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: dept === d.id ? 'none' : '1px solid #E2E8F0',
              background: dept === d.id ? 'linear-gradient(135deg,#2563EB,#0D9488)' : '#fff',
              color: dept === d.id ? '#fff' : '#475569',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { l: 'Waiting', v: stats.waiting, c: '#D97706' },
          { l: 'Called / serving', v: stats.called, c: '#2563EB' },
          { l: 'Completed', v: stats.completed, c: '#059669' },
        ].map((k) => (
          <div key={k.l} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="mc-btn-live"
          onClick={() => {
            const t = callNext(facilityId, dept, session?.name);
            if (t) {
              emitLiveAction(`Called ${t.token} · ${t.patientName}`, { module: 'queue' });
              reload();
            }
          }}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg,#2563EB,#0D9488)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Call next
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {tickets.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748B' }}>
            No tickets in {dept}. Orders and check-ins create tokens automatically.
          </div>
        )}
        {tickets.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid #F1F5F9',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>
                {t.token} · {t.patientName}
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                {t.hospitalNumber} · {t.service || t.department} · {t.priority}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: '#F1F5F9',
                }}
              >
                {t.status}
              </span>
              {t.status === 'waiting' && (
                <button
                  type="button"
                  onClick={() => {
                    updateTicket(t.id, { status: 'called', provider: session?.name });
                    reload();
                  }}
                  style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #E2E8F0', borderRadius: 8, padding: '4px 8px', background: '#fff' }}
                >
                  Call
                </button>
              )}
              {(t.status === 'called' || t.status === 'serving') && (
                <button
                  type="button"
                  onClick={() => {
                    updateTicket(t.id, { status: 'completed' });
                    reload();
                  }}
                  style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 8, padding: '4px 8px', background: '#059669', color: '#fff' }}
                >
                  Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UniversalQueueBoard;
