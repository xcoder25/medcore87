'use client';

import React, { useState } from 'react';
import {
  Wrench, AlertTriangle, CheckCircle2, ShieldCheck,
  Search, RefreshCw, Cpu, Activity, Clock
} from 'lucide-react';
import type { BiomedicalDevice } from '@medcore/types';

const INITIAL_DEVICES: BiomedicalDevice[] = [];

export const BiomedicalEquipmentSuite: React.FC = () => {
  const [devices, setDevices] = useState<BiomedicalDevice[]>(INITIAL_DEVICES);
  const [search, setSearch] = useState('');

  const dueCount = devices.filter(d => d.status === 'calibration_due' || d.status === 'under_repair').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Clinical Assets Registered</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>1,480</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>RFID Tagged</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Asset Registry Compliant</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Service / Calibration Due</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{dueCount} Devices</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Action Needed</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Biphasic Defibrillator & Endoscope</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Equipment Uptime Rate</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>99.1%</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Uptime</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Preventive Maintenance SLA Exceeded</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Biomedical Engineering Crew</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>6 Engineers</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>On Duty</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>24/7 Rapid Response Coverage</span>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            Biomedical Asset & Preventive Maintenance Ledger
          </span>
          <div className="os-search-wrap">
            <Search size={14} />
            <input
              className="os-search-input"
              placeholder="Search asset tag, device, department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Device Description</th>
                <th>Department</th>
                <th>Manufacturer / Model</th>
                <th>Last Calibration</th>
                <th>Next Service Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(device => {
                const isWarn = device.status === 'calibration_due';
                const isErr = device.status === 'under_repair';
                return (
                  <tr key={device.id}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.74rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>
                      {device.assetTag}
                    </td>
                    <td style={{ fontWeight: 700, color: '#0A2540' }}>{device.deviceName}</td>
                    <td>{device.department}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--os-text-muted)' }}>{device.manufacturer} ({device.model})</td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--os-text-dim)' }}>{device.lastCalibratedAt}</td>
                    <td style={{ fontSize: '0.76rem', fontWeight: 700, color: isWarn ? '#FBBF24' : isErr ? '#EF4444' : '#FFF' }}>
                      {device.nextServiceDue}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: isErr ? 'rgba(239,68,68,0.2)' : isWarn ? 'rgba(234,179,8,0.2)' : 'rgba(5,150,105,0.12)',
                        color: isErr ? '#F87171' : isWarn ? '#FBBF24' : '#34D399',
                      }}>
                        {device.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
