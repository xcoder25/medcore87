'use client';

import React, { useState } from 'react';
import {
  Cpu, Heart, Activity, Radio, Wifi,
  CheckCircle2, AlertTriangle, ShieldCheck,
  FlaskConical, Thermometer, RefreshCw, Zap, Server
} from 'lucide-react';
import type { ConnectedMonitorFeed } from '@medcore/types';
import { emitLiveAction } from '../../lib/liveActions';

interface LabInstrumentFeed {
  id: string;
  name: string;
  model: string;
  department: string;
  status: 'ONLINE' | 'ACTIVE BATCH' | 'CALIBRATING' | 'STANDBY';
  protocol: 'ASTM E1394' | 'HL7 v2.5.1' | 'Modbus RTU' | 'MQTT IoT';
  ipAddress: string;
  telemetry: string;
  reagentLevel?: number;
  temperature?: string;
  lastQc: string;
}

const SEED_LAB_INSTRUMENTS: LabInstrumentFeed[] = [
  {
    id: 'LAB-AN-01',
    name: 'Automated Clinical Chemistry Analyzer',
    model: 'Roche Cobas 6000 (c501 + e601)',
    department: 'Clinical Chemistry & Immunoassay',
    status: 'ONLINE',
    protocol: 'ASTM E1394',
    ipAddress: '192.168.4.112',
    telemetry: 'Throughput: 180 tests/hr · Photometer OK',
    reagentLevel: 88,
    lastQc: 'Passed (Today 05:30)',
  },
  {
    id: 'LAB-AN-02',
    name: 'Automated 5-Part Differential Hematology',
    model: 'Sysmex XN-1000',
    department: 'Hematology',
    status: 'ONLINE',
    protocol: 'HL7 v2.5.1',
    ipAddress: '192.168.4.115',
    telemetry: 'Sample throughput: 100 tests/hr · Flow Cytometry Laser OK',
    reagentLevel: 92,
    lastQc: 'Passed (Today 06:00)',
  },
  {
    id: 'LAB-AN-03',
    name: 'Continuous Blood Culture Incubator',
    model: 'BD BACTEC FX',
    department: 'Medical Microbiology',
    status: 'ACTIVE BATCH',
    protocol: 'HL7 v2.5.1',
    ipAddress: '192.168.4.118',
    telemetry: '48 Vials Incubating · 0 Positive Alarm',
    temperature: '37.0°C ±0.1°C',
    lastQc: 'Passed (Yesterday)',
  },
  {
    id: 'LAB-AN-04',
    name: 'Hemostasis & Coagulation Analyzer',
    model: 'Stago Compact Max',
    department: 'Hemostasis / Coagulation',
    status: 'ONLINE',
    protocol: 'ASTM E1394',
    ipAddress: '192.168.4.120',
    telemetry: 'PT/INR Optical Detection In-Range',
    reagentLevel: 81,
    lastQc: 'Passed (Today 07:00)',
  },
  {
    id: 'LAB-AN-05',
    name: 'Molecular Real-Time PCR System',
    model: 'Cepheid GeneXpert IV',
    department: 'Molecular Diagnostics & TB',
    status: 'ONLINE',
    protocol: 'HL7 v2.5.1',
    ipAddress: '192.168.4.124',
    telemetry: '4 Cartridge Bays Ready · Optics Calibrated',
    reagentLevel: 95,
    lastQc: 'Passed (Today 04:30)',
  },
  {
    id: 'LAB-CC-01',
    name: 'Blood Bank Storage Refrigerator #1',
    model: 'Helmer Scientific i.Series (+4°C)',
    department: 'Blood Bank & Transfusion',
    status: 'ONLINE',
    protocol: 'MQTT IoT',
    ipAddress: '192.168.4.140',
    telemetry: 'Internal Temp: +3.8°C (Normal) · Backup Generator Active',
    temperature: '+3.8°C',
    lastQc: 'Continuous Probe Calibrated',
  },
  {
    id: 'LAB-CC-02',
    name: 'Plasma Deep Freezer Unit #2',
    model: 'Thermo Scientific Horizon (-20°C)',
    department: 'Blood Bank & Transfusion',
    status: 'ONLINE',
    protocol: 'MQTT IoT',
    ipAddress: '192.168.4.142',
    telemetry: 'Internal Temp: -21.4°C (Normal) · Uniform Cold Zone',
    temperature: '-21.4°C',
    lastQc: 'Continuous Probe Calibrated',
  },
];

