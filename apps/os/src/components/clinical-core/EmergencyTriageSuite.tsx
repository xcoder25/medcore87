'use client';

import { liveAlert } from '../../lib/manualActions';

import React, { useState } from 'react';
import {
  AlertTriangle, Activity, UserPlus, Clock, Heart, ShieldAlert,
  Flame, CheckCircle2, ChevronRight, BedDouble, Search, PhoneCall
} from 'lucide-react';
import type { EmergencyTriagePatient } from '@medcore/types';

const INITIAL_PATIENTS: EmergencyTriagePatient[] = [];

const ESI_BADGE: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'ESI 1: IMMEDIATE / RESUS', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  2: { label: 'ESI 2: EMERGENT / CRITICAL', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  3: { label: 'ESI 3: URGENT / MULTI-RESOURCE', color: '#EAB308', bg: 'rgba(234,179,8,0.15)' },
  4: { label: 'ESI 4: LESS URGENT', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  5: { label: 'ESI 5: NON-URGENT', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

export const EmergencyTriageSuite: React.FC = () => {
  const [patients, setPatients] = useState<EmergencyTriagePatient[]>(INITIAL_PATIENTS);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [esiFilter, setEsiFilter] = useState<number | 'ALL'>('ALL');

  const selectedPatient = patients.find(p => p.id === selectedId) || patients[0];

  const filteredPatients = patients.filter(p => {
    const name = (p.patientName || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = !q || name.includes(q) || id.includes(q);
    const matchesEsi = esiFilter === 'ALL' || p.esiLevel === esiFilter;
    return matchesSearch && matchesEsi;
  });

  const registerArrival = () => {
    const n = patients.length + 1;
    const esi = (n % 5 === 0 ? 1 : n % 3 === 0 ? 2 : 3) as 1 | 2 | 3 | 4 | 5;
    const p: EmergencyTriagePatient = {
      id: `AE-${String(n).padStart(4, '0')}`,
      patientName: `Walk-in Patient ${n}`,
      age: 20 + (n % 50),
      gender: n % 2 === 0 ? 'F' : 'M',
      esiLevel: esi,
      chiefComplaint: esi <= 2 ? 'Chest pain / distress' : 'Fever and body ache',
      vitals: {
        bp: esi <= 2 ? '90/60' : '120/80',
        pulse: esi <= 2 ? 118 : 88,
        spo2: esi <= 2 ? 91 : 98,
        temp: 37.2 + (n % 3) * 0.4,
        rr: esi <= 2 ? 28 : 18,
      },
      arrivalTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      bayAssigned: esi === 1 ? 'Resus 1' : esi === 2 ? 'Trauma Bay' : `Triage ${n}`,
      status: esi === 1 ? 'resuscitation' : 'triage',
    };
    setPatients(prev => [p, ...prev]);
    setSelectedId(p.id);
    liveAlert(`A&E arrival registered: ${p.patientName} · ESI ${p.esiLevel}`);
  };

  const resusCount = patients.filter(p => p.esiLevel === 1).length;
  const emergentCount = patients.filter(p => p.esiLevel === 2).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Resuscitation Bays</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{resusCount} / 4</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Active Critical</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>Crash Team 1 & 2 Deployed</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #F97316' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Emergent (ESI 2)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F97316' }}>{emergentCount}</span>
            <span style={{ fontSize: '0.75rem', color: '#FB923C' }}>Time to MD &lt; 10m</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>Trauma Bay 1 & 2 Occupied</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EAB308' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Average Triage Time</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FBBF24' }}>4.2 min</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Target Met</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>MTS / ESI Algorithm Active</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Ambulance Influx</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>2 Inbound</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>ETA 6m & 11m</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>Bay 3 Primed for Polytrauma</span>
        </div>
      </div>

      {/* Main Grid: Patient Queue & Real-Time Bay Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 20 }}>
        {/* Left: Triage Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="os-search-wrap" style={{ flex: 1 }}>
              <Search size={14} />
              <input
                className="os-search-input"
                placeholder="Search emergency triage queue..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="os-action-btn-primary"
              onClick={registerArrival}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <UserPlus size={14} /> Register Arrival
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 1, 2, 3, 4] as const).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => setEsiFilter(lvl)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '6px 10px',
                    borderColor: esiFilter === lvl ? 'var(--ak-orange)' : undefined,
                    color: esiFilter === lvl ? '#FFF' : undefined,
                    background: esiFilter === lvl ? 'rgba(234,88,12,0.15)' : undefined,
                  }}
                >
                  {lvl === 'ALL' ? 'ALL ESI' : `ESI ${lvl}`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredPatients.map(p => {
              const esi = ESI_BADGE[p.esiLevel] || ESI_BADGE[3];
              const isSelected = p.id === selectedId;
              return (
                <div
                  key={p.id}
                  className="os-card"
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? esi.color : undefined,
                    background: isSelected ? esi.bg : undefined,
                    padding: '14px 18px',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: esi.color, color: '#FFF' }}>
                        ESI {p.esiLevel}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0A2540' }}>{p.patientName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>({p.age}y / {p.gender})</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {p.arrivalTime}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: 'var(--os-text-muted)', lineHeight: 1.4 }}>
                    {p.chiefComplaint}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', gap: 14, color: 'var(--os-text-dim)' }}>
                      <span>BP: <strong style={{ color: '#0A2540' }}>{p.vitals.bp}</strong></span>
                      <span>HR: <strong style={{ color: p.vitals.pulse > 100 ? '#F87171' : '#FFF' }}>{p.vitals.pulse} bpm</strong></span>
                      <span>SpO2: <strong style={{ color: p.vitals.spo2 < 92 ? '#EF4444' : '#FFF' }}>{p.vitals.spo2}%</strong></span>
                    </div>
                    <span style={{ color: 'var(--ak-orange-light)', fontWeight: 600 }}>{p.bayAssigned}</span>
                  </div>
                </div>
              );
            })}
            {filteredPatients.length === 0 && (
              <div className="os-card" style={{ padding: 24, textAlign: 'center', color: 'var(--os-text-dim)' }}>
                <ShieldAlert size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No patients in A&E triage queue</div>
                <div style={{ fontSize: '0.8rem' }}>New arrivals will appear here in realtime. Use &quot;Register Arrival&quot; when a patient presents.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Patient Bedside Assessment & Clinical Orders */}
        <div className="os-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--os-border)', paddingBottom: 12 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, background: ESI_BADGE[selectedPatient?.esiLevel ?? 3]?.color ?? '#EAB308', color: '#FFF', fontSize: '0.7rem', fontWeight: 800, marginBottom: 6 }}>
                {ESI_BADGE[selectedPatient?.esiLevel ?? 3]?.label ?? 'ESI —'}
              </div>
              <h3 style={{ margin: '2px 0', fontSize: '1.2rem', color: '#0A2540' }}>{selectedPatient?.patientName ?? 'No patient selected'}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>ID: {selectedPatient?.id ?? '—'} � Assigned to: {selectedPatient?.bayAssigned ?? 'Unassigned'}</span>
            </div>
            <button
              type="button"
              className="os-ghost-btn"
              style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', padding: '6px 10px', fontSize: '0.72rem' }}
              onClick={() => liveAlert(`CRITICAL CODE ACTIVATED for ${selectedPatient?.patientName ?? 'No patient selected'}`)}
            >
              <ShieldAlert size={14} /> Trigger Code Blue
            </button>
          </div>

          {/* Vitals Ribbon */}
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Triage Vitals</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Blood Pressure</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>{selectedPatient?.vitals?.bp}</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Heart Rate</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: (selectedPatient?.vitals?.pulse ?? 0) > 100 ? '#F87171' : '#0A2540' }}>
                  {selectedPatient?.vitals?.pulse} bpm
                </div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Oxygen Sat</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: (selectedPatient?.vitals?.spo2 ?? 100) < 92 ? '#EF4444' : '#34D399' }}>
                  {selectedPatient?.vitals?.spo2}%
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Orders & Interventions */}
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Immediate Interventions</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                <span>Establish 18G IV Access (2 Lines)</span>
                <span style={{ color: '#34D399', fontWeight: 700 }}>COMPLETED</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                <span>Stat ECG & Cardiac Troponin I</span>
                <span style={{ color: '#FBBF24', fontWeight: 700 }}>IN PROGRESS</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                <span>Bedside Ultrasound / FAST Scan</span>
                <span style={{ color: 'var(--os-text-dim)' }}>QUEUED</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="os-action-btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => liveAlert(`Transferring ${selectedPatient?.patientName ?? 'No patient selected'} to Intensive Care Unit (ICU)`)}
            >
              <BedDouble size={14} /> Admit to Ward / ICU
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => liveAlert(`Emergency consult paged to on-call surgeon`)}
            >
              <PhoneCall size={14} /> Page Specialist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
