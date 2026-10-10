/**
 * ANC scheduling (GA-based), NPI immunization schedule, multi-language SMS.
 */

export type SmsLang = 'en' | 'pidgin' | 'ibibio' | 'annang' | 'oron';

export interface AncVisitSlot {
  week: number;
  label: string;
  dueDate: string; // ISO date
}

export interface AncPlan {
  patientId: string;
  facilityId: string;
  patientName: string;
  lmp?: string;
  edd: string;
  gaWeeksAtReg: number;
  visits: AncVisitSlot[];
  createdAt: string;
}

/** WHO/Nigeria-style ANC contact weeks (simplified) */
const ANC_CONTACT_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];

export function computeEddFromLmp(lmpIso: string): string {
  const d = new Date(lmpIso);
  d.setDate(d.getDate() + 280);
  return d.toISOString().slice(0, 10);
}

export function gaWeeksFromLmp(lmpIso: string, on = new Date()): number {
  const lmp = new Date(lmpIso).getTime();
  const days = Math.floor((on.getTime() - lmp) / 864e5);
  return Math.max(0, Math.floor(days / 7));
}

export function buildAncPlan(input: {
  facilityId: string;
  patientId: string;
  patientName: string;
  lmp: string;
  gaWeeks?: number;
}): AncPlan {
  const edd = computeEddFromLmp(input.lmp);
  const ga = input.gaWeeks ?? gaWeeksFromLmp(input.lmp);
  const lmp = new Date(input.lmp);
  const visits: AncVisitSlot[] = ANC_CONTACT_WEEKS.filter((w) => w >= ga).map((week) => {
    const due = new Date(lmp);
    due.setDate(due.getDate() + week * 7);
    return {
      week,
      label: week >= 40 ? 'Term / delivery readiness' : `ANC contact ~${week} weeks`,
      dueDate: due.toISOString().slice(0, 10),
    };
  });
  const plan: AncPlan = {
    patientId: input.patientId,
    facilityId: input.facilityId,
    patientName: input.patientName,
    lmp: input.lmp,
    edd,
    gaWeeksAtReg: ga,
    visits,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    const key = 'medcore_anc_plans_v1';
    try {
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      const next = [plan, ...prev.filter((p: AncPlan) => p.patientId !== plan.patientId)].slice(0, 5000);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return plan;
}

/** National Programme on Immunization (simplified childhood schedule) */
export const NPI_SCHEDULE: { code: string; name: string; dueAgeWeeks: number; notes?: string }[] = [
  { code: 'BCG', name: 'BCG', dueAgeWeeks: 0, notes: 'At birth' },
  { code: 'OPV0', name: 'OPV (birth)', dueAgeWeeks: 0 },
  { code: 'HEP_B0', name: 'Hepatitis B (birth)', dueAgeWeeks: 0 },
  { code: 'PENTA1', name: 'Penta 1', dueAgeWeeks: 6 },
  { code: 'OPV1', name: 'OPV 1', dueAgeWeeks: 6 },
  { code: 'PCV1', name: 'PCV 1', dueAgeWeeks: 6 },
  { code: 'PENTA2', name: 'Penta 2', dueAgeWeeks: 10 },
  { code: 'OPV2', name: 'OPV 2', dueAgeWeeks: 10 },
  { code: 'PCV2', name: 'PCV 2', dueAgeWeeks: 10 },
  { code: 'PENTA3', name: 'Penta 3', dueAgeWeeks: 14 },
  { code: 'OPV3', name: 'OPV 3', dueAgeWeeks: 14 },
  { code: 'PCV3', name: 'PCV 3', dueAgeWeeks: 14 },
  { code: 'IPV', name: 'IPV', dueAgeWeeks: 14 },
  { code: 'VIT_A', name: 'Vitamin A', dueAgeWeeks: 26 },
  { code: 'MEASLES1', name: 'Measles 1', dueAgeWeeks: 39 },
  { code: 'YELLOW', name: 'Yellow fever', dueAgeWeeks: 39 },
  { code: 'MEASLES2', name: 'Measles 2', dueAgeWeeks: 65 },
];

export interface ImmunizationDose {
  code: string;
  name: string;
  dueDate: string;
  givenAt?: string;
  status: 'due' | 'given' | 'overdue' | 'upcoming';
}

export function buildNpiSchedule(dob: string, givenCodes: string[] = []): ImmunizationDose[] {
  const birth = new Date(dob);
  const today = new Date();
  return NPI_SCHEDULE.map((d) => {
    const due = new Date(birth);
    due.setDate(due.getDate() + d.dueAgeWeeks * 7);
    const dueDate = due.toISOString().slice(0, 10);
    const given = givenCodes.includes(d.code);
    let status: ImmunizationDose['status'] = 'upcoming';
    if (given) status = 'given';
    else if (due < today) status = due.getTime() < today.getTime() - 14 * 864e5 ? 'overdue' : 'due';
    return { code: d.code, name: d.name, dueDate, status, givenAt: given ? today.toISOString() : undefined };
  });
}

export function markNpiGiven(patientId: string, code: string) {
  if (typeof window === 'undefined') return;
  const key = `medcore_npi_given_${patientId}`;
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!prev.includes(code)) {
      localStorage.setItem(key, JSON.stringify([...prev, code]));
    }
  } catch {
    localStorage.setItem(key, JSON.stringify([code]));
  }
}

