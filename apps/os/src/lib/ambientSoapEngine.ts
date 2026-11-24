/**
 * Ambient clinical notes: browser speech / audio capture → transcript → Clinical AI SOAP + ICD-11 + Orders + Safety Gate.
 * Never auto-signs; doctor must review and explicitly confirm orders.
 */
import type { PrescriptionSafetyReport } from './clinicalSafetyEngine';

export interface ScribeIcd11Suggestion {
  code: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScribeSuggestedOrder {
  type: 'lab' | 'rx' | 'imaging';
  code: string;
  name: string;
  priority: 'routine' | 'urgent' | 'stat';
  dosageNotes?: string;
  safetyReport?: PrescriptionSafetyReport;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  rawTranscript: string;
  provider: 'clinical-ai' | 'local-fallback';
  modelUsed?: string;
  icd11Suggestions?: ScribeIcd11Suggestion[];
  suggestedOrders?: ScribeSuggestedOrder[];
  redFlags?: string[];
  patientSummary?: {
    english: string;
    pidgin: string;
    ibibio: string;
  };
  createdAt: string;
}

export interface AmbientSession {
  id: string;
  facilityId: string;
  patientId?: string;
  patientName?: string;
  transcript: string[];
  soap?: SoapNote;
  status: 'idle' | 'listening' | 'processing' | 'ready';
  updatedAt: string;
}

const KEY = 'medcore_os_ambient_soap_v1';
const EVT = 'medcore-ambient-soap';

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
};

function SpeechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported(): boolean {
  return Boolean(SpeechRecognitionCtor());
}

export function startAmbientListening(opts: {
  lang?: string;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}): { stop: () => void } | null {
  const Ctor = SpeechRecognitionCtor();
  if (!Ctor) {
    opts.onError?.('Live Web Speech not supported in this browser. Use Record Audio Clip instead.');
    return null;
  }
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = opts.lang || 'en-NG';
  rec.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const t = r[0]?.transcript || '';
      if (r.isFinal) opts.onFinal?.(t.trim());
      else interim += t;
    }
    if (interim.trim()) opts.onPartial?.(interim.trim());
  };
  rec.onerror = (ev: any) => {
    opts.onError?.(String(ev?.error || 'speech error'));
  };
  rec.onend = () => opts.onEnd?.();
  try {
    rec.start();
  } catch (e) {
    opts.onError?.((e as Error)?.message || 'Could not start mic');
    return null;
  }
  return {
    stop: () => {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}

export async function synthesizeSoapNote(input: {
  transcript: string;
  facilityId?: string;
  patientId?: string;
  patientLabel?: string;
  vitalsSummary?: string;
  extraContext?: string;
  patientContext?: {
    allergies?: string[];
    otherDrugs?: string[];
    dob?: string;
    sex?: string;
    isPregnant?: boolean;
    chronicConditions?: string[];
    genotype?: string;
  };
}): Promise<{ ok: boolean; soap?: SoapNote; text: string }> {
  const transcript = input.transcript.trim();
  if (!transcript) return { ok: false, text: 'No transcript to convert' };

  try {
    const res = await fetch('/api/ai/scribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.facilityId ? { 'x-facility-id': input.facilityId } : {}),
      },
      body: JSON.stringify({
        transcript: [transcript, input.extraContext].filter(Boolean).join('\n\n'),
        facilityId: input.facilityId,
        patientId: input.patientId,
        patientLabel: input.patientLabel,
        vitalsSummary: input.vitalsSummary,
        patientContext: input.patientContext,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      draft?: {
        soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
        icd11Suggestions?: ScribeIcd11Suggestion[];
        suggestedOrders?: ScribeSuggestedOrder[];
        redFlags?: string[];
        patientSummary?: { english: string; pidgin: string; ibibio: string };
        provider?: 'clinical-ai' | 'local-fallback';
        modelUsed?: string;
      };
      error?: string;
    };

    if (res.ok && json.ok && json.draft?.soap) {
      const soap: SoapNote = {
        subjective: String(json.draft.soap.subjective || transcript),
        objective: String(json.draft.soap.objective || 'Review vitals & exam findings.'),
        assessment: String(json.draft.soap.assessment || 'Pending physician confirmation.'),
        plan: String(json.draft.soap.plan || 'Review investigations & prescriptions.'),
        rawTranscript: transcript,
        provider: json.draft.provider === 'clinical-ai' ? 'clinical-ai' : 'local-fallback',
        modelUsed: json.draft.modelUsed,
        icd11Suggestions: json.draft.icd11Suggestions || [],
        suggestedOrders: json.draft.suggestedOrders || [],
        redFlags: json.draft.redFlags || [],
        patientSummary: json.draft.patientSummary,
        createdAt: new Date().toISOString(),
      };
      return { ok: true, soap, text: formatSoap(soap) };
    }
  } catch {
    /* network unavailable — use offline fallback below */
  }

  const fallback: SoapNote = {
    subjective: transcript,
    objective: input.vitalsSummary
      ? `Current Vitals: ${input.vitalsSummary}`
      : 'Vitals / physical exam — add manually from Nursing Triage.',
    assessment: 'Clinical impression pending physician review of ambient transcript.',
    plan: '1. Review and complete this draft\n2. Place indicated investigations/prescriptions\n3. Counsel on warning signs & follow-up',
    rawTranscript: transcript,
    provider: 'local-fallback',
    icd11Suggestions: [],
    suggestedOrders: [],
    redFlags: [],
    createdAt: new Date().toISOString(),
  };
  return { ok: true, soap: fallback, text: formatSoap(fallback) };
}

export function formatSoap(s: SoapNote): string {
  return `S: ${s.subjective}\n\nO: ${s.objective}\n\nA: ${s.assessment}\n\nP: ${s.plan}`;
}

export function persistAmbientDraft(session: AmbientSession) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(KEY);
    const list: AmbientSession[] = raw ? JSON.parse(raw) : [];
    const next = [session, ...list.filter((x) => x.id !== session.id)].slice(0, 50);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVT, { detail: session }));
  } catch {
    /* ignore */
  }
}
