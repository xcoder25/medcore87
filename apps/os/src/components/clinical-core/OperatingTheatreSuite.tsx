'use client';

import React, { useState } from 'react';
import {
  Activity, CheckCircle2, Clock, ShieldAlert, User,
  Calendar, Layers, Stethoscope, AlertTriangle, Play,
  Plus, X, Check, Droplet, ArrowRight
} from 'lucide-react';
import type { SurgicalCase } from '@medcore/types';

interface ExtendedSurgicalCase extends SurgicalCase {
  signInDone?: boolean;
  timeOutDone?: boolean;
  signOutDone?: boolean;
}

const INITIAL_CASES: ExtendedSurgicalCase[] = [
  {
    id: 'OR-2026-4401',
    patientName: 'Kufre Daniel Etim',
    theatreNumber: 'Theatre 1 (Main Surgical Suite)',
    procedure: 'Open Reduction & Internal Fixation (ORIF) - Left Femur',
    leadSurgeon: 'Dr. Emeka Adeyemi (Consultant Orthopaedic Surgeon)',
    anesthetist: 'Dr. Patricia Umo (Consultant Anesthesiologist)',
    scheduledTime: '08:30 - 11:00',
    status: 'in_surgery',
    whoChecklistCompleted: true,
    bloodUnitsCrossmatched: 2,
    signInDone: true,
    timeOutDone: true,
    signOutDone: false,
  },
  {
    id: 'OR-2026-4402',
    patientName: 'Blessing Effiong',
    theatreNumber: 'Theatre 2 (Emergency Laparoscopy)',
    procedure: 'Emergency Appendectomy (Laparoscopic)',
    leadSurgeon: 'Dr. S. Okoro (General Surgery)',
    anesthetist: 'Dr. M. Danladi',
    scheduledTime: '10:00 - 11:30',
    status: 'pre_op',
    whoChecklistCompleted: false,
    bloodUnitsCrossmatched: 1,
    signInDone: true,
    timeOutDone: false,
    signOutDone: false,
  },
  {
    id: 'OR-2026-4403',
    patientName: 'Ekaette Nsikak Peters',
    theatreNumber: 'Theatre 3 (Maternity Obstetric Suite)',
    procedure: 'Elective Repeat Caesarean Section (ERCS) + Tubal Ligation',
    leadSurgeon: 'Dr. Evelyn Vance (Senior Obstetrician)',
    anesthetist: 'Dr. Patricia Umo',
    scheduledTime: '11:45 - 13:15',
    status: 'pre_op',
    whoChecklistCompleted: false,
    bloodUnitsCrossmatched: 2,
    signInDone: false,
    timeOutDone: false,
    signOutDone: false,
  },
  {
    id: 'OR-2026-4404',
    patientName: 'Bassey Okon Udoh',
    theatreNumber: 'Cath Lab / Interventional Suite',
    procedure: 'Emergency Percutaneous Coronary Intervention (PCI)',
    leadSurgeon: 'Dr. A. Bello (Interventional Cardiologist)',
    anesthetist: 'Dr. K. Nwachukwu',
    scheduledTime: '07:15 - 08:45',
    status: 'pacu',
    whoChecklistCompleted: true,
    bloodUnitsCrossmatched: 0,
    signInDone: true,
    timeOutDone: true,
    signOutDone: true,
  },
];

