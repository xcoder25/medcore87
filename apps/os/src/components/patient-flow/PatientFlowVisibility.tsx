'use client';
import React, { useState } from 'react';
import { Users, ArrowRight, Clock, CheckCircle2, AlertCircle, Plus, Search } from 'lucide-react';

type FlowStage = 'triage' | 'assessment' | 'admitted' | 'transfer' | 'discharged';

interface Patient {
  id: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  stage: FlowStage;
  priority: 'red' | 'yellow' | 'green';
  complaint: string;
  time: string;
  ward?: string;
  doctor?: string;
  nhiaStatus?: 'covered' | 'self-pay' | 'pending';
}

const PATIENTS: Patient[] = [
  { id: 'PT-4891', name: 'Uduak Essen', age: 42, sex: 'F', stage: 'triage', priority: 'red', complaint: 'Chest pain, shortness of breath', time: '09:02', nhiaStatus: 'covered' },
  { id: 'PT-4890', name: 'Chidi Okonkwo', age: 28, sex: 'M', stage: 'triage', priority: 'yellow', complaint: 'High fever, convulsions', time: '08:58', nhiaStatus: 'self-pay' },
  { id: 'PT-4889', name: 'Mary Bassey', age: 67, sex: 'F', stage: 'triage', priority: 'red', complaint: 'Altered consciousness, BP 90/60', time: '08:44', nhiaStatus: 'pending' },
  { id: 'PT-4888', name: 'Ekpenyong Sunday', age: 5, sex: 'M', stage: 'assessment', priority: 'yellow', complaint: 'Severe malaria, vomiting', time: '08:30', doctor: 'Dr. Nwachukwu', nhiaStatus: 'covered' },
  { id: 'PT-4887', name: 'Imaobong Etim', age: 31, sex: 'F', stage: 'assessment', priority: 'green', complaint: 'Labour pains — 39 weeks', time: '08:15', doctor: 'Dr. Bassey', nhiaStatus: 'covered' },
  { id: 'PT-4886', name: 'Obong Udofia', age: 54, sex: 'M', stage: 'admitted', priority: 'yellow', complaint: 'Hypertensive crisis', time: '07:50', ward: 'Male Medical', doctor: 'Dr. Ekpo', nhiaStatus: 'pending' },
  { id: 'PT-4885', name: 'Akon Effiong', age: 19, sex: 'F', stage: 'admitted', priority: 'green', complaint: 'Appendicitis — post-op', time: '07:40', ward: 'Surgical', doctor: 'Dr. Okafor', nhiaStatus: 'self-pay' },
  { id: 'PT-4884', name: 'Samuel Nwodo', age: 61, sex: 'M', stage: 'transfer', priority: 'red', complaint: 'Acute MI — referred to UUTH', time: '07:20', doctor: 'Dr. Okafor', nhiaStatus: 'covered' },
  { id: 'PT-4883', name: 'Ntiense Akpan', age: 44, sex: 'F', stage: 'discharged', priority: 'green', complaint: 'Stable malaria — completed treatment', time: '06:45', ward: 'Female Medical', nhiaStatus: 'covered' },
  { id: 'PT-4882', name: 'Ini Nkanga', age: 33, sex: 'M', stage: 'discharged', priority: 'green', complaint: 'Peptic ulcer — reviewed', time: '06:30', doctor: 'Dr. Bassey', nhiaStatus: 'pending' },
];

const STAGES: { key: FlowStage; label: string; color: string }[] = [
  { key: 'triage', label: 'Triage', color: '#EF4444' },
  { key: 'assessment', label: 'Clinical Assessment', color: '#F59E0B' },
  { key: 'admitted', label: 'Admitted', color: '#22C55E' },
  { key: 'transfer', label: 'Transfer / Referral', color: '#A855F7' },
  { key: 'discharged', label: 'Discharged Today', color: '#64748B' },
];

const PRIORITY_META = {
  red: { label: 'P1 — Immediate', color: '#EF4444' },
  yellow: { label: 'P2 — Urgent', color: '#F59E0B' },
  green: { label: 'P3 — Non-urgent', color: '#22C55E' },
};

const NHIA_META = {
  covered: { label: 'AKSHIA', color: '#22C55E' },
  'self-pay': { label: 'Self-Pay', color: '#F59E0B' },
  pending: { label: 'Pending', color: '#94A3B8' },
};

export const PatientFlowVisibility: React.FC = () => {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<FlowStage | 'all'>('all');

  const filtered = PATIENTS.filter(p => {
    if (stageFilter !== 'all' && p.stage !== stageFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stage Stats */}
      <div className="os-metrics-ribbon">
        {STAGES.map(stage => {
          const count = PATIENTS.filter(p => p.stage === stage.key).length;
          return (
            <div key={stage.key} className="metric-box" style={{ cursor: 'pointer', borderColor: stageFilter === stage.key ? stage.color : undefined }}
              onClick={() => setStageFilter(stageFilter === stage.key ? 'all' : stage.key)}>
              <span className="metric-label">{stage.label}</span>
              <span className="metric-val" style={{ color: stage.color }}>{count}</span>
              <span className="metric-sub">patients</span>
            </div>
          );
        })}
      </div>

      {/* Flow Pipeline Visual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,27,46,0.6)', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 20px', overflowX: 'auto' }}>
        {STAGES.map((stage, idx) => (
          <React.Fragment key={stage.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 90 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${stage.color}20`, border: `2px solid ${stage.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, color: stage.color }}>
                {PATIENTS.filter(p => p.stage === stage.key).length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>{stage.label}</div>
            </div>
            {idx < STAGES.length - 1 && <ArrowRight size={16} style={{ color: '#334155', flexShrink: 0 }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="os-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input className="os-search-input" placeholder="Search patient name or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="os-action-btn-primary"><Plus size={14} /> New Admission</button>
      </div>

      {/* Patient Table */}
      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Name</th>
              <th>Age/Sex</th>
              <th>Priority</th>
              <th>Complaint</th>
              <th>Stage</th>
              <th>Ward/Doctor</th>
              <th>NHIA</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const stage = STAGES.find(s => s.key === p.stage)!;
              const pMeta = PRIORITY_META[p.priority];
              const nhia = NHIA_META[p.nhiaStatus || 'pending'];
              return (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#94A3B8' }}>{p.id}</td>
                  <td style={{ fontWeight: 600, color: '#0A2540' }}>{p.name}</td>
                  <td style={{ color: '#94A3B8' }}>{p.age}y {p.sex}</td>
                  <td><span style={{ background: `${pMeta.color}20`, color: pMeta.color, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{pMeta.label}</span></td>
                  <td style={{ color: '#CBD5E1', fontSize: '0.83rem', maxWidth: 180 }}>{p.complaint}</td>
                  <td><span style={{ background: `${stage.color}20`, color: stage.color, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{stage.label}</span></td>
                  <td style={{ color: '#94A3B8', fontSize: '0.82rem' }}>{p.ward || p.doctor || '—'}</td>
                  <td><span style={{ color: nhia.color, fontSize: '0.78rem', fontWeight: 600 }}>{nhia.label}</span></td>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#64748B' }}>{p.time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
