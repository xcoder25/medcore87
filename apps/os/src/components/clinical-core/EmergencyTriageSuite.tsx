'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Activity, UserPlus, Clock, Heart, ShieldAlert,
  Flame, CheckCircle2, ChevronRight, BedDouble, Search, Radio,
  Sparkles, Zap, FileText, Check, ShieldCheck
} from 'lucide-react';
import type { EmergencyTriagePatient } from '@medcore/types';
import { liveAlert } from '../../lib/manualActions';
import {
  listStagingQueue,
  matchAndImportAlert,
  markAtBay,
  simulateInboundAlert,
  subscribeStagingQueue,
  type EpcrPreArrivalAlert
} from '../../lib/epcrBridgeStore';

const ESI_BADGE: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'ESI 1: IMMEDIATE / RESUS', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  2: { label: 'ESI 2: EMERGENT / CRITICAL', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  3: { label: 'ESI 3: URGENT / MULTI-RESOURCE', color: '#EAB308', bg: 'rgba(234,179,8,0.15)' },
  4: { label: 'ESI 4: LESS URGENT', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  5: { label: 'ESI 5: NON-URGENT', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

export interface EmergencyPatientExtended extends EmergencyTriagePatient {
  epcrImported?: boolean;
  epcrAlertId?: string;
  protocol?: string;
  emsUnit?: string;
  paramedicNarrative?: string;
  enRouteInterventions?: string[];
  ekgRhythm?: string;
  stemiAlert?: boolean;
}

export const EmergencyTriageSuite: React.FC = () => {
  const [patients, setPatients] = useState<EmergencyPatientExtended[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [esiFilter, setEsiFilter] = useState<number | 'ALL'>('ALL');

  // HL7 / FHIR Pre-Arrival Ingestion Bridge State
  const [stagingAlerts, setStagingAlerts] = useState<EpcrPreArrivalAlert[]>([]);
  const [ingestionToast, setIngestionToast] = useState<string | null>(null);

  useEffect(() => {
    setStagingAlerts(listStagingQueue());
    const unsub = subscribeStagingQueue((updated) => setStagingAlerts([...updated]));
    return unsub;
  }, []);

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
    const p: EmergencyPatientExtended = {
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
      bayAssigned: esi === 1 ? 'Resus Bay 1' : esi === 2 ? 'Trauma Bay' : `Triage Bay ${n}`,
      status: esi === 1 ? 'resuscitation' : 'triage',
    };
    setPatients(prev => [p, ...prev]);
    setSelectedId(p.id);
    liveAlert(`A&E arrival registered: ${p.patientName} · ESI ${p.esiLevel}`);
  };

  /**
   * 1-Click Triage Ingestion Gatekeeper
   * Instantly imports the pre-hospital bundle into official EMR triage fields without manual typing.
   */
  const handleIngestAlert = (alert: EpcrPreArrivalAlert) => {
    const importedAlert = matchAndImportAlert(alert.id, 'Triage Nurse Gatekeeper');
    if (!importedAlert) return;

    const newId = `AE-EMS-${String(patients.length + 1).padStart(4, '0')}`;
    const newPatient: EmergencyPatientExtended = {
      id: newId,
      patientName: alert.patient.fullName,
      age: alert.patient.age || 38,
      gender: alert.patient.gender === 'F' ? 'F' : 'M',
      esiLevel: alert.vitals.spo2 < 93 || alert.ekgTelemetry.stElevation ? 1 : 2,
      chiefComplaint: `${alert.incidentType}: ${alert.accidentNarrative.slice(0, 110)}…`,
      vitals: {
        bp: alert.vitals.bp,
        pulse: alert.vitals.pulse,
        spo2: alert.vitals.spo2,
        temp: alert.vitals.temp,
        rr: alert.vitals.rr,
      },
      arrivalTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      bayAssigned: alert.ekgTelemetry.stElevation ? 'Cath Lab / Resus 1' : 'Resus Bay 1 (Trauma)',
      status: 'resuscitation',
      epcrImported: true,
      epcrAlertId: alert.id,
      protocol: alert.protocol,
      emsUnit: alert.emsUnit,
      paramedicNarrative: alert.accidentNarrative,
      enRouteInterventions: alert.enRouteInterventions,
      ekgRhythm: alert.ekgTelemetry.rhythm,
      stemiAlert: alert.ekgTelemetry.stElevation,
    };

    setPatients(prev => [newPatient, ...prev]);
    setSelectedId(newId);
    liveAlert(`1-Click Ingestion: ${alert.patient.fullName} matched from ${alert.emsUnit} via ${alert.protocol}. 0 words typed.`);
    setIngestionToast(`⚡ Ambulance data successfully ingested for ${alert.patient.fullName}. Vitals, trauma narrative, and EKG links now active in EMR.`);
    setTimeout(() => setIngestionToast(null), 6000);
  };

  const handleSimulateInbound = (scenario: 'mvc_polytrauma' | 'acute_stemi' = 'mvc_polytrauma') => {
    const newAlert = simulateInboundAlert(scenario);
    setIngestionToast(`📡 New Pre-Alert pushed via ${newAlert.protocol}: ${newAlert.patient.fullName} (${newAlert.emsUnit}, ETA ${newAlert.etaMinutes}m)`);
    setTimeout(() => setIngestionToast(null), 5000);
  };

  const pendingAlerts = stagingAlerts.filter(a => a.status === 'inbound' || a.status === 'at_bay');
  const atBayAlert = stagingAlerts.find(a => a.status === 'at_bay') || stagingAlerts.find(a => a.status === 'inbound');

  const resusCount = patients.filter(p => p.esiLevel === 1).length;
  const emergentCount = patients.filter(p => p.esiLevel === 2).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Alert */}
      {ingestionToast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            background: '#0F172A',
            color: '#F8FAFC',
            border: '1.5px solid #10B981',
            borderRadius: 14,
            padding: '14px 20px',
            maxWidth: 540,
            boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            fontSize: '0.86rem',
            lineHeight: 1.45,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Sparkles size={20} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{ingestionToast}</span>
        </div>
      )}

      {/* Top Banner Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Resuscitation Bays</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{resusCount} Active</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Critical Priority</span>
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

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>HL7 / FHIR ePCR Staging</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3B82F6' }}>{pendingAlerts.length} Inbound</span>
            <span style={{ fontSize: '0.75rem', color: '#60A5FA' }}>Pre-Arrival Queue</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>Live Mobile ePCR Transmissions</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Average Triage Time</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>0.0 min (Auto)</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>1-Click Ingest</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-muted)' }}>0 Manual Keystrokes Required</span>
        </div>
      </div>

      {/* ── THE TRIAGE NURSE GATEKEEPER BANNER ── */}
      {atBayAlert && (
        <div
          style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '2px solid #F59E0B',
            borderRadius: 14,
            padding: '16px 20px',
            boxShadow: '0 8px 24px rgba(245,158,11,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 320 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#F59E0B',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Radio size={22} className="animate-pulse" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0F172A' }}>
                  Ambulance data available for {atBayAlert.patient.fullName} (DOB: {atBayAlert.patient.dob || `${atBayAlert.patient.age}y`}). Match and import?
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: atBayAlert.status === 'at_bay' ? '#EF4444' : '#2563EB',
                    color: '#FFFFFF',
                  }}
                >
                  {atBayAlert.status === 'at_bay' ? 'ARRIVED AT BAY' : `INBOUND · ETA ${atBayAlert.etaMinutes}M`}
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#EDE9FE',
                    color: '#6D28D9',
                  }}
                >
                  {atBayAlert.protocol} BUNDLE
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4, lineHeight: 1.45 }}>
                <strong>{atBayAlert.emsUnit}</strong> ({atBayAlert.paramedicName}): {atBayAlert.incidentType} —{' '}
                <em>{atBayAlert.accidentNarrative.slice(0, 140)}…</em>
              </div>

              <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem', color: '#0F172A', marginTop: 6, fontWeight: 700 }}>
                <span>BP: <strong style={{ color: '#0284C7' }}>{atBayAlert.vitals.bp}</strong></span>
                <span>HR: <strong style={{ color: atBayAlert.vitals.pulse > 100 ? '#EF4444' : '#047857' }}>{atBayAlert.vitals.pulse} bpm</strong></span>
                <span>SpO2: <strong style={{ color: atBayAlert.vitals.spo2 < 93 ? '#EF4444' : '#047857' }}>{atBayAlert.vitals.spo2}%</strong></span>
                <span>RR: <strong>{atBayAlert.vitals.rr}/min</strong></span>
                <span>Pain: <strong style={{ color: '#EF4444' }}>{atBayAlert.vitals.painScale}/10</strong></span>
                <span>EKG: <strong style={{ color: atBayAlert.ekgTelemetry.stElevation ? '#EF4444' : '#0284C7' }}>{atBayAlert.ekgTelemetry.rhythm}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {atBayAlert.status === 'inbound' && (
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => markAtBay(atBayAlert.id)}
                style={{ fontSize: '0.78rem', padding: '8px 12px' }}
              >
                Mark Arrived
              </button>
            )}
            <button
              type="button"
              onClick={() => handleIngestAlert(atBayAlert)}
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(16,185,129,0.38)',
              }}
            >
              <CheckCircle2 size={18} />
              <span>Accept &amp; Import</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Patient Queue & Real-Time Bay Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: 20 }}>
        {/* Left: Triage Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="os-search-wrap" style={{ flex: 1, minWidth: 200 }}>
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
              <UserPlus size={14} /> Walk-in Arrival
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => handleSimulateInbound('mvc_polytrauma')}
              style={{ fontSize: '0.74rem', padding: '6px 10px', color: '#EF4444', borderColor: '#FCA5A5' }}
            >
              + Simulate MVC ePCR Push
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: esi.color, color: '#FFF' }}>
                        ESI {p.esiLevel}
                      </span>
                      <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0A2540' }}>{p.patientName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>({p.age}y / {p.gender})</span>
                      {p.epcrImported && (
                        <span
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: '#D1FAE5',
                            color: '#047857',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Zap size={10} /> {p.protocol || 'FHIR'} INGESTED
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {p.arrivalTime}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
                    {p.chiefComplaint}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', gap: 14, color: 'var(--os-text-dim)' }}>
                      <span>BP: <strong style={{ color: '#0A2540' }}>{p.vitals.bp}</strong></span>
                      <span>HR: <strong style={{ color: p.vitals.pulse > 100 ? '#EF4444' : '#047857' }}>{p.vitals.pulse} bpm</strong></span>
                      <span>SpO2: <strong style={{ color: p.vitals.spo2 < 93 ? '#EF4444' : '#047857' }}>{p.vitals.spo2}%</strong></span>
                    </div>
                    <span style={{ color: 'var(--ak-orange-light)', fontWeight: 700 }}>{p.bayAssigned}</span>
                  </div>
                </div>
              );
            })}
            {filteredPatients.length === 0 && (
              <div className="os-card" style={{ padding: 24, textAlign: 'center', color: 'var(--os-text-dim)' }}>
                <ShieldAlert size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No active patients in A&E triage bay</div>
                <div style={{ fontSize: '0.8rem' }}>
                  Use &quot;Accept &amp; Import&quot; on the pre-arrival banner above when an ambulance arrives, or click &quot;Walk-in Arrival&quot;.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Patient Bedside Assessment & Clinical Orders */}
        <div className="os-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'fit-content', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--os-border)', paddingBottom: 12 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, background: ESI_BADGE[selectedPatient?.esiLevel ?? 3]?.color ?? '#EAB308', color: '#FFF', fontSize: '0.7rem', fontWeight: 800, marginBottom: 6 }}>
                {ESI_BADGE[selectedPatient?.esiLevel ?? 3]?.label ?? 'ESI —'}
              </div>
              <h3 style={{ margin: '2px 0', fontSize: '1.2rem', color: '#0A2540' }}>{selectedPatient?.patientName ?? 'No patient selected'}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>
                ID: {selectedPatient?.id ?? '—'} · Assigned: {selectedPatient?.bayAssigned ?? 'Unassigned'}
              </span>
            </div>
            <button
              type="button"
              className="os-ghost-btn"
              style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', padding: '6px 10px', fontSize: '0.72rem' }}
              onClick={() => liveAlert(`CRITICAL CODE ACTIVATED for ${selectedPatient?.patientName ?? 'No patient selected'}`)}
            >
              <ShieldAlert size={14} /> Code Blue
            </button>
          </div>

          {/* Vitals Ribbon */}
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Official Nursing Triage Vitals
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Blood Pressure</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>{selectedPatient?.vitals?.bp || '—'}</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Heart Rate</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: (selectedPatient?.vitals?.pulse ?? 0) > 100 ? '#EF4444' : '#0A2540' }}>
                  {selectedPatient?.vitals?.pulse ? `${selectedPatient.vitals.pulse} bpm` : '—'}
                </div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>SpO2 Oxygen</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: (selectedPatient?.vitals?.spo2 ?? 100) < 93 ? '#EF4444' : '#047857' }}>
                  {selectedPatient?.vitals?.spo2 ? `${selectedPatient.vitals.spo2}%` : '—'}
                </div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Resp Rate</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>{selectedPatient?.vitals?.rr ? `${selectedPatient.vitals.rr}/min` : '—'}</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Temperature</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0A2540' }}>{selectedPatient?.vitals?.temp ? `${selectedPatient.vitals.temp}°C` : '—'}</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--os-text-dim)' }}>Source</span>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: selectedPatient?.epcrImported ? '#059669' : '#0284C7' }}>
                  {selectedPatient?.epcrImported ? 'HL7/FHIR Ingested' : 'Triage Desk'}
                </div>
              </div>
            </div>
          </div>

          {/* ePCR Ingested Clinical Details */}
          {selectedPatient?.epcrImported && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#059669" />
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                  PRE-HOSPITAL EMS ASSESSMENT ({selectedPatient.emsUnit})
                </span>
              </div>

              {selectedPatient.paramedicNarrative && (
                <div style={{ fontSize: '0.78rem', color: '#334155', background: '#F8FAFC', padding: 10, borderRadius: 8, lineHeight: 1.45 }}>
                  <strong>Trauma Mechanism &amp; Narrative:</strong> {selectedPatient.paramedicNarrative}
                </div>
              )}

              {selectedPatient.ekgRhythm && (
                <div style={{ fontSize: '0.76rem', color: selectedPatient.stemiAlert ? '#991B1B' : '#1E40AF', background: selectedPatient.stemiAlert ? '#FEE2E2' : '#EFF6FF', padding: 8, borderRadius: 6, fontWeight: 700 }}>
                  EKG Telemetry: {selectedPatient.ekgRhythm}
                </div>
              )}

              {selectedPatient.enRouteInterventions && selectedPatient.enRouteInterventions.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Pre-Hospital Interventions En Route:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {selectedPatient.enRouteInterventions.map((item, idx) => (
                      <span key={idx} style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 4, background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Orders */}
          <div style={{ borderTop: '1px solid var(--os-border)', paddingTop: 12 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Rapid Orders</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ fontSize: '0.74rem', padding: '8px 10px' }}
                onClick={() => liveAlert(`STAT Lab Panel ordered for ${selectedPatient?.patientName}`)}
              >
                + STAT Trauma Panel
              </button>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ fontSize: '0.74rem', padding: '8px 10px' }}
                onClick={() => liveAlert(`Chest X-ray / FAST ultrasound ordered for ${selectedPatient?.patientName}`)}
              >
                + FAST Ultrasound / CXR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
