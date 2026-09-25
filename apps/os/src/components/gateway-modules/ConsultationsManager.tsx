'use client';

import React, { useState } from 'react';
import { HospitalPatient, INITIAL_PATIENTS, INITIAL_CLINICAL_NOTES, ClinicalNoteItem } from '../../data/hospitalData';
import { searchEml, EmlMedication } from '../../data/emlFormulary';
import {
  Stethoscope, Search, User, FileText, Pill, CheckCircle2,
  AlertTriangle, Save, Trash2, Check, ShieldCheck, Clock, Plus, X
} from 'lucide-react';

interface ConsultationsManagerProps {
  initialPatientId?: string;
  onNavigate?: (module: string, param?: any) => void;
}

interface PrescriptionEntry {
  drug: string;
  strength: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export const ConsultationsManager: React.FC<ConsultationsManagerProps> = ({ initialPatientId, onNavigate }) => {
  const [patients] = useState<HospitalPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || INITIAL_PATIENTS[0]?.id || '');
  const [patientSearch, setPatientSearch] = useState('');
  const [noteType, setNoteType] = useState('SOAP Note');
  const [soapTab, setSoapTab] = useState<'s' | 'o' | 'a' | 'p'>('s');
  const [notesHistory, setNotesHistory] = useState<ClinicalNoteItem[]>(INITIAL_CLINICAL_NOTES);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // SOAP fields
  const [subjective, setSubjective] = useState('Patient presents with mild dizziness on standing for 3 days. Occasional morning headaches. Denies chest pain, palpitation or shortness of breath.');
  const [objective, setObjective] = useState('BP 128/84 mmHg, HR 78 bpm regular. Heart sounds S1, S2 present, no murmurs. Bilateral breath sounds vesicular. Abdomen soft, non-tender. Mild ankle oedema (+1).');
  const [assessment, setAssessment] = useState('1. Essential Hypertension — controlled on current CCB.\n2. Type 2 Diabetes Mellitus — titrating oral hypoglycemics.');
  const [planGeneral, setPlanGeneral] = useState('1. Fasting lipid profile and serum creatinine at next visit.\n2. Dietary counselling: low sodium and carbohydrate control.\n3. Return to clinic in 4 weeks.');

