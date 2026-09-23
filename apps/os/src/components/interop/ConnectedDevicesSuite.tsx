'use client';

import React, { useState } from 'react';
import {
  Cpu, Heart, Activity, Radio, Wifi,
  CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import type { ConnectedMonitorFeed } from '@medcore/types';

const INITIAL_MONITORS: ConnectedMonitorFeed[] = [
  { deviceId: 'MON-ICU-01', bedId: 'ICU Bay 1', patientName: 'Bassey Okon Udoh', heartRateBpm: 124, spo2Percent: 91, respiratoryRate: 26, nibpSysDia: '85/55', connectionState: 'online', lastPing: 'Just now' },
  { deviceId: 'MON-ICU-02', bedId: 'ICU Bay 2', patientName: 'Edidiong Sunday Udosen', heartRateBpm: 78, spo2Percent: 98, respiratoryRate: 16, nibpSysDia: '128/76', connectionState: 'online', lastPing: 'Just now' },
  { deviceId: 'MON-OR-01', bedId: 'Theatre 1 Suite', patientName: 'Kufre Daniel Etim', heartRateBpm: 82, spo2Percent: 99, respiratoryRate: 14, nibpSysDia: '115/72', connectionState: 'online', lastPing: 'Just now' },
  { deviceId: 'MON-A&E-01', bedId: 'Resus Bay 1', patientName: 'Emergency Trauma Intake', heartRateBpm: 110, spo2Percent: 95, respiratoryRate: 22, nibpSysDia: '100/65', connectionState: 'online', lastPing: 'Just now' },
];

export const ConnectedDevicesSuite: React.FC = () => {
  const [monitors, setMonitors] = useState<ConnectedMonitorFeed[]>(INITIAL_MONITORS);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Bedside Patient Monitors</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>124 Online</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Mindray ePM & Philips IntelliVue</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Smart Infusion Pumps</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>68 Active</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Dose Error Reduction System (DERS) Active</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>RFID / RTLS Asset Badges</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>340 Tags</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Real-time Ward Localization</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Medical IoT Gateway Security</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#A78BFA' }}>VLAN Isolated</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34D399' }}>Zero Zero-Day Vulnerabilities</span>
        </div>
      </div>

      {/* Grid of Monitor Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {monitors.map(mon => (
          <div key={mon.deviceId} className="os-card" style={{ padding: 18, borderLeft: mon.spo2Percent < 92 ? '4px solid #EF4444' : '4px solid #10B981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>{mon.bedId}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#34D399', fontWeight: 700 }}>
                <Wifi size={12} /> {mon.connectionState.toUpperCase()}
              </span>
            </div>

            <h4 style={{ margin: '2px 0 10px 0', fontSize: '1.05rem', color: '#0A2540' }}>{mon.patientName}</h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>HR (bpm)</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: mon.heartRateBpm > 100 ? '#F87171' : '#FFF' }}>
                  {mon.heartRateBpm}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>SpO2 (%)</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: mon.spo2Percent < 92 ? '#EF4444' : '#34D399' }}>
                  {mon.spo2Percent}%
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>NIBP</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0A2540', marginTop: 3 }}>
                  {mon.nibpSysDia}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>ID: {mon.deviceId}</span>
              <span>Resp: {mon.respiratoryRate}/min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
