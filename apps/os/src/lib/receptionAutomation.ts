/**
 * Celestia Front Desk automation — natural-language register + folder fee → Accounts.
 */
import {
  upsertPatient,
  generateHospitalNumber,
  getPatientByHospitalNumber,
  searchPatients,
  getPatient,
  type FacilityPatient,
  type PatientSex,
} from './patientRegistryStore';
import { listBillLines } from './patientBillingStore';
import {
  sendPaymentRequestToAccounts,
  listAccountsRequests,
  DEFAULT_REGISTRATION_FEE_NGN,
} from './frontDeskAccountsBridge';
import { pushNotification } from './notificationEngine';
import { getAdminSettings } from './adminSettingsStore';
import { isPrivilegedAdmin } from './celestiaRoleGuard';
import { geminiGenerate } from './geminiClient';

export type ReceptionRegJob = {
  firstName: string;
  lastName: string;
  middleName?: string;
  sex: PatientSex;
  phone?: string;
  /** New folder — pay registration fee first */
  folderFeeFirst: boolean;
  amountNgn?: number;
};

export type ParseReceptionResult = {
  handled: boolean;
  job?: ReceptionRegJob;
  replyIfEmpty?: string;
  /** User said "do it" without details — continue pending */
  confirmOnly?: boolean;
  /** Soft intent — try AI extract if no job yet */
  softIntent?: boolean;
};

export function canAutomateReception(roleKey: string): boolean {
  const rk = String(roleKey || '').toLowerCase();
  return rk === 'reception' || rk === 'records' || isPrivilegedAdmin(rk);
}

export function receptionAutomationRefusal(roleKey: string): string {
  return (
    `Patient registration is a **Front Desk / Records** task.\n\n` +
    `You're on **${roleKey || 'this desk'}**, so I can't open a new folder from here. ` +
    `Hand the patient to Reception, or switch to a front-desk login.`
  );
}

function parseSex(text: string): PatientSex {
  const t = text.toLowerCase();
  if (/\b(female|woman|girl|\bf\b|she|her)\b/.test(t)) return 'Female';
  if (/\b(male|man|boy|\bm\b|he|him|his)\b/.test(t)) return 'Male';
  return 'Male';
}

function titleCaseWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function splitName(raw: string): { firstName: string; lastName: string; middleName?: string } {
  const parts = raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(titleCaseWord)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Patient' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Patient' };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

const STOP_NAME =
  /\b(male|female|man|woman|boy|girl|new|patient|folder|fee|paying|pay|first|because|he|she|him|her|is|not|in|our|the|hospital|please|register|enrol|enroll|add|create|open|one|for|me|name|called|named|a|an|the|with|who|wants|need|needs)\b/gi;

