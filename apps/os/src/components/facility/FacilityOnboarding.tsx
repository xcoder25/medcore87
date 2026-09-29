'use client';

/**
 * Hospital profile for the logged-in hospital admin only.
 * One admin ↔ one facility — no multi-hospital registry on this screen.
 */
import React, { useEffect, useState } from 'react';
import {
  Building2, CheckCircle2, MapPin, Phone, Globe, Edit2, Save, X, Shield,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { emitLiveAction } from '../../lib/liveActions';

export interface HospitalProfile {
  id: string;
  name: string;
  type: string;
  lga: string;
  address: string;
  beds: number;
  phone: string;
  email: string;
  licenseNo: string;
  licenseExpiry: string;
  status: 'active' | 'pending' | 'suspended';
  tier: string;
  medicalDirector: string;
}

function profileKey(hospitalId: string) {
  return `medcore_hospital_profile_${hospitalId}`;
}

function loadProfile(session?: UserSession): HospitalProfile {
  const id = session?.hospitalId || 'UNKNOWN';
  const name = session?.facility || session?.hospitalName || 'My Hospital';
  const blank: HospitalProfile = {
    id,
    name,
    type: 'General Hospital',
    lga: '',
    address: '',
    beds: 0,
    phone: '',
    email: '',
    licenseNo: '',
    licenseExpiry: '',
    status: 'active',
    tier: 'Secondary Care',
    medicalDirector: session?.name || '',
  };
  if (typeof window === 'undefined') return blank;
  try {
    const raw = localStorage.getItem(profileKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as HospitalProfile;
      return { ...blank, ...parsed, id, name: parsed.name || name };
    }
  } catch {
    /* ignore */
  }
  return blank;
}

function saveProfile(p: HospitalProfile) {
  try {
    localStorage.setItem(profileKey(p.id), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

interface Props {
  session?: UserSession;
}

export const FacilityOnboarding: React.FC<Props> = ({ session }) => {
  const [profile, setProfile] = useState<HospitalProfile>(() => loadProfile(session));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HospitalProfile>(profile);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const p = loadProfile(session);
    setProfile(p);
    setDraft(p);
  }, [session?.hospitalId, session?.facility]);

  const startEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(profile);
    setEditing(false);
  };

  const save = () => {
    const next = { ...draft, id: profile.id };
    setProfile(next);
    saveProfile(next);
    setEditing(false);
    setSavedAt(new Date().toLocaleTimeString());
    emitLiveAction(`Hospital profile saved · ${next.name}`, { module: 'hospital-profile' });
  };

  const field = (
    label: string,
    key: keyof HospitalProfile,
    opts?: { type?: string; readOnly?: boolean }
  ) => {
    const value = String(draft[key] ?? '');
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
        {label}
        <input
          type={opts?.type || 'text'}
          value={value}
          readOnly={!editing || opts?.readOnly}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              [key]: key === 'beds' ? Number(e.target.value) || 0 : e.target.value,
            }))
          }
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#0A2540',
            background: editing && !opts?.readOnly ? '#fff' : '#F8FAFC',
          }}
        />
      </label>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 920 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #E0F2FE 0%, #ECFDF5 100%)',
          borderRadius: 16,
          padding: 20,
          border: '1px solid #BAE6FD',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Building2 size={22} color="#0052D4" />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
              My hospital
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#475569' }}>
              You administer <strong>one facility only</strong>. This profile is for{' '}
              <strong>{profile.name}</strong> ({profile.id}) — not a statewide hospital list.
            </p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(5, 150, 105, 0.12)',
              color: '#047857',
              fontSize: '0.75rem',
              fontWeight: 800,
            }}
          >
            <Shield size={13} /> 1 admin · 1 hospital
          </span>
        </div>
      </div>

      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label">
            <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} /> Status
          </span>
          <span className="metric-val" style={{ fontSize: '1.1rem', textTransform: 'capitalize' }}>
            {profile.status}
          </span>
          <span className="metric-sub">This facility only</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Registered beds</span>
          <span className="metric-val">{profile.beds || '—'}</span>
          <span className="metric-sub">{profile.tier || '—'}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">LGA</span>
          <span className="metric-val" style={{ fontSize: '1.05rem' }}>
            {profile.lga || '—'}
          </span>
          <span className="metric-sub">Local Government Area</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">License</span>
          <span className="metric-val" style={{ fontSize: '0.95rem' }}>
            {profile.licenseNo || '—'}
          </span>
          <span className="metric-sub">Exp. {profile.licenseExpiry || '—'}</span>
        </div>
      </div>

      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>
            Facility details
          </h3>
          {!editing ? (
            <button type="button" className="os-ghost-btn" onClick={startEdit}>
              <Edit2 size={14} /> Edit profile
            </button>
          ) : (
            <>
              <button type="button" className="os-ghost-btn" onClick={cancelEdit}>
                <X size={14} /> Cancel
              </button>
              <button type="button" className="os-primary-btn" onClick={save}>
                <Save size={14} /> Save
              </button>
            </>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {field('Hospital name', 'name')}
          {field('Facility ID', 'id', { readOnly: true })}
          {field('Type', 'type')}
          {field('Tier', 'tier')}
          {field('LGA', 'lga')}
          {field('Total beds', 'beds', { type: 'number' })}
          {field('Medical director', 'medicalDirector')}
          {field('License number', 'licenseNo')}
          {field('License expiry', 'licenseExpiry')}
          {field('Phone', 'phone')}
          {field('Email', 'email')}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155', gridColumn: '1 / -1' }}>
            Address
            <input
              value={draft.address}
              readOnly={!editing}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                fontSize: '0.9rem',
                background: editing ? '#fff' : '#F8FAFC',
              }}
            />
          </label>
          {editing && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
              Status
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value as HospitalProfile['status'] }))
                }
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.9rem' }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending renewal</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          )}
        </div>

        {!editing && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem', color: '#475569' }}>
            {profile.address && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <MapPin size={15} color="#0052D4" /> {profile.address}
              </div>
            )}
            {profile.phone && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Phone size={15} color="#0052D4" /> {profile.phone}
              </div>
            )}
            {profile.email && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Globe size={15} color="#0052D4" /> {profile.email}
              </div>
            )}
          </div>
        )}

        {savedAt && (
          <p style={{ margin: '14px 0 0', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
            Saved at {savedAt}
          </p>
        )}
      </div>
    </div>
  );
};

export default FacilityOnboarding;
