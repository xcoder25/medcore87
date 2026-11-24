/**
 * Server-only Gemini Interactions API helper for MedCore OS.
 * Uses ONLY current Gemini models (gemini-4-hydrogen, gemini-4-argon, gemini-3.5-flash-lite, gemini-3.5-transcribe).
 * Never uses NEXT_PUBLIC_* env vars.
 */
import { ensureSchema, isPostgresConfigured, withTenantClient } from './db/postgres';
import { evaluatePrescriptionSafetyGuard } from './clinicalSafetyEngine';

export const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const GEMINI_API_REVISION = '2026-05-20';

export const CURRENT_CHAT_MODELS = [
  'gemini-4-hydrogen',
  'gemini-4-argon',
  'gemini-3.5-flash-lite',
] as const;

export const CURRENT_TRANSCRIBE_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-4-hydrogen',
  'gemini-3.5-flash-lite',
] as const;

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

export function resolveServerGeminiKey(): { key: string; source: string } {
  const env = process.env as Record<string, string | undefined>;
  for (const name of GEMINI_ENV_NAMES) {
    const k = cleanKey(env[name]);
    if (k) return { key: k, source: 'env' };
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith('NEXT_PUBLIC_')) continue;
    if (!/GEMINI/i.test(name)) continue;
    if (!/KEY|API/i.test(name)) continue;
    const k = cleanKey(env[name]);
    if (k) return { key: k, source: 'env' };
  }
  return { key: '', source: 'none' };
}

export interface InteractionFunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface InteractionFunctionCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface InteractionResponseFormat {
  type: 'text';
  mime_type: 'application/json';
  schema: Record<string, unknown>;
}

export interface CreateInteractionResult {
  ok: boolean;
  status: number;
  model: string;
  interactionId?: string;
  interactionStatus?: string;
  text: string;
  functionCalls: InteractionFunctionCall[];
  error?: string;
}

export function extractInteractionText(json: Record<string, unknown> | null): string {
  if (!json) return '';
  const steps = Array.isArray(json.steps) ? (json.steps as Array<Record<string, unknown>>) : [];
  const chunks: string[] = [];

  for (const step of steps) {
    if (step.type === 'model_output' && Array.isArray(step.content)) {
      for (const item of step.content as Array<Record<string, unknown>>) {
        if (item.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
          chunks.push(item.text);
        }
      }
    } else if (step.type === 'text' && typeof step.text === 'string' && step.text.trim()) {
      chunks.push(step.text);
    }
  }

  if (chunks.length > 0) return chunks.join('').trim();

  // Compatibility fallback for outputs array if returned
  const outputs = Array.isArray(json.outputs) ? (json.outputs as Array<Record<string, unknown>>) : [];
  for (const out of outputs) {
    if (typeof out.text === 'string' && out.text.trim()) {
      chunks.push(out.text);
    }
  }
  return chunks.join('').trim();
}

export function extractInteractionFunctionCalls(
  json: Record<string, unknown> | null
): InteractionFunctionCall[] {
  if (!json) return [];
  const calls: InteractionFunctionCall[] = [];
  const steps = Array.isArray(json.steps) ? (json.steps as Array<Record<string, unknown>>) : [];

  for (const step of steps) {
    if (step.type === 'function_call' && typeof step.name === 'string') {
      const args =
        step.arguments && typeof step.arguments === 'object'
          ? (step.arguments as Record<string, unknown>)
          : typeof step.arguments === 'string'
            ? (JSON.parse(step.arguments) as Record<string, unknown>)
            : {};
      calls.push({
        id: String(step.id || `fc-${calls.length + 1}`),
        name: step.name,
        arguments: args,
      });
    }
  }

  if (calls.length > 0) return calls;

  const outputs = Array.isArray(json.outputs) ? (json.outputs as Array<Record<string, unknown>>) : [];
  for (const out of outputs) {
    if (out.type === 'function_call' && typeof out.name === 'string') {
      const args =
        out.arguments && typeof out.arguments === 'object'
          ? (out.arguments as Record<string, unknown>)
          : {};
      calls.push({
        id: String(out.id || `fc-${calls.length + 1}`),
        name: out.name,
        arguments: args,
      });
    }
  }

  return calls;
}

