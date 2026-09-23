'use client';
import React, { useState } from 'react';
import { FileText, Search, Download, Eye, CheckCircle2, AlertCircle, User, Calendar, Pill } from 'lucide-react';

interface PatientCard {
  id: string;
  nhiaNumber: string;
  surname: string;
  firstname: string;
  dob: string;
  sex: 'Male' | 'Female';
  bloodGroup: string;
  genotype: string;
  lga: string;
  phone: string;
  allergies: string[];
  conditions: string[];
  lastVisit: string;
  facility: string;
  medications: string[];
  nhiaStatus: 'active' | 'expired' | 'suspended';
}

const PATIENTS: PatientCard[] = [
  {
    id: 'PT-001', nhiaNumber: 'AKSHIA-2024-0048219', surname: 'Effiong', firstname: 'Uduak Grace',
    dob: '14 Mar 1982', sex: 'Female', bloodGroup: 'O+', genotype: 'AA', lga: 'Uyo',
    phone: '0803-XXX-4819', allergies: ['Penicillin'], conditions: ['Hypertension', 'Type 2 Diabetes'],
    lastVisit: '12 Sep 2026', facility: 'Ibom Specialist Hospital, Uyo',
    medications: ['Amlodipine 10mg OD', 'Metformin 500mg BD'], nhiaStatus: 'active',
  },
  {
    id: 'PT-002', nhiaNumber: 'AKSHIA-2023-0091742', surname: 'Okonkwo', firstname: 'Chidi Emmanuel',
    dob: '08 Jul 1996', sex: 'Male', bloodGroup: 'B+', genotype: 'AS', lga: 'Ikot Ekpene',
    phone: '0805-XXX-1742', allergies: [], conditions: ['Sickle Cell Trait'],
    lastVisit: '15 Sep 2026', facility: 'General Hospital, Ikot Ekpene',
    medications: ['Folic Acid 5mg OD'], nhiaStatus: 'active',
  },
  {
    id: 'PT-003', nhiaNumber: 'AKSHIA-2022-0014509', surname: 'Bassey', firstname: 'Mary Imoh',
    dob: '22 Nov 1959', sex: 'Female', bloodGroup: 'A+', genotype: 'AA', lga: 'Eket',
    phone: '0701-XXX-4509', allergies: ['Sulfonamides', 'Aspirin'], conditions: ['Chronic Hypertension', 'Osteoarthritis'],
    lastVisit: '03 Aug 2026', facility: 'General Hospital, Eket',
    medications: ['Lisinopril 10mg OD', 'Diclofenac 50mg BD (PRN)'], nhiaStatus: 'expired',
  },
];

const NHIA_META = {
  active: { label: 'Active', color: '#22C55E' },
  expired: { label: 'Expired', color: '#EF4444' },
  suspended: { label: 'Suspended', color: '#F59E0B' },
};

export const DigitalPatientCard: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PatientCard | null>(null);

  const filtered = PATIENTS.filter(p =>
    !search ||
    p.surname.toLowerCase().includes(search.toLowerCase()) ||
    p.firstname.toLowerCase().includes(search.toLowerCase()) ||
    p.nhiaNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="os-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input className="os-search-input" placeholder="Search by patient name, ID, or AKSHIA number..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span style={{ fontSize: '0.78rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '6px 12px', borderRadius: 8, color: '#60A5FA', fontWeight: 600 }}>
          FHIR R4 Compliant
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>

        {/* Patient List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const nhia = NHIA_META[p.nhiaStatus];
            const isSelected = selected?.id === p.id;
            return (
              <div key={p.id} className="os-card" onClick={() => setSelected(isSelected ? null : p)}
                style={{ cursor: 'pointer', borderColor: isSelected ? '#EA580C' : undefined, background: isSelected ? 'rgba(234,88,12,0.07)' : undefined, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(234,88,12,0.15)', color: '#FB923C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, flexShrink: 0 }}>
                      {p.firstname[0]}{p.surname[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '1rem' }}>{p.firstname} {p.surname}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                        {p.sex} • DOB: {p.dob} • {p.lga} LGA
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 4 }}>
                        AKSHIA: <span style={{ fontFamily: 'var(--os-font-mono)', color: '#60A5FA' }}>{p.nhiaNumber}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ background: `${nhia.color}20`, color: nhia.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 9999 }}>{nhia.label}</span>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Last visit: {p.lastVisit}</div>
                  </div>
                </div>
                {p.conditions.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {p.conditions.map(c => (
                      <span key={c} style={{ background: 'rgba(234,88,12,0.1)', color: '#FB923C', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 9999, border: '1px solid rgba(234,88,12,0.2)' }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail Card */}
        {selected && (
          <div className="os-card" style={{ padding: 24, alignSelf: 'flex-start', borderColor: '#EA580C' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Digital Health Card</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="os-ghost-btn" style={{ padding: '6px 10px' }}><Download size={14} /></button>
                <button className="os-ghost-btn" style={{ padding: '6px 10px' }} onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Full Name', value: `${selected.firstname} ${selected.surname}` },
                  { label: 'Date of Birth', value: selected.dob },
                  { label: 'Sex', value: selected.sex },
                  { label: 'LGA of Origin', value: selected.lga },
                  { label: 'Blood Group', value: selected.bloodGroup },
                  { label: 'Genotype', value: selected.genotype },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: '0.88rem', color: '#0A2540', fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #FFFFFF', paddingTop: 12 }}>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 6 }}>REGISTERED FACILITY</div>
                <div style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>{selected.facility}</div>
              </div>

              {selected.allergies.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#EF4444', marginBottom: 6, fontWeight: 700 }}>⚠ KNOWN ALLERGIES</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.allergies.map(a => <span key={a} style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', fontSize: '0.78rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 600 }}>{a}</span>)}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 6 }}>CHRONIC CONDITIONS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.conditions.map(c => <span key={c} style={{ background: 'rgba(234,88,12,0.12)', color: '#FB923C', fontSize: '0.78rem', padding: '3px 10px', borderRadius: 9999 }}>{c}</span>)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 6 }}>CURRENT MEDICATIONS</div>
                {selected.medications.map(m => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#CBD5E1', marginBottom: 4 }}>
                    <Pill size={12} style={{ color: '#22C55E' }} />{m}
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: '0.7rem', color: '#60A5FA', fontWeight: 700, marginBottom: 4 }}>AKSHIA ENROLMENT STATUS</div>
                <div style={{ fontSize: '0.88rem', color: '#0A2540', fontWeight: 600 }}>{selected.nhiaNumber}</div>
                <div style={{ fontSize: '0.75rem', color: NHIA_META[selected.nhiaStatus].color, marginTop: 4, fontWeight: 600 }}>{NHIA_META[selected.nhiaStatus].label}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
