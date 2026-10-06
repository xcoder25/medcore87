/**
 * Clinical UX depth stores — problems, allergies, meds/MAR, vitals, notes, messages, prefs, care team.
 */
import { listOrders } from './clinicalEventBus';
import { todayVisits } from './receptionOpsStore';
import { listPatients, type FacilityPatient } from './patientRegistryStore';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(val));
  window.dispatchEvent(new CustomEvent('medcore-clinical-ux'));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync'));
  try { window.dispatchEvent(new StorageEvent('storage', { key })); } catch { /* ignore */ }
}
export function subscribeClinicalUx(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener('medcore-clinical-ux', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('medcore-clinical-ux', fn);
    window.removeEventListener('storage', fn);
  };
}

// ── Problems ──────────────────────────────────────────────────────────
export interface ProblemEntry {
  id: string;
  facilityId: string;
  patientId: string;
  code?: string;
  name: string;
  status: 'active' | 'resolved' | 'chronic';
  onset?: string;
  notedBy: string;
  notedAt: string;
}
const PROB = 'medcore_os_problems_v1';
export function listProblems(facilityId: string, patientId?: string): ProblemEntry[] {
  return readJson<ProblemEntry[]>(PROB, []).filter(
    (p) => p.facilityId === facilityId && (!patientId || p.patientId === patientId)
  );
}
export function upsertProblem(row: ProblemEntry) {
  const all = readJson<ProblemEntry[]>(PROB, []).filter((p) => p.id !== row.id);
  writeJson(PROB, [row, ...all].slice(0, 2000));
}
export function removeProblem(id: string) {
  writeJson(PROB, readJson<ProblemEntry[]>(PROB, []).filter((p) => p.id !== id));
}

// ── Allergies (structured) ────────────────────────────────────────────
export interface AllergyEntry {
  id: string;
  facilityId: string;
  patientId: string;
  substance: string;
  reaction?: string;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  notedBy: string;
  notedAt: string;
}
const ALLG = 'medcore_os_allergies_v1';
export function listAllergies(facilityId: string, patientId?: string): AllergyEntry[] {
  return readJson<AllergyEntry[]>(ALLG, []).filter(
    (a) => a.facilityId === facilityId && (!patientId || a.patientId === patientId)
  );
}
export function upsertAllergy(row: AllergyEntry) {
  const all = readJson<AllergyEntry[]>(ALLG, []).filter((a) => a.id !== row.id);
  writeJson(ALLG, [row, ...all].slice(0, 2000));
}
export function removeAllergy(id: string) {
  writeJson(ALLG, readJson<AllergyEntry[]>(ALLG, []).filter((a) => a.id !== id));
}

// ── Active meds + MAR ─────────────────────────────────────────────────
export interface ActiveMed {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'active' | 'held' | 'stopped';
  startAt: string;
  stopAt?: string;
  orderedBy: string;
}
export interface MarDose {
  id: string;
  medId: string;
  facilityId: string;
  patientId: string;
  dueAt: string;
  givenAt?: string;
  givenBy?: string;
  status: 'due' | 'given' | 'missed' | 'held';
  note?: string;
}
const MEDS = 'medcore_os_active_meds_v1';
const MAR = 'medcore_os_mar_doses_v1';
export function listActiveMeds(facilityId: string, patientId?: string): ActiveMed[] {
  return readJson<ActiveMed[]>(MEDS, []).filter(
    (m) => m.facilityId === facilityId && (!patientId || m.patientId === patientId)
  );
}
export function upsertActiveMed(m: ActiveMed) {
  const all = readJson<ActiveMed[]>(MEDS, []).filter((x) => x.id !== m.id);
  writeJson(MEDS, [m, ...all].slice(0, 3000));
}
export function listMarDoses(facilityId: string, patientId?: string): MarDose[] {
  return readJson<MarDose[]>(MAR, []).filter(
    (d) => d.facilityId === facilityId && (!patientId || d.patientId === patientId)
  );
}
export function upsertMarDose(d: MarDose) {
  const all = readJson<MarDose[]>(MAR, []).filter((x) => x.id !== d.id);
  writeJson(MAR, [d, ...all].slice(0, 5000));
}
export function generateMarForMed(med: ActiveMed, hoursAhead = 24) {
  const doses: MarDose[] = [];
  const start = Date.now();
  const intervalH =
    /q6|6h/i.test(med.frequency) ? 6 :
    /q8|8h/i.test(med.frequency) ? 8 :
    /q12|12h|bd|bid/i.test(med.frequency) ? 12 :
    /tds|tid|8 hourly/i.test(med.frequency) ? 8 :
    /once|stat/i.test(med.frequency) ? 24 : 8;
  for (let h = 0; h < hoursAhead; h += intervalH) {
    const due = new Date(start + h * 3600_000).toISOString();
    doses.push({
      id: `MAR-${med.id}-${h}`,
      medId: med.id,
      facilityId: med.facilityId,
      patientId: med.patientId,
      dueAt: due,
      status: 'due',
    });
  }
  const all = readJson<MarDose[]>(MAR, []).filter((d) => d.medId !== med.id);
  writeJson(MAR, [...doses, ...all].slice(0, 5000));
}

