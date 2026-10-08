/**
 * Ambient clinical notes: browser speech → transcript → Gemini SOAP draft.
 * Never auto-signs; doctor must review.
 */
import { geminiGenerate, hasGeminiKey } from './geminiClient';

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  rawTranscript: string;
  provider: string;
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
  const w = window as any;
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
    opts.onError?.('Speech recognition not supported in this browser. Use Chrome/Edge.');
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

function parseSoapFromText(text: string, transcript: string): SoapNote {
  const sections: Record<string, string> = {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  };
  const labels: Array<[string, RegExp]> = [
    ['subjective', /(?:^|\n)\s*(?:S(?:ubjective)?|SUBJECTIVE)\s*[:.\-]\s*/i],
    ['objective', /(?:^|\n)\s*(?:O(?:bjective)?|OBJECTIVE)\s*[:.\-]\s*/i],
    ['assessment', /(?:^|\n)\s*(?:A(?:ssessment)?|ASSESSMENT)\s*[:.\-]\s*/i],
    ['plan', /(?:^|\n)\s*(?:P(?:lan)?|PLAN)\s*[:.\-]\s*/i],
  ];
  const indices: Array<{ key: string; at: number }> = [];
  for (const [key, re] of labels) {
    const m = re.exec(text);
    if (m) indices.push({ key, at: m.index + m[0].length });
  }
  indices.sort((a, b) => a.at - b.at);
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].at;
    const end = i + 1 < indices.length ? indices[i + 1].at - (text.slice(0, indices[i + 1].at).length - text.slice(0, indices[i + 1].at).replace(/.*$/, '').length) : text.length;
    // simpler end: next section start
    const nextLabel = i + 1 < indices.length ? labels.find((l) => l[0] === indices[i + 1].key)?.[1] : null;
    let sliceEnd = text.length;
    if (i + 1 < indices.length) {
      const nextRe = labels.find((l) => l[0] === indices[i + 1].key)?.[1];
      if (nextRe) {
        const nm = nextRe.exec(text);
        if (nm) sliceEnd = nm.index;
      }
    }
    sections[indices[i].key] = text.slice(start, sliceEnd).trim();
  }
  if (!sections.subjective && !sections.plan) {
    sections.subjective = transcript.slice(0, 800);
    sections.assessment = text.slice(0, 600);
  }
  return {
    subjective: sections.subjective,
    objective: sections.objective,
    assessment: sections.assessment,
    plan: sections.plan,
    rawTranscript: transcript,
    provider: 'gemini',
    createdAt: new Date().toISOString(),
  };
}

export async function synthesizeSoapNote(input: {
  transcript: string;
  patientLabel?: string;
  extraContext?: string;
}): Promise<{ ok: boolean; soap?: SoapNote; text: string }> {
  const transcript = input.transcript.trim();
  if (!transcript) return { ok: false, text: 'No transcript to convert' };

  if (!hasGeminiKey()) {
    // Deterministic offline fallback structure
    const soap: SoapNote = {
      subjective: transcript,
      objective: 'Vitals / exam — not captured in ambient audio (add manually).',
      assessment: 'Clinical impression pending physician review of ambient transcript.',
      plan: '1. Review and complete this draft\n2. Order investigations as indicated\n3. Follow-up as appropriate',
      rawTranscript: transcript,
      provider: 'local-fallback',
      createdAt: new Date().toISOString(),
    };
    return { ok: true, soap, text: formatSoap(soap) };
  }

  const res = await geminiGenerate(
    `Convert this doctor–patient consultation transcript into a structured SOAP note for a Nigerian hospital OPD.\n\nPatient: ${input.patientLabel || 'Unknown'}\n${input.extraContext || ''}\n\nTranscript:\n${transcript}\n\nRespond ONLY with:\nS:\n...\nO:\n...\nA:\n...\nP:\n...\n`,
    'You are MedCore ambient clinical scribe. Structure notes clearly. Never invent drugs, diagnoses, or vitals not supported by the transcript. Flag uncertainty.'
  );

  if (!res.ok || !res.text) {
    return { ok: false, text: res.text || 'SOAP synthesis failed' };
  }
  const soap = parseSoapFromText(res.text, transcript);
  soap.provider = res.usedGemini ? 'gemini' : 'local-fallback';
  return { ok: true, soap, text: formatSoap(soap) };
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
