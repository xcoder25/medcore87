/**
 * Maternity EMR store — Epic Stork / Cerner PowerChart–class OB workflows.
 * ANC → Triage (MFTI) → Labour → Delivery → Newborn link → Postpartum.
 * Local-first + CustomEvent realtime.
 */

export type MatRisk = 'low' | 'moderate' | 'high' | 'critical';
export type MatStage =
  | 'anc'
  | 'triage'
  | 'admitted_labour'
  | 'active_labour'
  | 'second_stage'
  | 'delivered'
  | 'postnatal'
  | 'discharged';

export type DeliveryMode =
  | 'svd'
  | 'assisted'
  | 'elective_cs'
  | 'emergency_cs'
  | 'unknown';

/** Maternal Fetal Triage Index (Epic MFTI-style 1–5) */
export type MftiLevel = 1 | 2 | 3 | 4 | 5;

export type GbsStatus = 'unknown' | 'negative' | 'positive' | 'pending';
export type RomStatus = 'intact' | 'spontaneous' | 'artificial' | 'unknown';
export type Presentation = 'cephalic' | 'breech' | 'transverse' | 'unknown';

export interface MatPartographPoint {
  at: string;
  dilationCm: number;
  /** −3 to +3 */
  station?: number;
  effacementPct?: number;
  fhrBpm: number;
  contractionsPer10Min: number;
  bp?: string;
  pulse?: number;
  tempC?: number;
  notes?: string;
}

export interface MaternityRecord {
  id: string;
  facilityId: string;
  patientName: string;
  hospitalNumber?: string;
  age?: number;
  phone?: string;
  gravidaPara: string;
  gravida?: number;
  para?: number;
  lmp?: string;
  edd?: string;
  gaWeeks?: number;
  gaDays?: number;
  bloodGroup?: string;
  rhesus?: 'positive' | 'negative' | 'unknown';
  gbs?: GbsStatus;
  hivStatus?: 'unknown' | 'negative' | 'positive' | 'on_art';
  allergies?: string;
  riskFactors?: string[];
  risk: MatRisk;
  stage: MatStage;
  /** Epic MFTI 1=stat … 5=non-urgent */
  mfti?: MftiLevel;
  bedNo?: string;
  midwifeOnDuty?: string;
  providerOnDuty?: string;
  /** Labour */
  cervicalDilationCm?: number;
  effacementPct?: number;
  station?: number;
  fetalHeartRateBpm?: number;
  contractionsPer10Min?: number;
  romStatus?: RomStatus;
  romAt?: string;
  presentation?: Presentation;
  plannedMode?: DeliveryMode;
  partograph: MatPartographPoint[];
  /** Delivery */
  delivered?: boolean;
  deliveryMode?: DeliveryMode;
  deliveryAt?: string;
  placentaAt?: string;
  laceration?: string;
  episiotomy?: boolean;
  eblMl?: number;
  qblMl?: number;
  babyGender?: 'Male' | 'Female';
  birthWeightKg?: number;
  birthWeightG?: number;
  apgar1?: number;
  apgar5?: number;
  apgar10?: number;
  babyName?: string;
  newbornId?: string;
  skinToSkin?: boolean;
  cordClampedAt?: string;
  /** Postnatal */
  pph?: boolean;
  pphRisk?: 'low' | 'medium' | 'high';
  breastfeeding?: boolean;
  postnatalDay?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'medcore_os_maternity_v2';
export const MATERNITY_EVENT = 'medcore-maternity-sync';

type State = { records: MaternityRecord[] };

function load(): State {
  if (typeof window === 'undefined') return { records: [] };
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('medcore_os_maternity_v1');
    if (!raw) return { records: [] };
    const p = JSON.parse(raw);
    return { records: Array.isArray(p.records) ? p.records : [] };
  } catch {
    return { records: [] };
  }
}

function save(state: State) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
  try {
    window.dispatchEvent(new CustomEvent(MATERNITY_EVENT, { detail: state }));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  } catch {
    /* ignore */
  }
}

