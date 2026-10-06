'use client';

/**
 * Device gateway settings — hospital IT configures hub HL7 / Orthanc / monitors
 * and can simulate device traffic into the clinical bus.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  loadGatewayConfig,
  saveGatewayConfig,
  listGatewayLogs,
  subscribeDeviceGateway,
  simulateHl7LabResult,
  simulateDicomReport,
  simulateMonitorVital,
  gatewayConnectionHints,
  type DeviceGatewayConfig,
} from '../../lib/deviceGatewayStore';
import { listOrders } from '../../lib/clinicalEventBus';
import { listPatients } from '../../lib/patientRegistryStore';
import {
  Server, Activity, FlaskConical, Image, ScanLine, Save, Play, Radio, Wifi,
} from 'lucide-react';

const C = {
  blue: '#0052D4',
  teal: '#0D9488',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
};

interface Props {
  session: UserSession;
  onNavigate?: (k: string) => void;
}

const inp: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  width: '100%',
};

export const DeviceGatewaySettings: React.FC<Props> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [cfg, setCfg] = useState<DeviceGatewayConfig>(() => loadGatewayConfig(facilityId));
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState('');
  const [patientId, setPatientId] = useState('');

  useEffect(() => {
    setCfg(loadGatewayConfig(facilityId));
  }, [facilityId]);

  useEffect(() => subscribeDeviceGateway(() => setTick((t) => t + 1)), []);

  const logs = useMemo(() => listGatewayLogs(40), [tick]);
  const openLab = useMemo(
    () =>
      listOrders(facilityId).filter(
        (o) =>
          o.type === 'lab' &&
          (o.status === 'ordered' || o.status === 'accepted' || o.status === 'in_progress')
      ),
    [facilityId, tick]
  );
  const openImg = useMemo(
    () =>
      listOrders(facilityId).filter(
        (o) =>
          o.type === 'imaging' &&
          (o.status === 'ordered' || o.status === 'accepted' || o.status === 'in_progress')
      ),
    [facilityId, tick]
  );
  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);
  const hints = gatewayConnectionHints(cfg);

  const flash = (m: string) => {
    setMsg(m);
    setTick((t) => t + 1);
    setTimeout(() => setMsg(''), 4000);
  };

  const save = () => {
    const next = saveGatewayConfig(cfg, session.name);
    setCfg(next);
    flash('Gateway settings saved — hub IT can use these endpoints');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Device gateway</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Hub HL7 · Orthanc/PACS · monitors · barcode · simulate feeds into EMR
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {msg && (
          <span style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>{msg}</span>
        )}
        <button
          type="button"
          onClick={save}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg,#0052D4,#0D9488)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Save size={16} /> Save settings
        </button>
      </div>

      {/* Connection hints */}
      <div
        style={{
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: C.blue }}>
          How devices reach MedCore
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.text, lineHeight: 1.6 }}>
          <li>Device → hospital hub (HL7 / DICOM / MQTT) — not Vercel directly</li>
          <li>Hub gateway translates → clinical bus (orders / vitals / reports)</li>
          <li>All open workstations update in realtime</li>
        </ol>
        <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
          {hints.map((h) => (
            <div key={h}>· {h}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
        {/* Config form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section title="Hub" icon={Server}>
            <Field label="Hub base URL">
              <input
                style={inp}
                value={cfg.hubBaseUrl}
                onChange={(e) => setCfg({ ...cfg, hubBaseUrl: e.target.value })}
                placeholder="http://10.0.0.10:3000"
              />
            </Field>
            <Field label="Notes for IT">
              <textarea
                style={{ ...inp, minHeight: 64 }}
                value={cfg.notes}
                onChange={(e) => setCfg({ ...cfg, notes: e.target.value })}
                placeholder="VLAN, static IPs, vendor contacts…"
              />
            </Field>
          </Section>

          <Section title="Laboratory HL7" icon={FlaskConical}>
            <label style={check}>
              <input
                type="checkbox"
                checked={cfg.hl7Enabled}
                onChange={(e) => setCfg({ ...cfg, hl7Enabled: e.target.checked })}
              />
              Enable HL7 listener path
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
              <Field label="HL7 host">
                <input
                  style={inp}
                  value={cfg.hl7Host}
                  onChange={(e) => setCfg({ ...cfg, hl7Host: e.target.value })}
                />
              </Field>
              <Field label="Port">
                <input
                  style={inp}
                  type="number"
                  value={cfg.hl7Port}
                  onChange={(e) => setCfg({ ...cfg, hl7Port: Number(e.target.value) || 2575 })}
                />
              </Field>
            </div>
          </Section>

          <Section title="Imaging PACS (Orthanc)" icon={Image}>
            <label style={check}>
              <input
                type="checkbox"
                checked={cfg.orthancEnabled}
                onChange={(e) => setCfg({ ...cfg, orthancEnabled: e.target.checked })}
              />
              Enable Orthanc / DICOM
            </label>
            <Field label="Orthanc URL">
              <input
                style={inp}
                value={cfg.orthancUrl}
                onChange={(e) => setCfg({ ...cfg, orthancUrl: e.target.value })}
                placeholder="http://10.0.0.10:8042"
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="User">
                <input
                  style={inp}
                  value={cfg.orthancUser || ''}
                  onChange={(e) => setCfg({ ...cfg, orthancUser: e.target.value })}
                />
              </Field>
              <Field label="Password">
                <input
                  style={inp}
                  type="password"
                  value={cfg.orthancPass || ''}
                  onChange={(e) => setCfg({ ...cfg, orthancPass: e.target.value })}
                />
              </Field>
            </div>
            {cfg.orthancEnabled && cfg.orthancUrl && (
              <a
                href={cfg.orthancUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: C.blue }}
              >
                Open Orthanc UI →
              </a>
            )}
          </Section>

          <Section title="Monitors & barcode" icon={Radio}>
            <label style={check}>
              <input
                type="checkbox"
                checked={cfg.monitorsEnabled}
                onChange={(e) => setCfg({ ...cfg, monitorsEnabled: e.target.checked })}
              />
              Bedside monitor feed enabled
            </label>
            <Field label="MQTT / monitor API URL">
              <input
                style={inp}
                value={cfg.monitorsMqttUrl}
                onChange={(e) => setCfg({ ...cfg, monitorsMqttUrl: e.target.value })}
              />
            </Field>
            <label style={check}>
              <input
                type="checkbox"
                checked={cfg.barcodeWedgeEnabled}
                onChange={(e) => setCfg({ ...cfg, barcodeWedgeEnabled: e.target.checked })}
              />
              USB barcode scanners (keyboard wedge)
            </label>
            <Field label="POS terminal ID (optional)">
              <input
                style={inp}
                value={cfg.posTerminalId}
                onChange={(e) => setCfg({ ...cfg, posTerminalId: e.target.value })}
                placeholder="Terminal serial / merchant id"
              />
            </Field>
          </Section>
        </div>

        {/* Simulate + logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              background: '#fff',
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={16} color={C.blue} /> Test device feeds
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Posts into the same clinical bus as real gateways. Open lab/Rx workstations to see realtime updates.
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Open lab orders: {openLab.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                style={btnPri}
                onClick={() => {
                  const r = simulateHl7LabResult({
                    facilityId,
                    actorName: session.name,
                    critical: false,
                  });
                  flash(r.message);
                }}
              >
                <FlaskConical size={14} /> Simulate HL7 lab result
              </button>
              <button
                type="button"
                style={btnWarn}
                onClick={() => {
                  const r = simulateHl7LabResult({
                    facilityId,
                    actorName: session.name,
                    critical: true,
                  });
                  flash(r.message);
                }}
              >
                Simulate critical K+ result
              </button>
              <button
                type="button"
                style={btnSec}
                onClick={() => {
                  const r = simulateDicomReport({ facilityId, actorName: session.name });
                  flash(r.message);
                }}
              >
                <Image size={14} /> Simulate PACS report ({openImg.length} open)
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Monitor → vitals</div>
            <select
              style={{ ...inp, marginBottom: 8 }}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} · {p.hospitalNumber}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={btnSec}
              onClick={() => {
                const r = simulateMonitorVital({
                  facilityId,
                  patientId,
                  actorName: session.name,
                });
                flash(r.message);
              }}
            >
              <Activity size={14} /> Simulate monitor vital
            </button>
          </div>

          <div
            style={{
              background: '#0B1220',
              borderRadius: 14,
              padding: 14,
              color: '#E2E8F0',
              maxHeight: 360,
              overflow: 'auto',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Wifi size={14} /> Gateway activity log
            </div>
            {logs.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.6 }}>No events yet — save settings or run a simulation.</div>
            )}
            {logs.map((l) => (
              <div
                key={l.id}
                style={{
                  borderBottom: '1px solid #1E293B',
                  padding: '8px 0',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      color:
                        l.level === 'ok'
                          ? '#34D399'
                          : l.level === 'warn'
                            ? '#FBBF24'
                            : l.level === 'error'
                              ? '#F87171'
                              : '#94A3B8',
                    }}
                  >
                    {l.source}
                  </span>
                  <span style={{ opacity: 0.5 }}>{new Date(l.at).toLocaleTimeString()}</span>
                </div>
                <div style={{ marginTop: 2 }}>{l.message}</div>
                {l.detail && <div style={{ opacity: 0.65 }}>{l.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 14,
          fontSize: 12,
          color: C.muted,
        }}
      >
        <ScanLine size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        <strong style={{ color: C.text }}>Barcode tip:</strong> plug USB scanner in, focus hospital number
        field, scan — wedge types the code like a keyboard. No hub software required.
        {cfg.updatedAt && (
          <span>
            {' '}
            · Last saved {new Date(cfg.updatedAt).toLocaleString()}
            {cfg.updatedBy ? ` by ${cfg.updatedBy}` : ''}
          </span>
        )}
      </div>
    </div>
  );
};

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={C.blue} /> {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const check: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnPri: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg,#0052D4,#0D9488)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const btnSec: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: '#fff',
  color: C.text,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const btnWarn: React.CSSProperties = {
  ...btnPri,
  background: 'linear-gradient(135deg,#DC2626,#F59E0B)',
};

export default DeviceGatewaySettings;
