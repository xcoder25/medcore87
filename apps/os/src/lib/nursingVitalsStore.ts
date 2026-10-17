/**
 * Nursing vitals / triage — Nigerian OPD stage 2–3.
 * Saving vitals routes patient toward doctor queue and can escalate urgency.
 */
import { publishFacilityData } from './roleSyncBus';
import { pushNotification } from './notificationEngine';
import { markPatientWithProvider, attachVitalsToVisit } from './receptionOpsStore';
import { addVital } from './clinicalUxStores';

const KEY = 'medcore_os_nursing_vitals_v1';

export type VitalsRecord = {
  id: string;
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  tempC?: number;
  weightKg?: number;
  spo2?: number;
  notes?: string;
  urgency: 'routine' | 'urgent' | 'critical';
  recordedBy?: string;
  recordedAt: string;
};

function read(): VitalsRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: VitalsRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 3000)));
  window.dispatchEvent(new CustomEvent('medcore-vitals', { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  try {
    // Publish under both the canonical KEY (for cloud sync listener matching)
    // and the legacy 'clinical_vitals' alias — both are registered in facilityCloudSync KEY_EVENTS
    publishFacilityData(fid, KEY, list);
    publishFacilityData(fid, 'clinical_vitals', list);
  } catch {
    /* ignore */
  }
  // Cross-tab broadcast so same-PC Triage → Doctor updates instantly
  try {
    const bc = new BroadcastChannel('medcore_triage');
    bc.postMessage({ type: 'vitals', facilityId: fid, at: new Date().toISOString() });
    bc.close();
  } catch { /* ignore */ }
}

function scoreUrgency(v: Partial<VitalsRecord>): VitalsRecord['urgency'] {
  const sys = Number(v.bpSystolic) || 0;
  const dia = Number(v.bpDiastolic) || 0;
  const pulse = Number(v.pulse) || 0;
  const temp = Number(v.tempC) || 0;
  const spo2 = Number(v.spo2) || 100;
  if (sys >= 180 || dia >= 120 || pulse >= 130 || temp >= 40 || spo2 < 90) return 'critical';
  if (sys >= 160 || dia >= 100 || pulse >= 110 || temp >= 38.5 || spo2 < 94) return 'urgent';
  return 'routine';
}

export function listVitals(facilityId: string, patientId?: string): VitalsRecord[] {
  let list = read().filter((r) => r.facilityId === facilityId);
  if (patientId) list = list.filter((r) => r.patientId === patientId);
  return list.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function saveVitals(input: {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  tempC?: number;
  weightKg?: number;
  spo2?: number;
  notes?: string;
  recordedBy?: string;
}): VitalsRecord {
  const urgency = scoreUrgency(input);
  const row: VitalsRecord = {
    id: `VIT-${Date.now().toString(36).toUpperCase()}`,
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    bpSystolic: input.bpSystolic,
    bpDiastolic: input.bpDiastolic,
    pulse: input.pulse,
    tempC: input.tempC,
    weightKg: input.weightKg,
    spo2: input.spo2,
    notes: input.notes,
    urgency,
    recordedBy: input.recordedBy,
    recordedAt: new Date().toISOString(),
  };
  write([row, ...read()]);

  // Attach to active ReceptionVisit on the live queue
  const bpStr =
    input.bpSystolic && input.bpDiastolic ? `${input.bpSystolic}/${input.bpDiastolic}` : undefined;
  const summaryParts: string[] = [];
  if (bpStr) summaryParts.push(`BP ${bpStr}`);
  if (input.pulse) summaryParts.push(`HR ${input.pulse}`);
  if (input.tempC) summaryParts.push(`${input.tempC}°C`);
  if (input.spo2) summaryParts.push(`SpO₂ ${input.spo2}%`);
  if (input.weightKg) summaryParts.push(`${input.weightKg}kg`);

  try {
    attachVitalsToVisit(input.facilityId, input.patientId, {
      triageUrgency: urgency,
      vitalsSummary: summaryParts.join(' · ') || 'Vitals on file',
      vitalsBp: bpStr,
      vitalsPulse: input.pulse,
      vitalsTemp: input.tempC,
      vitalsSpo2: input.spo2,
      vitalsWeight: input.weightKg,
    });
  } catch {
    /* ignore */
  }

  // Attach to longitudinal clinical chart
  try {
    addVital({
      id: row.id,
      facilityId: input.facilityId,
      patientId: input.patientId,
      at: row.recordedAt,
      bpSys: input.bpSystolic,
      bpDia: input.bpDiastolic,
      hr: input.pulse,
      temp: input.tempC,
      spo2: input.spo2,
      weightKg: input.weightKg,
      recordedBy: input.recordedBy || 'Nurse',
    });
  } catch {
    /* ignore */
  }

  // Route: vitals done → doctor can take patient (still waiting until Call/open)
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('medcore-opd-stage', {
          detail: {
            facilityId: input.facilityId,
            patientId: input.patientId,
            hospitalNumber: input.hospitalNumber,
            stage: 'vitals_done',
            urgency,
          },
        })
      );
    }
  } catch {
    /* ignore */
  }

  if (urgency === 'critical' || urgency === 'urgent') {
    try {
      pushNotification({
        facilityId: input.facilityId,
        level: urgency === 'critical' ? 'critical' : 'important',
        title: `${urgency === 'critical' ? 'Critical' : 'Urgent'} vitals`,
        body: `${input.patientName} · ${input.hospitalNumber} — triage ${urgency}`,
        module: 'doctor-portal',
        patientId: input.patientId,
      });
    } catch {
      /* ignore */
    }
  }

  return row;
}

export function subscribeVitals(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener('medcore-vitals', fn);
  window.addEventListener('medcore-admin-sync', fn);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('medcore_triage');
    bc.onmessage = (e) => { if (e.data?.type === 'vitals') cb(); };
  } catch { /* ignore */ }
  return () => {
    window.removeEventListener('medcore-vitals', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    try { bc?.close(); } catch { /* ignore */ }
  };
}
