import { NextResponse } from 'next/server';
import {
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';
import { evaluatePrescriptionSafetyGuard } from '../../../../lib/clinicalSafetyEngine';
import {
  digitizedRecordToFhirBundle,
  parsePaperRecordDeterministic,
  type DigitizedPaperRecord,
  type DigitizedRecordKind,
} from '../../../../lib/fhirStub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BASE64_BYTES = 10 * 1024 * 1024;

const DIGITIZE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    patientDemographics: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        hospitalNumber: { type: 'string' },
        dob: { type: 'string' },
        sex: { type: 'string', enum: ['Male', 'Female', 'Other'] },
        phone: { type: 'string' },
        lga: { type: 'string' },
        nhiaNumber: { type: 'string' },
        bloodGroup: { type: 'string' },
        genotype: { type: 'string' },
        allergies: { type: 'array', items: { type: 'string' } },
        chronicConditions: { type: 'array', items: { type: 'string' } },
      },
      required: ['firstName', 'lastName'],
    },
    labObservations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          testName: { type: 'string' },
          value: { type: 'string' },
          unit: { type: 'string' },
          referenceRange: { type: 'string' },
          flag: { type: 'string', enum: ['normal', 'high', 'low', 'critical'] },
        },
        required: ['testName', 'value'],
      },
    },
    ultrasoundFindings: {
      type: 'object',
      properties: {
        modality: { type: 'string' },
        studyDate: { type: 'string' },
        gestationalAgeWeeks: { type: 'number' },
        fetalHeartRateBpm: { type: 'number' },
        placentaPosition: { type: 'string' },
        organFindings: { type: 'array', items: { type: 'string' } },
        impression: { type: 'string' },
        criticalAlert: { type: 'string' },
      },
    },
    diagnoses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          icd11Code: { type: 'string' },
          display: { type: 'string' },
        },
        required: ['display'],
      },
    },
    medications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          frequency: { type: 'string' },
        },
        required: ['name'],
      },
    },
    clinicalSummary: { type: 'string' },
    panicAlerts: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['patientDemographics', 'labObservations', 'diagnoses', 'medications', 'clinicalSummary'],
};

