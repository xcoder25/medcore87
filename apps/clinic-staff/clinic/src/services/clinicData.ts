/** Shared clinical mock data + light realtime drift for MedCore Clinic */

export type Patient = {
  id: string;
  bed: string;
  mrn: string;
  name: string;
  age: string;
  dx: string;
  news: number;
  high: boolean;
  vitals: string[];
  allergies?: string;
  codeStatus?: string;
};

export type Task = {
  id: string;
  title: string;
  patient: string;
  bed: string;
  priority: 'stat' | 'urgent' | 'routine';
  due: string;
  status: 'open' | 'done';
  type: string;
};

export type Order = {
  id: string;
  type: 'Lab' | 'Imaging' | 'Pharmacy' | 'Nursing';
  name: string;
  patient: string;
  bed: string;
  status: 'pending' | 'in-progress' | 'resulted' | 'acknowledged';
  orderedAt: string;
  critical?: boolean;
};

export type MedDose = {
  id: string;
  drug: string;
  patient: string;
  bed: string;
  due: string;
  status: 'due' | 'overdue' | 'given';
  route: string;
  givenAt?: string;
  eml?: boolean;
  aware?: string;
};

export let PATIENTS: Patient[] = [
  {
    id: 'p1',
    bed: '4B',
    mrn: 'MRN-849102',
    name: 'Robert Chen',
    age: '62 M',
    dx: 'Acute NSTEMI · Post-PCI Day 1',
    news: 5,
    high: true,
    vitals: ['142/88', '94 bpm', '96%', '37.4°C'],
    allergies: 'Penicillin',
    codeStatus: 'Full Code',
  },
  {
    id: 'p2',
    bed: '5A',
    mrn: 'MRN-773199',
    name: 'Margaret Taylor',
    age: '74 F',
    dx: 'CHF · NYHA Class III',
    news: 1,
    high: false,
    vitals: ['120/78', '72 bpm', '98%', '36.8°C'],
    allergies: 'NKDA',
    codeStatus: 'Full Code',
  },
  {
    id: 'p3',
    bed: '6C',
    mrn: 'MRN-552881',
    name: 'Aisha Okonkwo',
    age: '45 F',
    dx: 'Post-CABG Day 3 · AF',
    news: 2,
    high: false,
    vitals: ['128/76', '88 bpm', '97%', '37.1°C'],
    allergies: 'Sulfa',
    codeStatus: 'Full Code',
  },
  {
    id: 'p4',
    bed: '7A',
    mrn: 'MRN-441200',
    name: 'James Okafor',
    age: '58 M',
    dx: 'Community-acquired pneumonia',
    news: 3,
    high: false,
    vitals: ['118/72', '90 bpm', '94%', '38.2°C'],
    allergies: 'NKDA',
    codeStatus: 'Full Code',
  },
];

export let TASKS: Task[] = [
  { id: 't1', title: 'STAT Troponin + ECG review', patient: 'Robert Chen', bed: '4B', priority: 'stat', due: 'Now', status: 'open', type: 'Lab' },
  { id: 't2', title: 'IV Heparin rate check', patient: 'Robert Chen', bed: '4B', priority: 'urgent', due: '11:00', status: 'open', type: 'Nursing' },
  { id: 't3', title: 'Wound dressing change', patient: 'Aisha Okonkwo', bed: '6C', priority: 'routine', due: '14:00', status: 'open', type: 'Nursing' },
  { id: 't4', title: 'Discharge checklist — Taylor', patient: 'Margaret Taylor', bed: '5A', priority: 'urgent', due: 'Today', status: 'open', type: 'Admin' },
  { id: 't5', title: 'Blood culture x2', patient: 'James Okafor', bed: '7A', priority: 'stat', due: 'ASAP', status: 'done', type: 'Lab' },
];

