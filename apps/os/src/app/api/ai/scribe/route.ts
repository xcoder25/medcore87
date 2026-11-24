import { NextRequest, NextResponse } from 'next/server';
import {
  evaluatePrescriptionSafetyGuard,
  type PrescriptionSafetyReport,
} from '../../../../lib/clinicalSafetyEngine';
import { ensureSchema, isPostgresConfigured, withTenantClient } from '../../../../lib/db/postgres';
import {
  CURRENT_CHAT_MODELS,
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ScribeSuggestedOrder {
  type: 'lab' | 'rx' | 'imaging';
  code: string;
  name: string;
  priority: 'routine' | 'urgent' | 'stat';
  dosageNotes?: string;
  safetyReport?: PrescriptionSafetyReport;
}

export interface ScribeIcd11Suggestion {
  code: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScribeDraftPayload {
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  icd11Suggestions: ScribeIcd11Suggestion[];
  suggestedOrders: ScribeSuggestedOrder[];
  redFlags: string[];
  patientSummary: {
    english: string;
    pidgin: string;
    ibibio: string;
  };
  provider: 'clinical-ai' | 'local-fallback';
  modelUsed?: string;
}

interface PatientSafetyCtx {
  allergies?: string[];
  otherDrugs?: string[];
  dob?: string;
  sex?: string;
  isPregnant?: boolean;
  chronicConditions?: string[];
  genotype?: string;
  egfr?: number;
  creatinineMgDl?: number;
}

function buildDeterministicScribeDraft(
  transcript: string,
  vitalsSummary: string,
  patientLabel: string
): ScribeDraftPayload {
  const lower = transcript.toLowerCase();
  const icd11Suggestions: ScribeIcd11Suggestion[] = [];
  const suggestedOrders: ScribeSuggestedOrder[] = [];
  const redFlags: string[] = [];

  if (/fever|malaria|chills|body pain|rigor|headache/i.test(lower)) {
    icd11Suggestions.push({ code: '1F40', label: 'Malaria without parasitological confirmation / febrile illness', confidence: 'medium' });
    suggestedOrders.push({ type: 'lab', code: 'LAB-MP', name: 'Malaria Parasite (RDT + Film)', priority: 'urgent' });
    suggestedOrders.push({ type: 'lab', code: 'LAB-FBC', name: 'Full Blood Count (FBC)', priority: 'urgent' });
    suggestedOrders.push({ type: 'rx', code: 'RX-PCM', name: 'Paracetamol 500mg tabs', priority: 'routine', dosageNotes: '1g TDS PRN fever/pain' });
  }
  if (/amoxicillin/i.test(lower)) {
    suggestedOrders.push({ type: 'rx', code: 'RX-AMOX', name: 'Amoxicillin 500mg caps', priority: 'routine', dosageNotes: '500mg TDS x 5 days' });
  }
  if (/artemether|coartem|lumefantrine/i.test(lower)) {
    suggestedOrders.push({ type: 'rx', code: 'RX-ACT', name: 'Artemether-Lumefantrine 20/120mg', priority: 'routine', dosageNotes: '4 tabs BD x 3 days' });
  }
  if (/cough|shortness of breath|chest pain|dyspnoea|spo2|pneumonia/i.test(lower)) {
    icd11Suggestions.push({ code: 'CA40', label: 'Acute lower respiratory tract infection / pneumonia', confidence: 'medium' });
    suggestedOrders.push({ type: 'imaging', code: 'IMG-CXR', name: 'Chest X-Ray PA', priority: 'urgent' });
  }
  if (/hypertens|bp|high blood pressure|amlodipine|lisinopril/i.test(lower)) {
    icd11Suggestions.push({ code: 'BA00', label: 'Essential hypertension', confidence: 'medium' });
    suggestedOrders.push({ type: 'lab', code: 'LAB-UEC', name: 'Urea, Electrolytes & Creatinine (UEC)', priority: 'routine' });
  }
  if (/pregnan|antenatal|bleeding|pre-eclampsia|anc|labour|gestation/i.test(lower)) {
    icd11Suggestions.push({ code: 'JA24', label: 'Antenatal / obstetric review', confidence: 'medium' });
    suggestedOrders.push({ type: 'lab', code: 'LAB-URINE', name: 'Urinalysis + Protein Dipstick', priority: 'urgent' });
  }
  if (/chest pain|collapse|unconscious|sepsis|bleed|convulsion|sp02 < 92|hypoxia/i.test(lower)) {
    redFlags.push('Potential acute red-flag symptom mentioned in consultation — perform immediate bedside stabilization.');
  }

  if (icd11Suggestions.length === 0) {
    icd11Suggestions.push({ code: 'QA00', label: 'General medical encounter pending clinician diagnosis', confidence: 'low' });
  }

  const uniqueOrders = suggestedOrders.filter(
    (item, idx, arr) => arr.findIndex((x) => x.name.toLowerCase() === item.name.toLowerCase()) === idx
  );

  return {
    soap: {
      subjective: transcript,
      objective: vitalsSummary
        ? `Recorded Triage/Exam Vitals: ${vitalsSummary}. Complete focused physical exam in chart.`
        : 'Vitals / physical exam not captured in ambient transcript — review nursing triage panel.',
      assessment: `Pending physician verification (${patientLabel || 'Active Patient'}). Candidate differentials: ${icd11Suggestions.map((d) => `${d.label} [${d.code}]`).join('; ')}.`,
      plan:
        uniqueOrders.length > 0
          ? `1. Review and confirm suggested orders (${uniqueOrders.map((o) => o.name).join(', ')})\n2. Verify drug safety checks prior to signing\n3. Counsel patient on warning signs & follow-up`
          : '1. Review & edit consultation draft\n2. Place indicated investigations/prescriptions\n3. Provide return precautions',
    },
    icd11Suggestions,
    suggestedOrders: uniqueOrders,
    redFlags,
    patientSummary: {
      english:
        'Please complete any ordered lab tests or medications as directed by your doctor, drink clean fluids, and return immediately if fever worsens, breathing becomes difficult, or dizziness develops.',
      pidgin:
        'Abeg make sure say you do all di test and take your medicine well as doctor talk. Drink plenty clean water, and rush come back hospital sharp-sharp if fever high, breath dey hard, or eye dey turn you.',
      ibibio:
        'Mbok nam kpukpru ndomo ye ibok nte abiaibok etemede. Nwong edisana mmong, nyung fiak di ufokibok usop-usop edieke ufiop idem okponode mme ibifik osobo.',
    },
    provider: 'local-fallback',
  };
}

const SCRIBE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    subjective: { type: 'string' },
    objective: { type: 'string' },
    assessment: { type: 'string' },
    plan: { type: 'string' },
    icd11Suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          label: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['code', 'label', 'confidence'],
      },
    },
    suggestedOrders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['lab', 'rx', 'imaging'] },
          code: { type: 'string' },
          name: { type: 'string' },
          priority: { type: 'string', enum: ['routine', 'urgent', 'stat'] },
          dosageNotes: { type: 'string' },
        },
        required: ['type', 'code', 'name', 'priority'],
      },
    },
    redFlags: {
      type: 'array',
      items: { type: 'string' },
    },
    patientSummary: {
      type: 'object',
      properties: {
        english: { type: 'string' },
        pidgin: { type: 'string' },
        ibibio: { type: 'string' },
      },
      required: ['english', 'pidgin', 'ibibio'],
    },
  },
  required: [
    'subjective',
    'objective',
    'assessment',
    'plan',
    'icd11Suggestions',
    'suggestedOrders',
    'redFlags',
    'patientSummary',
  ],
};

