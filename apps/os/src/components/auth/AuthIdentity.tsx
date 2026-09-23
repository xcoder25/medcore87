'use client';
import React, { useState } from 'react';
import { Shield, User, Key, Lock, Unlock, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const ACTIVE_SESSIONS = [
  { user: 'Dr. Emeka Adeyemi', id: 'ISH-SURG-042', since: '07:05', ip: '192.168.1.22', device: 'Windows 11 — Chrome 127', ward: 'Surgical Ward' },
  { user: 'Nurse Aisha Bello', id: 'ISH-NUR-118', since: '07:10', ip: '192.168.1.45', device: 'iPad Pro — Safari 17', ward: 'Female Medical' },
  { user: 'Amaka Oguike', id: 'ISH-REV-009', since: '08:30', ip: '192.168.1.31', device: 'Windows 10 — Edge 124', ward: 'Billing Office' },
  { user: 'Kelechi Obiora', id: 'ISH-LAB-023', since: '08:05', ip: '192.168.1.58', device: 'Ubuntu 22 — Firefox 118', ward: 'Laboratory' },
];

const SECURITY_LOG = [
  { time: '09:12', event: 'Successful Login', user: 'Dr. Nkechi Bassey', type: 'success', detail: 'Biometric authentication via Ward Terminal B3' },
  { time: '09:08', event: 'Permission Override', user: 'Dr. Evelyn Vance', type: 'warning', detail: 'Executive override — viewed restricted audit log AUD-0081' },
  { time: '08:55', event: 'Failed Login Attempt', user: 'Unknown (ISH-ADM-044)', type: 'danger', detail: 'Incorrect PIN (3 attempts) — account pending activation' },
  { time: '08:30', event: 'Account Unlocked', user: 'Amaka Oguike', type: 'success', detail: 'Password reset via Admin — ISH-REV-009 account restored' },
  { time: '07:45', event: 'Successful Login', user: 'Kelechi Obiora', type: 'success', detail: 'Staff ID + password from Radiology terminal' },
  { time: '07:10', event: 'Session Timeout', user: 'Dr. Iniobong Edem', type: 'info', detail: 'Auto-lock after 15 min inactivity — ICU workstation' },
];

const LOG_META = {
  success: { color: '#22C55E', icon: <CheckCircle2 size={14} /> },
  warning: { color: '#F59E0B', icon: <AlertCircle size={14} /> },
  danger: { color: '#EF4444', icon: <Lock size={14} /> },
  info: { color: '#60A5FA', icon: <Clock size={14} /> },
};

export const AuthIdentity: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'log'>('sessions');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><User size={13} style={{ display: 'inline', marginRight: 4 }} />Active Sessions</span>
          <span className="metric-val">{ACTIVE_SESSIONS.length}</span>
          <span className="metric-sub">Staff currently logged in</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Failed Logins (Today)</span>
          <span className="metric-val">3</span>
          <span className="metric-sub">1 account under lockout review</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Key size={13} style={{ display: 'inline', marginRight: 4 }} />Password Resets (Today)</span>
          <span className="metric-val">2</span>
          <span className="metric-sub">Completed by Admin</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Shield size={13} style={{ display: 'inline', marginRight: 4 }} />2FA Enabled Accounts</span>
          <span className="metric-val">94%</span>
          <span className="metric-sub">of all active staff accounts</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['sessions', 'log'] as const).map(tab => (
          <button key={tab} className="os-ghost-btn" onClick={() => setActiveTab(tab)}
            style={{ background: activeTab === tab ? 'rgba(234,88,12,0.15)' : undefined, borderColor: activeTab === tab ? '#EA580C' : undefined, color: activeTab === tab ? '#FB923C' : undefined }}>
            {tab === 'sessions' ? 'Active Sessions' : 'Security Log'}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' && (
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Badge ID</th>
                <th>Ward / Unit</th>
                <th>Device</th>
                <th>IP Address</th>
                <th>Session Since</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVE_SESSIONS.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: '#0A2540' }}>{s.user}</td>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B' }}>{s.id}</td>
                  <td style={{ color: '#94A3B8', fontSize: '0.83rem' }}>{s.ward}</td>
                  <td style={{ color: '#94A3B8', fontSize: '0.78rem' }}>{s.device}</td>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#60A5FA' }}>{s.ip}</td>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#64748B' }}>{s.since}</td>
                  <td><button className="os-ghost-btn" style={{ fontSize: '0.74rem', color: '#EF4444', padding: '4px 10px' }}><Unlock size={13} /> Force Logout</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECURITY_LOG.map((entry, idx) => {
            const meta = LOG_META[entry.type as keyof typeof LOG_META];
            return (
              <div key={idx} className="os-card" style={{ padding: '12px 16px', borderLeft: `3px solid ${meta.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: meta.color, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.82rem' }}>{entry.event}</span>
                        <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>— {entry.user}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{entry.detail}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.78rem', color: '#64748B', flexShrink: 0, marginLeft: 12 }}>{entry.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
