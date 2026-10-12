/**
 * Epic/Cerner-style front-desk workqueues — schedule grid, no-show/recall,
 * referrals, print packs, pre-visit estimates. Local-first + realtime events.
 */
import { getActiveFacilityId } from './adminRealtimeStore';
import {
  bookAppointment,
  listAppointments,
  listVisits,
  updateVisitStatus,
  checkInPatient,
  type ReceptionAppointment,
  type ReceptionVisit,
} from './receptionOpsStore';
import type { FacilityPatient } from './patientRegistryStore';
import { CONSULT_FEES, RECEPTION_DEPTS } from './receptionConstants';

const KEY = 'medcore_os_frontdesk_wq_v1';
const EVT = 'medcore-frontdesk-wq';

export type SlotStatus = 'open' | 'booked' | 'blocked' | 'overbook';

export interface ScheduleSlot {
  id: string;
  facilityId: string;
  department: string;
  doctor: string;
  day: string; // YYYY-MM-DD
  startMin: number; // minutes from midnight
  durationMin: number;
  status: SlotStatus;
  patientId?: string;
  patientName?: string;
  hospitalNumber?: string;
  appointmentId?: string;
  blockReason?: string;
  createdAt: string;
}

export interface RecallItem {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  department: string;
  doctor: string;
  originalScheduledAt: string;
  appointmentId?: string;
  visitId?: string;
  reason: 'no_show' | 'cancelled' | 'follow_up';
  status: 'open' | 'contacted' | 'rescheduled' | 'closed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralIntake {
  id: string;
  facilityId: string;
  patientId?: string;
  patientName: string;
  hospitalNumber?: string;
  phone?: string;
  fromFacility: string;
  fromClinician?: string;
  toDepartment: string;
  reason: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  status: 'pending' | 'accepted' | 'scheduled' | 'converted' | 'declined';
  createdAt: string;
  convertedVisitId?: string;
  appointmentId?: string;
}

export interface VisitEstimate {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  department: string;
  lineItems: { label: string; amount: number }[];
  total: number;
  clearance: 'clear' | 'deposit_due' | 'blocked' | 'hmo_pending';
  depositRequired: number;
  notes?: string;
  createdAt: string;
}

export interface PrintPackPayload {
  kind: 'queue_ticket' | 'route_slip' | 'label' | 'full_pack';
  patientName: string;
  hospitalNumber: string;
  department: string;
  doctor?: string;
  queueNumber?: string;
  visitId?: string;
  barcode?: string;
  checkedInAt?: string;
  reason?: string;
}

type Store = {
  slots: ScheduleSlot[];
  recalls: RecallItem[];
  referrals: ReferralIntake[];
  estimates: VisitEstimate[];
};

function empty(): Store {
  return { slots: [], recalls: [], referrals: [], estimates: [] };
}

function load(): Store {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Store;
    return {
      slots: Array.isArray(p.slots) ? p.slots : [],
      recalls: Array.isArray(p.recalls) ? p.recalls : [],
      referrals: Array.isArray(p.referrals) ? p.referrals : [],
      estimates: Array.isArray(p.estimates) ? p.estimates : [],
    };
  } catch {
    return empty();
  }
}

function save(s: Store) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(EVT));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync'));
  } catch {
    /* */
  }
}

export function subscribeFrontDeskWq(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener('storage', h);
  };
}