  // EML Prescribing
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([
    { drug: 'Amlodipine', strength: '5 mg', route: 'Oral', frequency: 'OD (Once Daily)', duration: '30 Days', instructions: 'Take in the morning' },
    { drug: 'Metformin', strength: '500 mg', route: 'Oral', frequency: 'BD (Twice Daily)', duration: '30 Days', instructions: 'Take with or after meals' },
  ]);

  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [showDrugDropdown, setShowDrugDropdown] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];
  const emlSuggestions = searchEml(drugSearchQuery);

  const handleAddDrug = (med: EmlMedication) => {
    const newEntry: PrescriptionEntry = {
      drug: med.name,
      strength: med.strengths[0] || 'Standard',
      route: med.routes[0] || 'Oral',
      frequency: 'OD (Once Daily)',
      duration: '14 Days',
      instructions: med.notes || 'Take as directed',
    };
    setPrescriptions([...prescriptions, newEntry]);
    setDrugSearchQuery('');
    setShowDrugDropdown(false);
  };

  const handleRemoveDrug = (index: number) => {
    setPrescriptions(prescriptions.filter((_, idx) => idx !== index));
  };

  const handleSignAndSave = () => {
    const newNote: ClinicalNoteItem = {
      id: `CN-${Date.now().toString().slice(-4)}`,
      patientId: selectedPatient.id,
      title: `${noteType} — ${selectedPatient.name}`,
      type: noteType,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      author: 'Dr. Adewale Bello (Consultant Physician)',
      content: `${subjective.slice(0, 100)}...`,
      subjective,
      objective,
      assessment,
      plan: `${planGeneral}\n\nPrescriptions:\n${prescriptions.map(p => `• ${p.drug} ${p.strength} (${p.route}) ${p.frequency} × ${p.duration}`).join('\n')}`,
    };

    setNotesHistory([newNote, ...notesHistory]);
    setSaveSuccessMsg(`Encounter note signed & sealed for ${selectedPatient.name}! Saved to EMR.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const filteredPatientList = patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.mrn.toLowerCase().includes(patientSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Toast */}
      {saveSuccessMsg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#0D223A', color: '#10B981', border: '1px solid #10B981',
          borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', fontWeight: 700, fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '16px 22px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stethoscope size={24} color="#1A6EB5" />
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Clinical Consultations & SOAP Encounter</h1>
          </div>
          <p style={{ margin: '3px 0 0', color: '#94A8BE', fontSize: '0.82rem' }}>
            Structured medical assessment, ICD-10 diagnosis documentation & AKS-EML compliant prescribing
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('patients')}
            style={{
              background: '#FFFFFF', border: '1px solid #1E446B',
              color: '#0A2540', padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            ← Back to Patient List
          </button>
        </div>
      </div>

      {/* Main Grid: Left Patient Selector & History, Right SOAP Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Patient Selector Card */}
          <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0052D4', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={15} /> Select Active Patient
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0A1929', padding: '6px 10px', borderRadius: 6, border: '1px solid #1E446B', marginBottom: 10 }}>
              <Search size={14} color="#94A8BE" />
              <input
                type="text"
                placeholder="Search patient..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredPatientList.map(p => {
                const isSelected = p.id === selectedPatient.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(26,110,181,0.3)' : 'transparent',
                      border: isSelected ? '1px solid #1A6EB5' : '1px solid transparent',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: '#1A6EB5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700
                    }}>
                      {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94A8BE' }}>{p.ward} • {p.mrn}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clinical Notes History */}
          <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00B4A6', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} /> Recent Encounters
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notesHistory.map(note => (
                <div
                  key={note.id}
                  style={{
                    background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8, padding: 10, fontSize: '0.78rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0A2540', marginBottom: 2 }}>{note.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94A8BE', marginBottom: 4 }}>{note.type} • {note.date} {note.time}</div>
                  <div style={{ color: '#CBD5E1', fontSize: '0.75rem', lineHeight: 1.4 }}>{note.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: SOAP Encounter Workspace */}
        <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Active Patient Banner & Note Type */}
          <div style={{
            background: '#0D223A', padding: '14px 18px', borderBottom: '1px solid #1E446B',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0A2540' }}>{selectedPatient.name}</span>
                <span style={{ padding: '2px 6px', background: '#1A6EB5', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                  {selectedPatient.mrn}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94A8BE' }}>
                  {selectedPatient.age}y / {selectedPatient.sex} • {selectedPatient.ward} Bed {selectedPatient.bed}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#CBD5E1', marginTop: 3 }}>
                Vitals: BP {selectedPatient.vitals.bp} | HR {selectedPatient.vitals.pulse} bpm | SpO2 {selectedPatient.vitals.spo2}% | Temp {selectedPatient.vitals.temp}°C
              </div>
            </div>

            <select
              value={noteType}
              onChange={e => setNoteType(e.target.value)}
              style={{
                background: '#0A1929', border: '1px solid #1E446B', color: '#0A2540',
                borderRadius: 8, padding: '7px 12px', fontSize: '0.8rem', fontWeight: 600, outline: 'none'
              }}
            >
              <option>SOAP Note</option>
              <option>Progress Note</option>
              <option>Admission Encounter</option>
              <option>Ward Round Note</option>
              <option>Specialist Consult</option>
              <option>Discharge Summary</option>
            </select>
          </div>

          {/* SOAP Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1E446B', background: 'rgba(10,25,41,0.5)' }}>
            {[
              { key: 's', label: 'S — Subjective', desc: 'Symptoms & History' },
              { key: 'o', label: 'O — Objective', desc: 'Vitals & Exam' },
              { key: 'a', label: 'A — Assessment', desc: 'Diagnoses & ICD' },
              { key: 'p', label: 'P — Plan', desc: 'Treatment & AKS-EML' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSoapTab(tab.key as any)}
                style={{
                  flex: 1, padding: '12px 14px', border: 'none', cursor: 'pointer',
                  borderBottom: soapTab === tab.key ? '3px solid #1A6EB5' : '3px solid transparent',
                  background: soapTab === tab.key ? '#132F4C' : 'transparent',
                  color: soapTab === tab.key ? '#FFFFFF' : '#94A8BE',
                  fontWeight: 700, fontSize: '0.82rem', textAlign: 'center'
                }}
              >
                <div>{tab.label}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: 2, fontWeight: 400 }}>{tab.desc}</div>
              </button>
            ))}
          </div>

          {/* SOAP Content Body */}
          <div style={{ padding: 18, flex: 1, minHeight: 320 }}>
            {soapTab === 's' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0052D4' }}>
                  SUBJECTIVE: CHIEF COMPLAINT & HISTORY OF PRESENT ILLNESS (HPI)
                </label>
                <textarea
                  value={subjective}
                  onChange={e => setSubjective(e.target.value)}
                  rows={10}
                  placeholder="Document the patient's reported symptoms, onset, duration, review of systems, functional status..."
                  style={{
                    width: '100%', background: '#0A1929', border: '1px solid #1E446B',
                    borderRadius: 8, padding: 14, color: '#0A2540', fontSize: '0.85rem', lineHeight: 1.6, outline: 'none'
                  }}
                />
              </div>
            )}

            {soapTab === 'o' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00B4A6' }}>
                  OBJECTIVE: PHYSICAL EXAMINATION & CURRENT CLINICAL FINDINGS
                </label>
                <textarea
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  rows={10}
                  placeholder="Document physical exam findings, general appearance, cardiovascular, respiratory, abdominal, neurological systems..."
                  style={{
                    width: '100%', background: '#0A1929', border: '1px solid #1E446B',
                    borderRadius: 8, padding: 14, color: '#0A2540', fontSize: '0.85rem', lineHeight: 1.6, outline: 'none'
                  }}
                />
              </div>
            )}

            {soapTab === 'a' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#A78BFA' }}>
                  ASSESSMENT: WORKING DIAGNOSES, DIFFERENTIALS & CLINICAL IMPRESSION
                </label>
                <textarea
                  value={assessment}
                  onChange={e => setAssessment(e.target.value)}
                  rows={10}
                  placeholder="List active clinical diagnoses, problem list, ICD-10 codes, differential diagnoses..."
                  style={{
                    width: '100%', background: '#0A1929', border: '1px solid #1E446B',
                    borderRadius: 8, padding: 14, color: '#0A2540', fontSize: '0.85rem', lineHeight: 1.6, outline: 'none'
                  }}
                />
              </div>
            )}

            {soapTab === 'p' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* General Plan */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F59E0B', display: 'block', marginBottom: 6 }}>
                    PLAN: INVESTIGATIONS, MONITORING & DISPOSITION
                  </label>
                  <textarea
                    value={planGeneral}
                    onChange={e => setPlanGeneral(e.target.value)}
                    rows={4}
                    placeholder="Document laboratory orders, imaging requests, nurse monitoring frequency, fluid orders..."
                    style={{
                      width: '100%', background: '#0A1929', border: '1px solid #1E446B',
                      borderRadius: 8, padding: 12, color: '#0A2540', fontSize: '0.85rem', lineHeight: 1.5, outline: 'none'
                    }}
                  />
                </div>

                {/* EML Formulary Prescriptions Generator */}
                <div style={{ background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#0052D4' }}>
                      <Pill size={15} /> Akwa Ibom State EML e-Prescriptions
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94A8BE' }}>AKS-EML 3rd Edition 2026</span>
                  </div>

                  {/* Search for Drug */}
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0A1929', padding: '8px 12px', borderRadius: 6, border: '1px solid #1E446B' }}>
                      <Search size={14} color="#94A8BE" />
                      <input
                        type="text"
                        placeholder="Search Essential Medicines (e.g. Co-amoxiclav, Metformin, Amlodipine, Meropenem)..."
                        value={drugSearchQuery}
                        onChange={e => {
                          setDrugSearchQuery(e.target.value);
                          setShowDrugDropdown(true);
                        }}
                        onFocus={() => setShowDrugDropdown(true)}
                        style={{ background: 'transparent', border: 'none', color: '#0A2540', outline: 'none', width: '100%', fontSize: '0.82rem' }}
                      />
                    </div>

                    {showDrugDropdown && emlSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8,
                        marginTop: 4, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                      }}>
                        {emlSuggestions.map(med => (
                          <div
                            key={med.id}
                            onClick={() => handleAddDrug(med)}
                            style={{
                              padding: '8px 12px', borderBottom: '1px solid #FFFFFF',
                              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#1A6EB5')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{med.name}</div>
                              <div style={{ fontSize: '0.7rem', color: '#94A8BE' }}>{med.category} • {med.forms.join(', ')}</div>
                            </div>
                            {med.aware && (
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                background: med.aware === 'Access' ? 'rgba(16,185,129,0.2)' : med.aware === 'Watch' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                color: med.aware === 'Access' ? '#10B981' : med.aware === 'Watch' ? '#F59E0B' : '#EF4444'
                              }}>
                                {med.aware}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Prescribed Items Table */}
                  {prescriptions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#94A8BE', fontSize: '0.8rem' }}>
                      No medications added yet. Search the formulary above to add.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {prescriptions.map((rx, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, background: '#0A1929',
                            padding: '8px 12px', borderRadius: 6, border: '1px solid #1E446B', fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ flex: 1.5, fontWeight: 700, color: '#0052D4' }}>{rx.drug}</div>
                          <div style={{ flex: 1, color: '#334155' }}>{rx.strength}</div>
                          <div style={{ flex: 1, color: '#94A8BE' }}>{rx.route}</div>
                          <div style={{ flex: 1.2, color: '#10B981', fontWeight: 600 }}>{rx.frequency}</div>
                          <div style={{ flex: 1, color: '#F59E0B' }}>{rx.duration}</div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDrug(idx)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div style={{
            background: '#0D223A', padding: '14px 18px', borderTop: '1px solid #1E446B',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#94A8BE' }}>
              <ShieldCheck size={16} color="#00B4A6" />
              <span>Digital clinical signature attached: <strong>Dr. Adewale Bello (MDCN/R/83421)</strong></span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setSubjective('');
                  setObjective('');
                  setAssessment('');
                  setPlanGeneral('');
                  setPrescriptions([]);
                }}
                style={{
                  background: '#FFFFFF', border: '1px solid #1E446B',
                  color: '#94A8BE', padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Clear Note
              </button>
              <button
                type="button"
                onClick={handleSignAndSave}
                style={{
                  background: 'linear-gradient(135deg, #1A6EB5, #00B4A6)', border: 'none',
                  color: '#0A2540', padding: '8px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Check size={16} /> Sign & Seal Encounter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
