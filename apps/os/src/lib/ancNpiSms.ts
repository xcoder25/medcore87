/**
 * ANC scheduling (GA-based), NPI immunization, multi-language SMS,
 * facility cloud sync, due-list runner, patient SMS preferences.
 */
import { publishFacilityData } from './roleSyncBus';

export type SmsLang = 'en' | 'pidgin' | 'ibibio' | 'annang' | 'oron';

export interface AncVisitSlot {
  week: number;
  label: string;
  dueDate: string;
}

export interface AncPlan {
  patientId: string;
  facilityId: string;
  patientName: string;
  phone?: string;
  lmp?: string;
  edd: string;
  gaWeeksAtReg: number;
  visits: AncVisitSlot[];
  smsOptIn?: boolean;
  smsLang?: SmsLang;
  lastSmsAt?: string;
  lastSmsVisitWeek?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AncSmsPref {
  patientId: string;
  facilityId: string;
  phone?: string;
  smsOptIn: boolean;
  smsLang: SmsLang;
  updatedAt: string;
}

export interface AncDueItem {
  plan: AncPlan;
  visit: AncVisitSlot;
  daysUntil: number;
  overdue: boolean;
}

const ANC_KEY = 'medcore_anc_plans_v1';
const PREF_KEY = 'medcore_anc_sms_prefs_v1';
const OUTBOX_KEY = 'medcore_anc_sms_outbox_v1';
const EVT = 'medcore-anc-plans';

const ANC_CONTACT_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];

function readPlans(): AncPlan[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ANC_KEY) || '[]');
  } catch {
    return [];
  }
}

function writePlans(list: AncPlan[], facilityId?: string) {
  if (typeof window === 'undefined') return;
  const next = list.slice(0, 5000);
  localStorage.setItem(ANC_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: ANC_KEY } }));
  const fid = facilityId || next.find((p) => p.facilityId)?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(String(fid), ANC_KEY, next.filter((p) => p.facilityId === fid));
  } catch {
    /* offline */
  }
}

function readPrefs(): AncSmsPref[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '[]');
  } catch {
    return [];
  }
}

function writePrefs(list: AncSmsPref[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREF_KEY, JSON.stringify(list.slice(0, 5000)));
  window.dispatchEvent(new CustomEvent(EVT));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(String(fid), PREF_KEY, list.filter((p) => p.facilityId === fid));
  } catch {
    /* offline */
  }
}

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

export function listAncPlans(facilityId?: string): AncPlan[] {
  let rows = readPlans();
  if (facilityId) rows = rows.filter((p) => p.facilityId === facilityId);
  return rows.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export function getAncPlanForPatient(patientId: string, facilityId?: string): AncPlan | null {
  const rows = readPlans().filter((p) => p.patientId === patientId);
  if (facilityId) {
    const hit = rows.find((p) => p.facilityId === facilityId);
    if (hit) return hit;
  }
  return rows[0] || null;
}

export function getAncPlanByPhone(phone: string, facilityId?: string): AncPlan | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const rows = listAncPlans(facilityId);
  return (
    rows.find((p) => {
      const pd = String(p.phone || '').replace(/\D/g, '');
      return pd && (pd.endsWith(digits.slice(-10)) || digits.endsWith(pd.slice(-10)));
    }) || null
  );
}

