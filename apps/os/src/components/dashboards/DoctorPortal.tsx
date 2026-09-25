'use client';

import React, { useState, useEffect } from 'react';
import { UserSession } from '../auth/AuthScreen';
import { EMRManager } from '../gateway-modules/EMRManager';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import {
  LayoutDashboard, Users, FileText, Stethoscope, Pill, FlaskConical, Layers,
  BedDouble, Calendar, Bell, Settings, ClipboardList, Send, AlertTriangle,
  Search, Plus, Clock, CheckCircle2, Activity, Heart,
  Brain, TrendingUp, BarChart3, ArrowRight,
  MessageSquare, UserPlus, Siren, Clipboard,
  ChevronDown, ChevronUp, Save, X, Check,
  AlertCircle, LogOut, Menu, Printer,
  FileCheck, ShieldCheck, HeartPulse,
  ChevronsRight, LifeBuoy, UserCheck, ExternalLink
} from 'lucide-react';

interface DoctorPortalProps {
  session: UserSession;
  onNavigate: (moduleKey: any) => void;
}

type SubModule =
  | 'dashboard' | 'patients' | 'consultation' | 'emr'
  | 'prescriptions' | 'lab-orders' | 'radiology-orders'
  | 'ward-round' | 'appointments' | 'referrals' | 'tasks'
  | 'messages' | 'admission' | 'analytics' | 'settings';

interface Patient {
  id: string; name: string; age: number; gender: 'M' | 'F';
  ward: string; bed?: string; diagnosis: string;
  status: 'inpatient' | 'outpatient' | 'critical' | 'discharged' | 'pending';
  nextAction: string; vitals: { bp: string; hr: number; temp: number; spo2: number; rr: number };
  admitDate: string; flags: string[];
}

interface Appointment {
  id: string; patientName: string; patientId: string; time: string; type: string;
  status: 'scheduled' | 'waiting' | 'in-progress' | 'done' | 'no-show';
}

interface Task {
  id: string; title: string; patient?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  due: string; done: boolean; type: 'clinical' | 'admin' | 'review';
}

// -- Mock Data ------------------------------------------------------------------

const PATIENTS: Patient[] = [
  {
    id: 'MRN-004821', name: 'Adaobi Nwosu', age: 45, gender: 'F', ward: 'Medical Ward', bed: 'B4-12',
    diagnosis: 'Type 2 DM + Hypertension', status: 'inpatient', nextAction: 'Review fasting BGL result',
    admitDate: '2026-09-15', vitals: { bp: '148/92', hr: 88, temp: 37.2, spo2: 97, rr: 18 },
    flags: ['High BP', 'Diabetic'],
  },
  {
    id: 'MRN-005103', name: 'Emeka Eze', age: 62, gender: 'M', ward: 'ICU', bed: 'ICU-03',
    diagnosis: 'Acute MI � Post-PCI Day 2', status: 'critical', nextAction: 'Cardiology review + Echo',
    admitDate: '2026-09-17', vitals: { bp: '102/60', hr: 112, temp: 37.8, spo2: 93, rr: 24 },
    flags: ['CRITICAL', 'Cardiac Monitor', 'NPO'],
  },
  {
    id: 'MRN-003990', name: 'Fatima Al-Hassan', age: 33, gender: 'F', ward: 'Gynaecology', bed: 'G2-05',
    diagnosis: 'Pelvic Inflammatory Disease', status: 'inpatient', nextAction: 'Ultrasound review pending',
    admitDate: '2026-09-16', vitals: { bp: '118/76', hr: 92, temp: 38.4, spo2: 98, rr: 20 },
    flags: ['Febrile', 'IV Antibiotics'],
  },
  {
    id: 'MRN-006417', name: 'Chukwudi Obi', age: 28, gender: 'M', ward: 'OPD - Clinic 3', bed: undefined,
    diagnosis: 'Malaria + Dehydration (suspected)', status: 'outpatient', nextAction: 'Await RDT + FBC result',
    admitDate: '2026-09-18', vitals: { bp: '110/70', hr: 104, temp: 39.1, spo2: 97, rr: 22 },
    flags: ['Febrile', 'Malaria RDT Pending'],
  },
  {
    id: 'MRN-007284', name: 'Grace Afolabi', age: 71, gender: 'F', ward: 'Medical Ward', bed: 'B3-08',
    diagnosis: 'Chronic Heart Failure � Exacerbation', status: 'inpatient', nextAction: 'Fluid balance + Lasix dose',
    admitDate: '2026-09-14', vitals: { bp: '130/80', hr: 78, temp: 36.8, spo2: 91, rr: 26 },
    flags: ['Fluid Restriction', 'O2 2L/min', 'Oedema'],
  },
  {
    id: 'MRN-002931', name: 'Ibrahim Salisu', age: 55, gender: 'M', ward: 'Surgical Ward', bed: 'S1-02',
    diagnosis: 'Post-Op Hernia Repair Day 1', status: 'inpatient', nextAction: 'Wound inspect + ambulate',
    admitDate: '2026-09-17', vitals: { bp: '126/82', hr: 82, temp: 37.0, spo2: 98, rr: 16 },
    flags: ['Post-Op', 'DVT Prophylaxis'],
  },
];

const APPOINTMENTS: Appointment[] = [
  { id: 'A-01', patientName: 'Chukwudi Obi', patientId: 'MRN-006417', time: '08:30', type: 'Follow-Up OPD', status: 'done' },
  { id: 'A-02', patientName: 'Ngozi Bello', patientId: 'MRN-008112', time: '09:00', type: 'New Consultation', status: 'done' },
  { id: 'A-03', patientName: 'Yusuf Adamu', patientId: 'MRN-008230', time: '09:45', type: 'Diabetes Review', status: 'waiting' },
  { id: 'A-04', patientName: 'Chidinma Ike', patientId: 'MRN-005490', time: '10:15', type: 'Post-Op Checkup', status: 'scheduled' },
  { id: 'A-05', patientName: 'Ladi Okonkwo', patientId: 'MRN-003380', time: '10:45', type: 'Hypertension Review', status: 'scheduled' },
  { id: 'A-06', patientName: 'Sola Adeyemi', patientId: 'MRN-009001', time: '11:30', type: 'Lab Results Review', status: 'scheduled' },
  { id: 'A-07', patientName: 'Mary Okafor', patientId: 'MRN-006780', time: '14:00', type: 'New Consultation', status: 'scheduled' },
  { id: 'A-08', patientName: 'Bello Usman', patientId: 'MRN-004020', time: '14:45', type: 'Referral Follow-Up', status: 'scheduled' },
];

const INITIAL_TASKS: Task[] = [];

// -- Shared UI Primitives -------------------------------------------------------