function fid(facilityId?: string) {
  return facilityId || getActiveFacilityId() || 'DEFAULT';
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

/** Generate day grid 08:00–16:00 every 20 min for a provider */
export function ensureDayGrid(input: {
  facilityId?: string;
  department: string;
  doctor: string;
  day: string;
  startHour?: number;
  endHour?: number;
  slotMin?: number;
}): ScheduleSlot[] {
  const facilityId = fid(input.facilityId);
  const startH = input.startHour ?? 8;
  const endH = input.endHour ?? 16;
  const slotMin = input.slotMin ?? 20;
  const state = load();
  const existing = state.slots.filter(
    (s) =>
      s.facilityId === facilityId &&
      s.day === input.day &&
      s.department === input.department &&
      s.doctor === input.doctor
  );
  if (existing.length) return existing.sort((a, b) => a.startMin - b.startMin);

  const created: ScheduleSlot[] = [];
  for (let m = startH * 60; m < endH * 60; m += slotMin) {
    created.push({
      id: uid('SLT'),
      facilityId,
      department: input.department,
      doctor: input.doctor,
      day: input.day,
      startMin: m,
      durationMin: slotMin,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  }
  state.slots = [...state.slots, ...created];
  save(state);
  return created;
}

export function listSlots(facilityId: string, day: string, doctor?: string, department?: string): ScheduleSlot[] {
  return load()
    .slots.filter(
      (s) =>
        s.facilityId === facilityId &&
        s.day === day &&
        (!doctor || s.doctor === doctor) &&
        (!department || s.department === department)
    )
    .sort((a, b) => a.startMin - b.startMin || a.doctor.localeCompare(b.doctor));
}

export function formatSlotTime(startMin: number): string {
  const h = Math.floor(startMin / 60);
  const m = startMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function bookSlot(slotId: string, patient: FacilityPatient, overbook = false): ScheduleSlot | null {
  const state = load();
  const idx = state.slots.findIndex((s) => s.id === slotId);
  if (idx < 0) return null;
  const slot = state.slots[idx];
  if (slot.status === 'blocked') return null;
  if (slot.status === 'booked' && !overbook) return null;

  const dayIso = `${slot.day}T${String(Math.floor(slot.startMin / 60)).padStart(2, '0')}:${String(slot.startMin % 60).padStart(2, '0')}:00`;
  let appt: ReceptionAppointment | null = null;
  try {
    appt = bookAppointment({
      patientId: patient.id,
      hospitalNumber: patient.hospitalNumber,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      facilityId: slot.facilityId,
      department: slot.department,
      doctor: slot.doctor,
      scheduledAt: new Date(dayIso).toISOString(),
      reason: 'Scheduled via provider grid',
    });
  } catch {
    /* */
  }

  const next: ScheduleSlot = {
    ...slot,
    status: overbook && slot.status === 'booked' ? 'overbook' : 'booked',
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`.trim(),
    hospitalNumber: patient.hospitalNumber,
    appointmentId: appt?.id,
  };
  state.slots[idx] = next;
  save(state);
  return next;
}

export function blockSlot(slotId: string, reason: string): ScheduleSlot | null {
  const state = load();
  const idx = state.slots.findIndex((s) => s.id === slotId);
  if (idx < 0) return null;
  if (state.slots[idx].status === 'booked' || state.slots[idx].status === 'overbook') return null;
  state.slots[idx] = {
    ...state.slots[idx],
    status: 'blocked',
    blockReason: reason || 'Blocked',
    patientId: undefined,
    patientName: undefined,
    hospitalNumber: undefined,
    appointmentId: undefined,
  };
  save(state);
  return state.slots[idx];
}

export function openSlot(slotId: string): ScheduleSlot | null {
  const state = load();
  const idx = state.slots.findIndex((s) => s.id === slotId);
  if (idx < 0) return null;
  state.slots[idx] = {
    ...state.slots[idx],
    status: 'open',
    blockReason: undefined,
    patientId: undefined,
    patientName: undefined,
    hospitalNumber: undefined,
    appointmentId: undefined,
  };
  save(state);
  return state.slots[idx];
}

/** Mark appointment no-show and push recall queue */
export function markNoShowAndRecall(appointmentId: string, facilityId?: string): RecallItem | null {
  const facility = fid(facilityId);
  const appts = listAppointments(facility);
  const appt = appts.find((a) => a.id === appointmentId);
  if (!appt) return null;

  // Update appointment status via local ops if possible
  try {
    const raw = localStorage.getItem('medcore_os_reception_ops_v2');
    if (raw) {
      const ops = JSON.parse(raw);
      if (Array.isArray(ops.appointments)) {
        ops.appointments = ops.appointments.map((a: ReceptionAppointment) =>
          a.id === appointmentId ? { ...a, status: 'no_show' } : a
        );
        localStorage.setItem('medcore_os_reception_ops_v2', JSON.stringify(ops));
        window.dispatchEvent(new CustomEvent('medcore-reception-ops'));
      }
    }
  } catch {
    /* */
  }

  const state = load();
  const item: RecallItem = {
    id: uid('RCL'),
    facilityId: facility,
    patientId: appt.patientId,
    patientName: appt.patientName,
    hospitalNumber: appt.hospitalNumber,
    department: appt.department,
    doctor: appt.doctor,
    originalScheduledAt: appt.scheduledAt,
    appointmentId: appt.id,
    reason: 'no_show',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.recalls = [item, ...state.recalls];
  save(state);
  return item;
}

export function markVisitNoShow(visitId: string, facilityId?: string): RecallItem | null {
  const facility = fid(facilityId);
  updateVisitStatus(visitId, 'no_show');
  const visits = listVisits(facility);
  const v = visits.find((x) => x.id === visitId);
  if (!v) return null;
  const state = load();
  const item: RecallItem = {
    id: uid('RCL'),
    facilityId: facility,
    patientId: v.patientId,
    patientName: v.patientName,
    hospitalNumber: v.hospitalNumber,
    department: v.department,
    doctor: v.doctor,
    originalScheduledAt: v.checkedInAt,
    visitId: v.id,
    reason: 'no_show',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.recalls = [item, ...state.recalls];
  save(state);
  return item;
}

export function listRecalls(facilityId?: string, status?: RecallItem['status']): RecallItem[] {
  const facility = fid(facilityId);
  return load()
    .recalls.filter((r) => r.facilityId === facility && (!status || r.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateRecall(id: string, patch: Partial<RecallItem>): RecallItem | null {
  const state = load();
  const idx = state.recalls.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  state.recalls[idx] = { ...state.recalls[idx], ...patch, updatedAt: new Date().toISOString() };
  save(state);
  return state.recalls[idx];
}

export function createReferral(input: Omit<ReferralIntake, 'id' | 'createdAt' | 'status' | 'facilityId'> & { facilityId?: string }): ReferralIntake {
  const state = load();
  const row: ReferralIntake = {
    ...input,
    id: uid('REF'),
    facilityId: fid(input.facilityId),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  state.referrals = [row, ...state.referrals];
  save(state);
  return row;
}

export function listReferrals(facilityId?: string): ReferralIntake[] {
  const facility = fid(facilityId);
  return load()
    .referrals.filter((r) => r.facilityId === facility)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function convertReferralToVisit(
  referralId: string,
  patient: FacilityPatient | null,
  doctor = 'Duty doctor'
): { referral: ReferralIntake; visit: ReceptionVisit } | null {
  const state = load();
  const idx = state.referrals.findIndex((r) => r.id === referralId);
  if (idx < 0) return null;
  const ref = state.referrals[idx];
  const names = ref.patientName.trim().split(/\s+/);
  const stub: FacilityPatient = patient || {
    id: ref.patientId || `TMP-${ref.id}`,
    hospitalNumber: ref.hospitalNumber || `REF-${ref.id.slice(-6)}`,
    firstName: names[0] || 'Referral',
    lastName: names.slice(1).join(' ') || 'Patient',
    dob: '',
    sex: 'Other',
    phone: ref.phone || '',
    facilityId: ref.facilityId,
    facilityName: ref.facilityId,
    status: 'active',
    registeredAt: new Date().toISOString(),
  };
  const visit = checkInPatient({
    patient: stub,
    facilityId: ref.facilityId,
    department: ref.toDepartment,
    doctor,
    visitType: 'referral',
    reason: ref.reason,
    paymentStatus: 'pending',
  });
  state.referrals[idx] = {
    ...ref,
    status: 'converted',
    convertedVisitId: visit.id,
    patientId: stub.id,
    hospitalNumber: stub.hospitalNumber,
  };
  save(state);
  return { referral: state.referrals[idx], visit };
}

export function buildEstimate(input: {
  facilityId?: string;
  patient: FacilityPatient;
  department: string;
  extraItems?: { label: string; amount: number }[];
  hmo?: boolean;
}): VisitEstimate {
  const facilityId = fid(input.facilityId);
  const consult = CONSULT_FEES[input.department] ?? CONSULT_FEES['General OPD'] ?? 5000;
  const lineItems = [{ label: `${input.department} consultation`, amount: consult }, ...(input.extraItems || [])];
  const total = lineItems.reduce((s, x) => s + x.amount, 0);
  const hmo = input.hmo || (input.patient.insuranceProvider && input.patient.insuranceProvider !== 'NONE');
  const depositRequired = hmo ? 0 : Math.round(total * 0.5);
  const clearance: VisitEstimate['clearance'] = hmo ? 'hmo_pending' : total === 0 ? 'clear' : 'deposit_due';
  const row: VisitEstimate = {
    id: uid('EST'),
    facilityId,
    patientId: input.patient.id,
    patientName: `${input.patient.firstName} ${input.patient.lastName}`.trim(),
    hospitalNumber: input.patient.hospitalNumber,
    department: input.department,
    lineItems,
    total,
    clearance,
    depositRequired,
    createdAt: new Date().toISOString(),
  };
  const state = load();
  state.estimates = [row, ...state.estimates].slice(0, 100);
  save(state);
  return row;
}

export function listEstimates(facilityId?: string): VisitEstimate[] {
  const facility = fid(facilityId);
  return load()
    .estimates.filter((e) => e.facilityId === facility)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function printPackHtml(pack: PrintPackPayload): string {
  const when = pack.checkedInAt ? new Date(pack.checkedInAt).toLocaleString() : new Date().toLocaleString();
  const ticket = `
    <div style="font-family:system-ui,sans-serif;padding:16px;max-width:320px;border:2px dashed #0f766e;border-radius:12px;margin-bottom:12px">
      <div style="font-weight:800;font-size:14px;color:#0f766e">QUEUE TICKET</div>
      <div style="font-size:28px;font-weight:900;margin:8px 0">${pack.queueNumber || '—'}</div>
      <div style="font-weight:700">${pack.patientName}</div>
      <div style="font-size:12px;color:#64748b">${pack.hospitalNumber}</div>
      <div style="margin-top:8px;font-size:13px">${pack.department}${pack.doctor ? ' · ' + pack.doctor : ''}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px">${when}</div>
    </div>`;
  const label = `
    <div style="font-family:ui-monospace,monospace;padding:10px;max-width:280px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700">${pack.patientName}</div>
      <div style="font-size:10px">${pack.hospitalNumber}</div>
      <div style="font-size:10px">${pack.department}</div>
      <div style="font-size:9px;margin-top:4px">${pack.barcode || pack.hospitalNumber}</div>
    </div>`;
  const route = `
    <div style="font-family:system-ui,sans-serif;padding:16px;max-width:420px;border:1px solid #e2e8f0;border-radius:12px">
      <div style="font-weight:800;font-size:15px">ROUTE SLIP</div>
      <div style="margin-top:8px"><strong>${pack.patientName}</strong> · ${pack.hospitalNumber}</div>
      <ol style="margin:12px 0;padding-left:18px;font-size:13px;line-height:1.6">
        <li>Accounts / NHIA clearance (if required)</li>
        <li>Proceed to <strong>${pack.department}</strong></li>
        <li>Present this slip + queue ticket to clinic nurse</li>
        ${pack.reason ? `<li>Chief complaint: ${pack.reason}</li>` : ''}
      </ol>
      <div style="font-size:11px;color:#64748b">${when}</div>
    </div>`;
  if (pack.kind === 'queue_ticket') return ticket;
  if (pack.kind === 'label') return label;
  if (pack.kind === 'route_slip') return route;
  return ticket + label + route;
}

export function openPrintWindow(pack: PrintPackPayload) {
  if (typeof window === 'undefined') return;
  const html = `<!DOCTYPE html><html><head><title>Print pack · ${pack.patientName}</title></head><body onload="window.print()">${printPackHtml(pack)}</body></html>`;
  const w = window.open('', '_blank', 'width=480,height=640');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export { RECEPTION_DEPTS, CONSULT_FEES };
