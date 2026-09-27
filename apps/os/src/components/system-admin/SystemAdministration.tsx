'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Settings, Server, Database, RefreshCw, CheckCircle2, AlertCircle, HardDrive, Clock, Play, Square, Zap } from 'lucide-react';
import { emitLiveAction } from '../../lib/liveActions';

type ServiceStatus = 'running' | 'warning' | 'stopped' | 'restarting';
interface SystemService {
  id: string; name: string; version: string; status: ServiceStatus; cpu: string; memory: string; uptime: string;
}
interface BackupRecord {
  id: string; time: string; type: 'Full' | 'Incremental'; size: string; status: 'success' | 'failed' | 'running'; duration: string;
}

const INITIAL_SERVICES: SystemService[] = [
  { id: 'pg', name: 'Primary Database (PostgreSQL)', version: '15.4', status: 'running', cpu: '18%', memory: '4.2 GB / 16 GB', uptime: '14d 6h 32m' },
  { id: 'node', name: 'Application Server (Node.js)', version: '20.x LTS', status: 'running', cpu: '8%', memory: '1.1 GB / 8 GB', uptime: '14d 6h 31m' },
  { id: 'api', name: 'API Gateway (Express)', version: '4.19', status: 'running', cpu: '4%', memory: '512 MB / 4 GB', uptime: '14d 6h 31m' },
  { id: 'backup', name: 'Backup Service', version: '3.2.1', status: 'running', cpu: '1%', memory: '256 MB / 2 GB', uptime: '14d 6h 30m' },
  { id: 'ws', name: 'Realtime Event Bus (WebSocket)', version: '1.0', status: 'running', cpu: '2%', memory: '128 MB / 1 GB', uptime: '14d 6h 30m' },
  { id: 'm87', name: 'M87 AI Inference Engine', version: '4.2', status: 'running', cpu: '12%', memory: '2.1 GB / 8 GB', uptime: '14d 6h 28m' },
  { id: 'sms', name: 'SMS Notification Service', version: '1.4.0', status: 'warning', cpu: '3%', memory: '180 MB / 1 GB', uptime: '0d 4h 12m' },
];

