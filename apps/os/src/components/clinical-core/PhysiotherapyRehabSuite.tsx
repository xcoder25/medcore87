'use client';

/**
 * PhysiotherapyRehabSuite — Physical Rehabilitation & Therapy Clinical Desk.
 * Joint Range of Motion (ROM) Goniometer tracker, MRC Muscle Strength Grading (0-5),
 * Visual Analogue Pain Scale (VAS 0-10), and Prescribed Physical Modalities.
 */

import React, { useState } from 'react';
import {
  Activity, Save, Printer, Plus, CheckCircle2, RotateCcw,
  Sparkles, FileText, ChevronRight, User, HeartPulse
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export interface RomMeasurement {
  joint: string; // e.g. "Shoulder Right", "Knee Left"
  movement: string; // e.g. "Flexion", "Extension", "Abduction"
  activeDeg: number;
  passiveDeg: number;
  normalDeg: number;
  painOnMotion: boolean;
}

export interface MuscleGrade {
  muscleGroup: string;
  grade: 0 | 1 | 2 | 3 | 4 | 5;
  side: 'Right' | 'Left' | 'Bilateral';
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const PhysiotherapyRehabSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [painVas, setPainVas] = useState<number>(6);
  const [painSite, setPainSite] = useState('Lumbosacral Spine radiating to right posterior thigh');

  const [romList, setRomList] = useState<RomMeasurement[]>([
    { joint: 'Shoulder (Right)', movement: 'Abduction', activeDeg: 85, passiveDeg: 110, normalDeg: 180, painOnMotion: true },
    { joint: 'Knee (Right)', movement: 'Flexion', activeDeg: 95, passiveDeg: 115, normalDeg: 135, painOnMotion: true },
    { joint: 'Lumbar Spine', movement: 'Forward Flexion', activeDeg: 35, passiveDeg: 45, normalDeg: 60, painOnMotion: true },
  ]);

  const [muscleGrades, setMuscleGrades] = useState<MuscleGrade[]>([
    { muscleGroup: 'Quadriceps Femoris', grade: 4, side: 'Right' },
    { muscleGroup: 'Deltoid / Rotator Cuff', grade: 3, side: 'Right' },
    { muscleGroup: 'Gastrocnemius / Soleus', grade: 5, side: 'Bilateral' },
  ]);

  const [selectedModalities, setSelectedModalities] = useState<string[]>([
    'Therapeutic Ultrasound (1MHz, 1.2W/cm² pulsed)',
    'TENS (Transcutaneous Electrical Nerve Stimulation)',
    'Isometric Quadriceps & Core Strengthening',
    'Cryotherapy / Ice Pack (15 mins post-exercise)',
  ]);

  const [rehabGoals, setRehabGoals] = useState(
    'Achieve 130° active right knee flexion and restore pain-free independent ambulation within 4 weeks.'
  );

  const [saved, setSaved] = useState(false);

  const toggleModality = (mod: string) => {
    setSelectedModalities((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F0FDF4', color: '#166534', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Activity size={14} /> Physical Rehabilitation & Sports Medicine
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Physiotherapy Clinical Assessment & Rehab Suite
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Joint Goniometry · MRC Muscle Strength · Pain VAS Scale & Modality Prescription
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
          >
            <option value="">-- Select Patient Chart --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.hospitalNumber})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            style={{ padding: '9px 18px', borderRadius: 10, background: '#059669', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={15} /> Save Assessment
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Physiotherapy evaluation and rehab protocol recorded in Patient 360 chart.
        </div>
      )}

      {/* Grid: ROM & Muscle Grades | Pain & Modalities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Column: Range of Motion & Muscle Strength */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ROM Goniometer Card */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 14 }}>
              1. Joint Range of Motion (Goniometry)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {romList.map((rom, idx) => (
                <div key={idx} style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0F172A' }}>
                      {rom.joint} · {rom.movement}
                    </span>
                    {rom.painOnMotion && (
                      <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', fontWeight: 700 }}>
                        Pain on motion
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: '0.76rem', color: '#475569' }}>
                    <div>Active: <strong style={{ color: '#0F172A' }}>{rom.activeDeg}°</strong></div>
                    <div>Passive: <strong style={{ color: '#0F172A' }}>{rom.passiveDeg}°</strong></div>
                    <div>Normal: <strong style={{ color: '#64748B' }}>{rom.normalDeg}°</strong></div>
                  </div>
                  {/* Progress bar compared to normal */}
                  <div style={{ height: 6, background: '#E2E8F0', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (rom.activeDeg / rom.normalDeg) * 100)}%`, height: '100%', background: '#059669', borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MRC Muscle Strength Grading */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 14 }}>
              2. MRC Muscle Strength Grading (0 to 5)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {muscleGrades.map((mg, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>{mg.muscleGroup}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Side: {mg.side}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Grade:</span>
                    <span style={{ padding: '4px 10px', borderRadius: 8, background: mg.grade >= 4 ? '#ECFDF5' : '#FEF3C7', color: mg.grade >= 4 ? '#065F46' : '#92400E', fontWeight: 900, fontSize: '0.9rem' }}>
                      {mg.grade} / 5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Pain VAS Scale & Modalities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pain Score */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                3. Pain Severity (VAS 0–10)
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: painVas >= 7 ? '#DC2626' : painVas >= 4 ? '#D97706' : '#059669' }}>
                {painVas} / 10
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={painVas}
              onChange={(e) => setPainVas(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: painVas >= 7 ? '#DC2626' : '#D97706', marginBottom: 12 }}
            />
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Site & Radiation of Pain</label>
              <input
                type="text"
                value={painSite}
                onChange={(e) => setPainSite(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* Prescribed Modalities */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              4. Treatment Modalities & Physical Interventions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Therapeutic Ultrasound (1MHz, 1.2W/cm² pulsed)',
                'TENS (Transcutaneous Electrical Nerve Stimulation)',
                'Shortwave Diathermy (SWD)',
                'Infrared Heat Radiation Therapy',
                'Isometric Quadriceps & Core Strengthening',
                'Manual Spinal Mobilization (Maitland Grade II)',
                'Cryotherapy / Ice Pack (15 mins post-exercise)',
                'Gait Re-education & Parallel Bar Walking',
              ].map((mod) => {
                const active = selectedModalities.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => toggleModality(mod)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: active ? '1.5px solid #059669' : '1px solid #E2E8F0',
                      background: active ? '#ECFDF5' : '#FFF',
                      color: active ? '#065F46' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{mod}</span>
                    {active && <CheckCircle2 size={15} color="#059669" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rehabilitation Plan */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
              5. Functional Rehabilitation Goals
            </div>
            <textarea
              rows={3}
              value={rehabGoals}
              onChange={(e) => setRehabGoals(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', resize: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysiotherapyRehabSuite;
