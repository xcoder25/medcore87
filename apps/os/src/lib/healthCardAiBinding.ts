/**
 * AI-Powered Auto-Binding Service:
 * Automatically binds Doctor/Reception scheduled appointments and clinical visits
 * to the patient's Digital Health Card / SHID, generating a live scan-ready brief
 * for instant confirmation and queue check-in upon card scan.
 */
import { publishFacilityData } from './roleSyncBus';
import { listPatients, type FacilityPatient } from './patientRegistryStore';
import { getReceptionSettings } from './receptionSettingsStore';
import type { ReceptionAppointment, ReceptionVisit } from './receptionOpsStore';

export const HEALTH_CARD_BINDINGS_KEY = 'medcore_os_health_card_bindings_v1';
export const HEALTH_CARD_BINDINGS_EVENT = 'medcore-health-card-binding';

export interface BoundAppointmentEntry {
  appointmentId: string;
  department: string;
  doctor: string;
  scheduledAt: string;
  reason?: string;
  status: ReceptionAppointment['status'];
  source: 'doctor' | 'reception' | 'ai';
  boundAt: string;
}

export interface BoundVisitEntry {
  visitId: string;
  encounterId?: string;
  queueNumber: string;
  department: string;
  doctor: string;
  status: string;
  visitType: string;
  triageUrgency?: string;
  vitalsSummary?: string;
  checkedInAt: string;
  updatedAt: string;
}

export interface HealthCardAiBrief {
  headline: string;
  readinessScore: number;
  recommendedAction: 'confirm_appointment' | 'continue_visit' | 'walkin_checkin';
  recommendedLabel: string;
  alerts: string[];
  highlights: string[];
  generatedAt: string;
}

export interface HealthCardBindingRecord {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  shid?: string;
  appointments: BoundAppointmentEntry[];
  visits: BoundVisitEntry[];
  aiBrief: HealthCardAiBrief;
  updatedAt: string;
}

export interface HealthCardLivePacket {
  shid?: string;
  patient?: FacilityPatient;
  upcomingAppointments: BoundAppointmentEntry[];
  recentVisits: BoundVisitEntry[];
  activeVisit?: BoundVisitEntry;
  aiBrief: HealthCardAiBrief;
  boundAt?: string;
}

type BindingStateMap = Record<string, HealthCardBindingRecord>;

function norm(s: string | undefined | null): string {
  return String(s || '').trim().toUpperCase();
}

function bindingKey(facilityId: string, patientId: string): string {
  return `${norm(facilityId)}::${norm(patientId)}`;
}

function loadBindings(): BindingStateMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HEALTH_CARD_BINDINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as BindingStateMap) : {};
  } catch {
    return {};
  }
}

