'use client';

import React, { useState } from 'react';
import { HospitalPatient, WardInfo, INITIAL_PATIENTS, INITIAL_WARDS } from '../../data/hospitalData';
import {
  BedDouble, Users, Activity, CheckCircle2, AlertTriangle,
  HeartPulse, FileText, Check, ChevronRight, Play, ShieldAlert
} from 'lucide-react';

interface WardRoundsManagerProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const WardRoundsManager: React.FC<WardRoundsManagerProps> = ({ onNavigate }) => {
  const [wards] = useState<WardInfo[]>(INITIAL_WARDS);
  const [selectedWardCode, setSelectedWardCode] = useState<string>('MMW');
  const [patients] = useState<HospitalPatient[]>(INITIAL_PATIENTS);
  const [roundInProgress, setRoundInProgress] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, Record<string, boolean>>>({});

  const selectedWard = wards.find(w => w.code === selectedWardCode) || wards[0];
  const wardPatients = patients.filter(p => p.ward === selectedWardCode || (selectedWardCode === 'MMW' && p.type === 'inpatient' && p.sex === 'M'));

  const toggleCheck = (patientId: string, item: string) => {
    setChecklist(prev => ({
      ...prev,
      [patientId]: {
        ...(prev[patientId] || {}),
        [item]: !(prev[patientId] && prev[patientId][item]),
      },
    }));
  };

