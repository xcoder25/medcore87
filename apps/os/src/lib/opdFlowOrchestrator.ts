/**
 * End-to-end Nigerian OPD orchestrator — one pipeline for all desks.
 * Stages: register → folder fee → vitals → queue → consult → orders
 *        → Accounts PAID → release lab/Rx → results/dispense → disposition
 */
import {
  upsertPatient,
  generateHospitalNumber,
  type FacilityPatient,
  type PatientSex,
} from './patientRegistryStore';
import {
  checkInPatient,
  updateVisitStatus,
  markPatientWithProvider,
  markPatientConsultComplete,
  dischargePatientVisit,
  todayVisits,
  type ReceptionVisit,
} from './receptionOpsStore';
import {
  placeOrder,
  listOrders,
  releaseOrdersForPatient,
  dispenseOrder,
  postLabResult,
  updateOrderStatus,
  type ClinicalOrder,
} from './clinicalEventBus';
import {
  sendPaymentRequestToAccounts,
  markAccountsRequestPaid,
  listAccountsRequests,
} from './frontDeskAccountsBridge';
import { saveVitals, listVitals } from './nursingVitalsStore';
import { NIGERIAN_OPD_SUMMARY } from './nigerianOpdFlow';

export type FlowStepId =
  | 'register'
  | 'folder_invoice'
  | 'folder_paid'
  | 'vitals'
  | 'check_in'
  | 'call'
  | 'consult_open'
  | 'order_rx'
  | 'order_lab'
  | 'orders_paid'
  | 'lab_result'
  | 'dispense'
  | 'disposition';

export type FlowStepResult = {
  step: FlowStepId;
  ok: boolean;
  detail: string;
  data?: unknown;
};

export type CompleteOpdFlowResult = {
  patient: FacilityPatient;
  visit?: ReceptionVisit;
  steps: FlowStepResult[];
  summary: string;
};

