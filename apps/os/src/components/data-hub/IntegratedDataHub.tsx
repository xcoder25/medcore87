'use client';
import React from 'react';
import { Database, Activity, CheckCircle2, AlertCircle, Clock, RefreshCw, Zap } from 'lucide-react';

const INTEGRATIONS = [
  { name: 'AKSHIA — State Health Insurance', system: 'Akwa Ibom State Health Insurance Authority', status: 'live', lastSync: '09:12', endpoint: 'api.akshia.gov.ng/v2', latency: '142ms' },
  { name: 'LMIS — Lab Management System', system: 'National Health Lab Information System', status: 'live', lastSync: '09:10', endpoint: 'lmis.nigeria.health.gov.ng', latency: '289ms' },
  { name: 'NPHCDA — Immunisation Registry', system: 'National Primary Healthcare Dev. Agency', status: 'live', lastSync: '08:45', endpoint: 'api.nphcda.gov.ng/eir', latency: '512ms' },
  { name: 'Drug Revolving Fund (DRF)', system: 'AKS State Pharmacy Board', status: 'warning', lastSync: '07:30', endpoint: 'drf.aksgov.ng/api', latency: '1.8s' },
  { name: 'HL7 FHIR Patient Records', system: 'Nigeria eHealth FHIR R4 Gateway', status: 'live', lastSync: '09:14', endpoint: 'fhir.nigeriahealth.gov.ng/r4', latency: '198ms' },
  { name: 'Biomedical Equipment Monitor', system: 'Medical Devices Telemetry Gateway', status: 'offline', lastSync: '06:00', endpoint: 'biomed.ibomhospital.local', latency: 'N/A' },
  { name: 'Government HR — IPPIS', system: 'Integrated Payroll & Personnel Info System', status: 'live', lastSync: '06:00', endpoint: 'ippis.gov.ng/connect', latency: '344ms' },
];

const PIPELINE_STATS = [
  { label: 'Records Synced Today', value: '12,841', color: '#22C55E' },
  { label: 'API Calls (Last Hour)', value: '4,293', color: '#EA580C' },
  { label: 'Failed Requests', value: '18', color: '#EF4444' },
  { label: 'Avg Response Time', value: '312ms', color: '#F59E0B' },
];

const STATUS_META = {
  live: { label: 'Connected', color: '#22C55E' },
  warning: { label: 'Degraded', color: '#F59E0B' },
  offline: { label: 'Offline', color: '#EF4444' },
};

export const IntegratedDataHub: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

    {/* Stats */}
    <div className="os-metrics-ribbon">
      {PIPELINE_STATS.map(stat => (
        <div key={stat.label} className="metric-box">
          <span className="metric-label">{stat.label}</span>
          <span className="metric-val" style={{ color: stat.color }}>{stat.value}</span>
        </div>
      ))}
    </div>

    {/* Integration Status Cards */}
    <div>
      <div className="os-section-header">
        <span className="os-section-title"><Database size={14} style={{ display: 'inline', marginRight: 6 }} />External System Integrations</span>
        <button className="os-ghost-btn"><RefreshCw size={13} /> Refresh All</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {INTEGRATIONS.map(int => {
          const meta = STATUS_META[int.status as keyof typeof STATUS_META];
          return (
            <div key={int.name} className="os-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${meta.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.92rem' }}>{int.name}</span>
                    <span style={{ background: `${meta.color}20`, color: meta.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{int.system}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'var(--os-font-mono)' }}>{int.endpoint}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 20 }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: 4 }}>Last sync: <span style={{ color: '#94A3B8' }}>{int.lastSync}</span></div>
                  <div style={{ fontSize: '0.75rem', color: int.status === 'offline' ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
                    <Zap size={11} style={{ display: 'inline', marginRight: 4 }} />{int.latency}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
