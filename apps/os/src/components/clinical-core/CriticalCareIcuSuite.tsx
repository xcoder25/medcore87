'use client';

import React, { useState } from 'react';
import {
  Activity, AlertTriangle, ShieldAlert, Heart, Wind,
  CheckCircle2, BedDouble, User, Zap, Clock
} from 'lucide-react';
import type { ICUStation } from '@medcore/types';

const INITIAL_STATIONS: ICUStation[] = [
  {
    id: 'ICU-BED-01',
    stationNumber: 'ICU Bay 1 (Isolation / Negative Pressure)',
    patientName: 'Bassey Okon Udoh',
    diagnosis: 'Severe Septic Shock & ARDS secondary to Perforated Viscus',
    ventilatorMode: 'PRVC (Pressure Regulated Volume Control)',
    peep: 12,
    fio2: 65,
    arterialPressure: '82/48 (MAP 59)',
    gcsScore: 8,
    sofaScore: 11,
    nurseOnDuty: 'Nurse Aisha Bello (Charge Nurse)',
    alertStatus: 'critical',
  },
  {
    id: 'ICU-BED-02',
    stationNumber: 'ICU Bay 2',
    patientName: 'Edidiong Sunday Udosen',
    diagnosis: 'Severe Traumatic Brain Injury (TBI) / Post-craniotomy',
    ventilatorMode: 'SIMV + PS',
    peep: 8,
    fio2: 40,
    arterialPressure: '128/76 (MAP 93)',
    gcsScore: 7,
    sofaScore: 8,
    nurseOnDuty: 'Nurse E. Akpan',
    alertStatus: 'warning',
  },
  {
    id: 'ICU-BED-03',
    stationNumber: 'ICU Bay 3',
    patientName: 'Kufre Daniel Etim',
    diagnosis: 'Post-op Massive Polytrauma / Ongoing blood product resuscitation',
    ventilatorMode: 'CPAP / Pressure Support (Weaning)',
    peep: 5,
    fio2: 35,
    arterialPressure: '115/72 (MAP 86)',
    gcsScore: 14,
    sofaScore: 4,
    nurseOnDuty: 'Nurse C. Okon',
    alertStatus: 'stable',
  },
  {
    id: 'ICU-BED-04',
    stationNumber: 'ICU Bay 4',
    patientName: 'Comfort Aniefiok Ekanem',
    diagnosis: 'Acute Kidney Injury on CKD / Hyperkalemic arrest post-ROSC',
    ventilatorMode: 'AC / Volume Control',
    peep: 10,
    fio2: 50,
    arterialPressure: '98/62 (MAP 74)',
    gcsScore: 10,
    sofaScore: 9,
    nurseOnDuty: 'Nurse Aisha Bello',
    alertStatus: 'warning',
  },
];