export function listMaternity(facilityId: string): MaternityRecord[] {
  return load()
    .records.filter((r) => r.facilityId === facilityId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getMaternity(id: string): MaternityRecord | undefined {
  return load().records.find((r) => r.id === id);
}

export function upsertMaternity(rec: MaternityRecord): MaternityRecord {
  const state = load();
  const i = state.records.findIndex((r) => r.id === rec.id);
  const next = { ...rec, updatedAt: new Date().toISOString() };
  if (i >= 0) state.records[i] = next;
  else state.records = [next, ...state.records];
  save(state);
  return next;
}

export function removeMaternity(id: string) {
  const state = load();
  state.records = state.records.filter((r) => r.id !== id);
  save(state);
}

export function subscribeMaternity(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(MATERNITY_EVENT, handler);
  window.addEventListener('storage', handler);
  window.addEventListener('medcore-admin-sync', handler);
  return () => {
    window.removeEventListener(MATERNITY_EVENT, handler);
    window.removeEventListener('storage', handler);
    window.removeEventListener('medcore-admin-sync', handler);
  };
}

export function newMaternityId(): string {
  return `MAT-${Date.now().toString(36).toUpperCase()}`;
}

export function newNewbornId(): string {
  return `NB-${Date.now().toString(36).toUpperCase()}`;
}

/** CTG / labour pulse for active cases */
export function pulseActiveLabour(facilityId: string) {
  const state = load();
  let changed = false;
  state.records = state.records.map((r) => {
    if (r.facilityId !== facilityId) return r;
    if (!['admitted_labour', 'active_labour', 'second_stage'].includes(r.stage) || r.delivered) {
      return r;
    }
    const fhr = r.fetalHeartRateBpm ?? 140;
    const dil = r.cervicalDilationCm ?? 3;
    const ctx = r.contractionsPer10Min ?? 3;
    const fhrDelta = Math.random() > 0.5 ? 1 : -1;
    const nextFhr = Math.round(
      Math.max(
        100,
        Math.min(180, fhr + (Math.random() > 0.4 ? fhrDelta * (2 + Math.floor(Math.random() * 4)) : 0))
      )
    );
    const nextDil = dil < 10 && Math.random() > 0.85 ? Math.min(10, Math.round((dil + 0.5) * 10) / 10) : dil;
    const nextCtx =
      Math.random() > 0.7 ? Math.max(1, Math.min(5, ctx + (Math.random() > 0.5 ? 1 : -1))) : ctx;
    let risk = r.risk;
    if (nextFhr > 160 || nextFhr < 110) risk = 'critical';
    else if (nextFhr > 155 || nextDil >= 8) risk = risk === 'critical' ? 'critical' : 'high';
    const nextStage = nextDil >= 10 ? 'second_stage' : nextDil >= 4 ? 'active_labour' : r.stage;
    // Only persist when vitals/stage actually moved — stops save→event→re-render shake loop
    if (
      nextFhr === fhr &&
      nextDil === dil &&
      nextCtx === ctx &&
      risk === r.risk &&
      nextStage === r.stage
    ) {
      return r;
    }
    changed = true;
    return {
      ...r,
      fetalHeartRateBpm: nextFhr,
      cervicalDilationCm: nextDil,
      contractionsPer10Min: nextCtx,
      risk,
      stage: nextStage,
      updatedAt: new Date().toISOString(),
    };
  });
  if (changed) save(state);
}

export function maternityKpis(facilityId: string) {
  const all = listMaternity(facilityId);
  const inLabour = all.filter((r) =>
    ['admitted_labour', 'active_labour', 'second_stage', 'triage'].includes(r.stage)
  );
  const anc = all.filter((r) => r.stage === 'anc');
  const postnatal = all.filter((r) => r.stage === 'postnatal');
  const deliveredToday = all.filter((r) => {
    if (!r.deliveryAt) return false;
    return r.deliveryAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
  });
  const highRisk = all.filter((r) => r.risk === 'high' || r.risk === 'critical');
  const critical = all.filter((r) => r.risk === 'critical' || r.mfti === 1 || r.mfti === 2);
  const triage = all.filter((r) => r.stage === 'triage');
  return {
    total: all.length,
    inLabour: inLabour.length,
    anc: anc.length,
    postnatal: postnatal.length,
    deliveredToday: deliveredToday.length,
    highRisk: highRisk.length,
    critical: critical.length,
    triage: triage.length,
  };
}

export const MFTI_META: Record<
  MftiLevel,
  { label: string; color: string; bg: string; desc: string }
> = {
  1: { label: 'MFTI 1 · STAT', color: '#DC2626', bg: '#FEF2F2', desc: 'Immediate threat to life' },
  2: { label: 'MFTI 2 · Urgent', color: '#EA580C', bg: '#FFF7ED', desc: 'High risk · rapid eval' },
  3: { label: 'MFTI 3 · Prompt', color: '#D97706', bg: '#FFFBEB', desc: 'Needs timely assessment' },
  4: { label: 'MFTI 4 · Semi-urgent', color: '#2563EB', bg: '#EFF6FF', desc: 'Can wait briefly' },
  5: { label: 'MFTI 5 · Non-urgent', color: '#059669', bg: '#ECFDF5', desc: 'Routine / scheduled' },
};

export const STAGE_LABEL: Record<MatStage, string> = {
  anc: 'Antenatal',
  triage: 'OB Triage',
  admitted_labour: 'Latent labour',
  active_labour: 'Active labour',
  second_stage: '2nd stage',
  delivered: 'Delivered',
  postnatal: 'Postpartum',
  discharged: 'Discharged',
};

export const MODE_LABEL: Record<DeliveryMode, string> = {
  svd: 'Spontaneous vaginal',
  assisted: 'Assisted vaginal',
  elective_cs: 'Elective CS',
  emergency_cs: 'Emergency CS',
  unknown: '—',
};
