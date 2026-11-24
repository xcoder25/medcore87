import { NextRequest, NextResponse } from 'next/server';
import {
  CURRENT_TRANSCRIBE_MODELS,
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const { key } = resolveServerGeminiKey();
    if (!key) {
      return NextResponse.json(
        { ok: false, error: 'Voice transcription service not configured on server.' },
        { status: 503 }
      );
    }

    const instruction = [
      `Transcribe the user's spoken clinical/hospital EMR audio accurately in plain text (verbatim transcript only, no quotes or commentary).`,
      `Speaker role context: ${roleHint}.`,
      `Accurately recognize Nigerian English, Nigerian Pidgin, Ibibio/Annang/Oron accents, Akwa Ibom places/LGAs (Uyo, Eket, Ikot Ekpene, Oron, Ibeno, Itu, Etinan, Abak), Nigerian drugs (Artemether-Lumefantrine, Coartem, Paracetamol, Amoxicillin, Augmentin, Ciprofloxacin, Metformin, Amlodipine, MgSO4, ORS, Zinc), vitals (mmHg, SpO2, bpm, °C, NEWS2, qSOFA), AkwaRemit RRR/ARN, SHID, NHIA, HFR, and MedCore commands.`,
    ].join(' ');

    const res = await createGeminiInteraction({
      apiKey: key,
      models: CURRENT_TRANSCRIBE_MODELS,
      input: [
        { type: 'text', text: instruction },
        { type: 'audio', data: rawBase64, mime_type: mimeType },
      ],
      temperature: 0.05,
      maxOutputTokens: 1024,
    });

    if (res.ok && res.text.trim()) {
      return NextResponse.json({
        ok: true,
        transcript: res.text.trim(),
        modelUsed: res.model,
      });
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
