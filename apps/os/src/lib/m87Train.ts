/**
 * Celestia super training script — harvest hospital live data, score examples,
 * rebuild local vocabulary model, produce RAG pack for Gemini.
 *
 * Run from UI ("Train Celestia") or call runM87Training(facilityId) from code.
 */

import {
  listExamples,
  listFeedback,
  upsertExample,
  getModelState,
  saveModelState,
  M87_SEED_CARDS,
  type M87TrainingExample,
  type M87ModelState,
} from './m87LearningStore';
import { todayVisits } from './receptionOpsStore';
import { listOrders } from './clinicalEventBus';
import { listPatients, countPatients } from './patientRegistryStore';
import { listBeds } from './bedBoardStore';
import { getStaffRegistry } from './adminRealtimeStore';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Harvest operational facts into training examples (supervised targets). */
export function harvestHospitalKnowledge(facilityId: string): M87TrainingExample[] {
  const created: M87TrainingExample[] = [];
  const visits = todayVisits(facilityId);
  const orders = listOrders(facilityId);
  const patients = listPatients(facilityId);
  const beds = listBeds(facilityId);
  const staff = getStaffRegistry();

  const waiting = visits.filter((v) => v.status === 'waiting' || v.status === 'called').length;
  const withProv = visits.filter((v) => v.status === 'with_provider').length;
  const labOpen = orders.filter((o) => o.type === 'lab' && o.status !== 'resulted').length;
  const rxOpen = orders.filter((o) => o.type === 'rx' && o.status !== 'resulted').length;
  const occ = beds.filter((b) => b.status === 'occupied').length;
  const free = beds.filter((b) => b.status === 'available').length;

  const pack: { input: string; output: string; tags: string[] }[] = [
    {
      input: 'How busy is OPD right now?',
      output: `Today at this facility: ${visits.length} check-ins, ${waiting} waiting, ${withProv} with provider. Use Patient Flow or Clinic board to act.`,
      tags: ['queue', 'opd', 'ops'],
    },
    {
      input: 'Summarise lab and pharmacy workload',
      output: `Open lab orders: ${labOpen}. Open prescriptions: ${rxOpen}. Complete results/dispense on Laboratory and Pharmacy desks so clinicians see updates.`,
      tags: ['lab', 'pharmacy', 'ops'],
    },
    {
      input: 'Bed situation?',
      output: `Beds: ${occ} occupied, ${free} available (${beds.length} on board). Admit/discharge from Bed & Ward Occupancy.`,
      tags: ['beds', 'ops'],
    },
    {
      input: 'How many patients are registered?',
      output: `${patients.length} patients on the facility registry. Register new ones from Reception.`,
      tags: ['patients', 'registry'],
    },
    {
      input: 'Staff roster size?',
      output: `${Array.isArray(staff) ? staff.length : 0} staff records in registry. Enrol new staff under Staff Enrolment & ID.`,
      tags: ['staff', 'admin'],
    },
  ];

  for (const p of pack) {
    created.push(
      upsertExample({
        facilityId,
        input: p.input,
        idealOutput: p.output,
        tags: p.tags,
        source: 'harvest',
        score: 0.85,
      })
    );
  }

  // Seed domain cards as examples once
  for (const card of M87_SEED_CARDS) {
    created.push(
      upsertExample({
        facilityId: '*',
        input: `Explain: ${card.title}`,
        idealOutput: card.body,
        tags: card.tags,
        source: 'seed',
        score: 0.9,
      })
    );
  }

  return created;
}

/** Build bag-of-words model from examples + positive feedback. */
export function trainLocalModel(facilityId: string): M87ModelState {
  const examples = listExamples(facilityId);
  const feedback = listFeedback(facilityId).filter((f) => f.rating === 1);
  const vocab: Record<string, number> = {};
  const tagTerms: Record<string, Record<string, number>> = {};

  const consume = (text: string, tags: string[], weight: number) => {
    for (const tok of tokenize(text)) {
      vocab[tok] = (vocab[tok] || 0) + weight;
      for (const tag of tags) {
        if (!tagTerms[tag]) tagTerms[tag] = {};
        tagTerms[tag][tok] = (tagTerms[tag][tok] || 0) + weight;
      }
    }
  };

  for (const ex of examples) {
    consume(`${ex.input} ${ex.idealOutput}`, ex.tags, ex.score);
  }
  for (const fb of feedback) {
    consume(`${fb.prompt} ${fb.response}`, ['feedback'], 1.2);
  }

  const tagTop: Record<string, string[]> = {};
  for (const [tag, counts] of Object.entries(tagTerms)) {
    tagTop[tag] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([w]) => w);
  }

  const state: M87ModelState = {
    version: `m87-local-${Date.now().toString(36)}`,
    trainedAt: new Date().toISOString(),
    exampleCount: examples.length,
    feedbackCount: feedback.length,
    vocabulary: vocab,
    tagTerms: tagTop,
    lastHarvestAt: new Date().toISOString(),
  };
  saveModelState(state);
  return state;
}

/** Full super-train pipeline */
export function runM87Training(facilityId: string): {
  harvested: number;
  model: M87ModelState;
  summary: string;
} {
  const harvested = harvestHospitalKnowledge(facilityId);
  const model = trainLocalModel(facilityId);
  const summary = `Celestia trained · v${model.version} · ${model.exampleCount} examples · ${model.feedbackCount} positive feedback · harvested ${harvested.length} live facts · ${Object.keys(model.vocabulary).length} terms`;
  return { harvested: harvested.length, model, summary };
}

/** Retrieve top-k examples for RAG context */
export function retrieveRelevantExamples(query: string, facilityId: string, k = 5): M87TrainingExample[] {
  const qTokens = new Set(tokenize(query));
  const examples = listExamples(facilityId);
  const model = getModelState();

  const scored = examples.map((ex) => {
    const tokens = tokenize(`${ex.input} ${ex.idealOutput} ${ex.tags.join(' ')}`);
    let score = 0;
    for (const t of tokens) {
      if (qTokens.has(t)) score += 1 + (model?.vocabulary[t] ? Math.log(1 + model.vocabulary[t]) * 0.05 : 0);
    }
    score *= ex.score;
    return { ex, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.ex);
}

/** Build system context string for Gemini */
export function buildM87RagContext(query: string, facilityId: string): string {
  const hits = retrieveRelevantExamples(query, facilityId, 5);
  const cards = M87_SEED_CARDS.filter((c) => {
    const q = query.toLowerCase();
    return c.tags.some((t) => q.includes(t)) || c.title.toLowerCase().split(' ').some((w) => q.includes(w));
  }).slice(0, 3);

  const parts: string[] = ['### Celestia learned knowledge (use if relevant, do not invent patients)'];
  // Live registry facts so answers about "how many / who" stay accurate
  try {
    const n = countPatients(facilityId);
    const sample = listPatients(facilityId)
      .slice(0, 15)
      .map((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
        return `${name} (${p.hospitalNumber})`;
      });
    parts.push(
      `### Live facility registry\nCount: ${n}\n` +
        (sample.length ? `Patients: ${sample.join('; ')}` : 'Patients: (none)')
    );
  } catch {
    /* ignore */
  }
  for (const h of hits) {
    parts.push(`Q: ${h.input}\nA: ${h.idealOutput}`);
  }
  for (const c of cards) {
    parts.push(`Policy — ${c.title}: ${c.body}`);
  }
  if (parts.length === 1) {
    parts.push('(No strong local matches — answer carefully from general hospital practice.)');
  }
  return parts.join('\n\n');
}
