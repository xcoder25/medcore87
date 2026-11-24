/**
 * Server-only Gemini Interactions API proxy for Celestia 2.0.
 * Supports:
 *  - GET: key availability probe (no secrets exposed)
 *  - POST (unary default): backwards-compatible JSON response + optional tool calling
 *  - POST (stream: true): live SSE token streaming + server-side tool execution + human-in-the-loop proposals
 * Uses ONLY current Gemini models (gemini-4-hydrogen, gemini-4-argon, gemini-3.5-flash-lite).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  CELESTIA_SERVER_TOOLS,
  CURRENT_CHAT_MODELS,
  createGeminiInteraction,
  executeCelestiaServerTool,
  resolveServerGeminiKey,
  streamGeminiInteraction,
  type CelestiaServerProposedAction,
  type InteractionFunctionCall,
} from '../../../lib/geminiServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

function buildConversationPrompt(
  prompt: string,
  ragContext: string,
  history: HistoryTurn[]
): string {
  const parts: string[] = [];
  if (ragContext) {
    parts.push(`LIVE FACILITY CONTEXT:\n${ragContext}`);
  }
  const recent = history.slice(-6).filter((h) => h.text?.trim());
  if (recent.length > 0) {
    parts.push(
      'RECENT CONVERSATION:\n' +
        recent
          .map((h) => `${h.role === 'assistant' ? 'Celestia' : 'Staff'}: ${h.text.trim()}`)
          .join('\n')
    );
  }
  parts.push(`CURRENT REQUEST:\n${prompt}`);
  return parts.join('\n\n');
}

export async function GET(req: NextRequest) {
  const facilityId =
    req.nextUrl.searchParams.get('facilityId') ||
    req.headers.get('x-facility-id') ||
    '';
  const resolved = resolveServerGeminiKey();
  return NextResponse.json({
    configured: Boolean(resolved.key),
    facilityIdTried: facilityId || null,
    hint: resolved.key
      ? 'Clinical AI service is configured.'
      : 'Clinical AI service is not configured. Configure an AI key in server environment.',
  });
}

export async function POST(req: NextRequest) {
  let body: {
    prompt?: string;
    systemHint?: string;
    ragContext?: string;
    facilityId?: string;
    roleKey?: string;
    history?: HistoryTurn[];
    stream?: boolean;
    enableTools?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, usedGemini: false, text: 'Invalid JSON body' }, { status: 400 });
  }

  const facilityId =
    String(body.facilityId || req.headers.get('x-facility-id') || 'IGH-EKT')
      .trim()
      .toUpperCase();
  const roleKey = String(body.roleKey || '').trim().toLowerCase();

  const resolved = resolveServerGeminiKey();
  if (!resolved.key) {
    return NextResponse.json(
      {
        ok: false,
        usedGemini: false,
        configured: false,
        text: 'Clinical AI service is not configured on this server. Contact your system administrator.',
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
    'You are Celestia in MedCore Hospital OS. Chat naturally and briefly. Stay inside the user role. Never invent patient data. Prefer one clear actionable step.';
  const ragContext = String(body.ragContext || '').trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const fullInput = buildConversationPrompt(prompt, ragContext, history);
  const tools = body.enableTools !== false ? CELESTIA_SERVER_TOOLS : undefined;

  if (body.stream) {
    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        const send = (eventName: string, payload: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        };

        try {
          const toolTrace: string[] = [];
          const proposedActions: CelestiaServerProposedAction[] = [];
          let fullText = '';
          let usedModel: string = CURRENT_CHAT_MODELS[0];
          let currentInput: unknown = fullInput;
          let previousInteractionId: string | undefined;
          let succeeded = false;

          for (const model of CURRENT_CHAT_MODELS) {
            usedModel = model;
            let turnText = '';
            let streamError: { status: number; message: string } | null = null;
            let round = 0;
            let loopInput: unknown = currentInput;
            let loopPrevId = previousInteractionId;
            let loopTools = tools;

            while (round < 3) {
              round += 1;
              const pendingCalls: InteractionFunctionCall[] = [];
              let interactionId: string | undefined;
              let completionStatus = 'completed';

              for await (const ev of streamGeminiInteraction({
                apiKey: resolved.key,
                input: loopInput,
                systemInstruction: round === 1 ? systemHint : undefined,
                model,
                tools: loopTools,
                previousInteractionId: loopPrevId,
                temperature: 0.35,
                maxOutputTokens: 1200,
              })) {
                if (ev.type === 'created') {
                  interactionId = ev.id;
                } else if (ev.type === 'text_delta') {
                  turnText += ev.text;
                  fullText += ev.text;
                  send('token', { text: ev.text });
                } else if (ev.type === 'function_call') {
                  pendingCalls.push(ev.call);
                } else if (ev.type === 'completed') {
                  completionStatus = ev.status || 'completed';
                } else if (ev.type === 'error') {
                  streamError = { status: ev.status, message: ev.message };
                  break;
                }
              }

              if (streamError) break;

              if (
                pendingCalls.length > 0 &&
                (completionStatus === 'requires_action' || turnText.trim().length === 0)
              ) {
                const functionResults: Array<Record<string, unknown>> = [];
                for (const call of pendingCalls) {
                  send('status', { text: `Running ${call.name.replace(/_/g, ' ')}…` });
                  const exec = await executeCelestiaServerTool(call, { facilityId, roleKey });
                  toolTrace.push(exec.traceLabel);
                  if (exec.proposedAction) {
                    proposedActions.push(exec.proposedAction);
                    send('proposed_action', { action: exec.proposedAction });
                  }
                  send('tool_result', { name: call.name, summary: exec.traceLabel });
                  functionResults.push({
                    type: 'function_result',
                    call_id: call.id,
                    name: call.name,
                    result: JSON.stringify(exec.result),
                  });
                }

                if (interactionId) {
                  loopPrevId = interactionId;
                  loopInput = functionResults;
                  loopTools = tools;
                  continue;
                }
              }

              if (turnText.trim().length > 0) {
                succeeded = true;
              }
              break;
            }

            if (succeeded) break;
            if (streamError && (streamError.status === 401 || streamError.status === 403)) {
              send('error', {
                text: 'Clinical AI credentials were rejected. Update the server AI key.',
              });
              controller.close();
              return;
            }
          }

          if (!succeeded && !fullText.trim()) {
            send('error', {
              text: 'Clinical AI streaming is temporarily unavailable. Switching to local assistance.',
            });
            controller.close();
            return;
          }

          send('done', {
            ok: true,
            model: usedModel,
            text: fullText.trim(),
            toolTrace,
            proposedActions,
          });
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                text: `Clinical AI stream error: ${(err as Error)?.message || 'unknown'}`,
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(sse, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // Unary JSON path (backwards compatible) with up to 2 tool-calling rounds
  try {
    const toolTrace: string[] = [];
    const proposedActions: CelestiaServerProposedAction[] = [];

    let res = await createGeminiInteraction({
      apiKey: resolved.key,
      input: fullInput,
      systemInstruction: systemHint,
      tools,
      temperature: 0.35,
      maxOutputTokens: 1200,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            ok: false,
            usedGemini: true,
            configured: true,
            keySource: resolved.source,
            text: 'Clinical AI credentials were rejected. Update the AI key in server configuration.',
          },
          { status: 502 }
        );
      }
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
    }

    let rounds = 0;
    while (
      rounds < 2 &&
      res.functionCalls.length > 0 &&
      res.interactionId &&
      (res.interactionStatus === 'requires_action' || !res.text)
    ) {
      rounds += 1;
      const functionResults: Array<Record<string, unknown>> = [];
      for (const call of res.functionCalls) {
        const exec = await executeCelestiaServerTool(call, { facilityId, roleKey });
        toolTrace.push(exec.traceLabel);
        if (exec.proposedAction) proposedActions.push(exec.proposedAction);
        functionResults.push({
          type: 'function_result',
          call_id: call.id,
          name: call.name,
          result: JSON.stringify(exec.result),
        });
      }
      const nextRes = await createGeminiInteraction({
        apiKey: resolved.key,
        input: functionResults,
        previousInteractionId: res.interactionId,
        models: [res.model],
        tools,
        temperature: 0.35,
        maxOutputTokens: 1200,
      });
      if (!nextRes.ok) break;
      res = nextRes;
    }

    return NextResponse.json({
      ok: Boolean(res.text),
      usedGemini: true,
      configured: true,
      keySource: resolved.source,
      model: res.model,
      text: res.text || 'Completed requested action.',
      toolTrace,
      proposedActions,
    });
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
