import { NextRequest, NextResponse } from 'next/server';
import {
  evaluatePrescriptionSafetyGuard,
  type PrescriptionSafetyReport,
} from '../../../../lib/clinicalSafetyEngine';
import {
  CURRENT_CHAT_MODELS,
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ClinicalVisionDocumentType =
  | 'lab_report'
  | 'referral_letter'
  | 'prescription'
  | 'ecg_radiology';

export interface VisionLabEntry {
  testName: string;
  value: string;
  unit: string;
  flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL';
}

export interface VisionMedEntry {
  name: string;
  dosage: string;
  frequency: string;
  safetyReport?: PrescriptionSafetyReport;
}

export interface VisionClinicalExtraction {
  documentType: ClinicalVisionDocumentType;
  documentSummary: string;
  extractedLabValues: VisionLabEntry[];
  extractedMedications: VisionMedEntry[];
  extractedDiagnoses: string[];
  recommendedNextSteps: string[];
  panicFlags: string[];
  confidence: number;
  provider: 'clinical-ai' | 'local-fallback';
  modelUsed?: string;
  clinicianDisclaimer: string;
}

const CLINICIAN_DISCLAIMER =
  'AI-extracted clinical observations require clinician verification prior to chart sign-off.';

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    documentSummary: { type: 'string' },
    extractedLabValues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          testName: { type: 'string' },
          value: { type: 'string' },
          unit: { type: 'string' },
          flag: { type: 'string', enum: ['NORMAL', 'ABNORMAL', 'CRITICAL'] },
        },
        required: ['testName', 'value', 'unit', 'flag'],
      },
    },
    extractedMedications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          frequency: { type: 'string' },
        },
        required: ['name', 'dosage', 'frequency'],
      },
    },
    extractedDiagnoses: { type: 'array', items: { type: 'string' } },
    recommendedNextSteps: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
  required: [
    'documentSummary',
    'extractedLabValues',
    'extractedMedications',
    'extractedDiagnoses',
    'recommendedNextSteps',
    'confidence',
  ],
};

function detectLabFlag(testName: string, valueStr: string): 'NORMAL' | 'ABNORMAL' | 'CRITICAL' {
  const num = Number(String(valueStr).replace(/[^0-9.]/g, ''));
  const t = testName.toLowerCase();
  if (/hb|haemoglobin|hemoglobin/i.test(t) && Number.isFinite(num) && num > 0) {
    if (num < 7) return 'CRITICAL';
    if (num < 11) return 'ABNORMAL';
  }
  if (/creatinine|\bcr\b/i.test(t) && Number.isFinite(num) && num > 0) {
    if (num >= 3.0) return 'CRITICAL';
    if (num >= 1.5) return 'ABNORMAL';
  }
  if (/egfr/i.test(t) && Number.isFinite(num) && num > 0) {
    if (num < 30) return 'CRITICAL';
    if (num < 60) return 'ABNORMAL';
  }
  if (/potassium|\bk\+?\b/i.test(t) && Number.isFinite(num) && num > 0) {
    if (num >= 6.0 || num <= 2.5) return 'CRITICAL';
    if (num > 5.2 || num < 3.4) return 'ABNORMAL';
  }
  if (/glucose|rbs|fbs/i.test(t) && Number.isFinite(num) && num > 0) {
    if (num < 3.0 || num > 20) return 'CRITICAL';
  }
  if (/platelet|plt/i.test(t) && Number.isFinite(num) && num > 0) {
    if (num < 50) return 'CRITICAL';
    if (num < 150) return 'ABNORMAL';
  }
  if (/malaria|\bmp\b/i.test(t) && /\+\+\+|positive|trophozoite/i.test(valueStr)) {
    return /\+\+\+|heavy|severe/i.test(valueStr) ? 'CRITICAL' : 'ABNORMAL';
  }
  return 'NORMAL';
}

