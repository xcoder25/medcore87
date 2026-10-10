/**
 * Server-only Gemini proxy — GEMINI_API_KEY (never NEXT_PUBLIC_*).
 */
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

/** Strip whitespace / surrounding quotes people paste into Vercel */
function cleanKey(raw: string | undefined): string {
  let k = String(raw || '').trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  // Common paste artifact: "Bearer xxx"
  if (k.toLowerCase().startsWith('bearer ')) k = k.slice(7).trim();
  return k;
}

function getServerGeminiKey(): string {
  for (const name of GEMINI_ENV_NAMES) {
    const k = cleanKey(process.env[name]);
    if (k) return k;
  }
  // Last resort: any env whose name contains GEMINI and API (not NEXT_PUBLIC)
  for (const [name, val] of Object.entries(process.env)) {
    if (name.startsWith('NEXT_PUBLIC_')) continue;
    if (!/GEMINI/i.test(name)) continue;
    if (!/KEY|API/i.test(name)) continue;
    const k = cleanKey(val);
    if (k) return k;
  }
  return '';
}

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
];

export async function GET() {
  const key = getServerGeminiKey();
  const present: Record<string, { set: boolean; length: number }> = {};
  for (const name of GEMINI_ENV_NAMES) {
    const k = cleanKey(process.env[name]);
    present[name] = { set: Boolean(k), length: k.length };
  }
  // Flag mistaken NEXT_PUBLIC_ so user can fix naming
  const publicMistaken = Boolean(
    cleanKey(process.env.NEXT_PUBLIC_GEMINI_API_KEY) ||
      cleanKey(process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY)
  );
  return NextResponse.json({
    configured: Boolean(key),
    keyLength: key ? key.length : 0,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    present,
    publicKeyMistakenlySet: publicMistaken,
    hint: key
      ? 'Server key is loaded.'
      : publicMistaken
        ? 'You set NEXT_PUBLIC_GEMINI_API_KEY — that is ignored (browser-exposed). Add server-only GEMINI_API_KEY, then Redeploy.'
        : 'No server Gemini key found. Vercel → Settings → Environment Variables → GEMINI_API_KEY for Production AND Preview → Save → Deployments → Redeploy (or push a new commit).',
  });
}

async function callGemini(
  key: string,
  model: string,
  payload: object
): Promise<{ ok: boolean; status: number; text: string; raw?: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text: raw.slice(0, 400), raw };
  }
  try {
    const json = JSON.parse(raw);
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ||
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    if (!text) {
      return { ok: false, status: 200, text: 'empty candidate', raw: raw.slice(0, 300) };
    }
    return { ok: true, status: 200, text: String(text).trim() };
  } catch {
    return { ok: false, status: res.status, text: 'invalid JSON from Gemini', raw: raw.slice(0, 200) };
  }
}

export async function POST(req: NextRequest) {
  const key = getServerGeminiKey();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: false,
        configured: false,
        text:
          'Server is missing GEMINI_API_KEY. In Vercel → Project → Settings → Environment Variables, add GEMINI_API_KEY (Production + Preview), then Redeploy. Do not use NEXT_PUBLIC_.',
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

  const errors: string[] = [];
  try {
    for (const model of MODELS) {
      const result = await callGemini(key, model, payload);
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          usedGemini: true,
          configured: true,
          model,
          text: result.text,
        });
      }
      errors.push(`${model}: HTTP ${result.status} ${result.text.slice(0, 120)}`);
      // 400 on model name → try next; 403/401 → stop (bad key)
      if (result.status === 401 || result.status === 403) {
        return NextResponse.json(
          {
            ok: false,
            usedGemini: true,
            configured: true,
            text: `Gemini rejected the API key (${result.status}). Check GEMINI_API_KEY in Vercel and that the Generative Language API is enabled.`,
          },
          { status: 502 }
        );
      }
    }
    return NextResponse.json(
      {
        ok: false,
        usedGemini: true,
        configured: true,
        text: `Gemini models failed.\n${errors.slice(0, 3).join('\n')}`,
      },
      { status: 502 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: true,
        configured: true,
        text: `Gemini network error: ${(e as Error)?.message || 'failed'}`,
      },
      { status: 502 }
    );
  }
}