function saveBindings(facilityId: string, map: BindingStateMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HEALTH_CARD_BINDINGS_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(HEALTH_CARD_BINDINGS_EVENT, { detail: { facilityId } }));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: HEALTH_CARD_BINDINGS_KEY } }));
    publishFacilityData(facilityId, HEALTH_CARD_BINDINGS_KEY, map);
    try {
      const bc = new BroadcastChannel('medcore_health_card_bindings');
      bc.postMessage({ type: 'binding_update', facilityId });
      bc.close();
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

function findPatientRecord(
  facilityId: string,
  ref: { patientId?: string; hospitalNumber?: string; shid?: string }
): FacilityPatient | undefined {
  const patients = listPatients(facilityId);
  const pid = norm(ref.patientId);
  const hn = norm(ref.hospitalNumber);
  const shid = norm(ref.shid);
  return patients.find(
    (p) =>
      (pid && norm(p.id) === pid) ||
      (hn && (norm(p.hospitalNumber) === hn || norm(p.mrn) === hn)) ||
      (shid && norm(p.shid) === shid)
  );
}

/**
 * Pure AI summary compiler combining scheduled appointments, active/past visits,
 * allergy/chronic alerts, and arrival recommendations for any Health Card scan.
 */
export function buildHealthCardAiBrief(params: {
  patient?: FacilityPatient;
  appointments: BoundAppointmentEntry[];
  visits: BoundVisitEntry[];
}): HealthCardAiBrief {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const alerts: string[] = [];
  const highlights: string[] = [];

  if (params.patient?.allergies?.length) {
    alerts.push(`Allergy Alert: ${params.patient.allergies.join(', ')}`);
  }
  if (params.patient?.chronicConditions?.length) {
    highlights.push(`Chronic Profile: ${params.patient.chronicConditions.join(', ')}`);
  }
  if (params.patient?.shid) {
    highlights.push(`Linked SHID: ${params.patient.shid}`);
  }

  const activeAppts = params.appointments
    .filter((a) => a.status === 'booked')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const activeVisit = params.visits.find(
    (v) =>
      v.status === 'waiting' ||
      v.status === 'called' ||
      v.status === 'with_provider' ||
      v.status === 'admitted'
  );

  if (activeVisit) {
    highlights.push(`Active Queue #${activeVisit.queueNumber} · ${activeVisit.department} (${activeVisit.status.replace(/_/g, ' ')})`);
    return {
      headline: `Active ${activeVisit.department} Visit (#${activeVisit.queueNumber}) synced to Health Card`,
      readinessScore: 98,
      recommendedAction: 'continue_visit',
      recommendedLabel: `Open Active Queue (${activeVisit.queueNumber})`,
      alerts,
      highlights,
      generatedAt: nowIso,
    };
  }

  if (activeAppts.length > 0) {
    const nextAppt = activeAppts[0];
    const isToday = nextAppt.scheduledAt.slice(0, 10) === todayStr;
    const whenText = isToday
      ? `Today ${nextAppt.scheduledAt.slice(11, 16) || ''}`.trim()
      : nextAppt.scheduledAt.slice(0, 16).replace('T', ' ');
    highlights.push(`AI-Bound Appt: ${nextAppt.department} with ${nextAppt.doctor} (${whenText})`);
    return {
      headline: isToday
        ? `Scheduled ${nextAppt.department} Appointment Today · Ready for Scan Confirmation`
        : `Upcoming ${nextAppt.department} Appointment Bound (${nextAppt.scheduledAt.slice(0, 10)})`,
      readinessScore: 95,
      recommendedAction: 'confirm_appointment',
      recommendedLabel: 'Confirm & Check-In Appointment',
      alerts,
      highlights,
      generatedAt: nowIso,
    };
  }

  if (params.visits.length > 0) {
    const last = params.visits[0];
    highlights.push(`Last Visit: ${last.department} (${last.checkedInAt.slice(0, 10)}) · ${last.status}`);
  }

  return {
    headline: params.patient?.shid
      ? 'Digital Health Card Verified · Ready for Walk-In or Appointment Check-In'
      : 'Patient Record Verified · Issue or Scan SHID Card to Sync Care Events',
    readinessScore: params.patient?.shid ? 88 : 74,
    recommendedAction: 'walkin_checkin',
    recommendedLabel: 'Walk-in Check-In',
    alerts,
    highlights,
    generatedAt: nowIso,
  };
}

/**
 * Automatically bind a scheduled Doctor or Reception appointment onto the patient's Digital Health Card.
 */
export function autoBindAppointmentToHealthCard(
  appt: ReceptionAppointment,
  opts?: { source?: 'doctor' | 'reception' | 'ai' }
): HealthCardBindingRecord | null {
  if (typeof window === 'undefined' || !appt?.facilityId) return null;
  const settings = getReceptionSettings(appt.facilityId);
  if (settings.autoBindAppointmentsToHealthCard === false) return null;

  const patient = findPatientRecord(appt.facilityId, {
    patientId: appt.patientId,
    hospitalNumber: appt.hospitalNumber,
  });
  const canonicalPatientId = patient?.id || appt.patientId || appt.hospitalNumber;
  if (!canonicalPatientId) return null;

  const map = loadBindings();
  const key = bindingKey(appt.facilityId, canonicalPatientId);
  const now = new Date().toISOString();
  const existing = map[key];

  const entry: BoundAppointmentEntry = {
    appointmentId: appt.id,
    department: appt.department || 'General OPD',
    doctor: appt.doctor || 'Attending Medical Officer',
    scheduledAt: appt.scheduledAt,
    reason: appt.reason,
    status: appt.status,
    source: opts?.source || 'ai',
    boundAt: existing?.appointments.find((x) => x.appointmentId === appt.id)?.boundAt || now,
  };

  const mergedAppts = [
    entry,
    ...(existing?.appointments || []).filter((x) => x.appointmentId !== appt.id),
  ].slice(0, 25);

  const visits = existing?.visits || [];
  const nextRecord: HealthCardBindingRecord = {
    facilityId: appt.facilityId,
    patientId: canonicalPatientId,
    hospitalNumber: patient?.hospitalNumber || appt.hospitalNumber || canonicalPatientId,
    patientName: appt.patientName || [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Patient',
    shid: patient?.shid || existing?.shid,
    appointments: mergedAppts,
    visits,
    aiBrief: buildHealthCardAiBrief({ patient, appointments: mergedAppts, visits }),
    updatedAt: now,
  };

  map[key] = nextRecord;
  saveBindings(appt.facilityId, map);
  return nextRecord;
}

/**
 * Automatically bind or update an active/completed OPD or inpatient visit on the patient's Health Card.
 */
export function autoBindVisitToHealthCard(visit: ReceptionVisit): HealthCardBindingRecord | null {
  if (typeof window === 'undefined' || !visit?.facilityId) return null;
  const settings = getReceptionSettings(visit.facilityId);
  if (settings.autoBindVisitsToHealthCard === false) return null;

  const patient = findPatientRecord(visit.facilityId, {
    patientId: visit.patientId,
    hospitalNumber: visit.hospitalNumber,
  });
  const canonicalPatientId = patient?.id || visit.patientId || visit.hospitalNumber;
  if (!canonicalPatientId) return null;

  const map = loadBindings();
  const key = bindingKey(visit.facilityId, canonicalPatientId);
  const now = new Date().toISOString();
  const existing = map[key];

  const entry: BoundVisitEntry = {
    visitId: visit.id,
    encounterId: visit.encounterId,
    queueNumber: visit.queueNumber,
    department: visit.department,
    doctor: visit.doctor,
    status: visit.status,
    visitType: visit.visitType,
    triageUrgency: visit.triageUrgency,
    vitalsSummary: visit.vitalsSummary,
    checkedInAt: visit.checkedInAt,
    updatedAt: now,
  };

  const mergedVisits = [
    entry,
    ...(existing?.visits || []).filter((x) => x.visitId !== visit.id),
  ].slice(0, 25);

  // If this visit fulfilled an appointment, reflect arrived status on bound appointment too
  const mergedAppts = (existing?.appointments || []).map((a) =>
    visit.appointmentId && a.appointmentId === visit.appointmentId && a.status === 'booked'
      ? { ...a, status: 'arrived' as const }
      : a
  );

  const nextRecord: HealthCardBindingRecord = {
    facilityId: visit.facilityId,
    patientId: canonicalPatientId,
    hospitalNumber: patient?.hospitalNumber || visit.hospitalNumber || canonicalPatientId,
    patientName: visit.patientName || [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Patient',
    shid: patient?.shid || existing?.shid,
    appointments: mergedAppts,
    visits: mergedVisits,
    aiBrief: buildHealthCardAiBrief({ patient, appointments: mergedAppts, visits: mergedVisits }),
    updatedAt: now,
  };

  map[key] = nextRecord;
  saveBindings(visit.facilityId, map);
  return nextRecord;
}

export function markBoundAppointmentConfirmed(
  facilityId: string,
  appointmentId: string,
  patientId?: string
): void {
  if (typeof window === 'undefined') return;
  const map = loadBindings();
  let changed = false;
  const now = new Date().toISOString();

  for (const [k, rec] of Object.entries(map)) {
    if (norm(rec.facilityId) !== norm(facilityId)) continue;
    if (patientId && norm(rec.patientId) !== norm(patientId)) continue;
    const hit = rec.appointments.some((a) => a.appointmentId === appointmentId);
    if (!hit) continue;
    const appts = rec.appointments.map((a) =>
      a.appointmentId === appointmentId ? { ...a, status: 'arrived' as const } : a
    );
    const patient = findPatientRecord(facilityId, { patientId: rec.patientId, hospitalNumber: rec.hospitalNumber });
    map[k] = {
      ...rec,
      appointments: appts,
      aiBrief: buildHealthCardAiBrief({ patient, appointments: appts, visits: rec.visits }),
      updatedAt: now,
    };
    changed = true;
  }

  if (changed) saveBindings(facilityId, map);
}

/**
 * Retrieve the unified real-time Health Card packet (auto-bound appointments, active/past visits, and AI brief).
 */
export function getHealthCardLivePacket(
  facilityId: string,
  ref: { patientId?: string; hospitalNumber?: string; shid?: string }
): HealthCardLivePacket {
  const patient = findPatientRecord(facilityId, ref);
  const pid = norm(patient?.id || ref.patientId);
  const hn = norm(patient?.hospitalNumber || ref.hospitalNumber);
  const shid = norm(patient?.shid || ref.shid);

  const map = loadBindings();
  let storedRec: HealthCardBindingRecord | undefined =
    pid ? map[bindingKey(facilityId, pid)] : undefined;

  if (!storedRec) {
    storedRec = Object.values(map).find(
      (r) =>
        norm(r.facilityId) === norm(facilityId) &&
        ((pid && norm(r.patientId) === pid) ||
          (hn && norm(r.hospitalNumber) === hn) ||
          (shid && norm(r.shid) === shid))
    );
  }

  // Merge any raw Reception Ops records in browser storage so pre-existing bookings appear seamlessly
  let rawAppts: ReceptionAppointment[] = [];
  let rawVisits: ReceptionVisit[] = [];
  if (typeof window !== 'undefined') {
    try {
      const rawOps = localStorage.getItem('medcore_os_reception_ops_v2');
      if (rawOps) {
        const parsed = JSON.parse(rawOps) as {
          appointments?: ReceptionAppointment[];
          visits?: ReceptionVisit[];
        };
        const matchRef = (r: { facilityId?: string; patientId?: string; hospitalNumber?: string }) =>
          norm(r.facilityId) === norm(facilityId) &&
          ((pid && norm(r.patientId) === pid) || (hn && norm(r.hospitalNumber) === hn));
        rawAppts = (parsed.appointments || []).filter(matchRef);
        rawVisits = (parsed.visits || []).filter(matchRef);
      }
    } catch {
      /* ignore */
    }
  }

  const apptById = new Map<string, BoundAppointmentEntry>();
  for (const a of storedRec?.appointments || []) {
    apptById.set(a.appointmentId, a);
  }
  for (const a of rawAppts) {
    if (!apptById.has(a.id)) {
      apptById.set(a.id, {
        appointmentId: a.id,
        department: a.department,
        doctor: a.doctor,
        scheduledAt: a.scheduledAt,
        reason: a.reason,
        status: a.status,
        source: 'reception',
        boundAt: a.createdAt || new Date().toISOString(),
      });
    } else {
      // Keep status synchronized with live reception ops store
      const prev = apptById.get(a.id)!;
      apptById.set(a.id, { ...prev, status: a.status });
    }
  }

  const visitById = new Map<string, BoundVisitEntry>();
  for (const v of storedRec?.visits || []) {
    visitById.set(v.visitId, v);
  }
  for (const v of rawVisits) {
    visitById.set(v.id, {
      visitId: v.id,
      encounterId: v.encounterId,
      queueNumber: v.queueNumber,
      department: v.department,
      doctor: v.doctor,
      status: v.status,
      visitType: v.visitType,
      triageUrgency: v.triageUrgency,
      vitalsSummary: v.vitalsSummary,
      checkedInAt: v.checkedInAt,
      updatedAt: v.completedAt || v.admittedAt || v.triagedAt || v.checkedInAt,
    });
  }

  const appointments = Array.from(apptById.values())
    .filter((a) => a.status !== 'cancelled')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const visits = Array.from(visitById.values()).sort((a, b) =>
    b.checkedInAt.localeCompare(a.checkedInAt)
  );

  const activeVisit = visits.find(
    (v) => v.status === 'waiting' || v.status === 'called' || v.status === 'with_provider' || v.status === 'admitted'
  );

  return {
    shid: patient?.shid || storedRec?.shid || ref.shid,
    patient,
    upcomingAppointments: appointments,
    recentVisits: visits.slice(0, 10),
    activeVisit,
    aiBrief: buildHealthCardAiBrief({ patient, appointments, visits }),
    boundAt: storedRec?.updatedAt,
  };
}

export function subscribeHealthCardBindings(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(HEALTH_CARD_BINDINGS_EVENT, fn);
  window.addEventListener('medcore-reception-ops', fn);
  window.addEventListener('medcore-admin-sync', fn);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('medcore_health_card_bindings');
    bc.onmessage = () => cb();
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener(HEALTH_CARD_BINDINGS_EVENT, fn);
    window.removeEventListener('medcore-reception-ops', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}