function deterministicParseClinicalText(
  textFallback: string,
  documentType: ClinicalVisionDocumentType
): Omit<VisionClinicalExtraction, 'panicFlags' | 'clinicianDisclaimer'> {
  const text = textFallback.trim();
  const labs: VisionLabEntry[] = [];
  const meds: VisionMedEntry[] = [];
  const diagnoses: string[] = [];

  const labPatterns: Array<{ name: string; re: RegExp; unit: string }> = [
    { name: 'Haemoglobin (Hb)', re: /(?:hb|haemoglobin|hemoglobin)\s*[:=]?\s*(\d+(?:\.\d+)?)/i, unit: 'g/dL' },
    { name: 'Creatinine', re: /(?:creatinine|creat)\s*[:=]?\s*(\d+(?:\.\d+)?)/i, unit: 'mg/dL' },
    { name: 'eGFR', re: /egfr\s*[:=]?\s*(\d+(?:\.\d+)?)/i, unit: 'mL/min/1.73m²' },
    { name: 'Potassium (K+)', re: /(?:potassium|\bk\+?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i, unit: 'mmol/L' },
    { name: 'Glucose', re: /(?:glucose|rbs|fbs)\s*[:=]?\s*(\d+(?:\.\d+)?)/i, unit: 'mmol/L' },
    { name: 'Platelets', re: /(?:platelets|plt)\s*[:=]?\s*(\d+(?:\.\d+)?)/i, unit: 'x10⁹/L' },
    { name: 'Malaria Parasite', re: /(?:malaria|\bmp\b)\s*[:=]?\s*(\+\+\+|\+\+|\+|positive|negative)/i, unit: 'Film/RDT' },
  ];

  for (const p of labPatterns) {
    const m = p.re.exec(text);
    if (m?.[1]) {
      labs.push({
        testName: p.name,
        value: m[1],
        unit: p.unit,
        flag: detectLabFlag(p.name, m[1]),
      });
    }
  }

  const drugPatterns = [
    /amoxicillin(?:\s*\d+\s*mg)?/gi,
    /augmentin(?:\s*\d+\s*mg)?/gi,
    /artemether[\s-]*lumefantrine(?:\s*\d+\/\d+\s*mg)?/gi,
    /ciprofloxacin(?:\s*\d+\s*mg)?/gi,
    /metformin(?:\s*\d+\s*mg)?/gi,
    /ibuprofen(?:\s*\d+\s*mg)?/gi,
    /diclofenac(?:\s*\d+\s*mg)?/gi,
    /paracetamol(?:\s*\d+\s*mg)?/gi,
    /ceftriaxone(?:\s*\d+\s*g)?/gi,
    /doxycycline(?:\s*\d+\s*mg)?/gi,
    /warfarin(?:\s*\d+\s*mg)?/gi,
  ];
  const seenMed = new Set<string>();
  for (const dp of drugPatterns) {
    for (const m of text.matchAll(dp)) {
      const label = m[0].trim();
      const k = label.toLowerCase();
      if (!seenMed.has(k)) {
        seenMed.add(k);
        meds.push({ name: label, dosage: label.match(/\d+\s*(?:mg|g|ml)/i)?.[0] || 'As written', frequency: 'Verify script' });
      }
    }
  }

  if (/malaria/i.test(text)) diagnoses.push('Suspected Malaria');
  if (/hypertension|htn/i.test(text)) diagnoses.push('Hypertension');
  if (/pre-eclampsia|eclampsia/i.test(text)) diagnoses.push('Pre-Eclampsia / Obstetric Hypertension');
  if (/anaemia|anemia|hb\s*[:=]?\s*[1-6]\./i.test(text)) diagnoses.push('Severe Anaemia');
  if (/aki|renal|creatinine\s*[:=]?\s*[3-9]/i.test(text)) diagnoses.push('Acute Kidney Injury / Renal Impairment');

  return {
    documentType,
    documentSummary: text
      ? `Parsed ${documentType.replace(/_/g, ' ')}: ${labs.length} lab value(s) and ${meds.length} medication(s) identified.`
      : 'No legible clinical findings extracted.',
    extractedLabValues: labs,
    extractedMedications: meds,
    extractedDiagnoses: diagnoses,
    recommendedNextSteps: [
      'Verify extracted numbers against original document before signing.',
      ...(labs.some((l) => l.flag === 'CRITICAL') ? ['Escalate CRITICAL panic values immediately to attending physician.'] : []),
    ],
    confidence: text ? 0.78 : 0.2,
    provider: 'local-fallback',
  };
}

export async function POST(req: NextRequest) {
  let body: {
    imageBase64?: string;
    mimeType?: string;
    textFallback?: string;
    documentType?: ClinicalVisionDocumentType;
    patientContext?: {
      allergies?: string[];
      otherDrugs?: string[];
      dob?: string;
      sex?: string;
      isPregnant?: boolean;
      chronicConditions?: string[];
      genotype?: string;
      egfr?: number;
      creatinineMgDl?: number;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const documentType: ClinicalVisionDocumentType =
    body.documentType && ['lab_report', 'referral_letter', 'prescription', 'ecg_radiology'].includes(body.documentType)
      ? body.documentType
      : 'lab_report';
  const rawBase64 = String(body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
  const mimeType = String(body.mimeType || 'image/jpeg').trim() || 'image/jpeg';
  const textFallback = String(body.textFallback || '').trim();

  if (!rawBase64 && !textFallback) {
    return NextResponse.json(
      { ok: false, error: 'Provide either a clinical document photo/PDF or pasted text.' },
      { status: 400 }
    );
  }
  if (rawBase64.length > 11_000_000) {
    return NextResponse.json({ ok: false, error: 'Document exceeds 8MB limit.' }, { status: 413 });
  }

  let base: Omit<VisionClinicalExtraction, 'panicFlags' | 'clinicianDisclaimer'> | null = null;
  const { key } = resolveServerGeminiKey();

  if (key && rawBase64) {
    const contentBlock =
      mimeType === 'application/pdf'
        ? { type: 'document', data: rawBase64, mime_type: mimeType }
        : { type: 'image', data: rawBase64, mime_type: mimeType };

    const aiRes = await createGeminiInteraction({
      apiKey: key,
      models: [CURRENT_CHAT_MODELS[0], CURRENT_CHAT_MODELS[2]],
      systemInstruction:
        'You are MedCore Multimodal Clinical Document Reader for Nigerian clinicians. Read paper lab printouts, referral notes, handwritten prescriptions, or ECG/imaging summaries conservatively. Never hallucinate numbers not visible.',
      input: [
        {
          type: 'text',
          text: `Analyze this ${documentType.replace(/_/g, ' ')}${textFallback ? `. Clinician note/OCR hint: ${textFallback}` : ''}. Return strict JSON.`,
        },
        contentBlock,
      ],
      responseFormat: {
        type: 'text',
        mime_type: 'application/json',
        schema: VISION_SCHEMA,
      },
      temperature: 0.1,
      maxOutputTokens: 1300,
    });

    if (aiRes.ok && aiRes.text) {
      try {
        const parsed = JSON.parse(aiRes.text) as {
          documentSummary?: string;
          extractedLabValues?: VisionLabEntry[];
          extractedMedications?: VisionMedEntry[];
          extractedDiagnoses?: string[];
          recommendedNextSteps?: string[];
          confidence?: number;
        };
        base = {
          documentType,
          documentSummary: String(parsed.documentSummary || '').trim(),
          extractedLabValues: Array.isArray(parsed.extractedLabValues)
            ? parsed.extractedLabValues.map((l) => ({
                ...l,
                flag:
                  detectLabFlag(l.testName, l.value) === 'CRITICAL'
                    ? 'CRITICAL'
                    : l.flag || detectLabFlag(l.testName, l.value),
              }))
            : [],
          extractedMedications: Array.isArray(parsed.extractedMedications) ? parsed.extractedMedications : [],
          extractedDiagnoses: Array.isArray(parsed.extractedDiagnoses) ? parsed.extractedDiagnoses : [],
          recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps) ? parsed.recommendedNextSteps : [],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
          provider: 'clinical-ai',
          modelUsed: aiRes.model,
        };
      } catch {
        base = null;
      }
    }
  }

  if (!base) {
    if (!textFallback && !key) {
      return NextResponse.json(
        { ok: false, error: 'Clinical Vision AI key not configured and no text fallback provided.' },
        { status: 503 }
      );
    }
    base = deterministicParseClinicalText(textFallback, documentType);
  }

  // Extract renal markers from scanned labs too so drug safety check uses them!
  const ctx = { ...(body.patientContext || {}) };
  for (const lab of base.extractedLabValues) {
    const val = Number(String(lab.value).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(val)) continue;
    if (/creatinine/i.test(lab.testName) && ctx.creatinineMgDl === undefined) ctx.creatinineMgDl = val;
    if (/egfr/i.test(lab.testName) && ctx.egfr === undefined) ctx.egfr = val;
  }

  const panicFlags = base.extractedLabValues
    .filter((l) => l.flag === 'CRITICAL')
    .map((l) => `CRITICAL LAB: ${l.testName} = ${l.value} ${l.unit}`.trim());

  const auditedMeds: VisionMedEntry[] = base.extractedMedications.map((m) => ({
    ...m,
    safetyReport: evaluatePrescriptionSafetyGuard({
      drugName: `${m.name} ${m.dosage !== 'As written' ? m.dosage : ''}`.trim(),
      notes: m.frequency,
      allergies: ctx.allergies,
      otherDrugs: ctx.otherDrugs,
      dob: ctx.dob,
      sex: ctx.sex,
      isPregnant: ctx.isPregnant,
      chronicConditions: ctx.chronicConditions,
      genotype: ctx.genotype,
      egfr: ctx.egfr,
      creatinineMgDl: ctx.creatinineMgDl,
    }),
  }));

  const extraction: VisionClinicalExtraction = {
    ...base,
    extractedMedications: auditedMeds,
    panicFlags,
    clinicianDisclaimer: CLINICIAN_DISCLAIMER,
  };

  return NextResponse.json({ ok: true, extraction });
}
