/**
 * Celestia Front Desk — full desk automation + conversation memory helpers.
 */
import {
  parseReceptionAutomationIntent,
  extractReceptionJobWithAI,
  registerNewPatientWithFolderFee,
  parseSendAccountsIntent,
  sendPatientToAccounts,
  resolvePatientRef,
  canAutomateReception,
  receptionAutomationRefusal,
  type ReceptionRegJob,
  type ParseReceptionResult,
  type ParseSendAccountsResult,
  type RegisterPatientResult,
  type SendAccountsResult,
} from './receptionAutomation';
import {
  checkInPatient,
  todayVisits,
  updateVisitStatus,
  assignVisitDoctor,
  bookAppointment,
  type ReceptionVisit,
  type QueueStatus,
  type VisitType,
} from './receptionOpsStore';
import { listAccountsRequests } from './frontDeskAccountsBridge';
import { listBillLines } from './patientBillingStore';
import type { FacilityPatient } from './patientRegistryStore';
import {
  searchPatients,
  getPatientByHospitalNumber,
  listPatients,
  countPatients,
} from './patientRegistryStore';
import { pushNotification } from './notificationEngine';

export {
  canAutomateReception,
  receptionAutomationRefusal,
  parseReceptionAutomationIntent,
  extractReceptionJobWithAI,
  registerNewPatientWithFolderFee,
  parseSendAccountsIntent,
  sendPatientToAccounts,
  resolvePatientRef,
  type ReceptionRegJob,
};

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

/** Merge recent user lines so follow-ups keep context */
export function conversationContext(turns: ChatTurn[], maxUser = 6): string {
  const users = turns.filter((t) => t.role === 'user').slice(-maxUser);
  return users.map((t) => t.text).join(' · ');
}

export function lastUserText(turns: ChatTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') return turns[i].text;
  }
  return '';
}

