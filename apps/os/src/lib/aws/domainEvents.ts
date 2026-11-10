import { publishMedCoreEvent, MedCoreDomainEvent } from './eventBridge';

/**
 * Domain Event Dispatchers implementing Database-First, Event-Second flow.
 */

export async function emitPatientRegisteredEvent(patient: {
  id: string;
  hospitalNumber: string;
  fullName: string;
  facilityId: string;
  category?: string;
  insuranceProvider?: string;
}) {
  return publishMedCoreEvent({
    source: 'medcore.emr.reception',
    detailType: 'PatientRegistered',
    facilityId: patient.facilityId,
    detail: {
      patientId: patient.id,
      hospitalNumber: patient.hospitalNumber,
      fullName: patient.fullName,
      category: patient.category || 'General Outpatient',
      insuranceProvider: patient.insuranceProvider || 'Self-pay',
      action: 'registered_at_front_desk',
      nextDepartment: 'Triage / Nursing Vitals',
    },
  });
}

export async function emitPaymentConfirmedEvent(payment: {
  paymentId: string;
  patientId: string;
  amountNgn: number;
  channel: string;
  purpose: string;
  facilityId: string;
  arn?: string;
  reference?: string;
}) {
  return publishMedCoreEvent({
    source: 'medcore.emr.billing',
    detailType: 'PaymentConfirmed',
    facilityId: payment.facilityId,
    detail: {
      paymentId: payment.paymentId,
      patientId: payment.patientId,
      amountNgn: payment.amountNgn,
      channel: payment.channel,
      purpose: payment.purpose,
      reference: payment.reference || payment.arn,
      clearedForService: true,
      action: 'release_orders_to_pharmacy_and_laboratory',
    },
  });
}

export async function emitClinicalOrderCreatedEvent(order: {
  orderId: string;
  patientId: string;
  doctorBadge: string;
  orderType: 'Rx' | 'Lab' | 'Imaging' | 'Nursing';
  items: string[];
  facilityId: string;
  stat?: boolean;
}) {
  return publishMedCoreEvent({
    source: 'medcore.emr.clinical',
    detailType: 'ClinicalOrderCreated',
    facilityId: order.facilityId,
    detail: {
      orderId: order.orderId,
      patientId: order.patientId,
      doctorBadge: order.doctorBadge,
      orderType: order.orderType,
      items: order.items,
      isStat: Boolean(order.stat),
      action: 'route_invoice_to_accounts_and_stage_ancillary_worklist',
    },
  });
}

export async function emitVitalsRecordedEvent(vitals: {
  patientId: string;
  nurseBadge: string;
  bp: string;
  pulse: number;
  temp: number;
  spo2: number;
  triagePriority: 'Green' | 'Yellow' | 'Red' | 'Routine';
  facilityId: string;
}) {
  return publishMedCoreEvent({
    source: 'medcore.emr.triage',
    detailType: 'VitalsRecorded',
    facilityId: vitals.facilityId,
    detail: {
      patientId: vitals.patientId,
      nurseBadge: vitals.nurseBadge,
      bp: vitals.bp,
      pulse: vitals.pulse,
      temp: vitals.temp,
      spo2: vitals.spo2,
      triagePriority: vitals.triagePriority,
      action: 'move_to_doctor_consultation_waiting_room',
    },
  });
}

