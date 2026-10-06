/**
 * One OPD day pilot — reception → doctor → lab → pharmacy → cashier.
 * Uses live stores (registry, visits, clinical bus, bills).
 */
import {
  upsertPatient,
  listPatients,
  generateHospitalNumber,
  type FacilityPatient,
} from './patientRegistryStore';
import { checkInPatient, todayVisits, updateVisitStatus } from './receptionOpsStore';
import { placeOrder, postLabResult, listOrders, updateOrderStatus } from './clinicalEventBus';
import { markOrderPaid, listBillLines, patientBalance } from './patientBillingStore';
import { appendAudit } from './auditLogStore';

export interface PilotStepResult {
  step: number;
  name: string;
  ok: boolean;
  detail: string;
}

export interface PilotRunResult {
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  steps: PilotStepResult[];
  balanceNgn: number;
  openOrders: number;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function runOpdDayPilot(input: {
  facilityId: string;
  actorName: string;
  actorBadge?: string;
  facilityName?: string;
  patientFirstName?: string;
  patientLastName?: string;
}): PilotRunResult {
  const facilityId = input.facilityId;
  const steps: PilotStepResult[] = [];
  const first = input.patientFirstName || 'Ngozi';
  const last = input.patientLastName || `Pilot${Date.now().toString(36).slice(-4)}`;

  const hospitalNumber = generateHospitalNumber(facilityId);
  const patient: FacilityPatient = upsertPatient({
    id: uid('PT'),
    hospitalNumber,
    firstName: first,
    lastName: last,
    dob: '1990-05-12',
    sex: 'Female',
    phone: '08030000000',
    bloodGroup: 'O+',
    genotype: 'AA',
    allergies: [],
    facilityId,
    facilityName: input.facilityName || facilityId,
    status: 'active',
    registeredAt: new Date().toISOString(),
  });
  steps.push({
    step: 1,
    name: 'Reception · Register patient',
    ok: true,
    detail: `${patient.firstName} ${patient.lastName} · ${patient.hospitalNumber}`,
  });

  const patientName = `${patient.firstName} ${patient.lastName}`;

  try {
    const visit = checkInPatient({
      patient,
      facilityId,
      department: 'OPD',
      doctor: input.actorName,
      visitType: 'walkin',
      paymentStatus: 'pending',
      reason: 'OPD pilot fever',
    });
    steps.push({
      step: 2,
      name: 'Reception · Check-in / queue',
      ok: true,
      detail: `Queue ${visit.queueNumber} · waiting`,
    });
  } catch (e) {
    steps.push({
      step: 2,
      name: 'Reception · Check-in / queue',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  try {
    const visits = todayVisits(facilityId).filter((v) => v.patientId === patient.id);
    if (visits[0]) {
      updateVisitStatus(visits[0].id, 'with_provider');
      steps.push({
        step: 3,
        name: 'Doctor · Call / start consult',
        ok: true,
        detail: `Queue ${visits[0].queueNumber} → with provider`,
      });
    } else {
      steps.push({ step: 3, name: 'Doctor · Call / start consult', ok: false, detail: 'No visit found' });
    }
  } catch (e) {
    steps.push({
      step: 3,
      name: 'Doctor · Call / start consult',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  const orderIds: string[] = [];
  try {
    for (const item of [
      { type: 'lab' as const, code: 'MP', name: 'Malaria Parasite (RDT + Film)', priority: 'urgent' as const },
      { type: 'lab' as const, code: 'FBC', name: 'Full Blood Count (FBC + Diff)', priority: 'urgent' as const },
      { type: 'rx' as const, code: 'ACT', name: 'Artemether-Lumefantrine 20/120', priority: 'routine' as const },
    ]) {
      const o = placeOrder({
        facilityId,
        patientId: patient.id,
        patientName,
        hospitalNumber: patient.hospitalNumber,
        type: item.type,
        code: item.code,
        name: item.name,
        orderedBy: input.actorName,
        orderedByBadge: input.actorBadge,
        priority: item.priority,
      });
      orderIds.push(o.id);
    }
    steps.push({
      step: 4,
      name: 'Doctor · Orders (lab + Rx) + auto-bills',
      ok: true,
      detail: `${orderIds.length} orders on bus · lab/Rx bill lines created`,
    });
  } catch (e) {
    steps.push({
      step: 4,
      name: 'Doctor · Orders (lab + Rx) + auto-bills',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  try {
    const labs = listOrders(facilityId, { patientId: patient.id }).filter((o) => o.type === 'lab');
    for (const o of labs) updateOrderStatus(o.id, 'in_progress');
    const mp = labs.find((o) => /malaria|MP/i.test(o.name + o.code)) || labs[0];
    if (mp) {
      postLabResult(mp.id, 'MP RDT POSITIVE · trophozoites seen on film (critical)', 'Lab Tech Pilot');
      steps.push({
        step: 5,
        name: 'Laboratory · Post critical-style result',
        ok: true,
        detail: `${mp.name} → critical · doctor ACK may appear on desk`,
      });
    } else {
      steps.push({ step: 5, name: 'Laboratory · Post result', ok: false, detail: 'No lab order' });
    }
  } catch (e) {
    steps.push({
      step: 5,
      name: 'Laboratory · Post result',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  try {
    const lines = listBillLines(facilityId, { patientId: patient.id }).filter(
      (l) => l.status === 'unpaid' || l.status === 'partial'
    );
    let paid = 0;
    for (const line of lines) {
      if (line.orderId) {
        markOrderPaid(line.orderId, {
          via: 'cashier',
          paidBy: input.actorName,
          paymentRef: uid('PAY'),
        });
        paid += 1;
      }
    }
    steps.push({
      step: 6,
      name: 'Cashier · Collect lab/Rx bills',
      ok: true,
      detail: `${paid} bill line(s) marked paid`,
    });
  } catch (e) {
    steps.push({
      step: 6,
      name: 'Cashier · Collect bills',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  try {
    const rxs = listOrders(facilityId, { patientId: patient.id }).filter((o) => o.type === 'rx');
    for (const o of rxs) {
      updateOrderStatus(o.id, 'resulted', {
        resultSummary: 'Dispensed at pharmacy',
        resultedBy: 'Pharmacist Pilot',
      });
    }
    steps.push({
      step: 7,
      name: 'Pharmacy · Dispense Rx',
      ok: true,
      detail: `${rxs.length} prescription(s) dispensed`,
    });
  } catch (e) {
    steps.push({
      step: 7,
      name: 'Pharmacy · Dispense',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  try {
    const visits = todayVisits(facilityId).filter((v) => v.patientId === patient.id);
    if (visits[0]) updateVisitStatus(visits[0].id, 'completed');
    steps.push({ step: 8, name: 'Doctor · Complete visit', ok: true, detail: 'Visit closed' });
  } catch (e) {
    steps.push({
      step: 8,
      name: 'Doctor · Complete visit',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  try {
    appendAudit({
      facilityId,
      actor: input.actorName,
      actorBadge: input.actorBadge,
      action: 'opd_pilot_run',
      entity: 'pilot',
      entityId: patient.id,
      detail: steps.map((s) => `${s.step}:${s.ok ? 'ok' : 'fail'}`).join(','),
    });
  } catch {
    /* ignore */
  }

  return {
    patientId: patient.id,
    hospitalNumber: patient.hospitalNumber,
    patientName,
    steps,
    balanceNgn: patientBalance(facilityId, patient.id),
    openOrders: listOrders(facilityId, { patientId: patient.id }).filter(
      (o) => o.status !== 'resulted' && o.status !== 'cancelled'
    ).length,
  };
}