const INITIAL_BACKUPS: BackupRecord[] = [
  { id: 'BKP-2026-0916-0300', time: '03:00 Today', type: 'Full', size: '48.2 GB', status: 'success', duration: '12 min 44 sec' },
  { id: 'BKP-2026-0915-2100', time: '21:00 Yesterday', type: 'Incremental', size: '1.8 GB', status: 'success', duration: '1 min 20 sec' },
  { id: 'BKP-2026-0915-1500', time: '15:00 Yesterday', type: 'Incremental', size: '2.1 GB', status: 'success', duration: '1 min 35 sec' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  running: { label: 'Running', color: '#22C55E' },
  warning: { label: 'Warning', color: '#F59E0B' },
  stopped: { label: 'Stopped', color: '#EF4444' },
  restarting: { label: 'Restarting', color: '#3B82F6' },
  success: { label: 'Success', color: '#22C55E' },
  failed: { label: 'Failed', color: '#EF4444' },
};

function jitterCpu(base: string): string {
  const n = parseInt(base, 10) || 5;
  return `${Math.max(1, Math.min(95, n + Math.floor(Math.random() * 7) - 3))}%`;
}

export const SystemAdministration: React.FC = () => {
  const [tab, setTab] = useState<'services' | 'backups' | 'activity'>('services');
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [backups, setBackups] = useState(INITIAL_BACKUPS);
  const [activityLog, setActivityLog] = useState<string[]>([`[${new Date().toLocaleTimeString()}] System Administration online — controls live`]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const pushLog = useCallback((msg: string) => {
    setActivityLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 40));
    emitLiveAction(msg, { module: 'sysadmin' });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setServices((prev) => prev.map((s) => (s.status === 'running' || s.status === 'warning' ? { ...s, cpu: jitterCpu(s.cpu) } : s)));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    pushLog('Refreshing service telemetry…');
    setTimeout(() => {
      setServices((prev) => prev.map((s) => ({ ...s, cpu: jitterCpu(s.cpu) })));
      setLastRefresh(new Date());
      setRefreshing(false);
      pushLog('Telemetry refresh complete');
    }, 600);
  };

  const handleRestart = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    pushLog(`Restart requested: ${svc.name}`);
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'restarting', cpu: '0%' } : s)));
    setTimeout(() => {
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running', cpu: '3%', uptime: '0d 0h 0m' } : s)));
      pushLog(`${svc.name} restarted — health OK`);
    }, 1500);
  };

  const handleStop = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc || id === 'pg' || id === 'm87') {
      pushLog(`Stop blocked for critical service ${svc?.name ?? id}`);
      return;
    }
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'stopped', cpu: '0%' } : s)));
    pushLog(`${svc.name} stopped`);
  };

  const handleStart = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'restarting' } : s)));
    pushLog(`Starting ${svc.name}…`);
    setTimeout(() => {
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running', cpu: '4%', uptime: '0d 0h 0m' } : s)));
      pushLog(`${svc.name} is online`);
    }, 1000);
  };

  const handleRunBackup = (type: 'Full' | 'Incremental') => {
    const id = `BKP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    setBackups((prev) => [{ id, time: 'Just now', type, size: '…', status: 'running', duration: 'in progress' }, ...prev]);
    pushLog(`${type} backup ${id} started`);
    setTimeout(() => {
      setBackups((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: 'success' as const,
                size: type === 'Full' ? '48.4 GB' : `${(0.8 + Math.random() * 1.5).toFixed(1)} GB`,
                duration: type === 'Full' ? '11 min 58 sec' : `${Math.floor(40 + Math.random() * 50)} sec`,
              }
            : b
        )
      );
      pushLog(`${type} backup ${id} completed`);
    }, type === 'Full' ? 2000 : 1100);
  };

  const runningCount = services.filter((s) => s.status === 'running').length;
  const warningCount = services.filter((s) => s.status === 'warning' || s.status === 'stopped').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><Server size={13} style={{ display: 'inline', marginRight: 4 }} />Services</span>
          <span className="metric-val">{runningCount}/{services.length}</span>
          <span className="metric-sub">Realtime controls</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><HardDrive size={13} style={{ display: 'inline', marginRight: 4 }} />Database</span>
          <span className="metric-val">48.2 GB</span>
          <span className="metric-sub">Backup live</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Last refresh</span>
          <span className="metric-val" style={{ fontSize: '1.05rem' }}>{lastRefresh.toLocaleTimeString()}</span>
          <span className="metric-sub">Telemetry</span>
        </div>
        <div className={`metric-box ${warningCount ? 'alert-yellow' : 'alert-green'}`}>
          <span className="metric-label"><AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Warnings</span>
          <span className="metric-val">{warningCount}</span>
          <span className="metric-sub">{warningCount ? 'Needs attention' : 'All clear'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['services', 'backups', 'activity'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="os-ghost-btn"
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? 'rgba(0,82,212,0.1)' : undefined,
              borderColor: tab === t ? '#0052D4' : undefined,
              color: tab === t ? '#0052D4' : undefined,
            }}
          >
            {t === 'services' ? 'System Services' : t === 'backups' ? 'Backup History' : 'Activity Log'}
          </button>
        ))}
        <button type="button" className="os-ghost-btn" style={{ marginLeft: 'auto' }} onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={13} /> {refreshing ? 'Refreshing…' : 'Refresh Status'}
        </button>
        <button type="button" className="os-ghost-btn" onClick={() => handleRunBackup('Incremental')}>
          <Zap size={13} /> Incremental Backup
        </button>
        <button type="button" className="os-primary-btn" onClick={() => handleRunBackup('Full')}>
          <Database size={13} /> Full Backup
        </button>
      </div>

      {tab === 'services' && (
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Service</th><th>Version</th><th>Status</th><th>CPU</th><th>Memory</th><th>Uptime</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => {
                const meta = STATUS_META[svc.status];
                return (
                  <tr key={svc.id}>
                    <td style={{ fontWeight: 600 }}>{svc.name}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{svc.version}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: meta.color, fontWeight: 600, fontSize: '0.8rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--os-font-mono)' }}>{svc.cpu}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{svc.memory}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{svc.uptime}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(svc.status === 'running' || svc.status === 'warning') && (
                          <button type="button" className="os-ghost-btn" style={{ padding: '4px 10px', fontSize: '0.73rem' }} onClick={() => handleRestart(svc.id)}>
                            <RefreshCw size={12} /> Restart
                          </button>
                        )}
                        {svc.status === 'running' && svc.id !== 'pg' && svc.id !== 'm87' && (
                          <button type="button" className="os-ghost-btn" style={{ padding: '4px 10px', fontSize: '0.73rem' }} onClick={() => handleStop(svc.id)}>
                            <Square size={12} /> Stop
                          </button>
                        )}
                        {svc.status === 'stopped' && (
                          <button type="button" className="os-ghost-btn" style={{ padding: '4px 10px', fontSize: '0.73rem' }} onClick={() => handleStart(svc.id)}>
                            <Play size={12} /> Start
                          </button>
                        )}
                        {svc.status === 'restarting' && <span style={{ fontSize: '0.73rem', color: '#3B82F6', fontWeight: 600 }}>Restarting…</span>}
                        <button type="button" className="os-ghost-btn" style={{ padding: '4px 8px' }} onClick={() => pushLog(`Opened settings for ${svc.name}`)}>
                          <Settings size={13} />
                        </button>
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
              <tr><th>Backup ID</th><th>Time</th><th>Type</th><th>Size</th><th>Status</th><th>Duration</th></tr>
            </thead>
            <tbody>
              {backups.map((bk) => {
                const meta = STATUS_META[bk.status] || STATUS_META.running;
                return (
                  <tr key={bk.id}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem' }}>{bk.id}</td>
                    <td>{bk.time}</td>
                    <td><span style={{ fontSize: '0.72rem', fontWeight: 700, color: bk.type === 'Full' ? '#0052D4' : '#0D9488' }}>{bk.type}</span></td>
                    <td style={{ fontFamily: 'var(--os-font-mono)' }}>{bk.size}</td>
                    <td style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</td>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem' }}>{bk.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && (
        <div className="os-card" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {activityLog.map((line, i) => (
            <div key={i} style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', padding: '6px 0', borderBottom: '1px solid #E2E8F0', color: i === 0 ? '#0052D4' : '#64748B' }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
