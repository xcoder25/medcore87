import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateVitalDeterioration,
  type VitalSnapshotInput,
} from '../../../../lib/clinicalSafetyEngine';
import {
  CURRENT_CHAT_MODELS,
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PatientClinicalBrief {
  patientId: string;
  headline: string;
  activeProblems: string[];
  vitalTrends: string[];
  labTrends: string[];
  medicationSummary: string[];
  careGaps: string[];
  dischargePacket: {
    english: string;
    pidgin: string;
    ibibio: string;
    returnPrecautions: string[];
  };
  aiPowered: boolean;
  generatedAt: string;
}

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    activeProblems: { type: 'array', items: { type: 'string' } },
    vitalTrends: { type: 'array', items: { type: 'string' } },
    labTrends: { type: 'array', items: { type: 'string' } },
    medicationSummary: { type: 'array', items: { type: 'string' } },
    careGaps: { type: 'array', items: { type: 'string' } },
    dischargePacket: {
      type: 'object',
      properties: {
        english: { type: 'string' },
        pidgin: { type: 'string' },
        ibibio: { type: 'string' },
        returnPrecautions: { type: 'array', items: { type: 'string' } },
      },
      required: ['english', 'pidgin', 'ibibio', 'returnPrecautions'],
    },
  },
  required: [
    'headline',
    'activeProblems',
    'vitalTrends',
    'labTrends',
    'medicationSummary',
    'careGaps',
    'dischargePacket',
  ],
};

