'use client';

import React, { useState } from 'react';
import { HospitalPatient, INITIAL_PATIENTS } from '../../data/hospitalData';
import {
  Users, Search, Plus, Stethoscope, FileText, Pill,
  BedDouble, AlertTriangle, CheckCircle2, ChevronRight, X, HeartPulse, UserPlus
} from 'lucide-react';

interface PatientsManagerProps {
  onNavigate?: (module: string, param?: any) => void;
}

export const PatientsManager: React.FC<PatientsManagerProps> = ({ onNavigate }) => {
  const [patients, setPatients] = useState<HospitalPatient[]>(INITIAL_PATIENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'inpatient' | 'outpatient' | 'critical'>('all');
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<HospitalPatient | null>(null);

  // New patient admission form state
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    sex: 'M' as 'M' | 'F',
    phone: '',
    ward: 'MMW',
    bed: '',
    diagnoses: '',
    blood: 'O+',
    allergies: '',
  });

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.ward.toLowerCase().includes(q) ||
      p.diagnoses.some(d => d.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (activeTab === 'inpatient') return p.type === 'inpatient';
    if (activeTab === 'outpatient') return p.type === 'outpatient';
    if (activeTab === 'critical') return p.status === 'critical';
    return true;
  });

  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name.trim()) return;

    const patient: HospitalPatient = {
      id: `P-${Date.now().toString().slice(-4)}`,
      mrn: `MRN-26-${Math.floor(10000 + Math.random() * 90000)}`,
      name: newPatient.name.trim(),
      age: parseInt(newPatient.age) || 30,
      sex: newPatient.sex,
      dob: '1995-01-01',
      blood: newPatient.blood,
      ward: newPatient.ward,
      bed: newPatient.bed.trim() || 'Pending',
      status: 'stable',
      diagnoses: newPatient.diagnoses ? [newPatient.diagnoses] : ['Acute Clinical Evaluation'],
      allergies: newPatient.allergies ? newPatient.allergies.split(',').map(s => s.trim()) : [],
      phone: newPatient.phone || '+234-800-000-0000',
      nok: 'Next of Kin on File',
      attending: 'Dr. Adewale Bello',
      admitDate: new Date().toISOString().split('T')[0],
      vitals: { bp: '120/80', pulse: 76, temp: 36.8, spo2: 98, rr: 18, weight: 70, height: 170 },
      medications: [],
      type: 'inpatient',
    };

    setPatients([patient, ...patients]);
    setShowAdmitModal(false);
    setNewPatient({ name: '', age: '', sex: 'M', phone: '', ward: 'MMW', bed: '', diagnoses: '', blood: 'O+', allergies: '' });
  };

  const getStatusBadge = (status: HospitalPatient['status']) => {
    switch (status) {
      case 'critical':
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(239,68,68,0.2)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.4)' }}>● CRITICAL</span>;
      case 'stable':
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.4)' }}>STABLE</span>;
      case 'review':
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.2)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)' }}>REVIEW</span>;
      case 'post-op':
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(139,92,246,0.2)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.4)' }}>POST-OP</span>;
      case 'waiting':
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(59,130,246,0.2)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.4)' }}>WAITING</span>;
      case 'in-progress':
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(6,182,212,0.2)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.4)' }}>IN CLINIC</span>;
      default:
        return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(148,163,184,0.2)', color: '#94A3B8' }}>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14,
        padding: '18px 22px',
        border: '1px solid #1E446B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={24} color="#00B4A6" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Hospital Patient Registry</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: '#94A8BE', fontSize: '0.85rem' }}>
            Active inpatient census and outpatient clinical encounters • {patients.length} total registered patients
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowAdmitModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#1A6EB5', color: '#0A2540',
              border: 'none', borderRadius: 8, padding: '9px 16px',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <UserPlus size={15} /> Admit Inpatient
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('consultations')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,180,166,0.15)', color: '#00B4A6',
              border: '1px solid rgba(0,180,166,0.3)', borderRadius: 8, padding: '9px 16px',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Stethoscope size={15} /> New Consultation
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#132F4C',
        border: '1px solid #1E446B',
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, background: '#0A1929', padding: '8px 14px', borderRadius: 8, border: '1px solid #1E446B' }}>
          <Search size={16} color="#94A8BE" />
          <input
            type="text"
            placeholder="Search by patient name, MRN, ward, or diagnosis..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.85rem' }}
          />
        </div>

        {/* Tab Pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all', label: `All (${patients.length})` },
            { key: 'inpatient', label: `Inpatients (${patients.filter(p => p.type === 'inpatient').length})` },
            { key: 'outpatient', label: `Outpatients (${patients.filter(p => p.type === 'outpatient').length})` },
            { key: 'critical', label: `Critical (${patients.filter(p => p.status === 'critical').length})` },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab.key ? '#1A6EB5' : '#FFFFFF',
                color: activeTab === tab.key ? '#FFFFFF' : '#94A8BE',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patients Data Table */}
      <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#0D223A', borderBottom: '1px solid #1E446B', color: '#94A8BE' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Patient</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ward / Bed</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Age / Sex</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Blood</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Primary Diagnosis</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Vitals (BP/Pulse)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#94A8BE' }}>
                    No patients match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredPatients.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    style={{
                      borderBottom: '1px solid #FFFFFF',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1A4674')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: p.status === 'critical' ? 'linear-gradient(135deg, #EF4444, #B91C1C)' : 'linear-gradient(135deg, #1A6EB5, #00B4A6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.8rem', color: '#0A2540'
                        }}>
                          {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0A2540' }}>{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94A8BE', fontFamily: 'monospace' }}>{p.mrn}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(26,110,181,0.25)', color: '#0052D4', fontSize: '0.75rem', fontWeight: 700, marginRight: 6 }}>
                        {p.ward}
                      </span>
                      <span style={{ color: '#94A8BE', fontSize: '0.75rem' }}>{p.bed !== '—' ? `Bed ${p.bed}` : 'Outpatient'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {p.age === 0 ? 'Neonatal' : `${p.age}y`} / {p.sex}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: '#E2E8F0', color: '#0A2540', fontSize: '0.72rem', fontWeight: 700 }}>
                        {p.blood}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155' }}>
                      {p.diagnoses[0]}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getStatusBadge(p.status)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#CBD5E1', fontFamily: 'monospace' }}>
                      {p.vitals.bp} • {p.vitals.pulse} bpm
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onNavigate && onNavigate('emr', { patientId: p.id })}
                          title="View Clinical EMR"
                          style={{ background: 'rgba(26,110,181,0.2)', border: '1px solid rgba(26,110,181,0.4)', borderRadius: 6, padding: '5px 8px', color: '#0052D4', cursor: 'pointer' }}
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate && onNavigate('consultations', { patientId: p.id })}
                          title="Open Consultation"
                          style={{ background: 'rgba(0,180,166,0.2)', border: '1px solid rgba(0,180,166,0.4)', borderRadius: 6, padding: '5px 8px', color: '#00B4A6', cursor: 'pointer' }}
                        >
                          <Stethoscope size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail Drawer */}
      {selectedPatient && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(10,25,41,0.7)',
          display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '100%', maxWidth: 540, background: '#0D223A', height: '100%',
            borderLeft: '1px solid #1E446B', padding: 24, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800
                }}>
                  {selectedPatient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{selectedPatient.name}</h2>
                  <div style={{ fontSize: '0.78rem', color: '#94A8BE', fontFamily: 'monospace' }}>{selectedPatient.mrn}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                style={{ background: 'none', border: 'none', color: '#94A8BE', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div style={{ background: '#132F4C', padding: 12, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: '#94A8BE' }}>BLOOD PRESSURE</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>{selectedPatient.vitals.bp}</div>
              </div>
              <div style={{ background: '#132F4C', padding: 12, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: '#94A8BE' }}>PULSE / SPO2</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>{selectedPatient.vitals.pulse} bpm / {selectedPatient.vitals.spo2}%</div>
              </div>
              <div style={{ background: '#132F4C', padding: 12, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: '#94A8BE' }}>BODY TEMP</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>{selectedPatient.vitals.temp}°C</div>
              </div>
            </div>

            {/* Diagnoses and Allergies */}
            <div style={{ background: '#132F4C', padding: 16, borderRadius: 8, border: '1px solid #1E446B' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00B4A6', marginBottom: 8, textTransform: 'uppercase' }}>
                Active Diagnoses
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: '0.85rem' }}>
                {selectedPatient.diagnoses.map((d, i) => <li key={i} style={{ marginBottom: 4 }}>{d}</li>)}
              </ul>

              {selectedPatient.allergies.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#EF4444', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> Drug Allergies & Adverse Reactions
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedPatient.allergies.map((a, i) => (
                      <span key={i} style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: '0.75rem', fontWeight: 700 }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Current Active Prescriptions */}
            <div style={{ background: '#132F4C', padding: 16, borderRadius: 8, border: '1px solid #1E446B' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0052D4', marginBottom: 8, textTransform: 'uppercase' }}>
                Current Medications (eMAR)
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: '0.85rem' }}>
                {selectedPatient.medications.map((m, i) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
              </ul>
            </div>

            {/* Quick Actions at bottom */}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  if (onNavigate) onNavigate('emr', { patientId: selectedPatient.id });
                }}
                style={{
                  flex: 1, padding: 12, borderRadius: 8, background: '#1A6EB5', color: '#0A2540',
                  fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <FileText size={16} /> Open Full EMR
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  if (onNavigate) onNavigate('consultations', { patientId: selectedPatient.id });
                }}
                style={{
                  flex: 1, padding: 12, borderRadius: 8, background: '#00B4A6', color: '#0A2540',
                  fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Stethoscope size={16} /> Consult
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admit Patient Modal */}
      {showAdmitModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,25,41,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#0D223A', border: '1px solid #1E446B', borderRadius: 16,
            width: '100%', maxWidth: 520, padding: 24, color: '#0A2540'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Admit Inpatient to Ward</h2>
              <button type="button" onClick={() => setShowAdmitModal(false)} style={{ background: 'none', border: 'none', color: '#94A8BE', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PATIENT FULL NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Uchechukwu"
                  value={newPatient.name}
                  onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>AGE</label>
                  <input
                    type="number"
                    placeholder="e.g. 45"
                    value={newPatient.age}
                    onChange={e => setNewPatient({ ...newPatient, age: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>SEX</label>
                  <select
                    value={newPatient.sex}
                    onChange={e => setNewPatient({ ...newPatient, sex: e.target.value as any })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>WARD</label>
                  <select
                    value={newPatient.ward}
                    onChange={e => setNewPatient({ ...newPatient, ward: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  >
                    <option value="MMW">Male Medical Ward (MMW)</option>
                    <option value="FMW">Female Medical Ward (FMW)</option>
                    <option value="SRG">Surgical Ward (SRG)</option>
                    <option value="O&G">Obstetrics & Gynaecology (O&G)</option>
                    <option value="PED">Paediatric Ward (PED)</option>
                    <option value="ICU">Intensive Care Unit (ICU)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>BED NUMBER</label>
                  <input
                    type="text"
                    placeholder="e.g. Bed 07"
                    value={newPatient.bed}
                    onChange={e => setNewPatient({ ...newPatient, bed: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>PRIMARY DIAGNOSIS</label>
                <input
                  type="text"
                  placeholder="e.g. Severe Community Acquired Pneumonia"
                  value={newPatient.diagnoses}
                  onChange={e => setNewPatient({ ...newPatient, diagnoses: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94A8BE', marginBottom: 4 }}>KNOWN ALLERGIES (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa"
                  value={newPatient.allergies}
                  onChange={e => setNewPatient({ ...newPatient, allergies: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0A1929', border: '1px solid #1E446B', borderRadius: 8, color: '#0A2540', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAdmitModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: '#FFFFFF', border: '1px solid #1E446B', color: '#94A8BE', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 8, background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none', color: '#0A2540', fontWeight: 700, cursor: 'pointer' }}
                >
                  Complete Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
