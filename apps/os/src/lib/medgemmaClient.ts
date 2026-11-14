/**
 * MedGemma integration layer (Google Health AI Developer Foundations).
 * - Prefer NEXT_PUBLIC_MEDGEMMA_API_URL (Vertex / self-hosted MedGemma proxy)
 * - Fallback: Gemini multimodal with medical system prompt (labelled as assist, not clinical-grade)
 * Orthanc/PACS remains source of truth for pixels; this only drafts assist text.
 */
// MedGemma integration layer (Google Health AI Developer Foundations).

export type MedGemmaModality = 'XR' | 'CT' | 'MRI' | 'US' | 'WSI' | 'OTHER';

export interface MedGemmaImageInput {
  /** data URL or raw base64 */
  imageBase64?: string;
  mimeType?: string;
  /** Orthanc study/series URL for operator reference */
  orthancUrl?: string;
  studyDescription?: string;
}

export interface MedGemmaRequest {
  task: 'image_report_draft' | 'image_qa' | 'clinical_text' | 'ehr_extract';
  modality?: MedGemmaModality;
  clinicalContext?: string;
  question?: string;
  text?: string;
  studyDescription?: string;
  image?: MedGemmaImageInput;
  facilityId?: string;
}

export interface MedGemmaResult {
  ok: boolean;
  text: string;
  provider: 'medgemma' | 'gemini-fallback' | 'none';
  model?: string;
  disclaimer: string;
  latencyMs?: number;
}

const DISCLAIMER =
  'AI assist only — not clinical-grade. Radiologist/clinician must review and sign. MedGemma/Gemini outputs are decision support, not a diagnosis.';

function envMedgemmaUrl(): string {
  try {
    return (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_MEDGEMMA_API_URL?.trim()) || '';
  } catch {
    return '';
  }
}

export function hasMedGemmaEndpoint(): boolean {
  return Boolean(envMedgemmaUrl());
}

export function hasImagingAiAssist(): boolean {
  // Gemini fallback always available via server-side /api/gemini proxy
  return hasMedGemmaEndpoint() || true;
}

function stripDataUrl(b64: string): { data: string; mime: string } {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(b64);
  if (m) return { mime: m[1], data: m[2] };
  return { mime: 'image/jpeg', data: b64.replace(/\s/g, '') };
}

function buildPrompt(req: MedGemmaRequest): string {
  const parts = [
    `Task: ${req.task}`,
    req.modality ? `Modality: ${req.modality}` : '',
    req.studyDescription || req.image?.studyDescription
      ? `Study: ${req.studyDescription || req.image?.studyDescription}`
      : '',
    req.clinicalContext ? `Clinical context: ${req.clinicalContext}` : '',
    req.question ? `Question: ${req.question}` : '',
    req.text ? `Text:\n${req.text}` : '',
    req.image?.orthancUrl ? `PACS/Orthanc ref: ${req.image.orthancUrl}` : '',
    '',
    'Respond with structured findings suitable for a radiology draft report.',
    'Use sections: Technique (brief), Findings, Impression.',
    'If image is missing, reason from clinical context only and state limitations.',
    'Do not claim certainty. Flag urgent findings clearly.',
  ];
  return parts.filter(Boolean).join('\n');
}

/** Call self-hosted / Vertex MedGemma-compatible HTTP API */
async function callMedGemmaEndpoint(req: MedGemmaRequest): Promise<MedGemmaResult> {
  const url = envMedgemmaUrl();
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    task: req.task,
    modality: req.modality,
    prompt: buildPrompt(req),
    clinical_context: req.clinicalContext,
    question: req.question,
    text: req.text,
  };
  if (req.image?.imageBase64) {
    const { data, mime } = stripDataUrl(req.image.imageBase64);
    body.image = { base64: data, mime_type: req.image.mimeType || mime };
  }
  if (req.image?.orthancUrl) body.orthanc_url = req.image.orthancUrl;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    return {
      ok: false,
      provider: 'medgemma',
      text: `MedGemma endpoint error (${res.status}): ${err.slice(0, 240)}`,
      disclaimer: DISCLAIMER,
      latencyMs: Date.now() - t0,
    };
  }
  const json = await res.json();
  const text =
    json?.text ||
    json?.output ||
    json?.candidates?.[0]?.content ||
    json?.response ||
    '';
  return {
    ok: Boolean(String(text).trim()),
    provider: 'medgemma',
    model: json?.model || 'medgemma',
    text: String(text).trim() || 'Empty MedGemma response',
    disclaimer: DISCLAIMER,
    latencyMs: Date.now() - t0,
  };
}

