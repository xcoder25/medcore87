/**
 * AI Reception Orchestrator
 * ─────────────────────────────────────────────────────────────
 * Gemini = intelligence layer (reason, recommend, explain)
 * EMR   = source of truth (only controlled APIs mutate records)
 *
 * Gesture / presence / arrival events are INTENTS.
 * This module turns intents into contextual recommendations.
 * Receptionist (or auto-policy) confirms → EMR check-in / payment / walk-in.
 */

import type { FacilityPatient } from './patientRegistryStore';
import type {
  ReceptionAppointment,
  ReceptionVisit,
  ReceptionDayStats,
} from './receptionOpsStore';
import { geminiGenerate } from './geminiClient';

export type ArrivalIntent =
  | 'gesture_checkin'
  | 'app_presence'
  | 'manual_search'
  | 'qr_scan'
  | 'walk_in';

export type AiRecommendedAction =
  | 'admit'
  | 'review'
  | 'start_walkin'
  | 'find_appointment'
  | 'complete_registration'
  | 'verify_insurance'
  | 'take_payment'
  | 'decline';

export interface ArrivalContext {
  patient: FacilityPatient;
  facilityId: string;
  facilityName?: string;
  intent: ArrivalIntent;
  arrivedAt?: string;
  selectedReason?: string;
  proximityLabel?: string;
}

export interface AiCheckInCard {
  id: string;
  severity: 'info' | 'success' | 'warn' | 'attention';
  headline: string;
  subhead: string;
  patientName: string;
  hospitalNumber: string;
  patientId: string;
  appointment?: {
    time: string;
    provider: string;
    department: string;
    reason?: string;
    id: string;
  };
  flags: string[];
  readiness: {
    registration: boolean;
    insurance: boolean;
    appointment: boolean;
    paymentClear: boolean;
  };
  estimatedReceptionMin: number;
  recommendation: string;
  primaryAction: AiRecommendedAction;
  secondaryActions: AiRecommendedAction[];
  explanation: string;
  /** Never auto-applied — UI must confirm */
  requiresHumanConfirm: true;
}

export interface ReceptionAiOverview {
  waiting: number;
  ready: number;
  incompleteRegistration: number;
  waitingForProvider: number;
  needsAttention: number;
  narrative: string;
  moveForwardIds: string[];
}

function minsEarly(scheduledIso: string, arrivedIso: string): number {
  const s = new Date(scheduledIso).getTime();
  const a = new Date(arrivedIso).getTime();
  return Math.round((s - a) / 60000);
}

function hasBasicRegistration(p: FacilityPatient): boolean {
  return !!(p.firstName && p.lastName && p.phone && p.hospitalNumber);
}

function hasInsuranceOk(p: FacilityPatient): boolean {
  if (!p.insuranceProvider || p.insuranceProvider === 'NONE') return true;
  return !!(p.insuranceId || p.nhiaNumber);
}

/**
 * Pure offline intelligence — always available (hospital power/network cuts).
 * Gemini can later refine narrative; structure stays the same.
 */
