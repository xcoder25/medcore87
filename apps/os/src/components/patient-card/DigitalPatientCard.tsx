'use client';

import React, { useState } from 'react';
import {
  FileText, Search, Download, Eye, CheckCircle2, AlertCircle,
  User, Calendar, Pill, QrCode, Shield, Sparkles, Printer,
  Share2, Heart, Activity, Check, Copy, ExternalLink
} from 'lucide-react';

interface PatientCard {
  id: string;
  nhiaNumber: string;
  nin: string;
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
    id: 'PT-001',
    nhiaNumber: 'AKSHIA-2024-0048219',
    nin: '7392-1048-2841',
    surname: 'Effiong',
    firstname: 'Uduak Grace',
    dob: '14 Mar 1982',
    sex: 'Female',
    bloodGroup: 'O+',
    genotype: 'AA',
    lga: 'Uyo',
    phone: '0803-555-4819',
    allergies: ['Penicillin G', 'Cephalosporins'],
    conditions: ['Hypertension (Stage 2)', 'Type 2 Diabetes Mellitus'],
    lastVisit: '12 Sep 2026',
    facility: 'Ibom Specialist Hospital, Uyo',
    medications: ['Amlodipine 10mg OD', 'Metformin 500mg BD', 'Lisinopril 5mg OD'],
    nhiaStatus: 'active',
  },
  {
    id: 'PT-002',
    nhiaNumber: 'AKSHIA-2023-0091742',
    nin: '6129-8402-9173',
    surname: 'Okonkwo',
    firstname: 'Chidi Emmanuel',
    dob: '08 Jul 1996',
    sex: 'Male',
    bloodGroup: 'B+',
    genotype: 'AS',
    lga: 'Ikot Ekpene',
    phone: '0805-555-1742',
    allergies: [],
    conditions: ['Sickle Cell Trait (Hb AS)'],
    lastVisit: '15 Sep 2026',
    facility: 'General Hospital, Ikot Ekpene',
    medications: ['Folic Acid 5mg OD', 'Multivitamin Tablet Daily'],
    nhiaStatus: 'active',
  },
  {
    id: 'PT-003',
    nhiaNumber: 'AKSHIA-2022-0014509',
    nin: '9034-7182-3940',
    surname: 'Bassey',
    firstname: 'Mary Imoh',
    dob: '22 Nov 1959',
    sex: 'Female',
    bloodGroup: 'A+',
    genotype: 'AA',
    lga: 'Eket',
    phone: '0701-555-4509',
    allergies: ['Sulfonamides', 'Aspirin'],
    conditions: ['Chronic Essential Hypertension', 'Bilateral Knee Osteoarthritis'],
    lastVisit: '03 Aug 2026',
    facility: 'General Hospital, Eket',
    medications: ['Lisinopril 10mg OD', 'Paracetamol 1g TDS (PRN)'],
    nhiaStatus: 'expired',
  },
  {
    id: 'PT-004',
    nhiaNumber: 'AKSHIA-2024-0078192',
    nin: '4820-1934-8821',
    surname: 'Akpan',
    firstname: 'Iniobong David',
    dob: '03 Jan 2001',
    sex: 'Male',
    bloodGroup: 'O+',
    genotype: 'AA',
    lga: 'Oron',
    phone: '0812-555-9201',
    allergies: ['NSAIDs'],
    conditions: ['Mild Intermittent Asthma'],
    lastVisit: '20 Sep 2026',
    facility: 'General Hospital, Irita, Oron',
    medications: ['Salbutamol Inhaler 200mcg PRN'],
    nhiaStatus: 'active',
  },
];

