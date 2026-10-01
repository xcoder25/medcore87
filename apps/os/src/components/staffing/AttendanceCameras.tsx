'use client';

/**
 * Admin — realtime attendance cameras (live feed only; no video archive).
 * Connects browser/local or RTSP/URL cameras, tunes recognition settings, posts punches to API.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Plus, Trash2, Wifi, WifiOff, Settings2, Play, Square, Shield,
  CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { emitLiveAction } from '../../lib/liveActions';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const STORAGE_KEY = 'medcore_attendance_cameras';
const SETTINGS_KEY = 'medcore_attendance_cam_settings';

export interface CamDevice {
  id: string;
  name: string;
  location: string;
  /** browser = getUserMedia; url = external stream/page URL for edge AI box */
  mode: 'browser' | 'url';
  streamUrl?: string;
  enabled: boolean;
  status: 'offline' | 'connecting' | 'live' | 'error';
  lastError?: string;
  lastPunchAt?: string;
}

export interface CamSettings {
  confidenceMin: number;
  autoClock: boolean;
  defaultDirection: 'IN' | 'OUT' | 'AUTO';
  pollSeconds: number;
  facilityId: string;
  apiBase: string;
  /** When true, browser cam can POST test punches (manual confirm) */
  allowTestPunch: boolean;
}

const defaultSettings = (facilityId: string): CamSettings => ({
  confidenceMin: 0.85,
  autoClock: true,
  defaultDirection: 'AUTO',
  pollSeconds: 3,
  facilityId,
  apiBase: API,
  allowTestPunch: true,
});

function loadCams(): CamDevice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CamDevice[];
  } catch {
    return [];
  }
}

function saveCams(cams: CamDevice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cams));
}

function loadSettings(facilityId: string): CamSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings(facilityId);
    return { ...defaultSettings(facilityId), ...JSON.parse(raw), facilityId };
  } catch {
    return defaultSettings(facilityId);
  }
}

interface Props {
  session?: { hospitalId?: string; facility?: string; name?: string; badgeId?: string };
}