function stripDataUrlPrefix(b64: string): string {
  const idx = b64.indexOf(',');
  return b64.startsWith('data:') && idx !== -1 ? b64.slice(idx + 1).trim() : b64.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      imageBase64?: string;
      mimeType?: string;
      textFallback?: string;
      recordKind?: DigitizedRecordKind;
      facilityId?: string;
      sourceLabel?: string;
    };

    const recordKind: DigitizedRecordKind = body.recordKind || 'mixed_chart';
    const facilityId = String(body.facilityId || 'FAC-ONBOARD').trim() || 'FAC-ONBOARD';
    const textFallback = typeof body.textFallback === 'string' ? body.textFallback.trim() : '';
    const cleanedBase64 =
      typeof body.imageBase64 === 'string' && body.imageBase64.trim()
        ? stripDataUrlPrefix(body.imageBase64)
        : '';

    if (!cleanedBase64 && !textFallback) {
      return NextResponse.json(
        { ok: false, error: 'Provide an image/PDF scan or raw chart text to digitize into HL7 FHIR.' },
        { status: 400 }
      );
    }

    if (cleanedBase64.length > MAX_BASE64_BYTES * 1.4) {
      return NextResponse.json(
        { ok: false, error: 'Scanned document exceeds the 10 MB upload limit.' },
        { status: 413 }
      );
    }

    let extraction: DigitizedPaperRecord | null = null;
    let mode: 'vision_ai' | 'deterministic_ocr' = 'deterministic_ocr';
    let modelUsed = 'deterministic-fhir-mapper';

    const { key } = resolveServerGeminiKey();
    if (key) {
      const mimeType = String(body.mimeType || 'image/jpeg').trim();
      const isPdf = mimeType.toLowerCase().includes('pdf');
      const inputParts: unknown[] = [
        {
          type: 'text',
          text: [
            `You are MedCore Clinical Record Digitization AI converting legacy Nigerian hospital paper records (${recordKind.replace(/_/g, ' ')}) into HL7 FHIR R4 structured fields.`,
            'Extract all legible demographics, handwritten lab values with units and reference ranges, ultrasound biometry/placenta/impression, diagnoses (with ICD-11 codes if obvious), and medications.',
            'Populate panicAlerts for any critical lab (Hb < 7, K >= 6.0 or <= 2.8, Platelets < 50, severe hyperglycaemia/hypoglycaemia, Creatinine >= 300 umol/L) or high-risk obstetric scan (placenta previa/abruption, ectopic, FHR < 110 or > 165 bpm).',
            'Never invent unreadable patient names or lab values — note illegible portions in warnings.',
            textFallback ? `\nAdditional OCR/Clerk Notes:\n${textFallback}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ];

      if (cleanedBase64) {
        inputParts.push(
          isPdf
            ? { type: 'document', data: cleanedBase64, mime_type: 'application/pdf' }
            : { type: 'image', data: cleanedBase64, mime_type: mimeType }
        );
      }

      const aiRes = await createGeminiInteraction({
        apiKey: key,
        models: ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'],
        input: inputParts,
        responseFormat: {
          type: 'text',
          mime_type: 'application/json',
          schema: DIGITIZE_RESPONSE_SCHEMA,
        },
        temperature: 0.1,
        maxOutputTokens: 2048,
      });

      if (aiRes.ok && aiRes.text) {
        try {
          const parsed = JSON.parse(aiRes.text) as Partial<DigitizedPaperRecord>;
          extraction = {
            recordKind,
            sourceLabel: body.sourceLabel,
            patientDemographics: {
              firstName: parsed.patientDemographics?.firstName || 'Legacy',
              lastName: parsed.patientDemographics?.lastName || 'Patient',
              hospitalNumber: parsed.patientDemographics?.hospitalNumber,
              dob: parsed.patientDemographics?.dob,
              sex: parsed.patientDemographics?.sex || 'Other',
              phone: parsed.patientDemographics?.phone,
              lga: parsed.patientDemographics?.lga,
              nhiaNumber: parsed.patientDemographics?.nhiaNumber,
              bloodGroup: parsed.patientDemographics?.bloodGroup,
              genotype: parsed.patientDemographics?.genotype,
              allergies: Array.isArray(parsed.patientDemographics?.allergies)
                ? parsed.patientDemographics.allergies
                : [],
              chronicConditions: Array.isArray(parsed.patientDemographics?.chronicConditions)
                ? parsed.patientDemographics.chronicConditions
                : [],
            },
            labObservations: Array.isArray(parsed.labObservations) ? parsed.labObservations : [],
            ultrasoundFindings: parsed.ultrasoundFindings || null,
            diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [],
            medications: Array.isArray(parsed.medications) ? parsed.medications : [],
            clinicalSummary: parsed.clinicalSummary || 'Vision-digitized clinical record.',
            panicAlerts: Array.isArray(parsed.panicAlerts) ? parsed.panicAlerts : [],
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          };
          mode = 'vision_ai';
          modelUsed = aiRes.model;
        } catch {
          // fall through to deterministic parser
        }
      }
    }

    if (!extraction) {
      const seedText =
        textFallback ||
        `Name: Scanned Document\nNotes: Binary scan uploaded (${body.mimeType || 'image'}) — paste readable text or configure server AI vision key for full handwriting OCR.`;
      extraction = {
        ...parsePaperRecordDeterministic(seedText, recordKind),
        sourceLabel: body.sourceLabel,
      };
    }

    const prescriptionSafety =
      extraction.medications.length > 0
        ? evaluatePrescriptionSafetyGuard({
            drugName: extraction.medications.map((m) => m.name).join(', '),
            allergies: extraction.patientDemographics.allergies || [],
            chronicConditions: extraction.patientDemographics.chronicConditions || [],
            isPregnant: /pregnan|anc|gestational|obstetric|fhr|placenta/i.test(
              `${textFallback} ${extraction.clinicalSummary}`
            ),
          })
        : null;

    const fhirBundle = digitizedRecordToFhirBundle(extraction, facilityId);

    return NextResponse.json({
      ok: true,
      mode,
      model: modelUsed,
      extraction,
      prescriptionSafety,
      fhirBundle,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Failed to digitize paper record into FHIR.' },
      { status: 500 }
    );
  }
}
