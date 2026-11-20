/**
 * Server-only Gemini proxy.
 * Key order:
 *  1) Vercel/server env (GEMINI_API_KEY, …)
 *  2) Facility Admin Settings in Firestore (geminiApiKey) — works when Vercel env UI fails
 * Never use NEXT_PUBLIC_* keys.
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

/** Runtime-only env read (avoid build-time empty inlining) */
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

async function resolveGeminiKey(facilityId?: string): Promise<{ key: string; source: string }> {
  const fromEnv = getEnvGeminiKey();
  if (fromEnv) return { key: fromEnv, source: 'env' };
  return { key: '', source: 'none' };
}

/** Current Gemini models (Oct 2026) — 1.5/2.0 flash retired */
const MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export async function GET(req: NextRequest) {
  const facilityId =
    req.nextUrl.searchParams.get('facilityId') ||
    req.headers.get('x-facility-id') ||
    '';
  const resolved = await resolveGeminiKey(facilityId || undefined);
  return NextResponse.json({
    configured: Boolean(resolved.key),
    facilityIdTried: facilityId || null,
    hint: resolved.key
      ? 'Clinical AI service is configured.'
      : 'Clinical AI service is not configured. Configure an AI key in Admin → Settings or server environment.',
  });
}

async function callGemini(
  key: string,
  model: string,
  payload: object
): Promise<{ ok: boolean; status: number; text: string; raw?: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
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
  let body: {
    prompt?: string;
    systemHint?: string;
    ragContext?: string;
    facilityId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, usedGemini: false, text: 'Invalid JSON body' }, { status: 400 });
  }

  const facilityId =
    String(body.facilityId || '').trim() ||
    req.headers.get('x-facility-id') ||
    '';

  const resolved = await resolveGeminiKey(facilityId || undefined);
  if (!resolved.key) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: false,
        configured: false,
        text:
          'Clinical AI service is not configured on this server. Contact your system administrator or configure it in Admin → Settings.',
      },
      { status: 503 }
    );
  }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, usedGemini: false, text: 'prompt required' }, { status: 400 });
  }

  const systemHint =
    String(body.systemHint || '').trim() ||
    'You are Celestia in MedCore Hospital OS. Chat naturally and briefly. Do not re-introduce yourself every turn. Stay inside the user role. Never invent patient data. Prefer one clear next step.';
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
      const result = await callGemini(resolved.key, model, payload);
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          usedGemini: true,
          configured: true,
          keySource: resolved.source,
          model,
          text: result.text,
        });
      }
      errors.push(`${model}: HTTP ${result.status} ${result.text.slice(0, 120)}`);
      if (result.status === 401 || result.status === 403) {
        return NextResponse.json(
          {
            ok: false,
            usedGemini: true,
            configured: true,
            keySource: resolved.source,
            text: 'Clinical AI credentials were rejected. Update the AI key in Admin → Settings or server configuration.',
          },
          { status: 502 }
        );
      }
    }
    console.error('[api/gemini] all models failed:', errors.slice(0, 3).join(' | '));
    return NextResponse.json(
      {
        ok: false,
        usedGemini: true,
        configured: true,
        keySource: resolved.source,
        text: 'Clinical AI service is temporarily unavailable. Please try again shortly.',
      },
      { status: 502 }
    );
  } catch (e) {
    console.error('[api/gemini] error:', e);
    return NextResponse.json(
      {
        ok: false,
        usedGemini: false,
        configured: true,
        keySource: resolved.source,
        text: `Clinical AI network error: ${(e as Error)?.message || 'unknown'}`,
      },
      { status: 502 }
    );
  }
}