const SEED_BEDSIDE_MONITORS: ConnectedMonitorFeed[] = [
  {
    deviceId: 'MON-ICU-01',
    bedId: 'ICU Bed 1',
    patientName: 'Kelechi Nwosu',
    heartRateBpm: 76,
    spo2Percent: 98,
    nibpSysDia: '124/82',
    respiratoryRate: 16,
    connectionState: 'online',
  },
  {
    deviceId: 'MON-ICU-02',
    bedId: 'ICU Bed 2',
    patientName: 'Amina Bello',
    heartRateBpm: 92,
    spo2Percent: 95,
    nibpSysDia: '138/88',
    respiratoryRate: 19,
    connectionState: 'online',
  },
  {
    deviceId: 'MON-EMG-04',
    bedId: 'Emergency Resuscitation 4',
    patientName: 'David Essien',
    heartRateBpm: 114,
    spo2Percent: 91,
    nibpSysDia: '94/62',
    respiratoryRate: 24,
    connectionState: 'online',
  },
  {
    deviceId: 'MON-TH-02',
    bedId: 'Theatre 2 Anaesthetic Bay',
    patientName: 'Grace Bassey',
    heartRateBpm: 68,
    spo2Percent: 99,
    nibpSysDia: '116/74',
    respiratoryRate: 14,
    connectionState: 'online',
  },
];

