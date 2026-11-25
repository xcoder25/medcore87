import { NextResponse } from 'next/server';
import {
  CURRENT_CHAT_MODELS,
  CURRENT_TRANSCRIBE_MODELS,
  createGeminiInteraction,
  resolveServerGeminiKey,
} from '../../../../lib/geminiServer';
import {
  runPatientTriageBot,
  type TriageBotLanguage,
  type TriageBotPatientContext,
} from '../../../../lib/patientTriageBotEngine';
import { recordAppointmentFromCarePortal } from '../../../../lib/careReminderScheduler';
import { publishFacilitySseEvent } from '../../../../lib/sseBroker';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function stripDataUrlPrefix(b64: string): string {
  const idx = b64.indexOf(',');
  return b64.startsWith('data:') && idx !== -1 ? b64.slice(idx + 1).trim() : b64.trim();
}

async function transcribeVoiceAudio(
  audioBase64: string,
  mimeType: string,
  languageHint?: TriageBotLanguage
): Promise<string> {
  const { key } = resolveServerGeminiKey();
  if (!key || !audioBase64) return '';

  const res = await createGeminiInteraction({
    apiKey: key,
    models: CURRENT_TRANSCRIBE_MODELS,
    input: [
      {
        type: 'text',
        text: `Transcribe this patient healthcare voice note accurately into text. Language may be ${languageHint || 'English, Nigerian Pidgin, Ibibio, Annang, or Oron'}. Return ONLY the transcript text.`,
      },
      {
        type: 'audio',
        data: stripDataUrlPrefix(audioBase64),
        mime_type: mimeType || 'audio/webm',
      },
    ],
    temperature: 0.1,
    maxOutputTokens: 512,
  });

  return res.ok ? res.text.trim() : '';
}

async function fetchMetaMediaBase64(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !mediaId) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return null;
    const metaJson = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!metaJson.url) return null;
    const binRes = await fetch(metaJson.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!binRes.ok) return null;
    const buf = Buffer.from(await binRes.arrayBuffer());
    return {
      base64: buf.toString('base64'),
      mimeType: metaJson.mime_type || 'audio/ogg',
    };
  } catch {
    return null;
  }
}

