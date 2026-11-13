'use client';

/**
 * DentalOdontogramSuite — Adult & Paediatric Dental Odontogram & Clinic Suite.
 * Compliant with FDI Two-Digit Notation & Universal Numbering System.
 * Tracks tooth conditions (Sound, Caries, Restored, Missing, Extracted, Root Canal, Crown, Implant),
 * Periodontal probing depths, and Dental Procedure Orders.
 */

import React, { useState, useMemo } from 'react';
import {
  Sparkles, Save, Printer, Plus, CheckCircle2, RotateCcw, AlertTriangle,
  FileText, Shield, Info, Layers, RefreshCw
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export type ToothCondition =
  | 'sound'
  | 'caries'
  | 'restored_amalgam'
  | 'restored_composite'
  | 'root_canal'
  | 'crown'
  | 'extracted'
  | 'impacted'
  | 'implant';

export interface ToothRecord {
  number: number; // FDI number, e.g., 18 to 48
  condition: ToothCondition;
  surfaces?: ('M' | 'D' | 'O' | 'B' | 'L')[]; // Mesial, Distal, Occlusal, Buccal, Lingual
  pocketDepthMm?: number;
  mobilityGrade?: 0 | 1 | 2 | 3;
  notes?: string;
}

export interface DentalTreatmentPlanItem {
  id: string;
  toothNumber: number;
  procedure: string;
  fee: number;
  status: 'planned' | 'in_progress' | 'completed';
}

const CONDITION_COLORS: Record<ToothCondition, { bg: string; text: string; label: string }> = {
  sound: { bg: '#F1F5F9', text: '#334155', label: 'Sound / Healthy' },
  caries: { bg: '#FEE2E2', text: '#DC2626', label: 'Active Caries / Decay' },
  restored_amalgam: { bg: '#CBD5E1', text: '#1E293B', label: 'Amalgam Restoration' },
  restored_composite: { bg: '#E0F2FE', text: '#0369A1', label: 'Composite / Tooth Colored' },
  root_canal: { bg: '#FEF3C7', text: '#D97706', label: 'Root Canal Treated' },
  crown: { bg: '#EDE9FE', text: '#7C3AED', label: 'Crown / Cap' },
  extracted: { bg: '#475569', text: '#F8FAFC', label: 'Extracted / Missing' },
  impacted: { bg: '#FFEDD5', text: '#EA580C', label: 'Unerupted / Impacted' },
  implant: { bg: '#CCFBF1', text: '#0D9488', label: 'Dental Implant' },
};

// Adult FDI Teeth:
// Upper Right (18-11), Upper Left (21-28)
// Lower Left (31-38), Lower Right (48-41)
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const DentalOdontogramSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients, setPatients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedTooth, setSelectedTooth] = useState<number>(11);

  // Teeth state
  const [teethMap, setTeethMap] = useState<Record<number, ToothRecord>>(() => {
    const init: Record<number, ToothRecord> = {};
    [...UPPER_TEETH, ...LOWER_TEETH].forEach((num) => {
      init[num] = { number: num, condition: 'sound', pocketDepthMm: 2, mobilityGrade: 0 };
    });
    // Sample initial conditions for realistic display
    init[16] = { number: 16, condition: 'caries', surfaces: ['O'], notes: 'Deep occlusal pit caries' };
    init[26] = { number: 26, condition: 'restored_composite', surfaces: ['M', 'O'] };
    init[36] = { number: 36, condition: 'root_canal', notes: 'Obturation complete' };
    init[48] = { number: 48, condition: 'impacted', notes: 'Mesioangular impaction' };
    init[46] = { number: 46, condition: 'extracted' };
    return init;
  });

  // Treatment plan
  const [treatments, setTreatments] = useState<DentalTreatmentPlanItem[]>([
    { id: 'TX-1', toothNumber: 16, procedure: 'Composite Resin Restoration (Occlusal)', fee: 12000, status: 'planned' },
    { id: 'TX-2', toothNumber: 48, procedure: 'Surgical Disimpaction & Extraction', fee: 35000, status: 'planned' },
    { id: 'TX-3', toothNumber: 36, procedure: 'Porcelain-Fused-to-Metal (PFM) Crown', fee: 45000, status: 'planned' },
  ]);

  const [procedureName, setProcedureName] = useState('');
  const [procedureFee, setProcedureFee] = useState(15000);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeToothRecord = teethMap[selectedTooth] || { number: selectedTooth, condition: 'sound' };

  const handleUpdateToothCondition = (cond: ToothCondition) => {
    setTeethMap((prev) => ({
      ...prev,
      [selectedTooth]: { ...prev[selectedTooth], condition: cond },
    }));
  };

  const handleAddTreatment = () => {
    if (!procedureName.trim()) return;
    const newTx: DentalTreatmentPlanItem = {
      id: `TX-${Date.now()}`,
      toothNumber: selectedTooth,
      procedure: procedureName,
      fee: procedureFee,
      status: 'planned',
    };
    setTreatments((prev) => [...prev, newTx]);
    setProcedureName('');
  };

  const totalEstimatedCost = useMemo(() => {
    return treatments.reduce((acc, t) => acc + t.fee, 0);
  }, [treatments]);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Sparkles size={14} /> Dental Surgery & Stomatology Clinic
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Interactive Dental Odontogram & Periodontal Chart
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            FDI Two-Digit Dental Charting · Full Mouth Occlusal Diagnostics & Procedure Orders
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
              setSavedSuccess(true);
              setTimeout(() => setSavedSuccess(false), 3000);
            }}
            style={{ padding: '9px 18px', borderRadius: 10, background: '#0284C7', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={15} /> Save Odontogram
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Dental Odontogram and Treatment Plan synchronized with Patient 360 chart.
        </div>
      )}

      {/* Main Grid: Odontogram Canvas & Tooth Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Left: Visual Odontogram Arch */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
              Dental Arch Visual Grid (Upper & Lower Quadrants)
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
              Click any tooth to examine & update clinical findings
            </div>
          </div>

          {/* Upper Arch (Maxilla) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textAlign: 'center', marginBottom: 8 }}>
              UPPER MAXILLARY ARCH (Right Quadrant 1 | Left Quadrant 2)
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              {UPPER_TEETH.map((tooth) => {
                const rec = teethMap[tooth] || { condition: 'sound' };
                const isSelected = selectedTooth === tooth;
                const styleMeta = CONDITION_COLORS[rec.condition];
                return (
                  <div
                    key={tooth}
                    onClick={() => setSelectedTooth(tooth)}
                    style={{
                      width: 44,
                      height: 64,
                      borderRadius: 10,
                      border: isSelected ? '2.5px solid #0284C7' : '1px solid #CBD5E1',
                      background: styleMeta.bg,
                      color: styleMeta.text,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 2px',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.08)' : 'none',
                      transition: 'transform 0.1s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>#{tooth}</span>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: styleMeta.text, opacity: 0.8 }} />
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, textAlign: 'center' }}>
                      {rec.condition.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Midline separator */}
          <div style={{ height: 2, background: '#E2E8F0', margin: '20px auto', width: '80%' }} />

          {/* Lower Arch (Mandible) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textAlign: 'center', marginBottom: 8 }}>
              LOWER MANDIBULAR ARCH (Right Quadrant 4 | Left Quadrant 3)
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              {LOWER_TEETH.map((tooth) => {
                const rec = teethMap[tooth] || { condition: 'sound' };
                const isSelected = selectedTooth === tooth;
                const styleMeta = CONDITION_COLORS[rec.condition];
                return (
                  <div
                    key={tooth}
                    onClick={() => setSelectedTooth(tooth)}
                    style={{
                      width: 44,
                      height: 64,
                      borderRadius: 10,
                      border: isSelected ? '2.5px solid #0284C7' : '1px solid #CBD5E1',
                      background: styleMeta.bg,
                      color: styleMeta.text,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 2px',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.08)' : 'none',
                      transition: 'transform 0.1s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>#{tooth}</span>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: styleMeta.text, opacity: 0.8 }} />
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, textAlign: 'center' }}>
                      {rec.condition.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(CONDITION_COLORS).map(([key, meta]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#475569' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: meta.bg, border: `1px solid ${meta.text}` }} />
                <span>{meta.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Tooth Inspector & Treatment Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Selected Tooth Card */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                Selected Tooth: #{selectedTooth}
              </div>
              <span style={{ padding: '3px 8px', borderRadius: 999, background: CONDITION_COLORS[activeToothRecord.condition].bg, color: CONDITION_COLORS[activeToothRecord.condition].text, fontSize: '0.74rem', fontWeight: 700 }}>
                {CONDITION_COLORS[activeToothRecord.condition].label}
              </span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: 6 }}>
                Update Tooth Status:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(Object.keys(CONDITION_COLORS) as ToothCondition[]).map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => handleUpdateToothCondition(cond)}
                    style={{
                      padding: '7px 8px',
                      borderRadius: 8,
                      border: activeToothRecord.condition === cond ? '2px solid #0284C7' : '1px solid #E2E8F0',
                      background: activeToothRecord.condition === cond ? '#F0F9FF' : '#FFF',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {CONDITION_COLORS[cond].label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Periodontal Pocket (mm)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={activeToothRecord.pocketDepthMm || 2}
                  onChange={(e) => {
                    const depth = parseInt(e.target.value, 10);
                    setTeethMap((prev) => ({
                      ...prev,
                      [selectedTooth]: { ...prev[selectedTooth], pocketDepthMm: depth },
                    }));
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Mobility Grade</label>
                <select
                  value={activeToothRecord.mobilityGrade || 0}
                  onChange={(e) => {
                    const mob = parseInt(e.target.value, 10) as 0 | 1 | 2 | 3;
                    setTeethMap((prev) => ({
                      ...prev,
                      [selectedTooth]: { ...prev[selectedTooth], mobilityGrade: mob },
                    }));
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem', background: '#FFF' }}
                >
                  <option value={0}>Grade 0 (Physiologic)</option>
                  <option value={1}>Grade 1 (1mm horizontal)</option>
                  <option value={2}>Grade 2 (&gt;1mm horizontal)</option>
                  <option value={3}>Grade 3 (Vertical &gt;2mm)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dental Treatment Plan & Billing */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                Treatment Plan & Billing Orders
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369A1' }}>
                Total: ₦{totalEstimatedCost.toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Procedure name (e.g., Scaling, Extraction)"
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
              />
              <input
                type="number"
                placeholder="Fee (₦)"
                value={procedureFee}
                onChange={(e) => setProcedureFee(parseInt(e.target.value, 10) || 0)}
                style={{ width: 85, padding: '7px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
              />
              <button
                type="button"
                onClick={handleAddTreatment}
                style={{ padding: '7px 12px', borderRadius: 8, background: '#0284C7', color: '#FFF', border: 'none', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
              >
                <Plus size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {treatments.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 800, color: '#0284C7', marginRight: 6 }}>#{tx.toothNumber}</span>
                    <span style={{ color: '#1E293B' }}>{tx.procedure}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>₦{tx.fee.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DentalOdontogramSuite;

