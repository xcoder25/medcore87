/**
 * epcrBridgeStore.ts
 *
 * Modern HL7 v2 / FHIR R4 Pre-Hospital Emergency Medical Services (EMS) Ingestion Bridge.
 *
 * Implements the real-world pre-hospital emergency transition:
 * 1. Pre-Alert Push: Paramedics send structured FHIR R4 JSON bundles or HL7 v2 ORU/ADT messages while en route.
 * 2. Staging Dashboard: Hospital OS holds the payload in a "Pre-Arrival / Triage Ingestion Queue" without committing
 *    to permanent clinical records until physical arrival.
 * 3. Triage Nurse Gatekeeper: When the patient arrives at the bay, the system alerts the nurse:
 *    "Ambulance data available for [Patient Name] (DOB: [DOB]). Match and import?"
 * 4. 1-Click Ingestion: Nurse verifies identity against the screen, clicks "Accept & Import",
 *    and vitals, trauma notes, EKG telemetry, and accident narratives automatically populate
 *    the official EMR nursing triage assessment without manual typing.
 */

export type ProtocolType = 'FHIR_R4' | 'HL7_V2';
export type EpcrAlertStatus = 'inbound' | 'at_bay' | 'imported' | 'dismissed';

export interface EpcrVitals {
  bp: string;             // e.g. "90/60"
  pulse: number;          // e.g. 118
  rr: number;             // e.g. 28
  spo2: number;           // e.g. 92
  temp: number;           // e.g. 36.8
  painScale: number;      // 0-10 e.g. 8
  gcs?: string;           // e.g. "13 (E4 V4 M5)"
  bloodGlucose?: number;  // mg/dL e.g. 110
}

export interface EpcrPatient {
  fullName: string;
  dob?: string;
  age?: number;
  gender: 'M' | 'F' | 'Other';
  nin?: string;
  hospitalNumber?: string;
}

export interface EpcrPreArrivalAlert {
  id: string;                      // e.g. "EPCR-2026-8812"
  protocol: ProtocolType;          // 'FHIR_R4' | 'HL7_V2'
  emsUnit: string;                 // e.g. "Akwa EMS Rapid Unit 04"
  paramedicName: string;           // e.g. "Lead Paramedic Bassey Edet"
  facilityId: string;              // Target hospital e.g. "IGH-EKT"
  patient: EpcrPatient;
  vitals: EpcrVitals;
  incidentType: string;            // e.g. "Motor Vehicle Collision (MVC) — High Speed Rollover"
  accidentNarrative: string;       // Trauma notes / mechanism of injury
  enRouteInterventions: string[];  // Interventions performed en route (IV, O2, Meds)
  ekgTelemetry: {
    rhythm: string;                // e.g. "Sinus Tachycardia @ 118 bpm"
    stElevation: boolean;          // true if STEMI
    notes: string;
    ekgTraceUrl?: string;
  };
  etaMinutes: number;              // 0 if at bay
  status: EpcrAlertStatus;
  receivedAt: string;
  arrivedAt?: string;
  importedAt?: string;
  importedBy?: string;             // Nurse badge or name
  rawPayloadPreview?: string;      // Snippet of FHIR JSON or HL7 text
}

const STORAGE_KEY = 'medcore_epcr_staging_queue_v2';
const EVENT_KEY = 'medcore-epcr-pre-arrival-update';

const SEED_ALERTS: EpcrPreArrivalAlert[] = [];

function loadAlerts(): EpcrPreArrivalAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: EpcrPreArrivalAlert[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: alerts }));
  } catch (err) {
    console.warn('[epcrBridgeStore] save error:', err);
  }
}

/**
 * List all pre-alerts in the staging queue (active or historical).
 */
export function listStagingQueue(facilityId?: string): EpcrPreArrivalAlert[] {
  const all = loadAlerts();
  if (!facilityId) return all;
  return all.filter((a) => !a.facilityId || a.facilityId === facilityId);
}

