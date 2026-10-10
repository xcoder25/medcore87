/**
 * Server-only Gemini proxy — reads GEMINI_API_KEY (never NEXT_PUBLIC_*).
 * Client calls this route; the key never ships to the browser.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServerGeminiKey(): string {
  const k =
    (process.env.GEMINI_API_KEY || '').trim() ||
    (process.env.GOOGLE_GEMINI_API_KEY || '').trim();
  return k;
}

export async function GET() {
  const configured = Boolean(getServerGeminiKey());
  return NextResponse.json({ configured });
}

export async function POST(req: NextRequest) {
  const key = getServerGeminiKey();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: false,
        text: 'GEMINI_API_KEY is not set on the server. Add it in Vercel env (not NEXT_PUBLIC_).',
      },
      { status: 503 }
    );
  }

  let body: { prompt?: string; systemHint?: string; ragContext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, usedGemini: false, text: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, usedGemini: false, text: 'prompt required' }, { status: 400 });
  }

  const systemHint =
    String(body.systemHint || '').trim() ||
    'You are Celestia, MedCore hospital OS copilot for Nigerian public hospitals (Akwa Ibom). Be concise, actionable, never invent patient data. Prefer operational next steps.';
  const ragContext = String(body.ragContext || '').trim();

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [systemHint, ragContext ? `\n${ragContext}\n` : '', '', prompt].filter(Boolean).join('\n'),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        {
          ok: false,
          usedGemini: true,
          text: `Gemini error (${res.status}): ${err.slice(0, 240)}`,
        },
        { status: 502 }
      );
    }
    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ||
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    if (!text) {
      return NextResponse.json({
        ok: false,
        usedGemini: true,
        text: 'Gemini returned an empty response.',
      });
    }
    return NextResponse.json({ ok: true, usedGemini: true, text: String(text).trim() });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: true,
        text: `Gemini network error: ${(e as Error)?.message || 'failed'}`,
      },
      { status: 502 }
    );
  }
}
