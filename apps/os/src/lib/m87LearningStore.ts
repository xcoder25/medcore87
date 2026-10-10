/**
 * Celestia super-learning store — local-first memory the model trains / retrieves from.
 * Not a neural net weights file: supervised examples + feedback + domain cards
 * that are injected into Gemini (RAG) and used by the local scorer.
 */

export type ExampleSource = 'chat' | 'feedback' | 'harvest' | 'seed' | 'manual';

export interface M87TrainingExample {
  id: string;
  facilityId: string;
  input: string;
  idealOutput: string;
  tags: string[];
  role?: string;
  source: ExampleSource;
  score: number; // quality 0–1
  createdAt: string;
  updatedAt: string;
}

export interface M87Feedback {
  id: string;
  facilityId: string;
  messageId?: string;
  prompt: string;
  response: string;
  rating: 1 | -1;
  note?: string;
  createdAt: string;
}

export interface M87DomainCard {
  id: string;
  title: string;
  body: string;
  tags: string[];
  facilityId?: string;
}

export interface M87ModelState {
  version: string;
  trainedAt: string;
  exampleCount: number;
  feedbackCount: number;
  vocabulary: Record<string, number>;
  /** top terms per tag for local routing */
  tagTerms: Record<string, string[]>;
  lastHarvestAt?: string;
}

const EX_KEY = 'medcore_m87_training_examples_v1';
const FB_KEY = 'medcore_m87_feedback_v1';
const MODEL_KEY = 'medcore_m87_model_state_v1';
const EVT = 'medcore-m87-learn';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVT, { detail: { key } }));
}

export function listExamples(facilityId?: string): M87TrainingExample[] {
  const all = readJson<M87TrainingExample[]>(EX_KEY, []);
  if (!facilityId) return all;
  return all.filter((e) => e.facilityId === facilityId || e.facilityId === '*');
}

export function upsertExample(ex: Omit<M87TrainingExample, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const all = readJson<M87TrainingExample[]>(EX_KEY, []);
  const now = new Date().toISOString();
  if (ex.id) {
    const i = all.findIndex((x) => x.id === ex.id);
    if (i >= 0) {
      all[i] = { ...all[i], ...ex, id: ex.id, updatedAt: now };
      writeJson(EX_KEY, all.slice(0, 2000));
      return all[i];
    }
  }
  const row: M87TrainingExample = {
    ...ex,
    id: `EX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now,
    score: ex.score ?? 0.7,
  };
  writeJson(EX_KEY, [row, ...all].slice(0, 2000));
  return row;
}

export function listFeedback(facilityId?: string): M87Feedback[] {
  const all = readJson<M87Feedback[]>(FB_KEY, []);
  if (!facilityId) return all;
  return all.filter((f) => f.facilityId === facilityId);
}

export function addFeedback(fb: Omit<M87Feedback, 'id' | 'createdAt'>) {
  const all = readJson<M87Feedback[]>(FB_KEY, []);
  const row: M87Feedback = {
    ...fb,
    id: `FB-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
  writeJson(FB_KEY, [row, ...all].slice(0, 1000));
  // Promote good answers into training set
  if (fb.rating === 1 && fb.prompt && fb.response) {
    upsertExample({
      facilityId: fb.facilityId,
      input: fb.prompt,
      idealOutput: fb.response,
      tags: ['feedback_positive'],
      source: 'feedback',
      score: 0.95,
    });
  }
  return row;
}

export function getModelState(): M87ModelState | null {
  return readJson<M87ModelState | null>(MODEL_KEY, null);
}

export function saveModelState(state: M87ModelState) {
  writeJson(MODEL_KEY, state);
}

export function subscribeM87Learn(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

/** Seed Nigerian / Akwa Ibom hospital domain cards (always available). */
export const M87_SEED_CARDS: M87DomainCard[
  {
    id: 'seed-registry-count',
    title: 'Facility patient registry',
    body: 'When staff ask how many patients or who is on the registry, use live facility data (count + names + hospital numbers). Never invent patients. After a count, if they ask who/names, list the actual registry entries.',
    tags: ['registry', 'patients', 'reception', 'names', 'count'],
  },
] = [
  {
    id: 'seed-nhis',
    title: 'NHIS / HMO at reception',
    body: 'Verify eligibility before billing. Capture scheme name, member ID, and auth code when required. Cash alternative if verification fails offline.',
    tags: ['nhis', 'hmo', 'billing', 'reception'],
  },
  {
    id: 'seed-triage',
    title: 'Triage priorities',
    body: 'ESI-style: airway/breathing/circulation first. Fever + altered mental status is high priority. Paediatric danger signs: lethargy, inability to drink, convulsions.',
    tags: ['triage', 'emergency', 'clinical'],
  },
  {
    id: 'seed-lab-loop',
    title: 'Closed lab loop',
    body: 'Doctor orders → lab collects → result on clinical bus → doctor Results ready. Panic values require verbal notify + document.',
    tags: ['lab', 'clinical', 'orders'],
  },
  {
    id: 'seed-rx',
    title: 'Pharmacy dispensing',
    body: 'Dispense from active Rx on clinical bus. Check allergy flags when present. Mark dispensed so clinical desk updates.',
    tags: ['pharmacy', 'rx', 'safety'],
  },
  {
    id: 'seed-offline',
    title: 'Offline hospital mode',
    body: 'Write local first, outbox to LAN hub on UPS, cloud when online. Never block registration on network loss.',
    tags: ['offline', 'ops', 'sync'],
  },
  {
    id: 'seed-ndpr',
    title: 'NDPR patient data',
    body: 'Collect minimum necessary data. Role-based access only. Audit staff access. No sharing outside care team without basis.',
    tags: ['privacy', 'ndpr', 'compliance'],
  },
  {
    id: 'seed-queue',
    title: 'OPD queue etiquette',
    body: 'Call by queue number, mark with provider when doctor starts, complete when finished. AI reminders for long waits.',
    tags: ['queue', 'reception', 'opd'],
  },
  {
    id: 'seed-enrol',
    title: 'Staff enrolment',
    body: 'Admin enrols staff → badge ID + PIN → ID card. Staff sign in with badge + PIN. Delete only via admin access control.',
    tags: ['staff', 'rbac', 'admin'],
  },
];
