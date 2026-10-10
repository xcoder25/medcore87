/**
 * Celestia Gemini client — browser → /api/gemini only.
 * Server uses GEMINI_API_KEY (never NEXT_PUBLIC_*).
 */

export type GeminiResult = {
  ok: boolean;
  text: string;
  usedGemini: boolean;
  configured?: boolean;
};

function resolveFacilityId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const s = localStorage.getItem('medcore_os_session');
    if (s) {
      const j = JSON.parse(s);
      if (j?.hospitalId) return String(j.hospitalId);
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function geminiGenerate(
  prompt: string,
  systemHint?: string,
  ragContext?: string,
  facilityId?: string
): Promise<GeminiResult> {
  try {
    const fid = facilityId || resolveFacilityId();
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(fid ? { 'x-facility-id': fid } : {}),
      },
      body: JSON.stringify({
        prompt,
        systemHint: systemHint || undefined,
        ragContext: ragContext || undefined,
        facilityId: fid || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      text?: string;
      usedGemini?: boolean;
      configured?: boolean;
    };
    const text = String(json.text || '').trim();
    const ok = Boolean(json.ok) && Boolean(text);
    return {
      ok,
      usedGemini: Boolean(json.usedGemini),
      configured: json.configured,
      text:
        text ||
        (res.status === 503
          ? 'GEMINI_API_KEY is not set on the server. Add it in Vercel Environment Variables and redeploy.'
          : `Gemini request failed (HTTP ${res.status}).`),
    };
  } catch (e) {
    return {
      ok: false,
      usedGemini: false,
      configured: false,
      text: `Celestia could not reach /api/gemini: ${(e as Error)?.message || 'network error'}`,
    };
  }
}

export function hasGeminiKey(): boolean {
  if (typeof window === 'undefined') {
    return Boolean(
      (process.env.GEMINI_API_KEY || '').trim() ||
        (process.env.GOOGLE_GEMINI_API_KEY || '').trim() ||
        (process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim() ||
        (process.env.GOOGLE_API_KEY || '').trim()
    );
  }
  return (window as unknown as { __celestiaGeminiConfigured?: boolean }).__celestiaGeminiConfigured === true;
}

export async function probeGeminiConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/gemini', { method: 'GET', cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as { configured?: boolean };
    const ok = Boolean(json.configured);
    if (typeof window !== 'undefined') {
      (window as unknown as { __celestiaGeminiConfigured?: boolean }).__celestiaGeminiConfigured = ok;
    }
    return ok;
  } catch {
    return false;
  }
}
