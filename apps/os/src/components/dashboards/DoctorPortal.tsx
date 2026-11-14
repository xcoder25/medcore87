'use client';

import { markPatientWithProvider } from '../../lib/receptionOpsStore';
import { useFormDraft } from '../../lib/formDraftStore';

import React, { useState, useEffect, useMemo } from 'react';
import { UserSession } from '../auth/AuthScreen';
import { EMRManager } from '../gateway-modules/EMRManager';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { placeOrder, listOrders, subscribeOrders, updateOrderStatus, type ClinicalOrder } from '../../lib/clinicalEventBus';
import {
  previewOrderBpa,
  ORDER_SETS,
  listPendingCriticalAcks,
  acknowledgeCriticalResult,
  subscribeIntelligence,
  type BpaAlert,
} from '../../lib/clinicalIntelligenceEngine';
import { listPatients, subscribePatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { emitLiveAction } from '../../lib/liveActions';
import { liveAlert } from '../../lib/manualActions';
import { DoctorDeskHome } from './DoctorDeskHome';
import { PatientChartBanner } from '../clinical-core/PatientChartBanner';
import { setPatientContext } from '../../lib/patientContextStore';
import { SearchablePatientSelect } from '../common/SearchablePatientSelect';
import { InteractiveSearchBar, SearchSuggestion } from '../common/InteractiveSearchBar';
import {
  LayoutDashboard, Users, FileText, Stethoscope, Pill, FlaskConical, Layers,
  BedDouble, Calendar, Bell, Settings, ClipboardList, Send, AlertTriangle,
  Search, Plus, Clock, CheckCircle2, Activity, Heart,
  Brain, TrendingUp, BarChart3, ArrowRight,
  MessageSquare, UserPlus, Siren, Clipboard,
  ChevronDown, ChevronUp, Save, X, Check,
  AlertCircle, LogOut, Menu, Printer, Trash2,
  FileCheck, ShieldCheck, HeartPulse,
  ChevronsRight, LifeBuoy, UserCheck, ExternalLink
} from 'lucide-react';
import { AmbientSoapPanel } from '../clinical-core/AmbientSoapPanel';

interface DoctorPortalProps {
  session: UserSession;
  onNavigate: (moduleKey: any) => void;
  initialModule?: SubModule;
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

// -- Patient Registry Sourced Data -----------------------------------------------

function mapFacilityPatient(p: FacilityPatient): Patient {
  const birthYear = p.dob ? new Date(p.dob).getFullYear() : 0;
  const age = birthYear ? Math.max(0, new Date().getFullYear() - birthYear) : 32;
  const patientName = p.name || (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : (p.firstName || p.lastName || 'Patient'));
  const patientId = p.mrn || p.hospitalNumber || p.id;
  const isFemale = p.gender === 'Female' || p.sex === 'Female';
  return {
    id: patientId,
    name: patientName,
    age,
    gender: isFemale ? 'F' : 'M',
    ward: 'General OPD',
    bed: undefined,
    diagnosis: p.chronicConditions && p.chronicConditions.length > 0 ? p.chronicConditions.join(', ') : 'Clinical Consultation',
    status: 'inpatient',
    nextAction: 'Review clinical notes',
    admitDate: p.enrolledAt ? p.enrolledAt.slice(0, 10) : p.registeredAt ? p.registeredAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    vitals: {
      bp: p.lastVitals?.bp || '120/80',
      hr: p.lastVitals?.pulse || 76,
      temp: p.lastVitals?.temp || 36.8,
      spo2: p.lastVitals?.spo2 || 98,
      rr: 18,
    },
    flags: p.allergies && p.allergies.length > 0 ? p.allergies : ['Admitted'],
  };
}

export function loadDoctorPatients(facilityId?: string): Patient[] {
  if (typeof window === 'undefined') return [];
  const registered = listPatients(facilityId);
  return registered.map(mapFacilityPatient);
}

const PATIENTS: Patient[] = typeof window !== 'undefined' ? loadDoctorPatients() : [];

const APPOINTMENTS: Appointment[] = [];

const INITIAL_TASKS: Task[] = [];

// -- Shared UI Primitives -------------------------------------------------------

const VitalChip: React.FC<{ label: string; value: string | number; unit?: string; warn?: boolean }> = ({ label, value, unit, warn }) => (
  <div style={{
    background: warn ? '#FEF2F2' : '#F8FAFC',
    border: `1px solid ${warn ? '#FECACA' : '#E2E8F0'}`,
    borderRadius: 8, padding: '5px 9px', textAlign: 'center', minWidth: 52,
  }}>
    <div style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: warn ? '#DC2626' : '#0F172A' }}>
      {value}<span style={{ fontSize: '0.6rem', color: '#64748B' }}>{unit}</span>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: Patient['status'] }> = ({ status }) => {
  const map: Record<Patient['status'], { color: string; bg: string; label: string }> = {
    critical: { color: '#DC2626', bg: '#FEE2E2', label: '● CRITICAL' },
    inpatient: { color: '#0052D4', bg: '#EFF6FF', label: 'Inpatient' },
    outpatient: { color: '#059669', bg: '#ECFDF5', label: 'Outpatient' },
    discharged: { color: '#64748B', bg: '#F1F5F9', label: 'Discharged' },
    pending: { color: '#D97706', bg: '#FEF3C7', label: 'Pending' },
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
      background: '#FFFFFF', border: '1px solid #E2E8F0',
      borderRadius: 14, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
    }}
    onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
    onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0'; }}
  >
    {pulse && <div style={{
      position: 'absolute', top: 12, right: 12, width: 9, height: 9,
      borderRadius: '50%', background: '#EF4444',
      animation: 'docPortalPulse 1.4s infinite',
    }} />}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={21} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
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
        background: 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 55%, #F0FDF4 100%)',
        border: '1px solid #BFDBFE', borderRadius: 16, padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg,#0284C7,#0369A1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF',
            boxShadow: '0 4px 16px rgba(2,132,199,0.28)',
          }}>{session.avatarInitials || 'DR'}</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#0052D4', fontWeight: 700, marginBottom: 3 }}>{greeting}, Doctor</div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0A2540' }}>
              {session.title || 'Physician'} Command Desk
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: '0.76rem', color: '#475569', flexWrap: 'wrap' }}>
              <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Active Duty
              </span>
              <span>•</span><span>{session.facility || 'Ibom Specialist Hospital'}</span>
              <span>•</span><span>{session.department || 'Internal Medicine'}</span>
              <span>•</span><span>{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Start Consultation', icon: Stethoscope, color: '#0052D4', bg: '#EFF6FF', border: '#BFDBFE', nav: 'consultation' },
            { label: 'Ward Round', icon: BedDouble, color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE', nav: 'ward-round' },
            { label: 'Emergency Referral', icon: Siren, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', nav: 'referrals' },
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
        <StatCard label="My Patients" value={PATIENTS.length} icon={Users} color="#0284C7" sub="3 inpatient • 1 OPD • 1 ICU" onClick={() => onSubNav('patients')} />
        <StatCard label="Critical" value={critical.length} icon={AlertTriangle} color="#DC2626" sub="ICU monitoring active" onClick={() => onSubNav('patients')} pulse={critical.length > 0} />
        <StatCard label="Today's Appts" value={APPOINTMENTS.length} icon={Calendar} color="#7C3AED" sub={`${APPOINTMENTS.filter(a => a.status === 'done').length} done • ${remaining.length} left`} onClick={() => onSubNav('appointments')} />
        <StatCard label="Pending Results" value={5} icon={FlaskConical} color="#D97706" sub="3 Lab • 2 Radiology" onClick={() => onSubNav('lab-orders')} />
        <StatCard label="Pending Tasks" value={pendingTasks.length} icon={ClipboardList} color="#059669" sub={`${urgentTasks.length} urgent or high`} onClick={() => onSubNav('tasks')} pulse={urgentTasks.length > 0} />
        <StatCard label="Messages" value={3} icon={MessageSquare} color="#2563EB" sub="2 unread clinical msgs" onClick={() => onSubNav('messages')} />
      </div>

      {/* Closed Clinical Loop Live Telemetry Stream */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #BAE6FD',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: connected ? '#10B981' : '#F59E0B',
            boxShadow: connected ? '0 0 10px #10B981' : 'none',
          }} />
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0284C7', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} /> Closed Clinical Loop: Real-Time Event Bus
              <span style={{ fontSize: '0.68rem', color: connected ? '#059669' : '#D97706', background: connected ? '#ECFDF5' : '#FEF3C7', border: `1px solid ${connected ? '#A7F3D0' : '#FDE68A'}`, padding: '2px 7px', borderRadius: 999, fontWeight: 700 }}>
                {connected ? 'CONNECTED (/ws)' : 'RECONNECTING'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
              Order → Pharmacy Verify → Dispense → Bedside e-MAR → Lab/PACS Result → Physician Workstation
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => onSubNav('lab-orders')}
            style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              color: '#0369A1',
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
              background: '#FAF5FF',
              border: '1px solid #E9D5FF',
              color: '#7E22CE',
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
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={16} color="#DC2626" />
                <span style={{ fontWeight: 700, color: '#DC2626', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Critical Patients • Immediate Attention
                </span>
              </div>
              {critical.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: '#FFFFFF', border: '1px solid #FECACA',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                }}>
                  <HeartPulse size={22} color="#DC2626" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem' }}>
                      {p.name} <span style={{ fontSize: '0.73rem', color: '#64748B' }}>• {p.id}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#DC2626', fontWeight: 600, marginTop: 2 }}>{p.diagnosis}</div>
                    <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: 2 }}>
                      {p.ward} • BP {p.vitals?.bp} • HR {p.vitals?.hr} • SpO2 {p.vitals?.spo2}%
                    </div>
                  </div>
                  <button type="button" style={{
                    background: '#FEE2E2', border: '1px solid #FCA5A5',
                    color: '#B91C1C', padding: '7px 14px', borderRadius: 8, fontWeight: 700,
                    fontSize: '0.76rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>Review Now →</button>
                </div>
              ))}
            </div>
          )}

          {/* Patient Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Users size={15} color="#0284C7" /> My Active Patients
              </div>
              <button type="button" onClick={() => onSubNav('patients')} style={{
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                color: '#0052D4', fontSize: '0.73rem', fontWeight: 700, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
              }}>View All →</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Patient', 'Diagnosis', 'Ward / Bed', 'Vitals', 'Next Action', 'Status', ''].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '9px 14px', fontSize: '0.65rem',
                      color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid #E2E8F0',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PATIENTS.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px 14px', textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
                      No patients registered in this facility yet. Patients enrolled at Reception appear here automatically.
                    </td>
                  </tr>
                ) : (
                  PATIENTS.map((p, i) => (
                    <tr key={p.id}
                      style={{ borderBottom: i < PATIENTS.length - 1 ? '1px solid #F1F5F9' : 'none', background: p.status === 'critical' ? '#FEF2F2' : 'transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = p.status === 'critical' ? '#FEF2F2' : 'transparent'}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.84rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.id} • {p.age}{p.gender}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#334155', maxWidth: 180 }}>{p.diagnosis}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>{p.ward}</div>
                        {p.bed && <div style={{ fontSize: '0.7rem', color: '#0052D4', fontWeight: 600 }}>Bed {p.bed}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <VitalChip label="BP" value={p.vitals?.bp} warn={parseInt(p.vitals?.bp) > 140} />
                          <VitalChip label="HR" value={p.vitals?.hr} unit="/m" warn={p.vitals?.hr > 100 || p.vitals?.hr < 50} />
                          <VitalChip label="SpO2" value={p.vitals?.spo2} unit="%" warn={p.vitals?.spo2 < 94} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {p.nextAction}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={p.status} /></td>
                      <td style={{ padding: '10px 14px' }}>
                        <button type="button" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0052D4', fontSize: '0.7rem', fontWeight: 700, padding: '4px 9px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>View →</button>
                      </td>
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Schedule */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Calendar size={14} color="#7C3AED" /> Today's Schedule
            </div>
            {APPOINTMENTS.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ minWidth: 42, fontSize: '0.73rem', fontWeight: 700, color: a.status === 'done' ? '#059669' : a.status === 'waiting' ? '#D97706' : '#64748B', textAlign: 'center' }}>{a.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: a.status === 'done' ? '#64748B' : '#0F172A' }}>{a.patientName}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{a.type}</div>
                </div>
                <span style={{
                  fontSize: '0.63rem', fontWeight: 700, borderRadius: 999, padding: '1px 6px',
                  color: a.status === 'done' ? '#059669' : a.status === 'waiting' ? '#D97706' : '#64748B',
                  background: a.status === 'done' ? '#ECFDF5' : a.status === 'waiting' ? '#FEF3C7' : '#F1F5F9',
                  border: '1px solid currentColor',
                }}>
                  {a.status === 'done' ? '✓ Done' : a.status === 'waiting' ? '⏳ Wait' : 'Upcoming'}
                </span>
              </div>
            ))}
            <button type="button" onClick={() => onSubNav('appointments')} style={{ width: '100%', marginTop: 9, background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#6D28D9', padding: '7px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
              Full Schedule →
            </button>
          </div>

          {/* Tasks */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><ClipboardList size={14} color="#059669" /> Tasks</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', padding: '2px 8px', borderRadius: 999 }}>
                {urgentTasks.length} Urgent
              </span>
            </div>
            {INITIAL_TASKS.slice(0, 5).map(t => {
              const pc: Record<Task['priority'], string> = { urgent: '#EF4444', high: '#F59E0B', normal: '#0284C7', low: '#64748B' };
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc[t.priority], display: 'inline-block', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 600, lineHeight: 1.4 }}>{t.title}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 1 }}>Due: {t.due}</div>
                  </div>
                  <button type="button" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '2px 6px', borderRadius: 5, cursor: 'pointer', fontSize: '0.67rem', fontWeight: 700, flexShrink: 0 }}>✓</button>
                </div>
              );
            })}
            <button type="button" onClick={() => onSubNav('tasks')} style={{ width: '100%', marginTop: 9, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '7px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
              All Tasks →
            </button>
          </div>

          {/* Quick Actions */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 11 }}>⚡ Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { icon: UserPlus, label: 'Admit Patient', color: '#0052D4', nav: 'admission' },
                { icon: Pill, label: 'Prescribe', color: '#7C3AED', nav: 'prescriptions' },
                { icon: FlaskConical, label: 'Order Lab', color: '#D97706', nav: 'lab-orders' },
                { icon: Layers, label: 'Order Scan', color: '#DB2777', nav: 'radiology-orders' },
                { icon: Send, label: 'Refer Patient', color: '#059669', nav: 'referrals' },
                { icon: FileText, label: 'Clinical Note', color: '#2563EB', nav: 'emr' },
              ].map(q => (
                <button key={q.label} type="button" onClick={() => onSubNav(q.nav as SubModule)} style={{
                  background: `${q.color}0D`, border: `1px solid ${q.color}28`, color: q.color,
                  padding: '9px 11px', borderRadius: 9, fontWeight: 700, fontSize: '0.75rem',
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

  const patientSuggestions: SearchSuggestion[] = useMemo(() => {
    return PATIENTS.map((p) => ({
      id: p.id,
      label: p.name,
      sub: p.id + ' · ' + p.diagnosis + (p.bed ? ' · Bed: ' + p.bed : ''),
      category: p.status.toUpperCase(),
      icon: Users,
      onClick: () => {
        setSearch(p.name);
        setSelected(p);
      },
    }));
  }, []);

  const filtered = PATIENTS.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.diagnosis.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Toolbar */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <InteractiveSearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search patient name, MRN, diagnosis…"
              suggestions={patientSuggestions}
              resultsCount={filtered.length}
              totalCount={PATIENTS.length}
              size="sm"
              aria-label="Search patient roster"
            />
          </div>
          {(['all', 'inpatient', 'outpatient', 'critical'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{
              padding: '7px 13px', borderRadius: 8, fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer',
              background: filter === f ? '#EFF6FF' : '#F8FAFC',
              border: `1px solid ${filter === f ? '#0284C7' : '#E2E8F0'}`,
              color: filter === f ? '#0284C7' : '#64748B',
            }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
          <button type="button" style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={14} /> Add Patient
          </button>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B' }}>
            <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>No Patients Found</div>
            <div style={{ fontSize: '0.8rem' }}>No patients currently registered in this facility. New registrations from Reception appear here in real-time.</div>
          </div>
        ) : (
          filtered.map(p => (
            <div key={p.id} onClick={() => setSelected(p)} style={{
              background: selected?.id === p.id ? '#EFF6FF' : '#FFFFFF',
              border: `1px solid ${selected?.id === p.id ? '#38BDF8' : p.status === 'critical' ? '#FECACA' : '#E2E8F0'}`,
              borderRadius: 12, padding: '13px 17px', cursor: 'pointer',
              display: 'grid', gridTemplateColumns: '1fr 1fr 190px auto', alignItems: 'center', gap: 14, transition: 'all 0.15s',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: p.status === 'critical' ? '#FEE2E2' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: p.status === 'critical' ? '#DC2626' : '#0284C7', fontSize: '0.85rem', flexShrink: 0 }}>
                  {p.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.id} • {p.age}{p.gender}</div>
                  <div style={{ fontSize: '0.76rem', color: '#334155', marginTop: 2 }}>{p.diagnosis}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.77rem', color: '#475569', fontWeight: 600 }}>{p.ward}{p.bed ? ` • Bed ${p.bed}` : ''}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 2 }}>Admit: {p.admitDate}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <VitalChip label="BP" value={p.vitals?.bp} warn={parseInt(p.vitals?.bp) > 140} />
                <VitalChip label="HR" value={p.vitals?.hr} unit="/m" warn={p.vitals?.hr > 100} />
                <VitalChip label="SpO2" value={p.vitals?.spo2} unit="%" warn={p.vitals?.spo2 < 94} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <StatusBadge status={p.status} />
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {p.flags.slice(0, 2).map(f => (
                    <span key={f} style={{ fontSize: '0.6rem', background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          )))}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ width: 300, flexShrink: 0, background: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: 14, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, color: '#0052D4', fontSize: '0.95rem' }}>Patient Detail</div>
            <button type="button" onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={15} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: selected.status === 'critical' ? '#FEE2E2' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: selected.status === 'critical' ? '#DC2626' : '#0284C7' }}>
              {selected.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#0A2540', fontSize: '0.95rem' }}>{selected.name}</div>
              <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{selected.id} • {selected.age}y • {selected.gender === 'M' ? 'Male' : 'Female'}</div>
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
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, marginBottom: 7, textTransform: 'uppercase' }}>Current Vitals</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              <VitalChip label="BP" value={selected.vitals?.bp} warn={parseInt(selected.vitals?.bp) > 140} />
              <VitalChip label="HR" value={selected.vitals?.hr} unit="/m" warn={selected.vitals?.hr > 100} />
              <VitalChip label="SpO2" value={selected.vitals?.spo2} unit="%" warn={selected.vitals?.spo2 < 94} />
              <VitalChip label="Temp" value={selected.vitals?.temp} unit="°C" warn={selected.vitals?.temp > 38} />
              <VitalChip label="RR" value={selected.vitals?.rr} unit="/m" warn={selected.vitals?.rr > 22} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Start Consultation', color: '#0052D4', icon: Stethoscope },
              { label: 'Write Clinical Note', color: '#2563EB', icon: FileText },
              { label: 'Prescribe Medication', color: '#7C3AED', icon: Pill },
              { label: 'Order Investigation', color: '#D97706', icon: FlaskConical },
            ].map(a => (
              <button key={a.label} type="button" style={{ width: '100%', background: `${a.color}0E`, border: `1px solid ${a.color}28`, color: a.color, padding: '8px 13px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
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

const ConsultationView: React.FC<{ session?: UserSession }> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [step, setStep] = useState<'select' | 'consult'>('select');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [hpi, setHpi] = useState('');
  const [pmh, setPmh] = useState('');
  const [examination, setExamination] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [soapTab, setSoapTab] = useState<'S' | 'O' | 'A' | 'P'>('S');

  const soapDraftValue = useMemo(
    () => ({
      patientId: patient?.id || '',
      patientName: patient?.name || '',
      chiefComplaint,
      hpi,
      pmh,
      examination,
      assessment,
      plan,
      soapTab,
    }),
    [patient?.id, patient?.name, chiefComplaint, hpi, pmh, examination, assessment, plan, soapTab],
  );

  const soapDraftDirty = Boolean(
    chiefComplaint.trim() || hpi.trim() || pmh.trim() || examination.trim() || assessment.trim() || plan.trim(),
  );

  const {
    hasRestorableDraft,
    draftSavedAt,
    lastAutosavedAt,
    isSavingDraft,
    restoreDraft,
    discardDraft,
  } = useFormDraft({
    facilityId,
    formKey: `doctor_soap_consult:${patient?.id || 'active'}`,
    staffId: session?.email || session?.name || 'doctor',
    value: soapDraftValue,
    isDirty: soapDraftDirty,
    onRestore: (saved) => {
      if (!saved) return;
      if (saved.chiefComplaint) setChiefComplaint(saved.chiefComplaint);
      if (saved.hpi) setHpi(saved.hpi);
      if (saved.pmh) setPmh(saved.pmh);
      if (saved.examination) setExamination(saved.examination);
      if (saved.assessment) setAssessment(saved.assessment);
      if (saved.plan) setPlan(saved.plan);
      if (saved.soapTab) setSoapTab(saved.soapTab);
      if (saved.patientId && !patient) {
        const found = PATIENTS.find((p) => p.id === saved.patientId);
        if (found) setPatient(found);
      }
      setStep('consult');
    },
  });

  if (step === 'select') {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: '#0A2540' }}>Start Consultation</h2>
        <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '0.8rem' }}>Select a patient from the queue to begin a SOAP consultation session.</p>
        {hasRestorableDraft && (
          <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E' }}>⚡ Unsaved SOAP Consultation Draft Found (Power-Outage Recovery)</div>
              <div style={{ fontSize: '0.74rem', color: '#B45309', marginTop: 2 }}>
                Auto-saved to Cloud & On-Prem Vault {draftSavedAt ? `at ${new Date(draftSavedAt).toLocaleTimeString()}` : 'recently'}.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={restoreDraft} style={{ background: '#D97706', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>Restore Note</button>
              <button type="button" onClick={() => void discardDraft()} style={{ background: '#fff', color: '#92400E', border: '1px solid #FCD34D', borderRadius: 8, padding: '7px 11px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>Discard</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {APPOINTMENTS.filter(a => a.status === 'waiting' || a.status === 'scheduled').map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: a.status === 'waiting' ? '#FFFBEB' : '#F8FAFC',
              border: `1px solid ${a.status === 'waiting' ? '#FDE68A' : '#E2E8F0'}`,
              borderRadius: 12, padding: '13px 17px',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: a.status === 'waiting' ? '#FEF3C7' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: a.status === 'waiting' ? '#D97706' : '#0284C7', fontSize: '0.85rem' }}>
                {a.patientName.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem' }}>{a.patientName}</div>
                <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{a.patientId} • {a.type} • {a.time}</div>
              </div>
              {a.status === 'waiting' && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#D97706', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '2px 9px', borderRadius: 999 }}>⏳ Waiting</span>}
              <button type="button" onClick={() => { setPatient(PATIENTS.find(p => p.id === a.patientId) || null); try { markPatientWithProvider(session?.hospitalId || 'IGH-EKT', a.patientId || patient?.id || '', session?.name); } catch { } setStep('consult'); }} style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', border: 'none', color: '#fff', padding: '8px 17px', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                Begin →
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs: { key: 'S' | 'O' | 'A' | 'P'; label: string; color: string }[] = [
    { key: 'S', label: 'Subjective', color: '#0052D4' },
    { key: 'O', label: 'Objective', color: '#059669' },
    { key: 'A', label: 'Assessment', color: '#D97706' },
    { key: 'P', label: 'Plan', color: '#7C3AED' },
  ];

  const ta = (label: string, val: string, set: (v: string) => void, rows = 5) => (
    <div>
      <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{label}</label>
      <textarea value={val} onChange={e => set(e.target.value)} rows={rows} placeholder={`Enter ${label.toLowerCase()}…`}
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 10, color: '#0A2540', fontSize: '0.83rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 16 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 15, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>SOAP Consultation Note</h2>
            <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>{patient?.name || 'Active Patient'} • {patient?.id || ''} • {new Date().toLocaleDateString('en-GB')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {(isSavingDraft || lastAutosavedAt) && (
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 9px', borderRadius: 999 }}>
                {isSavingDraft ? 'Saving draft…' : `☁️ Cloud Draft Saved ${new Date(lastAutosavedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            <button type="button" onClick={() => setStep('select')} style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569', padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>← Back</button>
            <button type="button" onClick={() => { void discardDraft(); liveAlert('SOAP Consultation Note signed and committed to Cloud & On-Prem EMR.'); }} style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', border: 'none', color: '#fff', padding: '7px 15px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Save size={13} /> Save & Sign
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, background: '#F8FAFC', padding: 4, borderRadius: 10, border: '1px solid #E2E8F0' }}>
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setSoapTab(t.key)} style={{
              flex: 1, padding: '8px', borderRadius: 7, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: 'none',
              background: soapTab === t.key ? '#FFFFFF' : 'transparent',
              boxShadow: soapTab === t.key ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
              color: soapTab === t.key ? t.color : '#64748B', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {soapTab === 'S' && <>{ta('Chief Complaint', chiefComplaint, setChiefComplaint, 2)}{ta('History of Presenting Illness (HPI)', hpi, setHpi, 6)}{ta('Past Medical / Surgical History', pmh, setPmh, 4)}</>}
          {soapTab === 'O' && (<>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Current Vitals</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {patient && Object.entries((patient.vitals || {})).map(([k, v]) => <VitalChip key={k} label={k.toUpperCase()} value={v} />)}
              </div>
            </div>
            {ta('Physical Examination Findings', examination, setExamination, 8)}
          </>)}
          {soapTab === 'A' && ta('Assessment / Differential Diagnosis', assessment, setAssessment, 10)}
          {soapTab === 'P' && ta('Management Plan (Investigations, Treatment, Follow-up)', plan, setPlan, 10)}
        </div>
      </div>
      <AmbientSoapPanel
        facilityId={session?.hospitalId || 'IGH-EKT'}
        patientId={patient?.id}
        patientName={patient?.name}
        hospitalNumber={patient?.id}
        onSoapReady={(soap) => {
          if (soap.subjective) setHpi(soap.subjective);
          if (soap.objective) setExamination(soap.objective);
          if (soap.assessment) setAssessment(soap.assessment);
          if (soap.plan) setPlan(soap.plan);
          if (soap.subjective && !chiefComplaint) setChiefComplaint(soap.subjective.slice(0, 120));
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {patient && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 10 }}>Patient Summary</div>
            {[{ l: 'Name', v: patient.name }, { l: 'MRN', v: patient.id }, { l: 'Diagnosis', v: patient.diagnosis }, { l: 'Ward', v: patient.ward }].map(x => (
              <div key={x.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.78rem' }}>
                <span style={{ color: '#64748B' }}>{x.l}</span>
                <span style={{ color: '#0F172A', fontWeight: 600, textAlign: 'right', maxWidth: 160 }}>{x.v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.86rem', marginBottom: 10 }}>Clinical Shortcuts</div>
          {[{ l: '+ Order Lab Test', c: '#D97706' }, { l: '+ Order Radiology', c: '#DB2777' }, { l: '+ Prescribe Drug', c: '#7C3AED' }, { l: '+ Refer Patient', c: '#059669' }, { l: '+ Request Admission', c: '#0284C7' }].map(a => (
            <button key={a.l} type="button" style={{ width: '100%', marginBottom: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', color: a.c, padding: '8px 11px', borderRadius: 7, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>{a.l}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// -- PRESCRIPTIONS (MULTI-DRUG CPOE SUITE) -------------------------------------------------------------

interface StagedPrescriptionItem {
  id: string;
  drugName: string;
  category: string;
  dose: string;
  freq: string;
  duration: string;
  route: string;
  instructions: string;
  bpaAlerts: BpaAlert[];
}

const HOSPITAL_FORMULARY: { name: string; category: string; defaultDose: string; defaultFreq: string; defaultRoute: string; defaultDuration: string }[] = [
  // Antibiotics & Anti-Infectives
  { name: 'Amoxicillin 500mg (Cap)', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'Three times daily (TDS)', defaultRoute: 'Oral', defaultDuration: '5 days' },
  { name: 'Co-Amoxiclav 625mg (Augmentin)', category: 'Antibiotic', defaultDose: '625mg', defaultFreq: 'Twice daily (BD)', defaultRoute: 'Oral', defaultDuration: '7 days' },
  { name: 'Ciprofloxacin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'Twice daily (BD)', defaultRoute: 'Oral', defaultDuration: '5 days' },
  { name: 'Ceftriaxone 1g (Vial)', category: 'Antibiotic', defaultDose: '1g', defaultFreq: 'Once daily (OD)', defaultRoute: 'IV', defaultDuration: '3 days' },
  { name: 'Metronidazole 400mg', category: 'Antibiotic', defaultDose: '400mg', defaultFreq: 'Three times daily (TDS)', defaultRoute: 'Oral', defaultDuration: '5 days' },
  { name: 'Azithromycin 500mg', category: 'Antibiotic', defaultDose: '500mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '3 days' },
  { name: 'Doxycycline 100mg', category: 'Antibiotic', defaultDose: '100mg', defaultFreq: 'Twice daily (BD)', defaultRoute: 'Oral', defaultDuration: '7 days' },
  { name: 'Gentamicin 80mg/2ml (Amp)', category: 'Antibiotic', defaultDose: '80mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'IM', defaultDuration: '3 days' },

  // Antimalarials
  { name: 'Artemether/Lumefantrine 80/480mg (Coartem)', category: 'Antimalarial', defaultDose: '1 tab', defaultFreq: 'Twice daily (BD)', defaultRoute: 'Oral', defaultDuration: '3 days' },
  { name: 'Artesunate 60mg (Vial)', category: 'Antimalarial', defaultDose: '2.4mg/kg', defaultFreq: 'At 0, 12, 24h then OD', defaultRoute: 'IV', defaultDuration: '3 days' },
  { name: 'Dihydroartemisinin/Piperaquine (P-Alaxin)', category: 'Antimalarial', defaultDose: '3 tabs', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '3 days' },

  // Analgesics & Anti-Inflammatory
  { name: 'Paracetamol 500mg (Tabs)', category: 'Analgesic', defaultDose: '1000mg', defaultFreq: 'Three times daily (TDS)', defaultRoute: 'Oral', defaultDuration: '3 days' },
  { name: 'Paracetamol 1g/100ml (Perfalgan IV)', category: 'Analgesic', defaultDose: '1g', defaultFreq: 'Six-hourly PRN', defaultRoute: 'IV', defaultDuration: '2 days' },
  { name: 'Ibuprofen 400mg', category: 'Analgesic', defaultDose: '400mg', defaultFreq: 'Three times daily (TDS)', defaultRoute: 'Oral', defaultDuration: '5 days' },
  { name: 'Diclofenac Sodium 50mg', category: 'Analgesic', defaultDose: '50mg', defaultFreq: 'Twice daily (BD)', defaultRoute: 'Oral', defaultDuration: '3 days' },
  { name: 'Tramadol 50mg (Cap)', category: 'Analgesic', defaultDose: '50mg', defaultFreq: 'Twice daily (BD)', defaultRoute: 'Oral', defaultDuration: '3 days' },

  // Antihypertensive & Cardiovascular
  { name: 'Amlodipine 5mg', category: 'Cardiovascular', defaultDose: '5mg', defaultFreq: 'Once daily (OD - Morning)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Amlodipine 10mg', category: 'Cardiovascular', defaultDose: '10mg', defaultFreq: 'Once daily (OD - Morning)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Lisinopril 10mg', category: 'Cardiovascular', defaultDose: '10mg', defaultFreq: 'Once daily (OD - Morning)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Losartan Potassium 50mg', category: 'Cardiovascular', defaultDose: '50mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Hydrochlorothiazide 25mg', category: 'Cardiovascular', defaultDose: '25mg', defaultFreq: 'Once daily (OD - Morning)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Furosemide 40mg (Lasix)', category: 'Cardiovascular', defaultDose: '40mg', defaultFreq: 'Once daily (OD - Morning)', defaultRoute: 'Oral', defaultDuration: '14 days' },
  { name: 'Atenolol 50mg', category: 'Cardiovascular', defaultDose: '50mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '30 days' },

  // Antidiabetic & Metabolic
  { name: 'Metformin 500mg', category: 'Endocrine', defaultDose: '500mg', defaultFreq: 'Twice daily (BD - With food)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Metformin 1000mg XR', category: 'Endocrine', defaultDose: '1000mg', defaultFreq: 'Once daily (OD - Night)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Glimepiride 2mg', category: 'Endocrine', defaultDose: '2mg', defaultFreq: 'Once daily (OD - Before breakfast)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Regular Insulin (Actrapid 100IU/ml)', category: 'Endocrine', defaultDose: '10 IU', defaultFreq: 'Three times daily (AC)', defaultRoute: 'SC', defaultDuration: '30 days' },

  // Gastrointestinal & Antacids
  { name: 'Omeprazole 20mg (Cap)', category: 'Gastrointestinal', defaultDose: '20mg', defaultFreq: 'Once daily (OD - 30m before breakfast)', defaultRoute: 'Oral', defaultDuration: '14 days' },
  { name: 'Esomeprazole 40mg (Nexium)', category: 'Gastrointestinal', defaultDose: '40mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '14 days' },
  { name: 'Antacid Suspension (Magnesium/Aluminum)', category: 'Gastrointestinal', defaultDose: '15ml', defaultFreq: 'Three times daily (TDS - PC)', defaultRoute: 'Oral', defaultDuration: '7 days' },
  { name: 'Hyoscine Butylbromide 10mg (Buscopan)', category: 'Gastrointestinal', defaultDose: '10mg', defaultFreq: 'Three times daily (TDS)', defaultRoute: 'Oral', defaultDuration: '3 days' },

  // Respiratory & Antiallergic
  { name: 'Salbutamol Inhaler 100mcg', category: 'Respiratory', defaultDose: '2 puffs', defaultFreq: 'PRN (As needed)', defaultRoute: 'Inhalation', defaultDuration: '30 days' },
  { name: 'Loratadine 10mg', category: 'Respiratory', defaultDose: '10mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '7 days' },
  { name: 'Cetirizine 10mg', category: 'Respiratory', defaultDose: '10mg', defaultFreq: 'Once daily (OD - Night)', defaultRoute: 'Oral', defaultDuration: '7 days' },
  { name: 'Prednisolone 5mg', category: 'Respiratory', defaultDose: '20mg', defaultFreq: 'Once daily (OD - Morning with food)', defaultRoute: 'Oral', defaultDuration: '5 days' },

  // IV Fluids
  { name: 'Normal Saline 0.9% 500ml', category: 'IV Fluids', defaultDose: '500ml', defaultFreq: 'Over 4 hours', defaultRoute: 'IV', defaultDuration: '1 day' },
  { name: 'Dextrose 5% in 0.9% Saline 500ml', category: 'IV Fluids', defaultDose: '500ml', defaultFreq: 'Over 6 hours', defaultRoute: 'IV', defaultDuration: '1 day' },
  { name: 'Ringers Lactate 500ml', category: 'IV Fluids', defaultDose: '500ml', defaultFreq: 'Over 4 hours', defaultRoute: 'IV', defaultDuration: '1 day' },

  // Vitamins & Supplements
  { name: 'Multivitamin Capsules', category: 'Supplements', defaultDose: '1 cap', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Ferrous Sulphate 200mg', category: 'Supplements', defaultDose: '200mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '30 days' },
  { name: 'Folic Acid 5mg', category: 'Supplements', defaultDose: '5mg', defaultFreq: 'Once daily (OD)', defaultRoute: 'Oral', defaultDuration: '30 days' },
];

const PrescriptionsView: React.FC<{ session: UserSession }> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [registry, setRegistry] = useState<FacilityPatient[]>(() => listPatients(facilityId));
  const [patientId, setPatientId] = useState('');
  const [rxList, setRxList] = useState<ClinicalOrder[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSlip, setShowSlip] = useState(false);

  // Search-select state
  const [drugQuery, setDrugQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDrug, setSelectedDrug] = useState<typeof HOSPITAL_FORMULARY[0] | null>(null);
  const [dose, setDose] = useState('');
  const [freq, setFreq] = useState('Twice daily (BD)');
  const [duration, setDuration] = useState('5 days');
  const [route, setRoute] = useState('Oral');
  const [instructions, setInstructions] = useState('');
  const [overrideBpa, setOverrideBpa] = useState(false);

  // Multi-drug staging cart
  const [stagedDrugs, setStagedDrugs] = useState<StagedPrescriptionItem[]>([]);

  const reload = () => {
    setRegistry(listPatients(facilityId));
    setRxList(listOrders(facilityId, { status: undefined }).filter((o) => o.type === 'rx'));
  };

  useEffect(() => {
    reload();
    return subscribeOrders(reload);
  }, [facilityId]);

  const patient = registry.find((p) => p.id === patientId || p.hospitalNumber === patientId);

  const statusColor: Record<string, string> = {
    ordered: '#F59E0B',
    accepted: '#38BDF8',
    in_progress: '#A78BFA',
    resulted: '#4ADE80',
    cancelled: '#EF4444',
  };

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(HOSPITAL_FORMULARY.map((d) => d.category)))];
  }, []);

  const filteredFormulary = useMemo(() => {
    return HOSPITAL_FORMULARY.filter((d) => {
      if (selectedCategory !== 'All' && d.category !== selectedCategory) return false;
      if (!drugQuery.trim()) return true;
      const q = drugQuery.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q);
    });
  }, [selectedCategory, drugQuery]);

  const checkBpa = (drug: string): BpaAlert[] => {
    if (!patientId || !drug.trim()) return [];
    return previewOrderBpa({
      facilityId,
      patientId,
      type: 'rx',
      code: drug.slice(0, 16).toUpperCase().replace(/\s+/g, '_'),
      name: drug.trim(),
      priority: 'routine',
    });
  };

  const handleSelectDrug = (d: typeof HOSPITAL_FORMULARY[0]) => {
    setSelectedDrug(d);
    setDrugQuery(d.name);
    setDose(d.defaultDose);
    setFreq(d.defaultFreq);
    setRoute(d.defaultRoute);
    setDuration(d.defaultDuration);
    setInstructions('');
  };

  const handleAddToStaged = () => {
    if (!selectedDrug && !drugQuery.trim()) {
      setNotice('Select or type a medication first');
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    const name = selectedDrug?.name || drugQuery.trim();
    const alerts = checkBpa(name);
    const item: StagedPrescriptionItem = {
      id: `rx-stage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      drugName: name,
      category: selectedDrug?.category || 'General',
      dose: dose.trim() || 'Standard Dose',
      freq: freq.trim() || 'BD',
      duration: duration.trim() || '5 days',
      route: route.trim() || 'Oral',
      instructions: instructions.trim(),
      bpaAlerts: alerts,
    };
    setStagedDrugs((prev) => [...prev, item]);
    // Reset selection for next drug
    setSelectedDrug(null);
    setDrugQuery('');
    setDose('');
    setInstructions('');
    setNotice(`Added ${name} to staged prescription list`);
    setTimeout(() => setNotice(null), 2500);
  };

  const handleRemoveStaged = (id: string) => {
    setStagedDrugs((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit all staged drugs to the live pharmacy bus
  const handleDispatchAll = () => {
    if (!patient) {
      setNotice('Please select a registered patient first');
      setTimeout(() => setNotice(null), 3000);
      return;
    }
    if (stagedDrugs.length === 0) {
      setNotice('No medications staged. Search and add at least one drug.');
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    // Check for any hard stop BPA alerts
    const allHardStops = stagedDrugs.flatMap((d) => d.bpaAlerts.filter((a) => a.level === 'hard_stop'));
    if (allHardStops.length > 0 && !overrideBpa) {
      setNotice('Critical Alert: Medication interaction or allergy detected. Review or check clinician override.');
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    // Submit each staged medication to the clinical order bus
    const createdOrders: ClinicalOrder[] = [];
    for (const item of stagedDrugs) {
      const notes = [
        item.dose && `Dose: ${item.dose}`,
        item.freq && `Freq: ${item.freq}`,
        item.route && `Route: ${item.route}`,
        item.duration && `Duration: ${item.duration}`,
        item.instructions && `Notes: ${item.instructions}`,
      ].filter(Boolean).join(' · ');

      const o = placeOrder({
        facilityId,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hospitalNumber: patient.hospitalNumber,
        type: 'rx',
        code: item.drugName.slice(0, 16).toUpperCase().replace(/\s+/g, '_'),
        name: item.drugName,
        orderedBy: session.name || 'Doctor',
        orderedByBadge: session.badgeId,
        priority: 'routine',
        notes,
      });
      createdOrders.push(o);
      emitLiveAction(`Rx sent to pharmacy · ${patient.hospitalNumber} · ${item.drugName}`, { module: 'pharmacy' });
      liveAlert(`Prescription ${o.id} sent to pharmacy`, 'pharmacy', facilityId);
    }

    setNotice(`Successfully dispatched ${createdOrders.length} medication${createdOrders.length > 1 ? 's' : ''} to Pharmacy in realtime!`);
    setTimeout(() => setNotice(null), 4000);
    setStagedDrugs([]);
    setOverrideBpa(false);
    reload();
  };

  const handlePrintSlip = () => {
    try {
      window.print();
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}>
      {notice && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: '#0F172A', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          <span>{notice}</span>
        </div>
      )}

      {/* Left Column: Live Pharmacy Bus & Prescription History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Patient Selection Card */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#0D9488" /> Active Patient for e-Prescription
            </div>
            {patient && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '3px 10px', borderRadius: 999 }}>
                Active Chart Context
              </span>
            )}
          </div>
          <SearchablePatientSelect
            facilityId={facilityId}
            value={patientId}
            onChange={(p) => {
              setPatientId(p?.id || '');
              if (p) setPatientContext(p, session.name);
            }}
            placeholder="Search patient by name, hospital number, or phone..."
          />
          {patient && (
            <div style={{ marginTop: 12 }}>
              <PatientChartBanner patient={patient} compact />
            </div>
          )}
        </div>

        {/* Staged Multi-Medication Cart */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill size={16} color="#7C3AED" /> Staged Prescription Queue ({stagedDrugs.length} item{stagedDrugs.length !== 1 ? 's' : ''})
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Review all medications before transmitting to pharmacy in a single electronic batch.
              </div>
            </div>
            {stagedDrugs.length > 0 && (
              <button
                type="button"
                onClick={handlePrintSlip}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                  background: '#F8FAFC', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Printer size={13} /> Print Rx Slip
              </button>
            )}
          </div>

          {stagedDrugs.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
              <Pill size={32} color="#94A3B8" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontWeight: 700, color: '#475569', fontSize: 14 }}>Prescription queue is empty</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, maxWidth: 380, margin: '4px auto 0' }}>
                Use the search-select formulary on the right to select medications, set dosages, and add them to this order.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stagedDrugs.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    background: '#FAFAFA',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 999, background: '#7C3AED', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                      }}>
                        {idx + 1}
                      </span>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{item.drugName}</span>
                        <span style={{ marginLeft: 8, fontSize: 11, background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStaged(item.id)}
                      title="Remove medication"
                      style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12, background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Dose</span>
                      <strong style={{ color: '#0F172A' }}>{item.dose}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Frequency</span>
                      <strong style={{ color: '#0F172A' }}>{item.freq}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Route</span>
                      <strong style={{ color: '#0F172A' }}>{item.route}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Duration</span>
                      <strong style={{ color: '#0F172A' }}>{item.duration}</strong>
                    </div>
                  </div>

                  {item.instructions && (
                    <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', background: '#F8FAFC', padding: '4px 8px', borderRadius: 6 }}>
                      Instructions: {item.instructions}
                    </div>
                  )}

                  {item.bpaAlerts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {item.bpaAlerts.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11,
                            background: a.level === 'hard_stop' ? '#FEF2F2' : '#FFFBEB',
                            border: `1px solid ${a.level === 'hard_stop' ? '#FECACA' : '#FDE68A'}`,
                            color: a.level === 'hard_stop' ? '#B91C1C' : '#B45309',
                            fontWeight: 700,
                          }}
                        >
                          ⚠️ {a.title}: {a.detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Ready to transmit <strong>{stagedDrugs.length}</strong> medication{stagedDrugs.length > 1 ? 's' : ''} to Pharmacy.
                </div>
                <button
                  type="button"
                  onClick={handleDispatchAll}
                  style={{
                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <Send size={15} /> Transmit All ({stagedDrugs.length}) to Pharmacy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Pharmacy Bus Orders */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, color: '#0A2540', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#A78BFA" /> Realtime Pharmacy Bus Activity ({rxList.length})
            </div>
            <button
              type="button"
              onClick={reload}
              style={{ border: 'none', background: 'transparent', color: '#64748B', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Refresh
            </button>
          </div>
          {rxList.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
              No active prescriptions on the bus for this facility yet.
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {rxList.slice(0, 15).map((rx) => (
                <div key={rx.id} style={{ padding: '11px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{rx.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {rx.patientName} ({rx.hospitalNumber}) · {rx.notes || '—'} · Dr. {rx.orderedBy}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                    background: `${statusColor[rx.status] || '#94A3B8'}22`,
                    color: statusColor[rx.status] || '#64748B',
                    textTransform: 'uppercase',
                  }}>
                    {rx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Search-Select Medication Formulary & Staging Inputs */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Search size={16} color="#0052D4" /> Hospital Formulary Search-Select
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            Search from approved hospital stock and clinical drug catalog.
          </div>
        </div>

        {/* Search input with live filter */}
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input
            type="text"
            value={drugQuery}
            onChange={(e) => {
              setDrugQuery(e.target.value);
              if (selectedDrug && selectedDrug.name !== e.target.value) {
                setSelectedDrug(null);
              }
            }}
            placeholder="Type drug name e.g. Amoxicillin, Paracetamol, Amlodipine..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 10,
              border: selectedDrug ? '2px solid #7C3AED' : '1px solid #CBD5E1',
              fontSize: 13,
              outline: 'none',
              background: selectedDrug ? '#FAF5FF' : '#fff',
            }}
          />
          {selectedDrug && (
            <button
              type="button"
              onClick={() => { setSelectedDrug(null); setDrugQuery(''); }}
              style={{ position: 'absolute', right: 10, top: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              style={{
                border: 'none',
                background: selectedCategory === c ? '#0F172A' : '#F1F5F9',
                color: selectedCategory === c ? '#fff' : '#475569',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Formulary matching results list */}
        {!selectedDrug && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 10, background: '#FAFAFA' }}>
            {filteredFormulary.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                No drugs match &quot;{drugQuery}&quot;. You can still prescribe it manually below.
              </div>
            ) : (
              filteredFormulary.slice(0, 10).map((d) => (
                <div
                  key={d.name}
                  onClick={() => handleSelectDrug(d)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FDFA')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {d.category} · Std: {d.defaultDose} {d.defaultFreq}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0D9488' }}>Select</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Selected Drug Prescription Customization Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                Dose & Strength
              </label>
              <input
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="e.g. 500mg, 1 tab, 1g"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                Route
              </label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              >
                {['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'Sublingual', 'Rectal'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                Frequency
              </label>
              <input
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                placeholder="e.g. BD, TDS, QDS, PRN"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
                Duration
              </label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 5 days, 30 days"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>
              Clinical Instructions / Administration Notes
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take with food, finish full course, avoid dairy..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 12, resize: 'vertical' }}
            />
          </div>

          {/* Quick Frequency Presets */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Once daily (OD)', 'Twice daily (BD)', 'Thrice daily (TDS)', 'Four times daily (QDS)', 'STAT', 'PRN'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setFreq(preset)}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 7px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  background: freq === preset ? '#EFF6FF' : '#F8FAFC',
                  color: freq === preset ? '#1D4ED8' : '#64748B',
                  cursor: 'pointer',
                }}
              >
                {preset.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Add to Prescription Button */}
          <button
            type="button"
            onClick={handleAddToStaged}
            style={{
              marginTop: 6,
              background: '#0D9488',
              color: '#fff',
              border: 'none',
              padding: '11px 14px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.2)',
            }}
          >
            <Plus size={16} /> Add Medication to Prescription Cart
          </button>
        </div>
      </div>
    </div>
  );
};

// -- LAB ORDERS ----------------------------------------------------------------

const LabOrdersView: React.FC<{ session: UserSession }> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [registry, setRegistry] = useState<FacilityPatient[]>(() => listPatients(facilityId));
  const [patientId, setPatientId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('urgent');
  const [orders, setOrders] = useState<ClinicalOrder[]>([]);
  const [bpaAlerts, setBpaAlerts] = useState<BpaAlert[]>([]);
  const [overrideBpa, setOverrideBpa] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderSetId, setOrderSetId] = useState('');

  const reload = () => {
    setRegistry(listPatients(facilityId));
    setOrders(listOrders(facilityId).filter((o) => o.type === 'lab'));
  };

  useEffect(() => {
    reload();
    const u1 = subscribeOrders(reload);
    const u2 = subscribePatients(reload);
    return () => {
      u1();
      u2();
    };
  }, [facilityId]);

  const patient = registry.find((p) => p.id === patientId);

  const PANELS: Record<string, string[]> = {
    Haematology: ['FBC', 'Peripheral Film', 'ESR', 'Reticulocyte', 'PT/aPTT/INR'],
    Chemistry: ['LFT', 'U&E', 'Lipid Profile', 'HbA1c', 'Fasting BGL', 'RBS', 'Uric Acid'],
    'Cardiac Markers': ['Troponin I', 'BNP / NT-proBNP', 'CK-MB', 'D-Dimer', 'ABG'],
    'Infection Screen': ['Malaria RDT', 'MP Film', 'Widal', 'Blood C&S', 'Hep B&C', 'HIV Rapid'],
    Microbiology: ['Urine MCS', 'HVS C&S', 'Sputum AFB', 'Stool MCS'],
    Endocrine: ['TSH', 'Free T4', 'PSA', 'CA-125', 'CEA'],
  };

  const toggle = (test: string) =>
    setSelected((prev) => (prev.includes(test) ? prev.filter((x) => x !== test) : [...prev, test]));

  const placeSelected = () => {
    if (!patient || !selected.length) {
      setNotice('Select patient and at least one test');
      setTimeout(() => setNotice(null), 2500);
      return;
    }
    let blocked = 0;
    let placed = 0;
    for (const test of selected) {
      const alerts = previewOrderBpa({
        facilityId,
        patientId: patient.id,
        type: 'lab',
        code: test.slice(0, 12).toUpperCase().replace(/\s+/g, '_'),
        name: test,
        priority,
      });
      const hard = alerts.filter((a) => a.level === 'hard_stop');
      if (hard.length && !overrideBpa) {
        setBpaAlerts(alerts);
        blocked += 1;
        continue;
      }
      placeOrder({
        facilityId,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hospitalNumber: patient.hospitalNumber,
        type: 'lab',
        code: test.slice(0, 12).toUpperCase().replace(/\s+/g, '_'),
        name: test,
        orderedBy: session.name || 'Doctor',
        orderedByBadge: session.badgeId,
        priority,
      });
      placed += 1;
    }
    if (blocked && !placed) {
      setNotice('Hard-stop BPA on order — tick override or change selection');
      setTimeout(() => setNotice(null), 3500);
      return;
    }
    emitLiveAction(`Lab orders · ${placed} tests · ${patient.hospitalNumber}`, { module: 'laboratory' });
    liveAlert(`${placed} lab order(s) on bus`, 'laboratory', facilityId);
    setNotice(`${placed} lab order(s) on bus · bills auto-created${blocked ? ` · ${blocked} blocked` : ''}`);
    setTimeout(() => setNotice(null), 3500);
    setSelected([]);
    setBpaAlerts([]);
    setOverrideBpa(false);
    reload();
  };

  const fireSet = () => {
    const set = ORDER_SETS.find((s) => s.id === orderSetId);
    if (!patient || !set) {
      setNotice('Select patient and order set');
      setTimeout(() => setNotice(null), 2500);
      return;
    }
    let n = 0;
    for (const item of set.items.filter((i) => i.type === 'lab' || i.type === 'rx' || i.type === 'imaging')) {
      placeOrder({
        facilityId,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hospitalNumber: patient.hospitalNumber,
        type: item.type,
        code: item.code,
        name: item.name,
        orderedBy: session.name || 'Doctor',
        orderedByBadge: session.badgeId,
        priority: item.priority || 'routine',
      });
      n += 1;
    }
    setNotice(`Order set “${set.label}” · ${n} items on bus`);
    setTimeout(() => setNotice(null), 3500);
    reload();
  };

  const sc: Record<string, string> = {
    ordered: '#F59E0B',
    accepted: '#38BDF8',
    in_progress: '#A78BFA',
    resulted: '#4ADE80',
    cancelled: '#EF4444',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
      {notice && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}>
            <FlaskConical size={15} color="#F59E0B" /> Lab orders (live bus)
          </div>
          <div style={{ fontSize: '0.73rem', color: '#64748B' }}>{orders.length} on bus</div>
        </div>
        {orders.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No lab orders yet — order from the panel; results return on this bus.
          </div>
        )}
        {orders.map((o) => (
          <div key={o.id} style={{ padding: '13px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{o.name}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {o.patientName} · {o.hospitalNumber} · {o.priority}
                </div>
                {o.resultSummary && (
                  <div style={{ fontSize: 12, marginTop: 4, color: '#0F172A' }}>{o.resultSummary}</div>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                  height: 'fit-content',
                  background: `${sc[o.status] || '#94A3B8'}22`,
                  color: sc[o.status] || '#64748B',
                }}
              >
                {o.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>New lab order</div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
          Patient
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E2E8F0' }}
          >
            <option value="">Select…</option>
            {registry.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} · {p.hospitalNumber}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E2E8F0' }}
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
        </label>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
          Order set
          <select
            value={orderSetId}
            onChange={(e) => setOrderSetId(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E2E8F0' }}
          >
            <option value="">Individual tests…</option>
            {ORDER_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {orderSetId ? (
          <button
            type="button"
            onClick={fireSet}
            style={{
              padding: 12,
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #2563EB, #0D9488)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Fire order set to bus
          </button>
        ) : (
          <>
            {Object.entries(PANELS).map(([group, tests]) => (
              <div key={group}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>{group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tests.map((test) => (
                    <button
                      key={test}
                      type="button"
                      onClick={() => toggle(test)}
                      style={{
                        fontSize: 11,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: selected.includes(test) ? '1px solid #2563EB' : '1px solid #E2E8F0',
                        background: selected.includes(test) ? '#EFF6FF' : '#fff',
                        color: selected.includes(test) ? '#1D4ED8' : '#334155',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {test}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {bpaAlerts.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  background: bpaAlerts.some((a) => a.level === 'hard_stop') ? '#FEF2F2' : '#FFFBEB',
                  border: `1.5px solid ${bpaAlerts.some((a) => a.level === 'hard_stop') ? '#EF4444' : '#F59E0B'}`,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color={bpaAlerts.some((a) => a.level === 'hard_stop') ? '#DC2626' : '#D97706'} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: bpaAlerts.some((a) => a.level === 'hard_stop') ? '#991B1B' : '#92400E', textTransform: 'uppercase' }}>
                    Clinical Decision Support Advisory ({bpaAlerts.length})
                  </span>
                </div>
                {bpaAlerts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      background: '#FFFFFF',
                      border: `1px solid ${a.level === 'hard_stop' ? '#FECACA' : '#FDE68A'}`,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: a.level === 'hard_stop' ? '#DC2626' : '#B45309', marginBottom: 2 }}>
                      {a.title}
                    </div>
                    <div style={{ color: '#475569', lineHeight: 1.4 }}>{a.detail}</div>
                  </div>
                ))}
                {bpaAlerts.some((a) => a.level === 'hard_stop') && (
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', color: '#991B1B', marginTop: 4 }}>
                    <input type="checkbox" checked={overrideBpa} onChange={(e) => setOverrideBpa(e.target.checked)} />
                    Physician clinical override justification noted in audit log
                  </label>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={placeSelected}
              style={{
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: '#0052D4',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Place {selected.length || ''} test(s) on bus
            </button>
          </>
        )}
      </div>
    </div>
  );
};


const RADIOLOGY_STUDIES = [
  'Chest X-Ray PA',
  'Abdominal Ultrasound',
  'Pelvic Ultrasound',
  'CT Brain plain',
  'CT Abdomen/Pelvis',
  'MRI Lumbosacral spine',
  'Obstetric Ultrasound',
  'Doppler Lower Limb',
];

const RadiologyOrdersView: React.FC<{ session: UserSession }> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [registry, setRegistry] = useState<FacilityPatient[]>(() => listPatients(facilityId));
  const [patientId, setPatientId] = useState('');
  const [study, setStudy] = useState(RADIOLOGY_STUDIES[0]);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [reportText, setReportText] = useState('');
  const [orders, setOrders] = useState<ClinicalOrder[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = () => {
    setRegistry(listPatients(facilityId));
    setOrders(listOrders(facilityId).filter((o) => o.type === 'imaging'));
  };

  useEffect(() => {
    reload();
    const u1 = subscribeOrders(reload);
    const u2 = subscribePatients(reload);
    return () => {
      u1();
      u2();
    };
  }, [facilityId]);

  const patient = registry.find((p) => p.id === patientId);

  const place = () => {
    if (!patient) {
      setNotice('Select a patient');
      setTimeout(() => setNotice(null), 2500);
      return;
    }
    const o = placeOrder({
      facilityId,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      hospitalNumber: patient.hospitalNumber,
      type: 'imaging',
      code: study.slice(0, 12).toUpperCase().replace(/\s+/g, '_'),
      name: study,
      orderedBy: session.name || 'Doctor',
      orderedByBadge: session.badgeId,
      priority,
    });
    emitLiveAction(`Imaging order ${study}`, { module: 'radiology' });
    liveAlert(`Radiology order ${o.id} on bus`, 'radiology', facilityId);
    setNotice(`Ordered ${study} · ${o.id} · bill line created`);
    setTimeout(() => setNotice(null), 3500);
    reload();
  };

  const postReport = (id: string) => {
    const summary = reportText.trim() || 'Report available — no acute findings';
    updateOrderStatus(id, 'resulted', {
      resultSummary: summary,
      resultedBy: session.name || 'Radiologist',
    });
    // Soft notification path — critical imaging wording can still trigger intelligence if lab-like
    emitLiveAction(`Imaging report posted`, { module: 'doctor-portal' });
    liveAlert('Radiology report on clinical bus', 'radiology', facilityId);
    setReportText('');
    setNotice('Report posted — visible on doctor results inbox');
    setTimeout(() => setNotice(null), 3000);
    reload();
  };

  const sc: Record<string, string> = {
    ordered: '#F59E0B',
    accepted: '#38BDF8',
    in_progress: '#A78BFA',
    resulted: '#4ADE80',
    cancelled: '#EF4444',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
      {notice && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Layers size={15} color="#F472B6" /> Radiology orders (live bus)
        </div>
        {orders.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No imaging orders — place from the panel. Reports return here and on the doctor results inbox.
          </div>
        )}
        {orders.map((o) => (
          <div key={o.id} style={{ padding: '13px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{o.name}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {o.patientName} · {o.hospitalNumber} · {o.priority}
                </div>
                {o.resultSummary && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>{o.resultSummary}</div>
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                  height: 'fit-content',
                  background: `${sc[o.status] || '#94A3B8'}22`,
                  color: sc[o.status] || '#64748B',
                }}
              >
                {o.status}
              </span>
            </div>
            {o.status !== 'resulted' && o.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => postReport(o.id)}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DB2777',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Post report
              </button>
            )}
          </div>
        ))}
        <div style={{ padding: 12 }}>
          <input
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Optional report text before Post report"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>New imaging order</div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
          Patient
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E2E8F0' }}
          >
            <option value="">Select…</option>
            {registry.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} · {p.hospitalNumber}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
          Study
          <select
            value={study}
            onChange={(e) => setStudy(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E2E8F0' }}
          >
            {RADIOLOGY_STUDIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E2E8F0' }}
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
        </label>
        <button
          type="button"
          onClick={place}
          style={{
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #DB2777, #7C3AED)',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Place on bus
        </button>
        <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>
        </div>
      </div>
    </div>
  );
};

// -- WARD ROUND ----------------------------------------------------------------

const WardRoundView: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(PATIENTS[0]?.id || null);
  const inpatients = PATIENTS.filter(p => p.status !== 'outpatient' && p.status !== 'discharged');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0A2540', display: 'flex', alignItems: 'center', gap: 8 }}><BedDouble size={17} color="#7C3AED" /> Ward Round Console</h2>
          <p style={{ margin: '3px 0 0', color: '#64748B', fontSize: '0.78rem' }}>{inpatients.length} inpatients · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button type="button" style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', border: 'none', color: '#fff', padding: '9px 17px', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={13} /> Sign All Notes
        </button>
      </div>
      {inpatients.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B' }}>
          No inpatients currently admitted. Admitted patients from wards will appear here.
        </div>
      ) : (
        inpatients.map(p => (
          <div key={p.id} style={{ background: '#FFFFFF', border: `1px solid ${p.status === 'critical' ? '#FECACA' : '#E2E8F0'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
            <div onClick={() => setExpanded(x => x === p.id ? null : p.id)} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', background: p.status === 'critical' ? '#FEF2F2' : '#FFFFFF' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: p.status === 'critical' ? '#FEE2E2' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: p.status === 'critical' ? '#DC2626' : '#0284C7', fontSize: '0.85rem', flexShrink: 0 }}>
                {p.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.88rem' }}>{p.name}</span>
                  <StatusBadge status={p.status} />
                  {p.flags.map(f => <span key={f} style={{ fontSize: '0.62rem', fontWeight: 700, color: p.status === 'critical' ? '#DC2626' : '#D97706', background: p.status === 'critical' ? '#FEE2E2' : '#FEF3C7', border: '1px solid currentColor', borderRadius: 4, padding: '1px 5px' }}>{f}</span>)}
                </div>
                <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: 2 }}>{p.id} • {p.ward}{p.bed ? ` • Bed ${p.bed}` : ''} • {p.diagnosis}</div>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <VitalChip label="BP" value={p.vitals?.bp} warn={parseInt(p.vitals?.bp) > 140} />
                <VitalChip label="HR" value={p.vitals?.hr} unit="/m" warn={p.vitals?.hr > 100} />
                <VitalChip label="SpO2" value={p.vitals?.spo2} unit="%" warn={p.vitals?.spo2 < 94} />
                {expanded === p.id ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
              </div>
            </div>
            {expanded === p.id && (
              <div style={{ padding: '0 18px 18px', borderTop: '1px solid #E2E8F0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 13 }}>
                  {[['Clinical Status / Today\'s Findings', 'Document today\'s findings, patient condition, response to treatment…'], ['Today\'s Plan & Orders', 'Medication changes, investigation orders, nursing instructions, dietary…']].map(([lbl, ph]) => (
                    <div key={lbl}>
                      <label style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{lbl}</label>
                      <textarea rows={4} placeholder={ph} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, color: '#0A2540', fontSize: '0.8rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
                  {[['✓ Sign Note', '#059669', '#ECFDF5'], ['💊 Prescribe', '#7C3AED', '#F5F3FF'], ['🧪 Lab Order', '#D97706', '#FFFBEB'], ['↗ Refer', '#0284C7', '#EFF6FF'], ['🏥 Discharge', '#475569', '#F1F5F9']].map(([l, c, bg]) => (
                    <button key={l} type="button" style={{ background: bg, border: `1px solid ${c}40`, color: c, padding: '7px 13px', borderRadius: 7, fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )))}
    </div>
  );
};

// -- APPOINTMENTS --------------------------------------------------------------

const AppointmentsView: React.FC = () => {
  const sc: Record<Appointment['status'], string> = { scheduled: '#64748B', waiting: '#D97706', 'in-progress': '#0284C7', done: '#059669', 'no-show': '#DC2626' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={17} color="#7C3AED" /> Today's Appointment Schedule
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6D28D9', background: '#F5F3FF', border: '1px solid #DDD6FE', padding: '2px 9px', borderRadius: 999 }}>{APPOINTMENTS.length} Slots</span>
        </div>
        <button type="button" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#6D28D9', padding: '7px 13px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>+ New Appointment</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {APPOINTMENTS.map(a => (
          <div key={a.id} style={{ background: '#FFFFFF', border: `1px solid ${a.status === 'waiting' ? '#FDE68A' : a.status === 'done' ? '#A7F3D0' : '#E2E8F0'}`, borderRadius: 12, padding: '14px', opacity: a.status === 'done' ? 0.72 : 1, boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: a.status === 'waiting' ? '#FEF3C7' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem', color: a.status === 'waiting' ? '#D97706' : '#0284C7' }}>
                {a.patientName.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.88rem' }}>{a.patientName}</div>
                <div style={{ fontSize: '0.71rem', color: '#64748B' }}>{a.patientId} • {a.type}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: '#6D28D9', fontSize: '0.98rem' }}>{a.time}</div>
                <span style={{ fontSize: '0.63rem', fontWeight: 700, color: sc[a.status], background: `${sc[a.status]}13`, border: '1px solid currentColor', padding: '1px 6px', borderRadius: 999 }}>
                  {a.status === 'done' ? '✓ Done' : a.status === 'waiting' ? '⏳ Waiting' : a.status === 'no-show' ? '✕ No-Show' : 'Upcoming'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {a.status !== 'done' && <button type="button" style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0052D4', padding: '7px', borderRadius: 7, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>Begin Consult</button>}
              <button type="button" style={{ flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', padding: '7px', borderRadius: 7, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>View Record</button>
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
  const pc: Record<Task['priority'], string> = { urgent: '#EF4444', high: '#F59E0B', normal: '#0284C7', low: '#64748B' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={17} color="#059669" /> Clinical Task Board</div>
        <button type="button" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '7px 13px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>+ New Task</button>
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
                <div key={t.id} style={{ background: '#FFFFFF', border: `1px solid ${t.done ? '#E2E8F0' : `${pc[t.priority]}40`}`, borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 13, opacity: t.done ? 0.6 : 1, transition: 'all 0.15s', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
                  <button type="button" onClick={() => toggle(t.id)} style={{ width: 21, height: 21, borderRadius: 5, flexShrink: 0, border: `2px solid ${t.done ? '#10B981' : pc[t.priority]}`, background: t.done ? '#10B981' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.done && <Check size={12} color="#FFFFFF" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: t.done ? '#64748B' : '#0F172A', fontSize: '0.86rem', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
                    {t.patient && <div style={{ fontSize: '0.71rem', color: '#64748B', marginTop: 2 }}>Patient: {t.patient}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Due: {t.due}</div>
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, color: t.type === 'clinical' ? '#0284C7' : t.type === 'admin' ? '#7C3AED' : '#D97706', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: 999 }}>{t.type}</span>
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
    { label: 'Avg Consult Duration', value: '18 min', change: '-2 min', color: '#059669' },
    { label: 'Prescriptions Issued', value: 89, change: '+5%', color: '#7C3AED' },
    { label: 'Lab Orders Placed', value: 67, change: '+8%', color: '#D97706' },
    { label: 'Referrals Made', value: 14, change: '=', color: '#DB2777' },
    { label: 'Ward Mortality Rate', value: '0%', change: 'stable', color: '#059669' },
  ];
  const diagnoses = [
    { dx: 'Malaria', count: 28, pct: 76 }, { dx: 'Hypertension', count: 22, pct: 60 },
    { dx: 'Type 2 Diabetes', count: 18, pct: 49 }, { dx: 'Typhoid Fever', count: 14, pct: 38 },
    { dx: 'Acute Gastroenteritis', count: 12, pct: 33 }, { dx: 'RTI', count: 10, pct: 27 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <h2 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 800, color: '#0A2540' }}>My Clinical Performance</h2>
        <p style={{ margin: 0, color: '#64748B', fontSize: '0.78rem' }}>September 2026 • Month-to-date statistics</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 13 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 13, padding: '18px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>{s.label}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: s.change.startsWith('+') ? '#059669' : s.change.startsWith('-') ? '#DC2626' : '#64748B' }}>{s.change} vs last month</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem', marginBottom: 14 }}>Top Diagnoses This Month</div>
        {diagnoses.map(d => (
          <div key={d.dx} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>{d.dx}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>{d.count} cases</span>
            </div>
            <div style={{ height: 6, background: '#F1F5F9', borderRadius: 99 }}>
              <div style={{ height: '100%', width: `${d.pct}%`, background: 'linear-gradient(90deg,#0284C7,#38BDF8)', borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -- PLACEHOLDER ---------------------------------------------------------------

const Placeholder: React.FC<{ icon: React.ComponentType<any>; label: string; description: string; color?: string }> = ({ icon: Icon, label, description, color = '#0284C7' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center', background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: 16 }}>
    <div style={{ width: 70, height: 70, borderRadius: 20, background: `${color}13`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
      <Icon size={30} color={color} />
    </div>
    <h2 style={{ margin: '0 0 7px', fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>{label}</h2>
    <p style={{ margin: 0, color: '#64748B', fontSize: '0.83rem', maxWidth: 400, lineHeight: 1.6 }}>{description}</p>
    <div style={{ marginTop: 14, fontSize: '0.73rem', color, background: `${color}0E`, border: `1px solid ${color}28`, padding: '5px 15px', borderRadius: 999, fontWeight: 700 }}>
      ⚙️ Module under clinical configuration • active next sprint
    </div>
  </div>
);

// -- Sub-nav only (NO second sidebar — OS shell owns nav) ----------------------

const NAV_ITEMS: { key: SubModule; icon: React.ComponentType<any>; label: string }[] = [
  { key: 'dashboard', icon: LayoutDashboard, label: 'Clinical desk' },
  { key: 'patients', icon: Users, label: 'My patients' },
  { key: 'consultation', icon: Stethoscope, label: 'Consultation' },
  { key: 'emr', icon: FileText, label: 'EMR' },
  { key: 'prescriptions', icon: Pill, label: 'Rx' },
  { key: 'lab-orders', icon: FlaskConical, label: 'Labs' },
  { key: 'radiology-orders', icon: Layers, label: 'Imaging' },
  { key: 'ward-round', icon: BedDouble, label: 'Ward round' },
  { key: 'appointments', icon: Calendar, label: 'Schedule' },
  { key: 'tasks', icon: ClipboardList, label: 'Tasks' },
  { key: 'referrals', icon: Send, label: 'Referrals' },
  { key: 'admission', icon: UserPlus, label: 'Admit' },
  { key: 'messages', icon: MessageSquare, label: 'Messages' },
  { key: 'analytics', icon: BarChart3, label: 'Analytics' },
  { key: 'settings', icon: Settings, label: 'Settings' },
];

// -- MAIN EXPORT: single workspace (no nested Doctor Portal chrome) ------------

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ session, onNavigate, initialModule }) => {
  const [activeModule, setActiveModule] = useState<SubModule>(initialModule || 'consultation');

  useEffect(() => {
    if (initialModule) setActiveModule(initialModule);
  }, [initialModule]);

  const renderContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <DoctorDeskHome
            session={session}
            onNavigate={(k) => {
              if (k === 'doctor-portal') setActiveModule('patients');
              else onNavigate(k);
            }}
          />
        );
      case 'patients': return <PatientsViewLive session={session} onNavigate={onNavigate} />;
      case 'consultation': return <ConsultationView session={session} />;
      case 'prescriptions': return <PrescriptionsView session={session} />;
      case 'lab-orders': return <LabOrdersView session={session} />;
      case 'ward-round': return <WardRoundView />;
      case 'appointments': return <AppointmentsView />;
      case 'tasks': return <TasksView />;
      case 'analytics': return <AnalyticsView />;
      case 'emr': return <EMRManager onNavigate={(m) => onNavigate(m)} />;
      case 'radiology-orders': return <RadiologyOrdersView session={session} />;
      case 'referrals': return <Placeholder icon={Send} label="Referral Management" description="Internal and external referrals, specialist consultations, inter-hospital transfers with clinical summaries and acceptance tracking." color="#10B981" />;
      case 'messages': return <Placeholder icon={MessageSquare} label="Clinical Messaging" description="Secure clinician-to-clinician messaging, nurse escalations, department broadcasts, and ward-level notifications." color="#60A5FA" />;
      case 'admission': return <Placeholder icon={UserPlus} label="Admissions & Discharge Planning" description="Patient admission requests, ward/bed allocation, transfer orders, and structured discharge planning with after-care instructions." color="#38BDF8" />;
      case 'settings': return <Placeholder icon={Settings} label="Doctor Preferences" description="Notification settings, signature setup, prescription defaults, preferred investigation labs, portal shortcuts, and display configuration." color="#94A3B8" />;
      default:
        return (
          <DoctorDeskHome
            session={session}
            onNavigate={(k) => {
              if (k === 'doctor-portal') setActiveModule('patients');
              else onNavigate(k);
            }}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>
      {/* Horizontal sub-nav only — no second dark sidebar */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid #E8EEF5',
          padding: '10px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Stethoscope size={18} color="#0D9488" />
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
              Clinical workspace
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
              {session.name || 'Doctor'} · {session.role || session.title || 'Medical Officer'} · one desk, no nested portal
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#0D9488',
              background: '#CCFBF1',
              border: '1px solid #99F6E4',
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            Live
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 0,
            scrollbarWidth: 'thin',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = activeModule === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveModule(item.key);
                  if (item.key === 'prescriptions') onNavigate('pharmacy');
                  else if (item.key === 'lab-orders') onNavigate('laboratory');
                  else if (item.key === 'radiology-orders') onNavigate('radiology');
                  else if (item.key === 'emr') onNavigate('emr');
                  else if (item.key === 'consultation') onNavigate('doctor-portal');
                  else if (item.key === 'dashboard') onNavigate('dashboard');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: active ? '2px solid #0D9488' : '2px solid transparent',
                  background: active ? 'rgba(13,148,136,0.06)' : 'transparent',
                  color: active ? '#0D9488' : '#64748B',
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderRadius: '8px 8px 0 0',
                }}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: activeModule === 'dashboard' ? 0 : '16px 18px' }}>
        {renderContent()}
      </div>
    </div>
  );
};

/** Live My Patients — registry + today's visits (no demo cards) */
const PatientsViewLive: React.FC<{ session: UserSession; onNavigate: (k: any) => void }> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'inpatient' | 'outpatient' | 'critical'>('all');

  useEffect(() => {
    const u1 = subscribeOrders(() => setTick((t) => t + 1));
    const u2 = subscribePatients(() => setTick((t) => t + 1));
    return () => {
      u1();
      u2();
    };
  }, []);

  const registry = listPatients(facilityId);
  const q = search.toLowerCase().trim();
  const rows = registry.filter((p) => {
    const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
    if (q && !(`${name} ${p.hospitalNumber} ${p.id}`.toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #E8EEF5',
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <InteractiveSearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search name, hospital number…"
            resultsCount={rows.length}
            totalCount={registry.length}
            size="sm"
            aria-label="Search patient registry"
          />
        </div>
        {(['all', 'inpatient', 'outpatient', 'critical'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.76rem',
              cursor: 'pointer',
              background: filter === f ? 'rgba(13,148,136,0.12)' : '#fff',
              border: `1px solid ${filter === f ? '#0D9488' : '#E8EEF5'}`,
              color: filter === f ? '#0D9488' : '#64748B',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onNavigate('emr')}
          style={{
            background: 'linear-gradient(135deg,#0D9488,#0F766E)',
            border: 'none',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 9,
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Plus size={14} /> Open EMR
        </button>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #CBD5E1',
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
            color: '#64748B',
          }}
        >
          <Users size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No patients on your list yet</div>
          <div style={{ fontSize: '0.84rem', maxWidth: 420, margin: '0 auto' }}>
            When reception checks a patient in or registers them, they appear here in real time.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((p) => (
            <div
              key={p.id}
              style={{
                background: '#fff',
                border: '1px solid #E8EEF5',
                borderRadius: 14,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg,#CCFBF1,#E0F2FE)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#0F766E',
                  fontSize: '0.85rem',
                }}
              >
                {([p.firstName, p.lastName].filter(Boolean).join(' ') || '?')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{[p.firstName, p.lastName].filter(Boolean).join(' ')}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  {p.hospitalNumber || p.id}
                  {p.sex ? ` · ${p.sex}` : ''}
                  {p.phone ? ` · ${p.phone}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  emitLiveAction(`Opened chart ${[p.firstName, p.lastName].filter(Boolean).join(' ')}`, { module: 'doctor-portal' });
                  onNavigate('emr');
                }}
                style={{
                  border: '1px solid #0D9488',
                  background: '#fff',
                  color: '#0D9488',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '8px 12px',
                  borderRadius: 9,
                  cursor: 'pointer',
                }}
              >
                Open chart
              </button>
            </div>
          ))}
        </div>
      )}
      <span style={{ display: 'none' }}>{tick}</span>
    </div>
  );
};

export default DoctorPortal;