export const AttendanceCameras: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [cams, setCams] = useState<CamDevice[]>([]);
  const [settings, setSettings] = useState<CamSettings>(() => defaultSettings(facilityId));
  const [tab, setTab] = useState<'cameras' | 'settings' | 'live'>('cameras');
  const [form, setForm] = useState({ name: '', location: '', mode: 'browser' as 'browser' | 'url', streamUrl: '' });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    setCams(loadCams());
    setSettings(loadSettings(facilityId));
  }, [facilityId]);

  useEffect(() => {
    saveCams(cams);
  }, [cams]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      void navigator.mediaDevices.enumerateDevices().then((list) => {
        setDevices(list.filter((d) => d.kind === 'videoinput'));
      });
    }
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    emitLiveAction(msg, { module: 'attendance-cameras' });
    setTimeout(() => setToast(null), 3200);
  };

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewId(null);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const startBrowserPreview = async (camId: string) => {
    stopPreview();
    setCams((prev) => prev.map((c) => (c.id === camId ? { ...c, status: 'connecting', lastError: undefined } : c)));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setPreviewId(camId);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 50);
      setCams((prev) => prev.map((c) => (c.id === camId ? { ...c, status: 'live' } : c)));
      notify(`Camera live — feed is preview only (not recorded)`);
    } catch (e: any) {
      setCams((prev) =>
        prev.map((c) =>
          c.id === camId ? { ...c, status: 'error', lastError: e?.message || 'Camera permission denied' } : c
        )
      );
      notify('Could not open camera — check browser permissions');
    }
  };

  const markUrlLive = (camId: string) => {
    setCams((prev) => prev.map((c) => (c.id === camId ? { ...c, status: 'live', lastError: undefined } : c)));
    notify('Edge/URL camera marked live — recognition runs on edge box, punches via API');
  };

  const addCamera = () => {
    if (!form.name.trim()) {
      notify('Enter a camera name');
      return;
    }
    if (form.mode === 'url' && !form.streamUrl.trim()) {
      notify('Enter stream or edge-box URL');
      return;
    }
    const cam: CamDevice = {
      id: `CAM-${Date.now().toString(36).toUpperCase()}`,
      name: form.name.trim(),
      location: form.location.trim() || 'Main entrance',
      mode: form.mode,
      streamUrl: form.streamUrl.trim() || undefined,
      enabled: true,
      status: 'offline',
    };
    setCams((prev) => [cam, ...prev]);
    setForm({ name: '', location: '', mode: 'browser', streamUrl: '' });
    notify(`Camera “${cam.name}” added`);
  };

  const removeCamera = (id: string) => {
    if (previewId === id) stopPreview();
    setCams((prev) => prev.filter((c) => c.id !== id));
    notify('Camera removed');
  };

  const toggleEnabled = (id: string) => {
    setCams((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  const postPunch = async (direction: 'IN' | 'OUT', cam?: CamDevice) => {
    const body = {
      facilityId: settings.facilityId,
      direction,
      badgeId: session?.badgeId || 'TEST-BADGE',
      staffName: session?.name || 'Test Staff',
      cameraId: cam?.id || 'MANUAL',
      confidence: Math.max(settings.confidenceMin, 0.9),
      source: 'LIVE_AI' as const,
    };
    try {
      const res = await fetch(`${settings.apiBase}/api/v1/attendance/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Facility-Id': settings.facilityId },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      if (cam) {
        setCams((prev) => prev.map((c) => (c.id === cam.id ? { ...c, lastPunchAt: new Date().toISOString() } : c)));
      }
      notify(`Punch ${direction} sent · ${json.policy || 'event only'}`);
    } catch (e: any) {
      notify(`Punch failed: ${e.message} (is API running?)`);
    }
  };

  const liveCount = cams.filter((c) => c.status === 'live' && c.enabled).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid rgba(0,82,212,0.2)',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 12px 28px rgba(0,82,212,0.15)',
            fontWeight: 600,
            fontSize: '0.85rem',
            color: '#0A2540',
            maxWidth: 360,
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          background: 'linear-gradient(135deg, #E0F2FE 0%, #ECFDF5 100%)',
          borderRadius: 16,
          padding: 20,
          border: '1px solid #BAE6FD',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Camera size={22} color="#0052D4" />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0A2540' }}>
            Attendance cameras
          </h2>
          <span className="role-live-pill" style={{ marginLeft: 'auto' }}>
            {liveCount} live
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
          Realtime connection for staff recognition and time-book only. Video is <strong>not stored</strong> —
          the AI posts punch events to the API. Use a browser webcam for pilot, or point URL/RTSP edge boxes at production gates.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['cameras', 'Cameras'],
            ['live', 'Live preview'],
            ['settings', 'Settings'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className="os-ghost-btn"
            onClick={() => setTab(k)}
            style={{
              background: tab === k ? 'rgba(0,82,212,0.1)' : undefined,
              borderColor: tab === k ? '#0052D4' : undefined,
              color: tab === k ? '#0052D4' : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cameras' && (
        <>
          <div className="os-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>Add camera</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <input
                placeholder="Name (e.g. Main gate)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={inputStyle}
              />
              <input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                style={inputStyle}
              />
              <select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as 'browser' | 'url' }))}
                style={inputStyle}
              >
                <option value="browser">Browser webcam (pilot)</option>
                <option value="url">URL / edge AI box</option>
              </select>
              {form.mode === 'url' && (
                <input
                  placeholder="rtsp://… or https://edge-box/stream"
                  value={form.streamUrl}
                  onChange={(e) => setForm((f) => ({ ...f, streamUrl: e.target.value }))}
                  style={{ ...inputStyle, gridColumn: '1 / -1' }}
                />
              )}
            </div>
            <button type="button" className="os-primary-btn" onClick={addCamera} style={{ alignSelf: 'flex-start' }}>
              <Plus size={14} /> Add camera
            </button>
            {devices.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Detected webcams: {devices.map((d) => d.label || d.deviceId.slice(0, 8)).join(', ') || '—'}
              </div>
            )}
          </div>

          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th>Camera</th>
                  <th>Location</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cams.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: '#64748B', textAlign: 'center', padding: 24 }}>
                      No cameras yet — add a browser webcam or edge URL above.
                    </td>
                  </tr>
                )}
                {cams.map((cam) => (
                  <tr key={cam.id}>
                    <td style={{ fontWeight: 600 }}>
                      {cam.name}
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'var(--os-font-mono)' }}>{cam.id}</div>
                    </td>
                    <td>{cam.location}</td>
                    <td>{cam.mode === 'browser' ? 'Webcam' : 'URL / edge'}</td>
                    <td>
                      <StatusPill status={cam.status} />
                      {cam.lastError && (
                        <div style={{ fontSize: '0.7rem', color: '#B91C1C' }}>{cam.lastError}</div>
                      )}
                    </td>
                    <td>
                      <button type="button" className="os-ghost-btn" style={{ padding: '4px 8px' }} onClick={() => toggleEnabled(cam.id)}>
                        {cam.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                        {cam.enabled ? ' On' : ' Off'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {cam.mode === 'browser' ? (
                          <button
                            type="button"
                            className="os-ghost-btn"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => (previewId === cam.id ? stopPreview() : startBrowserPreview(cam.id))}
                            disabled={!cam.enabled}
                          >
                            {previewId === cam.id ? (
                              <>
                                <Square size={12} /> Stop
                              </>
                            ) : (
                              <>
                                <Play size={12} /> Connect
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="os-ghost-btn"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => markUrlLive(cam.id)}
                            disabled={!cam.enabled}
                          >
                            <Wifi size={12} /> Mark live
                          </button>
                        )}
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => postPunch('IN', cam)}
                        >
                          Test IN
                        </button>
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => postPunch('OUT', cam)}
                        >
                          Test OUT
                        </button>
                        <button
                          type="button"
                          className="os-ghost-btn"
                          style={{ padding: '4px 8px', color: '#B91C1C' }}
                          onClick={() => removeCamera(cam.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'live' && (
        <div className="os-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Wifi size={18} color="#0052D4" />
            <strong style={{ color: '#0A2540' }}>Live preview</strong>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>— not recorded · recognition edge / test punches only</span>
          </div>
          {previewId ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                maxHeight: 420,
                borderRadius: 14,
                background: '#0F172A',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                height: 240,
                borderRadius: 14,
                background: 'linear-gradient(160deg, #0F172A, #1E293B)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <Camera size={36} />
              <span>Connect a browser camera from the Cameras tab</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="os-primary-btn" onClick={() => postPunch('IN')} disabled={!settings.allowTestPunch}>
              Clock IN (test)
            </button>
            <button type="button" className="os-ghost-btn" onClick={() => postPunch('OUT')} disabled={!settings.allowTestPunch}>
              Clock OUT (test)
            </button>
            {previewId && (
              <button type="button" className="os-ghost-btn" onClick={stopPreview}>
                <Square size={14} /> Stop preview
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="os-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings2 size={18} color="#0052D4" />
            <strong>Recognition & connection settings</strong>
          </div>
          <label style={labelStyle}>
            Facility ID
            <input
              value={settings.facilityId}
              onChange={(e) => setSettings((s) => ({ ...s, facilityId: e.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            API base URL
            <input
              value={settings.apiBase}
              onChange={(e) => setSettings((s) => ({ ...s, apiBase: e.target.value }))}
              style={inputStyle}
              placeholder="http://localhost:4000"
            />
          </label>
          <label style={labelStyle}>
            Minimum confidence ({settings.confidenceMin.toFixed(2)})
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={settings.confidenceMin}
              onChange={(e) => setSettings((s) => ({ ...s, confidenceMin: Number(e.target.value) }))}
            />
          </label>
          <label style={labelStyle}>
            Default direction
            <select
              value={settings.defaultDirection}
              onChange={(e) =>
                setSettings((s) => ({ ...s, defaultDirection: e.target.value as CamSettings['defaultDirection'] }))
              }
              style={inputStyle}
            >
              <option value="AUTO">Auto (entrance logic)</option>
              <option value="IN">Always IN</option>
              <option value="OUT">Always OUT</option>
            </select>
          </label>
          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={settings.autoClock}
              onChange={(e) => setSettings((s) => ({ ...s, autoClock: e.target.checked }))}
            />
            Auto clock when confidence ≥ threshold
          </label>
          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={settings.allowTestPunch}
              onChange={(e) => setSettings((s) => ({ ...s, allowTestPunch: e.target.checked }))}
            />
            Allow test punches from admin UI
          </label>
          <div
            style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: 12,
              padding: 12,
              fontSize: '0.82rem',
              color: '#0C4A6E',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              NDPR: live processing for attendance only. MedCore stores punch events (staff, time, camera id, confidence) —
              not continuous CCTV video. Configure edge boxes to call{' '}
              <code style={{ fontSize: '0.75rem' }}>POST /api/v1/attendance/punch</code>.
            </span>
          </div>
          <button
            type="button"
            className="os-primary-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => notify('Camera settings saved')}
          >
            <CheckCircle2 size={14} /> Save settings
          </button>
        </div>
      )}
    </div>
  );
};

function StatusPill({ status }: { status: CamDevice['status'] }) {
  const map: Record<CamDevice['status'], { label: string; color: string; icon: React.ReactNode }> = {
    offline: { label: 'Offline', color: '#64748B', icon: <WifiOff size={12} /> },
    connecting: { label: 'Connecting', color: '#3B82F6', icon: <RefreshCw size={12} /> },
    live: { label: 'Live', color: '#059669', icon: <Wifi size={12} /> },
    error: { label: 'Error', color: '#DC2626', icon: <AlertTriangle size={12} /> },
  };
  const m = map[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: m.color, fontWeight: 700, fontSize: '0.78rem' }}>
      {m.icon} {m.label}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: '0.88rem',
  color: '#0A2540',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#334155',
};

export default AttendanceCameras;