/** Gemini multimodal fallback — routed through /api/gemini server proxy (key never reaches browser) */
async function callGeminiMedicalFallback(req: MedGemmaRequest): Promise<MedGemmaResult> {
  const t0 = Date.now();
  try {
    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
      {
        text:
          'You are a medical imaging assist model (MedGemma-compatible role). ' +
          DISCLAIMER +
          '\n\n' +
          buildPrompt(req),
      },
    ];

    if (req.image?.imageBase64) {
      const { data, mime } = stripDataUrl(req.image.imageBase64);
      parts.push({ inline_data: { mime_type: req.image.mimeType || mime, data } });
    }

    // POST to the server-side Gemini proxy — secret key stays on server
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: buildPrompt(req),
        contents: [{ role: 'user', parts }],
        facilityId: req.facilityId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        ok: false,
        provider: 'gemini-fallback',
        text: `Gemini medical fallback error (${res.status}): ${err.slice(0, 200)}`,
        disclaimer: DISCLAIMER,
        latencyMs: Date.now() - t0,
      };
    }

    const json = await res.json();
    const text =
      json?.text ||
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ||
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

    return {
      ok: Boolean(String(text).trim()),
      provider: 'gemini-fallback',
      model: json?.model || 'gemini',
      text: String(text).trim() || 'Empty Gemini response',
      disclaimer: DISCLAIMER,
      latencyMs: Date.now() - t0,
    };
  } catch (e: any) {
    return {
      ok: false,
      provider: 'gemini-fallback',
      text: `Gemini proxy error: ${e?.message || 'Network error'}`,
      disclaimer: DISCLAIMER,
      latencyMs: Date.now() - t0,
    };
  }
}
export async function medgemmaGenerate(req: MedGemmaRequest): Promise<MedGemmaResult> {
  if (hasMedGemmaEndpoint()) {
    try {
      const primary = await callMedGemmaEndpoint(req);
      if (primary.ok) return primary;
      // soft fallback
      const fb = await callGeminiMedicalFallback(req);
      if (fb.ok) {
        return {
          ...fb,
          text: `${fb.text}\n\n(Note: MedGemma endpoint failed; used Gemini fallback.)`,
        };
      }
      return primary;
    } catch (e) {
      const fb = await callGeminiMedicalFallback(req);
      if (fb.ok) return fb;
      return {
        ok: false,
        provider: 'medgemma',
        text: `MedGemma network error: ${(e as Error)?.message || 'failed'}`,
        disclaimer: DISCLAIMER,
      };
    }
  }
  return callGeminiMedicalFallback(req);
}

export async function draftImagingReport(input: {
  modality: MedGemmaModality;
  studyName: string;
  clinicalContext?: string;
  imageBase64?: string;
  orthancUrl?: string;
}): Promise<MedGemmaResult> {
  return medgemmaGenerate({
    task: 'image_report_draft',
    modality: input.modality,
    clinicalContext: input.clinicalContext,
    studyDescription: input.studyName,
    image: {
      imageBase64: input.imageBase64,
      orthancUrl: input.orthancUrl,
      studyDescription: input.studyName,
    },
  });
}

export async function askAboutImage(input: {
  modality: MedGemmaModality;
  question: string;
  clinicalContext?: string;
  imageBase64?: string;
}): Promise<MedGemmaResult> {
  return medgemmaGenerate({
    task: 'image_qa',
    modality: input.modality,
    question: input.question,
    clinicalContext: input.clinicalContext,
    image: { imageBase64: input.imageBase64 },
  });
}