const VitalChip: React.FC<{ label: string; value: string | number; unit?: string; warn?: boolean }> = ({ label, value, unit, warn }) => (
  <div style={{
    background: warn ? 'rgba(239,68,68,0.08)' : '#FFFFFF',
    border: `1px solid ${warn ? 'rgba(239,68,68,0.3)' : '#E2E8F0'}`,
    borderRadius: 8, padding: '5px 9px', textAlign: 'center', minWidth: 52,
  }}>
    <div style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: warn ? '#EF4444' : '#F8FAFC' }}>
      {value}<span style={{ fontSize: '0.6rem', color: '#64748B' }}>{unit}</span>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: Patient['status'] }> = ({ status }) => {
  const map: Record<Patient['status'], { color: string; bg: string; label: string }> = {
    critical:   { color: '#EF4444', bg: 'rgba(239,68,68,0.15)',    label: '? CRITICAL' },
    inpatient:  { color: '#0052D4', bg: 'rgba(56,189,248,0.12)',   label: 'Inpatient'  },
    outpatient: { color: '#059669', bg: 'rgba(74,222,128,0.12)',   label: 'Outpatient' },
    discharged: { color: '#64748B', bg: 'rgba(100,116,139,0.12)', label: 'Discharged' },
    pending:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   label: 'Pending'    },
  };
  const m = map[status];
  return (
    <span style={{
      fontSize: '0.67rem', fontWeight: 700, color: m.color, background: m.bg,
      border: `1px solid ${m.color}44`, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
};

const StatCard: React.FC<{
  label: string; value: string | number; icon: React.ComponentType<any>;
  color: string; sub?: string; onClick?: () => void; pulse?: boolean;
}> = ({ label, value, icon: Icon, color, sub, onClick, pulse }) => (
  <div
    onClick={onClick}
    style={{
      background: 'rgba(15,23,42,0.85)', border: `1px solid ${color}28`,
      borderRadius: 14, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
    onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = `${color}28`; }}
  >
    {pulse && <div style={{
      position: 'absolute', top: 12, right: 12, width: 9, height: 9,
      borderRadius: '50%', background: '#EF4444',
      animation: 'docPortalPulse 1.4s infinite',
    }} />}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={21} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0A2540', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  </div>
);

// -- DASHBOARD -----------------------------------------------------------------

const DashboardView: React.FC<{ session: UserSession; onSubNav: (k: SubModule) => void }> = ({ session, onSubNav }) => {
  const { notifications, connected } = useRealtimeEvents({ app: 'MEDCORE_OS_DOCTOR' });
  const critical = PATIENTS.filter(p => p.status === 'critical');
  const remaining = APPOINTMENTS.filter(a => a.status !== 'done');
  const pendingTasks = INITIAL_TASKS.filter(t => !t.done);
  const urgentTasks = pendingTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2,132,199,0.16) 0%, rgba(15,23,42,0.96) 55%, rgba(124,58,237,0.08) 100%)',
        border: '1px solid rgba(2,132,199,0.22)', borderRadius: 16, padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg,#0284C7,#0369A1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 800, color: '#0A2540',
            boxShadow: '0 4px 16px rgba(2,132,199,0.4)',
          }}>{session.avatarInitials || 'DR'}</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#0052D4', fontWeight: 600, marginBottom: 3 }}>{greeting}, Doctor ??</div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0A2540' }}>
              {session.title || 'Physician'} Command Desk
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: '0.76rem', color: '#94A3B8', flexWrap: 'wrap' }}>
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} /> Active Duty
              </span>
              <span>�</span><span>{session.facility || 'Ibom Specialist Hospital'}</span>
              <span>�</span><span>{session.department || 'Internal Medicine'}</span>
              <span>�</span><span>{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Start Consultation', icon: Stethoscope, color: '#0052D4', bg: 'rgba(2,132,199,0.18)', border: 'rgba(2,132,199,0.45)', nav: 'consultation' },
            { label: 'Ward Round', icon: BedDouble, color: '#A78BFA', bg: 'rgba(124,58,237,0.18)', border: 'rgba(124,58,237,0.4)', nav: 'ward-round' },
            { label: 'Emergency Referral', icon: Siren, color: '#F87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.4)', nav: 'referrals' },
          ].map(b => (
            <button key={b.label} type="button" onClick={() => onSubNav(b.nav as SubModule)} style={{
              background: b.bg, border: `1px solid ${b.border}`, color: b.color,
              padding: '10px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <b.icon size={14} /> {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 13 }}>
        <StatCard label="My Patients" value={PATIENTS.length} icon={Users} color="#38BDF8" sub="3 inpatient � 1 OPD � 1 ICU" onClick={() => onSubNav('patients')} />
        <StatCard label="Critical" value={critical.length} icon={AlertTriangle} color="#EF4444" sub="ICU monitoring active" onClick={() => onSubNav('patients')} pulse={critical.length > 0} />
        <StatCard label="Today's Appts" value={APPOINTMENTS.length} icon={Calendar} color="#A78BFA" sub={`${APPOINTMENTS.filter(a => a.status === 'done').length} done � ${remaining.length} left`} onClick={() => onSubNav('appointments')} />
        <StatCard label="Pending Results" value={5} icon={FlaskConical} color="#F59E0B" sub="3 Lab � 2 Radiology" onClick={() => onSubNav('lab-orders')} />
        <StatCard label="Pending Tasks" value={pendingTasks.length} icon={ClipboardList} color="#10B981" sub={`${urgentTasks.length} urgent or high`} onClick={() => onSubNav('tasks')} pulse={urgentTasks.length > 0} />
        <StatCard label="Messages" value={3} icon={MessageSquare} color="#60A5FA" sub="2 unread clinical msgs" onClick={() => onSubNav('messages')} />
      </div>

      {/* Closed Clinical Loop Live Telemetry Stream */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(2,132,199,0.08) 50%, rgba(15,23,42,0.92) 100%)',
        border: '1px solid rgba(56,189,248,0.28)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: connected ? '#10B981' : '#F59E0B',
            boxShadow: connected ? '0 0 10px #10B981' : 'none',
          }} />
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} /> Closed Clinical Loop: Real-Time Event Bus
              <span style={{ fontSize: '0.68rem', color: connected ? '#34D399' : '#FBBF24', background: 'rgba(16,185,129,0.12)', padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>
                {connected ? 'CONNECTED (/ws)' : 'RECONNECTING'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 2 }}>
              Order → Pharmacy Verify → Dispense → Bedside e-MAR → Lab/PACS Result → Physician Workstation
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => onSubNav('lab-orders')}
            style={{
              background: 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.3)',
              color: '#38BDF8',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <FlaskConical size={13} /> Live Results Review ({notifications.filter(n => n.topic === 'LAB_RESULT_READY').length || 3})
          </button>
          <button
            type="button"
            onClick={() => onSubNav('prescriptions')}
            style={{
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.3)',
              color: '#C084FC',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Pill size={13} /> Dispensed e-MAR ({notifications.filter(n => n.topic === 'PRESCRIPTION_DISPENSED').length || 4})
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 16 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Critical alert */}
          {critical.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.32)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={16} color="#EF4444" />
                <span style={{ fontWeight: 700, color: '#F87171', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Critical Patients � Immediate Attention
                </span>
              </div>
              {critical.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.14)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                }}>
                  <HeartPulse size={22} color="#EF4444" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem' }}>
                      {p.name} <span style={{ fontSize: '0.73rem', color: '#94A3B8' }}>� {p.id}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#F87171', marginTop: 2 }}>{p.diagnosis}</div>
                    <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 2 }}>
                      {p.ward} � BP {p.vitals.bp} � HR {p.vitals.hr} � SpO2 {p.vitals.spo2}%
                    </div>
                  </div>
                  <button type="button" style={{
                    background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.38)',
                    color: '#F87171', padding: '7px 14px', borderRadius: 8, fontWeight: 700,
                    fontSize: '0.76rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>Review Now ?</button>
                </div>
              ))}
            </div>
          )}

          {/* Patient Table */}
          <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Users size={15} color="#38BDF8" /> My Active Patients
              </div>
              <button type="button" onClick={() => onSubNav('patients')} style={{
                background: 'rgba(2,132,199,0.14)', border: '1px solid rgba(2,132,199,0.28)',
                color: '#0052D4', fontSize: '0.73rem', fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
              }}>View All ?</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Patient', 'Diagnosis', 'Ward / Bed', 'Vitals', 'Next Action', 'Status', ''].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '9px 14px', fontSize: '0.65rem',
                      color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid #FFFFFF',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PATIENTS.map((p, i) => (
                  <tr key={p.id}
                    style={{ borderBottom: i < PATIENTS.length - 1 ? '1px solid #FFFFFF' : 'none', background: p.status === 'critical' ? 'rgba(239,68,68,0.03)' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = p.status === 'critical' ? 'rgba(239,68,68,0.03)' : 'transparent'}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.84rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.id} � {p.age}{p.gender}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#CBD5E1', maxWidth: 180 }}>{p.diagnosis}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{p.ward}</div>
                      {p.bed && <div style={{ fontSize: '0.7rem', color: '#0052D4', fontWeight: 600 }}>Bed {p.bed}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <VitalChip label="BP" value={p.vitals.bp} warn={parseInt(p.vitals.bp) > 140} />
                        <VitalChip label="HR" value={p.vitals.hr} unit="/m" warn={p.vitals.hr > 100 || p.vitals.hr < 50} />
                        <VitalChip label="SpO2" value={p.vitals.spo2} unit="%" warn={p.vitals.spo2 < 94} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {p.nextAction}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '10px 14px' }}>
                      <button type="button" style={{ background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.22)', color: '#0052D4', fontSize: '0.7rem', fontWeight: 600, padding: '4px 9px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>View ?</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Schedule */}
          <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Calendar size={14} color="#A78BFA" /> Today's Schedule
            </div>
            {APPOINTMENTS.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid #FFFFFF' }}>
                <div style={{ minWidth: 42, fontSize: '0.73rem', fontWeight: 700, color: a.status === 'done' ? '#4ADE80' : a.status === 'waiting' ? '#F59E0B' : '#64748B', textAlign: 'center' }}>{a.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: a.status === 'done' ? '#64748B' : '#F8FAFC' }}>{a.patientName}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{a.type}</div>
                </div>
                <span style={{
                  fontSize: '0.63rem', fontWeight: 700, borderRadius: 999, padding: '1px 6px',
                  color: a.status === 'done' ? '#4ADE80' : a.status === 'waiting' ? '#F59E0B' : '#64748B',
                  background: a.status === 'done' ? 'rgba(74,222,128,0.1)' : a.status === 'waiting' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)',
                  border: '1px solid currentColor',
                }}>
                  {a.status === 'done' ? '? Done' : a.status === 'waiting' ? '? Wait' : 'Upcoming'}
                </span>
              </div>
            ))}
            <button type="button" onClick={() => onSubNav('appointments')} style={{ width: '100%', marginTop: 9, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.22)', color: '#A78BFA', padding: '7px', borderRadius: 8, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
              Full Schedule ?
            </button>
          </div>

          {/* Tasks */}
          <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><ClipboardList size={14} color="#10B981" /> Tasks</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(239,68,68,0.13)', color: '#F87171', border: '1px solid rgba(239,68,68,0.24)', padding: '2px 8px', borderRadius: 999 }}>
                {urgentTasks.length} Urgent
              </span>
            </div>
            {INITIAL_TASKS.slice(0, 5).map(t => {
              const pc: Record<Task['priority'], string> = { urgent: '#EF4444', high: '#F59E0B', normal: '#38BDF8', low: '#64748B' };
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '7px 0', borderBottom: '1px solid #FFFFFF' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc[t.priority], display: 'inline-block', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.76rem', color: '#CBD5E1', lineHeight: 1.4 }}>{t.title}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 1 }}>Due: {t.due}</div>
                  </div>
                  <button type="button" style={{ background: 'transparent', border: '1px solid rgba(74,222,128,0.28)', color: '#059669', padding: '2px 6px', borderRadius: 5, cursor: 'pointer', fontSize: '0.67rem', flexShrink: 0 }}>?</button>
                </div>
              );
            })}
            <button type="button" onClick={() => onSubNav('tasks')} style={{ width: '100%', marginTop: 9, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', color: '#10B981', padding: '7px', borderRadius: 8, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
              All Tasks ?
            </button>
          </div>

          {/* Quick Actions */}
          <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 11 }}>? Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { icon: UserPlus,    label: 'Admit Patient', color: '#0052D4', nav: 'admission'        },
                { icon: Pill,        label: 'Prescribe',     color: '#A78BFA', nav: 'prescriptions'    },
                { icon: FlaskConical,label: 'Order Lab',     color: '#F59E0B', nav: 'lab-orders'       },
                { icon: Layers,      label: 'Order Scan',    color: '#F472B6', nav: 'radiology-orders' },
                { icon: Send,        label: 'Refer Patient', color: '#10B981', nav: 'referrals'        },
                { icon: FileText,    label: 'Clinical Note', color: '#60A5FA', nav: 'emr'              },
              ].map(q => (
                <button key={q.label} type="button" onClick={() => onSubNav(q.nav as SubModule)} style={{
                  background: `${q.color}0D`, border: `1px solid ${q.color}28`, color: q.color,
                  padding: '9px 11px', borderRadius: 9, fontWeight: 600, fontSize: '0.75rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                }}>
                  <q.icon size={13} /> {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// -- PATIENTS VIEW -------------------------------------------------------------

const PatientsView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inpatient' | 'outpatient' | 'critical'>('all');
  const [selected, setSelected] = useState<Patient | null>(null);

  const filtered = PATIENTS.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.diagnosis.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Toolbar */}
        <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient name, MRN, diagnosis�"
              style={{ width: '100%', padding: '8px 12px 8px 32px', boxSizing: 'border-box', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, color: '#0A2540', fontSize: '0.82rem', outline: 'none' }} />
          </div>
          {(['all', 'inpatient', 'outpatient', 'critical'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{
              padding: '7px 13px', borderRadius: 8, fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer',
              background: filter === f ? 'rgba(2,132,199,0.18)' : 'transparent',
              border: `1px solid ${filter === f ? '#0284C7' : 'rgba(255,255,255,0.09)'}`,
              color: filter === f ? '#38BDF8' : '#64748B',
            }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
          <button type="button" style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={14} /> Add Patient
          </button>
        </div>

        {/* Cards */}
        {filtered.map(p => (
          <div key={p.id} onClick={() => setSelected(p)} style={{
            background: selected?.id === p.id ? 'rgba(2,132,199,0.07)' : 'rgba(15,23,42,0.85)',
            border: `1px solid ${selected?.id === p.id ? 'rgba(2,132,199,0.38)' : p.status === 'critical' ? 'rgba(239,68,68,0.22)' : '#E2E8F0'}`,
            borderRadius: 12, padding: '13px 17px', cursor: 'pointer',
            display: 'grid', gridTemplateColumns: '1fr 1fr 190px auto', alignItems: 'center', gap: 14, transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: p.status === 'critical' ? 'rgba(239,68,68,0.18)' : 'rgba(2,132,199,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: p.status === 'critical' ? '#F87171' : '#38BDF8', fontSize: '0.85rem', flexShrink: 0 }}>
                {p.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.id} � {p.age}{p.gender}</div>
                <div style={{ fontSize: '0.76rem', color: '#CBD5E1', marginTop: 2 }}>{p.diagnosis}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.77rem', color: '#94A3B8' }}>{p.ward}{p.bed ? ` � Bed ${p.bed}` : ''}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 2 }}>Admit: {p.admitDate}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <VitalChip label="BP" value={p.vitals.bp} warn={parseInt(p.vitals.bp) > 140} />
              <VitalChip label="HR" value={p.vitals.hr} unit="/m" warn={p.vitals.hr > 100} />
              <VitalChip label="SpO2" value={p.vitals.spo2} unit="%" warn={p.vitals.spo2 < 94} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <StatusBadge status={p.status} />
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {p.flags.slice(0, 2).map(f => (
                  <span key={f} style={{ fontSize: '0.6rem', background: 'rgba(245,158,11,0.09)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 4, padding: '1px 5px' }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ width: 300, flexShrink: 0, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(2,132,199,0.22)', borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, color: '#0052D4', fontSize: '0.95rem' }}>Patient Detail</div>
            <button type="button" onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={15} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: selected.status === 'critical' ? 'rgba(239,68,68,0.18)' : 'rgba(2,132,199,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: selected.status === 'critical' ? '#F87171' : '#38BDF8' }}>
              {selected.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.95rem' }}>{selected.name}</div>
              <div style={{ fontSize: '0.73rem', color: '#94A3B8' }}>{selected.id} � {selected.age}y � {selected.gender === 'M' ? 'Male' : 'Female'}</div>
              <div style={{ marginTop: 3 }}><StatusBadge status={selected.status} /></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[{ label: 'Ward', v: selected.ward }, { label: 'Bed', v: selected.bed || 'OPD' }, { label: 'Admitted', v: selected.admitDate }, { label: 'Diagnosis', v: selected.diagnosis }].map(x => (
              <div key={x.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ fontSize: '0.62rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>{x.label}</div>
                <div style={{ fontSize: '0.8rem', color: '#0A2540', fontWeight: 600, marginTop: 2 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, marginBottom: 7, textTransform: 'uppercase' }}>Current Vitals</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              <VitalChip label="BP" value={selected.vitals.bp} warn={parseInt(selected.vitals.bp) > 140} />
              <VitalChip label="HR" value={selected.vitals.hr} unit="/m" warn={selected.vitals.hr > 100} />
              <VitalChip label="SpO2" value={selected.vitals.spo2} unit="%" warn={selected.vitals.spo2 < 94} />
              <VitalChip label="Temp" value={selected.vitals.temp} unit="�C" warn={selected.vitals.temp > 38} />
              <VitalChip label="RR" value={selected.vitals.rr} unit="/m" warn={selected.vitals.rr > 22} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Start Consultation', color: '#0052D4', icon: Stethoscope },
              { label: 'Write Clinical Note', color: '#60A5FA', icon: FileText },
              { label: 'Prescribe Medication', color: '#A78BFA', icon: Pill },
              { label: 'Order Investigation', color: '#F59E0B', icon: FlaskConical },
            ].map(a => (
              <button key={a.label} type="button" style={{ width: '100%', background: `${a.color}0E`, border: `1px solid ${a.color}28`, color: a.color, padding: '8px 13px', borderRadius: 8, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <a.icon size={13} /> {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// -- CONSULTATION (SOAP) -------------------------------------------------------

const ConsultationView: React.FC = () => {
  const [step, setStep] = useState<'select' | 'consult'>('select');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [hpi, setHpi] = useState('');
  const [pmh, setPmh] = useState('');
  const [examination, setExamination] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [soapTab, setSoapTab] = useState<'S' | 'O' | 'A' | 'P'>('S');

  if (step === 'select') {
    return (
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: '#0A2540' }}>Start Consultation</h2>
        <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '0.8rem' }}>Select a patient from the queue to begin a SOAP consultation session.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {APPOINTMENTS.filter(a => a.status === 'waiting' || a.status === 'scheduled').map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: a.status === 'waiting' ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${a.status === 'waiting' ? 'rgba(245,158,11,0.28)' : '#E2E8F0'}`,
              borderRadius: 12, padding: '13px 17px',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: a.status === 'waiting' ? 'rgba(245,158,11,0.18)' : 'rgba(2,132,199,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: a.status === 'waiting' ? '#F59E0B' : '#38BDF8', fontSize: '0.85rem' }}>
                {a.patientName.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem' }}>{a.patientName}</div>
                <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{a.patientId} � {a.type} � {a.time}</div>
              </div>
              {a.status === 'waiting' && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', padding: '2px 9px', borderRadius: 999 }}>? Waiting</span>}
              <button type="button" onClick={() => { setPatient(PATIENTS.find(p => p.id === a.patientId) || null); setStep('consult'); }} style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', border: 'none', color: '#fff', padding: '8px 17px', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                Begin ?
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs: { key: 'S' | 'O' | 'A' | 'P'; label: string; color: string }[] = [
    { key: 'S', label: 'Subjective', color: '#0052D4' },
    { key: 'O', label: 'Objective', color: '#10B981' },
    { key: 'A', label: 'Assessment', color: '#F59E0B' },
    { key: 'P', label: 'Plan', color: '#A78BFA' },
  ];

  const ta = (label: string, val: string, set: (v: string) => void, rows = 5) => (
    <div>
      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{label}</label>
      <textarea value={val} onChange={e => set(e.target.value)} rows={rows} placeholder={`Enter ${label.toLowerCase()}�`}
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, color: '#0A2540', fontSize: '0.83rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 16 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>SOAP Consultation Note</h2>
            <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>{patient?.name || 'Unknown'} � {patient?.id || ''} � {new Date().toLocaleDateString('en-GB')}</div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button type="button" onClick={() => setStep('select')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: '#94A3B8', padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: '0.76rem' }}>? Back</button>
            <button type="button" style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', border: 'none', color: '#fff', padding: '7px 15px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Save size={13} /> Save & Sign
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, background: '#F8FAFC', padding: 4, borderRadius: 10 }}>
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setSoapTab(t.key)} style={{
              flex: 1, padding: '8px', borderRadius: 7, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: 'none',
              background: soapTab === t.key ? `${t.color}1E` : 'transparent',
              color: soapTab === t.key ? t.color : '#64748B', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {soapTab === 'S' && <>{ta('Chief Complaint', chiefComplaint, setChiefComplaint, 2)}{ta('History of Presenting Illness (HPI)', hpi, setHpi, 6)}{ta('Past Medical / Surgical History', pmh, setPmh, 4)}</>}
          {soapTab === 'O' && (<>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Current Vitals</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {patient && Object.entries(patient.vitals).map(([k, v]) => <VitalChip key={k} label={k.toUpperCase()} value={v} />)}
              </div>
            </div>
            {ta('Physical Examination Findings', examination, setExamination, 8)}
          </>)}
          {soapTab === 'A' && ta('Assessment / Differential Diagnosis', assessment, setAssessment, 10)}
          {soapTab === 'P' && ta('Management Plan (Investigations, Treatment, Follow-up)', plan, setPlan, 10)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {patient && (
          <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 10 }}>Patient Summary</div>
            {[{ l: 'Name', v: patient.name }, { l: 'MRN', v: patient.id }, { l: 'Diagnosis', v: patient.diagnosis }, { l: 'Ward', v: patient.ward }].map(x => (
              <div key={x.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #FFFFFF', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748B' }}>{x.l}</span>
                <span style={{ color: '#CBD5E1', fontWeight: 600, textAlign: 'right', maxWidth: 160 }}>{x.v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px' }}>
          <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 10 }}>Clinical Shortcuts</div>
          {[{ l: '+ Order Lab Test', c: '#F59E0B' }, { l: '+ Order Radiology', c: '#F472B6' }, { l: '+ Prescribe Drug', c: '#A78BFA' }, { l: '+ Refer Patient', c: '#10B981' }, { l: '+ Request Admission', c: '#38BDF8' }].map(a => (
            <button key={a.l} type="button" style={{ width: '100%', marginBottom: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', color: a.c, padding: '8px 11px', borderRadius: 7, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>{a.l}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// -- PRESCRIPTIONS -------------------------------------------------------------

const PrescriptionsView: React.FC = () => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [drugName, setDrugName] = useState('');
  const [dose, setDose] = useState('');
  const [freq, setFreq] = useState('');
  const [duration, setDuration] = useState('');
  const [route, setRoute] = useState('Oral');
  const [instructions, setInstructions] = useState('');
  const [rxList, setRxList] = useState([
    { id: 'RX-001', patient: 'Adaobi Nwosu', drug: 'Metformin 500mg', dose: '500mg', freq: 'Twice daily', route: 'Oral', duration: '30 days', status: 'active', date: '2026-09-15' },
    { id: 'RX-002', patient: 'Grace Afolabi', drug: 'Furosemide 40mg', dose: '40mg', freq: 'Once daily', route: 'Oral', duration: '7 days', status: 'dispensed', date: '2026-09-14' },
    { id: 'RX-003', patient: 'Emeka Eze', drug: 'Aspirin 75mg', dose: '75mg', freq: 'Once daily', route: 'Oral', duration: '90 days', status: 'routed', date: '2026-09-17' },
  ]);

  const DRUGS = ['Amoxicillin 500mg', 'Metformin 500mg', 'Amlodipine 5mg', 'Furosemide 40mg', 'Artemether/Lumefantrine', 'Lisinopril 10mg', 'Omeprazole 20mg', 'Paracetamol 500mg', 'Metronidazole 400mg', 'Aspirin 75mg'];
  const statusColor: Record<string, string> = { pending: '#F59E0B', active: '#38BDF8', dispensed: '#4ADE80', routed: '#A78BFA', cancelled: '#EF4444' };

  const prescribe = () => {
    if (!patient || !drugName || !dose) return;
    setRxList(prev => [{ id: `RX-${String(prev.length + 1).padStart(3, '0')}`, patient: patient.name, drug: drugName, dose, freq, route, duration, status: 'pending', date: new Date().toISOString().slice(0, 10) }, ...prev]);
    setDrugName(''); setDose(''); setFreq(''); setDuration(''); setInstructions('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}><Pill size={15} color="#A78BFA" /> e-Prescription Log</div>
          <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{rxList.length} prescriptions</div>
        </div>
        {rxList.map(rx => (
          <div key={rx.id} style={{ padding: '13px 20px', borderBottom: '1px solid #FFFFFF', display: 'flex', alignItems: 'center', gap: 13 }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(167,139,250,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Pill size={17} color="#A78BFA" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem' }}>{rx.drug}</div>
              <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 2 }}>{rx.patient} � {rx.dose} � {rx.freq} � {rx.route}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: 1 }}>{rx.id} � {rx.date} � {rx.duration}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <span style={{ fontSize: '0.67rem', fontWeight: 700, color: statusColor[rx.status] || '#64748B', background: `${statusColor[rx.status] || '#64748B'}14`, border: `1px solid ${statusColor[rx.status] || '#64748B'}40`, borderRadius: 999, padding: '2px 8px' }}>{rx.status}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" style={{ background: 'rgba(96,165,250,0.09)', border: '1px solid rgba(96,165,250,0.22)', color: '#60A5FA', fontSize: '0.68rem', padding: '2px 7px', borderRadius: 5, cursor: 'pointer' }}>Print</button>
                <button type="button" style={{ background: 'rgba(167,139,250,0.09)', border: '1px solid rgba(167,139,250,0.22)', color: '#A78BFA', fontSize: '0.68rem', padding: '2px 7px', borderRadius: 5, cursor: 'pointer' }}>Route ?</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Prescription Form */}
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(167,139,250,0.18)', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ fontWeight: 700, color: '#A78BFA', fontSize: '0.93rem', display: 'flex', alignItems: 'center', gap: 7 }}><Plus size={15} /> New e-Prescription</div>
        {[
          { lbl: 'Patient', node: (
            <select value={patient?.id || ''} onChange={e => setPatient(PATIENTS.find(p => p.id === e.target.value) || null)} style={{ width: '100%', padding: '9px 11px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.82rem', outline: 'none' }}>
              <option value="">� Select Patient �</option>
              {PATIENTS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          )},
          { lbl: 'Drug / Medication', node: (
            <>
              <input value={drugName} onChange={e => setDrugName(e.target.value)} list="dp-drugs" placeholder="e.g. Amoxicillin 500mg" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.82rem', outline: 'none' }} />
              <datalist id="dp-drugs">{DRUGS.map(d => <option key={d} value={d} />)}</datalist>
            </>
          )},
        ].map(f => (
          <div key={f.lbl}>
            <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{f.lbl}</label>
            {f.node}
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {[['Dose', dose, setDose, 'e.g. 500mg'], ['Frequency', freq, setFreq, 'e.g. Twice daily'], ['Duration', duration, setDuration, 'e.g. 7 days']].map(([l, v, s, ph]) => (
            <div key={l as string}>
              <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{l as string}</label>
              <input value={v as string} onChange={e => (s as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} placeholder={ph as string} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.82rem', outline: 'none' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Route</label>
            <select value={route} onChange={e => setRoute(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.82rem', outline: 'none' }}>
              {['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'PR', 'SL'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Special Instructions</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} placeholder="e.g. Take after meals, avoid alcohol�"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.82rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <button type="button" onClick={prescribe} style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', color: '#fff', padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Pill size={15} /> Issue e-Prescription
        </button>
        <div style={{ display: 'flex', gap: 7 }}>
          <button type="button" style={{ flex: 1, background: 'rgba(56,189,248,0.09)', border: '1px solid rgba(56,189,248,0.22)', color: '#0052D4', padding: '8px', borderRadius: 8, fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}>Route to Pharmacy ?</button>
          <button type="button" style={{ flex: 1, background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.22)', color: '#10B981', padding: '8px', borderRadius: 8, fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}>Print Rx</button>
        </div>
      </div>
    </div>
  );
};

// -- LAB ORDERS ----------------------------------------------------------------

const LabOrdersView: React.FC = () => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [orders, setOrders] = useState([
    { id: 'LAB-001', patient: 'Chukwudi Obi', tests: ['Malaria RDT', 'FBC', 'MP Film'], status: 'pending', ordered: '09:15', priority: 'Urgent' },
    { id: 'LAB-002', patient: 'Adaobi Nwosu', tests: ['Fasting BGL', 'HbA1c', 'Lipid Profile'], status: 'in-progress', ordered: '08:30', priority: 'Routine' },
    { id: 'LAB-003', patient: 'Emeka Eze', tests: ['Troponin I', 'BNP', 'D-Dimer', 'ABG'], status: 'resulted', ordered: '08:00', priority: 'Urgent', result: 'Troponin: 2.4 ng/mL (?) � Critical value alerted' },
    { id: 'LAB-004', patient: 'Grace Afolabi', tests: ['U&E', 'eGFR', 'Urine MCS'], status: 'pending', ordered: '09:50', priority: 'Routine' },
  ]);

  const PANELS: Record<string, string[]> = {
    'Haematology': ['FBC', 'Peripheral Film', 'ESR', 'Reticulocyte', 'PT/aPTT/INR'],
    'Chemistry': ['LFT', 'U&E', 'Lipid Profile', 'HbA1c', 'Fasting BGL', 'RBS', 'Uric Acid'],
    'Cardiac Markers': ['Troponin I', 'BNP / NT-proBNP', 'CK-MB', 'D-Dimer', 'ABG'],
    'Infection Screen': ['Malaria RDT', 'MP Film', 'Widal', 'Blood C&S', 'Hep B&C', 'HIV Rapid'],
    'Microbiology': ['Urine MCS', 'HVS C&S', 'Sputum AFB', 'Stool MCS'],
    'Endocrine': ['TSH', 'Free T4', 'PSA', 'CA-125', 'CEA'],
  };

  const toggle = (t: string) => setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const place = () => {
    if (!patient || !selected.length) return;
    setOrders(prev => [{ id: `LAB-${String(prev.length + 1).padStart(3, '0')}`, patient: patient.name, tests: selected, status: 'pending', ordered: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), priority: 'Urgent' }, ...prev]);
    setSelected([]);
  };
  const sc: Record<string, string> = { pending: '#F59E0B', 'in-progress': '#38BDF8', resulted: '#4ADE80', cancelled: '#EF4444' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #FFFFFF' }}>
          <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}><FlaskConical size={15} color="#F59E0B" /> Lab Orders & Results</div>
        </div>
        {orders.map(o => (
          <div key={o.id} style={{ padding: '13px 20px', borderBottom: '1px solid #FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <div>
                <span style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem' }}>{o.patient}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748B', marginLeft: 7 }}>{o.id} � {o.ordered} � {o.priority}</span>
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: sc[o.status], background: `${sc[o.status]}13`, border: `1px solid ${sc[o.status]}40`, borderRadius: 999, padding: '2px 8px' }}>{o.status}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {o.tests.map(t => <span key={t} style={{ fontSize: '0.7rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#F59E0B', borderRadius: 5, padding: '2px 7px' }}>{t}</span>)}
            </div>
            {'result' in o && o.result && (
              <div style={{ marginTop: 8, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: 7, padding: '7px 11px', fontSize: '0.76rem', color: '#059669' }}>?? {o.result}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(245,158,11,0.16)', borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ fontWeight: 700, color: '#F59E0B', fontSize: '0.93rem', display: 'flex', alignItems: 'center', gap: 7 }}><Plus size={15} /> New Lab Order</div>
        <div>
          <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Patient</label>
          <select value={patient?.id || ''} onChange={e => setPatient(PATIENTS.find(p => p.id === e.target.value) || null)} style={{ width: '100%', padding: '8px 10px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.82rem', outline: 'none' }}>
            <option value="">� Select Patient �</option>
            {PATIENTS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
          </select>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 340 }}>
          {Object.entries(PANELS).map(([panel, tests]) => (
            <div key={panel} style={{ marginBottom: 11 }}>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>{panel}</div>
              {tests.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 7px', borderRadius: 6, background: selected.includes(t) ? 'rgba(245,158,11,0.07)' : 'transparent', border: `1px solid ${selected.includes(t) ? 'rgba(245,158,11,0.28)' : 'transparent'}`, marginBottom: 3 }}>
                  <input type="checkbox" checked={selected.includes(t)} onChange={() => toggle(t)} style={{ accentColor: '#F59E0B' }} />
                  <span style={{ fontSize: '0.78rem', color: selected.includes(t) ? '#F59E0B' : '#CBD5E1' }}>{t}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        {selected.length > 0 && <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 7, padding: '9px 11px', fontSize: '0.76rem', color: '#F59E0B' }}>{selected.length} test(s): {selected.join(', ')}</div>}
        <button type="button" onClick={place} style={{ background: 'linear-gradient(135deg,#D97706,#B45309)', border: 'none', color: '#fff', padding: '11px', borderRadius: 9, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <FlaskConical size={15} /> Place Lab Order
        </button>
      </div>
    </div>
  );
};

// -- WARD ROUND ----------------------------------------------------------------

const WardRoundView: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(PATIENTS[0].id);
  const inpatients = PATIENTS.filter(p => p.status !== 'outpatient' && p.status !== 'discharged');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540', display: 'flex', alignItems: 'center', gap: 8 }}><BedDouble size={17} color="#A78BFA" /> Ward Round Console</h2>
          <p style={{ margin: '3px 0 0', color: '#64748B', fontSize: '0.78rem' }}>{inpatients.length} inpatients � {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button type="button" style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', color: '#fff', padding: '9px 17px', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={13} /> Sign All Notes
        </button>
      </div>
      {inpatients.map(p => (
        <div key={p.id} style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${p.status === 'critical' ? 'rgba(239,68,68,0.28)' : '#E2E8F0'}`, borderRadius: 14, overflow: 'hidden' }}>
          <div onClick={() => setExpanded(x => x === p.id ? null : p.id)} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', background: p.status === 'critical' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: p.status === 'critical' ? 'rgba(239,68,68,0.18)' : 'rgba(2,132,199,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: p.status === 'critical' ? '#F87171' : '#38BDF8', fontSize: '0.85rem', flexShrink: 0 }}>
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.88rem' }}>{p.name}</span>
                <StatusBadge status={p.status} />
                {p.flags.map(f => <span key={f} style={{ fontSize: '0.62rem', color: p.status === 'critical' ? '#F87171' : '#F59E0B', background: p.status === 'critical' ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.09)', border: '1px solid currentColor', borderRadius: 4, padding: '1px 5px' }}>{f}</span>)}
              </div>
              <div style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 2 }}>{p.id} � {p.ward}{p.bed ? ` � Bed ${p.bed}` : ''} � {p.diagnosis}</div>
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <VitalChip label="BP" value={p.vitals.bp} warn={parseInt(p.vitals.bp) > 140} />
              <VitalChip label="HR" value={p.vitals.hr} unit="/m" warn={p.vitals.hr > 100} />
              <VitalChip label="SpO2" value={p.vitals.spo2} unit="%" warn={p.vitals.spo2 < 94} />
              {expanded === p.id ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
            </div>
          </div>
          {expanded === p.id && (
            <div style={{ padding: '0 18px 18px', borderTop: '1px solid #FFFFFF' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 13 }}>
                {[['Clinical Status / Today\'s Findings', 'Document today\'s findings, patient condition, response to treatment�'], ['Today\'s Plan & Orders', 'Medication changes, investigation orders, nursing instructions, dietary�']].map(([lbl, ph]) => (
                  <div key={lbl}>
                    <label style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{lbl}</label>
                    <textarea rows={4} placeholder={ph} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: '#0A2540', fontSize: '0.8rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                {[['? Sign Note', '#4ADE80', 'rgba(74,222,128,0.1)'], ['?? Prescribe', '#A78BFA', 'rgba(167,139,250,0.1)'], ['?? Lab Order', '#F59E0B', 'rgba(245,158,11,0.09)'], ['?? Refer', '#38BDF8', 'rgba(56,189,248,0.09)'], ['?? Discharge', '#64748B', 'rgba(100,116,139,0.07)']].map(([l, c, bg]) => (
                  <button key={l} type="button" style={{ background: bg, border: `1px solid ${c}40`, color: c, padding: '7px 13px', borderRadius: 7, fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// -- APPOINTMENTS --------------------------------------------------------------

const AppointmentsView: React.FC = () => {
  const sc: Record<Appointment['status'], string> = { scheduled: '#64748B', waiting: '#F59E0B', 'in-progress': '#38BDF8', done: '#4ADE80', 'no-show': '#EF4444' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={17} color="#A78BFA" /> Today's Appointment Schedule
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A78BFA', background: 'rgba(167,139,250,0.13)', border: '1px solid rgba(167,139,250,0.28)', padding: '2px 9px', borderRadius: 999 }}>{APPOINTMENTS.length} Slots</span>
        </div>
        <button type="button" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.28)', color: '#A78BFA', padding: '7px 13px', borderRadius: 8, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>+ New Appointment</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {APPOINTMENTS.map(a => (
          <div key={a.id} style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${a.status === 'waiting' ? 'rgba(245,158,11,0.28)' : a.status === 'done' ? 'rgba(74,222,128,0.13)' : '#E2E8F0'}`, borderRadius: 12, padding: '14px', opacity: a.status === 'done' ? 0.62 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: a.status === 'waiting' ? 'rgba(245,158,11,0.16)' : 'rgba(2,132,199,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem', color: a.status === 'waiting' ? '#F59E0B' : '#38BDF8' }}>
                {a.patientName.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.88rem' }}>{a.patientName}</div>
                <div style={{ fontSize: '0.71rem', color: '#64748B' }}>{a.patientId} � {a.type}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: '#A78BFA', fontSize: '0.98rem' }}>{a.time}</div>
                <span style={{ fontSize: '0.63rem', fontWeight: 700, color: sc[a.status], background: `${sc[a.status]}13`, border: '1px solid currentColor', padding: '1px 6px', borderRadius: 999 }}>
                  {a.status === 'done' ? '? Done' : a.status === 'waiting' ? '? Waiting' : a.status === 'no-show' ? '? No-Show' : 'Upcoming'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {a.status !== 'done' && <button type="button" style={{ flex: 1, background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.27)', color: '#0052D4', padding: '7px', borderRadius: 7, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Begin Consult</button>}
              <button type="button" style={{ flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8', padding: '7px', borderRadius: 7, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>View Record</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -- TASKS ---------------------------------------------------------------------

const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const toggle = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const pc: Record<Task['priority'], string> = { urgent: '#EF4444', high: '#F59E0B', normal: '#38BDF8', low: '#64748B' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={17} color="#10B981" /> Clinical Task Board</div>
        <button type="button" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.27)', color: '#10B981', padding: '7px 13px', borderRadius: 8, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>+ New Task</button>
      </div>
      {(['urgent', 'high', 'normal', 'low'] as Task['priority'][]).map(prio => {
        const items = tasks.filter(t => t.priority === prio);
        if (!items.length) return null;
        return (
          <div key={prio}>
            <div style={{ fontSize: '0.7rem', color: pc[prio], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: pc[prio], display: 'inline-block' }} />
              {prio.charAt(0).toUpperCase() + prio.slice(1)} Priority
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {items.map(t => (
                <div key={t.id} style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${t.done ? 'rgba(100,116,139,0.13)' : `${pc[t.priority]}1E`}`, borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 13, opacity: t.done ? 0.5 : 1, transition: 'all 0.15s' }}>
                  <button type="button" onClick={() => toggle(t.id)} style={{ width: 21, height: 21, borderRadius: 5, flexShrink: 0, border: `2px solid ${t.done ? '#4ADE80' : pc[t.priority]}`, background: t.done ? '#4ADE80' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.done && <Check size={12} color="#0F172A" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: t.done ? '#64748B' : '#F8FAFC', fontSize: '0.86rem', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
                    {t.patient && <div style={{ fontSize: '0.71rem', color: '#64748B', marginTop: 2 }}>Patient: {t.patient}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Due: {t.due}</div>
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, color: t.type === 'clinical' ? '#38BDF8' : t.type === 'admin' ? '#A78BFA' : '#F59E0B', background: '#FFFFFF', border: '1px solid rgba(255,255,255,0.09)', padding: '1px 6px', borderRadius: 999 }}>{t.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// -- ANALYTICS -----------------------------------------------------------------

const AnalyticsView: React.FC = () => {
  const stats = [
    { label: 'Patients Seen (MTD)', value: 142, change: '+12%', color: '#0052D4' },
    { label: 'Avg Consult Duration', value: '18 min', change: '-2 min', color: '#10B981' },
    { label: 'Prescriptions Issued', value: 89, change: '+5%', color: '#A78BFA' },
    { label: 'Lab Orders Placed', value: 67, change: '+8%', color: '#F59E0B' },
    { label: 'Referrals Made', value: 14, change: '=', color: '#F472B6' },
    { label: 'Ward Mortality Rate', value: '0%', change: 'stable', color: '#059669' },
  ];
  const diagnoses = [
    { dx: 'Malaria', count: 28, pct: 76 }, { dx: 'Hypertension', count: 22, pct: 60 },
    { dx: 'Type 2 Diabetes', count: 18, pct: 49 }, { dx: 'Typhoid Fever', count: 14, pct: 38 },
    { dx: 'Acute Gastroenteritis', count: 12, pct: 33 }, { dx: 'RTI', count: 10, pct: 27 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px' }}>
        <h2 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>My Clinical Performance</h2>
        <p style={{ margin: 0, color: '#64748B', fontSize: '0.78rem' }}>September 2026 � Month-to-date statistics</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 13 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${s.color}1E`, borderRadius: 13, padding: '18px' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>{s.label}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: '0.73rem', color: s.change.startsWith('+') ? '#4ADE80' : s.change.startsWith('-') ? '#F87171' : '#94A3B8' }}>{s.change} vs last month</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid #E2E8F0', borderRadius: 14, padding: '18px' }}>
        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', marginBottom: 14 }}>Top Diagnoses This Month</div>
        {diagnoses.map(d => (
          <div key={d.dx} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.8rem', color: '#CBD5E1' }}>{d.dx}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{d.count} cases</span>
            </div>
            <div style={{ height: 5, background: '#FFFFFF', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${d.pct}%`, background: 'linear-gradient(90deg,#0284C7,#38BDF8)', borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -- PLACEHOLDER ---------------------------------------------------------------

const Placeholder: React.FC<{ icon: React.ComponentType<any>; label: string; description: string; color?: string }> = ({ icon: Icon, label, description, color = '#38BDF8' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center', background: '#F8FAFC', border: '1px dashed rgba(255,255,255,0.09)', borderRadius: 16 }}>
    <div style={{ width: 70, height: 70, borderRadius: 20, background: `${color}13`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
      <Icon size={30} color={color} />
    </div>
    <h2 style={{ margin: '0 0 7px', fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>{label}</h2>
    <p style={{ margin: 0, color: '#64748B', fontSize: '0.83rem', maxWidth: 400, lineHeight: 1.6 }}>{description}</p>
    <div style={{ marginTop: 14, fontSize: '0.73rem', color, background: `${color}0E`, border: `1px solid ${color}28`, padding: '5px 15px', borderRadius: 999, fontWeight: 600 }}>
      ?? Module under clinical configuration � active next sprint
    </div>
  </div>
);

// -- SIDEBAR DEFINITION --------------------------------------------------------

const NAV_ITEMS: { key: SubModule; icon: React.ComponentType<any>; label: string; badge?: string | number }[] = [
  { key: 'dashboard',        icon: LayoutDashboard, label: 'Command Desk',        badge: 'Live' },
  { key: 'patients',         icon: Users,           label: 'My Patients',         badge: 6 },
  { key: 'appointments',     icon: Calendar,        label: "Today's Schedule",    badge: 8 },
  { key: 'consultation',     icon: Stethoscope,     label: 'Consultation',        badge: '1' },
  { key: 'emr',              icon: FileText,        label: 'Clinical Records / EMR' },
  { key: 'prescriptions',    icon: Pill,            label: 'Prescriptions',       badge: 'Rx' },
  { key: 'lab-orders',       icon: FlaskConical,    label: 'Lab Orders',          badge: 3 },
  { key: 'radiology-orders', icon: Layers,          label: 'Radiology Orders',    badge: 2 },
  { key: 'ward-round',       icon: BedDouble,       label: 'Ward Round' },
  { key: 'admission',        icon: UserPlus,        label: 'Admissions' },
  { key: 'referrals',        icon: Send,            label: 'Referrals' },
  { key: 'tasks',            icon: ClipboardList,   label: 'Clinical Tasks',      badge: 6 },
  { key: 'messages',         icon: MessageSquare,   label: 'Messages',            badge: 3 },
  { key: 'analytics',        icon: BarChart3,       label: 'My Analytics' },
  { key: 'settings',         icon: Settings,        label: 'Preferences' },
];

// -- MAIN EXPORT ---------------------------------------------------------------

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ session, onNavigate }) => {
  const [activeModule, setActiveModule] = useState<SubModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const renderContent = () => {
    switch (activeModule) {
      case 'dashboard':        return <DashboardView session={session} onSubNav={setActiveModule} />;
      case 'patients':         return <PatientsView />;
      case 'consultation':     return <ConsultationView />;
      case 'prescriptions':    return <PrescriptionsView />;
      case 'lab-orders':       return <LabOrdersView />;
      case 'ward-round':       return <WardRoundView />;
      case 'appointments':     return <AppointmentsView />;
      case 'tasks':            return <TasksView />;
      case 'analytics':        return <AnalyticsView />;
      case 'emr':              return <EMRManager onNavigate={(m) => onNavigate(m)} />;
      case 'radiology-orders': return <Placeholder icon={Layers} label="Radiology Orders & PACS Viewer" description="Request X-Ray, CT, MRI, Ultrasound. View DICOM images and structured radiology reports inline." color="#F472B6" />;
      case 'referrals':        return <Placeholder icon={Send} label="Referral Management" description="Internal and external referrals, specialist consultations, inter-hospital transfers with clinical summaries and acceptance tracking." color="#10B981" />;
      case 'messages':         return <Placeholder icon={MessageSquare} label="Clinical Messaging" description="Secure clinician-to-clinician messaging, nurse escalations, department broadcasts, and ward-level notifications." color="#60A5FA" />;
      case 'admission':        return <Placeholder icon={UserPlus} label="Admissions & Discharge Planning" description="Patient admission requests, ward/bed allocation, transfer orders, and structured discharge planning with after-care instructions." color="#38BDF8" />;
      case 'settings':         return <Placeholder icon={Settings} label="Doctor Preferences" description="Notification settings, signature setup, prescription defaults, preferred investigation labs, portal shortcuts, and display configuration." color="#94A3B8" />;
      default:                 return <DashboardView session={session} onSubNav={setActiveModule} />;
    }
  };

  const current = NAV_ITEMS.find(i => i.key === activeModule);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Portal Sidebar */}
      <div style={{ width: sidebarCollapsed ? 54 : 224, flexShrink: 0, background: 'rgba(6,13,26,0.98)', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', transition: 'width 0.22s ease', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: sidebarCollapsed ? '12px 7px' : '12px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
              <img src="/medcore-logo.png" alt="MedCore" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontSize: '0.82rem', color: '#0A2540', fontWeight: 800, lineHeight: 1.1 }}>MedCore</div>
                <div style={{ fontSize: '0.64rem', color: '#0052D4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doctor Portal</div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setSidebarCollapsed(c => !c)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', borderRadius: 7, padding: '5px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Menu size={13} />
          </button>
        </div>

        {/* Time */}
        {!sidebarCollapsed && (
          <div style={{ padding: '9px 14px', borderBottom: '1px solid #FFFFFF' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0A2540', fontFamily: 'monospace' }}>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
              <span style={{ fontSize: '0.66rem', color: '#059669', fontWeight: 600 }}>Active Duty</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '9px 7px' }}>
          {NAV_ITEMS.map(item => {
            const active = activeModule === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setActiveModule(item.key)} title={sidebarCollapsed ? item.label : undefined}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? 0 : 9, padding: sidebarCollapsed ? '8px 0' : '8px 9px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, background: active ? 'rgba(2,132,199,0.18)' : 'transparent', transition: 'all 0.14s', position: 'relative' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {active && <span style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 3, background: '#0284C7', borderRadius: '0 3px 3px 0' }} />}
                <item.icon size={15} color={active ? '#38BDF8' : '#64748B'} />
                {!sidebarCollapsed && (
                  <>
                    <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: active ? 700 : 500, color: active ? '#F8FAFC' : '#94A3B8', textAlign: 'left' }}>{item.label}</span>
                    {item.badge !== undefined && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: active ? '#38BDF8' : '#64748B', background: active ? 'rgba(2,132,199,0.18)' : '#FFFFFF', border: `1px solid ${active ? 'rgba(2,132,199,0.38)' : '#E2E8F0'}`, borderRadius: 999, padding: '1px 6px' }}>{item.badge}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Exit */}
        {!sidebarCollapsed && (
          <div style={{ padding: '9px 7px', borderTop: '1px solid #FFFFFF' }}>
            <button type="button" onClick={() => onNavigate('command')} style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', padding: '7px 9px', borderRadius: 7, cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChevronsRight size={12} /> Exit to HospitalOS
            </button>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '10px 22px', borderBottom: '1px solid #FFFFFF', background: 'rgba(6,13,26,0.6)', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          {current && <current.icon size={15} color="#38BDF8" />}
          <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0A2540' }}>{current?.label || 'Doctor Portal'}</h2>
          <span style={{ flex: 1 }} />
          {[
            { label: '? 1 Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.11)', border: 'rgba(239,68,68,0.28)', nav: 'patients' },
            { label: '? 5 Pending Results', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.26)', nav: 'lab-orders' },
            { label: '? 3 Messages', color: '#0052D4', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.25)', nav: 'messages' },
          ].map(b => (
            <button key={b.label} type="button" onClick={() => setActiveModule(b.nav as SubModule)} style={{ fontSize: '0.66rem', fontWeight: 700, color: b.color, background: b.bg, border: `1px solid ${b.border}`, padding: '3px 10px', borderRadius: 999, cursor: 'pointer' }}>{b.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {renderContent()}
        </div>
      </div>

      <style>{`
        @keyframes docPortalPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
};

export default DoctorPortal;