export async function POST(req: NextRequest) {
  let body: {
    transcript?: string;
    facilityId?: string;
    patientId?: string;
    patientLabel?: string;
    vitalsSummary?: string;
    patientContext?: PatientSafetyCtx;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const transcript = String(body.transcript || '').trim();
  if (!transcript) {
    return NextResponse.json({ ok: false, error: 'transcript is required' }, { status: 400 });
  }

  const facilityId = String(body.facilityId || req.headers.get('x-facility-id') || 'IGH-EKT')
    .trim()
    .toUpperCase();
  const patientId = String(body.patientId || '').trim();
  const patientLabel = String(body.patientLabel || 'Active Patient').trim();
  const vitalsSummary = String(body.vitalsSummary || '').trim();
  const safetyCtx: PatientSafetyCtx = { ...(body.patientContext || {}) };

  if (patientId && isPostgresConfigured()) {
    try {
      await ensureSchema();
      await withTenantClient(facilityId, async (c) => {
        const res = await c.query<{
          sex: string | null;
          date_of_birth: string | null;
          meta: Record<string, unknown> | null;
        }>(
          `SELECT sex, date_of_birth::text AS date_of_birth, meta
           FROM patients
           WHERE facility_id = $1 AND id = $2
           LIMIT 1`,
          [facilityId, patientId]
        );
        const pt = res.rows[0];
        if (pt) {
          const meta = (pt.meta || {}) as Record<string, unknown>;
          safetyCtx.sex = safetyCtx.sex || pt.sex || undefined;
          safetyCtx.dob = safetyCtx.dob || pt.date_of_birth || undefined;
          if (!safetyCtx.allergies?.length && Array.isArray(meta.allergies)) {
            safetyCtx.allergies = meta.allergies as string[];
          }
          if (!safetyCtx.chronicConditions?.length && Array.isArray(meta.chronicConditions)) {
            safetyCtx.chronicConditions = meta.chronicConditions as string[];
          }
          if (!safetyCtx.otherDrugs?.length && Array.isArray(meta.currentMedications)) {
            safetyCtx.otherDrugs = meta.currentMedications as string[];
          }
          if (!safetyCtx.genotype && typeof meta.genotype === 'string') {
            safetyCtx.genotype = meta.genotype;
          }
        }
      });
    } catch {
      /* continue with provided context */
    }
  }

  let draft: ScribeDraftPayload | null = null;
  const { key } = resolveServerGeminiKey();

  if (key) {
    const prompt = [
      `Convert this Nigerian hospital outpatient/ward consultation transcript into a structured SOAP note, ICD-11 suggestions, actionable suggested orders (only those supported by transcript), clinical red flags, and patient discharge/take-home counselling in English, Nigerian Pidgin, and Ibibio.`,
      `Patient: ${patientLabel}`,
      vitalsSummary ? `Current Triage Vitals: ${vitalsSummary}` : '',
      safetyCtx.allergies?.length ? `Documented Allergies: ${safetyCtx.allergies.join(', ')}` : '',
      safetyCtx.chronicConditions?.length ? `Conditions: ${safetyCtx.chronicConditions.join(', ')}` : '',
      `Transcript:\n${transcript}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const aiRes = await createGeminiInteraction({
      apiKey: key,
      models: [CURRENT_CHAT_MODELS[0], CURRENT_CHAT_MODELS[2]],
      systemInstruction:
        'You are MedCore Ambient Clinical Scribe for Nigerian physicians. Never fabricate vitals, allergies, or diagnoses not grounded in the transcript or vitals summary. Keep suggestedOrders concise and practical.',
      input: prompt,
      responseFormat: {
        type: 'text',
        mime_type: 'application/json',
        schema: SCRIBE_RESPONSE_SCHEMA,
      },
      temperature: 0.2,
      maxOutputTokens: 1400,
    });

    if (aiRes.ok && aiRes.text) {
      try {
        const parsed = JSON.parse(aiRes.text) as {
          subjective?: string;
          objective?: string;
          assessment?: string;
          plan?: string;
          icd11Suggestions?: ScribeIcd11Suggestion[];
          suggestedOrders?: ScribeSuggestedOrder[];
          redFlags?: string[];
          patientSummary?: { english?: string; pidgin?: string; ibibio?: string };
        };
        draft = {
          soap: {
            subjective: String(parsed.subjective || transcript).trim(),
            objective: String(parsed.objective || vitalsSummary || 'Review bedside vitals & exam.').trim(),
            assessment: String(parsed.assessment || 'Pending clinician confirmation.').trim(),
            plan: String(parsed.plan || 'Review and confirm management plan.').trim(),
          },
          icd11Suggestions: Array.isArray(parsed.icd11Suggestions) ? parsed.icd11Suggestions.slice(0, 6) : [],
          suggestedOrders: Array.isArray(parsed.suggestedOrders) ? parsed.suggestedOrders.slice(0, 8) : [],
          redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.slice(0, 5) : [],
          patientSummary: {
            english: String(parsed.patientSummary?.english || '').trim(),
            pidgin: String(parsed.patientSummary?.pidgin || '').trim(),
            ibibio: String(parsed.patientSummary?.ibibio || '').trim(),
          },
          provider: 'clinical-ai',
          modelUsed: aiRes.model,
        };
      } catch {
        draft = null;
      }
    }
  }

  if (!draft) {
    draft = buildDeterministicScribeDraft(transcript, vitalsSummary, patientLabel);
  }

  // Enrich every suggested Rx order with deterministic server-side Clinical Safety Guard audit
  draft.suggestedOrders = draft.suggestedOrders.map((order) => {
    if (order.type !== 'rx') return order;
    const safetyReport = evaluatePrescriptionSafetyGuard({
      drugName: order.name,
      notes: order.dosageNotes,
      allergies: safetyCtx.allergies,
      otherDrugs: safetyCtx.otherDrugs,
      dob: safetyCtx.dob,
      sex: safetyCtx.sex,
      isPregnant: safetyCtx.isPregnant,
      chronicConditions: safetyCtx.chronicConditions,
      genotype: safetyCtx.genotype,
      egfr: safetyCtx.egfr,
      creatinineMgDl: safetyCtx.creatinineMgDl,
    });
    return {
      ...order,
      safetyReport,
    };
  });

  return NextResponse.json({
    ok: true,
    facilityId,
    draft,
  });
}