export function getNpiGiven(patientId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(`medcore_npi_given_${patientId}`) || '[]');
  } catch {
    return [];
  }
}

function smsBody(lang: SmsLang, kind: 'anc' | 'imm', name: string, when: string, facility: string): string {
  const n = name.split(' ')[0] || 'Patient';
  if (kind === 'anc') {
    switch (lang) {
      case 'pidgin':
        return `MedCore: ${n}, remember your ANC for ${when} for ${facility}. Abeg no miss am.`;
      case 'ibibio':
        return `MedCore: ${n}, ANC mfo ke ${when} (${facility}). Di ke ini.`;
      case 'annang':
        return `MedCore: ${n}, ANC mfo ${when} — ${facility}.`;
      case 'oron':
        return `MedCore: ${n}, ANC appointment ${when} at ${facility}.`;
      default:
        return `MedCore: ${n}, your ANC visit is due on ${when} at ${facility}. Please attend.`;
    }
  }
  switch (lang) {
    case 'pidgin':
      return `MedCore: ${n}, immunization dey ${when} for ${facility}. Bring the card.`;
    case 'ibibio':
      return `MedCore: ${n}, injection/immunization ke ${when} (${facility}).`;
    case 'annang':
      return `MedCore: ${n}, immunization ${when} — ${facility}.`;
    case 'oron':
      return `MedCore: ${n}, immunization on ${when} at ${facility}.`;
    default:
      return `MedCore: ${n}, immunization due on ${when} at ${facility}. Bring the child health card.`;
  }
}

export async function sendReminderSms(input: {
  phone: string;
  lang: SmsLang;
  kind: 'anc' | 'imm';
  patientName: string;
  when: string;
  facilityName: string;
}): Promise<{ ok: boolean; mode: 'live' | 'queued'; message: string; body: string }> {
  const body = smsBody(input.lang, input.kind, input.patientName, input.when, input.facilityName);
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: input.phone, body, lang: input.lang }),
    });
    if (res.ok) {
      const json = await res.json();
      return { ok: true, mode: json.mode || 'live', message: json.message || 'SMS sent', body };
    }
  } catch {
    /* queue local */
  }
  if (typeof window !== 'undefined') {
    try {
      const key = 'medcore_sms_outbox_v1';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift({ ...input, body, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 2000)));
    } catch {
      /* ignore */
    }
  }
  return {
    ok: true,
    mode: 'queued',
    message: 'SMS queued offline — set SMS_API_URL / SMS_API_KEY on server for live gateway',
    body,
  };
}
