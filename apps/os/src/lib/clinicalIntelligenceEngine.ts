/**
 * Clinical Intelligence Engine — Epic BPA + Cerner-style order sets,
 * critical-result acknowledgment, duplicate detection, care timeline.
 * Assistive only: clinician remains decision maker. EMR is source of truth.
 */
import { listOrders, type ClinicalOrder, type ClinicalOrderType } from './clinicalEventBus';
import { getPatient, type FacilityPatient } from './patientRegistryStore';
import { todayVisits } from './receptionOpsStore';
import { pushNotification } from './notificationEngine';
import { checkPrescriptionSafety } from './pharmacySafety';

export type BpaLevel = 'hard_stop' | 'warning' | 'info';

export interface BpaAlert {
  id: string;
  level: BpaLevel;
  code: string;
  title: string;
  detail: string;
  /** Epic-style: hard_stop should be acknowledged before override */
  requiresOverride?: boolean;
}

export interface OrderSetItem {
  type: ClinicalOrderType;
  code: string;
  name: string;
  priority?: 'routine' | 'urgent' | 'stat';
}

export interface OrderSet {
  id: string;
  label: string;
  specialty: string;
  items: OrderSetItem[];
  rationale: string;
}

export interface CriticalAck {
  orderId: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  summary: string;
  resultAt: string;
  ackRequired: true;
  ackBy?: string;
  ackAt?: string;
  ackBadge?: string;
}

export interface CareTimelineEvent {
  id: string;
  at: string;
  kind: 'visit' | 'lab' | 'rx' | 'imaging' | 'result' | 'alert' | 'payment' | 'bed';
  title: string;
  detail?: string;
  level?: 'info' | 'warn' | 'critical';
}

const ACK_KEY = 'medcore_os_critical_acks_v1';
const INTEL_EVT = 'medcore-clinical-intelligence';

/** Cerner/Epic-inspired order sets tuned for Nigerian general hospital */
export const ORDER_SETS: OrderSet[] = [
  {
    id: 'os-malaria',
    label: 'Malaria workup',
    specialty: 'OPD / Internal Medicine',
    rationale: 'Fever protocol — RDT + film, FBC, symptomatic Rx path',
    items: [
      { type: 'lab', code: 'MP', name: 'Malaria Parasite (RDT + Film)', priority: 'urgent' },
      { type: 'lab', code: 'FBC', name: 'Full Blood Count (FBC + Diff)', priority: 'urgent' },
      { type: 'rx', code: 'ACT', name: 'Artemether-Lumefantrine 20/120', priority: 'routine' },
      { type: 'rx', code: 'PCM', name: 'Paracetamol 500mg tabs', priority: 'routine' },
    ],
  },
  {
    id: 'os-admit-med',
    label: 'Medical admission set',
    specialty: 'Inpatient',
    rationale: 'Baseline labs before ward admission',
    items: [
      { type: 'lab', code: 'FBC', name: 'Full Blood Count (FBC + Diff)', priority: 'urgent' },
      { type: 'lab', code: 'UEC', name: 'Urea Electrolytes Creatinine', priority: 'urgent' },
      { type: 'lab', code: 'RBS', name: 'Random Blood Sugar', priority: 'routine' },
      { type: 'imaging', code: 'CXR', name: 'Chest X-Ray PA', priority: 'routine' },
    ],
  },
  {
    id: 'os-antenatal',
    label: 'Antenatal booking labs',
    specialty: 'Maternity',
    rationale: 'Standard ANC laboratory panel',
    items: [
      { type: 'lab', code: 'FBC', name: 'Full Blood Count (FBC + Diff)', priority: 'routine' },
      { type: 'lab', code: 'BG', name: 'Blood Group + Rhesus', priority: 'routine' },
      { type: 'lab', code: 'HIV', name: 'HIV Screening', priority: 'routine' },
      { type: 'lab', code: 'HBsAg', name: 'Hepatitis B Surface Antigen', priority: 'routine' },
      { type: 'lab', code: 'VDRL', name: 'Syphilis (VDRL/RPR)', priority: 'routine' },
    ],
  },
  {
    id: 'os-preop',
    label: 'Pre-operative screen',
    specialty: 'Theatre',
    rationale: 'Fitness for anaesthesia — labs + CXR',
    items: [
      { type: 'lab', code: 'FBC', name: 'Full Blood Count (FBC + Diff)', priority: 'urgent' },
      { type: 'lab', code: 'UEC', name: 'Urea Electrolytes Creatinine', priority: 'urgent' },
      { type: 'lab', code: 'BTCT', name: 'Bleeding & Clotting Time', priority: 'routine' },
      { type: 'imaging', code: 'CXR', name: 'Chest X-Ray PA', priority: 'routine' },
    ],
  },
  {
    id: 'os-htn',
    label: 'Hypertension follow-up',
    specialty: 'OPD',
    rationale: 'Chronic care monitoring',
    items: [
      { type: 'lab', code: 'UEC', name: 'Urea Electrolytes Creatinine', priority: 'routine' },
      { type: 'lab', code: 'LFT', name: 'Liver Function Tests', priority: 'routine' },
      { type: 'lab', code: 'LIPID', name: 'Lipid Profile', priority: 'routine' },
    ],
  },
];