export function orchestrateArrival(
  ctx: ArrivalContext,
  appointments: ReceptionAppointment[],
  todayVisits: ReceptionVisit[]
): AiCheckInCard {
  const p = ctx.patient;
  const arrivedAt = ctx.arrivedAt || new Date().toISOString();
  const day = arrivedAt.slice(0, 10);
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');

  const appt = appointments.find(
    (a) =>
      a.patientId === p.id &&
      a.facilityId === ctx.facilityId &&
      a.scheduledAt.slice(0, 10) === day &&
      (a.status === 'booked' || a.status === 'arrived')
  );

  const alreadyIn = todayVisits.find(
    (v) =>
      v.patientId === p.id &&
      v.status !== 'completed' &&
      v.status !== 'cancelled' &&
      v.status !== 'no_show'
  );

  const regOk = hasBasicRegistration(p);
  const insOk = hasInsuranceOk(p);
  const flags: string[] = [];

  if (!regOk) flags.push('Registration incomplete');
  if (!insOk) flags.push('Insurance details missing');
  if (alreadyIn) flags.push(`Already in queue (${alreadyIn.queueNumber})`);
  if (ctx.intent === 'gesture_checkin') flags.push('Gesture check-in');
  if (ctx.intent === 'app_presence') flags.push('App presence at facility');

  // ── Branch: already checked in ──────────────────────────────────────────
  if (alreadyIn) {
    return {
      id: `ai-${p.id}-${Date.now()}`,
      severity: 'info',
      headline: `${name} is already in the queue`,
      subhead: `Queue ${alreadyIn.queueNumber} · ${alreadyIn.department}`,
      patientName: name,
      hospitalNumber: p.hospitalNumber,
      patientId: p.id,
      appointment: appt
        ? {
            time: appt.scheduledAt.slice(11, 16),
            provider: appt.doctor,
            department: appt.department,
            reason: appt.reason,
            id: appt.id,
          }
        : undefined,
      flags,
      readiness: {
        registration: regOk,
        insurance: insOk,
        appointment: !!appt,
        paymentClear:
          alreadyIn.paymentStatus === 'paid' ||
          alreadyIn.paymentStatus === 'hmo' ||
          alreadyIn.paymentStatus === 'waived',
      },
      estimatedReceptionMin: 0,
      recommendation: 'No new check-in needed — monitor queue status.',
      primaryAction: 'review',
      secondaryActions: ['decline'],
      explanation: `Patient already checked in at ${alreadyIn.checkedInAt.slice(11, 16)}. Status: ${alreadyIn.status}.`,
      requiresHumanConfirm: true,
    };
  }

  // ── Branch: has appointment today ───────────────────────────────────────
  if (appt) {
    const early = minsEarly(appt.scheduledAt, arrivedAt);
    const timeLabel = appt.scheduledAt.slice(11, 16);
    const earlyLabel =
      early > 0 ? `Arrived ${early} min early` : early < -5 ? `Arrived ${Math.abs(early)} min late` : 'On time';

    flags.push(earlyLabel);

    const ready = regOk && insOk;
    return {
      id: `ai-${p.id}-${Date.now()}`,
      severity: ready ? 'success' : 'warn',
      headline: `${name} has arrived`,
      subhead: `${timeLabel} appointment · ${appt.doctor}`,
      patientName: name,
      hospitalNumber: p.hospitalNumber,
      patientId: p.id,
      appointment: {
        time: timeLabel,
        provider: appt.doctor,
        department: appt.department,
        reason: appt.reason,
        id: appt.id,
      },
      flags,
      readiness: {
        registration: regOk,
        insurance: insOk,
        appointment: true,
        paymentClear: false,
      },
      estimatedReceptionMin: ready ? 1 : 4,
      recommendation: ready
        ? 'Standard check-in — registration and insurance look complete.'
        : 'Complete missing registration/insurance before or during check-in.',
      primaryAction: ready ? 'admit' : 'complete_registration',
      secondaryActions: ready
        ? ['review', 'take_payment', 'decline']
        : ['admit', 'verify_insurance', 'decline'],
      explanation: [
        `Intent: ${ctx.intent.replace(/_/g, ' ')}.`,
        `Booked with ${appt.doctor} in ${appt.department} at ${timeLabel}.`,
        earlyLabel + '.',
        appt.reason ? `Reason: ${appt.reason}.` : '',
        ready
          ? 'AI recommends ADMIT — routine administrative path.'
          : 'AI recommends completing admin fields first; admit only if desk policy allows.',
      ]
        .filter(Boolean)
        .join(' '),
      requiresHumanConfirm: true,
    };
  }

  // ── Branch: walk-in / no appointment ────────────────────────────────────
  flags.push('No appointment found today');
  return {
    id: `ai-${p.id}-${Date.now()}`,
    severity: 'attention',
    headline: `Walk-in · ${name}`,
    subhead: 'No appointment on today’s list',
    patientName: name,
    hospitalNumber: p.hospitalNumber,
    patientId: p.id,
    flags,
    readiness: {
      registration: regOk,
      insurance: insOk,
      appointment: false,
      paymentClear: false,
    },
    estimatedReceptionMin: regOk ? 3 : 8,
    recommendation:
      'Possible walk-in consultation, appointment under another name/provider, or registration first.',
    primaryAction: regOk ? 'start_walkin' : 'complete_registration',
    secondaryActions: ['find_appointment', 'decline'],
    explanation: [
      `Intent: ${ctx.intent.replace(/_/g, ' ')}.`,
      'No booked appointment matched for this facility today.',
      regOk
        ? 'Profile is usable for walk-in OPD path.'
        : 'Profile incomplete — registration should run before clinical queue.',
      'AI does not decide clinical priority — receptionist confirms pathway.',
    ].join(' '),
    requiresHumanConfirm: true,
  };
}

