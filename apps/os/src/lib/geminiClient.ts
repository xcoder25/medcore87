/**
 * Celestia Gemini client — browser calls /api/gemini only.
 * Server reads GEMINI_API_KEY (never NEXT_PUBLIC_GEMINI_API_KEY).
 */

export async function geminiGenerate(
  prompt: string,
  systemHint?: string,
  ragContext?: string
): Promise<{ ok: boolean; text: string; usedGemini: boolean }> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        systemHint: systemHint || undefined,
        ragContext: ragContext || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      text?: string;
      usedGemini?: boolean;
    };
    return {
      ok: Boolean(json.ok),
      usedGemini: Boolean(json.usedGemini),
      text: String(json.text || ''),
    };
  } catch (e) {
    return {
      ok: false,
      usedGemini: false,
      text: `Celestia could not reach Gemini: ${(e as Error)?.message || 'network error'}`,
    };
  }
}

/** True if server reports GEMINI_API_KEY is configured (no key in the browser). */
export function hasGeminiKey(): boolean {
  // Sync callers: optimistic true in browser; actual check is async via probeGeminiConfigured
  if (typeof window === 'undefined') {
    return Boolean(
      (process.env.GEMINI_API_KEY || '').trim() || (process.env.GOOGLE_GEMINI_API_KEY || '').trim()
    );
  }
  return (window as unknown as { __celestiaGeminiConfigured?: boolean }).__celestiaGeminiConfigured === true;
}

export async function probeGeminiConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/gemini', { method: 'GET' });
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