const PANIC_PATTERNS =
  /panic|critical|trophozoites|positive.*malaria|mp\s*rdt\s*positive|wbc\s*[<>]?\s*2\.|hb\s*[<>]?\s*7|k\+?\s*[<>]?\s*[2.5]|k\+?\s*[>]?\s*6\.|glucose\s*[<>]?\s*3\.|creatinine\s*[>]?\s*3/i;

function readAcks(): CriticalAck[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAcks(list: CriticalAck[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACK_KEY, JSON.stringify(list.slice(0, 500)));
  window.dispatchEvent(new CustomEvent(INTEL_EVT));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: ACK_KEY } }));
}

/** Pre-order BPA scan — Epic Best Practice Advisory style */
export function evaluateOrderBpa(input: {
  facilityId: string;
  patientId: string;
  type: ClinicalOrderType;
  code: string;
  name: string;
  priority?: string;
}): BpaAlert[] {
  const alerts: BpaAlert[] = [];
  const patient = getPatient(input.patientId);
  const open = listOrders(input.facilityId, { patientId: input.patientId }).filter(
    (o) => o.status !== 'resulted' && o.status !== 'cancelled'
  );

  // Duplicate active order (same code or name within 24h)
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const dup = open.find(
    (o) =>
      o.type === input.type &&
      (o.code.toLowerCase() === input.code.toLowerCase() ||
        o.name.toLowerCase() === input.name.toLowerCase()) &&
      new Date(o.createdAt).getTime() > dayAgo
  );
  if (dup) {
    alerts.push({
      id: `dup-${dup.id}`,
      level: 'warning',
      code: 'DUP_ORDER',
      title: 'Possible duplicate order',
      detail: `${dup.name} already ${dup.status} (ordered ${new Date(dup.createdAt).toLocaleString()}). Confirm before repeating.`,
      requiresOverride: true,
    });
  }

  // Allergy vs Rx (Cerner/Epic pharmacy safety)
  if (input.type === 'rx' && patient) {
    const flags = checkPrescriptionSafety({
      drugName: input.name,
      allergies: patient.allergies,
      otherDrugs: patient.currentMedications,
    });
    for (const f of flags) {
      alerts.push({
        id: `rx-${f.message.slice(0, 16).replace(/[^a-z0-9]/gi, "")}`,
        level: f.level === 'high' ? 'hard_stop' : f.level === 'medium' ? 'warning' : 'info',
        code: 'RX_SAFETY',
        title: f.level === 'high' ? 'Allergy / interaction risk' : 'Pharmacy advisory',
        detail: f.message,
        requiresOverride: f.level === 'high',
      });
    }
  }

  // STAT without clinical context note encouragement
  if (input.priority === 'stat') {
    alerts.push({
      id: 'stat-note',
      level: 'info',
      code: 'STAT_PROTOCOL',
      title: 'STAT priority',
      detail: 'STAT routes to lab/pharmacy queue immediately and notifies duty staff. Use only when clinically indicated.',
    });
  }

  // Pregnancy / chronic hints
  if (patient?.chronicConditions?.some((c) => /pregnan|antenatal/i.test(c))) {
    if (input.type === 'rx' && /doxycycline|ciprofloxacin|warfarin|isotretinoin/i.test(input.name)) {
      alerts.push({
        id: 'preg-rx',
        level: 'hard_stop',
        code: 'PREG_CONTRA',
        title: 'Possible pregnancy contraindication',
        detail: `${input.name} may be unsafe in pregnancy. Verify gestation and choose alternative if indicated.`,
        requiresOverride: true,
      });
    }
  }

  // G6PD / genotype AS mild advisory for certain drugs
  if (patient?.genotype === 'AS' || patient?.genotype === 'SS') {
    if (/primaquine|sulfa|dapsone/i.test(input.name)) {
      alerts.push({
        id: 'g6pd-ish',
        level: 'warning',
        code: 'GENOTYPE_RX',
        title: 'Genotype-related caution',
        detail: `Patient genotype ${patient.genotype}. Review haemolysis risk for ${input.name}.`,
        requiresOverride: true,
      });
    }
  }

  return alerts;
}