// ── Vitals flowsheet ──────────────────────────────────────────────────
export interface VitalRow {
  id: string;
  facilityId: string;
  patientId: string;
  at: string;
  bpSys?: number;
  bpDia?: number;
  hr?: number;
  rr?: number;
  spo2?: number;
  temp?: number;
  weightKg?: number;
  recordedBy: string;
}
const VIT = 'medcore_os_vitals_v1';
export function listVitals(facilityId: string, patientId: string): VitalRow[] {
  return readJson<VitalRow[]>(VIT, [])
    .filter((v) => v.facilityId === facilityId && v.patientId === patientId)
    .sort((a, b) => b.at.localeCompare(a.at));
}
export function addVital(v: VitalRow) {
  writeJson(VIT, [v, ...readJson<VitalRow[]>(VIT, [])].slice(0, 5000));
}

// ── Clinical notes ────────────────────────────────────────────────────
export interface ClinicalNote {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  type: 'soap' | 'progress' | 'admission' | 'discharge' | 'procedure';
  title: string;
  body: string;
  author: string;
  authorBadge?: string;
  createdAt: string;
  signed: boolean;
  signedAt?: string;
}
const NOTES = 'medcore_os_clinical_notes_v1';
export function listNotes(facilityId: string, patientId?: string): ClinicalNote[] {
  return readJson<ClinicalNote[]>(NOTES, []).filter(
    (n) => n.facilityId === facilityId && (!patientId || n.patientId === patientId)
  );
}
export function upsertNote(n: ClinicalNote) {
  const all = readJson<ClinicalNote[]>(NOTES, []).filter((x) => x.id !== n.id);
  writeJson(NOTES, [n, ...all].slice(0, 2000));
}
export const NOTE_TEMPLATES: { id: string; label: string; body: string }[] = [
  {
    id: 'soap-opd',
    label: 'SOAP — OPD',
    body: 'S: \nO: Vitals — \nA: \nP: \n',
  },
  {
    id: 'soap-follow',
    label: 'SOAP — Follow-up',
    body: 'S: Interval history — \nO: \nA: \nP: Continue / adjust — \n',
  },
  {
    id: 'admit',
    label: 'Admission note',
    body: 'Reason for admission:\nHistory:\nExam:\nPlan:\n',
  },
  {
    id: 'dc',
    label: 'Discharge summary',
    body: 'Diagnosis:\nHospital course:\nMedications on discharge:\nFollow-up:\nAdvice:\n',
  },
];
/** SmartPhrase-style expanders */
export function expandPhrases(text: string, patient?: FacilityPatient | null): string {
  let out = text;
  out = out.replace(/\.vitals/gi, 'BP __/__  HR __  RR __  SpO2 __%  Temp __°C');
  out = out.replace(/\.allergies/gi, patient?.allergies?.length ? patient.allergies.join(', ') : 'NKDA');
  out = out.replace(/\.name/gi, patient ? `${patient.firstName} ${patient.lastName}` : '[patient]');
  out = out.replace(/\.hn/gi, patient?.hospitalNumber || '[HN]');
  return out;
}

