/** National HIE gateway — FHIR bundle export/import + endpoint registry */
import { listPatients, getPatient } from './patientRegistryStore';
import { listOrders } from './clinicalEventBus';
import { patientToFhir, orderToFhirServiceRequest, buildFhirBundle, visitToDhis2Event } from './fhirStub';
import { listVisits } from './receptionOpsStore';
import { publishFacilityData } from './roleSyncBus';

export interface HieEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  type: 'fhir' | 'dhis2' | 'nhis' | 'custom';
  enabled: boolean;
}

const EP_KEY = 'medcore_os_hie_endpoints_v1';
const LOG_KEY = 'medcore_os_hie_log_v1';

export function listEndpoints(): HieEndpoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EP_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  const defaults: HieEndpoint[] = [
    { id: 'fhir-local', name: 'MedCore FHIR (local)', baseUrl: '/api/fhir', type: 'fhir', enabled: true },
    { id: 'dhis2', name: 'DHIS2 MoH', baseUrl: 'https://play.dhis2.org/demo', type: 'dhis2', enabled: false },
    { id: 'nhis', name: 'NHIA / NHIS gateway', baseUrl: '', type: 'nhis', enabled: false },
  ];
  localStorage.setItem(EP_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveEndpoints(list: HieEndpoint[]) {
  localStorage.setItem(EP_KEY, JSON.stringify(list));
}

export function exportPatientBundle(facilityId: string, patientId: string) {
  const p = getPatient(patientId);
  if (!p) return null;
  const resources: object[] = [patientToFhir(p)];
  for (const o of listOrders(facilityId).filter((x) => x.patientId === p.id || x.hospitalNumber === p.hospitalNumber)) {
    resources.push(orderToFhirServiceRequest(o));
  }
  return buildFhirBundle(resources);
}

export function exportFacilityDhis2(facilityId: string) {
  return listVisits(facilityId).slice(0, 100).map((v) => visitToDhis2Event(v));
}

export function logHie(message: string, payload?: unknown) {
  const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  logs.unshift({ at: new Date().toISOString(), message, payload: payload ? 'attached' : undefined });
  localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 200)));
  publishFacilityData('IGH-EKT', LOG_KEY, logs);
  return logs[0];
}

/** Simulate push to enabled endpoints (real HTTP when baseUrl is reachable) */
export async function pushBundle(facilityId: string, patientId: string) {
  const bundle = exportPatientBundle(facilityId, patientId);
  if (!bundle) return { ok: false, message: 'Patient not found' };
  const endpoints = listEndpoints().filter((e) => e.enabled);
  for (const ep of endpoints) {
    if (ep.type === 'fhir' && ep.baseUrl.startsWith('http')) {
      try {
        await fetch(`${ep.baseUrl}/Bundle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/fhir+json' },
          body: JSON.stringify(bundle),
        });
        logHie(`Pushed FHIR bundle to ${ep.name}`, bundle);
      } catch {
        logHie(`Queued FHIR for ${ep.name} (offline/unreachable)`);
      }
    } else {
      logHie(`Local HIE log: ${ep.name}`, bundle);
    }
  }
  return { ok: true, message: `Bundle prepared for ${endpoints.length} endpoint(s)`, bundle };
}
