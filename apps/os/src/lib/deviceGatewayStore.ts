/**
 * Hospital device gateway config — hub HL7 / Orthanc / monitor endpoints.
 * Settings live local-first; gateways on the hub post into the clinical bus.
 */
import { listOrders, postLabResult, updateOrderStatus, type ClinicalOrder } from './clinicalEventBus';
import { addVital, type VitalRow } from './clinicalUxStores';
import { pushNotification } from './notificationEngine';

const KEY = 'medcore_os_device_gateway_v1';
const LOG_KEY = 'medcore_os_device_gateway_log_v1';
const EVT = 'medcore-device-gateway';

export interface DeviceGatewayConfig {
  facilityId: string;
  hubBaseUrl: string;
  hl7Enabled: boolean;
  hl7Host: string;
  hl7Port: number;
  orthancEnabled: boolean;
  orthancUrl: string;
  orthancUser?: string;
  orthancPass?: string;
  monitorsEnabled: boolean;
  monitorsMqttUrl: string;
  barcodeWedgeEnabled: boolean;
  posTerminalId: string;
  notes: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface GatewayLogEntry {
  id: string;
  at: string;
  level: 'info' | 'warn' | 'error' | 'ok';
  source: 'hl7' | 'dicom' | 'monitor' | 'barcode' | 'pos' | 'simulate' | 'system';
  message: string;
  detail?: string;
}

function defaultConfig(facilityId: string): DeviceGatewayConfig {
  return {
    facilityId,
    hubBaseUrl: 'http://10.0.0.10:3000',
    hl7Enabled: true,
    hl7Host: '10.0.0.10',
    hl7Port: 2575,
    orthancEnabled: true,
    orthancUrl: 'http://10.0.0.10:8042',
    orthancUser: 'orthanc',
    orthancPass: '',
    monitorsEnabled: false,
    monitorsMqttUrl: 'mqtt://10.0.0.10:1883',
    barcodeWedgeEnabled: true,
    posTerminalId: '',
    notes: '',
    updatedAt: new Date().toISOString(),
  };
}

function readAll(): Record<string, DeviceGatewayConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, DeviceGatewayConfig>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, DeviceGatewayConfig>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVT));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync'));
}

export function loadGatewayConfig(facilityId: string): DeviceGatewayConfig {
  const map = readAll();
  return map[facilityId] || defaultConfig(facilityId);
}

export function saveGatewayConfig(cfg: DeviceGatewayConfig, by?: string): DeviceGatewayConfig {
  const next: DeviceGatewayConfig = {
    ...cfg,
    updatedAt: new Date().toISOString(),
    updatedBy: by || cfg.updatedBy,
  };
  const map = readAll();
  map[cfg.facilityId] = next;
  writeAll(map);
  appendGatewayLog({
    id: `GW-${Date.now()}`,
    at: next.updatedAt,
    level: 'ok',
    source: 'system',
    message: 'Gateway settings saved',
    detail: `HL7 ${next.hl7Host}:${next.hl7Port} · Orthanc ${next.orthancUrl}`,
  });
  return next;
}

export function listGatewayLogs(limit = 50): GatewayLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const all: GatewayLogEntry[] = raw ? (JSON.parse(raw) as GatewayLogEntry[]) : [];
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

export function appendGatewayLog(entry: GatewayLogEntry) {
  if (typeof window === 'undefined') return;
  const prev = listGatewayLogs(200);
  localStorage.setItem(LOG_KEY, JSON.stringify([entry, ...prev].slice(0, 200)));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function subscribeDeviceGateway(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
  };
}

export function simulateHl7LabResult(opts: {
  facilityId: string;
  orderId?: string;
  resultText?: string;
  critical?: boolean;
  actorName?: string;
}): { ok: boolean; message: string; order?: ClinicalOrder } {
  const open = listOrders(opts.facilityId).filter(
    (o) => o.type === 'lab' && (o.status === 'ordered' || o.status === 'accepted' || o.status === 'in_progress')
  );
  const target = opts.orderId
    ? listOrders(opts.facilityId).find((o) => o.id === opts.orderId)
    : open[0];

  const summary =
    opts.resultText ||
    (opts.critical
      ? 'CRITICAL: K+ 6.8 mmol/L (H) — simulated analyzer'
      : 'Hb 12.4 g/dL · WBC 6.2 · Plt 210 — simulated analyzer');

  if (!target) {
    appendGatewayLog({
      id: `GW-${Date.now()}`,
      at: new Date().toISOString(),
      level: 'warn',
      source: 'simulate',
      message: 'HL7 simulate: no open lab order',
      detail: summary,
    });
    return { ok: false, message: 'No open lab order to attach result. Place a lab order first.' };
  }

  const by = opts.actorName || 'HL7 Gateway';
  const updated = postLabResult(target.id, summary, by);

  appendGatewayLog({
    id: `GW-${Date.now()}`,
    at: new Date().toISOString(),
    level: opts.critical ? 'warn' : 'ok',
    source: 'hl7',
    message: `HL7 ORU applied → ${target.name}`,
    detail: `${target.patientName} · ${summary}`,
  });

  try {
    pushNotification({
      facilityId: opts.facilityId,
      title: opts.critical ? 'Critical lab (device)' : 'Lab result (device)',
      body: `${target.patientName}: ${summary.slice(0, 100)}`,
      level: opts.critical ? 'critical' : 'info',
      module: 'laboratory',
      patientId: target.patientId,
    });
  } catch {
    /* optional */
  }

  return {
    ok: true,
    message: `Result posted to order ${target.id}`,
    order: updated || target,
  };
}