export let ORDERS: Order[] = [
  { id: 'o1', type: 'Lab', name: 'Troponin-I (STAT)', patient: 'Robert Chen', bed: '4B', status: 'resulted', orderedAt: '10:42', critical: true },
  { id: 'o2', type: 'Imaging', name: 'CXR PA/Lat', patient: 'James Okafor', bed: '7A', status: 'in-progress', orderedAt: '09:15' },
  { id: 'o3', type: 'Pharmacy', name: 'Heparin infusion 1000 U/hr', patient: 'Robert Chen', bed: '4B', status: 'acknowledged', orderedAt: '08:05' },
  { id: 'o4', type: 'Lab', name: 'CBC + BMP', patient: 'Margaret Taylor', bed: '5A', status: 'pending', orderedAt: '11:10' },
  { id: 'o5', type: 'Pharmacy', name: 'Amiodarone 200 mg PO', patient: 'Aisha Okonkwo', bed: '6C', status: 'pending', orderedAt: '10:50' },
];

export let MEDS: MedDose[] = [
  { id: '1', drug: 'Heparin 1000 U/hr IV', patient: 'Robert Chen', bed: '4B', due: '11:00', status: 'due', route: 'IV', eml: true },
  { id: '2', drug: 'Aspirin 75 mg PO', patient: 'Robert Chen', bed: '4B', due: '08:00', status: 'given', route: 'PO', givenAt: '08:05', eml: true },
  { id: '3', drug: 'Metformin 500 mg PO', patient: 'Robert Chen', bed: '4B', due: '08:00', status: 'given', route: 'PO', givenAt: '08:05', eml: true },
  { id: '4', drug: 'Furosemide 40 mg IV', patient: 'Margaret Taylor', bed: '5A', due: '10:00', status: 'given', route: 'IV', givenAt: '10:12', eml: true },
  { id: '5', drug: 'Bisoprolol 2.5 mg PO', patient: 'Margaret Taylor', bed: '5A', due: '08:00', status: 'given', route: 'PO', givenAt: '08:10', eml: true },
  { id: '6', drug: 'Amiodarone 200 mg PO', patient: 'Aisha Okonkwo', bed: '6C', due: '12:00', status: 'due', route: 'PO', eml: true },
  { id: '7', drug: 'Paracetamol 1 g IV', patient: 'James Okafor', bed: '7A', due: '11:30', status: 'overdue', route: 'IV', eml: true },
  { id: '8', drug: 'Ceftriaxone 1 g IV', patient: 'James Okafor', bed: '7A', due: '12:00', status: 'due', route: 'IV', eml: true, aware: 'Watch' },
];

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** Light vitals / NEWS drift every 5s to feel realtime */
let tickTimer: ReturnType<typeof setInterval> | null = null;

export function startClinicRealtime() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    PATIENTS = PATIENTS.map((p) => {
      if (!p.high && Math.random() > 0.7) return p;
      const hr = 70 + Math.floor(Math.random() * 30);
      const spo2 = 94 + Math.floor(Math.random() * 5);
      const sys = 110 + Math.floor(Math.random() * 40);
      const dia = 70 + Math.floor(Math.random() * 20);
      const news = Math.min(7, Math.max(0, p.news + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0)));
      return {
        ...p,
        news,
        high: news >= 5,
        vitals: [`${sys}/${dia}`, `${hr} bpm`, `${spo2}%`, p.vitals[3] || '36.8°C'],
      };
    });
    notify();
  }, 5000);
}

export function markMedGiven(id: string) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  MEDS = MEDS.map((m) =>
    m.id === id ? { ...m, status: 'given' as const, givenAt: `${hh}:${mm}` } : m
  );
  notify();
}

export function completeTask(id: string) {
  TASKS = TASKS.map((t) => (t.id === id ? { ...t, status: 'done' as const } : t));
  notify();
}

export function acknowledgeOrder(id: string) {
  ORDERS = ORDERS.map((o) =>
    o.id === id ? { ...o, status: 'acknowledged' as const } : o
  );
  notify();
}