export async function createGeminiInteraction(opts: {
  apiKey: string;
  input: unknown;
  systemInstruction?: string;
  models?: readonly string[];
  tools?: InteractionFunctionTool[];
  responseFormat?: InteractionResponseFormat;
  previousInteractionId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<CreateInteractionResult> {
  const models = opts.models?.length ? opts.models : CURRENT_CHAT_MODELS;
  let lastError = 'No model succeeded';
  let lastStatus = 502;

  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      input: opts.input,
    };
    if (opts.systemInstruction) body.system_instruction = opts.systemInstruction;
    if (opts.tools?.length) body.tools = opts.tools;
    if (opts.responseFormat) body.response_format = opts.responseFormat;
    if (opts.previousInteractionId) body.previous_interaction_id = opts.previousInteractionId;
    if (typeof opts.temperature === 'number' || typeof opts.maxOutputTokens === 'number') {
      body.generation_config = {
        ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
        ...(typeof opts.maxOutputTokens === 'number' ? { max_output_tokens: opts.maxOutputTokens } : {}),
      };
    }

    try {
      const res = await fetch(GEMINI_INTERACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': opts.apiKey,
          'Api-Revision': GEMINI_API_REVISION,
        },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      if (!res.ok) {
        lastStatus = res.status;
        lastError = `${model}: HTTP ${res.status} ${raw.slice(0, 160)}`;
        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            status: res.status,
            model,
            text: '',
            functionCalls: [],
            error: lastError,
          };
        }
        continue;
      }

      const json = JSON.parse(raw) as Record<string, unknown>;
      const text = extractInteractionText(json);
      const functionCalls = extractInteractionFunctionCalls(json);
      const interactionStatus = typeof json.status === 'string' ? json.status : 'completed';

      if (!text && functionCalls.length === 0) {
        lastStatus = 200;
        lastError = `${model}: empty interaction output`;
        continue;
      }

      return {
        ok: true,
        status: 200,
        model,
        interactionId: typeof json.id === 'string' ? json.id : undefined,
        interactionStatus,
        text,
        functionCalls,
      };
    } catch (err) {
      lastStatus = 502;
      lastError = `${model}: ${(err as Error)?.message || 'network failure'}`;
    }
  }

  return {
    ok: false,
    status: lastStatus,
    model: models[0] || CURRENT_CHAT_MODELS[0],
    text: '',
    functionCalls: [],
    error: lastError,
  };
}

export type StreamInteractionEvent =
  | { type: 'created'; id?: string; model: string }
  | { type: 'text_delta'; text: string }
  | { type: 'function_call'; call: InteractionFunctionCall }
  | { type: 'completed'; status?: string }
  | { type: 'error'; status: number; message: string };