/**
 * List only uncommitted alerts (inbound or at_bay waiting for nurse ingestion).
 */
export function listUncommittedPreAlerts(facilityId?: string): EpcrPreArrivalAlert[] {
  return listStagingQueue(facilityId).filter((a) => a.status === 'inbound' || a.status === 'at_bay');
}

/**
 * Get a specific alert by ID.
 */
export function getAlertById(id: string): EpcrPreArrivalAlert | undefined {
  return loadAlerts().find((a) => a.id === id);
}

/**
 * Find pending pre-alert matching a patient by name or DOB.
 */
export function findMatchingPreAlert(patientName: string, dob?: string): EpcrPreArrivalAlert | undefined {
  const normName = patientName.trim().toLowerCase();
  if (!normName) return undefined;
  return listUncommittedPreAlerts().find((a) => {
    const alertName = a.patient.fullName.toLowerCase();
    const nameMatches = alertName.includes(normName) || normName.includes(alertName);
    if (dob && a.patient.dob) {
      return nameMatches || a.patient.dob === dob;
    }
    return nameMatches;
  });
}

/**
 * 1-Click Nurse Ingestion Gatekeeper Action:
 * Verifies the arriving physical patient, marks alert as 'imported', and returns the structured payload.
 */
export function matchAndImportAlert(alertId: string, nurseBadge: string = 'Staff Nurse'): EpcrPreArrivalAlert | null {
  const all = loadAlerts();
  const idx = all.findIndex((a) => a.id === alertId);
  if (idx === -1) return null;

  const target = all[idx];
  const updated: EpcrPreArrivalAlert = {
    ...target,
    status: 'imported',
    importedAt: new Date().toISOString(),
    importedBy: nurseBadge,
  };

  all[idx] = updated;
  saveAlerts(all);
  return updated;
}

/**
 * Ingest an incoming FHIR R4 or HL7 bundle pushed by external paramedics.
 */
