/**
 * Operational intelligence — recommendations from live hospital metrics.
 * Assistive only; not clinical diagnosis.
 */
import { todayVisits, dayStats } from './receptionOpsStore';
import { listOrders } from './clinicalEventBus';
import { listBeds } from './bedBoardStore';
import { listUnits } from './ambulanceDispatchStore';
import { listBillLines } from './patientBillingStore';
import { getStaffRegistry } from './adminRealtimeStore';

export type IntelLevel = 'critical' | 'warn' | 'info' | 'ok';

export interface OpsRecommendation {
  id: string;
  level: IntelLevel;
  title: string;
  detail: string;
  action?: string;
  module?: string;
}

export function buildOpsIntelligence(facilityId: string): OpsRecommendation[] {
  const recs: OpsRecommendation[] = [];
  const visits = todayVisits(facilityId);
  const stats = dayStats(facilityId);
  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called');
  const withProv = visits.filter((v) => v.status === 'with_provider');

  // Waiting time pressure
  const waits = waiting.map((v) => (Date.now() - new Date(v.checkedInAt).getTime()) / 60000);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
  const longWait = waits.filter((m) => m > 30).length;

  if (waiting.length >= 8 || avgWait > 25) {
    const pct = Math.round(((waiting.length - 5) / Math.max(5, waiting.length)) * 100);
    recs.push({
      id: 'opd-load',
      level: waiting.length >= 12 || avgWait > 40 ? 'critical' : 'warn',
      title: 'OPD volume pressure',
      detail: `Queue ${waiting.length} waiting · avg ~${Math.round(avgWait)} min (baseline ~18). ${longWait} patients over 30 min.${pct > 0 ? ` Roughly ${pct}% above a quiet day.` : ''}`,
      action: 'Open patient flow / call next / add clinic capacity',
      module: 'patient-flow',
    });
  } else if (waiting.length === 0 && stats.checkIns > 0) {
    recs.push({
      id: 'opd-clear',
      level: 'ok',
      title: 'OPD queue clear',
      detail: `${stats.checkIns} check-ins today · no one waiting now.`,
      module: 'patient-flow',
    });
  }

  const labOpen = listOrders(facilityId).filter((o) => o.type === 'lab' && o.status !== 'resulted').length;
  const rxOpen = listOrders(facilityId).filter((o) => o.type === 'rx' && o.status !== 'resulted').length;
  if (labOpen >= 5) {
    recs.push({
      id: 'lab-backlog',
      level: 'warn',
      title: 'Lab backlog',
      detail: `${labOpen} open lab orders on the clinical bus.`,
      action: 'Prioritise STAT and notify clinicians of delays',
      module: 'laboratory',
    });
  }
  if (rxOpen >= 5) {
    recs.push({
      id: 'rx-backlog',
      level: 'warn',
      title: 'Pharmacy queue pressure',
      detail: `${rxOpen} open prescriptions awaiting dispense.`,
      module: 'pharmacy',
    });
  }

  const beds = listBeds(facilityId);
  if (beds.length) {
    const occ = beds.filter((b) => b.status === 'occupied').length;
    const pct = Math.round((occ / beds.length) * 100);
    if (pct >= 90) {
      recs.push({
        id: 'bed-high',
        level: 'critical',
        title: 'Bed occupancy critical',
        detail: `${occ}/${beds.length} beds occupied (${pct}%). Review discharges and transfers.`,
        module: 'beds',
      });
    } else if (pct >= 75) {
      recs.push({
        id: 'bed-elevated',
        level: 'warn',
        title: 'Bed occupancy elevated',
        detail: `${pct}% occupied · ${beds.length - occ} free.`,
        module: 'beds',
      });
    }
  }

  const ambBusy = listUnits(facilityId).filter((u) => u.status === 'en_route' || u.status === 'at_scene').length;
  if (ambBusy >= 2) {
    recs.push({
      id: 'amb',
      level: 'info',
      title: 'Ambulances active',
      detail: `${ambBusy} units out on calls.`,
      module: 'ambulance',
    });
  }

  const unpaid = listBillLines(facilityId).filter((b) => b.status === 'unpaid').length;
  if (unpaid >= 5) {
    recs.push({
      id: 'revenue',
      level: 'info',
      title: 'Unpaid bill lines',
      detail: `${unpaid} unpaid charges (incl. pharmacy). Cashier can settle hospital bills.`,
      module: 'cashier',
    });
  }

  const staff = getStaffRegistry();
  const nStaff = Array.isArray(staff) ? staff.length : 0;
  if (nStaff === 0) {
    recs.push({
      id: 'staff',
      level: 'warn',
      title: 'No staff enrolled',
      detail: 'Enrol clinicians under Staff Enrolment so logins and duty boards work.',
      module: 'enrolment',
    });
  }

  if (withProv.length > 0) {
    recs.push({
      id: 'consults',
      level: 'info',
      title: 'Active consultations',
      detail: `${withProv.length} patient(s) currently with provider.`,
      module: 'doctor-portal',
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'stable',
      level: 'ok',
      title: 'Operations stable',
      detail: 'No major queue, bed, or lab pressure from live data.',
    });
  }

  const order: Record<IntelLevel, number> = { critical: 0, warn: 1, info: 2, ok: 3 };
  return recs.sort((a, b) => order[a.level] - order[b.level]);
}
