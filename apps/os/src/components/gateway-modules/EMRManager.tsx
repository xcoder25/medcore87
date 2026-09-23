'use client';

import React, { useState } from 'react';
import { HospitalPatient, INITIAL_PATIENTS, INITIAL_CLINICAL_NOTES, ClinicalNoteItem } from '../../data/hospitalData';
import {
  FileText, User, HeartPulse, Pill, FlaskConical, Layers,
  AlertTriangle, Stethoscope, ChevronLeft, Calendar, ShieldCheck, Printer
} from 'lucide-react';

interface EMRManagerProps {
  initialPatientId?: string;
  onNavigate?: (module: string, param?: any) => void;
}

export const EMRManager: React.FC<EMRManagerProps> = ({ initialPatientId, onNavigate }) => {
  const [patients] = useState<HospitalPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || INITIAL_PATIENTS[0].id);
  const [activeTab, setActiveTab] = useState<'notes' | 'vitals' | 'labs' | 'meds' | 'allergies'>('notes');

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];
  const patientNotes = INITIAL_CLINICAL_NOTES.filter(n => n.patientId === selectedPatient.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, color: '#0A2540' }}>
      {/* Patient Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D223A 0%, #163A60 100%)',
        borderRadius: 14, padding: '20px 24px', border: '1px solid #1E446B',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%',
            background: selectedPatient.status === 'critical' ? 'linear-gradient(135deg, #EF4444, #B91C1C)' : 'linear-gradient(135deg, #1A6EB5, #00B4A6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem'
          }}>
            {selectedPatient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{selectedPatient.name}</h1>
              <span style={{ padding: '2px 8px', background: '#1A6EB5', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                {selectedPatient.mrn}
              </span>
              <span style={{ padding: '2px 8px', background: '#E2E8F0', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
                {selectedPatient.blood}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: '0.8rem', color: '#94A8BE', flexWrap: 'wrap' }}>
              <span>{selectedPatient.age} years • {selectedPatient.sex === 'F' ? 'Female' : 'Male'}</span>
              <span>•</span>
              <span>DOB: {selectedPatient.dob}</span>
              <span>•</span>
              <span style={{ color: '#0052D4', fontWeight: 600 }}>{selectedPatient.ward} Bed {selectedPatient.bed}</span>
              <span>•</span>
              <span>Attending: {selectedPatient.attending}</span>
            </div>
          </div>
        </div>

        {/* Patient Switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={selectedPatient.id}
            onChange={e => setSelectedPatientId(e.target.value)}
            style={{
              background: '#0A1929', border: '1px solid #1E446B', color: '#0A2540',
              borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, outline: 'none'
            }}
          >
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.ward})</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('consultations', { patientId: selectedPatient.id })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#00B4A6', color: '#0A2540', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Stethoscope size={15} /> New Consult
          </button>
        </div>
      </div>

      {/* Allergies Alert Banner (if any) */}
      {selectedPatient.allergies.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem'
        }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontWeight: 700, color: '#F87171' }}>ALLERGY ALERT:</span>
          <span style={{ color: '#FCA5A5' }}>
            Patient has documented adverse drug reactions to: <strong>{selectedPatient.allergies.join(', ')}</strong>. Verify all order entries!
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1E446B', paddingBottom: 6 }}>
        {[
          { key: 'notes', label: 'Clinical Encounters & Notes', icon: FileText, count: patientNotes.length },
          { key: 'vitals', label: 'Vitals & Observation Chart', icon: HeartPulse },
          { key: 'labs', label: 'Investigations & Diagnostic Results', icon: FlaskConical, count: 4 },
          { key: 'meds', label: 'Medication Profile & eMAR', icon: Pill, count: selectedPatient.medications.length },
          { key: 'allergies', label: 'Allergies & Risk Factors', icon: AlertTriangle },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: isActive ? '#1A6EB5' : 'transparent',
                color: isActive ? '#FFFFFF' : '#94A8BE',
              }}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '0.68rem', padding: '1px 6px', borderRadius: 999,
                  background: isActive ? 'rgba(255,255,255,0.2)' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#94A8BE'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ background: '#132F4C', border: '1px solid #1E446B', borderRadius: 12, padding: 20 }}>
        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {patientNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94A8BE' }}>
                No prior clinical encounters logged for this admission. Click "New Consult" above to document.
              </div>
            ) : (
              patientNotes.map(note => (
                <div
                  key={note.id}
                  style={{
                    background: '#0D223A', border: '1px solid #1E446B', borderRadius: 10, padding: 18,
                    display: 'flex', flexDirection: 'column', gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #FFFFFF', paddingBottom: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0052D4' }}>{note.title}</h3>
                      <div style={{ fontSize: '0.75rem', color: '#94A8BE', marginTop: 2 }}>
                        {note.type} • {note.date} at {note.time} • Recorded by <strong>{note.author}</strong>
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.15)',
                      color: '#10B981', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      <ShieldCheck size={13} /> Verified & Signed
                    </span>
                  </div>

                  {note.subjective && (
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                      <strong style={{ color: '#0052D4' }}>Subjective: </strong>
                      <span style={{ color: '#334155' }}>{note.subjective}</span>
                    </div>
                  )}

                  {note.objective && (
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                      <strong style={{ color: '#00B4A6' }}>Objective: </strong>
                      <span style={{ color: '#334155' }}>{note.objective}</span>
                    </div>
                  )}

                  {note.assessment && (
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                      <strong style={{ color: '#A78BFA' }}>Assessment: </strong>
                      <span style={{ color: '#334155' }}>{note.assessment}</span>
                    </div>
                  )}

                  {note.plan && (
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                      <strong style={{ color: '#F59E0B' }}>Plan: </strong>
                      <span style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{note.plan}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'vitals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0052D4' }}>
              Current Physiological Observations
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ background: '#0D223A', padding: 14, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94A8BE' }}>BLOOD PRESSURE</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#0A2540' }}>{selectedPatient.vitals.bp}</div>
                <div style={{ fontSize: '0.68rem', color: '#10B981', marginTop: 2 }}>Target: &lt; 130/80</div>
              </div>
              <div style={{ background: '#0D223A', padding: 14, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94A8BE' }}>HEART RATE (PULSE)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#0A2540' }}>{selectedPatient.vitals.pulse} bpm</div>
                <div style={{ fontSize: '0.68rem', color: '#94A8BE', marginTop: 2 }}>Sinus rhythm regular</div>
              </div>
              <div style={{ background: '#0D223A', padding: 14, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94A8BE' }}>OXYGEN SATURATION (SPO2)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: selectedPatient.vitals.spo2 < 94 ? '#EF4444' : '#10B981' }}>
                  {selectedPatient.vitals.spo2}%
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94A8BE', marginTop: 2 }}>Room air</div>
              </div>
              <div style={{ background: '#0D223A', padding: 14, borderRadius: 8, border: '1px solid #1E446B', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94A8BE' }}>TEMPERATURE</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4, color: '#0A2540' }}>{selectedPatient.vitals.temp}°C</div>
                <div style={{ fontSize: '0.68rem', color: '#94A8BE', marginTop: 2 }}>Normothermic</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'labs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#00B4A6' }}>
              Diagnostic Laboratory & Pathology Panel
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { test: 'Full Blood Count (FBC)', result: 'Hb: 12.4 g/dL | WBC: 7.2 ×10^9/L | Platelets: 245 ×10^9/L', status: 'Normal', date: '2026-09-17' },
                { test: 'Serum Electrolytes, Urea & Creatinine (E/U/Cr)', result: 'Na: 138 mmol/L | K: 4.1 mmol/L | Urea: 5.4 mmol/L | Cr: 88 umol/L', status: 'Normal', date: '2026-09-16' },
                { test: 'Fasting Blood Glucose (FBG)', result: '7.8 mmol/L (Reference: 3.9 – 5.6 mmol/L)', status: 'Elevated', date: '2026-09-18' },
                { test: 'Lipid Profile', result: 'Total Chol: 5.8 mmol/L | LDL: 3.4 mmol/L | HDL: 1.2 mmol/L | Trig: 1.8 mmol/L', status: 'Borderline', date: '2026-09-15' },
              ].map((lab, i) => (
                <div
                  key={i}
                  style={{
                    background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8, padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0A2540' }}>{lab.test}</div>
                    <div style={{ fontSize: '0.78rem', color: '#CBD5E1', marginTop: 3 }}>{lab.result}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                      background: lab.status === 'Elevated' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                      color: lab.status === 'Elevated' ? '#EF4444' : '#10B981'
                    }}>
                      {lab.status}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#94A8BE', marginTop: 3 }}>{lab.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'meds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0052D4' }}>
              Current Inpatient & Outpatient Medications
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedPatient.medications.map((med, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#0D223A', border: '1px solid #1E446B', borderRadius: 8, padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Pill size={16} color="#38BDF8" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0A2540' }}>{med}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94A8BE' }}>Prescribed by {selectedPatient.attending} • Formulated per AKS-EML</div>
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.2)', color: '#10B981', fontSize: '0.72rem', fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'allergies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#EF4444' }}>
              Clinical Allergies & Medical Contraindications
            </h3>

            {selectedPatient.allergies.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94A8BE' }}>
                No known drug allergies (NKDA) recorded for this patient.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedPatient.allergies.map((allergy, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12
                    }}
                  >
                    <AlertTriangle size={18} color="#EF4444" />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F87171' }}>{allergy}</div>
                      <div style={{ fontSize: '0.75rem', color: '#FCA5A5' }}>Severe hypersensitivity warning — Avoid all related compounds & beta-lactams</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
