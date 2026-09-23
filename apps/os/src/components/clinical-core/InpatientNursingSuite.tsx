'use client';

import React, { useState } from 'react';
import {
  Heart, Activity, CheckCircle2, Clock, Pill,
  FileText, Search, User, ShieldCheck, AlertTriangle, Plus, X
} from 'lucide-react';
import type { NursingCareItem } from '@medcore/types';

const INITIAL_NURSING_ITEMS: NursingCareItem[] = [
  { id: 'NUR-01', bedNumber: 'Surg Bed 12', patientName: 'Kufre Daniel Etim', careActivity: 'Wound Dressing & Drain Output Measurement', frequency: 'Q8H', nextScheduledTime: '10:00', status: 'pending', assignedNurse: 'Nurse Aisha Bello' },
  { id: 'NUR-02', bedNumber: 'Med Bed 04', patientName: 'Idongesit Aniefiok Udo', careActivity: 'IV Ceftriaxone 2g Administration (MAR Check)', frequency: 'OD', nextScheduledTime: '09:30', status: 'completed', assignedNurse: 'Nurse E. Akpan' },
  { id: 'NUR-03', bedNumber: 'ICU Bed 01', patientName: 'Bassey Okon Udoh', careActivity: 'Endotracheal Suctioning & Repositioning', frequency: 'Q2H', nextScheduledTime: '10:15', status: 'pending', assignedNurse: 'Nurse Aisha Bello' },
  { id: 'NUR-04', bedNumber: 'Maternity Bed 02', patientName: 'Ekaette Nsikak Peters', careActivity: 'Post-CS Lochia & Uterine Tone Assessment', frequency: 'Q4H', nextScheduledTime: '08:00', status: 'overdue', assignedNurse: 'Midwife Inemesit Udoh' },
  { id: 'NUR-05', bedNumber: 'Paed Bed 07', patientName: 'Miss Emediong Bassey', careActivity: 'Blood Glucose Monitoring & IV Artesunate Dose 2', frequency: 'Q12H', nextScheduledTime: '11:00', status: 'pending', assignedNurse: 'Nurse C. Okon' },
];

export const InpatientNursingSuite: React.FC = () => {
  const [items, setItems] = useState<NursingCareItem[]>(INITIAL_NURSING_ITEMS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBed, setNewBed] = useState('Med Bed 08');
  const [newPatient, setNewPatient] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [newFrequency, setNewFrequency] = useState('Q8H');
  const [newTime, setNewTime] = useState('12:00');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleComplete = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'completed' } : item));
    showNotification('Medication / Care administration signed and verified.');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.trim() || !newActivity.trim()) return;

    const newTask: NursingCareItem = {
      id: `NUR-${Date.now().toString().slice(-4)}`,
      bedNumber: newBed,
      patientName: newPatient.trim(),
      careActivity: newActivity.trim(),
      frequency: newFrequency,
      nextScheduledTime: newTime,
      status: 'pending',
      assignedNurse: 'Duty Nurse (On-Shift)',
    };

    setItems([newTask, ...items]);
    setShowAddModal(false);
    setNewPatient('');
    setNewActivity('');
    showNotification(`Care task registered for ${newTask.patientName} (${newTask.bedNumber}).`);
  };

  const overdueCount = items.filter(i => i.status === 'overdue').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast */}
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

      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Inpatient Ward Census</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>184 Patients</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Wards A–G</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Digital Kardex 100% Synchronized</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Overdue Nursing Tasks</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{overdueCount} Alerts</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Stat Attention</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Post-op Vital Checks & Dressing</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #34D399' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>e-MAR Medication Passes</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>98.4%</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>On Schedule</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Barcode Medication Verification Active</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Nursing Shift Handoff</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>SBAR Done</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Shift Active</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>112 Duty Nurses Logged In</span>
        </div>
      </div>

      {/* Nursing Task Table */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0A2540', textTransform: 'uppercase' }}>
              Electronic Medication Administration Record (e-MAR) & Ward Care Kardex
            </span>
            <div style={{ fontSize: '0.74rem', color: 'var(--os-text-dim)', marginTop: 2 }}>Shift 08:00 – 16:00 • Inpatient Medication Checklist</div>
          </div>
          <button
            type="button"
            className="os-action-btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '7px 14px' }}
          >
            <Plus size={14} /> Add Nursing Task
          </button>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Bed / Location</th>
                <th>Patient Name</th>
                <th>Prescribed Care / Medication</th>
                <th>Frequency</th>
                <th>Scheduled Time</th>
                <th>Duty Nurse</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 800, color: '#D97706' }}>{item.bedNumber}</td>
                  <td style={{ fontWeight: 700, color: '#0A2540' }}>{item.patientName}</td>
                  <td style={{ color: '#334155', fontWeight: 600 }}>{item.careActivity}</td>
                  <td style={{ color: '#64748B' }}>{item.frequency}</td>
                  <td style={{ fontWeight: 800, color: item.status === 'overdue' ? '#DC2626' : '#0A2540' }}>
                    {item.nextScheduledTime}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#64748B' }}>{item.assignedNurse}</td>
                  <td>
                    {item.status !== 'completed' ? (
                      <button
                        type="button"
                        className="os-action-btn-primary"
                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                        onClick={() => handleComplete(item.id)}
                      >
                        <CheckCircle2 size={12} /> Sign Administration
                      </button>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#059669', fontWeight: 700 }}>
                        <CheckCircle2 size={14} /> Administered & Signed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Nursing Task Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 460, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0A2540' }}>
                Add Inpatient Care / Medication Task
              </h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Archibong"
                  value={newPatient}
                  onChange={e => setNewPatient(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Bed Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Med Bed 08"
                    value={newBed}
                    onChange={e => setNewBed(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Scheduled Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Care Activity or Medication *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IV Paracetamol 1g, Blood Pressure & SpO2 Charting..."
                  value={newActivity}
                  onChange={e => setNewActivity(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Dosing Frequency
                </label>
                <select
                  value={newFrequency}
                  onChange={e => setNewFrequency(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                >
                  <option value="STAT">STAT (Immediate Once)</option>
                  <option value="OD">OD (Once Daily)</option>
                  <option value="BD">BD (Twice Daily - Q12H)</option>
                  <option value="TDS">TDS (Three Times Daily - Q8H)</option>
                  <option value="QDS">QDS (Four Times Daily - Q6H)</option>
                  <option value="PRN">PRN (As Needed)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Add to e-MAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