const NHIA_META = {
  active: { label: 'AKSHIA Active', bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' },
  expired: { label: 'Renewal Required', bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
  suspended: { label: 'Suspended', bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C' },
};

export const DigitalPatientCard: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PatientCard | null>(PATIENTS[0]);
  const [copiedId, setCopiedId] = useState(false);

  const filtered = PATIENTS.filter(p =>
    !search ||
    p.surname.toLowerCase().includes(search.toLowerCase()) ||
    p.firstname.toLowerCase().includes(search.toLowerCase()) ||
    p.nhiaNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.nin.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyCard = (num: string) => {
    navigator.clipboard?.writeText(num);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Search & Filter Ribbon ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 280 }} className="os-search-wrap">
          <Search size={16} style={{ color: '#0052D4' }} />
          <input
            className="os-search-input"
            placeholder="Search by Patient Name, National NIN, or AKSHIA State Health ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="figma-chip chip-blue">
            <Shield size={12} /> FHIR R4 & HL7 Verified
          </span>
          <span className="figma-chip chip-green">
            <CheckCircle2 size={12} /> National NIN Master Index
          </span>
        </div>
      </div>

      {/* ── Split Layout: Patient Directory + Interactive Digital Smart Card ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 460px', gap: 24, alignItems: 'start' }}>

        {/* Left Column: Registered Patients List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="os-section-header">
            <span className="os-section-title">
              Enrolled Health Card Holders ({filtered.length})
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
              Select a card to inspect smart-chip credentials
            </span>
          </div>

          {filtered.map(p => {
            const nhia = NHIA_META[p.nhiaStatus];
            const isSelected = selected?.id === p.id;

            return (
              <div
                key={p.id}
                className="os-card"
                onClick={() => setSelected(p)}
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? '#0052D4' : undefined,
                  boxShadow: isSelected ? '0 0 0 2px #0052D4, 0 8px 24px rgba(0, 82, 212, 0.12)' : undefined,
                  background: isSelected ? '#F8FAFF' : '#FFFFFF',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: isSelected
                        ? 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)'
                        : 'rgba(0, 82, 212, 0.08)',
                      color: isSelected ? '#FFFFFF' : '#0052D4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      flexShrink: 0,
                      boxShadow: isSelected ? '0 4px 12px rgba(0, 82, 212, 0.25)' : 'none'
                    }}
                  >
                    {p.firstname[0]}{p.surname[0]}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0F172A' }}>
                        {p.firstname} {p.surname}
                      </span>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: '#F1F5F9',
                        color: '#475569'
                      }}>
                        {p.sex} • {p.bloodGroup}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 3 }}>
                      DOB: {p.dob} • LGA: {p.lga} • {p.phone}
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>AKSHIA: <strong style={{ color: '#0052D4', fontFamily: 'var(--os-font-mono)' }}>{p.nhiaNumber}</strong></span>
                      <span>•</span>
                      <span>NIN: <span style={{ fontFamily: 'var(--os-font-mono)', color: '#475569' }}>{p.nin}</span></span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span
                    style={{
                      background: nhia.bg,
                      border: `1px solid ${nhia.border}`,
                      color: nhia.text,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 9999
                    }}
                  >
                    {nhia.label}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    Visit: {p.lastVisit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Physical Digital Smart Card Preview (Figma Polish) */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Smart Health Card Visual Container */}
            <div
              style={{
                width: '100%',
                borderRadius: 22,
                background: 'linear-gradient(135deg, #0A192F 0%, #0F2A4A 40%, #064E3B 100%)',
                color: '#FFFFFF',
                padding: '24px 26px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 48px -10px rgba(10, 25, 47, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              {/* Background Holographic Grid Lines */}
              <div style={{
                position: 'absolute',
                top: 0, right: 0, bottom: 0, left: 0,
                backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(0, 191, 165, 0.15) 0%, transparent 60%)',
                pointerEvents: 'none'
              }} />

              {/* Card Header: State Emblem & Identity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                <div>
                  <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em', color: '#FB923C', textTransform: 'uppercase' }}>
                    Federal Republic of Nigeria
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 900, fontFamily: 'var(--os-font-heading)', color: '#FFFFFF', letterSpacing: '0.02em', marginTop: 1 }}>
                    Akwa Ibom State Health Insurance Agency
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
                    AKSHIA Digital Biometric Smart Card
                  </div>
                </div>

                {/* Holographic Chip Graphic */}
                <div style={{
                  width: 44,
                  height: 34,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                  <div style={{ width: '70%', height: '60%', border: '1px solid rgba(0,0,0,0.25)', borderRadius: 3 }} />
                </div>
              </div>

              {/* Middle: Patient Name & Details */}
              <div style={{ margin: '22px 0 18px', position: 'relative', zIndex: 2 }}>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Enrollee Name
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.01em', fontFamily: 'var(--os-font-heading)', textTransform: 'uppercase' }}>
                  {selected.firstname} {selected.surname}
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Gender</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F1F5F9' }}>{selected.sex}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Date of Birth</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F1F5F9' }}>{selected.dob}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Blood / Genotype</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38BDF8' }}>{selected.bloodGroup} • {selected.genotype}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>LGA</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F1F5F9' }}>{selected.lga}</div>
                  </div>
                </div>
              </div>

              {/* Bottom: Card Number & QR Code */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                paddingTop: 14,
                position: 'relative',
                zIndex: 2
              }}>
                <div>
                  <div style={{ fontSize: '0.66rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    AKSHIA Identification Number
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontFamily: 'var(--os-font-mono)',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#38BDF8',
                    marginTop: 2
                  }}>
                    {selected.nhiaNumber}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#CBD5E1', marginTop: 2 }}>
                    NIN: {selected.nin}
                  </div>
                </div>

                <div style={{
                  background: '#FFFFFF',
                  padding: 5,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <QrCode size={42} style={{ color: '#0A192F' }} />
                </div>
              </div>
            </div>

            {/* Smart Card Action Controls */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => handleCopyCard(selected.nhiaNumber)}
              >
                {copiedId ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
                <span>{copiedId ? 'Copied Number!' : 'Copy AKSHIA ID'}</span>
              </button>

              <button
                type="button"
                className="os-action-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>Print Physical Card</span>
              </button>
            </div>

            {/* Clinical & Enrolment Data Inspector */}
            <div className="os-card" style={{ padding: 20 }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Clinical Baseline & Enrolment Profile
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                    Primary Registered Facility
                  </span>
                  <div style={{ fontSize: '0.86rem', color: '#0F172A', fontWeight: 600, marginTop: 2 }}>
                    {selected.facility}
                  </div>
                </div>

                {selected.allergies.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 800, textTransform: 'uppercase' }}>
                      ⚠ Documented Allergies
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {selected.allergies.map(a => (
                        <span key={a} className="figma-chip chip-rose">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 800, textTransform: 'uppercase' }}>
                    Chronic Conditions
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {selected.conditions.map(c => (
                      <span key={c} className="figma-chip chip-amber">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>
                    Active Prescriptions
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    {selected.medications.map(m => (
                      <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#334155' }}>
                        <Pill size={13} style={{ color: '#00BFA5' }} /> {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