/** Alias used by order UIs (same as evaluateOrderBpa) */
export function previewOrderBpa(
  input: {
    facilityId: string;
    patientId: string;
    type: ClinicalOrderType;
    code: string;
    name: string;
    priority?: string;
  }
): BpaAlert[] {
  return evaluateOrderBpa(input);
}

/** After result post — detect critical wording and create ACK requirement */
export function evaluateResultForCritical(order: ClinicalOrder): CriticalAck | null {
  const summary = order.resultSummary || '';
  if (!summary || order.type !== 'lab') return null;
  if (!PANIC_PATTERNS.test(summary)) return null;

  const existing = readAcks().find((a) => a.orderId === order.id);
  if (existing) return existing;

  const ack: CriticalAck = {
    orderId: order.id,
    facilityId: order.facilityId,
    patientId: order.patientId,
    patientName: order.patientName,
    hospitalNumber: order.hospitalNumber,
    summary,
    resultAt: order.resultAt || order.updatedAt,
    ackRequired: true,
  };
  writeAcks([ack, ...readAcks().filter((a) => a.orderId !== order.id)]);
  pushNotification({
    facilityId: order.facilityId,
    level: 'critical',
    title: 'Critical result — acknowledge',
    body: `${order.patientName}: ${summary.slice(0, 120)}`,
    module: 'doctor-portal',
    patientId: order.patientId,
  });
  return ack;
}

export function listPendingCriticalAcks(facilityId: string): CriticalAck[] {
  return readAcks().filter((a) => a.facilityId === facilityId && !a.ackAt);
}


/** Clinician roles that may acknowledge critical results (Epic-style) */
const CLINICAL_ACK_ROLES = new Set([
  'doctor',
  'physician',
  'consultant',
  'medical_officer',
  'medical-officer',
  'clinical_officer',
  'clinical-officer',
  'admin',
  'administrator',
  'platform_admin',
  'sysadmin',
  'mo',
  'surgeon',
  'hospital_admin',
]);

export function canAcknowledgeCritical(roleKey?: string, roleLabel?: string): boolean {
  const raw = `${roleKey || ''} ${roleLabel || ''}`.toLowerCase();
  if (!raw.trim()) return true; // desk without role still doctor portal
  for (const r of CLINICAL_ACK_ROLES) {
    if (raw.includes(r.replace('_', ' ')) || raw.includes(r)) return true;
  }
  // Lab/pharmacy/reception cannot ACK clinical critical results
  if (/lab|pharm|recep|cash|nurse|records|radiol/.test(raw)) return false;
  return true;
}

export function acknowledgeCriticalResult(
  orderId: string,
  by: string,
  badge?: string,
  roleKey?: string
): CriticalAck | undefined {
  if (roleKey && !canAcknowledgeCritical(roleKey)) {
    return undefined;
  }
  const list = readAcks();
  const idx = list.findIndex((a) => a.orderId === orderId);
  if (idx < 0) return undefined;
  const next = {
    ...list[idx],
    ackBy: by,
    ackBadge: badge,
    ackAt: new Date().toISOString(),
  };
  list[idx] = next;
  writeAcks(list);
  pushNotification({
    facilityId: next.facilityId,
    level: 'info',
    title: 'Critical result acknowledged',
    body: `${next.patientName} — ACK by ${by}`,
    module: 'laboratory',
    patientId: next.patientId,
  });
  return next;
}