export const ConnectedDevicesSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyzers' | 'bedside'>('analyzers');
  const [instruments, setInstruments] = useState<LabInstrumentFeed[]>(SEED_LAB_INSTRUMENTS);
  const [monitors, setMonitors] = useState<ConnectedMonitorFeed[]>(SEED_BEDSIDE_MONITORS);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handlePingInstrument = (id: string, name: string) => {
    emitLiveAction(`Pinged device gateway for ${name} (${id}) - Echo ACK 2ms`, { module: 'iot-devices' });
    showNotification(`Bidirectional HL7/ASTM link verified for ${name}. Latency: 2ms.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notice */}
      {actionNotice && (
        <div style={{
          position: 'fixed', top: 22, right: 24, zIndex: 99999,
          background: '#0F172A', color: '#38BDF8', border: '1px solid #0284C7',
          borderRadius: 12, padding: '14px 20px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem', fontWeight: 600,
        }}>
          <CheckCircle2 size={18} color="#38BDF8" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #042F2E 0%, #0F766E 55%, #0D9488 100%)',
        borderRadius: 18, padding: '22px 26px', color: '#FFFFFF',
        boxShadow: '0 10px 25px rgba(13, 148, 136, 0.25)',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>
            <Cpu size={28} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Laboratory Analyzers & Medical IoT Gateway
              </h1>
              <span style={{ background: '#10B981', color: '#FFFFFF', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800 }}>
                GATEWAY SECURE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#CCFBF1', maxWidth: 640 }}>
              Bidirectional ASTM & HL7 interfacing with automated hematology, clinical chemistry, microbiology, and blood cold chain telemetry.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              emitLiveAction('Broadcast telemetry ping sent across all laboratory analyzers and IoT sensors', { module: 'iot-devices' });
              showNotification('Telemetry handshake refreshed for all 7 lab analyzers and cold chain sensors.');
            }}
            style={{
              background: '#FFFFFF', color: '#0F766E', border: 'none',
              padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <RefreshCw size={15} /> Refresh Device Feed
          </button>
        </div>
      </div>

      {/* Top Telemetry Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Laboratory Analyzers</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>5 / 5 Online</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>100% Interfaced</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Sysmex, Cobas, BACTEC, Stago, GeneXpert</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #0891B2', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Blood Cold Chain IoT</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0891B2' }}>+3.8°C / -21°C</span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>STABLE</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Dual IoT probes with power redundancy</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Protocol Drivers</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB' }}>ASTM + HL7</span>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Bidirectional</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Automatic results ingestion to EMR</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #8B5CF6', padding: '16px 18px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Medical IoT Gateway Security</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7C3AED' }}>VLAN Isolated</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Zero Zero-Day Vulnerabilities</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', paddingBottom: 4 }}>
        <button
          type="button"
          onClick={() => setActiveTab('analyzers')}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: activeTab === 'analyzers' ? '#0D9488' : 'transparent',
            color: activeTab === 'analyzers' ? '#FFFFFF' : '#475569',
            fontWeight: activeTab === 'analyzers' ? 700 : 600, fontSize: '0.84rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <FlaskConical size={16} />
          Laboratory Analyzers & Cold Chain ({instruments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bedside')}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: activeTab === 'bedside' ? '#0D9488' : 'transparent',
            color: activeTab === 'bedside' ? '#FFFFFF' : '#475569',
            fontWeight: activeTab === 'bedside' ? 700 : 600, fontSize: '0.84rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Heart size={16} />
          Point-of-Care & Bedside Monitors ({monitors.length})
        </button>
      </div>

      {/* Tab 1: Laboratory Diagnostic Analyzers */}
      {activeTab === 'analyzers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {instruments.map(inst => (
            <div
              key={inst.id}
              className="os-card"
              style={{
                padding: 18, background: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0D9488', textTransform: 'uppercase' }}>
                    {inst.department}
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                    {inst.name}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                    {inst.model}
                  </span>
                </div>

                <span style={{
                  padding: '3px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800,
                  background: inst.status === 'ONLINE' ? '#DCFCE7' : '#FEF3C7',
                  color: inst.status === 'ONLINE' ? '#15803D' : '#B45309',
                }}>
                  {inst.status}
                </span>
              </div>

              <div style={{
                background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0',
                display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.76rem'
              }}>
                <div style={{ color: '#1E293B', fontWeight: 700 }}>
                  {inst.telemetry}
                </div>
                {inst.temperature && (
                  <div style={{ color: '#0284C7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Thermometer size={13} /> Sensor: {inst.temperature}
                  </div>
                )}
                {inst.reagentLevel !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ color: '#64748B' }}>Reagents Remaining:</span>
                    <strong style={{ color: inst.reagentLevel > 80 ? '#15803D' : '#D97706' }}>
                      {inst.reagentLevel}%
                    </strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                <span>Protocol: <strong>{inst.protocol}</strong> ({inst.ipAddress})</span>
                <button
                  type="button"
                  onClick={() => handlePingInstrument(inst.id, inst.name)}
                  style={{
                    background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6,
                    padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700, color: '#334155', cursor: 'pointer'
                  }}
                >
                  Ping ACK
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Bedside Monitors */}
      {activeTab === 'bedside' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {monitors.map(mon => (
            <div
              key={mon.deviceId}
              className="os-card"
              style={{
                padding: 18, borderLeft: mon.spo2Percent < 92 ? '4px solid #EF4444' : '4px solid #10B981',
                background: '#FFFFFF', borderRadius: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.74rem', color: '#0D9488', fontWeight: 700 }}>{mon.bedId}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#10B981', fontWeight: 700 }}>
                  <Wifi size={12} /> {mon.connectionState.toUpperCase()}
                </span>
              </div>

              <h4 style={{ margin: '2px 0 10px 0', fontSize: '1.05rem', color: '#0F172A', fontWeight: 800 }}>
                {mon.patientName}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#F8FAFC', padding: 10, borderRadius: 8, textAlign: 'center', border: '1px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>HR (bpm)</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: mon.heartRateBpm > 100 ? '#DC2626' : '#0F172A' }}>
                    {mon.heartRateBpm}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>SpO2 (%)</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: mon.spo2Percent < 92 ? '#DC2626' : '#059669' }}>
                    {mon.spo2Percent}%
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 700 }}>NIBP</span>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', marginTop: 3 }}>
                    {mon.nibpSysDia}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span>Device: {mon.deviceId}</span>
                <span>Resp: {mon.respiratoryRate}/min</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
