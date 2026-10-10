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

async function getFacilityGeminiKey(facilityId: string): Promise<string> {
  const fid = String(facilityId || '').trim();
  if (!fid) return '';
  try {
    // Lazy import so build does not require Firebase at module load
    const { firestoreReadFacility } = await import('../../../lib/firebase');
    const data = await firestoreReadFacility(fid);
    if (!data) return '';
    const settingsKeys = [
      'medcore_os_admin_settings_v1',
      `medcore_os_admin_settings_v1:${fid}`,
      `medcore_os_admin_settings_v1:${fid.toUpperCase()}`,
    ];
    for (const sk of settingsKeys) {
      const block = data[sk];
      if (block && typeof block === 'object') {
        const k = cleanKey((block as { geminiApiKey?: string }).geminiApiKey);
        if (k) return k;
      }
    }
    // Flat field on shared doc
    const flat = cleanKey(data.geminiApiKey as string | undefined);
    if (flat) return flat;
  } catch {
    /* offline / rules */
  }
  return '';
}

async function resolveGeminiKey(facilityId?: string): Promise<{ key: string; source: string }> {
  const fromEnv = getEnvGeminiKey();
  if (fromEnv) return { key: fromEnv, source: 'env' };
  if (facilityId) {
    const fromFs = await getFacilityGeminiKey(facilityId);
    if (fromFs) return { key: fromFs, source: 'firestore_facility_settings' };
  }
  // Try common Eket id if none passed
  for (const fid of ['IGH-EKT', 'IGH_EKT', 'DEFAULT-HOSPITAL']) {
    const fromFs = await getFacilityGeminiKey(fid);
    if (fromFs) return { key: fromFs, source: `firestore:${fid}` };
  }
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
  const env = process.env as Record<string, string | undefined>;
  const present: Record<string, { set: boolean; length: number }> = {};
  for (const name of GEMINI_ENV_NAMES) {
    const k = cleanKey(env[name]);
    present[name] = { set: Boolean(k), length: k.length };
  }
  const publicMistaken = Boolean(
    cleanKey(env.NEXT_PUBLIC_GEMINI_API_KEY) ||
      cleanKey(env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY)
  );
  return NextResponse.json({
    configured: Boolean(resolved.key),
    keyLength: resolved.key ? resolved.key.length : 0,
    keySource: resolved.source,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    present,
    publicKeyMistakenlySet: publicMistaken,
    facilityIdTried: facilityId || null,
    hint: resolved.key
      ? `Gemini key loaded from ${resolved.source}.`
      : publicMistaken
        ? 'NEXT_PUBLIC_GEMINI_API_KEY is set but ignored. Use server GEMINI_API_KEY, or save key in Admin Settings (synced to Firestore).'
        : 'No key on Vercel env. Either: (1) Fix Vercel GEMINI_API_KEY for Production, or (2) Admin → Settings → paste Gemini API key → Save (uses Firestore fallback).',
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
        keySource: 'none',
        text:
          'No Gemini API key on the server. Add GEMINI_API_KEY in Vercel (Production), OR open Admin → Settings, paste your Google AI Studio key into Gemini API key, Save, then retry chat.',
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
            text: `Gemini rejected the API key (${result.status}). Create a new key at https://aistudio.google.com/apikey and update Vercel or Admin Settings.`,
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
        keySource: resolved.source,
        text: `Gemini models failed.\n${errors.slice(0, 3).join('\n')}`,
      },
      { status: 502 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: false,
        configured: true,
        keySource: resolved.source,
        text: `Gemini network error: ${(e as Error)?.message || 'unknown'}`,
      },
      { status: 502 }
    );
  }
}