export async function* streamGeminiInteraction(opts: {
  apiKey: string;
  input: unknown;
  systemInstruction?: string;
  model?: string;
  tools?: InteractionFunctionTool[];
  previousInteractionId?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): AsyncGenerator<StreamInteractionEvent> {
  const model = opts.model || CURRENT_CHAT_MODELS[0];
  const body: Record<string, unknown> = {
    model,
    input: opts.input,
    stream: true,
  };
  if (opts.systemInstruction) body.system_instruction = opts.systemInstruction;
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.previousInteractionId) body.previous_interaction_id = opts.previousInteractionId;
  if (typeof opts.temperature === 'number' || typeof opts.maxOutputTokens === 'number') {
    body.generation_config = {
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(typeof opts.maxOutputTokens === 'number' ? { max_output_tokens: opts.maxOutputTokens } : {}),
    };
  }

  const res = await fetch(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': opts.apiKey,
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    yield {
      type: 'error',
      status: res.status || 502,
      message: `${model}: HTTP ${res.status} ${errText.slice(0, 160)}`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const activeCalls = new Map<string, { id: string; name: string; argChunks: string[]; args?: Record<string, unknown> }>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineBreak = buffer.indexOf('\n');
    while (lineBreak !== -1) {
      const rawLine = buffer.slice(0, lineBreak).trim();
      buffer = buffer.slice(lineBreak + 1);
      lineBreak = buffer.indexOf('\n');

      if (!rawLine || !rawLine.startsWith('data:')) continue;
      const jsonStr = rawLine.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(jsonStr) as Record<string, unknown>;
      } catch {
        continue;
      }

      const eventType = String(ev.event_type || ev.type || '');
      if (eventType === 'interaction.created') {
        const inter = (ev.interaction || {}) as Record<string, unknown>;
        yield {
          type: 'created',
          id: typeof inter.id === 'string' ? inter.id : typeof ev.interaction_id === 'string' ? ev.interaction_id : undefined,
          model,
        };
      } else if (eventType === 'step.start') {
        const step = (ev.step || {}) as Record<string, unknown>;
        if (step.type === 'function_call') {
          const stepId = String(ev.step_id || step.id || `fc-${activeCalls.size + 1}`);
          activeCalls.set(stepId, {
            id: String(step.id || stepId),
            name: String(step.name || ''),
            argChunks: [],
            args:
              step.arguments && typeof step.arguments === 'object'
                ? (step.arguments as Record<string, unknown>)
                : undefined,
          });
        }
      } else if (eventType === 'step.delta') {
        const delta = (ev.delta || {}) as Record<string, unknown>;
        const deltaType = String(delta.type || '');
        if (deltaType === 'text' && typeof delta.text === 'string' && delta.text.length > 0) {
          yield { type: 'text_delta', text: delta.text };
        } else if (deltaType === 'arguments_delta' && typeof delta.arguments === 'string') {
          const stepId = String(ev.step_id || delta.step_id || '');
          const entry = activeCalls.get(stepId);
          if (entry) entry.argChunks.push(delta.arguments);
        }
      } else if (eventType === 'step.stop') {
        const stepId = String(ev.step_id || '');
        const entry = activeCalls.get(stepId);
        if (entry && entry.name) {
          let parsedArgs = entry.args || {};
          if (entry.argChunks.length > 0) {
            try {
              parsedArgs = JSON.parse(entry.argChunks.join('')) as Record<string, unknown>;
            } catch {
              /* retain empty or start args */
            }
          }
          yield {
            type: 'function_call',
            call: {
              id: entry.id,
              name: entry.name,
              arguments: parsedArgs,
            },
          };
          activeCalls.delete(stepId);
        }
      } else if (eventType === 'interaction.completed') {
        const inter = (ev.interaction || {}) as Record<string, unknown>;
        yield {
          type: 'completed',
          status: typeof inter.status === 'string' ? inter.status : 'completed',
        };
      }
    }
  }
}

export interface CelestiaServerProposedAction {
  id: string;
  kind: 'place_order' | 'navigate';
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status?: 'pending' | 'approved' | 'dismissed';
}

