'use client';

import React, { useState } from 'react';
import {
  Baby, Activity, AlertTriangle, CheckCircle2, ShieldAlert,
  Zap, Heart, Thermometer, User
} from 'lucide-react';
import type { PaediatricPatient, NicuIncubator } from '@medcore/types';

const INITIAL_PAEDS: PaediatricPatient[] = [];

const INITIAL_NICU: NicuIncubator[] = [];

export const PaediatricsNicuSuite: React.FC = () => {
  const [activeView, setActiveView] = useState<'paeds' | 'nicu'>('nicu');
  const [calcWeight, setCalcWeight] = useState<number>(10);
  const [calcDrug, setCalcDrug] = useState<'paracetamol' | 'amoxicillin' | 'artesunate'>('artesunate');

  // Pediatric weight-based dosage math
  const getDoseCalculation = () => {
    switch (calcDrug) {
      case 'paracetamol': return `${calcWeight * 15} mg (15 mg/kg QDS PRN, Max 60 mg/kg/day)`;
      case 'amoxicillin': return `${calcWeight * 25} mg (25�30 mg/kg TDS)`;
      case 'artesunate': return `${(calcWeight * 3.0).toFixed(1)} mg IV at 0, 12, 24 hrs (3 mg/kg for &lt;20kg)`;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>NICU Incubators Active</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>12 / 14</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>2 Available</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Servo-Controlled Temperature 100%</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EAB308' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Phototherapy Units</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FBBF24' }}>5 Active</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Neonatal Jaundice</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Blue LED High-Irradiance</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Paediatric Ward Census</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>32 / 40</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Beds</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Under-5 IMCI Guidelines Applied</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Extremely Low Birth Weight</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>1 ELBW</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>&lt; 1000g</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Kangaroo Mother Care Ready</span>
        </div>
      </div>

      {/* Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="os-ghost-btn"
            onClick={() => setActiveView('nicu')}
            style={{
              background: activeView === 'nicu' ? 'rgba(59,130,246,0.15)' : undefined,
              borderColor: activeView === 'nicu' ? '#3B82F6' : undefined,
              color: activeView === 'nicu' ? '#FFF' : undefined,
              fontWeight: 700,
            }}
          >
            <Baby size={14} /> Neonatal Intensive Care Unit (NICU)
          </button>
          <button
            type="button"
            className="os-ghost-btn"
            onClick={() => setActiveView('paeds')}
            style={{
              background: activeView === 'paeds' ? 'rgba(234,88,12,0.15)' : undefined,
              borderColor: activeView === 'paeds' ? 'var(--ak-orange)' : undefined,
              color: activeView === 'paeds' ? '#FFF' : undefined,
              fontWeight: 700,
            }}
          >
            <Activity size={14} /> General Paediatrics Ward (Under-5)
          </button>
        </div>
      </div>

      {/* Content */}
      {activeView === 'nicu' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {INITIAL_NICU.map(unit => (
            <div key={unit.id} className="os-card" style={{ padding: 18, borderTop: unit.gestationalWeeks < 30 ? '4px solid #EF4444' : '4px solid #3B82F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700 }}>{unit.unitNumber}</span>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                  background: unit.phototherapyActive ? 'rgba(234,179,8,0.2)' : 'rgba(59,130,246,0.2)',
                  color: unit.phototherapyActive ? '#FBBF24' : '#60A5FA',
                }}>
                  {unit.phototherapyActive ? 'PHOTOTHERAPY ON' : 'INCUBATOR ACTIVE'}
                </span>
              </div>

              <h4 style={{ margin: '4px 0', fontSize: '1.1rem', color: '#0A2540' }}>{unit.babyName}</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--os-text-muted)' }}>
                Gestational Age: <strong style={{ color: '#0A2540' }}>{unit.gestationalWeeks} Weeks</strong> � Weight: <strong style={{ color: 'var(--ak-orange-light)' }}>{unit.birthWeightGrams}g</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '12px 0', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, fontSize: '0.76rem' }}>
                <div>Temp: <strong style={{ color: '#0A2540' }}>{unit.tempCelsius}�C</strong></div>
                <div>O2 Delivery: <strong style={{ color: '#0A2540' }}>{unit.oxygenLpm} LPM</strong></div>
                <div>APGAR (10m): <strong style={{ color: '#0A2540' }}>{unit.apgar10Min}/10</strong></div>
                <div>Skin Probe: <strong style={{ color: '#34D399' }}>Attached</strong></div>
              </div>

              <button
                type="button"
                className="os-ghost-btn"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
                onClick={() => alert(`Neonatal vitals updated for ${unit.babyName}`)}
              >
                Log Neonatal Vitals & Blood Glucose
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          {/* Paeds Ward Table */}
          <div className="os-table-wrap">
            <table className="os-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Age (Mo)</th>
                  <th>Weight / Height</th>
                  <th>Diagnosis</th>
                  <th>Immunization</th>
                  <th>Bed</th>
                </tr>
              </thead>
              <tbody>
                {INITIAL_PAEDS.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: '#0A2540' }}>{p.patientName}</td>
                    <td>{p.ageMonths}m</td>
                    <td>{p.weightKg} kg / {p.heightCm} cm</td>
                    <td style={{ color: 'var(--ak-orange-light)' }}>{p.diagnosis}</td>
                    <td>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: p.immunizationStatus === 'up_to_date' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.15)',
                        color: p.immunizationStatus === 'up_to_date' ? '#34D399' : '#F87171',
                      }}>
                        {p.immunizationStatus.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.wardBed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Pediatric Drug Dose Calculator */}
          <div className="os-card" style={{ padding: 20 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--os-text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>
              Pediatric Weight-Based Dosage Engine
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--os-text-muted)', display: 'block', marginBottom: 4 }}>
                  Child Weight: <strong style={{ color: '#0A2540' }}>{calcWeight} kg</strong>
                </label>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={calcWeight}
                  onChange={e => setCalcWeight(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--ak-orange)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--os-text-muted)', display: 'block', marginBottom: 4 }}>
                  Select Essential Medicine:
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['artesunate', 'amoxicillin', 'paracetamol'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      className="os-ghost-btn"
                      onClick={() => setCalcDrug(d)}
                      style={{
                        fontSize: '0.7rem',
                        padding: '6px 10px',
                        background: calcDrug === d ? 'rgba(234,88,12,0.2)' : undefined,
                        borderColor: calcDrug === d ? 'var(--ak-orange)' : undefined,
                        color: calcDrug === d ? '#FFF' : undefined,
                      }}
                    >
                      {d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: 14, background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 8, marginTop: 6 }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>RECOMMENDED DOSE</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>
                  {getDoseCalculation()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