async function sendMetaWhatsAppText(to: string, bodyText: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId || !to) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: bodyText.slice(0, 4000) },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || 'medcore_aks_whatsapp_verify';

  if (mode === 'subscribe' && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      ok: true,
      service: 'MedCore Voice-Enabled WhatsApp & In-App Triage Gateway',
      models: { chat: CURRENT_CHAT_MODELS, transcribe: CURRENT_TRANSCRIBE_MODELS },
    },
    { status: mode ? 403 : 200, headers: CORS_HEADERS }
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // 1. Meta WhatsApp Cloud API Webhook Format
    if (body.object === 'whatsapp_business_account' || Array.isArray(body.entry)) {
      const entries = Array.isArray(body.entry) ? (body.entry as Array<Record<string, unknown>>) : [];
      const results: Array<{ from: string; transcript?: string; replyText: string; dispatched: boolean }> = [];

      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? (entry.changes as Array<Record<string, unknown>>) : [];
        for (const ch of changes) {
          const val = (ch.value || {}) as Record<string, unknown>;
          const msgs = Array.isArray(val.messages) ? (val.messages as Array<Record<string, unknown>>) : [];
          for (const msg of msgs) {
            const from = String(msg.from || '');
            let msgText = '';
            let transcript = '';

            if (msg.type === 'text' && msg.text && typeof msg.text === 'object') {
              msgText = String((msg.text as Record<string, unknown>).body || '');
            } else if (msg.type === 'audio' && msg.audio && typeof msg.audio === 'object') {
              const mediaId = String((msg.audio as Record<string, unknown>).id || '');
              const inlineB64 = String((msg.audio as Record<string, unknown>).base64 || '');
              if (inlineB64) {
                transcript = await transcribeVoiceAudio(inlineB64, 'audio/ogg');
              } else if (mediaId) {
                const downloaded = await fetchMetaMediaBase64(mediaId);
                if (downloaded) {
                  transcript = await transcribeVoiceAudio(downloaded.base64, downloaded.mimeType);
                }
              }
              msgText = transcript || 'Voice note received on WhatsApp';
            }

            if (!msgText) continue;
            const triage = runPatientTriageBot({
              text: msgText,
              patient: { phone: from },
            });
            const dispatched = await sendMetaWhatsAppText(from, triage.replyText);
            results.push({
              from,
              transcript: transcript || undefined,
              replyText: triage.replyText,
              dispatched,
            });
          }
        }
      }

      return NextResponse.json(
        { ok: true, channel: 'whatsapp_webhook', processed: results.length, results },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Direct In-App Mobile (apps/care) or EMR Simulator Request
    const textInput = typeof body.text === 'string' ? body.text.trim() : '';
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'audio/webm';
    const language = (typeof body.language === 'string' ? body.language : undefined) as TriageBotLanguage | undefined;
    const patient = (body.patient && typeof body.patient === 'object' ? body.patient : undefined) as
      | TriageBotPatientContext
      | undefined;

    let transcript = '';
    if (audioBase64) {
      transcript = await transcribeVoiceAudio(audioBase64, mimeType, language);
    }

    const effectiveText = transcript || textInput;
    if (!effectiveText) {
      return NextResponse.json(
        {
          ok: false,
          error: audioBase64
            ? 'Voice transcription unavailable without live AI key — please type your message or enable Web Speech.'
            : 'Provide a message or voice note.',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const triage = runPatientTriageBot({
      text: effectiveText,
      language,
      patient,
    });

    if (triage.appointmentDraft) {
      try {
        const facId = /eket|immanuel/i.test(triage.appointmentDraft.facilityName)
          ? 'IGH-EKT'
          : /ibom/i.test(triage.appointmentDraft.facilityName)
            ? 'ISH-UYO'
            : 'UUTH-UYO';
        const booking = recordAppointmentFromCarePortal({
          bookingRef: triage.appointmentDraft.bookingRef,
          facilityId: facId,
          facilityName: triage.appointmentDraft.facilityName,
          patientName: patient?.name || 'WhatsApp / Care Patient',
          shid: patient?.shid || patient?.akshiaId,
          phone: patient?.phone,
          department: triage.appointmentDraft.department,
          preferredSlot: triage.appointmentDraft.preferredSlot,
          source: 'whatsapp_voice_bot',
        });
        const bookingsFile = path.join(os.tmpdir(), 'medcore-care-bookings-v1.json');
        const existing = fs.existsSync(bookingsFile)
          ? (JSON.parse(fs.readFileSync(bookingsFile, 'utf8')) as unknown[])
          : [];
        fs.writeFileSync(bookingsFile, JSON.stringify([booking, ...(Array.isArray(existing) ? existing : [])].slice(0, 300)), 'utf8');
        publishFacilitySseEvent({
          facilityId: facId,
          key: 'care_portal_booking',
          value: {
            bookingRef: booking.bookingRef,
            department: booking.department,
            source: booking.source,
          },
        });
      } catch {
        // non-fatal sync persistence
      }
    }

    // Optional warm conversational enrichment for non-emergency responses when live key exists
    let finalReplyText = triage.replyText;
    let mode: 'ai_conversational' | 'deterministic_bot' = 'deterministic_bot';
    const { key } = resolveServerGeminiKey();
    if (key && triage.urgency !== 'emergency') {
      const polish = await createGeminiInteraction({
        apiKey: key,
        models: ['gemini-3.5-flash-lite', 'gemini-4-hydrogen'],
        input: [
          {
            type: 'text',
            text: [
              `Rewrite this Akwa Ibom patient triage response naturally in ${triage.language} (warm, clear, concise <= 55 words), preserving every booking ref, AKSHIA card number, hospital name, and safety check exactly:`,
              `Patient said: "${effectiveText}"`,
              `Verified clinical guidance: "${triage.replyText}"`,
            ].join('\n'),
          },
        ],
        temperature: 0.2,
        maxOutputTokens: 220,
      });
      if (polish.ok && polish.text.trim()) {
        finalReplyText = polish.text.trim();
        mode = 'ai_conversational';
      }
    }

    return NextResponse.json(
      {
        ok: true,
        channel: 'in_app_voice_bot',
        mode,
        transcript: transcript || undefined,
        ...triage,
        replyText: finalReplyText,
        voiceScript: finalReplyText,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || 'Triage bot gateway error.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
