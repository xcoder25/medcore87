'use client';
import React, { useState } from 'react';
import { Settings, Server, Database, Wifi, Shield, RefreshCw, CheckCircle2, AlertCircle, HardDrive, Clock } from 'lucide-react';

const SYSTEM_SERVICES = [
  { name: 'Primary Database (PostgreSQL)', version: '15.4', status: 'running', cpu: '18%', memory: '4.2 GB / 16 GB', uptime: '14d 6h 32m' },
  { name: 'Application Server (Node.js)', version: '20.x LTS', status: 'running', cpu: '8%', memory: '1.1 GB / 8 GB', uptime: '14d 6h 31m' },
  { name: 'API Gateway (Express)', version: '4.19', status: 'running', cpu: '4%', memory: '512 MB / 4 GB', uptime: '14d 6h 31m' },
  { name: 'Backup Service', version: '3.2.1', status: 'running', cpu: '1%', memory: '256 MB / 2 GB', uptime: '14d 6h 30m' },
  { name: 'Health Insurance Connector (AKSHIA)', version: '2.1.0', status: 'running', cpu: '2%', memory: '384 MB / 2 GB', uptime: '12d 3h 10m' },
  { name: 'SMS Notification Service', version: '1.4.0', status: 'warning', cpu: '3%', memory: '180 MB / 1 GB', uptime: '0d 4h 12m' },
];

const BACKUP_HISTORY = [
  { id: 'BKP-2026-0916-0300', time: '03:00 Today', type: 'Full', size: '48.2 GB', status: 'success', duration: '12 min 44 sec' },
  { id: 'BKP-2026-0915-2100', time: '21:00 Yesterday', type: 'Incremental', size: '1.8 GB', status: 'success', duration: '1 min 20 sec' },
  { id: 'BKP-2026-0915-1500', time: '15:00 Yesterday', type: 'Incremental', size: '2.1 GB', status: 'success', duration: '1 min 35 sec' },
  { id: 'BKP-2026-0915-0300', time: '03:00 Yesterday', type: 'Full', size: '47.9 GB', status: 'success', duration: '12 min 11 sec' },
  { id: 'BKP-2026-0914-2100', time: '21:00 14 Sep', type: 'Incremental', size: '0.9 GB', status: 'failed', duration: 'N/A' },
];

const STATUS_META = {
  running: { label: 'Running', color: '#22C55E' },
  warning: { label: 'Warning', color: '#F59E0B' },
  stopped: { label: 'Stopped', color: '#EF4444' },
  success: { label: 'Success', color: '#22C55E' },
  failed: { label: 'Failed', color: '#EF4444' },
};

export const SystemAdministration: React.FC = () => {
  const [tab, setTab] = useState<'services' | 'backups'>('services');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><Server size={13} style={{ display: 'inline', marginRight: 4 }} />Services Running</span>
          <span className="metric-val">{SYSTEM_SERVICES.filter(s => s.status === 'running').length}/{SYSTEM_SERVICES.length}</span>
          <span className="metric-sub">All core hospital services active</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><HardDrive size={13} style={{ display: 'inline', marginRight: 4 }} />Database Size</span>
          <span className="metric-val">48.2 GB</span>
          <span className="metric-sub">Last full backup: Today 03:00</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />System Uptime</span>
          <span className="metric-val">14d 6h</span>
          <span className="metric-sub">Since last scheduled maintenance</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Warnings</span>
          <span className="metric-val">{SYSTEM_SERVICES.filter(s => s.status === 'warning').length}</span>
          <span className="metric-sub">SMS service recently restarted</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['services', 'backups'] as const).map(t => (
          <button key={t} className="os-ghost-btn" onClick={() => setTab(t)}
            style={{ background: tab === t ? 'rgba(234,88,12,0.15)' : undefined, borderColor: tab === t ? '#EA580C' : undefined, color: tab === t ? '#FB923C' : undefined }}>
            {t === 'services' ? 'System Services' : 'Backup History'}
          </button>
        ))}
        <button className="os-ghost-btn" style={{ marginLeft: 'auto' }}><RefreshCw size={13} /> Refresh Status</button>
      </div>

      {tab === 'services' && (
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Version</th>
                <th>Status</th>
                <th>CPU Usage</th>
                <th>Memory</th>
                <th>Uptime</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_SERVICES.map(s => {
                const meta = STATUS_META[s.status as keyof typeof STATUS_META];
                return (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 600, color: '#0A2540', fontSize: '0.88rem' }}>{s.name}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{s.version}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
                        <span style={{ color: meta.color, fontSize: '0.8rem', fontWeight: 600 }}>{meta.label}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.82rem', color: '#94A3B8' }}>{s.cpu}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#94A3B8' }}>{s.memory}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{s.uptime}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="os-ghost-btn" style={{ padding: '4px 10px', fontSize: '0.73rem' }}>Restart</button>
                        <button className="os-ghost-btn" style={{ padding: '4px 8px' }}><Settings size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'backups' && (
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Backup ID</th>
                <th>Time</th>
                <th>Type</th>
                <th>Size</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {BACKUP_HISTORY.map(bk => {
                const meta = STATUS_META[bk.status as keyof typeof STATUS_META];
                return (
                  <tr key={bk.id}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{bk.id}</td>
                    <td style={{ color: '#94A3B8', fontSize: '0.83rem' }}>{bk.time}</td>
                    <td>
                      <span style={{ background: bk.type === 'Full' ? 'rgba(234,88,12,0.15)' : 'rgba(59,130,246,0.12)', color: bk.type === 'Full' ? '#FB923C' : '#60A5FA', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>
                        {bk.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', color: '#0A2540', fontSize: '0.82rem' }}>{bk.size}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {bk.status === 'success' ? <CheckCircle2 size={14} style={{ color: '#22C55E' }} /> : <AlertCircle size={14} style={{ color: '#EF4444' }} />}
                        <span style={{ color: meta.color, fontSize: '0.8rem', fontWeight: 600 }}>{meta.label}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{bk.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
