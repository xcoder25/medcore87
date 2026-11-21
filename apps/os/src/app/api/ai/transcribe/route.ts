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

const AUDIO_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      audioBase64?: string;
      mimeType?: string;
      roleHint?: string;
    };
    const rawBase64 = String(body.audioBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    const mimeType = String(body.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
    const roleHint = String(body.roleHint || 'clinician').trim();

    if (!rawBase64) {
      return NextResponse.json({ ok: false, error: 'Audio payload is required.' }, { status: 400 });
    }
    if (rawBase64.length > 10_000_000) {
      return NextResponse.json({ ok: false, error: 'Audio recording exceeds size limit.' }, { status: 413 });
    }

    const key = getEnvGeminiKey();
    if (!key) {
      return NextResponse.json(
        { ok: false, error: 'Voice transcription service not configured on server.' },
        { status: 503 }
      );
    }

    const instruction = [
      `Transcribe the user's spoken clinical/hospital EMR request accurately in plain text (verbatim transcript only, no quotes or commentary).`,
      `Speaker role context: ${roleHint}.`,
      `Accurately recognize Nigerian names, Akwa Ibom places/LGAs (Uyo, Eket, Ikot Ekpene, Oron, Ibeno, Itu, Etinan, Abak), Nigerian drugs (Artemether-Lumefantrine, Coartem, Paracetamol, Amoxicillin, Ciprofloxacin, Metformin, Amlodipine, ORS, Zinc), vitals (mmHg, SpO2, bpm, °C), AkwaRemit RRR/ARN, SHID, NHIA, HFR, and MedCore commands.`,
    ].join(' ');

    for (const model of AUDIO_MODELS) {
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
                    { text: instruction },
                    { inlineData: { mimeType, data: rawBase64 } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.05,
              },
            }),
          }
        );
        if (!res.ok) continue;
        const json = (await res.json().catch(() => null)) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        } | null;
        const transcript =
          json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ').trim() || '';
        if (transcript) {
          return NextResponse.json({ ok: true, transcript, modelUsed: model });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Unable to transcribe audio clearly. Speak closer to the microphone.' },
      { status: 422 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Voice transcription request failed.' },
      { status: 500 }
    );
  }
}
