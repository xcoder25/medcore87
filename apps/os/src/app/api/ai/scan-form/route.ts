import { NextRequest, NextResponse } from 'next/server';
import {
  CURRENT_CHAT_MODELS,
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a hospital medical records digitization engine in Nigeria.
Examine the uploaded image of a physical hospital patient registration form or card (handwritten or printed).
Return ONLY valid JSON matching these keys (omit or use empty string "" when illegible or absent, normalize Nigerian phone numbers as written, normalize sex to "M", "F", or "Other", normalize DOB to YYYY-MM-DD when possible):
{
  "firstName": "",
  "middleName": "",
  "lastName": "",
  "dob": "",
  "ageYears": "",
  "sex": "",
  "phone": "",
  "altPhone": "",
  "email": "",
  "nin": "",
  "lga": "",
  "ward": "",
  "address": "",
  "bloodGroup": "",
  "genotype": "",
  "maritalStatus": "",
  "occupation": "",
  "religion": "",
  "nextOfKinName": "",
  "nextOfKinRel": "",
  "nextOfKinPhone": "",
  "insuranceProvider": "",
  "nhiaNumber": "",
  "allergies": "",
  "chronicConditions": "",
  "currentMedications": "",
  "confidence": 0.0,
  "notes": ""
}
If a full name is written on one line (e.g. "Ukeme Iniobong Bassey"), split into firstName, middleName, lastName carefully.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      imageBase64?: string;
      mimeType?: string;
    };
    const rawBase64 = String(body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    const mimeType = String(body.mimeType || 'image/jpeg').trim() || 'image/jpeg';

    if (!rawBase64) {
      return NextResponse.json({ ok: false, error: 'Image payload is required.' }, { status: 400 });
    }
    if (rawBase64.length > 11_000_000) {
      return NextResponse.json(
        { ok: false, error: 'Image exceeds 8MB limit. Crop or retake closer to the form.' },
        { status: 413 }
      );
    }

    const { key } = resolveServerGeminiKey();
    if (!key) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Clinical Vision AI service is not configured on this server. Contact Hospital Administrator.',
        },
        { status: 503 }
      );
    }

    const contentBlock =
      mimeType === 'application/pdf'
        ? { type: 'document', data: rawBase64, mime_type: mimeType }
        : { type: 'image', data: rawBase64, mime_type: mimeType };

    const res = await createGeminiInteraction({
      apiKey: key,
      models: [CURRENT_CHAT_MODELS[0], CURRENT_CHAT_MODELS[2]],
      systemInstruction: SYSTEM_PROMPT,
      input: [
        { type: 'text', text: 'Extract patient registration fields as strict JSON.' },
        contentBlock,
      ],
      temperature: 0.1,
      maxOutputTokens: 1200,
    });

    if (res.ok && res.text) {
      try {
        const cleaned = res.text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        return NextResponse.json({
          ok: true,
          fields: parsed,
          modelUsed: res.model,
        });
      } catch {
        /* fall through */
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Unable to extract legible fields from this photo. Ensure bright light and clear focus.' },
      { status: 422 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Form scan request failed.' },
      { status: 500 }
    );
  }
}
