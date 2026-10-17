'use client';
import React, { useState } from 'react';
import { resetAllPilotData } from '../../lib/adminRealtimeStore';
import { Settings, Server, Database, Wifi, Shield, RefreshCw, CheckCircle2, AlertCircle, HardDrive, Clock, Trash2, AlertTriangle } from 'lucide-react';

const SYSTEM_SERVICES: any[] = [];

const BACKUP_HISTORY: any[] = [];

const STATUS_META = {
  running: { label: 'Running', color: '#22C55E' },
  warning: { label: 'Warning', color: '#F59E0B' },
  stopped: { label: 'Stopped', color: '#EF4444' },
  success: { label: 'Success', color: '#22C55E' },
  failed: { label: 'Failed', color: '#EF4444' },
};

export const SystemAdministration: React.FC = () => {
  const [tab, setTab] = useState<'services' | 'backups'>('services');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokePhrase, setRevokePhrase] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const revokeAllStaffAccounts = async () => {
    if (revokePhrase !== 'REVOKE_ALL_ACCOUNTS') {
      setAuthMsg('Cancelled — confirmation phrase did not match.');
      setShowRevokeModal(false);
      setRevokePhrase('');
      return;
    }
    setShowRevokeModal(false);
    setRevokePhrase('');
    setAuthBusy(true);
    setAuthMsg('Revoking all staff portal accounts…');
    try {
      const { getFirebaseAuth } = await import('../../lib/firebase');
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        setAuthMsg('Administrator must be signed in to authorize this action. Please re-authenticate and try again.');
        setAuthBusy(false);
        return;
      }
      const idToken = await user.getIdToken(true);
      const secret =
        (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ADMIN_API_SECRET) ||
        window.localStorage.getItem('medcore_admin_api_secret') ||
        '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };
      if (secret) headers['x-admin-secret'] = secret;

      const res = await fetch('/api/staff/delete-all-auth', {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirm: 'DELETE_ALL_AUTH_USERS' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthMsg(data.error || `Revocation failed (code ${res.status}). Contact your system administrator.`);
        setAuthBusy(false);
        return;
      }
      setAuthMsg(
        `Successfully revoked ${data.deleted ?? 0} staff portal account(s).` +
          (data.errorCount ? ` ${data.errorCount} could not be processed — contact support.` : '') +
          ' Local records are retained — re-enrol staff to restore access.'
      );
      try {
        const { firebaseSignOut } = await import('../../lib/firebase');
        await firebaseSignOut();
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem('medcore_os_session');
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        window.location.href = window.location.pathname || '/';
      }, 1200);
    } catch (e) {
      setAuthMsg((e as Error)?.message || 'Request failed. Check your network connection and try again.');
    } finally {
      setAuthBusy(false);
    }
  };

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
        <button type="button" className="os-ghost-btn" style={{ marginLeft: 'auto' }}><RefreshCw size={13} /> Refresh Status</button>
        <button
          type="button"
          className="os-ghost-btn"
          style={{ borderColor: '#FECACA', color: '#B91C1C' }}
          onClick={() => setShowResetModal(true)}
        >
          <Trash2 size={13} style={{ display: 'inline', marginRight: 4 }} />
          Reset all facility data
        </button>
        <button
          type="button"
          className="os-ghost-btn"
          disabled={authBusy}
          style={{ borderColor: '#7F1D1D', color: '#991B1B', opacity: authBusy ? 0.6 : 1 }}
          onClick={() => setShowRevokeModal(true)}
        >
          <Shield size={13} style={{ display: 'inline', marginRight: 4 }} />
          {authBusy ? 'Revoking accounts…' : 'Revoke all staff portal accounts'}
        </button>
      </div>

      {/* Revoke Accounts Modal */}
      {showRevokeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFF', borderRadius: 18, padding: 32, maxWidth: 460, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Revoke All Staff Portal Access</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>This action cannot be undone</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 16px' }}>
              This will immediately revoke portal login access for <strong>every enrolled staff member</strong> across all workstations. Local clinical records are retained. Staff must be re-enrolled to restore access.
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>Type <code style={{ background: '#FEF2F2', padding: '2px 6px', borderRadius: 4 }}>REVOKE_ALL_ACCOUNTS</code> to confirm:</p>
            <input
              type="text"
              value={revokePhrase}
              onChange={e => setRevokePhrase(e.target.value)}
              placeholder="Type confirmation phrase here"
              style={{ width: '100%', border: '1.5px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'ui-monospace, monospace', outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="os-ghost-btn" onClick={() => { setShowRevokeModal(false); setRevokePhrase(''); }}>Cancel</button>
              <button
                className="os-ghost-btn"
                style={{ borderColor: '#DC2626', color: '#DC2626', opacity: revokePhrase !== 'REVOKE_ALL_ACCOUNTS' ? 0.5 : 1 }}
                disabled={revokePhrase !== 'REVOKE_ALL_ACCOUNTS'}
                onClick={() => void revokeAllStaffAccounts()}
              >Confirm Revocation</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Data Modal */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFF', borderRadius: 18, padding: 32, maxWidth: 460, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={22} color="#DC2626" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>Reset All Facility Data</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>This action cannot be undone</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
              This will permanently clear all local hospital records on this workstation and erase facility cloud copies — including staff, patients, beds, orders, and ANC data. You will be signed out immediately.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="os-ghost-btn" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button
                className="os-ghost-btn"
                style={{ borderColor: '#DC2626', color: '#DC2626' }}
                onClick={() => { resetAllPilotData({ wipeCloud: true }); window.location.href = window.location.pathname || '/'; }}
              >Yes, Reset Everything</button>
            </div>
          </div>
        </div>
      )}

      {authMsg && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: authMsg.startsWith('Successfully') ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${authMsg.startsWith('Successfully') ? '#A7F3D0' : '#FECACA'}`,
            color: authMsg.startsWith('Successfully') ? '#065F46' : '#991B1B',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {authMsg}
        </div>
      )}

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