export function simulateMonitorVital(opts: {
  facilityId: string;
  patientId: string;
  actorName?: string;
}): { ok: boolean; message: string } {
  if (!opts.patientId) {
    return { ok: false, message: 'Select a patient for monitor simulation' };
  }
  const row: VitalRow = {
    id: `VIT-DEV-${Date.now().toString(36)}`,
    facilityId: opts.facilityId,
    patientId: opts.patientId,
    at: new Date().toISOString(),
    bpSys: 118 + Math.floor(Math.random() * 20),
    bpDia: 72 + Math.floor(Math.random() * 12),
    hr: 72 + Math.floor(Math.random() * 30),
    rr: 14 + Math.floor(Math.random() * 6),
    spo2: 96 + Math.floor(Math.random() * 4),
    temp: Math.round((36.5 + Math.random()) * 10) / 10,
    recordedBy: opts.actorName || 'Bedside monitor',
  };
  addVital(row);
  appendGatewayLog({
    id: `GW-${Date.now()}`,
    at: row.at,
    level: 'ok',
    source: 'monitor',
    message: 'Monitor vital ingested',
    detail: `HR ${row.hr} · SpO2 ${row.spo2}% · BP ${row.bpSys}/${row.bpDia}`,
  });
  return { ok: true, message: `Vital recorded (HR ${row.hr}, SpO₂ ${row.spo2}%)` };
}

export function simulateDicomReport(opts: {
  facilityId: string;
  orderId?: string;
  actorName?: string;
}): { ok: boolean; message: string } {
  const imaging = listOrders(opts.facilityId).filter(
    (o) =>
      o.type === 'imaging' &&
      (o.status === 'ordered' || o.status === 'accepted' || o.status === 'in_progress')
  );
  const target = opts.orderId
    ? listOrders(opts.facilityId).find((o) => o.id === opts.orderId)
    : imaging[0];

  if (!target) {
    appendGatewayLog({
      id: `GW-${Date.now()}`,
      at: new Date().toISOString(),
      level: 'warn',
      source: 'dicom',
      message: 'DICOM simulate: no open imaging order',
    });
    return { ok: false, message: 'No open imaging order. Place a radiology order first.' };
  }

  updateOrderStatus(target.id, 'resulted', {
    resultSummary: 'Impression: No acute cardiopulmonary process. (Simulated PACS report)',
    resultedBy: opts.actorName || 'PACS/Orthanc',
  });

  appendGatewayLog({
    id: `GW-${Date.now()}`,
    at: new Date().toISOString(),
    level: 'ok',
    source: 'dicom',
    message: `DICOM report linked → ${target.name}`,
    detail: target.patientName,
  });

  return { ok: true, message: `Report posted to ${target.id}` };
}

export function gatewayConnectionHints(cfg: DeviceGatewayConfig): string[] {
  const lines: string[] = [];
  if (cfg.hl7Enabled) {
    lines.push(`Lab analyzers → TCP ${cfg.hl7Host}:${cfg.hl7Port} (HL7 v2 ORU)`);
  }
  if (cfg.orthancEnabled) {
    lines.push(`Modalities → DICOM C-STORE → ${cfg.orthancUrl}`);
  }
  if (cfg.monitorsEnabled) {
    lines.push(`Monitors → MQTT/API ${cfg.monitorsMqttUrl}`);
  }
  if (cfg.barcodeWedgeEnabled) {
    lines.push('Barcode scanners → USB keyboard wedge (focus field + scan)');
  }
  lines.push(`Hub base: ${cfg.hubBaseUrl}`);
  return lines;
}