export const CriticalCareIcuSuite: React.FC = () => {
  const [stations, setStations] = useState<ICUStation[]>(INITIAL_STATIONS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_STATIONS[0].id);

  const selectedStation = stations.find(s => s.id === selectedId) || stations[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top ICU Status Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>ICU Bed Occupancy</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>44 / 48</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>91.6% Full</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>4 Ventilator Beds Available</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Mechanical Ventilators Active</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>38 In Use</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Hamilton-C6 Telemetry</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Central Medical Gas Pressure: 4.2 Bar</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>CRRT / Hemodialysis Machines</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>6 Active</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Continuous Renal Replacement</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Bay 1 & 4 on Dialysis Filters</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Nurse-to-Patient Ratio</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>1 : 1</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Gold Standard</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Full Critical Care Nursing Shift Compliant</span>
        </div>
      </div>

      {/* Main Grid: Station Selector & Real-Time Invasive Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Left: ICU Bay Stations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stations.map(station => {
            const isSelected = station.id === selectedId;
            const isCrit = station.alertStatus === 'critical';
            return (
              <div
                key={station.id}
                className="os-card"
                onClick={() => setSelectedId(station.id)}
                style={{
                  cursor: 'pointer',
                  borderColor: isCrit ? '#EF4444' : isSelected ? 'var(--ak-orange)' : undefined,
                  background: isCrit ? 'rgba(239,68,68,0.08)' : isSelected ? 'rgba(234,88,12,0.08)' : undefined,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                    background: isCrit ? '#EF4444' : station.alertStatus === 'warning' ? '#F59E0B' : '#10B981',
                    color: '#0A2540',
                  }}>
                    {station.alertStatus.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>SOFA: {station.sofaScore} � GCS: {station.gcsScore}/15</span>
                </div>

                <div style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.98rem' }}>{station.patientName}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--ak-orange-light)', marginTop: 2 }}>{station.stationNumber}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--os-text-muted)', marginTop: 4, lineHeight: 1.3 }}>{station.diagnosis}</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--os-text-dim)', marginTop: 8 }}>
                  <span>FiO2: {station.fio2}% � PEEP: {station.peep}</span>
                  <span>MAP: {station.arterialPressure.split('(')[1]?.replace(')', '') || station.arterialPressure}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Telemetry & Inotropic / Ventilator Monitoring */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="os-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--os-text-dim)', textTransform: 'uppercase' }}>
                  {selectedStation.stationNumber}
                </div>
                <h2 style={{ margin: '4px 0 2px 0', fontSize: '1.35rem', color: '#0A2540' }}>{selectedStation.patientName}</h2>
                <div style={{ fontSize: '0.84rem', color: 'var(--os-text-muted)' }}>{selectedStation.diagnosis}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>Assigned Nurse</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0A2540' }}>{selectedStation.nurseOnDuty}</div>
              </div>
            </div>

            {/* Live Ventilator & Invasive Hemodynamics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '16px 0' }}>
              <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#93C5FD', fontWeight: 700 }}>VENTILATOR MODE</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0A2540', marginTop: 4 }}>{selectedStation.ventilatorMode.split('(')[0]}</div>
                <span style={{ fontSize: '0.7rem', color: '#60A5FA' }}>Hamilton C6 Synced</span>
              </div>

              <div style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>FiO2 & PEEP</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0A2540', marginTop: 2 }}>
                  {selectedStation.fio2}% <span style={{ fontSize: '0.8rem', color: 'var(--os-text-dim)' }}>/ {selectedStation.peep} cmH2O</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--ak-orange-light)' }}>Target PaO2 &gt; 65</span>
              </div>

              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#FCA5A5', fontWeight: 700 }}>ARTERIAL PRESSURE</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0A2540', marginTop: 2 }}>{selectedStation.arterialPressure}</div>
                <span style={{ fontSize: '0.7rem', color: '#EF4444' }}>Radial A-Line Continuous</span>
              </div>

              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#6EE7B7', fontWeight: 700 }}>SOFA / GCS</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0A2540', marginTop: 2 }}>
                  {selectedStation.sofaScore} <span style={{ fontSize: '0.8rem', color: 'var(--os-text-dim)' }}>/ GCS {selectedStation.gcsScore}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#10B981' }}>Organ Dysfunction Score</span>
              </div>
            </div>

            {/* Infusion Pumps & Inotropes */}
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Vasoactive Infusion Telemetry (Smart Infusion Pumps)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div style={{ padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#0A2540' }}>Noradrenaline (Norepinephrine)</strong>
                    <span style={{ color: '#34D399', fontWeight: 700 }}>RUNNING</span>
                  </div>
                  <div style={{ color: 'var(--os-text-dim)', marginTop: 4 }}>Dose: 0.18 mcg/kg/min � Rate: 7.2 mL/hr</div>
                </div>
                <div style={{ padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#0A2540' }}>Propofol 1% Sedation</strong>
                    <span style={{ color: '#34D399', fontWeight: 700 }}>RUNNING</span>
                  </div>
                  <div style={{ color: 'var(--os-text-dim)', marginTop: 4 }}>Dose: 2.5 mg/kg/hr � Target RASS: -4</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="os-action-btn-primary"
                onClick={() => alert(`ABG (Arterial Blood Gas) ordered for ${selectedStation.patientName}. Point-of-care analyzer flagged.`)}
              >
                <Activity size={14} /> Run STAT Bedside ABG
              </button>
              <button
                type="button"
                className="os-ghost-btn"
                onClick={() => alert(`Intensivist consult broadcast dispatched to duty senior registrar.`)}
              >
                <ShieldAlert size={14} /> Alert Consultant Intensivist
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
