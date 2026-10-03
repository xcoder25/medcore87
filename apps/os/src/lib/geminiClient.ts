/**
 * Gemini client for M87 — uses NEXT_PUBLIC_GEMINI_API_KEY or admin settings.
 */
import { getAdminSettings } from './adminSettingsStore';

export async function geminiGenerate(
  prompt: string,
  systemHint?: string,
  ragContext?: string
): Promise<{ ok: boolean; text: string; usedGemini: boolean }> {
  let key = '';
  try {
    key =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GEMINI_API_KEY) ||
      '';
  } catch {
    key = '';
  }
  try {
    const s = getAdminSettings();
    if ((s as { geminiApiKey?: string }).geminiApiKey) {
      key = (s as { geminiApiKey?: string }).geminiApiKey || key;
    }
  } catch {
    /* ignore */
  }

  if (!key) {
    return {
      ok: false,
      usedGemini: false,
      text: '',
    };
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              systemHint ||
                'You are M87, MedCore hospital OS copilot for Nigerian public hospitals (Akwa Ibom). Be concise, actionable, never invent patient data. Prefer operational next steps.',
              ragContext ? `\n${ragContext}\n` : '',
              '',
              prompt,
            ].filter(Boolean).join('\n'),
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
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, usedGemini: true, text: `Gemini error (${res.status}): ${err.slice(0, 200)}` };
    }
    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ||
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    if (!text) {
      return { ok: false, usedGemini: true, text: 'Gemini returned an empty response.' };
    }
    return { ok: true, usedGemini: true, text: String(text).trim() };
  } catch (e) {
    return {
      ok: false,
      usedGemini: true,
      text: `Gemini network error: ${(e as Error)?.message || 'failed'}`,
    };
  }
}

export function hasGeminiKey(): boolean {
  try {
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GEMINI_API_KEY) return true;
  } catch {
    /* ignore */
  }
  try {
    const s = getAdminSettings() as { geminiApiKey?: string };
    return Boolean(s.geminiApiKey);
  } catch {
    return false;
  }
}