function buildDeterministicPatientBrief(input: {
  patient: {
    id?: string;
    name?: string;
    dob?: string;
    sex?: string;
    allergies?: string[];
    chronicConditions?: string[];
    currentMedications?: string[];
    genotype?: string;
    bloodGroup?: string;
    vitals?: Record<string, string | number>;
  };
  vitals?: VitalSnapshotInput[];
  orders?: Array<{ type?: string; name?: string; status?: string; resultSummary?: string }>;
  diagnosis?: string;
}): PatientClinicalBrief {
  const { patient, vitals = [], orders = [], diagnosis } = input;
  const activeProblems = Array.from(
    new Set(
      [diagnosis, ...(patient.chronicConditions || [])]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )
  );
  if (activeProblems.length === 0) activeProblems.push('Active OPD / ward evaluation');

  const vitalTrends: string[] = [];
  if (vitals.length > 0) {
    const evalRes = evaluateVitalDeterioration(vitals[0], vitals.slice(1, 5), {
      dob: patient.dob,
      sex: patient.sex,
      chronicConditions: patient.chronicConditions,
    });
    vitalTrends.push(
      `Latest NEWS2 ${evalRes.news2.total} (${evalRes.news2.riskLevel.replace('_', '-')}) · qSOFA ${evalRes.qsofa.score}/3${evalRes.shockIndex !== null ? ` · SI ${evalRes.shockIndex}` : ''}`
    );
    vitalTrends.push(...evalRes.alerts.slice(0, 2));
  } else if (patient.vitals && Object.keys(patient.vitals).length > 0) {
    const summary = Object.entries(patient.vitals)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([k, v]) => `${k.toUpperCase()} ${v}`)
      .join(' · ');
    vitalTrends.push(`Baseline vitals on file: ${summary}`);
  } else {
    vitalTrends.push('No recent nursing triage vitals recorded on this encounter.');
  }

  const labOrders = orders.filter((o) => o.type === 'lab');
  const resultedLabs = labOrders.filter((o) => o.resultSummary);
  const labTrends =
    resultedLabs.length > 0
      ? resultedLabs.slice(0, 4).map((l) => `${l.name}: ${l.resultSummary}`)
      : labOrders.length > 0
        ? [`${labOrders.length} lab order(s) pending result verification.`]
        : ['No laboratory results logged in current window.'];

  const rxOrders = orders.filter((o) => o.type === 'rx').map((o) => String(o.name || '').trim());
  const medicationSummary = Array.from(new Set([...(patient.currentMedications || []), ...rxOrders])).filter(Boolean);
  if (medicationSummary.length === 0) medicationSummary.push('No active outpatient prescriptions recorded.');

  const careGaps: string[] = [];
  if (vitals.length === 0 && (!patient.vitals || Object.keys(patient.vitals).length === 0)) {
    careGaps.push('Capture nursing triage vitals + NEWS2 baseline.');
  }
  const pendingLabs = labOrders.filter((o) => o.status !== 'resulted' && o.status !== 'cancelled').length;
  if (pendingLabs > 0) {
    careGaps.push(`${pendingLabs} pending lab investigation(s) awaiting result review.`);
  }
  if (patient.allergies?.length) {
    careGaps.push(`Allergy Alert on file: ${patient.allergies.join(', ')}`);
  }
  if (patient.genotype && ['AS', 'SS', 'SC'].includes(patient.genotype.toUpperCase())) {
    careGaps.push(`Genotype ${patient.genotype.toUpperCase()} — monitor oxidant medication & hydration.`);
  }
  if (careGaps.length === 0) {
    careGaps.push('All baseline triage & chart safety checks currently up to date.');
  }

  const dxLabel = activeProblems[0] || 'your condition';
  const medNote =
    medicationSummary.length && !medicationSummary[0].startsWith('No active')
      ? ` Continue ${medicationSummary.slice(0, 3).join(', ')} exactly as prescribed.`
      : '';

  return {
    patientId: String(patient.id || 'UNKNOWN'),
    headline: `${patient.name || 'Patient'} · ${activeProblems[0]}`,
    activeProblems,
    vitalTrends,
    labTrends,
    medicationSummary,
    careGaps,
    dischargePacket: {
      english: `Summary for ${patient.name || 'Patient'}: Assessment for ${dxLabel}.${medNote} Drink clean water, complete all lab checks, and return immediately if warning symptoms appear.`,
      pidgin: `${patient.name || 'Patient'}, doctor don check you for ${dxLabel}.${medNote} Abeg take your drugs well with clean water and rush come hospital sharp-sharp if fever hot pass before or breath dey seize.`,
      ibibio: `${patient.name || 'Patient'}, abiaibok omokut ntak ${dxLabel}.${medNote} Mbok nwong edisana mmong, nyung da ibok mfo ke usen ke usen. Fiak di ufokibok usop-usop edieke idem otionode mme ibifik osobo.`,
      returnPrecautions: [
        'Persistent fever > 38.5°C or new chills',
        'Difficulty breathing, chest pain, or dizziness',
        'Inability to keep fluids or tablets down',
      ],
    },
    aiPowered: false,
    generatedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

export async function POST(req: NextRequest) {
  let body: {
    patient?: {
      id?: string;
      name?: string;
      dob?: string;
      sex?: string;
      allergies?: string[];
      chronicConditions?: string[];
      currentMedications?: string[];
      genotype?: string;
      bloodGroup?: string;
      vitals?: Record<string, string | number>;
    };
    vitals?: VitalSnapshotInput[];
    orders?: Array<{ type?: string; name?: string; status?: string; resultSummary?: string }>;
    diagnosis?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.patient) {
    return NextResponse.json({ ok: false, error: 'patient payload required' }, { status: 400 });
  }

  const deterministic = buildDeterministicPatientBrief({
    patient: body.patient,
    vitals: body.vitals,
    orders: body.orders,
    diagnosis: body.diagnosis,
  });

  const { key } = resolveServerGeminiKey();
  if (key) {
    const aiRes = await createGeminiInteraction({
      apiKey: key,
      models: [CURRENT_CHAT_MODELS[0], CURRENT_CHAT_MODELS[2]],
      systemInstruction:
        'You are MedCore 30-Second Clinical Pre-Consult Summarizer. Synthesize a factual bedside brief strictly from the provided chart context and generate clear take-home guidance in English, Nigerian Pidgin, and Ibibio. Never invent labs, diagnoses, or allergies.',
      input: JSON.stringify({
        patient: body.patient,
        vitalsHistory: (body.vitals || []).slice(0, 6),
        orders: (body.orders || []).slice(0, 12),
        baselineSummary: deterministic,
      }),
      responseFormat: {
        type: 'text',
        mime_type: 'application/json',
        schema: BRIEF_SCHEMA,
      },
      temperature: 0.2,
      maxOutputTokens: 1100,
    });

    if (aiRes.ok && aiRes.text) {
      try {
        const parsed = JSON.parse(aiRes.text) as Partial<PatientClinicalBrief>;
        return NextResponse.json({
          ok: true,
          brief: {
            ...deterministic,
            headline: String(parsed.headline || deterministic.headline),
            activeProblems: Array.isArray(parsed.activeProblems) && parsed.activeProblems.length ? parsed.activeProblems : deterministic.activeProblems,
            vitalTrends: Array.isArray(parsed.vitalTrends) && parsed.vitalTrends.length ? parsed.vitalTrends : deterministic.vitalTrends,
            labTrends: Array.isArray(parsed.labTrends) && parsed.labTrends.length ? parsed.labTrends : deterministic.labTrends,
            medicationSummary: Array.isArray(parsed.medicationSummary) && parsed.medicationSummary.length ? parsed.medicationSummary : deterministic.medicationSummary,
            careGaps: Array.isArray(parsed.careGaps) && parsed.careGaps.length ? parsed.careGaps : deterministic.careGaps,
            dischargePacket: parsed.dischargePacket || deterministic.dischargePacket,
            aiPowered: true,
            generatedAt: deterministic.generatedAt,
          } satisfies PatientClinicalBrief,
        });
      } catch {
        /* fallback to deterministic */
      }
    }
  }

  return NextResponse.json({ ok: true, brief: deterministic });
}
