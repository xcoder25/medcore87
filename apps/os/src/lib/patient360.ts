/**
 * Patient 360 — longitudinal timeline from authoritative hospital stores.
 * AI/EMR assist only; registry + visits + orders + bills remain source of truth.
 */
import { getPatient, listPatients, type FacilityPatient } from './patientRegistryStore';
import { listVisits, listAppointments, todayPayments, type ReceptionVisit, type ReceptionAppointment, type ReceptionPayment } from './receptionOpsStore';
import { listOrders, type ClinicalOrder } from './clinicalEventBus';
import { listBillLines, type PatientBillLine } from './patientBillingStore';

export type TimelineKind =
  | 'registration'
  | 'visit'
  | 'appointment'
  | 'lab'
  | 'rx'
  | 'imaging'
  | 'payment'
  | 'bill'
  | 'note';

export interface TimelineEvent {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  status?: string;
  meta?: Record<string, string>;
}

export interface Patient360Bundle {
  patient: FacilityPatient;
  events: TimelineEvent[];
  openOrders: ClinicalOrder[];
  unpaidBills: PatientBillLine[];
  recentVisits: ReceptionVisit[];
  balanceNgn: number;
}

function matchPatient(p: FacilityPatient, v: { patientId?: string; hospitalNumber?: string }) {
  return v.patientId === p.id || v.hospitalNumber === p.hospitalNumber;
}

export function buildPatient360(facilityId: string, patientKey: string): Patient360Bundle | null {
  const patient =
    getPatient(patientKey) ||
    listPatients(facilityId).find(
      (p) =>
        p.id === patientKey ||
        p.hospitalNumber === patientKey ||
        `${p.firstName} ${p.lastName}`.toLowerCase() === patientKey.toLowerCase()
    );
  if (!patient) return null;

  const events: TimelineEvent[] = [];

  events.push({
    id: `reg-${patient.id}`,
    at: patient.registeredAt,
    kind: 'registration',
    title: 'Registered',
    detail: `${patient.facilityName || 'Facility'} · ${patient.hospitalNumber}`,
    status: patient.status,
  });

  for (const v of listVisits(facilityId).filter((x) => matchPatient(patient, x))) {
    events.push({
      id: v.id,
      at: v.checkedInAt,
      kind: 'visit',
      title: `Visit · ${v.department}`,
      detail: `Queue ${v.queueNumber} · ${v.visitType} · ${v.doctor || 'Unassigned'}`,
      status: v.status,
      meta: { queue: v.queueNumber },
    });
  }

  for (const a of listAppointments(facilityId).filter((x) => matchPatient(patient, x))) {
    events.push({
      id: a.id,
      at: a.scheduledAt || a.createdAt,
      kind: 'appointment',
      title: `Appointment · ${a.department}`,
      detail: `${(a.scheduledAt || '').slice(0, 16).replace('T', ' ')} · ${a.doctor || '—'}`,
      status: a.status,
    });
  }

  for (const o of listOrders(facilityId).filter((x) => matchPatient(patient, x))) {
    events.push({
      id: o.id,
      at: o.createdAt,
      kind: o.type === 'lab' ? 'lab' : o.type === 'rx' ? 'rx' : 'imaging',
      title: `${o.type.toUpperCase()} · ${o.name}`,
      detail: `Ordered by ${o.orderedBy}${o.resultSummary ? ` · ${o.resultSummary}` : ''}`,
      status: o.status,
    });
  }

  for (const b of listBillLines(facilityId, { patientId: patient.id })) {
    events.push({
      id: b.id,
      at: b.createdAt,
      kind: 'bill',
      title: b.description,
      detail: `₦${b.amountNgn.toLocaleString()} · ${b.status}`,
      status: b.status,
    });
  }

  // payments today only in store API — still useful
  for (const pay of todayPayments(facilityId).filter((x) => matchPatient(patient, x))) {
    events.push({
      id: pay.id,
      at: pay.createdAt,
      kind: 'payment',
      title: `Payment · ${pay.purpose}`,
      detail: `₦${pay.amount.toLocaleString()} · ${pay.method} · ${pay.reference}`,
      status: pay.status,
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));

  const openOrders = listOrders(facilityId).filter(
    (o) => matchPatient(patient, o) && o.status !== 'resulted' && o.status !== 'cancelled'
  );
  const unpaidBills = listBillLines(facilityId, { patientId: patient.id }).filter(
    (b) => b.status === 'unpaid' || b.status === 'partial'
  );
  const recentVisits = listVisits(facilityId)
    .filter((x) => matchPatient(patient, x))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    .slice(0, 10);

  return {
    patient,
    events,
    openOrders,
    unpaidBills,
    recentVisits,
    balanceNgn: unpaidBills.reduce((s, b) => s + b.amountNgn, 0),
  };
}

export function searchPatients360(facilityId: string, q: string): FacilityPatient[] {
  const s = q.trim().toLowerCase();
  if (!s) return listPatients(facilityId).slice(0, 30);
  return listPatients(facilityId)
    .filter(
      (p) =>
        p.hospitalNumber.toLowerCase().includes(s) ||
        p.firstName.toLowerCase().includes(s) ||
        p.lastName.toLowerCase().includes(s) ||
        (p.phone || '').includes(s) ||
        (p.nin || '').includes(s)
    )
    .slice(0, 40);
}
