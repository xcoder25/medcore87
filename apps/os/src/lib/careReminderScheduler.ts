/**
 * Live Care Portal Sync & Automated ANC / Immunization / Chronic Care Reminder Scheduler (`apps/os`).
 * Zero-randomness scheduling engine linking patient registry milestones to WhatsApp & Care Mobile App.
 */
import type { FacilityPatient } from './patientRegistryStore';
import type { TriageBotLanguage } from './patientTriageBotEngine';

export type CareReminderTrack =
  | 'antenatal_anc'
  | 'child_immunization'
  | 'hypertension_refill'
  | 'diabetes_refill';

export interface ScheduledCareReminder {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  phone: string;
  shid?: string;
  track: CareReminderTrack;
  dueDate: string;
  channel: 'whatsapp_voice' | 'whatsapp_text' | 'sms';
  language: TriageBotLanguage;
  messageBody: string;
  status: 'due' | 'dispatched' | 'acknowledged';
  dispatchedAt?: string;
}

export interface CarePortalBooking {
  id: string;
  bookingRef: string;
  facilityId: string;
  facilityName: string;
  patientName: string;
  shid?: string;
  phone?: string;
  department: string;
  preferredSlot: string;
  source: 'care_mobile_app' | 'whatsapp_voice_bot';
  status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled';
  createdAt: string;
}

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

function resolveLang(raw?: string): TriageBotLanguage {
  const l = String(raw || '').toLowerCase();
  if (l.includes('pidgin')) return 'pidgin';
  if (l.includes('ibibio')) return 'ibibio';
  if (l.includes('annang')) return 'annang';
  if (l.includes('oron')) return 'oron';
  return 'english';
}

function ageYearsFromDob(dob: string, nowMs: number): number | null {
  const ms = Date.parse(dob || '');
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / (365.25 * 86_400_000)));
}

export function generateDueCareReminders(
  patients: Array<Partial<FacilityPatient> & { id: string; facilityId: string; firstName: string; lastName: string }>,
  nowIso = new Date().toISOString()
): ScheduledCareReminder[] {
  const nowMs = Date.parse(nowIso) || Date.now();
  const dueDate = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const out: ScheduledCareReminder[] = [];

  for (const p of patients) {
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || 'Patient';
    const lang = resolveLang(p.preferredLanguage);
    const chronic = (p.chronicConditions || []).join(' ').toLowerCase();
    const ageYrs = ageYearsFromDob(p.dob || '', nowMs);

    if (/pregnan|anc|matern|gestat/i.test(`${chronic} ${p.notesAdmin || ''}`)) {
      const msg =
        lang === 'pidgin'
          ? `Hello ${fullName}, your Antenatal (ANC) check-in dey due on ${dueDate}. Abeg tell us by voice or text if you get headache, swollen leg, or baby no dey kick well.`
          : `Hello ${fullName}, your Antenatal Care (ANC) check-in is due on ${dueDate}. Reply via voice or text with fetal movement status or any warning signs.`;
      out.push({
        id: `REM-ANC-${stableHash(`${p.id}|${dueDate}`)}`,
        facilityId: p.facilityId,
        patientId: p.id,
        patientName: fullName,
        phone: p.phone || '',
        shid: p.shid,
        track: 'antenatal_anc',
        dueDate,
        channel: 'whatsapp_voice',
        language: lang,
        messageBody: msg,
        status: 'due',
      });
    }

    if (ageYrs !== null && ageYrs < 5) {
      const msg = `Hello parent of ${fullName}, routine childhood immunization (Penta/Measles/OPV) review is scheduled for ${dueDate}. Present your MedCore Yellow Card at your nearest PHC.`;
      out.push({
        id: `REM-IMM-${stableHash(`${p.id}|${dueDate}`)}`,
        facilityId: p.facilityId,
        patientId: p.id,
        patientName: fullName,
        phone: p.phone || '',
        shid: p.shid,
        track: 'child_immunization',
        dueDate,
        channel: 'whatsapp_text',
        language: lang,
        messageBody: msg,
        status: 'due',
      });
    }

    if (/hypertens|bp|cardio/i.test(chronic)) {
      const msg =
        lang === 'pidgin'
          ? `Hello ${fullName}, time to check your BP and confirm your daily hypertension tablet before refill due ${dueDate}. Send your latest BP reading.`
          : `Hello ${fullName}, scheduled Hypertension Check-In: please confirm daily antihypertensive adherence and reply with your latest blood pressure reading before ${dueDate}.`;
      out.push({
        id: `REM-HTN-${stableHash(`${p.id}|${dueDate}`)}`,
        facilityId: p.facilityId,
        patientId: p.id,
        patientName: fullName,
        phone: p.phone || '',
        shid: p.shid,
        track: 'hypertension_refill',
        dueDate,
        channel: 'whatsapp_voice',
        language: lang,
        messageBody: msg,
        status: 'due',
      });
    }

    if (/diabet|sugar|glyc/i.test(chronic)) {
      const msg = `Hello ${fullName}, Diabetes Check-In Reminder: log your fasting blood sugar before ${dueDate} and book clinic refill if less than 5 days left.`;
      out.push({
        id: `REM-DM-${stableHash(`${p.id}|${dueDate}`)}`,
        facilityId: p.facilityId,
        patientId: p.id,
        patientName: fullName,
        phone: p.phone || '',
        shid: p.shid,
        track: 'diabetes_refill',
        dueDate,
        channel: 'whatsapp_text',
        language: lang,
        messageBody: msg,
        status: 'due',
      });
    }
  }

  return out;
}

export function recordAppointmentFromCarePortal(input: {
  bookingRef?: string;
  facilityId: string;
  facilityName: string;
  patientName: string;
  shid?: string;
  phone?: string;
  department: string;
  preferredSlot: string;
  source: CarePortalBooking['source'];
  nowIso?: string;
}): CarePortalBooking {
  const nowIso = input.nowIso || new Date().toISOString();
  const hash = stableHash(`${input.facilityId}|${input.patientName}|${input.department}|${nowIso}`);
  return {
    id: `CARE-APT-${hash}`,
    bookingRef: input.bookingRef || `AKS-APT-${hash}`,
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    patientName: input.patientName || 'MedCore Care Patient',
    shid: input.shid,
    phone: input.phone,
    department: input.department || 'General Outpatient Department (GOPD)',
    preferredSlot: input.preferredSlot || 'Tomorrow · 09:00 AM',
    source: input.source,
    status: 'scheduled',
    createdAt: nowIso,
  };
}