function cleanName(raw: string): string {
  return raw
    .replace(STOP_NAME, ' ')
    .replace(/[,.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePersonName(s: string): boolean {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every((p) => /^[A-Za-z][A-Za-z'.-]{0,30}$/.test(p));
}

/** Broad natural-language detection of front-desk registration intent */
export function hasRegistrationIntent(query: string): boolean {
  const lower = query.toLowerCase();
  if (
    /\b(register|enrol|enroll|registration)\b/.test(lower) &&
    /\b(patient|him|her|name|folder|male|female|man|woman|called|named)\b/.test(lower)
  ) {
    return true;
  }
  if (/\b(new\s+patient|open\s+(a\s+)?folder|create\s+(a\s+)?folder|add\s+(a\s+)?patient)\b/.test(lower)) {
    return true;
  }
  if (
    /\b(folder\s+fee|pay(ing)?\s+for\s+(the\s+)?folder|registration\s+fee)\b/.test(lower) &&
    /\b(name|patient|male|female|called|named|[A-Z][a-z]+\s+[A-Z][a-z]+)\b/.test(query)
  ) {
    return true;
  }
  // "patient is new / not in our hospital" + a name somewhere
  if (
    /\b(not\s+in\s+(our|the)\s+hospital|new\s+to\s+(the\s+)?hospital|first\s+time|never\s+been\s+here)\b/.test(
      lower
    ) &&
    /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(query)
  ) {
    return true;
  }
  return false;
}

function extractNameFromQuery(q: string): string {
  const patterns: RegExp[] = [
    // name: Michael James / name is Michael James / named Michael James / called Michael James
    /\b(?:name(?:\s+is)?|named|called)\s*[:\-]?\s*([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+){0,3})/i,
    // register/enrol ... Michael James
    /\b(?:register|enrol|enroll|add|create)\s+(?:one\s+)?(?:for\s+me\s*,?\s*)?(?:a\s+)?(?:new\s+)?(?:patient\s+)?(?:name\s+)?([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+){0,3})/i,
    // patient Michael James
    /\bpatient\s+([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+){0,3})/i,
    // "for Michael James"
    /\bfor\s+([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z][A-Za-z'.\-]+){1,3})(?:\s*,|\s+male|\s+female|\s+who|\s+he|\s+she|\s*$)/i,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m?.[1]) {
      const cleaned = cleanName(m[1]);
      if (cleaned && looksLikePersonName(cleaned)) return cleaned;
    }
  }
  // Capitalized Full Name anywhere (Michael James)
  const caps = q.match(/\b([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,3})\b/g);
  if (caps) {
    for (const c of caps) {
      const cleaned = cleanName(c);
      if (cleaned && looksLikePersonName(cleaned) && cleaned.split(' ').length >= 2) return cleaned;
    }
  }
  return '';
}

/** Fast local parse — natural commands, not rigid templates */
export function parseReceptionAutomationIntent(query: string): ParseReceptionResult {
  const q = query.trim();
  const lower = q.toLowerCase();

  // Follow-up confirms
  if (
    /^(do\s+it(\s+for\s+me)?|go\s+ahead|please\s+do(\s+it)?|yes\s+do\s+it|proceed|run\s+it|automate(\s+it)?|yes\s+please|make\s+it\s+so)[.!]?$/i.test(
      lower
    ) ||
    /^(do\s+it(\s+for\s+me)?[.!]?)$/i.test(lower)
  ) {
    return { handled: true, confirmOnly: true };
  }

  const soft = hasRegistrationIntent(q);
  if (!soft && !/\b(register|enrol|enroll|folder|new\s+patient)\b/i.test(lower)) {
    return { handled: false };
  }

  const nameRaw = extractNameFromQuery(q);
  if (!nameRaw) {
    if (soft) {
      return {
        handled: true,
        softIntent: true,
        replyIfEmpty:
          'Who should I register? Give me the name and sex, e.g. *Michael James, male, new folder*.',
      };
    }
    return { handled: false };
  }

  const { firstName, lastName, middleName } = splitName(nameRaw);
  const sex = parseSex(q);
  const folderFeeFirst =
    /\b(folder|registration\s+fee|new\s+(to\s+)?(the\s+)?hospital|not\s+in\s+(our|the)\s+hospital|paying\s+for\s+folder|pay\s+(for\s+)?folder|folder\s+first|first\s+time|never\s+been)\b/i.test(
      lower
    ) || soft; // new registration defaults to folder fee

  const phoneMatch = q.match(/\b(?:phone|mobile|tel|number)[:\s]*([0-9+]{8,15})\b/i);
  const amountMatch = q.match(/(?:₦|ngn|naira)?\s*([0-9]{3,7})\s*(?:naira|ngn|₦)?/i);

  return {
    handled: true,
    job: {
      firstName,
      lastName,
      middleName,
      sex,
      phone: phoneMatch?.[1],
      folderFeeFirst: Boolean(folderFeeFirst),
      amountNgn: amountMatch ? Number(amountMatch[1]) : undefined,
    },
  };
}

/**
 * When local parse is weak, ask Gemini for a structured job JSON.
 * Returns null if model unavailable or invalid.
 */
export async function extractReceptionJobWithAI(
  query: string,
  facilityId?: string
): Promise<ReceptionRegJob | null> {
  if (!hasRegistrationIntent(query) && !/\b(register|patient|folder)\b/i.test(query)) {
    return null;
  }
  try {
    const res = await geminiGenerate(
      query,
      [
        'Extract hospital front-desk patient registration details from the user message.',
        'Reply with ONLY compact JSON, no markdown:',
        '{"firstName":"","lastName":"","middleName":"","sex":"Male|Female","phone":"","folderFeeFirst":true,"amountNgn":null}',
        'Rules: sex Male/Female only; folderFeeFirst true if new patient / folder / registration fee; omit unknown fields as empty string or null.',
        'If this is not a registration request, reply: {"skip":true}',
      ].join(' '),
      undefined,
      facilityId
    );
    if (!res.ok || !res.text) return null;
    const raw = res.text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (data.skip) return null;
    const firstName = String(data.firstName || '').trim();
    const lastName = String(data.lastName || '').trim() || 'Patient';
    if (!firstName || firstName.length < 2) return null;
    const sexRaw = String(data.sex || 'Male');
    const sex: PatientSex = /female/i.test(sexRaw) ? 'Female' : 'Male';
    return {
      firstName: titleCaseWord(firstName),
      lastName: titleCaseWord(lastName),
      middleName: data.middleName ? titleCaseWord(String(data.middleName)) : undefined,
      sex,
      phone: data.phone ? String(data.phone) : undefined,
      folderFeeFirst: data.folderFeeFirst !== false,
      amountNgn:
        typeof data.amountNgn === 'number' && data.amountNgn > 0 ? data.amountNgn : undefined,
    };
  } catch {
    return null;
  }
}

export type RegisterPatientResult = {
  ok: boolean;
  patient?: FacilityPatient;
  hospitalNumber?: string;
  invoiceNumber?: string;
  amountNgn?: number;
  error?: string;
};

export function registerNewPatientWithFolderFee(input: {
  job: ReceptionRegJob;
  facilityId: string;
  facilityName: string;
  actorName?: string;
  actorBadge?: string;
}): RegisterPatientResult {
  try {
    const { job, facilityId, facilityName } = input;
    const settings = (() => {
      try {
        return getAdminSettings(facilityId);
      } catch {
        return null;
      }
    })();
    const fee =
      job.amountNgn && job.amountNgn > 0
        ? job.amountNgn
        : settings?.defaultOpdFeeNgn && settings.defaultOpdFeeNgn > 0
          ? settings.defaultOpdFeeNgn
          : DEFAULT_REGISTRATION_FEE_NGN;

    const hospitalNumber = generateHospitalNumber(facilityId);
    const id = `PT-${Date.now().toString(36).toUpperCase()}`;
    const patient: FacilityPatient = {
      id,
      hospitalNumber,
      firstName: job.firstName,
      middleName: job.middleName,
      lastName: job.lastName,
      dob: '',
      sex: job.sex,
      phone: job.phone || '',
      facilityId,
      facilityName,
      status: 'active',
      registeredAt: new Date().toISOString(),
      category: 'Private',
    };
    upsertPatient(patient);

    const fullName = [patient.firstName, patient.middleName, patient.lastName]
      .filter(Boolean)
      .join(' ');

    let invoiceNumber: string | undefined;
    if (job.folderFeeFirst) {
      const req = sendPaymentRequestToAccounts({
        facilityId,
        facilityName,
        patientId: patient.id,
        hospitalNumber: patient.hospitalNumber,
        patientName: fullName,
        amountNgn: fee,
        purpose: 'New folder · Registration fee',
        source: 'registration',
        sentBy: input.actorName || 'Celestia / Front Desk',
        sentByBadge: input.actorBadge,
        note: 'Patient to pay at Accounts, then return to front desk with receipt',
      });
      invoiceNumber = req.invoiceNumber;
      try {
        pushNotification({
          facilityId,
          level: 'important',
          title: 'Registration fee — pay at Accounts',
          body: `${fullName} · ₦${fee.toLocaleString()} · ${req.invoiceNumber} · New folder`,
          module: 'cashier',
          roleHint: 'accountant',
        });
      } catch {
        /* ignore */
      }
    }

    return {
      ok: true,
      patient,
      hospitalNumber,
      invoiceNumber,
      amountNgn: fee,
    };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Registration failed' };
  }
}

/** Resolve patient by hospital number, id, or name */
export function resolvePatientRef(
  facilityId: string,
  ref: string
): FacilityPatient | undefined {
  const r = (ref || '').trim();
  if (!r) return undefined;
  const byHn = getPatientByHospitalNumber(facilityId, r);
  if (byHn) return byHn;
  const byId = getPatient(r);
  if (byId && byId.facilityId === facilityId) return byId;
  const hits = searchPatients(facilityId, r, 5);
  if (hits.length === 1) return hits[0];
  // Exact full name match preferred
  const lower = r.toLowerCase();
  const exact = hits.find(
    (p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase() === lower ||
      `${p.firstName} ${p.middleName || ''} ${p.lastName}`.replace(/\s+/g, ' ').trim().toLowerCase() ===
        lower
  );
  return exact || hits[0];
}

export type SendAccountsResult = {
  ok: boolean;
  alreadySent?: boolean;
  invoiceNumber?: string;
  amountNgn?: number;
  patientName?: string;
  hospitalNumber?: string;
  message: string;
  error?: string;
};

/** Send or re-confirm folder/registration fee to Accounts for a known patient */
export function sendPatientToAccounts(input: {
  facilityId: string;
  facilityName: string;
  patientRef: string;
  actorName?: string;
  actorBadge?: string;
  amountNgn?: number;
  purpose?: string;
}): SendAccountsResult {
  const patient = resolvePatientRef(input.facilityId, input.patientRef);
  if (!patient) {
    return {
      ok: false,
      error: 'not_found',
      message: `I couldn't find patient **${input.patientRef}** on this facility registry.`,
    };
  }
  const fullName = [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(' ');

  // Already awaiting payment at Accounts?
  const awaiting = listAccountsRequests(input.facilityId, { patientId: patient.id }).filter(
    (r) => r.status === 'awaiting_payment'
  );
  if (awaiting.length > 0) {
    const top = awaiting[0];
    return {
      ok: true,
      alreadySent: true,
      invoiceNumber: top.invoiceNumber,
      amountNgn: top.amountNgn,
      patientName: fullName,
      hospitalNumber: patient.hospitalNumber,
      message:
        `**${fullName}** (${patient.hospitalNumber}) is already at Accounts.\n\n` +
        `• Invoice **${top.invoiceNumber}** · ₦${top.amountNgn.toLocaleString()} · ${top.status.replace(/_/g, ' ')}\n` +
        `• Purpose: ${top.purpose}\n\n` +
        `Cashier can collect; after PAID, continue check-in here.`,
    };
  }

  const unpaid = listBillLines(input.facilityId, { patientId: patient.id }).filter(
    (l) => l.status === 'unpaid' || l.status === 'partial'
  );
  const balance = unpaid.reduce((s, l) => s + (Number(l.amountNgn) || 0), 0);
  const settings = (() => {
    try {
      return getAdminSettings(input.facilityId);
    } catch {
      return null;
    }
  })();
  const fee =
    input.amountNgn && input.amountNgn > 0
      ? input.amountNgn
      : balance > 0
        ? balance
        : settings?.defaultOpdFeeNgn && settings.defaultOpdFeeNgn > 0
          ? settings.defaultOpdFeeNgn
          : DEFAULT_REGISTRATION_FEE_NGN;

  const purpose =
    input.purpose ||
    (balance > 0 ? unpaid[0]?.description || 'Hospital charges' : 'New folder · Registration fee');

  const req = sendPaymentRequestToAccounts({
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    patientId: patient.id,
    hospitalNumber: patient.hospitalNumber,
    patientName: fullName,
    amountNgn: fee,
    purpose,
    source: 'registration',
    sentBy: input.actorName || 'Celestia / Front Desk',
    sentByBadge: input.actorBadge,
    note: 'Sent from Celestia front-desk chat',
  });
  try {
    pushNotification({
      facilityId: input.facilityId,
      level: 'important',
      title: 'Payment request — Accounts',
      body: `${fullName} · ₦${fee.toLocaleString()} · ${req.invoiceNumber}`,
      module: 'cashier',
      roleHint: 'accountant',
    });
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    alreadySent: false,
    invoiceNumber: req.invoiceNumber,
    amountNgn: fee,
    patientName: fullName,
    hospitalNumber: patient.hospitalNumber,
    message:
      `Sent **${fullName}** (${patient.hospitalNumber}) to Accounts.\n\n` +
      `• Invoice **${req.invoiceNumber}** · ₦${fee.toLocaleString()} · PENDING\n` +
      `• ${purpose}\n\n` +
      `Patient pays at Cashier, then returns for check-in.`,
  };
}

export type ParseSendAccountsResult = {
  handled: boolean;
  patientRef?: string;
  /** User asked to send but didn't name who — use last patient */
  needsPatient?: boolean;
  confirmOnly?: boolean;
};

export function parseSendAccountsIntent(query: string): ParseSendAccountsResult {
  const q = query.trim();
  const lower = q.toLowerCase();

  // Bare hospital number / patient id as follow-up
  if (/^[A-Z0-9][A-Z0-9-]{4,24}$/i.test(q) && /PT|IGH|HSP|FD|INV/i.test(q)) {
    return { handled: true, patientRef: q.toUpperCase() };
  }

  const sendLike =
    /\b(send|route|forward|push|hand\s*off|handoff)\b/i.test(lower) &&
    /\b(account|accounts|cashier|billing|invoice|payment|pos)\b/i.test(lower);
  const toAccounts =
    /\b(to\s+accounts?|to\s+cashier|to\s+billing|send\s+invoice|bill\s+to\s+accounts?)\b/i.test(
      lower
    );

  if (!sendLike && !toAccounts) {
    // "accounts for IGH-PT-xxx" / "invoice IGH-PT-xxx"
    if (/\b(accounts?|cashier|invoice)\b/i.test(lower) && /\b[A-Z0-9-]{6,}\b/i.test(q)) {
      const ref = q.match(/\b([A-Z]{2,5}-PT-[A-Z0-9]+|[A-Z]{2,5}-[A-Z0-9-]{4,})\b/i);
      if (ref) return { handled: true, patientRef: ref[1].toUpperCase() };
    }
    return { handled: false };
  }

  const refMatch =
    q.match(/\b([A-Z]{2,5}-PT-[A-Z0-9]+)\b/i) ||
    q.match(/\b(?:patient|folder|id|no|number)\s*[:#]?\s*([A-Z0-9-]{5,})\b/i) ||
    q.match(/\bfor\s+([A-Za-z][A-Za-z\s'.-]{1,40}?)(?:\s*$|,)/i);

  if (refMatch?.[1]) {
    return { handled: true, patientRef: refMatch[1].trim() };
  }

  return { handled: true, needsPatient: true };
}
