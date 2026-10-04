/**
 * Clinical early warning — rule-based alerts from orders/visits.
 * Assistive flags only — clinician remains decision maker.
 */
import { listOrders } from './clinicalEventBus';
import { todayVisits } from './receptionOpsStore';

export interface EarlyWarning {
  id: string;
  level: 'high' | 'medium' | 'low';
  patientName: string;
  patientId: string;
  message: string;
  at: string;
  module?: string;
}

export function scanEarlyWarnings(facilityId: string): EarlyWarning[] {
  const out: EarlyWarning[] = [];
  const orders = listOrders(facilityId);

  for (const o of orders) {
    if (o.priority === 'stat' && o.status !== 'resulted') {
      out.push({
        id: `stat-${o.id}`,
        level: 'high',
        patientName: o.patientName,
        patientId: o.patientId,
        message: `STAT ${o.type} still open: ${o.name}`,
        at: o.updatedAt || o.createdAt,
        module: o.type === 'lab' ? 'laboratory' : o.type === 'rx' ? 'pharmacy' : 'radiology',
      });
    }
    if (o.type === 'lab' && o.status === 'resulted' && /critical|panic|high|low/i.test(o.resultSummary || '')) {
      out.push({
        id: `crit-${o.id}`,
        level: 'high',
        patientName: o.patientName,
        patientId: o.patientId,
        message: `Critical-style lab wording: ${o.resultSummary}`,
        at: o.resultAt || o.updatedAt,
        module: 'laboratory',
      });
    }
  }

  for (const v of todayVisits(facilityId)) {
    const mins = (Date.now() - new Date(v.checkedInAt).getTime()) / 60000;
    if ((v.status === 'waiting' || v.status === 'called') && mins > 45) {
      out.push({
        id: `wait-${v.id}`,
        level: 'medium',
        patientName: v.patientName,
        patientId: v.patientId,
        message: `Waiting ${Math.round(mins)} min in ${v.department} (${v.queueNumber})`,
        at: v.checkedInAt,
        module: 'patient-flow',
      });
    }
  }

  return out.sort((a, b) => {
    const L = { high: 0, medium: 1, low: 2 };
    return L[a.level] - L[b.level];
  });
}
