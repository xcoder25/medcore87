'use client';
import React from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Zap, Activity } from 'lucide-react';

const INTEGRATIONS = [
  { name: 'AKSHIA — State Health Insurance', system: 'Akwa Ibom State Health Insurance Authority', status: 'live' as const, lastSync: '09:12', endpoint: 'api.akshia.gov.ng/v2', latency: '142ms' },
  { name: 'LMIS — Lab Management System', system: 'National Health Lab Information System', status: 'live' as const, lastSync: '09:10', endpoint: 'lmis.nigeria.health.gov.ng', latency: '289ms' },
  { name: 'NPHCDA — Immunisation Registry', system: 'National Primary Healthcare Dev. Agency', status: 'live' as const, lastSync: '08:45', endpoint: 'api.nphcda.gov.ng/eir', latency: '512ms' },
  { name: 'Drug Revolving Fund (DRF)', system: 'AKS State Pharmacy Board', status: 'warning' as const, lastSync: '07:30', endpoint: 'drf.aksgov.ng/api', latency: '1.8s' },
  { name: 'HL7 FHIR Patient Records', system: 'Nigeria eHealth FHIR R4 Gateway', status: 'live' as const, lastSync: '09:14', endpoint: 'fhir.nigeriahealth.gov.ng/r4', latency: '198ms' },
  { name: 'Biomedical Equipment Monitor', system: 'Medical Devices Telemetry Gateway', status: 'offline' as const, lastSync: '06:00', endpoint: 'biomed.ibomhospital.local', latency: 'N/A' },
  { name: 'Government HR — IPPIS', system: 'Integrated Payroll & Personnel Info System', status: 'live' as const, lastSync: '06:00', endpoint: 'ippis.gov.ng/connect', latency: '344ms' },
];

const PIPELINE_STATS = [
  { label: 'Records Synced Today', value: '12,841', color: '#16A34A', tone: 'alert-green' as const },
  { label: 'API Calls (Last Hour)', value: '4,293', color: '#EA580C', tone: 'alert-yellow' as const },
  { label: 'Failed Requests', value: '18', color: '#EF4444', tone: 'alert-red' as const },
  { label: 'Avg Response Time', value: '312ms', color: '#0066FF', tone: undefined },
];

const STATUS_META = {
  live: { label: 'Connected', color: '#16A34A' },
  warning: { label: 'Degraded', color: '#EA580C' },
  offline: { label: 'Offline', color: '#EF4444' },
};

export const IntegratedDataHub: React.FC = () => {
  const liveCount = INTEGRATIONS.filter(i => i.status === 'live').length;
  const issueCount = INTEGRATIONS.filter(i => i.status !== 'live').length;

  return (
    <div className="os-module-layout">
      <div className="os-insight-banner">
        <Activity size={18} style={{ color: '#0066FF', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem', marginBottom: 4 }}>
            Integrated Data Hub · Interoperability mesh
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.55 }}>
            {liveCount} systems live · {issueCount} need attention · DHIS2 / FHIR / AKSHIA pipelines feed Command Centre and MOH Admin.
          </div>
        </div>
      </div>

      <div className="os-metrics-ribbon">
        {PIPELINE_STATS.map(stat => (
          <div key={stat.label} className={`metric-box${stat.tone ? ` ${stat.tone}` : ''}`}>
            <span className="metric-label">{stat.label}</span>
            <span className="metric-val" style={{ color: stat.color }}>{stat.value}</span>
            <div className="os-progress-track">
              <div
                className={`os-progress-fill${stat.tone === 'alert-red' ? ' danger' : stat.tone === 'alert-yellow' ? ' warn' : stat.tone === 'alert-green' ? ' safe' : ''}`}
                style={{ width: stat.label.includes('Failed') ? '12%' : stat.label.includes('Response') ? '45%' : '78%' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="os-panel">
        <div className="os-panel-header">
          <div className="os-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={16} color="#0066FF" />
            External system integrations
          </div>
          <button type="button" className="os-ghost-btn">
            <RefreshCw size={13} /> Refresh all
          </button>
        </div>
        <div className="os-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
          {INTEGRATIONS.map(int => {
            const meta = STATUS_META[int.status];
            return (
              <div
                key={int.name}
                className="os-card"
                style={{
                  padding: '14px 18px',
                  borderLeft: `3px solid ${meta.color}`,
                  margin: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem' }}>{int.name}</span>
                      <span style={{
                        background: `${meta.color}14`,
                        color: meta.color,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 9999,
                        border: `1px solid ${meta.color}30`,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{int.system}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'var(--os-font-mono)', marginTop: 6 }}>
                      {int.endpoint}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 4 }}>
                      Last sync · <span style={{ color: '#0F172A', fontWeight: 600 }}>{int.lastSync}</span>
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: int.status === 'offline' ? '#EF4444' : int.status === 'warning' ? '#EA580C' : '#16A34A',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                    }}>
                      {int.status === 'offline' ? <AlertCircle size={12} /> : int.status === 'live' ? <CheckCircle2 size={12} /> : <Zap size={12} />}
                      {int.latency}
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
};