export const CELESTIA_SERVER_TOOLS: InteractionFunctionTool[] = [
  {
    type: 'function',
    name: 'get_facility_live_census',
    description:
      'Retrieve live inpatient bed occupancy, active OPD visits, open clinical orders, and critical vital sign alerts for the hospital facility.',
    parameters: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description: 'Optional focus area: beds, queue, orders, or safety.',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'audit_drug_safety',
    description:
      'Run the clinical prescription safety guard for a medication against allergies, concurrent medications, pregnancy, renal function, paediatrics, and genotype/G6PD.',
    parameters: {
      type: 'object',
      properties: {
        drugName: { type: 'string', description: 'Proposed medication with strength if known.' },
        patientId: { type: 'string', description: 'Optional patient ID or hospital number.' },
        allergies: { type: 'array', items: { type: 'string' } },
        otherDrugs: { type: 'array', items: { type: 'string' } },
        isPregnant: { type: 'boolean' },
        egfr: { type: 'number' },
        ageYears: { type: 'number' },
        genotype: { type: 'string' },
      },
      required: ['drugName'],
    },
  },
  {
    type: 'function',
    name: 'propose_clinical_order',
    description:
      'Prepare a clinician-reviewable lab, imaging, or prescription order card. Never auto-signs; requires explicit doctor confirmation.',
    parameters: {
      type: 'object',
      properties: {
        orderType: { type: 'string', enum: ['lab', 'rx', 'imaging', 'procedure'] },
        name: { type: 'string', description: 'Order or medication name (with dosage if rx).' },
        code: { type: 'string', description: 'Short clinical code (e.g. LAB-FBC, RX-ACT).' },
        priority: { type: 'string', enum: ['routine', 'urgent', 'stat'] },
        patientRef: { type: 'string', description: 'Patient name, ID, or hospital number.' },
        rationale: { type: 'string', description: 'Brief clinical justification.' },
      },
      required: ['orderType', 'name', 'patientRef'],
    },
  },
  {
    type: 'function',
    name: 'navigate_emr_module',
    description:
      'Offer a one-click navigation card to open a MedCore Hospital OS workspace module.',
    parameters: {
      type: 'object',
      properties: {
        moduleKey: {
          type: 'string',
          enum: [
            'doctor-portal',
            'nursing-station',
            'pharmacy',
            'laboratory',
            'radiology',
            'bed-management',
            'reception',
            'billing-pos',
            'clinical-orders',
            'clinical-ai-automations',
          ],
        },
        reason: { type: 'string' },
      },
      required: ['moduleKey'],
    },
  },
];

const MODULE_LABELS: Record<string, string> = {
  'doctor-portal': 'Doctor Consultation Desk',
  'nursing-station': 'Nursing Triage & Ward Station',
  pharmacy: 'Pharmacy & Dispensary',
  laboratory: 'Laboratory Information System',
  radiology: 'Radiology & PACS',
  'bed-management': 'Bed & Ward Occupancy',
  reception: 'Reception & Front Desk',
  'billing-pos': 'Accounts & AkwaRemit Cashier',
  'clinical-orders': 'Clinical Orders & BPA',
  'clinical-ai-automations': 'Clinical Safety Radar & Automations',
};