/** Patient longitudinal care timeline (Cerner chart review style) */
export function buildCareTimeline(facilityId: string, patientId: string): CareTimelineEvent[] {
  const events: CareTimelineEvent[] = [];
  const patient = getPatient(patientId);

  for (const v of todayVisits(facilityId).filter((x) => x.patientId === patientId)) {
    events.push({
      id: `v-${v.id}`,
      at: v.checkedInAt,
      kind: 'visit',
      title: `Check-in · ${v.department}`,
      detail: `${v.visitType} · ${v.queueNumber} · ${v.status}`,
      level: v.status === 'waiting' ? 'warn' : 'info',
    });
  }

  for (const o of listOrders(facilityId, { patientId })) {
    events.push({
      id: `o-${o.id}`,
      at: o.createdAt,
      kind: o.type === 'lab' ? 'lab' : o.type === 'rx' ? 'rx' : 'imaging',
      title: `Order · ${o.name}`,
      detail: `${o.priority} · ${o.status} · by ${o.orderedBy}`,
      level: o.priority === 'stat' ? 'critical' : 'info',
    });
    if (o.status === 'resulted' && o.resultAt) {
      const crit = PANIC_PATTERNS.test(o.resultSummary || '');
      events.push({
        id: `r-${o.id}`,
        at: o.resultAt,
        kind: 'result',
        title: `Result · ${o.name}`,
        detail: o.resultSummary,
        level: crit ? 'critical' : 'info',
      });
    }
  }

  for (const a of readAcks().filter((x) => x.patientId === patientId)) {
    events.push({
      id: `a-${a.orderId}`,
      at: a.resultAt,
      kind: 'alert',
      title: a.ackAt ? `Critical ACK · ${a.ackBy}` : 'Critical result pending ACK',
      detail: a.summary,
      level: a.ackAt ? 'info' : 'critical',
    });
  }

  if (patient?.allergies?.length) {
    events.push({
      id: 'allergy',
      at: patient.registeredAt,
      kind: 'alert',
      title: 'Allergies on file',
      detail: patient.allergies.join(', '),
      level: 'warn',
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

/** Realtime facility intelligence pulse (Epic Situational Awareness lite) */
export function facilityIntelligencePulse(facilityId: string): {
  criticalAcks: number;
  openStat: number;
  longWait: number;
  hardStopsToday: number;
  headline: string;
  level: 'ok' | 'warn' | 'critical';
} {
  const pending = listPendingCriticalAcks(facilityId);
  const orders = listOrders(facilityId);
  const openStat = orders.filter((o) => o.priority === 'stat' && o.status !== 'resulted' && o.status !== 'cancelled').length;
  const longWait = todayVisits(facilityId).filter((v) => {
    if (v.status !== 'waiting' && v.status !== 'called') return false;
    return (Date.now() - new Date(v.checkedInAt).getTime()) / 60000 > 40;
  }).length;

  let level: 'ok' | 'warn' | 'critical' = 'ok';
  let headline = 'Clinical intelligence steady — no hard stops pending.';
  if (pending.length > 0) {
    level = 'critical';
    headline = `${pending.length} critical lab result(s) need clinician acknowledgment.`;
  } else if (openStat > 0 || longWait > 2) {
    level = 'warn';
    headline = `${openStat} open STAT order(s) · ${longWait} long waits (>40 min).`;
  }

  return {
    criticalAcks: pending.length,
    openStat,
    longWait,
    hardStopsToday: pending.length,
    headline,
    level,
  };
}

export function getOrderSet(id: string): OrderSet | undefined {
  return ORDER_SETS.find((s) => s.id === id);
}

export function subscribeIntelligence(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(INTEL_EVT, fn);
  window.addEventListener('medcore-clinical-orders', fn);
  window.addEventListener('medcore-admin-sync', fn);
  return () => {
    window.removeEventListener(INTEL_EVT, fn);
    window.removeEventListener('medcore-clinical-orders', fn);
    window.removeEventListener('medcore-admin-sync', fn);
  };
}