export const OperatingTheatreSuite: React.FC = () => {
  const [cases, setCases] = useState<ExtendedSurgicalCase[]>(INITIAL_CASES);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_CASES[0].id);
  const [notice, setNotice] = useState<string | null>(null);

  // New Surgery Modal State
  const [showModal, setShowModal] = useState(false);
  const [newPatient, setNewPatient] = useState('');
  const [newProcedure, setNewProcedure] = useState('');
  const [newTheatre, setNewTheatre] = useState('Theatre 1 (Main Surgical Suite)');
  const [newSurgeon, setNewSurgeon] = useState('Dr. Emeka Adeyemi (Consultant Orthopaedic)');
  const [newAnesthetist, setNewAnesthetist] = useState('Dr. Patricia Umo (Consultant Anesthesiologist)');
  const [newTime, setNewTime] = useState('14:00 - 16:30');
  const [newBloodUnits, setNewBloodUnits] = useState('2');

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const selectedCase = cases.find(c => c.id === selectedId) || cases[0];

  const handleUpdateStatus = (id: string, newStatus: SurgicalCase['status']) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    showNotification(`Surgical case updated to: ${newStatus.toUpperCase().replace('_', ' ')}`);
  };

  const handleToggleChecklist = (id: string, step: 'signIn' | 'timeOut' | 'signOut') => {
    setCases(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c };
        if (step === 'signIn') updated.signInDone = !updated.signInDone;
        if (step === 'timeOut') updated.timeOutDone = !updated.timeOutDone;
        if (step === 'signOut') updated.signOutDone = !updated.signOutDone;
        updated.whoChecklistCompleted = !!(updated.signInDone && updated.timeOutDone && updated.signOutDone);
        return updated;
      }
      return c;
    }));
    showNotification(`WHO Safety checklist verified for ${step.toUpperCase()}.`);
  };

  const handleScheduleSurgery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.trim() || !newProcedure.trim()) return;

    const nextId = `OR-2026-${4405 + cases.length}`;
    const newCase: ExtendedSurgicalCase = {
      id: nextId,
      patientName: newPatient.trim(),
      theatreNumber: newTheatre,
      procedure: newProcedure.trim(),
      leadSurgeon: newSurgeon,
      anesthetist: newAnesthetist,
      scheduledTime: newTime,
      status: 'pre_op',
      whoChecklistCompleted: false,
      bloodUnitsCrossmatched: parseInt(newBloodUnits) || 0,
      signInDone: false,
      timeOutDone: false,
      signOutDone: false,
    };

    setCases([newCase, ...cases]);
    setSelectedId(newCase.id);
    setShowModal(false);
    setNewPatient('');
    setNewProcedure('');
    showNotification(`Surgery ${nextId} scheduled in ${newTheatre}!`);
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

      {/* Top OT Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Operating Suites Active</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>4 / 6</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Surgical Air Ready</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Laminar Flow & Positive Pressure 100%</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Cases Scheduled Today</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>{cases.length} Cases</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Active Schedule</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>On-time Start Rate: 91%</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>WHO Surgical Safety</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>100%</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Sign-in / Time-out / Sign-out</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Zero Retained Foreign Objects</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>PACU Recovery Beds</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>3 / 8</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>5 Beds Available</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Anesthesia Recovery On Track</span>
        </div>
      </div>

      {/* Main Two Column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
        {/* Left: Operating List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
              Daily Surgical Master Schedule
            </div>
            <button
              type="button"
              className="os-action-btn-primary"
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 14px' }}
            >
              <Plus size={14} /> Schedule Surgery
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cases.map(c => {
              const isSelected = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  className="os-card"
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--ak-orange)' : undefined,
                    background: isSelected ? 'rgba(234,88,12,0.08)' : undefined,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                        background: c.status === 'in_surgery' ? '#EF4444' : c.status === 'pacu' ? '#3B82F6' : '#F59E0B',
                        color: '#FFF',
                      }}>
                        {c.status.toUpperCase().replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0A2540' }}>{c.theatreNumber}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>{c.scheduledTime}</span>
                  </div>

                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#D97706', marginBottom: 4 }}>
                    {c.procedure}
                  </div>

                  <div style={{ fontSize: '0.84rem', color: '#0A2540', marginBottom: 2 }}>
                    Patient: <strong>{c.patientName}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--os-text-dim)', marginTop: 6 }}>
                    <span>Surgeon: {c.leadSurgeon.split('(')[0]}</span>
                    <span>Anesthetist: {c.anesthetist}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Surgical Suite Control & WHO Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="os-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--os-text-dim)', textTransform: 'uppercase' }}>
                Active Operating Suite Live Card
              </div>
              <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700 }}>
                {selectedCase.theatreNumber.split('(')[0]}
              </span>
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#0A2540' }}>{selectedCase.procedure}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--os-text-muted)' }}>Patient: <strong>{selectedCase.patientName}</strong></div>

            <div style={{ margin: '14px 0', padding: 12, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--os-text-dim)' }}>Lead Surgeon:</span>
                <span style={{ fontWeight: 700, color: '#0A2540' }}>{selectedCase.leadSurgeon}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--os-text-dim)' }}>Anesthesiologist:</span>
                <span style={{ fontWeight: 700, color: '#0A2540' }}>{selectedCase.anesthetist}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--os-text-dim)' }}>Blood Bank Cross-match:</span>
                <span style={{ fontWeight: 700, color: selectedCase.bloodUnitsCrossmatched > 0 ? '#059669' : '#64748B' }}>
                  {selectedCase.bloodUnitsCrossmatched} Units PRBC Standby
                </span>
              </div>
            </div>

            {/* WHO Surgical Safety Checklist Status (Interactive) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  WHO Surgical Safety Protocol (Tap to Verify)
                </span>
                <span style={{ fontSize: '0.7rem', color: selectedCase.whoChecklistCompleted ? '#059669' : '#D97706', fontWeight: 700 }}>
                  {selectedCase.whoChecklistCompleted ? 'ALL COMPLETED' : 'INCOMPLETE'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  onClick={() => handleToggleChecklist(selectedCase.id, 'signIn')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: selectedCase.signInDone ? '#ECFDF5' : '#F8FAFC',
                    border: `1px solid ${selectedCase.signInDone ? '#A7F3D0' : '#E2E8F0'}`,
                    borderRadius: 6, fontSize: '0.76rem', color: selectedCase.signInDone ? '#059669' : '#64748B',
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color={selectedCase.signInDone ? '#059669' : '#94A3B8'} />
                    SIGN IN (Before Induction of Anaesthesia)
                  </span>
                  <span>{selectedCase.signInDone ? 'VERIFIED' : 'CLICK TO CHECK'}</span>
                </div>

                <div
                  onClick={() => handleToggleChecklist(selectedCase.id, 'timeOut')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: selectedCase.timeOutDone ? '#ECFDF5' : '#F8FAFC',
                    border: `1px solid ${selectedCase.timeOutDone ? '#A7F3D0' : '#E2E8F0'}`,
                    borderRadius: 6, fontSize: '0.76rem', color: selectedCase.timeOutDone ? '#059669' : '#64748B',
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color={selectedCase.timeOutDone ? '#059669' : '#94A3B8'} />
                    TIME OUT (Before Skin Incision)
                  </span>
                  <span>{selectedCase.timeOutDone ? 'VERIFIED' : 'CLICK TO CHECK'}</span>
                </div>

                <div
                  onClick={() => handleToggleChecklist(selectedCase.id, 'signOut')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: selectedCase.signOutDone ? '#ECFDF5' : '#F8FAFC',
                    border: `1px solid ${selectedCase.signOutDone ? '#A7F3D0' : '#E2E8F0'}`,
                    borderRadius: 6, fontSize: '0.76rem', color: selectedCase.signOutDone ? '#059669' : '#64748B',
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color={selectedCase.signOutDone ? '#059669' : '#94A3B8'} />
                    SIGN OUT (Instrument & Swab Count)
                  </span>
                  <span>{selectedCase.signOutDone ? 'VERIFIED' : 'CLICK TO CHECK'}</span>
                </div>
              </div>
            </div>

            {/* Stage Progress Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedCase.status === 'pre_op' && (
                <button
                  type="button"
                  className="os-action-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => handleUpdateStatus(selectedCase.id, 'in_surgery')}
                >
                  <Play size={14} /> Begin Surgical Procedure
                </button>
              )}
              {selectedCase.status === 'in_surgery' && (
                <button
                  type="button"
                  className="os-action-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', background: '#3B82F6' }}
                  onClick={() => handleUpdateStatus(selectedCase.id, 'pacu')}
                >
                  <CheckCircle2 size={14} /> Transfer to Recovery (PACU)
                </button>
              )}
              {selectedCase.status === 'pacu' && (
                <button
                  type="button"
                  className="os-action-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', background: '#10B981' }}
                  onClick={() => handleUpdateStatus(selectedCase.id, 'completed')}
                >
                  <CheckCircle2 size={14} /> Discharge to Inpatient Ward
                </button>
              )}
              {selectedCase.status === 'completed' && (
                <div style={{ width: '100%', textAlign: 'center', padding: '10px', background: '#ECFDF5', borderRadius: 8, color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>
                  ✓ Surgical Case Completed & Documented
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Surgery Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 520, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>
                Schedule Operating Theatre Surgery
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleScheduleSurgery} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aniefiok Udo Peters"
                  value={newPatient}
                  onChange={e => setNewPatient(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Surgical Procedure Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Exploratory Laparotomy, Cholecystectomy..."
                  value={newProcedure}
                  onChange={e => setNewProcedure(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Operating Suite *
                  </label>
                  <select
                    value={newTheatre}
                    onChange={e => setNewTheatre(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                  >
                    <option>Theatre 1 (Main Surgical Suite)</option>
                    <option>Theatre 2 (Emergency Laparoscopy)</option>
                    <option>Theatre 3 (Maternity Obstetric Suite)</option>
                    <option>Theatre 4 (Ophthalmic & ENT Suite)</option>
                    <option>Cath Lab / Interventional Suite</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Scheduled Time Window *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 14:00 - 16:30"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Lead Surgeon *
                  </label>
                  <input
                    type="text"
                    value={newSurgeon}
                    onChange={e => setNewSurgeon(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Blood Units Crossmatched
                  </label>
                  <input
                    type="number"
                    value={newBloodUnits}
                    onChange={e => setNewBloodUnits(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Confirm Surgery Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
