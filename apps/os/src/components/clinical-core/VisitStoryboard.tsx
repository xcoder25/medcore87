'use client';

/**
 * Epic storyboard-style visit path: Check-in → Consult → Orders → Results → Rx → Done
 */
import React, { useMemo } from 'react';
import { Check, Circle } from 'lucide-react';
import { todayVisits } from '../../lib/receptionOpsStore';
import { listOrders } from '../../lib/clinicalEventBus';
import { isReviewed } from '../../lib/resultReviewStore';
import { listPendingCriticalAcks } from '../../lib/clinicalIntelligenceEngine';

export type StoryStepId = 'checkin' | 'consult' | 'orders' | 'results' | 'rx' | 'done';

interface Props {
  facilityId: string;
  patientId: string;
  onJump?: (step: StoryStepId) => void;
}

const STEPS: { id: StoryStepId; label: string; hint: string }[] = [
  { id: 'checkin', label: 'Check-in', hint: 'Arrived / queue' },
  { id: 'consult', label: 'Consult', hint: 'With clinician' },
  { id: 'orders', label: 'Orders', hint: 'Lab / imaging' },
  { id: 'results', label: 'Results', hint: 'Review findings' },
  { id: 'rx', label: 'Pharmacy', hint: 'Prescribe / dispense' },
  { id: 'done', label: 'Complete', hint: 'Visit closed' },
];

export const VisitStoryboard: React.FC<Props> = ({ facilityId, patientId, onJump }) => {
  const state = useMemo(() => {
    const visits = todayVisits(facilityId).filter((v) => v.patientId === patientId);
    const visit = visits[0];
    const orders = listOrders(facilityId, { patientId });
    const labs = orders.filter((o) => o.type === 'lab' || o.type === 'imaging');
    const rxs = orders.filter((o) => o.type === 'rx');
    const resulted = labs.filter((o) => o.status === 'resulted');
    const unreviewed = resulted.filter((o) => !isReviewed(o.id));
    const crit = listPendingCriticalAcks(facilityId).filter((a) => a.patientId === patientId);

    const done: Record<StoryStepId, boolean> = {
      checkin: Boolean(visit),
      consult: Boolean(visit && (visit.status === 'with_provider' || visit.status === 'completed')),
      orders: labs.length > 0 || rxs.length > 0,
      results: resulted.length > 0 && unreviewed.length === 0 && crit.length === 0,
      rx: rxs.some((o) => o.status === 'resulted') || (rxs.length === 0 && labs.length > 0 && resulted.length > 0),
      done: Boolean(visit && visit.status === 'completed'),
    };

    // Current = first not done
    let current: StoryStepId = 'checkin';
    for (const s of STEPS) {
      if (!done[s.id]) {
        current = s.id;
        break;
      }
      current = s.id;
    }
    if (done.done) current = 'done';

    return { done, current, visit, openOrders: orders.filter((o) => o.status !== 'resulted' && o.status !== 'cancelled').length, unreviewed: unreviewed.length + crit.length };
  }, [facilityId, patientId]);

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>Visit path</div>
        <div style={{ fontSize: 11, color: '#64748B' }}>
          {state.openOrders ? `${state.openOrders} open orders` : 'No open orders'}
          {state.unreviewed ? ` · ${state.unreviewed} results to review` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
        {STEPS.map((s, i) => {
          const complete = state.done[s.id];
          const active = state.current === s.id;
          return (
            <React.Fragment key={s.id}>
              {i > 0 && (
                <div
                  style={{
                    flex: '0 0 16px',
                    height: 2,
                    background: complete || active ? '#0052D4' : '#E2E8F0',
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => onJump?.(s.id)}
                title={s.hint}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 64,
                  border: 'none',
                  background: 'transparent',
                  cursor: onJump ? 'pointer' : 'default',
                  padding: 4,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: complete ? '#0052D4' : active ? '#EFF6FF' : '#F8FAFC',
                    border: active ? '2px solid #0052D4' : complete ? 'none' : '1px solid #E2E8F0',
                    color: complete ? '#fff' : active ? '#0052D4' : '#94A3B8',
                  }}
                >
                  {complete ? <Check size={14} strokeWidth={3} /> : <Circle size={12} />}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 800 : 600,
                    color: active ? '#0F172A' : '#64748B',
                    textAlign: 'center',
                  }}
                >
                  {s.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default VisitStoryboard;
