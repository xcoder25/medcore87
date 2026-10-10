/**
 * Celestia Front Desk automation — register new patients + folder fee → Accounts.
 */
import {
  upsertPatient,
  generateHospitalNumber,
  type FacilityPatient,
  type PatientSex,
} from './patientRegistryStore';
import {
  sendPaymentRequestToAccounts,
  DEFAULT_REGISTRATION_FEE_NGN,
} from './frontDeskAccountsBridge';
import { pushNotification } from './notificationEngine';
import { getAdminSettings } from './adminSettingsStore';
import { isPrivilegedAdmin } from './celestiaRoleGuard';

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
};

export function canAutomateReception(roleKey: string): boolean {
  const rk = String(roleKey || '').toLowerCase();
  return (
    rk === 'reception' ||
    rk === 'records' ||
    isPrivilegedAdmin(rk)
  );
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
  if (/\b(female|woman|girl|f)\b/.test(t)) return 'Female';
  if (/\b(male|man|boy|m)\b/.test(t)) return 'Male';
  return 'Male';
}

function splitName(raw: string): { firstName: string; lastName: string; middleName?: string } {
  const parts = raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
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

/** Detect register / new patient / folder fee intents */
export function parseReceptionAutomationIntent(query: string): ParseReceptionResult {
  const q = query.trim();
  const lower = q.toLowerCase();

  // Follow-up confirms
  if (
    /^(do\s+it(\s+for\s+me)?|go\s+ahead|please\s+do|yes\s+do\s+it|proceed|run\s+it|automate(\s+it)?)\b/i.test(
      lower
    ) ||
    /^(do\s+it(\s+for\s+me)?[.!]?)$/i.test(lower)
  ) {
    return { handled: true, confirmOnly: true };
  }

  const isReg =
    /\b(register|enrol|enroll|open\s+(a\s+)?folder|new\s+patient|create\s+(a\s+)?patient|add\s+(a\s+)?patient)\b/i.test(
      lower
    ) ||
    (/\b(folder\s+fee|paying\s+for\s+folder|pay\s+(for\s+)?folder)\b/i.test(lower) &&
      /\b(name|patient|him|her|male|female)\b/i.test(lower));

  if (!isReg) return { handled: false };

  // name: Michael James | name Michael James | register Michael James
  let nameRaw = '';
  const nameColon = q.match(/\bname\s*[:\-]?\s*([A-Za-z][A-Za-z\s'.-]{1,60}?)(?=,|\.|$|\bmale\b|\bfemale\b|\bpay|\bfolder|\bhe\b|\bshe\b|\bnew\b)/i);
  const registerName = q.match(
    /\b(?:register|enrol|enroll|add)\s+(?:one\s+)?(?:for\s+me\s*,?\s*)?(?:name\s+)?([A-Za-z][A-Za-z\s'.-]{1,60}?)(?=,|\.|$|\bmale\b|\bfemale\b|\bpay|\bfolder|\bhe\b|\bshe\b|\bnew\b|\bwho\b)/i
  );
  if (nameColon?.[1]) nameRaw = nameColon[1].trim();
  else if (registerName?.[1]) nameRaw = registerName[1].trim();
  // "register one for me, name Michael James"
  if (!nameRaw) {
    const m = q.match(/\b(?:patient\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
    if (m) nameRaw = m[1].trim();
  }

  if (!nameRaw || nameRaw.length < 2) {
    return {
      handled: true,
      replyIfEmpty:
        'Tell me the patient name and sex, e.g. **register Michael James, male, folder fee first**.',
    };
  }

  // Strip trailing junk words
  nameRaw = nameRaw
    .replace(/\b(male|female|man|woman|new|patient|folder|fee|paying|pay)\b/gi, '')
    .replace(/[,.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const { firstName, lastName, middleName } = splitName(nameRaw);
  const sex = parseSex(q);
  const folderFeeFirst =
    /\b(folder|registration\s+fee|new\s+(to\s+)?(the\s+)?hospital|not\s+in\s+(our|the)\s+hospital|paying\s+for\s+folder|pay\s+(for\s+)?folder|folder\s+first)\b/i.test(
      lower
    ) || true; // default: new folder always bills registration

  const phoneMatch = q.match(/\b(?:phone|mobile|tel)[:\s]*([0-9+]{8,15})\b/i);
  const amountMatch = q.match(/\b(?:₦|ngn|naira)?\s*([0-9]{3,7})\s*(?:naira|ngn)?\b/i);

  return {
    handled: true,
    job: {
      firstName,
      lastName,
      middleName,
      sex,
      phone: phoneMatch?.[1],
      folderFeeFirst,
      amountNgn: amountMatch ? Number(amountMatch[1]) : undefined,
    },
  };
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