function uid(p: string) {
  return `${p}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Run a complete ambulatory path for training / QA.
 * Mirrors real Nigerian pay-before-service + multi-desk handoffs.
 */
export function runCompleteOpdFlow(input: {
  facilityId: string;
  facilityName?: string;
  actorName: string;
  actorBadge?: string;
  firstName?: string;
  lastName?: string;
  sex?: PatientSex;
  /** If false, stop before simulating Accounts PAID */
  simulatePayments?: boolean;
}): CompleteOpdFlowResult {
  const facilityId = input.facilityId;
  const facilityName = input.facilityName || facilityId;
  const simulate = input.simulatePayments !== false;
  const steps: FlowStepResult[] = [];
  const first = input.firstName || 'Ada';
  const last = input.lastName || `Flow${Date.now().toString(36).slice(-3)}`;
  const sex = input.sex || 'Female';

  // 1. Register
  const hospitalNumber = generateHospitalNumber(facilityId);
  const patient = upsertPatient({
    id: uid('PT'),
    hospitalNumber,
    firstName: first,
    lastName: last,
    dob: '1992-01-15',
    sex,
    phone: '08030000001',
    bloodGroup: 'O+',
    genotype: 'AA',
    allergies: [],
    facilityId,
    facilityName,
    status: 'active',
    registeredAt: new Date().toISOString(),
  });
  const patientName = `${patient.firstName} ${patient.lastName}`;
  steps.push({
    step: 'register',
    ok: true,
    detail: `${patientName} · ${hospitalNumber}`,
    data: { hospitalNumber, patientId: patient.id },
  });

  // 2. Folder fee → Accounts
  let invoiceNumber = '';
  try {
    const req = sendPaymentRequestToAccounts({
      facilityId,
      facilityName,
      patientId: patient.id,
      hospitalNumber,
      patientName,
      amountNgn: 5000,
      purpose: 'New folder · Registration fee',
      source: 'registration',
      sentBy: input.actorName,
      sentByBadge: input.actorBadge,
    });
    invoiceNumber = req.invoiceNumber;
    steps.push({
      step: 'folder_invoice',
      ok: true,
      detail: `Invoice ${req.invoiceNumber} · ₦5,000 · awaiting Accounts`,
    });
  } catch (e) {
    steps.push({
      step: 'folder_invoice',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  // 3. Accounts PAID (folder)
  if (simulate && invoiceNumber) {
    try {
      const open = listAccountsRequests(facilityId, { patientId: patient.id }).find(
        (r) => r.status === 'awaiting_payment'
      );
      if (open) {
        markAccountsRequestPaid(open.id, {
          reference: `CASH-${Date.now().toString(36).toUpperCase()}`,
          via: 'cashier',
          paidBy: input.actorName,
        });
        steps.push({
          step: 'folder_paid',
          ok: true,
          detail: `Folder fee PAID · orders/path unlocked`,
        });
      }
    } catch (e) {
      steps.push({
        step: 'folder_paid',
        ok: false,
        detail: String((e as Error)?.message || e),
      });
    }
  }

  // 4. Vitals
  try {
    const vit = saveVitals({
      facilityId,
      patientId: patient.id,
      hospitalNumber,
      patientName,
      bpSystolic: 118,
      bpDiastolic: 76,
      pulse: 78,
      tempC: 36.8,
      weightKg: 68,
      spo2: 98,
      recordedBy: input.actorName,
    });
    steps.push({
      step: 'vitals',
      ok: true,
      detail: `Vitals ${vit.urgency} · BP ${vit.bpSystolic}/${vit.bpDiastolic}`,
    });
  } catch (e) {
    steps.push({
      step: 'vitals',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  // 5. Check-in queue
  let visit: ReceptionVisit | undefined;
  try {
    visit = checkInPatient({
      patient,
      facilityId,
      department: 'General OPD',
      doctor: input.actorName,
      visitType: 'walkin',
      paymentStatus: simulate ? 'paid' : 'pending',
      reason: 'Complete OPD flow',
    });
    steps.push({
      step: 'check_in',
      ok: true,
      detail: `Queue ${visit.queueNumber} · waiting`,
    });
  } catch (e) {
    steps.push({
      step: 'check_in',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  // 6. Call next
  if (visit) {
    try {
      updateVisitStatus(visit.id, 'called');
      steps.push({ step: 'call', ok: true, detail: `Called ${visit.queueNumber}` });
    } catch (e) {
      steps.push({ step: 'call', ok: false, detail: String((e as Error)?.message || e) });
    }
  }

  // 7. Doctor opens consult
  try {
    markPatientWithProvider(facilityId, patient.id, input.actorName);
    steps.push({
      step: 'consult_open',
      ok: true,
      detail: 'with_provider (doctor chart open)',
    });
  } catch (e) {
    steps.push({
      step: 'consult_open',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  // 8–9. Orders (Rx + lab)
  let rx: ClinicalOrder | undefined;
  let lab: ClinicalOrder | undefined;
  try {
    rx = placeOrder({
      facilityId,
      patientId: patient.id,
      patientName,
      hospitalNumber,
      type: 'rx',
      code: 'RX-PARA',
      name: 'Paracetamol 500mg tabs',
      orderedBy: input.actorName,
      orderedByBadge: input.actorBadge,
      priority: 'routine',
    });
    steps.push({
      step: 'order_rx',
      ok: true,
      detail: `${rx.id} · pending payment`,
    });
  } catch (e) {
    steps.push({ step: 'order_rx', ok: false, detail: String((e as Error)?.message || e) });
  }
  try {
    lab = placeOrder({
      facilityId,
      patientId: patient.id,
      patientName,
      hospitalNumber,
      type: 'lab',
      code: 'FBC',
      name: 'Full Blood Count',
      orderedBy: input.actorName,
      orderedByBadge: input.actorBadge,
      priority: 'routine',
    });
    steps.push({
      step: 'order_lab',
      ok: true,
      detail: `${lab.id} · pending payment`,
    });
  } catch (e) {
    steps.push({ step: 'order_lab', ok: false, detail: String((e as Error)?.message || e) });
  }

  // 10. Pay order bills at Accounts
  if (simulate) {
    try {
      const awaiting = listAccountsRequests(facilityId, { patientId: patient.id }).filter(
        (r) => r.status === 'awaiting_payment'
      );
      for (const r of awaiting) {
        markAccountsRequestPaid(r.id, {
          reference: `POS-${Date.now().toString(36).toUpperCase()}`,
          via: 'cashier',
          paidBy: input.actorName,
        });
      }
      const released = releaseOrdersForPatient(facilityId, patient.id);
      steps.push({
        step: 'orders_paid',
        ok: true,
        detail: `Accounts PAID · ${released.length || awaiting.length} order(s) released`,
      });
    } catch (e) {
      steps.push({
        step: 'orders_paid',
        ok: false,
        detail: String((e as Error)?.message || e),
      });
    }
  }

  // 11. Lab result
  if (lab) {
    try {
      releaseOrdersForPatient(facilityId, patient.id);
      updateOrderStatus(lab.id, 'in_progress');
      postLabResult(lab.id, 'WBC 6.2 · Hb 12.4 · Plt 210 (normal)', input.actorName);
      steps.push({
        step: 'lab_result',
        ok: true,
        detail: `Lab resulted · ${lab.name}`,
      });
    } catch (e) {
      steps.push({
        step: 'lab_result',
        ok: false,
        detail: String((e as Error)?.message || e),
      });
    }
  }

  // 12. Pharmacy dispense
  if (rx) {
    try {
      releaseOrdersForPatient(facilityId, patient.id);
      const d = dispenseOrder(rx.id, input.actorName);
      steps.push({
        step: 'dispense',
        ok: Boolean(d),
        detail: d ? `Dispensed ${rx.name}` : 'Dispense blocked (payment?)',
      });
    } catch (e) {
      steps.push({
        step: 'dispense',
        ok: false,
        detail: String((e as Error)?.message || e),
      });
    }
  }

  // 13. Disposition
  try {
    dischargePatientVisit(facilityId, patient.id, 'home');
    steps.push({
      step: 'disposition',
      ok: true,
      detail: 'Discharged home · visit completed',
    });
  } catch (e) {
    steps.push({
      step: 'disposition',
      ok: false,
      detail: String((e as Error)?.message || e),
    });
  }

  const okN = steps.filter((s) => s.ok).length;
  const summary =
    `Complete OPD flow for **${patientName}** (${hospitalNumber}): ${okN}/${steps.length} stages OK.\n\n` +
    steps.map((s) => `${s.ok ? '✓' : '✗'} ${s.step}: ${s.detail}`).join('\n');

  return { patient, visit, steps, summary: summary.replace(/\n/g, '\n') };
}

export function describeOpdPipeline(): string {
  return NIGERIAN_OPD_SUMMARY;
}

export function liveOpdSnapshot(facilityId: string) {
  const visits = todayVisits(facilityId);
  const orders = listOrders(facilityId);
  const openOrders = orders.filter((o) => o.status !== 'resulted' && o.status !== 'cancelled');
  const unpaidOrders = openOrders.filter((o) => !o.paymentCleared);
  return {
    waiting: visits.filter((v) => v.status === 'waiting').length,
    called: visits.filter((v) => v.status === 'called').length,
    withProvider: visits.filter((v) => v.status === 'with_provider').length,
    completed: visits.filter((v) => v.status === 'completed').length,
    openOrders: openOrders.length,
    unpaidOrders: unpaidOrders.length,
    recentVitals: listVitals(facilityId).slice(0, 5),
  };
}
