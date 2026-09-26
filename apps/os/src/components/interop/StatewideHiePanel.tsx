'use client';

import React, { useState } from 'react';
import {
  Network, Search, FileJson, ShieldCheck, Activity, Syringe, Baby, Radio
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Props {
  session?: { hospitalId?: string; name?: string; badgeId?: string };
}

export const StatewideHiePanel: React.FC<Props> = ({ session }) => {
  const [q, setQ] = useState('');
  const [hid, setHid] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'mpi' | 'shr' | 'connectathon' | 'status'>('mpi');
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const call = async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}${path}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.issue?.[0]?.diagnostics || res.statusText);
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'Request failed — is API running on :4000?');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const searchMpi = () => call(`/api/v1/hie/mpi/search?q=${encodeURIComponent(q)}&facilityId=${facilityId}`);
  const loadShr = () =>
    call(`/api/v1/hie/shr/${encodeURIComponent(hid)}?facilityId=${facilityId}&pilot=true&actorId=${session?.badgeId || 'OS'}`);
  const loadFhir = () =>
    call(`/api/v1/hie/shr/${encodeURIComponent(hid)}/fhir?pilot=true`);
  const loadStatus = () => call('/api/v1/hie/status');
  const loadTracks = () => call('/api/v1/connectathon/tracks');

  const grantConsent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/hie/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateHealthId: hid,
          facilityId,
          purpose: 'TREATMENT',
          grantedBy: session?.name || 'Clinician',
          hoursValid: 24,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Consent failed');
      setResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: 'linear-gradient(135deg, #E0F2FE 0%, #ECFDF5 100%)',
        borderRadius: 16, padding: 20, border: '1px solid #BAE6FD',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Network size={22} color="#0052D4" />
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
            Statewide HIE · MPI · Shared Health Record
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
          Phase 3–4: cross-facility State Health ID lookup, consent-gated SHR, FHIR R4 document export,
          and DHIN-aligned Connectathon tracks. Card/folder travels with the patient across MedCore facilities.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['mpi', 'MPI Search', Search],
          ['shr', 'Shared Record', FileJson],
          ['connectathon', 'Connectathon', Syringe],
          ['status', 'HIE Node', Radio],
        ] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            className="os-ghost-btn"
            onClick={() => setTab(k)}
            style={{
              background: tab === k ? 'rgba(0,82,212,0.12)' : undefined,
              borderColor: tab === k ? '#0052D4' : undefined,
              color: tab === k ? '#0052D4' : undefined,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'mpi' && (
        <div className="os-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
            Search name, MRN, or State Health ID
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. AKS-HID-2026-…"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0' }}
              />
              <button type="button" className="os-primary-btn" onClick={searchMpi} disabled={loading}>
                <Search size={14} /> Search MPI
              </button>
            </div>
          </label>
        </div>
      )}

      {tab === 'shr' && (
        <div className="os-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>
            State Health ID
            <input
              value={hid}
              onChange={(e) => setHid(e.target.value)}
              placeholder="AKS-HID-2026-xxxx"
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="os-ghost-btn" onClick={grantConsent} disabled={loading || !hid}>
              <ShieldCheck size={14} /> Grant 24h consent
            </button>
            <button type="button" className="os-primary-btn" onClick={loadShr} disabled={loading || !hid}>
              <Activity size={14} /> Load SHR
            </button>
            <button type="button" className="os-ghost-btn" onClick={loadFhir} disabled={loading || !hid}>
              <FileJson size={14} /> FHIR Bundle
            </button>
          </div>
        </div>
      )}

      {tab === 'connectathon' && (
        <div className="os-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
            Immunization · MNCH referral · ePharmacy · Claims · Devices — aligned with DHIN connectathon tracks.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="os-primary-btn" onClick={loadTracks}>
              <Syringe size={14} /> List tracks
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => call('/api/v1/connectathon/immunization')}
            >
              Immunizations
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => call('/api/v1/connectathon/mnch-referral')}
            >
              <Baby size={14} /> MNCH referrals
            </button>
          </div>
        </div>
      )}

      {tab === 'status' && (
        <div className="os-card">
          <button type="button" className="os-primary-btn" onClick={loadStatus}>
            <Radio size={14} /> Refresh HIE node status
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: 12, borderRadius: 10, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {result && (
        <pre
          className="os-card"
          style={{
            margin: 0,
            maxHeight: 420,
            overflow: 'auto',
            fontSize: '0.75rem',
            fontFamily: 'ui-monospace, monospace',
            background: '#0F172A',
            color: '#E2E8F0',
            padding: 16,
            borderRadius: 12,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
};
