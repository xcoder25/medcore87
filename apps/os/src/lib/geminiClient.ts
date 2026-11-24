/**
 * Celestia Clinical AI client — browser → /api/gemini only.
 * Supports unary JSON generation AND true SSE token streaming + tool status + human-in-the-loop action proposals.
 * Server uses GEMINI_API_KEY (never NEXT_PUBLIC_*).
 */

export type GeminiResult = {
  ok: boolean;
  text: string;
  usedGemini: boolean;
  configured?: boolean;
};

export interface CelestiaProposedAction {
  id: string;
  kind: 'place_order' | 'navigate';
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status?: 'pending' | 'approved' | 'dismissed';
}

export interface CelestiaStreamResult extends GeminiResult {
  proposedActions: CelestiaProposedAction[];
  toolTrace: string[];
  model?: string;
}

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
          ? 'Clinical AI assistant is not configured on this server. Contact your system administrator.'
          : `Clinical AI request failed (HTTP ${res.status}).`),
    };
  } catch (e) {
    return {
      ok: false,
      usedGemini: false,
      configured: false,
      text: `Celestia could not reach the AI service: ${(e as Error)?.message || 'network error'}`,
    };
  }
}

export async function geminiStreamChat(opts: {
  prompt: string;
  systemHint?: string;
  ragContext?: string;
  facilityId?: string;
  roleKey?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  onToken?: (delta: string) => void;
  onStatus?: (status: string) => void;
  onProposedAction?: (action: CelestiaProposedAction) => void;
}): Promise<CelestiaStreamResult> {
  const fid = opts.facilityId || resolveFacilityId();
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(fid ? { 'x-facility-id': fid } : {}),
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        systemHint: opts.systemHint || undefined,
        ragContext: opts.ragContext || undefined,
        facilityId: fid || undefined,
        roleKey: opts.roleKey || undefined,
        history: opts.history || undefined,
        stream: true,
        enableTools: true,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !res.body || !contentType.includes('text/event-stream')) {
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        text?: string;
        usedGemini?: boolean;
        configured?: boolean;
        proposedActions?: CelestiaProposedAction[];
        toolTrace?: string[];
      };
      const text = String(json.text || '').trim();
      const ok = Boolean(json.ok) && Boolean(text);
      if (ok && text) opts.onToken?.(text);
      return {
        ok,
        usedGemini: Boolean(json.usedGemini),
        configured: json.configured,
        text: text || `Clinical AI unavailable (HTTP ${res.status}).`,
        proposedActions: json.proposedActions || [],
        toolTrace: json.toolTrace || [],
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    const proposedActions: CelestiaProposedAction[] = [];
    const toolTrace: string[] = [];
    let model: string | undefined;
    let streamError = '';

    const handleFrame = (eventName: string, dataStr: string) => {
      if (!dataStr) return;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(dataStr) as Record<string, unknown>;
      } catch {
        return;
      }

      if (eventName === 'token' && typeof data.text === 'string') {
        accumulatedText += data.text;
        opts.onToken?.(data.text);
      } else if (eventName === 'status' && typeof data.text === 'string') {
        opts.onStatus?.(data.text);
      } else if (eventName === 'tool_result' && typeof data.summary === 'string') {
        toolTrace.push(data.summary);
        opts.onStatus?.(data.summary);
      } else if (eventName === 'proposed_action' && data.action && typeof data.action === 'object') {
        const action = data.action as CelestiaProposedAction;
        if (!proposedActions.some((a) => a.id === action.id)) {
          proposedActions.push(action);
          opts.onProposedAction?.(action);
        }
      } else if (eventName === 'done') {
        if (typeof data.model === 'string') model = data.model;
        if (!accumulatedText && typeof data.text === 'string') {
          accumulatedText = data.text;
          if (data.text) opts.onToken?.(data.text);
        }
      } else if (eventName === 'error' && typeof data.text === 'string') {
        streamError = data.text;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep = buffer.indexOf('\n\n');
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf('\n\n');

        let eventName = 'message';
        const dataLines: string[] = [];
        for (const rawLine of block.split('\n')) {
          const line = rawLine.trimEnd();
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length > 0) {
          handleFrame(eventName, dataLines.join('\n'));
        }
      }
    }

    const finalText = accumulatedText.trim();
    if (!finalText && streamError) {
      return {
        ok: false,
        usedGemini: true,
        configured: true,
        text: streamError,
        proposedActions,
        toolTrace,
      };
    }

    return {
      ok: Boolean(finalText),
      usedGemini: true,
      configured: true,
      text: finalText || streamError || 'Completed request.',
      proposedActions,
      toolTrace,
      model,
    };
  } catch (e) {
    return {
      ok: false,
      usedGemini: false,
      configured: false,
      text: `Celestia could not reach the AI service: ${(e as Error)?.message || 'network error'}`,
      proposedActions: [],
      toolTrace: [],
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