export async function executeCelestiaServerTool(
  call: InteractionFunctionCall,
  ctx: { facilityId: string; roleKey?: string }
): Promise<{
  result: Record<string, unknown>;
  traceLabel: string;
  proposedAction?: CelestiaServerProposedAction;
}> {
  const facilityId = String(ctx.facilityId || 'IGH-EKT').trim().toUpperCase();
  const args = call.arguments || {};

  if (call.name === 'get_facility_live_census') {
    if (isPostgresConfigured()) {
      try {
        await ensureSchema();
        const metrics: Record<string, unknown> = { facilityId, source: 'postgres' };
        await withTenantClient(facilityId, async (c) => {
          const beds = await c.query<{ status: string; cnt: string }>(
            `SELECT status, COUNT(*)::text AS cnt FROM inpatient_beds WHERE facility_id = $1 GROUP BY status`,
            [facilityId]
          );
          const visits = await c.query<{ status: string; cnt: string }>(
            `SELECT status, COUNT(*)::text AS cnt FROM reception_visits WHERE facility_id = $1 GROUP BY status`,
            [facilityId]
          );
          const criticalVitals = await c.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM vital_signs WHERE facility_id = $1 AND urgency = 'critical' AND recorded_at > NOW() - INTERVAL '24 hours'`,
            [facilityId]
          );
          metrics.bedsByStatus = Object.fromEntries(beds.rows.map((r) => [r.status, Number(r.cnt)]));
          metrics.visitsByStatus = Object.fromEntries(visits.rows.map((r) => [r.status, Number(r.cnt)]));
          metrics.criticalVitals24h = Number(criticalVitals.rows[0]?.cnt || 0);
        });
        return {
          result: metrics,
          traceLabel: 'Checked live bed census & safety radar',
        };
      } catch (err) {
        return {
          result: {
            facilityId,
            source: 'snapshot_fallback',
            note: `Live database query unavailable (${(err as Error).message}); summarize from facility context.`,
          },
          traceLabel: 'Reviewed facility snapshot',
        };
      }
    }
    return {
      result: {
        facilityId,
        source: 'snapshot_context',
        note: 'Using current session hospital snapshot provided in prompt context.',
      },
      traceLabel: 'Reviewed facility snapshot',
    };
  }

  if (call.name === 'audit_drug_safety') {
    const drugName = String(args.drugName || '').trim();
    const report = evaluatePrescriptionSafetyGuard({
      drugName,
      allergies: Array.isArray(args.allergies) ? (args.allergies as string[]) : undefined,
      otherDrugs: Array.isArray(args.otherDrugs) ? (args.otherDrugs as string[]) : undefined,
      isPregnant: typeof args.isPregnant === 'boolean' ? args.isPregnant : undefined,
      egfr: typeof args.egfr === 'number' ? args.egfr : undefined,
      ageYears: typeof args.ageYears === 'number' ? args.ageYears : undefined,
      genotype: typeof args.genotype === 'string' ? args.genotype : undefined,
    });
    return {
      result: { report },
      traceLabel: `Audited drug safety (${drugName || 'Rx'})`,
    };
  }

  if (call.name === 'propose_clinical_order') {
    const orderType = String(args.orderType || 'lab') as 'lab' | 'rx' | 'imaging' | 'procedure';
    const name = String(args.name || '').trim();
    const code = String(args.code || `${orderType.toUpperCase()}-DRAFT`).trim();
    const priority = (String(args.priority || 'routine') as 'routine' | 'urgent' | 'stat');
    const patientRef = String(args.patientRef || '').trim();
    const rationale = String(args.rationale || '').trim();

    const safety =
      orderType === 'rx' && name
        ? evaluatePrescriptionSafetyGuard({ drugName: name })
        : undefined;

    const proposedAction: CelestiaServerProposedAction = {
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      kind: 'place_order',
      title: `Draft ${orderType.toUpperCase()} Order: ${name}`,
      summary: `Patient: ${patientRef || 'Selected Patient'} · Priority: ${priority.toUpperCase()}${rationale ? ` · ${rationale}` : ''}`,
      payload: {
        orderType,
        name,
        code,
        priority,
        patientRef,
        rationale,
      },
      status: 'pending',
    };

    return {
      result: {
        queuedForClinicianApproval: true,
        orderType,
        name,
        patientRef,
        safetyAlerts: safety?.alerts || [],
      },
      traceLabel: `Prepared ${orderType.toUpperCase()} order draft (${name})`,
      proposedAction,
    };
  }

  if (call.name === 'navigate_emr_module') {
    const moduleKey = String(args.moduleKey || '').trim();
    const label = MODULE_LABELS[moduleKey];
    if (!label) {
      return {
        result: { ok: false, error: `Unknown module key: ${moduleKey}` },
        traceLabel: 'Invalid navigation request',
      };
    }
    const reason = String(args.reason || `Open ${label}`).trim();
    return {
      result: { ok: true, moduleKey, label },
      traceLabel: `Prepared link to ${label}`,
      proposedAction: {
        id: `NAV-${Date.now().toString(36).toUpperCase()}`,
        kind: 'navigate',
        title: `Open ${label}`,
        summary: reason,
        payload: { moduleKey, label },
        status: 'pending',
      },
    };
  }

  return {
    result: { error: `Unknown tool: ${call.name}` },
    traceLabel: `Skipped unknown tool ${call.name}`,
  };
}
