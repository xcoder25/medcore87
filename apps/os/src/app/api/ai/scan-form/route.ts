import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_ENV_NAMES = [
  'GEMINI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_KEY',
  'AI_GOOGLE_API_KEY',
] as const;

function cleanKey(raw: string | undefined | null): string {
  let k = String(raw || '').trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith('bearer ')) k = k.slice(7).trim();
  return k;
}

function getEnvGeminiKey(): string {
  const env = process.env as Record<string, string | undefined>;
  for (const name of GEMINI_ENV_NAMES) {
    const k = cleanKey(env[name]);
    if (k) return k;
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith('NEXT_PUBLIC_')) continue;
    if (!/GEMINI/i.test(name)) continue;
    if (!/KEY|API/i.test(name)) continue;
    const k = cleanKey(env[name]);
    if (k) return k;
  }
  return '';
}

const VISION_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

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
    const mimeType = String(body.mimeType || 'image/jpeg').trim();

    if (!rawBase64) {
      return NextResponse.json({ ok: false, error: 'Image payload is required.' }, { status: 400 });
    }
    // ~8MB binary cap (~11M base64 chars)
    if (rawBase64.length > 11_000_000) {
      return NextResponse.json(
        { ok: false, error: 'Image exceeds 8MB limit. Crop or retake closer to the form.' },
        { status: 413 }
      );
    }

    const key = getEnvGeminiKey();
    if (!key) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Clinical Vision AI service is not configured on this server. Contact Hospital Administrator.',
        },
        { status: 503 }
      );
    }

    for (const model of VISION_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: SYSTEM_PROMPT },
                    { inlineData: { mimeType, data: rawBase64 } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (!res.ok) continue;
        const json = (await res.json().catch(() => null)) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        } | null;
        const rawText =
          json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        if (!rawText) continue;

        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        return NextResponse.json({
          ok: true,
          fields: parsed,
          modelUsed: model,
        });
      } catch {
        continue;
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Could not extract readable registration fields from this form photo.' },
      { status: 422 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unexpected error while scanning paper registration form.' },
      { status: 500 }
    );
  }
}