export function buildAncPlan(input: {
  facilityId: string;
  patientId: string;
  patientName: string;
  lmp: string;
  gaWeeks?: number;
  phone?: string;
  smsOptIn?: boolean;
  smsLang?: SmsLang;
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
  const now = new Date().toISOString();
  const prev = readPlans().find((p) => p.patientId === input.patientId && p.facilityId === input.facilityId);
  const plan: AncPlan = {
    patientId: input.patientId,
    facilityId: input.facilityId,
    patientName: input.patientName,
    phone: input.phone || prev?.phone,
    lmp: input.lmp,
    edd,
    gaWeeksAtReg: ga,
    visits,
    smsOptIn: input.smsOptIn ?? prev?.smsOptIn ?? Boolean(input.phone || prev?.phone),
    smsLang: input.smsLang || prev?.smsLang || 'en',
    lastSmsAt: prev?.lastSmsAt,
    lastSmsVisitWeek: prev?.lastSmsVisitWeek,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  const all = readPlans().filter(
    (p) => !(p.patientId === plan.patientId && p.facilityId === plan.facilityId)
  );
  all.unshift(plan);
  writePlans(all, plan.facilityId);

  if (plan.phone) {
    setAncSmsPref({
      patientId: plan.patientId,
      facilityId: plan.facilityId,
      phone: plan.phone,
      smsOptIn: plan.smsOptIn !== false,
      smsLang: plan.smsLang || 'en',
    });
  }
  return plan;
}

export function updateAncPlan(
  patientId: string,
  facilityId: string,
  patch: Partial<Pick<AncPlan, 'phone' | 'smsOptIn' | 'smsLang' | 'patientName' | 'lastSmsAt' | 'lastSmsVisitWeek'>>
): AncPlan | null {
  const all = readPlans();
  const i = all.findIndex((p) => p.patientId === patientId && p.facilityId === facilityId);
  if (i < 0) return null;
  const next = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  all[i] = next;
  writePlans(all, facilityId);
  return next;
}

export function setAncSmsPref(input: {
  patientId: string;
  facilityId: string;
  phone?: string;
  smsOptIn: boolean;
  smsLang: SmsLang;
}): AncSmsPref {
  const pref: AncSmsPref = {
    ...input,
    updatedAt: new Date().toISOString(),
  };
  const all = readPrefs().filter(
    (p) => !(p.patientId === pref.patientId && p.facilityId === pref.facilityId)
  );
  all.unshift(pref);
  writePrefs(all);
  updateAncPlan(pref.patientId, pref.facilityId, {
    phone: pref.phone,
    smsOptIn: pref.smsOptIn,
    smsLang: pref.smsLang,
  });
  return pref;
}

export function getAncSmsPref(patientId: string, facilityId?: string): AncSmsPref | null {
  const rows = readPrefs().filter((p) => p.patientId === patientId);
  if (facilityId) return rows.find((p) => p.facilityId === facilityId) || null;
  return rows[0] || null;
}

export function listDueAncVisits(
  facilityId: string,
  withinDays = 3,
  opts?: { includeOptedOut?: boolean }
): AncDueItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: AncDueItem[] = [];
  for (const plan of listAncPlans(facilityId)) {
    if (!opts?.includeOptedOut && plan.smsOptIn === false) continue;
    for (const visit of plan.visits) {
      const due = new Date(visit.dueDate + 'T00:00:00');
      const daysUntil = Math.round((due.getTime() - today.getTime()) / 864e5);
      if (daysUntil > withinDays) continue;
      if (daysUntil < -7) continue;
      if (plan.lastSmsVisitWeek === visit.week && plan.lastSmsAt) {
        const last = new Date(plan.lastSmsAt).getTime();
        if (Date.now() - last < 5 * 864e5) continue;
      }
      out.push({
        plan,
        visit,
        daysUntil,
        overdue: daysUntil < 0,
      });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
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
}): Promise<{ ok: boolean; mode: 'live' | 'error' | 'unconfigured'; message: string; body: string }> {
  const body = smsBody(input.lang, input.kind, input.patientName, input.when, input.facilityName);
  if (!String(input.phone || '').trim()) {
    return { ok: false, mode: 'error', message: 'Phone number required', body };
  }
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: input.phone, body, lang: input.lang }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 503 || json.mode === 'unconfigured') {
      return {
        ok: false,
        mode: 'unconfigured',
        message: json.message || 'SMS gateway not configured. Set SMS_API_URL and SMS_API_KEY on the server.',
        body,
      };
    }
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        mode: 'error',
        message: json.message || `SMS gateway error (HTTP ${res.status})`,
        body,
      };
    }
    return { ok: true, mode: 'live', message: json.message || 'SMS sent', body };
  } catch (e) {
    return {
      ok: false,
      mode: 'error',
      message: `SMS network error: ${(e as Error).message}`,
      body,
    };
  }
}

export type AncBatchResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  unconfigured: boolean;
  details: { patientName: string; phone: string; ok: boolean; message: string }[];
};

export async function runAncDueSmsBatch(
  facilityId: string,
  facilityName: string,
  withinDays = 3
): Promise<AncBatchResult> {
  const due = listDueAncVisits(facilityId, withinDays);
  const result: AncBatchResult = {
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    unconfigured: false,
    details: [],
  };
  const outbox: unknown[] = [];
  if (typeof window !== 'undefined') {
    try {
      outbox.push(...JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'));
    } catch {
      /* */
    }
  }

  for (const item of due) {
    const phone = item.plan.phone || getAncSmsPref(item.plan.patientId, facilityId)?.phone;
    if (!phone || item.plan.smsOptIn === false) {
      result.skipped += 1;
      result.details.push({
        patientName: item.plan.patientName,
        phone: phone || '—',
        ok: false,
        message: !phone ? 'No phone' : 'SMS opted out',
      });
      continue;
    }
    result.attempted += 1;
    const lang = item.plan.smsLang || 'en';
    const whenLabel = `${item.visit.dueDate} (${item.visit.label})`;
    const r = await sendReminderSms({
      phone,
      lang,
      kind: 'anc',
      patientName: item.plan.patientName,
      when: whenLabel,
      facilityName,
    });
    outbox.unshift({
      at: new Date().toISOString(),
      facilityId,
      patientId: item.plan.patientId,
      visitWeek: item.visit.week,
      phone,
      body: r.body,
      mode: r.mode,
      ok: r.ok,
    });
    if (r.mode === 'unconfigured') {
      result.unconfigured = true;
      result.failed += 1;
      result.details.push({
        patientName: item.plan.patientName,
        phone,
        ok: false,
        message: r.message,
      });
      break;
    }
    if (r.ok) {
      result.sent += 1;
      updateAncPlan(item.plan.patientId, facilityId, {
        lastSmsAt: new Date().toISOString(),
        lastSmsVisitWeek: item.visit.week,
      });
      result.details.push({ patientName: item.plan.patientName, phone, ok: true, message: r.message });
    } else {
      result.failed += 1;
      result.details.push({ patientName: item.plan.patientName, phone, ok: false, message: r.message });
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox.slice(0, 500)));
    } catch {
      /* */
    }
  }
  return result;
}

export function subscribeAncPlans(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('medcore-admin-sync', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('medcore-admin-sync', fn);
  };
}

export function nextAncVisit(plan: AncPlan | null): AncVisitSlot | null {
  if (!plan?.visits?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return plan.visits.find((v) => v.dueDate >= today) || plan.visits[plan.visits.length - 1] || null;
}

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

export const ANC_PLANS_KEY = ANC_KEY;
export const ANC_SMS_PREFS_KEY = PREF_KEY;