/** Extract hospital number from free text */
export function extractHospitalNo(text: string): string | null {
  const m = text.match(/\b([A-Z]{2,5}-PT-[A-Z0-9]+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

export type FrontDeskAction =
  | { type: 'register'; job: ReceptionRegJob }
  | { type: 'send_accounts'; patientRef: string }
  | { type: 'send_accounts_need_patient' }
  | { type: 'check_in'; patientRef: string; department?: string; doctor?: string }
  | { type: 'queue_status'; patientRef?: string; status?: QueueStatus }
  | { type: 'assign_doctor'; patientRef: string; doctor: string }
  | { type: 'book_appointment'; patientRef: string; department?: string; doctor?: string; when?: string }
  | { type: 'lookup'; patientRef: string }
  | { type: 'queue_list' }
  | { type: 'registry_list' }
  | { type: 'registry_count' }
  | { type: 'confirm_pending' }
  | { type: 'none' };

/**
 * Resolve what front desk action the user wants, using this message + recent chat.
 */
export function resolveFrontDeskAction(
  query: string,
  opts: {
    recentTurns?: ChatTurn[];
    lastPatientRef?: string | null;
    pendingSendAccounts?: boolean;
    pendingReceptionJob?: ReceptionRegJob | null;
  }
): FrontDeskAction {
  const q = query.trim();
  const lower = q.toLowerCase();
  const ctx = conversationContext(opts.recentTurns || []);
  const combined = `${ctx} · ${q}`.trim();
  const lastPt = opts.lastPatientRef || extractHospitalNo(combined) || undefined;

  // Confirmations
  if (
    /^(do\s+it(\s+for\s+me)?|go\s+ahead|please\s+do|proceed|yes\s+please|run\s+it)[.!]?$/i.test(lower)
  ) {
    if (opts.pendingReceptionJob) return { type: 'register', job: opts.pendingReceptionJob };
    if (opts.pendingSendAccounts && lastPt) return { type: 'send_accounts', patientRef: lastPt };
    if (lastPt && /\b(account|cashier|invoice|folder|register)/i.test(ctx)) {
      return { type: 'send_accounts', patientRef: lastPt };
    }
    return { type: 'confirm_pending' };
  }

  // Bare hospital number
  if (/^[A-Z0-9][A-Z0-9-]{4,24}$/i.test(q) && /PT|IGH|HSP/i.test(q)) {
    const ref = q.toUpperCase();
    if (opts.pendingSendAccounts || /\b(send|account|cashier|invoice)/i.test(ctx)) {
      return { type: 'send_accounts', patientRef: ref };
    }
    if (/\b(check\s*in|queue|waiting)/i.test(ctx)) {
      return { type: 'check_in', patientRef: ref };
    }
    return { type: 'lookup', patientRef: ref };
  }

  // Facility registry — count / names / who is registered
  if (
    /\b(how\s+many\s+patients?|patient\s+count|number\s+of\s+patients?|count\s+(the\s+)?patients?)\b/i.test(
      lower
    )
  ) {
    return { type: 'registry_count' };
  }
  if (
    /\b(what\s+are\s+their\s+names|their\s+names|list\s+(the\s+)?patients?|who\s+(is|are)\s+(on\s+)?(the\s+)?registry|patients?\s+in\s+(our\s+)?registry|who\s+do\s+we\s+have|show\s+(me\s+)?(the\s+)?patients?|which\s+(of\s+the\s+)?patients?)\b/i.test(
      lower
    ) ||
    (/\b(who\s+is\s+it|who\s+are\s+they|name\s+them|list\s+them)\b/i.test(lower) &&
      /\b(patient|registry|registered|folder)\b/i.test(ctx + ' ' + lower))
  ) {
    return { type: 'registry_list' };
  }
  // Follow-up after count: "who is it" / "names"
  if (
    /\b(who\s+is\s+it|who\s+are\s+they|what\s+are\s+their\s+names|name\s+them|list\s+them|which\s+ones?)\b/i.test(
      lower
    ) &&
    /\b(patient|registry|how\s+many|registered)\b/i.test(ctx)
  ) {
    return { type: 'registry_list' };
  }

  // Queue list
  if (
    /\b(who\s+is\s+waiting|waiting\s+list|show\s+queue|opd\s+queue|list\s+queue|queue\s+now)\b/i.test(
      lower
    )
  ) {
    return { type: 'queue_list' };
  }

  // Send to accounts
  const send = parseSendAccountsIntent(q);
  if (send.handled) {
    if (send.patientRef) return { type: 'send_accounts', patientRef: send.patientRef };
    if (lastPt) return { type: 'send_accounts', patientRef: lastPt };
    return { type: 'send_accounts_need_patient' };
  }

  // Check-in
  if (/\b(check\s*-?in|checkin|put\s+on\s+queue|add\s+to\s+queue)\b/i.test(lower)) {
    const ref =
      extractHospitalNo(q) ||
      extractHospitalNo(combined) ||
      lastPt ||
      q.replace(/\b(check\s*-?in|checkin|put\s+on\s+queue|patient|for|please)\b/gi, '').trim();
    const dept = q.match(/\b(?:dept|department|clinic)\s*[:\-]?\s*([A-Za-z][A-Za-z\s/&-]{2,30})/i)?.[1];
    const doctor = q.match(/\b(?:dr\.?|doctor)\s+([A-Za-z][A-Za-z\s'.-]{1,40})/i)?.[1];
    if (ref && ref.length > 1) {
      return {
        type: 'check_in',
        patientRef: ref,
        department: dept?.trim(),
        doctor: doctor?.trim(),
      };
    }
    if (lastPt) {
      return { type: 'check_in', patientRef: lastPt, department: dept?.trim(), doctor: doctor?.trim() };
    }
  }

  // Assign doctor
  if (/\b(assign|send\s+to\s+dr|give\s+to\s+dr|route\s+to)\b/i.test(lower)) {
    const doctor = q.match(/\b(?:dr\.?|doctor)\s+([A-Za-z][A-Za-z\s'.-]{1,40})/i)?.[1];
    const ref = extractHospitalNo(q) || lastPt;
    if (doctor && ref) return { type: 'assign_doctor', patientRef: ref, doctor: doctor.trim() };
  }

  // Book appointment
  if (/\b(book|schedule|appointment)\b/i.test(lower)) {
    const ref = extractHospitalNo(q) || lastPt || undefined;
    const doctor = q.match(/\b(?:dr\.?|doctor)\s+([A-Za-z][A-Za-z\s'.-]{1,40})/i)?.[1];
    const dept = q.match(/\b(?:dept|department|clinic)\s*[:\-]?\s*([A-Za-z][A-Za-z\s/&-]{2,30})/i)?.[1];
    if (ref) {
      return {
        type: 'book_appointment',
        patientRef: ref,
        doctor: doctor?.trim(),
        department: dept?.trim(),
      };
    }
  }

  // Lookup
  if (/\b(find|search|lookup|look\s+up|who\s+is)\b/i.test(lower) && /\b(patient|folder|IGH-|PT-)\b/i.test(combined)) {
    const ref = extractHospitalNo(q) || q.replace(/\b(find|search|lookup|look\s+up|who\s+is|patient)\b/gi, '').trim();
    if (ref) return { type: 'lookup', patientRef: ref };
  }

  // Register
  const reg = parseReceptionAutomationIntent(q);
  if (reg.confirmOnly && opts.pendingReceptionJob) {
    return { type: 'register', job: opts.pendingReceptionJob };
  }
  if (reg.handled && reg.job) {
    return { type: 'register', job: reg.job };
  }
  // Soft register using combined context for name extraction
  if (reg.handled || /\b(register|enrol|enroll|new\s+patient|folder\s+fee)\b/i.test(lower)) {
    const fromCtx = parseReceptionAutomationIntent(combined);
    if (fromCtx.job) return { type: 'register', job: fromCtx.job };
    if (reg.job) return { type: 'register', job: reg.job };
  }

  return { type: 'none' };
}

export function lookupPatientSummary(facilityId: string, ref: string): string {
  const p = resolvePatientRef(facilityId, ref);
  if (!p) return `No patient matched **${ref}** on this facility.`;
  const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
  const openBills = listBillLines(facilityId, { patientId: p.id }).filter(
    (l) => l.status === 'unpaid' || l.status === 'partial'
  );
  const bal = openBills.reduce((s, l) => s + (Number(l.amountNgn) || 0), 0);
  const reqs = listAccountsRequests(facilityId, { patientId: p.id }).slice(0, 3);
  const visits = todayVisits(facilityId).filter((v) => v.patientId === p.id);
  const lines = [
    `**${name}** · ${p.hospitalNumber} · ${p.sex}`,
    bal > 0 ? `Open balance: ₦${bal.toLocaleString()} (${openBills.length} line(s))` : 'No open bill lines',
  ];
  if (reqs[0]) {
    lines.push(
      `Accounts: ${reqs[0].invoiceNumber} · ₦${reqs[0].amountNgn.toLocaleString()} · ${reqs[0].status.replace(/_/g, ' ')}`
    );
  }
  if (visits[0]) {
    lines.push(
      `Today: queue **${visits[0].queueNumber}** · ${visits[0].status.replace(/_/g, ' ')} · ${visits[0].department} · Dr ${visits[0].doctor}`
    );
  } else {
    lines.push('No visit on today’s queue yet.');
  }
  return lines.join('\n');
}

export function listWaitingQueueSummary(facilityId: string): string {
  const waiting = todayVisits(facilityId).filter(
    (v) => v.status === 'waiting' || v.status === 'called'
  );
  if (!waiting.length) return 'Nobody waiting on the OPD queue right now.';
  const top = waiting.slice(0, 12);
  return (
    `**Waiting / called** (${waiting.length}):\n` +
    top
      .map(
        (v) =>
          `• ${v.queueNumber} · ${v.patientName} · ${v.hospitalNumber} · ${v.department} · ${v.paymentStatus}`
      )
      .join('\n')
  );
}

export function checkInPatientByRef(input: {
  facilityId: string;
  patientRef: string;
  department?: string;
  doctor?: string;
  visitType?: VisitType;
}): { ok: boolean; visit?: ReceptionVisit; message: string } {
  const p = resolvePatientRef(input.facilityId, input.patientRef);
  if (!p) {
    return { ok: false, message: `Can't check in — no patient matched **${input.patientRef}**.` };
  }
  // Payment gate: if awaiting accounts, warn but allow walk-in note
  const awaiting = listAccountsRequests(input.facilityId, { patientId: p.id }).filter(
    (r) => r.status === 'awaiting_payment'
  );
  const unpaid = listBillLines(input.facilityId, { patientId: p.id }).filter(
    (l) => l.status === 'unpaid' || l.status === 'partial'
  );
  const paymentStatus =
    awaiting.length || unpaid.length ? ('pending' as const) : ('paid' as const);

  const visit = checkInPatient({
    patient: p,
    facilityId: input.facilityId,
    department: input.department || 'General OPD',
    doctor: input.doctor || 'Any available',
    visitType: input.visitType || 'walkin',
    paymentStatus,
    amount: awaiting[0]?.amountNgn,
  });

  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  let message =
    `Checked in **${name}** · Queue **${visit.queueNumber}** · ${visit.department}.\n` +
    `Payment: **${paymentStatus}**` +
    (awaiting[0] ? ` (invoice ${awaiting[0].invoiceNumber} still at Accounts)` : '') +
    `.`;

  try {
    pushNotification({
      facilityId: input.facilityId,
      level: 'info',
      title: 'Patient checked in',
      body: `${name} · ${visit.queueNumber} · ${visit.department}`,
      module: 'reception',
      patientId: p.id,
      visitId: visit.id,
    });
  } catch {
    /* ignore */
  }

  return { ok: true, visit, message };
}

export function assignDoctorByRef(input: {
  facilityId: string;
  patientRef: string;
  doctor: string;
}): { ok: boolean; message: string } {
  const p = resolvePatientRef(input.facilityId, input.patientRef);
  if (!p) return { ok: false, message: `No patient matched **${input.patientRef}**.` };
  const visit = todayVisits(input.facilityId).find(
    (v) => v.patientId === p.id && v.status !== 'completed' && v.status !== 'cancelled'
  );
  if (!visit) {
    return {
      ok: false,
      message: `${p.firstName} ${p.lastName} is not on today’s active queue. Check them in first.`,
    };
  }
  assignVisitDoctor(visit.id, input.doctor);
  try {
    pushNotification({
      facilityId: input.facilityId,
      level: 'important',
      title: `Patient assigned to you`,
      body: `${p.firstName} ${p.lastName} · ${visit.queueNumber} · ${visit.department}`,
      module: 'doctor-portal',
      roleHint: 'doctor',
      targetStaff: input.doctor,
      patientId: p.id,
      visitId: visit.id,
    });
  } catch {
    /* ignore */
  }
  return {
    ok: true,
    message: `Assigned **${p.firstName} ${p.lastName}** (${visit.queueNumber}) to **${input.doctor}**.`,
  };
}

export function bookAppointmentByRef(input: {
  facilityId: string;
  patientRef: string;
  department?: string;
  doctor?: string;
  whenIso?: string;
}): { ok: boolean; message: string } {
  const p = resolvePatientRef(input.facilityId, input.patientRef);
  if (!p) return { ok: false, message: `No patient matched **${input.patientRef}**.` };
  const when = input.whenIso || new Date(Date.now() + 86400000).toISOString();
  const appt = bookAppointment({
    patientId: p.id,
    hospitalNumber: p.hospitalNumber,
    patientName: [p.firstName, p.lastName].filter(Boolean).join(' '),
    facilityId: input.facilityId,
    department: input.department || 'General OPD',
    doctor: input.doctor || 'Any available',
    scheduledAt: when,
    reason: 'Booked via Celestia',
  });
  return {
    ok: true,
    message:
      `Appointment booked for **${appt.patientName}**.\n` +
      `• ${appt.department} · ${appt.doctor}\n` +
      `• ${new Date(appt.scheduledAt).toLocaleString()}`,
  };
}

export function registryCountSummary(facilityId: string): string {
  const n = countPatients(facilityId);
  if (n === 0) return 'Registry is empty — no patients enrolled on this facility yet.';
  if (n === 1) return '**1 patient** on the facility registry. Want the name, or register someone new?';
  return `**${n} patients** on the facility registry. Ask for **names** or a hospital number to open one.`;
}

export function registryListSummary(facilityId: string, limit = 25): string {
  const all = listPatients(facilityId);
  const n = all.length;
  if (n === 0) return 'Registry is empty — no patients on this facility yet.';
  // Newest first if registeredAt present
  const sorted = [...all].sort((a, b) =>
    String(b.registeredAt || '').localeCompare(String(a.registeredAt || ''))
  );
  const top = sorted.slice(0, limit);
  const lines = top.map((p, i) => {
    const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
    return `• ${name} · **${p.hospitalNumber}** · ${p.sex}${p.phone ? ` · ${p.phone}` : ''}`;
  });
  const more = n > limit ? `\n…and **${n - limit}** more (search by name or hospital no.).` : '';
  return `**${n} patient${n === 1 ? '' : 's'}** on the registry:\n${lines.join('\n')}${more}`;
}
