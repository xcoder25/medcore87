/**
 * Realtime presence → AI check-in engine
 *
 * Flow:
 *  Patient app detects facility → optional gesture →
 *  Presence event on bus → reception AI card →
 *  Admit → check-in + queue + SMS confirmation (no paper ticket required)
 *
 * OS is source of truth for queue writes; presence is intent only.
 */

import type { FacilityPatient } from './patientRegistryStore';
import { listPatients } from './patientRegistryStore';
import type { ReceptionAppointment, ReceptionVisit } from './receptionOpsStore';
import { listAppointments, todayVisits, checkInPatient } from './receptionOpsStore';
import { orchestrateArrival, type AiCheckInCard, type ArrivalIntent } from './receptionAiOrchestrator';
import { emitLiveAction } from './liveActions';
import { appendAudit } from './auditLogStore';
import { sendPatientAlert } from './integrations/gateways';
import { enqueueFacilitySync } from './durableOutbox';

export const PRESENCE_EVENT = 'medcore-patient-presence';
export const PRESENCE_CHANNEL = 'medcore_presence';

export type PresencePayload = {
  facilityId: string;
  /** Hospital number, NIN, phone, or patient id */
  patientKey?: string;
  patientId?: string;
  hospitalNumber?: string;
  phone?: string;
  intent?: ArrivalIntent;
  /** ISO time of arrival / gesture */
  at?: string;
  source?: 'mobile_app' | 'gesture' | 'qr' | 'beacon' | 'sim';
  displayName?: string;
};

export type PresenceCardEvent = {
  card: AiCheckInCard;
  patient: FacilityPatient;
  payload: PresencePayload;
};

function resolvePatient(facilityId: string, p: PresencePayload): FacilityPatient | undefined {
  const list = listPatients(facilityId);
  if (p.patientId) {
    const byId = list.find((x) => x.id === p.patientId);
    if (byId) return byId;
  }
  if (p.hospitalNumber) {
    const hn = p.hospitalNumber.toUpperCase();
    const byHn = list.find((x) => x.hospitalNumber.toUpperCase() === hn);
    if (byHn) return byHn;
  }
  if (p.phone) {
    const ph = p.phone.replace(/\D/g, '');
    const byPh = list.find((x) => (x.phone || '').replace(/\D/g, '').endsWith(ph.slice(-10)));
    if (byPh) return byPh;
  }
  if (p.patientKey) {
    const k = p.patientKey.trim().toLowerCase();
    return list.find(
      (x) =>
        x.id.toLowerCase() === k ||
        x.hospitalNumber.toLowerCase() === k ||
        (x.nin && x.nin.replace(/\D/g, '') === k.replace(/\D/g, '')) ||
        `${x.firstName} ${x.lastName}`.toLowerCase() === k
    );
  }
  return undefined;
}

/** Build AI check-in card from a presence event (pure + store reads). */
export function processPresenceArrival(
  payload: PresencePayload
): PresenceCardEvent | { error: string } {
  const facilityId = payload.facilityId;
  if (!facilityId) return { error: 'Missing facility' };

  const patient = resolvePatient(facilityId, payload);
  if (!patient) {
    return {
      error:
        'Patient not found in this hospital registry. Register once, then presence / gesture works.',
    };
  }

  const intent: ArrivalIntent =
    payload.intent ||
    (payload.source === 'gesture' ? 'gesture_checkin' : payload.source === 'mobile_app' ? 'app_presence' : 'qr_scan');

  const appts = listAppointments(facilityId);
  const visits = todayVisits(facilityId);
  const card = orchestrateArrival(
    {
      patient,
      facilityId,
      intent,
      arrivedAt: payload.at || new Date().toISOString(),
    },
    appts,
    visits
  );

  emitLiveAction(`Presence: ${patient.firstName} ${patient.lastName}`, {
    module: 'queue',
  });

  return { card, patient, payload };
}

/** Emit presence from patient app / gesture sim / QR — same hospital tabs receive it. */
export function emitPatientPresence(payload: PresencePayload) {
  if (typeof window === 'undefined') return;
  const detail = { ...payload, at: payload.at || new Date().toISOString() };
  window.dispatchEvent(new CustomEvent(PRESENCE_EVENT, { detail }));
  try {
    const bc = new BroadcastChannel(PRESENCE_CHANNEL);
    bc.postMessage(detail);
    bc.close();
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(
      'medcore_last_presence',
      JSON.stringify({ ...detail, _t: Date.now() })
    );
  } catch {
    /* ignore */
  }
  void enqueueFacilitySync(payload.facilityId, 'lastPresence', detail);
}

export function subscribePresence(handler: (p: PresencePayload) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent).detail as PresencePayload;
    if (d?.facilityId) handler(d);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== 'medcore_last_presence' || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue) as PresencePayload;
      if (d?.facilityId) handler(d);
    } catch {
      /* ignore */
    }
  };
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(PRESENCE_CHANNEL);
    bc.onmessage = (ev) => {
      const d = ev.data as PresencePayload;
      if (d?.facilityId) handler(d);
    };
  } catch {
    /* ignore */
  }
  window.addEventListener(PRESENCE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PRESENCE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Admit from AI card — writes queue, audit, optional SMS. No paper ticket required.
 */
export function admitFromPresence(input: {
  patient: FacilityPatient;
  facilityId: string;
  facilityName: string;
  department?: string;
  doctor?: string;
  visitType?: 'appointment' | 'walkin';
  actorName: string;
  actorBadge?: string;
  printTicket?: boolean;
}): ReceptionVisit {
  const visit = checkInPatient({
    patient: input.patient,
    facilityId: input.facilityId,
    department: input.department || 'General OPD',
    doctor: input.doctor || '',
    visitType: input.visitType || 'walkin',
    paymentStatus: 'pending',
  });

  appendAudit({
    facilityId: input.facilityId,
    actor: input.actorName,
    actorBadge: input.actorBadge,
    action: 'presence_admit',
    entity: 'visit',
    entityId: visit.id,
    detail: `${visit.queueNumber} · ${input.patient.hospitalNumber}`,
  });

  emitLiveAction(`Admitted ${visit.queueNumber} · ${input.patient.lastName}`, {
    module: 'queue',
  });

  if (input.patient.phone) {
    void sendPatientAlert({
      phone: input.patient.phone,
      message: `MedCore: Checked in at ${input.facilityName}. Queue ${visit.queueNumber}. Please wait to be called.`,
    });
  }

  return visit;
}
