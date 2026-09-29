'use client';
import React, { useState } from 'react';
import { Building2, CheckCircle2, Clock, AlertCircle, Plus, Edit2, MapPin, Phone, Globe } from 'lucide-react';

interface Facility {
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

const FACILITIES_KEY = 'medcore_os_facilities';

function loadFacilities(): Facility[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FACILITIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Facility[];
  } catch {
    return [];
  }
}

function saveFacilities(list: Facility[]) {
  try {
    localStorage.setItem(FACILITIES_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

const STATUS_META = {
  active: { label: 'Active', color: '#22C55E' },
  pending: { label: 'Pending Renewal', color: '#F59E0B' },
  suspended: { label: 'Suspended', color: '#EF4444' },
};

export const FacilityOnboarding: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>(() => loadFacilities());
  const [selected, setSelected] = useState<Facility | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />Active Facilities</span>
          <span className="metric-val">{facilities.filter(f => f.status === 'active').length}</span>
          <span className="metric-sub">Fully licensed and operational</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Pending Renewal</span>
          <span className="metric-val">{facilities.filter(f => f.status === 'pending').length}</span>
          <span className="metric-sub">Licenses expiring soon</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Building2 size={13} style={{ display: 'inline', marginRight: 4 }} />Total Registered Beds</span>
          <span className="metric-val">{facilities.reduce((a, f) => a + f.beds, 0).toLocaleString()}</span>
          <span className="metric-sub">Across {facilities.length} registered facilities</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">LGAs Covered</span>
          <span className="metric-val">{new Set(facilities.map(f => f.lga)).size}</span>
          <span className="metric-sub">of 31 Local Government Areas</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>

        {/* Facility List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="os-section-title">Registered Facilities</span>
            <button className="os-action-btn-primary" style={{ fontSize: '0.76rem', padding: '6px 12px' }}><Plus size={13} /> Add Facility</button>
          </div>
          {facilities.length === 0 && (
            <div className="os-card" style={{ padding: 20, color: '#64748B', fontSize: '0.88rem', textAlign: 'center' }}>
              No facilities registered yet. Use Add Facility to begin.
            </div>
          )}
          {facilities.map(f => {
            const meta = STATUS_META[f.status];
            const isSelected = selected?.id === f.id;
            return (
              <div key={f.id} className="os-card" onClick={() => setSelected(f)}
                style={{ cursor: 'pointer', padding: '14px 16px', borderColor: isSelected ? '#EA580C' : undefined, background: isSelected ? 'rgba(234,88,12,0.07)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem' }}>{f.name}</span>
                  <span style={{ background: `${meta.color}20`, color: meta.color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>{f.type} • {f.lga} LGA</div>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: 4 }}>{f.beds} beds • {f.tier}</div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="os-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ background: `${STATUS_META[selected.status].color}20`, color: STATUS_META[selected.status].color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 9999 }}>
                    {STATUS_META[selected.status].label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{selected.id}</span>
                </div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', fontWeight: 800 }}>{selected.name}</h3>
                <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.85rem' }}>{selected.type} • {selected.tier}</p>
              </div>
              <button className="os-ghost-btn"><Edit2 size={14} /> Edit</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'LGA', value: selected.lga },
                { label: 'Total Beds', value: selected.beds.toString() },
                { label: 'Medical Director', value: selected.medicalDirector },
                { label: 'License Number', value: selected.licenseNo },
                { label: 'License Expiry', value: selected.licenseExpiry },
                { label: 'Phone', value: selected.phone },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: '0.88rem', color: '#0A2540', fontWeight: item.label === 'Medical Director' ? 600 : 400 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 3 }}>ADDRESS</div>
                <div style={{ fontSize: '0.85rem', color: '#CBD5E1', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <MapPin size={14} style={{ color: '#EA580C', marginTop: 2, flexShrink: 0 }} />
                  {selected.address}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 3 }}>EMAIL</div>
                <div style={{ fontSize: '0.85rem', color: '#60A5FA', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={13} />{selected.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="os-action-btn-primary" style={{ flex: 1 }}>View Full Profile</button>
              <button className="os-ghost-btn" style={{ flex: 1 }}>Renew License</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