export function ingestPreAlert(alert: Omit<EpcrPreArrivalAlert, 'id' | 'receivedAt' | 'status'> & { id?: string }): EpcrPreArrivalAlert {
  const all = loadAlerts();
  const id = alert.id || `EPCR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const fullAlert: EpcrPreArrivalAlert = {
    ...alert,
    id,
    status: 'inbound',
    receivedAt: new Date().toISOString(),
  };

  const next = [fullAlert, ...all.filter((a) => a.id !== id)];
  saveAlerts(next);
  return fullAlert;
}

/**
 * Mark an inbound alert as having arrived at the physical ambulance bay.
 */
export function markAtBay(alertId: string): void {
  const all = loadAlerts();
  const target = all.find((a) => a.id === alertId);
  if (!target) return;
  target.status = 'at_bay';
  target.etaMinutes = 0;
  target.arrivedAt = new Date().toISOString();
  saveAlerts(all);
}

/**
 * Dismiss / archive an alert if cancelled by EMS.
 */
export function dismissAlert(alertId: string): void {
  const all = loadAlerts();
  const next = all.filter((a) => a.id !== alertId);
  saveAlerts(next);
}

/**
 * Subscribe to realtime staging queue updates.
 */
export function subscribeStagingQueue(cb: (alerts: EpcrPreArrivalAlert[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb(loadAlerts());
  window.addEventListener(EVENT_KEY, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_KEY, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Simulator: triggers a realistic incoming ambulance pre-alert push for clinical demonstrations.
 */
export function simulateInboundAlert(scenario: 'mvc_polytrauma' | 'acute_stemi' | 'maternity_emergency' = 'mvc_polytrauma'): EpcrPreArrivalAlert {
  const id = `EPCR-2026-${Math.floor(2000 + Math.random() * 8000)}`;
  if (scenario === 'mvc_polytrauma') {
    return ingestPreAlert({
      id,
      protocol: 'FHIR_R4',
      emsUnit: 'Akwa EMS Rapid Unit 08',
      paramedicName: 'Lead Paramedic O. Effiong',
      facilityId: 'IGH-EKT',
      patient: {
        fullName: 'John Smith',
        dob: '1988-04-12',
        age: 38,
        gender: 'M',
        nin: 'NIN-99283716402',
      },
      vitals: {
        bp: '90/60',
        pulse: 118,
        rr: 28,
        spo2: 92,
        temp: 36.8,
        painScale: 8,
        gcs: '13 (E4 V4 M5)',
      },
      incidentType: 'Motor Vehicle Collision (MVC) — High Speed Rollover',
      accidentNarrative:
        'Driver restrained, air bag deployed. Blunt thoracic trauma with steering wheel deformity. Left clavicle crepitus, bilateral breath sounds present but diminished on left. Cervical collar applied, backboard immobilized.',
      enRouteInterventions: [
        '100% High-Flow O2 via NRB @ 15L/min',
        '18G IV left antecubital, 500mL Warm Normal Saline actively infusing',
        'Fentanyl 50mcg IV given at 04:42 for severe chest wall pain',
      ],
      ekgTelemetry: {
        rhythm: 'Sinus Tachycardia @ 118 bpm',
        stElevation: false,
        notes: 'Narrow complex sinus tachycardia. No ischemic changes.',
      },
      etaMinutes: 4,
    });
  }

  if (scenario === 'maternity_emergency') {
    return ingestPreAlert({
      id,
      protocol: 'FHIR_R4',
      emsUnit: 'State Maternity Rescue Unit #01',
      paramedicName: 'Midwife Specialist N. Okon',
      facilityId: 'IGH-EKT',
      patient: {
        fullName: 'Ekaette Udofia',
        dob: '1995-11-04',
        age: 30,
        gender: 'F',
      },
      vitals: {
        bp: '142/90',
        pulse: 98,
        rr: 22,
        spo2: 98,
        temp: 37.0,
        painScale: 9,
      },
      incidentType: 'Precipitous Labour — Full Term (39 Weeks) G3P2',
      accidentNarrative:
        'Strong active contractions every 2 minutes lasting 60 seconds. Spontaneous rupture of membranes with clear liquor en route. Fetal heart rate auscultated via Doppler at 144 bpm regular.',
      enRouteInterventions: [
        'Left lateral tilt positioning maintained',
        '18G IV line placed left forearm',
        'Sterile delivery pack primed at head of stretcher',
      ],
      ekgTelemetry: {
        rhythm: 'Normal Sinus Rhythm @ 98 bpm',
        stElevation: false,
        notes: 'Maternal baseline stable.',
      },
      etaMinutes: 5,
    });
  }

  return ingestPreAlert({
    id,
    protocol: 'HL7_V2',
    emsUnit: 'Akwa EMS Unit 03',
    paramedicName: 'EMT C. Akpan',
    facilityId: 'IGH-EKT',
    patient: {
      fullName: 'Emeka Nwosu',
      dob: '1968-02-14',
      age: 58,
      gender: 'M',
    },
    vitals: {
      bp: '170/102',
      pulse: 104,
      rr: 24,
      spo2: 94,
      temp: 36.9,
      painScale: 9,
    },
    incidentType: 'Acute STEMI / Severe Angina',
    accidentNarrative: 'Sudden onset retrosternal crushing pain with diaphoresis and radiating jaw numbness.',
    enRouteInterventions: [
      'Aspirin 300mg chewed',
      'GTN spray 400mcg SL',
      'IV access with normal saline flush',
    ],
    ekgTelemetry: {
      rhythm: 'Anterolateral STEMI Alert',
      stElevation: true,
      notes: 'ST elevation across leads V3-V6. Cath lab alert recommended.',
    },
    etaMinutes: 3,
  });
}