// ── Staff messages ────────────────────────────────────────────────────
export interface StaffMessage {
  id: string;
  facilityId: string;
  fromName: string;
  fromBadge?: string;
  toRole?: string;
  toName?: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
  patientId?: string;
  patientName?: string;
  kind: 'staff' | 'refill' | 'portal' | 'system';
}
const MSG = 'medcore_os_staff_messages_v1';
export function listMessages(facilityId: string): StaffMessage[] {
  return readJson<StaffMessage[]>(MSG, [])
    .filter((m) => m.facilityId === facilityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function sendMessage(m: StaffMessage) {
  writeJson(MSG, [m, ...readJson<StaffMessage[]>(MSG, [])].slice(0, 1000));
}
export function markMessageRead(id: string) {
  const all = readJson<StaffMessage[]>(MSG, []).map((m) => (m.id === id ? { ...m, read: true } : m));
  writeJson(MSG, all);
}

// ── Care team ─────────────────────────────────────────────────────────
export interface CareTeamMember {
  id: string;
  facilityId: string;
  patientId: string;
  role: string;
  name: string;
  badgeId?: string;
  assignedAt: string;
}
const CT = 'medcore_os_care_team_v1';
export function listCareTeam(facilityId: string, patientId: string): CareTeamMember[] {
  return readJson<CareTeamMember[]>(CT, []).filter(
    (c) => c.facilityId === facilityId && c.patientId === patientId
  );
}
export function upsertCareMember(m: CareTeamMember) {
  const all = readJson<CareTeamMember[]>(CT, []).filter((x) => x.id !== m.id);
  writeJson(CT, [m, ...all].slice(0, 2000));
}
export function removeCareMember(id: string) {
  writeJson(CT, readJson<CareTeamMember[]>(CT, []).filter((c) => c.id !== id));
}

// ── User preferences ──────────────────────────────────────────────────
export interface UserPrefs {
  pinnedModules: string[];
  defaultModule?: string;
  favoriteOrderSets: string[];
  density: 'comfortable' | 'compact';
  idleLockMinutes: number;
}
const PREF = 'medcore_os_user_prefs_v1';
export function loadPrefs(userId: string): UserPrefs {
  const map = readJson<Record<string, UserPrefs>>(PREF, {});
  return (
    map[userId] || {
      pinnedModules: [],
      density: 'comfortable',
      idleLockMinutes: 15,
    }
  );
}
export function savePrefs(userId: string, prefs: UserPrefs) {
  const map = readJson<Record<string, UserPrefs>>(PREF, {});
  map[userId] = prefs;
  writeJson(PREF, map);
}

// ── Discharge checklist ───────────────────────────────────────────────
export interface DischargeChecklist {
  patientId: string;
  facilityId: string;
  medsReconciled: boolean;
  followUpSet: boolean;
  instructionsGiven: boolean;
  bedFreed: boolean;
  summarySigned: boolean;
  completedAt?: string;
  by?: string;
}
const DC = 'medcore_os_discharge_v1';
export function getDischarge(facilityId: string, patientId: string): DischargeChecklist | null {
  return (
    readJson<DischargeChecklist[]>(DC, []).find(
      (d) => d.facilityId === facilityId && d.patientId === patientId
    ) || null
  );
}
export function saveDischarge(row: DischargeChecklist) {
  const all = readJson<DischargeChecklist[]>(DC, []).filter(
    (d) => !(d.facilityId === row.facilityId && d.patientId === row.patientId)
  );
  writeJson(DC, [row, ...all].slice(0, 1000));
}

// ── Open chart tabs (multi-patient) ───────────────────────────────────
const TABS = 'medcore_os_open_charts_v1';
export function getOpenCharts(): { patientId: string; name: string; hn: string }[] {
  return readJson(TABS, []);
}
export function setOpenCharts(tabs: { patientId: string; name: string; hn: string }[]) {
  writeJson(TABS, tabs.slice(0, 6));
}
export function addOpenChart(tab: { patientId: string; name: string; hn: string }) {
  const all = getOpenCharts().filter((t) => t.patientId !== tab.patientId);
  setOpenCharts([tab, ...all]);
}
export function removeOpenChart(patientId: string) {
  setOpenCharts(getOpenCharts().filter((t) => t.patientId !== patientId));
}

// ── Telehealth session stubs ──────────────────────────────────────────
export interface TeleSession {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  provider: string;
  status: 'scheduled' | 'live' | 'ended';
  scheduledAt: string;
  notes?: string;
}
const TELE = 'medcore_os_telehealth_v1';
export function listTeleSessions(facilityId: string): TeleSession[] {
  return readJson<TeleSession[]>(TELE, []).filter((t) => t.facilityId === facilityId);
}
export function upsertTeleSession(s: TeleSession) {
  const all = readJson<TeleSession[]>(TELE, []).filter((x) => x.id !== s.id);
  writeJson(TELE, [s, ...all].slice(0, 200));
}

// ── Population / analytics helpers ────────────────────────────────────
export function populationSnapshot(facilityId: string) {
  const pts = listPatients(facilityId);
  const visits = todayVisits(facilityId);
  const orders = listOrders(facilityId);
  const bySex: Record<string, number> = {};
  for (const p of pts) bySex[p.sex || 'U'] = (bySex[p.sex || 'U'] || 0) + 1;
  return {
    registry: pts.length,
    visitsToday: visits.length,
    waiting: visits.filter((v) => v.status === 'waiting').length,
    ordersToday: orders.length,
    bySex,
    chronicHint: pts.filter((p) => (p.allergies || []).length > 0).length,
  };
}