  const getWardStatusColor = (status: WardInfo['status']) => {
    switch (status) {
      case 'critical':
      case 'surge':
        return { bg: 'rgba(239,68,68,0.2)', text: '#EF4444', border: 'rgba(239,68,68,0.4)' };
      case 'high':
        return { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', border: 'rgba(245,158,11,0.4)' };
      default:
        return { bg: 'rgba(16,185,129,0.2)', text: '#10B981', border: 'rgba(16,185,129,0.4)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '18px 22px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BedDouble size={24} color="#1A6EB5" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Inpatient Ward Rounds Console</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Bed census management, clinical rounds checklist, vitals verification & multidisciplinary handover
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setRoundInProgress(!roundInProgress)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: roundInProgress ? '#10B981' : '#1A6EB5', color: '#0A2540',
              border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {roundInProgress ? <Check size={16} /> : <Play size={16} />}
            {roundInProgress ? 'Finish Ward Round' : 'Start Ward Round Checklist'}
          </button>
        </div>
      </div>

      {/* Ward Selector Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10
      }}>
        {wards.map(ward => {
          const isSelected = ward.code === selectedWardCode;
          const statusStyle = getWardStatusColor(ward.status);
          const occupancyPct = Math.round((ward.occupancy / ward.capacity) * 100);

          return (
            <div
              key={ward.code}
              onClick={() => setSelectedWardCode(ward.code)}
              style={{
                background: isSelected ? 'rgba(26,110,181,0.25)' : '#132F4C',
                border: isSelected ? '2px solid #1A6EB5' : '1px solid #1E446B',
                borderRadius: 10, padding: 12, cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isSelected ? '#38BDF8' : '#FFFFFF' }}>
                  {ward.code}
                </span>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                  background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`
                }}>
                  {ward.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A8BE' }}>{ward.occupancy}/{ward.capacity} Beds</div>
              <div style={{ height: 4, background: '#0A1929', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${occupancyPct}%`, height: '100%', background: isSelected ? '#38BDF8' : '#00B4A6' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Ward Details & Bed Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Left: Patient Bed Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              {selectedWard.name} ({selectedWard.code}) — {wardPatients.length} Active Patients
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#94A8BE' }}>
              Staff on Duty: {selectedWard.doctors} Doctors • {selectedWard.nurses} Nurses
            </div>
          </div>

          {wardPatients.length === 0 ? (
            <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94A8BE' }}>
              <BedDouble size={36} color="#1A6EB5" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0A2540' }}>No Inpatients in {selectedWard.name}</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Beds are currently unallocated or ready for intake.</div>
            </div>
          ) : (
            wardPatients.map(p => {
              const checks = checklist[p.id] || {};
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#132F4C', border: p.status === 'critical' ? '1px solid rgba(239,68,68,0.5)' : '1px solid #1E446B',
                    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        padding: '6px 10px', borderRadius: 8, background: '#0A1929', border: '1px solid #1E446B',
                        fontSize: '0.82rem', fontWeight: 800, color: '#0052D4'
                      }}>
                        Bed {p.bed}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>{p.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#94A8BE', fontFamily: 'monospace' }}>{p.mrn}</span>
                          {p.status === 'critical' && (
                            <span style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700 }}>
                              ● CRITICAL
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: 2 }}>
                          {p.diagnoses.join(' • ')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('consultations', { patientId: p.id })}
                        style={{
                          background: 'rgba(26,110,181,0.2)', border: '1px solid rgba(26,110,181,0.4)',
                          color: '#0052D4', padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        SOAP Consult
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('emr', { patientId: p.id })}
                        style={{
                          background: 'rgba(0,180,166,0.2)', border: '1px solid rgba(0,180,166,0.4)',
                          color: '#00B4A6', padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        Full EMR
                      </button>
                    </div>
                  </div>

                  {/* Vitals Ribbon */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
                    background: '#0A1929', padding: '10px 12px', borderRadius: 8, border: '1px solid #1E446B'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: '#94A8BE' }}>BP</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 2 }}>{p.vitals.bp}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: '#94A8BE' }}>PULSE</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 2 }}>{p.vitals.pulse} bpm</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: '#94A8BE' }}>TEMP</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 2 }}>{p.vitals.temp}°C</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: '#94A8BE' }}>SPO2</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 2, color: p.vitals.spo2 < 94 ? '#EF4444' : '#10B981' }}>
                        {p.vitals.spo2}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: '#94A8BE' }}>RESP RATE</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 2 }}>{p.vitals.rr}/min</div>
                    </div>
                  </div>

                  {/* Round Checklist items (when active) */}
                  {roundInProgress && (
                    <div style={{
                      paddingTop: 8, borderTop: '1px solid #FFFFFF',
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8
                    }}>
                      {[
                        { key: 'vitals', label: 'Vitals Stable' },
                        { key: 'iv', label: 'IV Line Checked' },
                        { key: 'meds', label: 'eMAR Meds Given' },
                        { key: 'plan', label: 'Round Note Logged' },
                      ].map(item => {
                        const done = !!checks[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleCheck(p.id, item.key)}
                            style={{
                              padding: '6px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                              background: done ? 'rgba(16,185,129,0.2)' : '#FFFFFF',
                              color: done ? '#10B981' : '#94A8BE',
                              border: done ? '1px solid #10B981' : '1px solid #1E446B',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                            }}
                          >
                            {done && <Check size={12} />} {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Ward Summary Stats & Handover Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Ward Summary Card */}
          <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 18 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0052D4' }}>
              Ward Capacity & Census
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#94A8BE' }}>Total Bed Capacity:</span>
                <span style={{ fontWeight: 700 }}>{selectedWard.capacity} Beds</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#94A8BE' }}>Occupied Beds:</span>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>{selectedWard.occupancy}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#94A8BE' }}>Available Beds:</span>
                <span style={{ fontWeight: 700, color: '#10B981' }}>{selectedWard.capacity - selectedWard.occupancy}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#94A8BE' }}>Ward Occupancy Rate:</span>
                <span style={{ fontWeight: 700 }}>{Math.round((selectedWard.occupancy / selectedWard.capacity) * 100)}%</span>
              </div>
            </div>

            <div style={{ height: 6, background: '#0A1929', borderRadius: 3, marginTop: 14, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((selectedWard.occupancy / selectedWard.capacity) * 100)}%`, height: '100%', background: '#1A6EB5' }} />
            </div>
          </div>

          {/* Nursing Handover Alert Card */}
          <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#F59E0B', fontWeight: 800, fontSize: '0.85rem' }}>
              <AlertTriangle size={16} /> Shift Handover Instructions
            </div>
            <div style={{ fontSize: '0.78rem', color: '#CBD5E1', lineHeight: 1.5 }}>
              • All patients with MAP &lt; 65 mmHg to remain on continuous arterial line monitoring.
              <br /><br />
              • Repeat fasting blood glucose orders for Beds 12 and 14 due at 06:00.
              <br /><br />
              • Surgical dressing change for Bed 2 post-prostatectomy to be executed by wound care team.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
