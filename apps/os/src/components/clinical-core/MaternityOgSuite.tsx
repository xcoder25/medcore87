'use client';

import React, { useState } from 'react';
import {
  Heart, Activity, AlertTriangle, CheckCircle2, Clock,
  Baby, Stethoscope, User, ChevronRight, Plus, X, Award
} from 'lucide-react';
import type { LabourWardPatient } from '@medcore/types';

interface ExtendedLabourPatient extends LabourWardPatient {
  delivered?: boolean;
  babyGender?: 'Male' | 'Female';
  birthWeightKg?: number;
  apgarScore?: string;
}

const INITIAL_MOTHERS: ExtendedLabourPatient[] = [];

export const MaternityOgSuite: React.FC = () => {
  const [mothers, setMothers] = useState<ExtendedLabourPatient[]>(INITIAL_MOTHERS);
  const [selectedId, setSelectedId] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  // Modal States
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showPartographModal, setShowPartographModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Admit Form
  const [newMotherName, setNewMotherName] = useState('');
  const [newGravida, setNewGravida] = useState('G1 P0+0 (39 Weeks)');
  const [newDilation, setNewDilation] = useState('3');
  const [newFHR, setNewFHR] = useState('140');
  const [newContractions, setNewContractions] = useState('3');

  // Partograph Update Form
  const [editDilation, setEditDilation] = useState('8');
  const [editFHR, setEditFHR] = useState('136');
  const [editContractions, setEditContractions] = useState('4');

  // Delivery Form
  const [babyGender, setBabyGender] = useState<'Male' | 'Female'>('Female');
  const [birthWeight, setBirthWeight] = useState('3.2');
  const [apgar, setApgar] = useState('9 / 10');

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const selectedMother = mothers.find(m => m.id === selectedId) || mothers[0];

  const handleCreateAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotherName.trim()) return;

    const nextId = `MAT-2026-0${44 + mothers.length}`;
    const newPatient: ExtendedLabourPatient = {
      id: nextId,
      patientName: newMotherName.trim(),
      gravidaPara: newGravida,
      cervicalDilationCm: parseInt(newDilation) || 3,
      fetalHeartRateBpm: parseInt(newFHR) || 140,
      contractionsPer10Min: parseInt(newContractions) || 3,
      romTime: 'Active Intact',
      riskStatus: parseInt(newFHR) > 160 ? 'emergency_csection' : 'low_risk',
      midwifeOnDuty: 'Senior Midwife Mfoniso Akpan',
    };

    setMothers([newPatient, ...mothers]);
    setSelectedId(newPatient.id);
    setShowAdmitModal(false);
    setNewMotherName('');
    showNotification(`Mother ${newPatient.patientName} admitted to Labour Suite.`);
  };

  const handleSavePartograph = (e: React.FormEvent) => {
    e.preventDefault();
    setMothers(prev => prev.map(m => {
      if (m.id === selectedMother.id) {
        return {
          ...m,
          cervicalDilationCm: parseInt(editDilation) || m.cervicalDilationCm,
          fetalHeartRateBpm: parseInt(editFHR) || m.fetalHeartRateBpm,
          contractionsPer10Min: parseInt(editContractions) || m.contractionsPer10Min,
        };
      }
      return m;
    }));
    setShowPartographModal(false);
    showNotification(`Partograph recorded for ${selectedMother.patientName}: Dilation ${editDilation}cm, FHR ${editFHR}bpm.`);
  };

  const handleRecordDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    setMothers(prev => prev.map(m => {
      if (m.id === selectedMother.id) {
        return {
          ...m,
          delivered: true,
          cervicalDilationCm: 10,
          babyGender,
          birthWeightKg: parseFloat(birthWeight) || 3.2,
          apgarScore: apgar,
        };
      }
      return m;
    }));
    setShowDeliveryModal(false);
    showNotification(`🎉 Delivery recorded for ${selectedMother.patientName}! Healthy ${babyGender} baby, ${birthWeight}kg.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {notice && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 99999, background: '#0F2236',
          border: '1px solid #10B981', borderRadius: 10, padding: '14px 20px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          gap: 12, color: '#F1F5F9', fontSize: '0.88rem', fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* Top Maternity Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #EC4899' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Labour Delivery Suites</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F472B6' }}>{mothers.length} / 8</span>
            <span style={{ fontSize: '0.75rem', color: '#0A2540' }}>Suites</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Continuous CTG & Partograph Active</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Emergency C-Sections</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>
              {mothers.filter(m => m.riskStatus === 'emergency_csection').length} Active
            </span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Stat Scrub</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Theatre 3 Obstetric Suite Ready</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #34D399' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Deliveries Logged Today</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>
              {7 + mothers.filter(m => m.delivered).length} Babies
            </span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>All Healthy</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Zero Maternal Mortality Milestone</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Midwife Ratio</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>1 : 1</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Active Duty</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>One-to-One Skilled Midwifery</span>
        </div>
      </div>

      {/* Main Labour Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        {/* Left: Mother List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
              Active Labouring Mothers
            </span>
            <button
              type="button"
              className="os-action-btn-primary"
              onClick={() => setShowAdmitModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 14px' }}
            >
              <Plus size={14} /> Admit Mother
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mothers.map(m => {
              const isSelected = m.id === selectedId;
              const isDanger = m.riskStatus === 'emergency_csection';
              return (
                <div
                  key={m.id}
                  className="os-card"
                  onClick={() => setSelectedId(m.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? '#EC4899' : isDanger ? '#EF4444' : undefined,
                    background: isSelected ? 'rgba(236,72,153,0.08)' : undefined,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.92rem' }}>{m.patientName}</span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                      background: m.delivered ? '#10B981' : isDanger ? '#EF4444' : '#EC4899',
                      color: '#FFF',
                    }}>
                      {m.delivered ? 'DELIVERED' : isDanger ? 'EMERGENCY CS' : 'ACTIVE LABOUR'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: 6 }}>
                    {m.gravidaPara}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#334155', fontWeight: 600 }}>
                    <span>Dilation: <strong>{m.cervicalDilationCm} cm</strong></span>
                    <span>FHR: <strong style={{ color: m.fetalHeartRateBpm > 160 ? '#EF4444' : '#059669' }}>{m.fetalHeartRateBpm} bpm</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Mother Live Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="os-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#EC4899', textTransform: 'uppercase' }}>
                Labour Ward Bed 03 • CTG Telemetry
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{selectedMother.midwifeOnDuty}</span>
            </div>

            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.25rem', color: '#0A2540' }}>{selectedMother.patientName}</h3>
            <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 14 }}>{selectedMother.gravidaPara} • ROM: {selectedMother.romTime}</div>

            {/* Dilation & Contraction Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '14px 0' }}>
              <div style={{ background: '#FDF2F8', border: '1px solid #FBCFE8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#DB2777', fontWeight: 700 }}>CERVICAL DILATION</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 2 }}>{selectedMother.cervicalDilationCm} / 10 cm</div>
                <span style={{ fontSize: '0.7rem', color: '#9D174D' }}>Partograph Alert Line Cleared</span>
              </div>

              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#2563EB', fontWeight: 700 }}>FETAL HEART RATE (CTG)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: selectedMother.fetalHeartRateBpm > 160 ? '#DC2626' : '#059669', marginTop: 2 }}>
                  {selectedMother.fetalHeartRateBpm} bpm
                </div>
                <span style={{ fontSize: '0.7rem', color: selectedMother.fetalHeartRateBpm > 160 ? '#DC2626' : '#059669', fontWeight: 600 }}>
                  {selectedMother.fetalHeartRateBpm > 160 ? 'Fetal Tachycardia Warning' : 'Normal Baseline (110–160)'}
                </span>
              </div>

              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 700 }}>UTERINE CONTRACTIONS</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0A2540', marginTop: 2 }}>{selectedMother.contractionsPer10Min} / 10 min</div>
                <span style={{ fontSize: '0.7rem', color: '#92400E' }}>Duration: 45–50 secs</span>
              </div>
            </div>

            {/* If Delivered */}
            {selectedMother.delivered && (
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: 14, margin: '14px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 800, fontSize: '0.92rem' }}>
                  <Award size={18} />
                  <span>Delivery Completed & Registered</span>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: '0.82rem', color: '#065F46' }}>
                  <span>Neonate: <strong>{selectedMother.babyGender}</strong></span>
                  <span>Weight: <strong>{selectedMother.birthWeightKg} kg</strong></span>
                  <span>APGAR: <strong>{selectedMother.apgarScore}</strong></span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="os-action-btn-primary"
                onClick={() => {
                  setEditDilation(String(selectedMother.cervicalDilationCm));
                  setEditFHR(String(selectedMother.fetalHeartRateBpm));
                  setEditContractions(String(selectedMother.contractionsPer10Min));
                  setShowPartographModal(true);
                }}
              >
                <Activity size={14} /> Update Partograph Exam
              </button>

              {!selectedMother.delivered && (
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ color: '#059669', borderColor: '#A7F3D0' }}
                  onClick={() => setShowDeliveryModal(true)}
                >
                  <Baby size={14} /> Log Birth & APGAR
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Admit Mother */}
      {showAdmitModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Admit Labouring Mother
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowAdmitModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateAdmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Mother Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grace Effiong Bassey"
                  value={newMotherName}
                  onChange={e => setNewMotherName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Gravida & Parity (Weeks) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. G2 P1+0 (39 Weeks)"
                  value={newGravida}
                  onChange={e => setNewGravida(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Dilation (cm)</label>
                  <input
                    type="number"
                    max={10}
                    value={newDilation}
                    onChange={e => setNewDilation(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>FHR (bpm)</label>
                  <input
                    type="number"
                    value={newFHR}
                    onChange={e => setNewFHR(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Contractions</label>
                  <input
                    type="number"
                    value={newContractions}
                    onChange={e => setNewContractions(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowAdmitModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Admit to Labour Suite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Update Partograph */}
      {showPartographModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Partograph Clinical Assessment
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowPartographModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSavePartograph} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Cervical Dilation (0 - 10 cm)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  required
                  value={editDilation}
                  onChange={e => setEditDilation(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Fetal Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  required
                  value={editFHR}
                  onChange={e => setEditFHR(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Contractions / 10 Minutes
                </label>
                <input
                  type="number"
                  required
                  value={editContractions}
                  onChange={e => setEditContractions(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowPartographModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Update Partograph</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Log Delivery */}
      {showDeliveryModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Log Delivery & Neonatal Birth
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowDeliveryModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleRecordDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Neonate Gender *
                </label>
                <select
                  value={babyGender}
                  onChange={e => setBabyGender(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Birth Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={birthWeight}
                  onChange={e => setBirthWeight(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  APGAR Score (1 min / 5 mins) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9 / 10"
                  value={apgar}
                  onChange={e => setApgar(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Register Birth Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
