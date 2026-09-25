'use client';

import React, { useState } from 'react';
import { UserSession } from '../auth/AuthScreen';
import { AdminWorkspace } from './AdminWorkspace';
import {
  Stethoscope, Activity, Flame, Wind, Pill, FlaskConical, Layers, Baby, Droplet,
  FileText, BedDouble, Users, Clock, ShieldCheck, AlertTriangle, CheckCircle2,
  ArrowRight, Search, Building2, CreditCard, Package, Wrench, Gauge, Brain,
  Sparkles, Calendar, TrendingUp, Plus, PhoneCall, Bell, FileCheck, Eye, RefreshCw,
  Lock, Check, AlertCircle, HeartPulse, Shield, BarChart3, Database, Cpu, Zap, LogOut, Send, UserCheck
} from 'lucide-react';

interface RoleDashboardProps {
  session: UserSession;
  onNavigate: (moduleKey: any) => void;
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({ session, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'alerts'>('overview');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const triggerAction = (msg: string, navKey?: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
    if (navKey) {
      setTimeout(() => onNavigate(navKey), 600);
    }
  };

  // Determine role key from session role or session.roleKey or title
  const roleTitle = (session.role || session.title || '').toLowerCase();
  const roleKey =
    session.roleKey ||
    (roleTitle.includes('surgeon') ? 'surgeon'
      : roleTitle.includes('nurse') ? 'nurse'
      : roleTitle.includes('midwife') ? 'midwife'
      : roleTitle.includes('pharmacist') ? 'pharmacist'
      : roleTitle.includes('lab') ? 'lab'
      : roleTitle.includes('radiolog') ? 'radiologist'
      : roleTitle.includes('account') ? 'accountant'
      : roleTitle.includes('record') ? 'records'
      : roleTitle.includes('biomedical') ? 'biomedical'
      : roleTitle.includes('director') || roleTitle.includes('superintendent') ? 'medical_director'
      : roleTitle.includes('hospital_admin') || roleTitle.includes('administrator') ? 'hospital_admin'
      : roleTitle.includes('ict') ? 'sysadmin'
      : 'doctor');


  // Administrator gets dedicated premium workspace (no clinical banner)
  if (roleKey === 'hospital_admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {actionNotice && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            background: '#FFFFFF', color: '#15803d', border: '1px solid #bbf7d0',
            borderRadius: 10, padding: '12px 18px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', fontWeight: 600,
          }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span>{actionNotice}</span>
          </div>
        )}
        <AdminWorkspace session={session} onNavigate={(k) => onNavigate(k)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* -- Notification Toast -- */}
      {actionNotice && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          background: '#FFFFFF',
          color: '#0052D4',
          border: '1px solid #0284C7',
          borderRadius: 10,
          padding: '12px 18px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.85rem',
          fontWeight: 600,
          animation: 'fadeUp 0.2s ease-out'
        }}>
          <CheckCircle2 size={16} color="#38BDF8" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* -- Role Banner Header — MedCore blue/teal + Arise green soft wash -- */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #ECFDF5 42%, #EFF6FF 100%)',
        border: '1px solid rgba(226, 232, 240, 0.95)',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 12px 28px -8px rgba(0, 102, 255, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #0052D4 0%, #00BFA5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            fontWeight: 800,
            fontSize: '1.2rem',
            boxShadow: '0 4px 14px rgba(0, 82, 212, 0.3)'
          }}>
            {session.avatarInitials || 'MD'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0A2540', fontFamily: 'Outfit, sans-serif' }}>
                {session.title || session.role} Dashboard
              </h1>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#0A2540',
                background: 'linear-gradient(90deg, #0052D4, #00BFA5)',
                padding: '2px 8px',
                borderRadius: 999
              }}>
                {session.clearanceLabel || 'L4 Clinical'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: '#64748B', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#0A2540' }}>
                <Building2 size={13} color="#0052D4" /> {session.facility || 'Ibom Specialist Hospital, Uyo'}
              </span>
              <span>�</span>
              <span>{session.department || 'Clinical Governance'}</span>
              <span>�</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Active Duty
              </span>
            </div>
          </div>
        </div>

        {/* Quick Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'overview' ? 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)' : 'transparent',
              color: activeTab === 'overview' ? '#FFF' : '#64748B'
            }}
          >
            Overview & Telemetry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'queue' ? 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)' : 'transparent',
              color: activeTab === 'queue' ? '#FFF' : '#64748B'
            }}
          >
            Work Queue & Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'alerts' ? 'linear-gradient(90deg, #0052D4 0%, #00BFA5 100%)' : 'transparent',
              color: activeTab === 'alerts' ? '#FFF' : '#64748B'
            }}
          >
            Alerts & Safety
          </button>
        </div>
      </div>

      {/* -- Specific Role Dashboard Body -- */}
      {roleKey === 'doctor' && (
        <DoctorDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'surgeon' && (
        <SurgeonDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'nurse' && (
        <NurseDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'midwife' && (
        <MidwifeDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'pharmacist' && (
        <PharmacistDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'lab' && (
        <LabDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'radiologist' && (
        <RadiologistDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'accountant' && (
        <AccountantDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'records' && (
        <RecordsDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'biomedical' && (
        <BiomedicalDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'medical_director' && (
        <MedicalDirectorDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'sysadmin' && (
        <SysadminDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
      )}

      {roleKey === 'hospital_admin' && (
        <AdminWorkspace session={session} onNavigate={(k) => onNavigate(k)} />
      )}
    </div>
  );
};

/* -------------------------------------------------------------
   1. DOCTOR DASHBOARD
------------------------------------------------------------- */
function DoctorDashboardBody({ onNavigate, triggerAction, activeTab }: any) {
  return (
    <>
      {/* 4 KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Inpatients Under Care</span>
          <span className="metric-val">18 Patients</span>
          <span className="metric-sub">4 Critical � 14 Stable Inpatients</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Diagnostic Results to Review</span>
          <span className="metric-val">6 Labs � 2 PACS</span>
          <span className="metric-sub">1 Panic Critical Call Logged</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Brain size={13} style={{ display: 'inline', marginRight: 4 }} />M87 AI Clinical Copilot</span>
          <span className="metric-val">Active Sentinel</span>
          <span className="metric-sub">3 Differential & Drug Checks Passed</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />Urgent Emergency Consults</span>
          <span className="metric-val">2 Pending</span>
          <span className="metric-sub">A&E Bed 3 & ICU Step-Down</span>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('m87-ai')}>
          <Brain size={15} /> <span>Open M87 AI Copilot</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('emergency')}>
          <Flame size={15} /> <span>A&E Triage Queue</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('nursing')}>
          <FileText size={15} /> <span>Ward Rounds & e-MAR</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('pharmacy')}>
          <Pill size={15} /> <span>e-Prescriptions & Formulary</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('laboratory')}>
          <FlaskConical size={15} /> <span>Lab Tests & Blood Crossmatch</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('radiology')}>
          <Layers size={15} /> <span>PACS DICOM Scans</span>
        </button>
      </div>

      {/* Main Table / Worklist */}
      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header" style={{ marginBottom: 14 }}>
          <span className="os-section-title">
            <Stethoscope size={16} style={{ display: 'inline', marginRight: 6, color: '#0284C7' }} />
            Active Assigned Inpatients � Clinical Rounds Worklist
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Auto-synced with HL7 FHIR Ward Census</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#94A3B8' }}>
                <th style={{ padding: '10px 12px' }}>Bed / Ward</th>
                <th style={{ padding: '10px 12px' }}>Patient Name</th>
                <th style={{ padding: '10px 12px' }}>Age / Sex</th>
                <th style={{ padding: '10px 12px' }}>Working Diagnosis</th>
                <th style={{ padding: '10px 12px' }}>Latest Vitals</th>
                <th style={{ padding: '10px 12px' }}>ESI Acuity</th>
                <th style={{ padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[
                { bed: 'MMW-04', name: 'Elder Etebong Udo', age: '64 / M', dx: 'Decompensated Heart Failure � Hypertensive Urgency', vitals: 'BP 164/98 � HR 88 � SpO2 94%', esi: 'ESI 2 � High Risk', status: 'critical' },
                { bed: 'FMW-11', name: 'Mrs. Idorenyin Bassey', age: '42 / F', dx: 'Community-Acquired Pneumonia (Lobar)', vitals: 'BP 122/78 � HR 82 � Temp 38.4�C', esi: 'ESI 3 � Urgent', status: 'stable' },
                { bed: 'SRG-07', name: 'Emem Akpan', age: '29 / M', dx: 'Post-Appendectomy Day 1 � Healing Well', vitals: 'BP 118/74 � HR 76 � SpO2 99%', esi: 'ESI 4 � Stable', status: 'stable' },
                { bed: 'ICU-02', name: 'Blessing Okon', age: '51 / F', dx: 'Severe Sepsis secondary to Pyelonephritis', vitals: 'BP 92/58 � HR 112 � Lactate 3.4', esi: 'ESI 1 � Resuscitation', status: 'critical' },
              ].map((pt, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #FFFFFF', transition: 'background 0.15s' }}>
                  <td style={{ padding: '12px', fontWeight: 700, color: '#0052D4', fontFamily: 'monospace' }}>{pt.bed}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#0A2540' }}>{pt.name}</td>
                  <td style={{ padding: '12px', color: '#94A3B8' }}>{pt.age}</td>
                  <td style={{ padding: '12px', color: '#CBD5E1' }}>{pt.dx}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '0.78rem', color: pt.status === 'critical' ? '#F87171' : '#4ADE80' }}>
                    {pt.vitals}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                      background: pt.status === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                      color: pt.status === 'critical' ? '#EF4444' : '#38BDF8'
                    }}>
                      {pt.esi}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="os-ghost-btn"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => triggerAction(`Opened Chart for ${pt.name}`, 'm87-ai')}
                      >
                        M87 AI
                      </button>
                      <button
                        className="os-ghost-btn"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => triggerAction(`Prescription order drafted for ${pt.name}`, 'pharmacy')}
                      >
                        Order Rx
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   2. SURGEON DASHBOARD
------------------------------------------------------------- */
function SurgeonDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Activity size={13} style={{ display: 'inline', marginRight: 4 }} />Today's Theatre Slates</span>
          <span className="metric-val">7 Procedures</span>
          <span className="metric-sub">3 In Progress � 4 In Pre-Op Holding</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><BedDouble size={13} style={{ display: 'inline', marginRight: 4 }} />Operating Theatres Active</span>
          <span className="metric-val">3 / 4 Suites</span>
          <span className="metric-sub">Suite 1: General � Suite 2: Ortho � Suite 3: C-Section</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Droplet size={13} style={{ display: 'inline', marginRight: 4 }} />Blood Crossmatch Cleared</span>
          <span className="metric-val">14 Units Ready</span>
          <span className="metric-sub">O- (4 Units) � A+ (6 Units) � B+ (4 Units)</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />PACU Recovery Beds</span>
          <span className="metric-val">4 / 6 Occupied</span>
          <span className="metric-sub">2 Post-Op Beds Available</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('theatre')}>
          <Activity size={15} /> <span>Open Theatre Suite</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('icu')}>
          <Wind size={15} /> <span>ICU Telemetry</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('blood-bank')}>
          <Droplet size={15} /> <span>Blood Bank Requests</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('WHO Surgical Safety Checklist Initiated')}>
          <ShieldCheck size={15} /> <span>WHO Safety Checklist</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Today's Operating Theatre Schedule</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>? 3 Surgical Suites In Session</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 12 }}>
          {[
            { theatre: 'Theatre 1', time: '08:30 - 11:00', pt: 'Kufre Edet (48M)', op: 'Open Reduction Internal Fixation (Femur)', anaes: 'General Endotracheal', status: 'In Surgery', color: '#F59E0B' },
            { theatre: 'Theatre 2', time: '09:15 - 11:30', pt: 'Aniekan Umoh (33M)', op: 'Laparoscopic Cholecystectomy', anaes: 'General Anesthesia', status: 'In Surgery', color: '#F59E0B' },
            { theatre: 'Theatre 3', time: '11:00 - 12:30', pt: 'Mercy Friday (28F)', op: 'Emergency Lower Segment Caesarean Section', anaes: 'Spinal Anaesthesia', status: 'Pre-Op Induction', color: '#0052D4' },
            { theatre: 'Theatre 4', time: '13:00 - 14:30', pt: 'Bassey Asuquo (61M)', op: 'Transurethral Resection of Prostate (TURP)', anaes: 'Regional Spinal', status: 'Sterilization Cycle', color: '#A855F7' },
          ].map((th, idx) => (
            <div key={idx} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: '#0052D4' }}>{th.theatre}</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: `${th.color}22`, color: th.color, fontWeight: 700 }}>
                  {th.status}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0A2540', marginBottom: 4 }}>{th.op}</div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: 6 }}>Patient: {th.pt}</div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                <span>{th.time}</span>
                <span>{th.anaes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   3. NURSE DASHBOARD
------------------------------------------------------------- */
function NurseDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />My Assigned Inpatients</span>
          <span className="metric-val">12 Patients</span>
          <span className="metric-sub">Ward 3B � Surgical & Medical Stepdown</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Pill size={13} style={{ display: 'inline', marginRight: 4 }} />e-MAR Medications Due</span>
          <span className="metric-val">8 Doses Due</span>
          <span className="metric-sub">3 Antibiotics IV � 5 Oral Maintenance</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><HeartPulse size={13} style={{ display: 'inline', marginRight: 4 }} />Vitals Telemetry Alert</span>
          <span className="metric-val">2 Alerts</span>
          <span className="metric-sub">Bed 3B-04 Temp 39.1�C � Bed 3B-09 BP 85/52</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><BedDouble size={13} style={{ display: 'inline', marginRight: 4 }} />Ward Occupancy Rate</span>
          <span className="metric-val">94% Occupied</span>
          <span className="metric-sub">45 / 48 Beds In Use</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('nursing')}>
          <FileText size={15} /> <span>Open Inpatient Nursing Suite</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('beds')}>
          <BedDouble size={15} /> <span>Bed Management</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('patient-flow')}>
          <RefreshCw size={15} /> <span>Patient Transit & Admissions</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Recorded Routine Bedside Vitals Batch')}>
          <Activity size={15} /> <span>Batch Record Vitals</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Immediate e-MAR Medication Administration Schedule</span>
          <span style={{ fontSize: '0.75rem', color: '#0052D4' }}>Next 2 Hours Window</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {[
            { bed: 'Bed 3B-01', pt: 'Nsikak Udoh', med: 'IV Ceftriaxone 1g in 100ml Normal Saline', due: '10:00 AM (Due Now)', status: 'due', route: 'IV Infusion' },
            { bed: 'Bed 3B-04', pt: 'Mary Archibong', med: 'IV Paracetamol 1g STAT (Fever 39.1�C)', due: 'Immediate STAT', status: 'urgent', route: 'IV Push' },
            { bed: 'Bed 3B-07', pt: 'Okon Essien', med: 'Tab Enalapril 10mg + Tab Amlodipine 5mg', due: '10:30 AM', status: 'pending', route: 'Oral' },
            { bed: 'Bed 3B-11', pt: 'Peace Patrick', med: 'Subcutaneous Enoxaparin 40mg DVT Prophylaxis', due: '11:00 AM', status: 'pending', route: 'SC Injection' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0052D4', fontFamily: 'monospace' }}>{m.bed}</span>
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>{m.pt}</span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: m.status === 'urgent' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(2, 132, 199, 0.2)', color: m.status === 'urgent' ? '#EF4444' : '#38BDF8' }}>
                    {m.route}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 3 }}>{m.med}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: m.status === 'urgent' ? '#EF4444' : '#F59E0B' }}>{m.due}</span>
                <button
                  className="os-primary-btn"
                  style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                  onClick={() => triggerAction(`Administered and e-signed: ${m.med} for ${m.pt}`)}
                >
                  Administer & Sign
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   4. MIDWIFE DASHBOARD
------------------------------------------------------------- */
function MidwifeDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Baby size={13} style={{ display: 'inline', marginRight: 4 }} />Active Labour Deliveries</span>
          <span className="metric-val">4 Mothers</span>
          <span className="metric-sub">Suite 1 in Second Stage (Fully Dilated)</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><HeartPulse size={13} style={{ display: 'inline', marginRight: 4 }} />CTG Fetal Telemetry</span>
          <span className="metric-val">1 Alert</span>
          <span className="metric-sub">Labour Room 2: Late Decelerations Flagged</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Antenatal Clinic Attendance</span>
          <span className="metric-val">28 Bookings</span>
          <span className="metric-sub">High-Risk Obstetric Consults: 6</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><BedDouble size={13} style={{ display: 'inline', marginRight: 4 }} />Postnatal Mothers & Babies</span>
          <span className="metric-val">14 Mother-Baby Pairs</span>
          <span className="metric-sub">All Newborn Screening Completed</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('maternity')}>
          <Stethoscope size={15} /> <span>Open Maternity & Labour Suite</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('paediatrics')}>
          <Baby size={15} /> <span>NICU Incubators</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Fetal Distress Alert Paged to On-Duty Obstetrician')}>
          <AlertTriangle size={15} /> <span>Page Obstetrician STAT</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Active Labour Partograph Telemetry</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>Real-time CTG Transducers</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 12 }}>
          {[
            { room: 'Labour Room 1', mother: 'Anietie Ekpo (G2P1)', dilation: '10 cm (Full)', fhr: '142 bpm (Normal)', contractions: '4 in 10 min � Strong', status: 'Second Stage', urgent: false },
            { room: 'Labour Room 2', mother: 'Victoria Bassey (G1P0)', dilation: '6 cm', fhr: '108 bpm (Decelerations)', contractions: '3 in 10 min � Moderate', status: 'Fetal Distress Alert', urgent: true },
            { room: 'Labour Room 3', mother: 'Grace Inyang (G3P2)', dilation: '4 cm', fhr: '136 bpm (Normal)', contractions: '2 in 10 min � Mild', status: 'Active First Stage', urgent: false },
            { room: 'Labour Room 4', mother: 'Ekaette Dan (G2P1)', dilation: '8 cm', fhr: '148 bpm (Normal)', contractions: '3 in 10 min � Moderate', status: 'Active First Stage', urgent: false },
          ].map((l, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: `1px solid ${l.urgent ? '#EF4444' : '#E2E8F0'}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#0052D4' }}>{l.room}</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: l.urgent ? 'rgba(239,68,68,0.2)' : 'rgba(5,150,105,0.12)', color: l.urgent ? '#EF4444' : '#4ADE80', fontWeight: 700 }}>
                  {l.status}
                </span>
              </div>
              <div style={{ fontWeight: 700, color: '#0A2540', fontSize: '0.9rem' }}>{l.mother}</div>
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Cervical Dilation: <strong style={{ color: '#0052D4' }}>{l.dilation}</strong></div>
                <div>Fetal Heart Rate: <strong style={{ color: l.urgent ? '#EF4444' : '#4ADE80' }}>{l.fhr}</strong></div>
                <div>Contractions: <span>{l.contractions}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   5. PHARMACIST DASHBOARD
------------------------------------------------------------- */
function PharmacistDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Pill size={13} style={{ display: 'inline', marginRight: 4 }} />Prescriptions to Dispense</span>
          <span className="metric-val">32 Pending Rx</span>
          <span className="metric-sub">18 Outpatient � 14 Inpatient e-MAR</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><Flame size={13} style={{ display: 'inline', marginRight: 4 }} />STAT Urgent Orders</span>
          <span className="metric-val">4 STAT Prescriptions</span>
          <span className="metric-sub">A&E Resus � Theatre 3 Pre-Op</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Wind size={13} style={{ display: 'inline', marginRight: 4 }} />Cold-Chain Refrigerator</span>
          <span className="metric-val">3.6�C (Optimal)</span>
          <span className="metric-sub">Insulin, Oxytocin & Vaccines Valid</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Package size={13} style={{ display: 'inline', marginRight: 4 }} />Formulary Stockouts</span>
          <span className="metric-val">3 Items Low</span>
          <span className="metric-sub">IV Amoxiclav � Artesunate Vials</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('pharmacy')}>
          <Pill size={15} /> <span>Open Pharmacy Dispensing Suite</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('inventory')}>
          <Package size={15} /> <span>Central Medical Store (CMS)</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Cold Chain Telemetry Logged to State NAFDAC Compliance')}>
          <Wind size={15} /> <span>Verify Cold Chain Log</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Live Inpatient & Outpatient Prescription Queue</span>
          <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>4 STAT Prescriptions Flagged</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {[
            { rx: 'RX-9801', pt: 'Ime Akpan (A&E)', doc: 'Dr. E. Bassey', meds: 'IV Artesunate 120mg STAT + IV Ceftriaxone 1g', urgency: 'STAT Urgent', status: 'Awaiting Dispense' },
            { rx: 'RX-9800', pt: 'Sarah Udeme (Postnatal)', doc: 'Dr. O. Friday', meds: 'Tab Ferrous Sulphate 200mg + Tab Folic Acid 5mg (30 Days)', urgency: 'Routine', status: 'Dispensed' },
            { rx: 'RX-9799', pt: 'Victor Edem (Male Medical)', doc: 'Dr. A. Patrick', meds: 'Tab Enalapril 10mg + Tab Atorvastatin 20mg nocte', urgency: 'Urgent', status: 'Awaiting Dispense' },
            { rx: 'RX-9798', pt: 'Kufre George (Paediatrics)', doc: 'Dr. N. Inyang', meds: 'Amoxicillin Syrup 250mg/5ml � 5ml TDS x 7 days', urgency: 'Routine', status: 'Awaiting Dispense' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0052D4', fontFamily: 'monospace' }}>{r.rx}</span>
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>{r.pt}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Prescribed by {r.doc}</span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: r.urgency.includes('STAT') ? 'rgba(239,68,68,0.2)' : 'rgba(2,132,199,0.2)', color: r.urgency.includes('STAT') ? '#EF4444' : '#38BDF8' }}>
                    {r.urgency}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 3 }}>{r.meds}</div>
              </div>
              <button
                className="os-primary-btn"
                style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                onClick={() => triggerAction(`Verified & Dispensed ${r.rx} for ${r.pt}`)}
              >
                Verify & Dispense
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   6. LAB SCIENTIST DASHBOARD
------------------------------------------------------------- */
function LabDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-yellow">
          <span className="metric-label"><FlaskConical size={13} style={{ display: 'inline', marginRight: 4 }} />Specimens in Worklist</span>
          <span className="metric-val">42 Specimens</span>
          <span className="metric-sub">16 Hematology � 18 Biochem � 8 Micro</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />STAT Panic Critical Values</span>
          <span className="metric-val">2 Critical Values</span>
          <span className="metric-sub">Potassium 6.8 mmol/L (MMW-04) � Phone Call Made</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Cpu size={13} style={{ display: 'inline', marginRight: 4 }} />Automated Analyzers</span>
          <span className="metric-val">4 Instruments Online</span>
          <span className="metric-sub">Sysmex XN-1000 � Cobas 6000 � Mindray</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Droplet size={13} style={{ display: 'inline', marginRight: 4 }} />Blood Bank Crossmatches</span>
          <span className="metric-val">18 Units Ready</span>
          <span className="metric-sub">4 Emergency O-Negative Units Reserved</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('laboratory')}>
          <FlaskConical size={15} /> <span>Open Laboratory LIS Suite</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('blood-bank')}>
          <Droplet size={15} /> <span>Blood Bank Crossmatch</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Panic Value Logged & Attending Doctor Telephoned')}>
          <PhoneCall size={15} /> <span>Log Panic Phone Call</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Specimen Accession & Result Validation Queue</span>
          <span style={{ fontSize: '0.75rem', color: '#0052D4' }}>Average Turnaround: 34 mins</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {[
            { bar: 'LAB-8841', pt: 'Elder Etebong Udo', test: 'Serum Electrolytes, Urea & Creatinine (E/U/Cr)', result: 'K+: 6.8 mmol/L (PANIC HIGH) � Cr: 210 �mol/L', analyzer: 'Roche Cobas c501', status: 'PANIC ALERT', alert: true },
            { bar: 'LAB-8840', pt: 'Blessing Okon', test: 'Full Blood Count + Diff (FBC)', result: 'WBC: 18.4 x10^9/L � Platelets: 98 x10^9/L � Hb: 8.2 g/dL', analyzer: 'Sysmex XN-1000', status: 'Awaiting Sign-off', alert: false },
            { bar: 'LAB-8839', pt: 'Usen Akpan', test: 'Pre-Op Blood Grouping & Crossmatch', result: 'Group O Rh(D) Positive � 2 Units Compatible', analyzer: 'Manual Tile / Gel Card', status: 'Crossmatch Complete', alert: false },
            { bar: 'LAB-8838', pt: 'Emem Archibong', test: 'Malaria Parasite (MP) Film + RDT', result: 'P. falciparum (+++) Ring forms seen', analyzer: 'Olympus CX23 Microscopy', status: 'Validated', alert: false },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${s.alert ? '#EF4444' : '#FFFFFF'}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0052D4', fontFamily: 'monospace' }}>{s.bar}</span>
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>{s.pt}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{s.test}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: s.alert ? '#F87171' : '#CBD5E1', marginTop: 4, fontWeight: s.alert ? 700 : 500 }}>
                  Result: {s.result}
                </div>
              </div>
              <button
                className="os-primary-btn"
                style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                onClick={() => triggerAction(`Released verified lab result: ${s.bar} for ${s.pt}`)}
              >
                Sign & Transmit
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   7. RADIOLOGIST DASHBOARD
------------------------------------------------------------- */
function RadiologistDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Layers size={13} style={{ display: 'inline', marginRight: 4 }} />Unread PACS Studies</span>
          <span className="metric-val">19 Scans</span>
          <span className="metric-sub">6 CT � 4 MRI � 7 Digital X-Ray � 2 Ultrasound</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><Flame size={13} style={{ display: 'inline', marginRight: 4 }} />STAT Emergency Trauma</span>
          <span className="metric-val">3 Priority Scans</span>
          <span className="metric-sub">CT Polytrauma (A&E) � Acute Stroke CT</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Activity size={13} style={{ display: 'inline', marginRight: 4 }} />Modalities Online</span>
          <span className="metric-val">4 / 4 Modalities</span>
          <span className="metric-sub">128-Slice CT � 1.5T MRI � Digital X-Ray � 4D US</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Turnaround Time</span>
          <span className="metric-val">38 mins Avg</span>
          <span className="metric-sub">Target &lt; 60 mins � 96% SLA Compliance</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('radiology')}>
          <Layers size={15} /> <span>Launch PACS DICOM Viewer</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Voice Dictation Module Launched for Radiology Reporting')}>
          <FileText size={15} /> <span>Voice Dictation Reporting</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Critical Finding Alert Broadcast to A&E Consultant')}>
          <AlertTriangle size={15} /> <span>Broadcast Critical Finding</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">PACS DICOM Diagnostic Worklist</span>
          <span style={{ fontSize: '0.75rem', color: '#0052D4' }}>Integrated Orthanc & DICOM Gateway</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {[
            { id: 'PAC-4410', pt: 'Kufre Etim (32M)', modality: '128-Slice CT', exam: 'CT Brain (Non-Contrast) � Rule out Epidural Hematoma', ref: 'Dr. E. Bassey (A&E)', urgency: 'STAT Trauma', alert: true },
            { id: 'PAC-4409', pt: 'Iniobong Udoh (58F)', modality: 'Digital X-Ray', exam: 'Chest PA View � Suspected Lobar Consolidation', ref: 'Dr. A. Okon (Internal Med)', urgency: 'Urgent', alert: false },
            { id: 'PAC-4408', pt: 'David Akpan (45M)', modality: '1.5T MRI', exam: 'MRI Lumbar Spine � Radiculopathy L4-L5', ref: 'Dr. O. Friday (Ortho)', urgency: 'Routine', alert: false },
            { id: 'PAC-4407', pt: 'Mary Bassey (26F)', modality: 'Sonography', exam: 'Pelvic & Obstetric Ultrasound � 34 Weeks Gestation', ref: 'Midwife Archibong', urgency: 'Routine', alert: false },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${p.alert ? '#EF4444' : '#FFFFFF'}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0052D4', fontFamily: 'monospace' }}>{p.id}</span>
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>{p.pt}</span>
                  <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(2,132,199,0.2)', color: '#0052D4', fontWeight: 700 }}>
                    {p.modality}
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: p.alert ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: p.alert ? '#EF4444' : '#F59E0B' }}>
                    {p.urgency}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: 4 }}>{p.exam}</div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: 2 }}>Referred by: {p.ref}</div>
              </div>
              <button
                className="os-primary-btn"
                style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                onClick={() => triggerAction(`Launched PACS Viewer for ${p.id}`, 'radiology')}
              >
                Open DICOM
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   8. ACCOUNTANT DASHBOARD
------------------------------------------------------------- */
function AccountantDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><CreditCard size={13} style={{ display: 'inline', marginRight: 4 }} />Today's Hospital Collections</span>
          <span className="metric-val">?4,820,500</span>
          <span className="metric-sub">5 Active Tills � 100% Reconciled</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><ShieldCheck size={13} style={{ display: 'inline', marginRight: 4 }} />AKSHIA & NHIA Insurance Claims</span>
          <span className="metric-val">?12,450,000</span>
          <span className="metric-sub">94.2% Adjudication Approval Rate</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Unsettled Inpatient Balances</span>
          <span className="metric-val">?1,840,000</span>
          <span className="metric-sub">14 Discharge Accounts Awaiting Clearance</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><BarChart3 size={13} style={{ display: 'inline', marginRight: 4 }} />State Health Remittance</span>
          <span className="metric-val">?3,600,000</span>
          <span className="metric-sub">Auto-Swept to Akwa Ibom TSA (Verified)</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="os-primary-btn"
          style={{ background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', color: '#FFF' }}
          onClick={() => {
            triggerAction('Opening Inpatient & Outpatient Billing Ledger to Add New Bill...', 'billing');
          }}
        >
          <Plus size={15} /> <span>Add New Bill</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('billing')}>
          <CreditCard size={15} /> <span>Inpatient / Outpatient Billing</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('cashier')}>
          <CreditCard size={15} /> <span>Cashier Shift Tills</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('claims')}>
          <ShieldCheck size={15} /> <span>AKSHIA / HMO Claims</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('revenue-cycle')}>
          <BarChart3 size={15} /> <span>Revenue Cycle & Ledger</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Active Cashier Tills & Collection Points</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>? All POS Terminals Online</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 12 }}>
          {[
            { till: 'Till 1 � GOPD Outpatient', cashier: 'Inemesit Okon', total: '?1,420,000', trans: '142 Receipts', status: 'Balanced' },
            { till: 'Till 2 � A&E Emergency', cashier: 'Ubong Umoh', total: '?980,500', trans: '84 Receipts', status: 'Balanced' },
            { till: 'Till 3 � Pharmacy Main POS', cashier: 'Mfon Akpan', total: '?1,240,000', trans: '168 Receipts', status: 'Balanced' },
            { till: 'Till 4 � Theatre & Inpatient Billing', cashier: 'Blessing Essien', total: '?1,180,000', trans: '28 Receipts', status: 'Balanced' },
          ].map((t, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#0052D4', fontSize: '0.88rem' }}>{t.till}</span>
                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(5,150,105,0.12)', color: '#059669', fontWeight: 700 }}>
                  {t.status}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A2540', margin: '6px 0' }}>{t.total}</div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'flex', justifyContent: 'space-between' }}>
                <span>Cashier: {t.cashier}</span>
                <span>{t.trans}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   9. MEDICAL RECORDS OFFICER DASHBOARD
------------------------------------------------------------- */
function RecordsDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Today's Registrations</span>
          <span className="metric-val">84 Patients</span>
          <span className="metric-sub">56 New In-State Registrations � 28 Follow-ups</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><FileText size={13} style={{ display: 'inline', marginRight: 4 }} />AkwaHealth Smart Cards Issued</span>
          <span className="metric-val">62 Cards</span>
          <span className="metric-sub">RFID / QR Encoded with FHIR Patient ID</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><Package size={13} style={{ display: 'inline', marginRight: 4 }} />Archive Folders Dispatched</span>
          <span className="metric-val">140 Folders</span>
          <span className="metric-sub">Sent to Specialty Clinics on Time</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Calendar size={13} style={{ display: 'inline', marginRight: 4 }} />Appointments Booked</span>
          <span className="metric-val">96 Bookings</span>
          <span className="metric-sub">Cardiology, GOPD, O&G, Paediatrics</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('patient-card')}>
          <FileText size={15} /> <span>Digital Health Card (FHIR)</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('patient-flow')}>
          <RefreshCw size={15} /> <span>Patient Flow & Admissions</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('New Patient Intake Record & FHIR Bundle Created')}>
          <Plus size={15} /> <span>Register New Inpatient</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Front-Desk Patient Registration & Smart Card Issuance Stream</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>HL7 FHIR Patient Resource Synced</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {[
            { mrn: 'AK-2026-9014', name: 'Nseobong Sunday Udoh', lga: 'Uyo LGA', type: 'GOPD Consultation', card: 'Card Issued', time: '09:22 AM' },
            { mrn: 'AK-2026-9013', name: 'Blessing Ekong Asuquo', lga: 'Ikot Ekpene LGA', type: 'Antenatal Booking', card: 'Card Issued', time: '09:14 AM' },
            { mrn: 'AK-2026-9012', name: 'Aniefiok Okon Bassey', lga: 'Eket LGA', type: 'Emergency A&E Intake', card: 'Temporary Band Issued', time: '08:58 AM' },
            { mrn: 'AK-2026-9011', name: 'Christiana Edet Archibong', lga: 'Oron LGA', type: 'Paediatric Immunization', card: 'Card Issued', time: '08:45 AM' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0052D4', fontFamily: 'monospace' }}>{p.mrn}</span>
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>{p.name}</span>
                  <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>{p.lga}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#CBD5E1', marginTop: 3 }}>Type: {p.type} � Registered: {p.time}</div>
              </div>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, background: 'rgba(5,150,105,0.1)', color: '#059669', fontWeight: 700 }}>
                {p.card}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   10. BIOMEDICAL ENGINEER DASHBOARD
------------------------------------------------------------- */
function BiomedicalDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Wrench size={13} style={{ display: 'inline', marginRight: 4 }} />Total Managed Equipment</span>
          <span className="metric-val">412 Assets</span>
          <span className="metric-sub">Tagged with Barcodes & IoT Telemetry</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Gauge size={13} style={{ display: 'inline', marginRight: 4 }} />Equipment In Service</span>
          <span className="metric-val">398 / 412 (96.6%)</span>
          <span className="metric-sub">Active & Calibrated Life-Support Devices</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />Breakdown Work Orders</span>
          <span className="metric-val">6 Active</span>
          <span className="metric-sub">2 High Priority (A&E Defibrillator, ICU Monitor)</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Activity size={13} style={{ display: 'inline', marginRight: 4 }} />Central Oxygen Plant Purity</span>
          <span className="metric-val">99.2% O2 Purity</span>
          <span className="metric-sub">Pressure 4.8 Bar � Piping to all 6 Wards OK</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('biomedical')}>
          <Wrench size={15} /> <span>Biomedical Equipment Suite</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('facilities')}>
          <Gauge size={15} /> <span>Oxygen Plant & Utilities</span>
        </button>
        <button className="os-ghost-btn" onClick={() => triggerAction('Logged Preventive Maintenance Calibration Certificate')}>
          <CheckCircle2 size={15} /> <span>Log Calibration</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Critical Life-Support Asset Telemetry & Work Orders</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>Oxygen Plant Pressure: 4.8 Bar</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {[
            { asset: 'BME-084', device: 'Dr�ger Evita V300 Ventilator', loc: 'ICU Bed 03', status: 'Operational', lastCal: '04 Sept 2026', nextCal: '04 Dec 2026', ok: true },
            { asset: 'BME-112', device: 'Mindray BeneHeart D6 Defibrillator', loc: 'A&E Resuscitation', status: 'Battery Replaced � Ready', lastCal: '12 Sept 2026', nextCal: '12 Dec 2026', ok: true },
            { asset: 'BME-194', device: 'GE Healthcare Aisys CS2 Anaesthesia Workstation', loc: 'Theatre 2', status: 'Leak Test Passed', lastCal: '15 Sept 2026', nextCal: '15 Dec 2026', ok: true },
            { asset: 'BME-230', device: 'Natus Olympic Infant Phototherapy Unit', loc: 'NICU Nursery', status: 'Bulb Replacement Overdue', lastCal: '10 June 2026', nextCal: 'OVERDUE', ok: false },
          ].map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${d.ok ? '#FFFFFF' : '#F59E0B'}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0052D4', fontFamily: 'monospace' }}>{d.asset}</span>
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>{d.device}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{d.loc}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: d.ok ? '#4ADE80' : '#F59E0B', marginTop: 3 }}>
                  Status: {d.status} � Next PPM: {d.nextCal}
                </div>
              </div>
              <button
                className="os-ghost-btn"
                style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                onClick={() => triggerAction(`Inspected service log for ${d.asset}`)}
              >
                Service Log
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   11. MEDICAL DIRECTOR DASHBOARD
------------------------------------------------------------- */
function MedicalDirectorDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Building2 size={13} style={{ display: 'inline', marginRight: 4 }} />Hospital Bed Occupancy</span>
          <span className="metric-val">482 / 520 Beds</span>
          <span className="metric-sub">92.6% Occupancy � 38 Available</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Clinical Staff on Duty</span>
          <span className="metric-val">186 Present</span>
          <span className="metric-sub">34 Doctors � 112 Nurses � 40 Techs</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><ShieldCheck size={13} style={{ display: 'inline', marginRight: 4 }} />Clinical Quality & Safety</span>
          <span className="metric-val">0 Sentinel Events</span>
          <span className="metric-sub">Inpatient Mortality 0.8% � ALOS 3.8 Days</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><PhoneCall size={13} style={{ display: 'inline', marginRight: 4 }} />Inter-Hospital MoH Link</span>
          <span className="metric-val">3 Transfers In</span>
          <span className="metric-sub">From Eket & Ikot Ekpene General Hospitals</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('command')}>
          <Activity size={15} /> <span>Hospital Command Centre</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('analytics')}>
          <BarChart3 size={15} /> <span>Clinical Performance Analytics</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('compliance')}>
          <FileText size={15} /> <span>Clinical Audit & Quality Logs</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('staffing')}>
          <Users size={15} /> <span>Doctor & Nurse Shift Rosters</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Departmental Clinical Governance & Census Overview</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>State MoH Telemetry Active</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 12 }}>
          {[
            { dept: 'Accident & Emergency', beds: '28 / 32 Beds', staff: '4 MDs � 8 RNs', status: 'Surge Warning', color: '#F59E0B' },
            { dept: 'Operating Theatres', beds: '3 / 4 Theatres', staff: '6 Surgeons � 8 Anaesth', status: 'Normal Flow', color: '#22C55E' },
            { dept: 'Intensive Care Unit (ICU)', beds: '14 / 16 Beds', staff: '4 Intensivists � 8 RNs', status: 'High Occupancy', color: '#EF4444' },
            { dept: 'Maternity & Labour', beds: '32 / 44 Beds', staff: '3 Obs � 7 Midwives', status: 'Normal Flow', color: '#22C55E' },
            { dept: 'Paediatrics & NICU', beds: '41 / 56 Beds', staff: '4 Paeds � 11 RNs', status: 'Normal Flow', color: '#22C55E' },
            { dept: 'Internal Medicine Wards', beds: '82 / 96 Beds', staff: '8 MDs � 18 RNs', status: 'High Occupancy', color: '#FB923C' },
          ].map((d, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, color: '#0052D4', fontSize: '0.85rem' }}>{d.dept}</span>
                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: `${d.color}22`, color: d.color, fontWeight: 700 }}>
                  {d.status}
                </span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0A2540', margin: '4px 0' }}>{d.beds}</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Staffing: {d.staff}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   12. SYSADMIN DASHBOARD
------------------------------------------------------------- */
function SysadminDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <>
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Active Authenticated Sessions</span>
          <span className="metric-val">84 Hospital Users</span>
          <span className="metric-sub">JWT Bearer � PKI Smart Cards Active</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Cpu size={13} style={{ display: 'inline', marginRight: 4 }} />System Uptime & Latency</span>
          <span className="metric-val">99.98% � 18ms</span>
          <span className="metric-sub">API Gateway, DB & PACS Nodes Healthy</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Database size={13} style={{ display: 'inline', marginRight: 4 }} />HL7 FHIR Interop Gateway</span>
          <span className="metric-val">1,420 Bundles</span>
          <span className="metric-sub">0 Errors � FHIR R4 Compliant</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><ShieldCheck size={13} style={{ display: 'inline', marginRight: 4 }} />Immutable Audit Ledger</span>
          <span className="metric-val">Block #84,219</span>
          <span className="metric-sub">100% Cryptographic Hash Verification</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('sysadmin')}>
          <Shield size={15} /> <span>System Administration</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('rbac')}>
          <Lock size={15} /> <span>Role-Based Access Control</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('fhir')}>
          <Database size={15} /> <span>FHIR R4 Message Gateway</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('compliance')}>
          <FileText size={15} /> <span>Security & Audit Logs</span>
        </button>
      </div>

      <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
        <div className="os-section-header">
          <span className="os-section-title">Core Infrastructure Node Health & Security Feed</span>
          <span style={{ fontSize: '0.75rem', color: '#059669' }}>All 6 Nodes Operational</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 12 }}>
          {[
            { node: 'MedCore API Gateway', host: 'api.medcore.aks.gov.ng', port: '443 (HTTPS)', status: 'Online � 14ms', ok: true },
            { node: 'PostgreSQL Relational DB', host: 'db.medcore.internal', port: '5432', status: 'Online � 2.4GB / 50GB', ok: true },
            { node: 'FHIR R4 Server', host: 'fhir.medcore.internal', port: '8080', status: 'Online � HAPI FHIR R4', ok: true },
            { node: 'PACS Orthanc DICOM', host: 'pacs.medcore.internal', port: '4242', status: 'Online � 1.4TB DICOM', ok: true },
            { node: 'Redis Session Cache', host: 'redis.medcore.internal', port: '6379', status: 'Online � 84 Keys', ok: true },
            { node: 'Immutable Audit Hash Chain', host: 'audit.medcore.internal', port: '8443', status: 'Verified Integrity', ok: true },
          ].map((n, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 800, color: '#0052D4', fontSize: '0.85rem' }}>{n.node}</span>
                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(5,150,105,0.12)', color: '#059669', fontWeight: 700 }}>
                  Active
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#CBD5E1', margin: '4px 0', fontFamily: 'monospace' }}>{n.host}:{n.port}</div>
              <div style={{ fontSize: '0.74rem', color: '#059669' }}>{n.status}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------
   12. HOSPITAL ADMIN DASHBOARD
------------------------------------------------------------- */
function HospitalAdminDashboardBody({ onNavigate, triggerAction, activeTab, session }: any) {
  const [recentTransfers] = React.useState([
    { id: 'TRF-0091', staff: 'Dr. Fatima Al-Hassan', from: 'LUTH', to: 'UCH', date: '2026-10-01', status: 'pending' },
    { id: 'TRF-0088', staff: 'Dr. Amara Okafor',     from: 'AKTH', to: 'LIGH', date: '2026-09-01', status: 'completed' },
    { id: 'TRF-0085', staff: 'Nurse Chioma Eze',     from: 'LIGH', to: 'ISTH', date: '2026-08-15', status: 'completed' },
  ]);

  const staffByDept = [
    { dept: 'Internal Medicine', count: 14, icon: <Stethoscope size={14} />, color: '#0284C7' },
    { dept: 'Surgery',           count: 9,  icon: <Activity size={14} />,    color: '#DC2626' },
    { dept: 'Nursing',           count: 34, icon: <Users size={14} />,       color: '#7C3AED' },
    { dept: 'Pharmacy',          count: 6,  icon: <Pill size={14} />,        color: '#059669' },
    { dept: 'Laboratory',        count: 8,  icon: <FlaskConical size={14} />,color: '#0891B2' },
    { dept: 'Radiology',         count: 5,  icon: <Layers size={14} />,      color: '#6D28D9' },
    { dept: 'Finance',           count: 7,  icon: <CreditCard size={14} />,  color: '#B45309' },
    { dept: 'IT & Admin',        count: 4,  icon: <Cpu size={14} />,         color: '#374151' },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Total Staff</span>
          <span className="metric-val">87 Officers</span>
          <span className="metric-sub">Active at {session?.facility || 'Your Hospital'}</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Send size={13} style={{ display: 'inline', marginRight: 4 }} />Pending Transfers</span>
          <span className="metric-val">1 Active</span>
          <span className="metric-sub">Awaiting approval</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><UserCheck size={13} style={{ display: 'inline', marginRight: 4 }} />Today's Logins</span>
          <span className="metric-val">64 Staff</span>
          <span className="metric-sub">73.6% attendance rate</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Building2 size={13} style={{ display: 'inline', marginRight: 4 }} />Open Positions</span>
          <span className="metric-val">12 Vacancies</span>
          <span className="metric-sub">3 urgent � 9 planned</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="os-primary-btn" onClick={() => onNavigate('transfer')}>
          <Send size={15} /> <span>Staff Transfer Panel</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('staffing')}>
          <Users size={15} /> <span>Staffing Overview</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('rbac')}>
          <Shield size={15} /> <span>Access Control</span>
        </button>
        <button className="os-ghost-btn" onClick={() => onNavigate('compliance')}>
          <ShieldCheck size={15} /> <span>Compliance & Audit</span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Department Breakdown */}
          <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
            <div className="os-section-header">
              <span className="os-section-title">Staff by Department</span>
              <span style={{ fontSize: '0.75rem', color: '#059669' }}>{staffByDept.reduce((a, b) => a + b.count, 0)} Total</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {staffByDept.map(d => (
                <div key={d.dept} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: d.color, flexShrink: 0 }}>{d.icon}</span>
                  <span style={{ flex: 1, fontSize: '0.83rem', color: '#94A3B8' }}>{d.dept}</span>
                  <div style={{ width: 80, height: 5, borderRadius: 99, background: '#FFFFFF', overflow: 'hidden' }}>
                    <div style={{ width: `${(d.count / 34) * 100}%`, height: '100%', background: d.color, borderRadius: 99, opacity: 0.8 }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', width: 24, textAlign: 'right', fontFamily: 'monospace' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transfers */}
          <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
            <div className="os-section-header">
              <span className="os-section-title">Recent Transfers</span>
              <button className="os-ghost-btn" style={{ fontSize: '0.72rem', padding: '3px 9px' }} onClick={() => onNavigate('transfer')}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {recentTransfers.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0', borderRadius: 9,
                }}>
                  <Send size={13} color="#60A5FA" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.staff}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {t.from} <ArrowRight size={10} color="#374151" /> {t.to} � {t.date}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                    color: t.status === 'pending' ? '#60A5FA' : '#22C55E',
                    background: t.status === 'pending' ? 'rgba(96,165,250,0.1)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${t.status === 'pending' ? 'rgba(96,165,250,0.25)' : 'rgba(34,197,94,0.25)'}`,
                  }}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
          <div className="os-section-header">
            <span className="os-section-title">Administrative Task Queue</span>
            <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>4 Pending</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {[
              { task: 'Approve Transfer TRF-0091 � Dr. Fatima Al-Hassan', priority: 'urgent', due: 'Today' },
              { task: 'Review monthly nurse attendance report', priority: 'high', due: 'Sep 25' },
              { task: 'Sign off 3 staff leave requests', priority: 'normal', due: 'Sep 26' },
              { task: 'Update hospital org chart for Q4 2026', priority: 'low', due: 'Oct 01' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0', borderRadius: 9,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: item.priority === 'urgent' ? '#EF4444' : item.priority === 'high' ? '#F59E0B' : item.priority === 'normal' ? '#60A5FA' : '#4B5563',
                }} />
                <span style={{ flex: 1, fontSize: '0.85rem', color: '#CBD5E1' }}>{item.task}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace', flexShrink: 0 }}>{item.due}</span>
                <button className="os-ghost-btn" onClick={() => triggerAction('Task acknowledged')} style={{ fontSize: '0.72rem', padding: '3px 9px' }}>Action</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { type: 'warning', title: 'Understaffing Alert � ICU', detail: 'ICU night shift has 2 nurses instead of minimum 4. Consider emergency redeployment.', time: '08:15' },
            { type: 'info',    title: 'Staff Transfer Request Received', detail: 'TRF-0091 awaiting your approval � Radiology specialist to UCH.', time: '07:30' },
            { type: 'success', title: 'Monthly Payroll Processed', detail: 'All 87 staff salaries confirmed disbursed via IPPIS for September 2026.', time: '06:00' },
          ].map((a, i) => (
            <div key={i} className="os-card" style={{
              padding: '12px 16px',
              borderLeft: `3px solid ${a.type === 'warning' ? '#F59E0B' : a.type === 'info' ? '#60A5FA' : '#22C55E'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: a.type === 'warning' ? '#F59E0B' : a.type === 'info' ? '#60A5FA' : '#22C55E', fontSize: '0.85rem', marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{a.detail}</div>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#4B5563', flexShrink: 0, marginLeft: 12 }}>{a.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