/** Queue / desk narrative for the receptionist (offline rules). */
export function orchestrateDeskOverview(
  visits: ReceptionVisit[],
  patients: FacilityPatient[],
  stats: ReceptionDayStats
): ReceptionAiOverview {
  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called');
  const withProvider = visits.filter((v) => v.status === 'with_provider');
  const byId = new Map(patients.map((p) => [p.id, p]));

  let incomplete = 0;
  let ready = 0;
  const moveForwardIds: string[] = [];

  for (const v of waiting) {
    const p = byId.get(v.patientId);
    const regOk = p ? hasBasicRegistration(p) : false;
    const insOk = p ? hasInsuranceOk(p) : true;
    const paid =
      v.paymentStatus === 'paid' || v.paymentStatus === 'hmo' || v.paymentStatus === 'waived';
    if (!regOk || !insOk) incomplete += 1;
    else if (paid || v.visitType === 'appointment') {
      ready += 1;
      moveForwardIds.push(v.id);
    }
  }

  const needsAttention = visits.filter((v) => v.status === 'called' && !v.aiReminderSent).length;

  const parts: string[] = [];
  parts.push(`${stats.waiting} waiting in live queue.`);
  if (ready > 0) {
    parts.push(
      `${ready} can move forward now — registration${ready ? ' and pathway' : ''} look complete.`
    );
  }
  if (incomplete > 0) {
    parts.push(`${incomplete} still need registration or insurance details.`);
  }
  if (withProvider.length > 0) {
    parts.push(`${withProvider.length} currently with a provider.`);
  }
  if (moveForwardIds.length === 0 && waiting.length > 0) {
    parts.push('No patient is fully clear to auto-advance — desk confirmation required.');
  }

  return {
    waiting: waiting.length,
    ready,
    incompleteRegistration: incomplete,
    waitingForProvider: withProvider.length,
    needsAttention,
    narrative: parts.join(' '),
    moveForwardIds,
  };
}

/** Optional Gemini refinement — never mutates EMR; only enriches text. */
export async function enrichCardWithGemini(
  card: AiCheckInCard,
  _apiKey?: string
): Promise<AiCheckInCard> {
  try {
    const prompt = `You are a hospital front-desk AI copilot in Nigeria. Do NOT invent clinical advice. Rewrite only the "recommendation" and "explanation" fields to be clearer for a receptionist. Keep facts unchanged. JSON only: {"recommendation":"...","explanation":"..."}

Card:
${JSON.stringify(
      {
        headline: card.headline,
        subhead: card.subhead,
        flags: card.flags,
        readiness: card.readiness,
        recommendation: card.recommendation,
        explanation: card.explanation,
        primaryAction: card.primaryAction,
      }
    )}`;
    const res = await geminiGenerate(
      prompt,
      'MedCore reception AI. JSON only. No invented clinical data.',
    );
    if (!res.ok || !res.text) return card;
    const match = res.text.match(/\{[\s\S]*\}/);
    if (!match) return card;
    const parsed = JSON.parse(match[0]) as { recommendation?: string; explanation?: string };
    return {
      ...card,
      recommendation: parsed.recommendation || card.recommendation,
      explanation: parsed.explanation || card.explanation,
    };
  } catch {
    return card;
  }
}

export function actionLabel(a: AiRecommendedAction): string {
  switch (a) {
    case 'admit':
      return 'Admit / Check in';
    case 'review':
      return 'Review';
    case 'start_walkin':
      return 'Start walk-in';
    case 'find_appointment':
      return 'Find appointment';
    case 'complete_registration':
      return 'Complete registration';
    case 'verify_insurance':
      return 'Verify insurance';
    case 'take_payment':
      return 'Take payment';
    case 'decline':
      return 'Decline';
    default:
      return a;
  }
}
