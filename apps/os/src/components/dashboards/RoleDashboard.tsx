'use client';

import React, { useState, lazy, Suspense } from 'react';
import { UserSession } from '../auth/AuthScreen';
import { inferRoleKey, isReceptionRole, listStaffCards } from '../../lib/staffCardStore';
import { emitLiveAction } from '../../lib/liveActions';
import {
  Stethoscope, Activity, Flame, Wind, Pill, FlaskConical, Layers, Baby, Droplet,
  FileText, BedDouble, Users, Clock, ShieldCheck, AlertTriangle, CheckCircle2,
  ArrowRight, Search, Building2, CreditCard, Package, Wrench, Gauge, Brain,
  Sparkles, Calendar, TrendingUp, Plus, PhoneCall, Bell, FileCheck, Eye, RefreshCw,
  Lock, Check, AlertCircle, Heart, HeartPulse, Shield, BarChart3, Database, Cpu, Zap, LogOut, Send, UserCheck
} from 'lucide-react';

// Heavy role workspaces — loaded only when the matching role logs in
const AdminWorkspace     = lazy(() => import('./AdminWorkspace').then(m => ({ default: m.AdminWorkspace })));
const ReceptionWorkspace = lazy(() => import('./ReceptionWorkspace').then(m => ({ default: m.ReceptionWorkspace })));
const DoctorDeskHome     = lazy(() => import('./DoctorDeskHome').then(m => ({ default: m.DoctorDeskHome })));
const LabDeskHome        = lazy(() => import('./LabDeskHome').then(m => ({ default: m.LabDeskHome })));
const RecordsDeskHome    = lazy(() => import('./RecordsDeskHome').then(m => ({ default: m.RecordsDeskHome })));
const NurseDeskHome      = lazy(() => import('./NurseDeskHome').then(m => ({ default: m.NurseDeskHome })));
const RoleDeskHome       = lazy(() => import('./RoleDeskHome').then(m => ({ default: m.RoleDeskHome })));
import type { RoleDeskConfig } from './RoleDeskHome';

const WorkspaceSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, animation: 'os-pulse 1.4s ease-in-out infinite' }}>
    <div style={{ height: 28, width: '35%', background: 'rgba(15,23,42,0.06)', borderRadius: 8 }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {[1,2,3,4].map(i => <div key={i} style={{ height: 80, background: 'rgba(15,23,42,0.06)', borderRadius: 12 }} />)}
    </div>
    <div style={{ height: 200, background: 'rgba(15,23,42,0.04)', borderRadius: 12 }} />
  </div>
);
interface RoleDashboardProps {
  session: UserSession;
  onNavigate: (moduleKey: any) => void;
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({ session, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'alerts'>('overview');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const triggerAction = (msg: string, navKey?: string) => {
    setActionNotice(msg);
    emitLiveAction(msg, { module: navKey });
    setTimeout(() => setActionNotice(null), 3500);
    if (navKey) {
      setTimeout(() => onNavigate(navKey), 600);
    }
  };

  const roleKey = inferRoleKey(session.roleKey || session.role || session.title, session.badgeId);

  // Reception: full front-desk workspace — never clinical desk
  if (roleKey === 'reception' || isReceptionRole(session.roleKey, session.role, session.title, session.badgeId)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {actionNotice && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            background: '#FFFFFF', color: '#0284C7', border: '1px solid #BAE6FD',
            borderRadius: 10, padding: '12px 18px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', fontWeight: 600,
          }}>
            <CheckCircle2 size={16} color="#0284C7" />
            <span>{actionNotice}</span>
          </div>
        )}
        <Suspense fallback={<WorkspaceSkeleton />}>
          <ReceptionWorkspace session={session} onNavigate={(k) => onNavigate(k)} />
        </Suspense>
      </div>
    );
  }

  // Doctor clinical desk — same pattern as reception Front Desk
  if (roleKey === 'doctor') {
    return <Suspense fallback={<WorkspaceSkeleton />}><DoctorDeskHome session={session} onNavigate={(k) => onNavigate(k)} /></Suspense>;
  }

  // Laboratory desk — dedicated real-time EMR lab operations workspace
  if (roleKey === 'lab') {
    return <Suspense fallback={<WorkspaceSkeleton />}><LabDeskHome session={session} onNavigate={(k) => onNavigate(k)} /></Suspense>;
  }

  // Health records / HIM — intelligent MPI & folder desk (not clinical prescribe)
  if (roleKey === 'records') {
    return <Suspense fallback={<WorkspaceSkeleton />}><RecordsDeskHome session={session} onNavigate={(k) => onNavigate(k)} /></Suspense>;
  }

  // Nurse clinical office desk — dedicated real-time workspace (no hero, quick actions first, realtime tools)
  if (roleKey === 'nurse') {
    return <Suspense fallback={<WorkspaceSkeleton />}><NurseDeskHome session={session} onNavigate={(k) => onNavigate(k)} /></Suspense>;
  }

  const deskForRole = (key: string): RoleDeskConfig | null => {
    const ai = { label: 'Clinical Assistant', desc: 'CDS & Desk AI', icon: Brain, go: 'm87-ai' };
    switch (key) {
      case 'midwife':
        return {
          title: 'Labour & Delivery Desk',
          subtitle: 'Grease board, CTG, partograph, and birth outcomes — maternity only.',
          badge: 'Maternity · Midwifery',
          boardTitle: 'Labour / maternity board',
          boardEmpty: 'No active labour cases — admit from Maternity EMR.',
          quick: [
            { label: 'Maternity EMR', desc: 'CTG · Partograph', icon: Baby, go: 'maternity' },
            { label: 'Maternity beds', desc: 'Occupancy', icon: BedDouble, go: 'beds' },
            { label: 'OB emergency', desc: 'Resus / PPH', icon: Flame, go: 'emergency' },
            { label: 'Newborn', desc: 'NICU link', icon: HeartPulse, go: 'paediatrics' },
            { label: 'Clinical Assistant', desc: 'Maternity CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'nurse':
        return {
          title: 'Nursing desk',
          subtitle: 'Tasks, ward board, and patient flow in one place.',
          badge: 'Nursing · Wards',
          boardTitle: 'Ward / clinic board',
          boardEmpty: 'No active visits — reception check-ins appear here.',
          quick: [
            { label: 'Triage / Vitals', desc: 'OPD vitals', icon: Heart, go: 'triage' },
            { label: 'Inpatient', desc: 'Nursing suite', icon: BedDouble, go: 'nursing' },
            { label: 'EMR', desc: 'Records', icon: FileText, go: 'emr' },
            { label: 'Patient flow', desc: 'Queue', icon: Activity, go: 'patient-flow' },
            { label: 'Beds', desc: 'Occupancy', icon: BedDouble, go: 'beds' },
            { label: 'Maternity', desc: 'OG suite', icon: Baby, go: 'maternity' },
          ],
        };
      case 'pharmacist':
        return {
          title: 'Pharmacy desk',
          subtitle: 'Dispense from live prescriptions on the clinical bus.',
          badge: 'Pharmacy · Dispensing',
          boardTitle: 'Clinic activity',
          boardEmpty: 'No visits in queue.',
          orderType: 'rx',
          quick: [
            { label: 'Dispense', desc: 'Pharmacy suite', icon: Pill, go: 'pharmacy' },
            { label: 'EMR', desc: 'Records', icon: FileText, go: 'emr' },
            { label: 'Cashier', desc: 'Payments', icon: CreditCard, go: 'cashier' },
          ],
        };
      case 'radiologist':
        return {
          title: 'Imaging desk',
          subtitle: 'RIS worklist, PACS reporting, and imaging history.',
          badge: 'Radiology · PACS',
          boardTitle: 'Clinic activity',
          boardEmpty: 'No visits in queue.',
          orderType: 'imaging',
          quick: [
            { label: 'RIS / PACS', desc: 'Worklist & viewer', icon: Layers, go: 'radiology' },
            { label: 'EMR', desc: 'Records', icon: FileText, go: 'emr' },
            { label: 'Imaging Assistant', desc: 'Draft reporting', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'surgeon':
        return {
          title: 'Theatre desk',
          subtitle: 'Cases, lists, and perioperative coordination.',
          badge: 'Theatre · Surgery',
          boardTitle: 'Clinic / board',
          boardEmpty: 'No active visits.',
          quick: [
            { label: 'Theatre', desc: 'OT suite', icon: Activity, go: 'theatre' },
            { label: 'EMR', desc: 'Records', icon: FileText, go: 'emr' },
            { label: 'ICU', desc: 'Critical care', icon: HeartPulse, go: 'icu' },
          ],
        };
      case 'records':
        return {
          title: 'Health records command',
          subtitle: 'MPI quality, folder integrity, transit & census — intelligent HIM desk.',
          badge: 'HIM · Records',
          boardTitle: 'Today’s registrations',
          boardEmpty: 'No new folders yet today.',
          quick: [
            { label: 'MPI / Card', desc: 'FHIR enrolment', icon: CreditCard, go: 'patient-card' },
            { label: 'Chart retrieval', desc: 'View only', icon: FileText, go: 'emr' },
            { label: 'Transit', desc: 'Admissions', icon: RefreshCw, go: 'patient-flow' },
            { label: 'Records Assistant', desc: 'HIM search & CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'accountant':
        return {
          title: 'Finance desk',
          subtitle: 'Cashier, billing, and claims visibility.',
          badge: 'Revenue · Finance',
          boardTitle: 'Today’s activity',
          boardEmpty: 'No visits yet.',
          quick: [
            { label: 'Cashier', desc: 'POS', icon: CreditCard, go: 'cashier' },
            { label: 'Billing', desc: 'Invoices', icon: BarChart3, go: 'billing' },
            { label: 'Claims', desc: 'HMO / NHIS', icon: FileText, go: 'insurance' },
          ],
        };
      case 'biomedical':
        return {
          title: 'Biomedical desk',
          subtitle: 'Equipment and facility readiness.',
          badge: 'Biomedical · Engineering',
          boardTitle: 'Hospital pulse',
          boardEmpty: 'No visit load.',
          quick: [
            { label: 'Equipment', desc: 'Biomed suite', icon: Wrench, go: 'biomedical' },
            { label: 'Facilities', desc: 'Utilities', icon: Building2, go: 'facilities' },
          ],
        };
      case 'sysadmin':
      case 'medical_director':
        return {
          title: key === 'sysadmin' ? 'System desk' : 'Director desk',
          subtitle: 'Oversight, command, and hospital performance.',
          badge: key === 'sysadmin' ? 'IT · Systems' : 'Medical director',
          boardTitle: 'Hospital activity',
          boardEmpty: 'No visits yet today.',
          quick: [
            { label: 'Command', desc: 'Centre', icon: Activity, go: 'command' },
            { label: 'Analytics', desc: 'Performance', icon: BarChart3, go: 'analytics' },
            { label: 'Data hub', desc: 'Integration', icon: Database, go: 'data-hub' },
          ],
        };
      // ── Specialty roles ────────────────────────────────────────────────────
      case 'dentist':
        return {
          title: 'Dental Clinic Desk',
          subtitle: 'Dental examination, odontogram, and oral procedures.',
          badge: 'Dental · Oral Health',
          boardTitle: "Today's dental queue",
          boardEmpty: 'No dental appointments yet.',
          quick: [
            { label: 'Dental Suite', desc: 'Odontogram', icon: Sparkles, go: 'dental' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Cashier', desc: 'Payments', icon: CreditCard, go: 'cashier' },
            { label: 'Dental AI', desc: 'Clinical assist', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'ophthalmologist':
        return {
          title: 'Eye Clinic Desk',
          subtitle: 'Visual acuity, slit-lamp, and ophthalmology workups.',
          badge: 'Ophthalmology · Eye Care',
          boardTitle: "Today's eye clinic queue",
          boardEmpty: 'No eye clinic appointments yet.',
          quick: [
            { label: 'Eye Clinic', desc: 'Optometry suite', icon: Eye, go: 'ophthalmology' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Clinical AI', desc: 'Ophthalmic CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'physiotherapist':
        return {
          title: 'Physiotherapy Desk',
          subtitle: 'Rehabilitation plans, session notes, and progress tracking.',
          badge: 'Physiotherapy · Rehab',
          boardTitle: "Today's rehab sessions",
          boardEmpty: 'No sessions scheduled yet.',
          quick: [
            { label: 'Physio Suite', desc: 'Rehab plans', icon: Activity, go: 'physiotherapy' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Clinical AI', desc: 'Rehab CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'nutritionist':
        return {
          title: 'Nutrition & Dietetics Desk',
          subtitle: 'Dietary assessments, meal plans, and nutritional counselling.',
          badge: 'Nutrition · Dietetics',
          boardTitle: "Today's nutrition consults",
          boardEmpty: 'No nutrition consults yet.',
          quick: [
            { label: 'Nutrition Suite', desc: 'Diet plans', icon: Sparkles, go: 'nutrition' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Nutrition AI', desc: 'Dietary CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'psychiatrist':
        return {
          title: 'Psychiatry Desk',
          subtitle: 'Mental health assessments, therapy notes, and care plans.',
          badge: 'Psychiatry · Mental Health',
          boardTitle: "Today's psychiatric queue",
          boardEmpty: 'No psychiatric appointments yet.',
          quick: [
            { label: 'Psychiatry Suite', desc: 'Mental health EMR', icon: Brain, go: 'psychiatry' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Clinical AI', desc: 'Psych CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'oncologist':
        return {
          title: 'Oncology Desk',
          subtitle: 'Cancer staging, chemotherapy plans, and treatment tracking.',
          badge: 'Oncology · Cancer Care',
          boardTitle: "Today's oncology cases",
          boardEmpty: 'No oncology cases today.',
          quick: [
            { label: 'Oncology Suite', desc: 'Chemo plans', icon: FlaskConical, go: 'oncology' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Clinical AI', desc: 'Oncology CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'dialysis_nurse':
        return {
          title: 'Dialysis Unit Desk',
          subtitle: 'Renal replacement therapy sessions and machine monitoring.',
          badge: 'Dialysis · Renal Care',
          boardTitle: "Today's dialysis sessions",
          boardEmpty: 'No dialysis sessions scheduled.',
          quick: [
            { label: 'Dialysis Suite', desc: 'Session monitor', icon: Droplet, go: 'dialysis' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
            { label: 'Clinical AI', desc: 'Renal CDS', icon: Brain, go: 'm87-ai' },
          ],
        };
      case 'mortuary_attendant':
        return {
          title: 'Mortuary Desk',
          subtitle: 'Deceased record management, release, and documentation.',
          badge: 'Mortuary · Pathology',
          boardTitle: 'Active mortuary cases',
          boardEmpty: 'No active mortuary cases.',
          quick: [
            { label: 'Mortuary Suite', desc: 'Deceased records', icon: FileCheck, go: 'mortuary' },
            { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
          ],
        };
      case 'cssd_technician':
        return {
          title: 'CSSD Desk',
          subtitle: 'Instrument sterilisation cycles, tracking, and readiness.',
          badge: 'CSSD · Sterilisation',
          boardTitle: 'Sterilisation queue',
          boardEmpty: 'No sterilisation cycles pending.',
          quick: [
            { label: 'CSSD Suite', desc: 'Sterilisation log', icon: Package, go: 'cssd' },
            { label: 'Theatre', desc: 'OT link', icon: Activity, go: 'theatre' },
          ],
        };
      default:
        return null;
    }
  };

  const sharedDesk = deskForRole(roleKey);
  if (sharedDesk) {
    return (
      <RoleDeskHome
        session={session}
        onNavigate={(k) => onNavigate(k)}
        config={sharedDesk}
        heroTheme={roleKey === 'midwife' ? 'theme-maternity' : undefined}
        accentColor={roleKey === 'midwife' ? '#DB2777' : undefined}
      />
    );
  }

  // ── Custom / unknown role — build a generic desk from stored custom role data ──
  if (roleKey && roleKey !== 'records' && roleKey !== 'reception') {
    const roleName = session.role || session.title || roleKey;
    const displayTitle = roleName.charAt(0).toUpperCase() + roleName.slice(1);
    const genericDesk: RoleDeskConfig = {
      title: `${displayTitle} Desk`,
      subtitle: `${displayTitle} workspace — clinical tools and patient records.`,
      badge: displayTitle,
      boardTitle: "Today's patient activity",
      boardEmpty: 'No active visits yet.',
      quick: [
        { label: 'EMR', desc: 'Patient records', icon: FileText, go: 'emr' },
        { label: 'Patient flow', desc: 'Queue', icon: Activity, go: 'patient-flow' },
        { label: 'Clinical AI', desc: 'Celestia assist', icon: Brain, go: 'm87-ai' },
      ],
    };
    return (
      <RoleDeskHome
        session={session}
        onNavigate={(k) => onNavigate(k)}
        config={genericDesk}
      />
    );
  }

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
              <span>•</span>
              <span>{session.department || 'Clinical Governance'}</span>
              <span>•</span>
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
        <RecordsDeskHome session={session} onNavigate={onNavigate} />
      )}
      {roleKey === 'reception' && (
        <ReceptionDashboardBody onNavigate={onNavigate} triggerAction={triggerAction} activeTab={activeTab} />
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


/** Shared empty-state role home — no demo patients; actions navigate to live modules */
function RoleHome({
  title,
  subtitle,
  metrics,
  actions,
  triggerAction,
}: {
  title: string;
  subtitle: string;
  metrics: { label: string; value: string; sub: string; tone?: string }[];
  actions: { label: string; nav?: string; msg: string; primary?: boolean }[];
  triggerAction: (msg: string, navKey?: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      <div style={{
        padding: '20px 22px',
        borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(224,242,254,0.9) 0%, rgba(240,249,255,0.95) 45%, rgba(236,253,245,0.85) 100%)',
        border: '1px solid rgba(0,82,212,0.1)',
        boxShadow: '0 8px 32px rgba(0,82,212,0.06)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#0052D4',
          marginBottom: 8,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#10B981',
            boxShadow: '0 0 0 3px rgba(16,185,129,0.25)',
          }} />
          Live role desk
        </div>
        <h2 className="os-role-home-title" style={{ margin: 0 }}>{title}</h2>
        <p className="os-role-home-sub" style={{ margin: '8px 0 0' }}>{subtitle}</p>
      </div>
      <div className="os-metrics-ribbon">
        {metrics.map((m) => (
          <div key={m.label} className={`metric-box${m.tone === 'green' ? ' alert-green' : ''}`}>
            <span className="metric-label">{m.label}</span>
            <span className="metric-val" style={{ fontSize: '1.2rem' }}>{m.value}</span>
            <span className="metric-sub">{m.sub}</span>
          </div>
        ))}
      </div>
      <div className="os-role-action-grid">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={a.primary ? 'os-primary-btn' : 'os-ghost-btn'}
            onClick={() => triggerAction(a.msg, a.nav)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="os-role-note">
        Shared role workspace — everyone with this role uses the same tools. Patient queues and charts appear from live EMR and flow modules as care is recorded.
      </div>
    </div>
  );
}

function ReceptionDashboardBody({ onNavigate, triggerAction, activeTab }: any) {
  return (
    <RoleHome
      title="Reception / front desk"
      subtitle="All receptionists share registration, queue, and cashier handoff."
      metrics={[
        { label: 'Role', value: 'Reception', sub: 'Front desk', tone: 'green' },
        { label: 'Queue', value: 'Live', sub: 'Patient flow' },
        { label: 'Shift', value: 'Active', sub: 'Shared arrivals list' },
      ]}
      actions={[
        { label: 'Register patient', nav: 'patient-card', msg: 'Registration', primary: true },
        { label: 'Find record', nav: 'emr', msg: 'EMR search' },
        { label: 'Patient flow', nav: 'patient-flow', msg: 'Flow board' },
        { label: 'Cashier', nav: 'cashier', msg: 'Billing handoff' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


function DoctorDashboardBody({ onNavigate, triggerAction, activeTab }: any) {
  return (
    <RoleHome
      title="Physician workspace"
      subtitle="All doctors share this dashboard. Open EMR, wards, theatre, or Clinical Assistant from here."
      metrics={[
        { label: 'Role', value: 'Doctor', sub: 'Shared clinical desk', tone: 'green' },
        { label: 'Queue', value: 'Live', sub: 'From EMR / flow modules' },
        { label: 'Shift', value: 'Active', sub: 'Continue from last note' },
      ]}
      actions={[
        { label: 'Open EMR', nav: 'emr', msg: 'Opening EMR', primary: true },
        { label: 'Patient card', nav: 'patient-card', msg: 'Patient registration / card' },
        { label: 'Bed census', nav: 'beds', msg: 'Ward bed board' },
        { label: 'Theatre list', nav: 'theatre', msg: 'Operating theatre' },
        { label: 'Clinical Assistant', nav: 'm87-ai', msg: 'Clinical CDS & guidelines' },
        { label: 'Pharmacy / Rx', nav: 'pharmacy', msg: 'e-Prescription' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   2. SURGEON DASHBOARD
------------------------------------------------------------- */
function SurgeonDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Surgeon workspace"
      subtitle="Shared OT desk for all surgeons — lists and notes stay on the patient record across shifts."
      metrics={[
        { label: 'Role', value: 'Surgeon', sub: 'Theatre command', tone: 'green' },
        { label: 'OT board', value: 'Live', sub: 'Open theatre module' },
        { label: 'Shift', value: 'Active', sub: 'Handover via EMR' },
      ]}
      actions={[
        { label: 'Theatre schedule', nav: 'theatre', msg: 'Opening theatre', primary: true },
        { label: 'Open EMR', nav: 'emr', msg: 'Surgical notes / EMR' },
        { label: 'ICU', nav: 'icu', msg: 'Critical care' },
        { label: 'Surgical Assistant', nav: 'm87-ai', msg: 'Pre-op & surgical CDS' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   3. NURSE DASHBOARD
------------------------------------------------------------- */
function NurseDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Nursing workspace"
      subtitle="All nurses share this desk — wards, e-MAR, and vitals come from live modules."
      metrics={[
        { label: 'Role', value: 'Nurse', sub: 'Ward & e-MAR', tone: 'green' },
        { label: 'Wards', value: 'Live', sub: 'Inpatient nursing' },
        { label: 'Shift', value: 'Active', sub: 'Shared patient list' },
      ]}
      actions={[
        { label: 'Wards / e-MAR', nav: 'nursing', msg: 'Nursing module', primary: true },
        { label: 'Open EMR', nav: 'emr', msg: 'Clinical record' },
        { label: 'Bed board', nav: 'beds', msg: 'Bed occupancy' },
        { label: 'Patient flow', nav: 'patient-flow', msg: 'Flow board' },
        { label: 'Nursing Assistant', nav: 'm87-ai', msg: 'Vitals & triage support' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   4. MIDWIFE DASHBOARD
------------------------------------------------------------- */
function MidwifeDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Midwifery workspace"
      subtitle="Maternity and labour tools shared across midwifery shifts."
      metrics={[
        { label: 'Role', value: 'Midwife', sub: 'Maternity', tone: 'green' },
        { label: 'Labour', value: 'Live', sub: 'From nursing / EMR' },
        { label: 'Shift', value: 'Active', sub: 'Shared handover' },
      ]}
      actions={[
        { label: 'Maternity / wards', nav: 'nursing', msg: 'Maternity nursing', primary: true },
        { label: 'Open EMR', nav: 'emr', msg: 'Maternity EMR' },
        { label: 'Bed board', nav: 'beds', msg: 'Beds' },
        { label: 'Clinical Assistant', nav: 'm87-ai', msg: 'Clinical assistant' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   5. PHARMACIST DASHBOARD
------------------------------------------------------------- */
function PharmacistDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Pharmacy workspace"
      subtitle="Dispensary desk shared by all pharmacists on duty."
      metrics={[
        { label: 'Role', value: 'Pharmacist', sub: 'Dispensary', tone: 'green' },
        { label: 'Queue', value: 'Live', sub: 'Pharmacy module' },
        { label: 'Shift', value: 'Active', sub: 'Shared Rx queue' },
      ]}
      actions={[
        { label: 'Dispense / pharmacy', nav: 'pharmacy', msg: 'Pharmacy', primary: true },
        { label: 'Open EMR', nav: 'emr', msg: 'Medication history' },
        { label: 'Inventory', nav: 'inventory', msg: 'Medical store' },
        { label: 'Pharmacy CDS', nav: 'm87-ai', msg: 'Drug safety & formulary' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   6. LAB SCIENTIST DASHBOARD
------------------------------------------------------------- */
function LabDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Laboratory workspace"
      subtitle="LIS and specimen workflow shared across lab scientists."
      metrics={[
        { label: 'Role', value: 'Lab', sub: 'Pathology', tone: 'green' },
        { label: 'Orders', value: 'Live', sub: 'Laboratory module' },
        { label: 'Shift', value: 'Active', sub: 'Shared worklist' },
      ]}
      actions={[
        { label: 'Lab LIS', nav: 'laboratory', msg: 'Laboratory', primary: true },
        { label: 'Open EMR', nav: 'emr', msg: 'Lab results / EMR' },
        { label: 'Blood bank', nav: 'blood-bank', msg: 'Blood bank' },
        { label: 'Celestia', nav: 'm87-ai', msg: 'AI assistant' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   7. RADIOLOGIST DASHBOARD
------------------------------------------------------------- */
function RadiologistDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Radiology workspace"
      subtitle="Imaging desk shared by radiologists — open PACS and report in EMR."
      metrics={[
        { label: 'Role', value: 'Radiology', sub: 'Imaging', tone: 'green' },
        { label: 'Studies', value: 'Live', sub: 'Radiology module' },
        { label: 'Shift', value: 'Active', sub: 'Shared worklist' },
      ]}
      actions={[
        { label: 'Radiology / PACS', nav: 'radiology', msg: 'Radiology', primary: true },
        { label: 'Open EMR', nav: 'emr', msg: 'Reports in EMR' },
        { label: 'Imaging Assistant', nav: 'm87-ai', msg: 'Draft reads & report support' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   8. ACCOUNTANT DASHBOARD
------------------------------------------------------------- */
function AccountantDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Finance workspace"
      subtitle="Cashiers and finance officers share billing and POS tools."
      metrics={[
        { label: 'Role', value: 'Finance', sub: 'Billing & POS', tone: 'green' },
        { label: 'Tills', value: 'Live', sub: 'Cashier module' },
        { label: 'Shift', value: 'Active', sub: 'Shared revenue desk' },
      ]}
      actions={[
        { label: 'Cashier / POS', nav: 'cashier', msg: 'Cashier', primary: true },
        { label: 'Billing', nav: 'billing', msg: 'Billing office' },
        { label: 'Revenue', nav: 'revenue', msg: 'Revenue cycle' },
        { label: 'Patient card', nav: 'patient-card', msg: 'Patient billing identity' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   9. MEDICAL RECORDS OFFICER DASHBOARD
------------------------------------------------------------- */
function RecordsDashboardBody({ onNavigate, triggerAction }: any) {
  return (
    <RoleHome
      title="Health records workspace"
      subtitle="MPI, folders, and chart retrieval only — no e-prescribe or pharmacy dispense."
      metrics={[
        { label: 'Role', value: 'Records', sub: 'MPI & folders', tone: 'green' },
        { label: 'Charts', value: 'View only', sub: 'No e-prescribe' },
        { label: 'Shift', value: 'Active', sub: 'Shared desk' },
      ]}
      actions={[
        { label: 'Patient card / MPI', nav: 'patient-card', msg: 'Patient card', primary: true },
        { label: 'Chart retrieval', nav: 'emr', msg: 'View EMR (no prescribe)' },
        { label: 'Patient flow', nav: 'patient-flow', msg: 'Flow' },
        { label: 'Beds', nav: 'beds', msg: 'Bed board' },
      ]}
      triggerAction={triggerAction}
    />
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
          <span className="metric-sub">Pressure 4.8 Bar • Piping to all 6 Wards OK</span>
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
            { asset: 'BME-084', device: 'Dr•ger Evita V300 Ventilator', loc: 'ICU Bed 03', status: 'Operational', lastCal: '04 Sept 2026', nextCal: '04 Dec 2026', ok: true },
            { asset: 'BME-112', device: 'Mindray BeneHeart D6 Defibrillator', loc: 'A&E Resuscitation', status: 'Battery Replaced • Ready', lastCal: '12 Sept 2026', nextCal: '12 Dec 2026', ok: true },
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
                  Status: {d.status} • Next PPM: {d.nextCal}
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
          <span className="metric-sub">92.6% Occupancy • 38 Available</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Clinical Staff on Duty</span>
          <span className="metric-val">186 Present</span>
          <span className="metric-sub">34 Doctors • 112 Nurses • 40 Techs</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><ShieldCheck size={13} style={{ display: 'inline', marginRight: 4 }} />Clinical Quality & Safety</span>
          <span className="metric-val">0 Sentinel Events</span>
          <span className="metric-sub">Inpatient Mortality 0.8% • ALOS 3.8 Days</span>
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
            { dept: 'Accident & Emergency', beds: '28 / 32 Beds', staff: '4 MDs • 8 RNs', status: 'Surge Warning', color: '#F59E0B' },
            { dept: 'Operating Theatres', beds: '3 / 4 Theatres', staff: '6 Surgeons • 8 Anaesth', status: 'Normal Flow', color: '#22C55E' },
            { dept: 'Intensive Care Unit (ICU)', beds: '14 / 16 Beds', staff: '4 Intensivists • 8 RNs', status: 'High Occupancy', color: '#EF4444' },
            { dept: 'Maternity & Labour', beds: '32 / 44 Beds', staff: '3 Obs • 7 Midwives', status: 'Normal Flow', color: '#22C55E' },
            { dept: 'Paediatrics & NICU', beds: '41 / 56 Beds', staff: '4 Paeds • 11 RNs', status: 'Normal Flow', color: '#22C55E' },
            { dept: 'Internal Medicine Wards', beds: '82 / 96 Beds', staff: '8 MDs • 18 RNs', status: 'High Occupancy', color: '#FB923C' },
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
    <RoleHome
      title="ICT / System Admin"
      subtitle="Infrastructure and access tools for ICT officers."
      metrics={[
        { label: 'Role', value: 'SysAdmin', sub: 'ICT', tone: 'green' },
        { label: 'Systems', value: 'Live', sub: 'Health checks' },
        { label: 'Access', value: 'RBAC', sub: 'Via admin when permitted' },
      ]}
      actions={[
        { label: 'System admin', nav: 'system-admin', msg: 'System administration', primary: true },
        { label: 'Data hub', nav: 'data-hub', msg: 'Data hub' },
        { label: 'Clinical Assistant', nav: 'm87-ai', msg: 'Clinical CDS' },
      ]}
      triggerAction={triggerAction}
    />
  );
}


/* -------------------------------------------------------------
   12. HOSPITAL ADMIN DASHBOARD
------------------------------------------------------------- */
function HospitalAdminDashboardBody({ onNavigate, triggerAction, activeTab, session }: any) {
  const [recentTransfers] = React.useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('medcore_os_transfers');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const staffCards = typeof window !== 'undefined' ? listStaffCards() : [];
  const totalStaff = staffCards.length;

  const staffByDept = [
    { dept: 'Internal Medicine', count: staffCards.filter(s => s.department === 'Internal Medicine' || s.department === 'Medicine').length, icon: <Stethoscope size={14} />, color: '#0284C7' },
    { dept: 'Surgery',           count: staffCards.filter(s => s.department === 'Surgery').length,  icon: <Activity size={14} />,    color: '#DC2626' },
    { dept: 'Nursing',           count: staffCards.filter(s => s.department === 'Nursing').length, icon: <Users size={14} />,       color: '#7C3AED' },
    { dept: 'Pharmacy',          count: staffCards.filter(s => s.department === 'Pharmacy').length,  icon: <Pill size={14} />,        color: '#059669' },
    { dept: 'Laboratory',        count: staffCards.filter(s => s.department === 'Laboratory').length, icon: <FlaskConical size={14} />,color: '#0891B2' },
    { dept: 'Radiology',         count: staffCards.filter(s => s.department === 'Radiology').length,      icon: <Layers size={14} />,      color: '#6D28D9' },
    { dept: 'Finance',           count: staffCards.filter(s => s.department === 'Finance' || s.department === 'Accounts').length,  icon: <CreditCard size={14} />,  color: '#B45309' },
    { dept: 'IT & Admin',        count: staffCards.filter(s => s.department === 'IT & Admin' || s.department === 'Administration').length, icon: <Cpu size={14} />,         color: '#374151' },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="os-metrics-ribbon">
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Total Staff</span>
          <span className="metric-val">{totalStaff} Officers</span>
          <span className="metric-sub">Active at {session?.facility || 'Your Hospital'}</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Send size={13} style={{ display: 'inline', marginRight: 4 }} />Pending Transfers</span>
          <span className="metric-val">{recentTransfers.filter(t => t.status === 'pending').length} Active</span>
          <span className="metric-sub">Awaiting approval</span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><UserCheck size={13} style={{ display: 'inline', marginRight: 4 }} />Active Roster</span>
          <span className="metric-val">{staffCards.filter(s => String(s.status).toLowerCase() === 'active').length} Staff</span>
          <span className="metric-sub">Verified credentials</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Building2 size={13} style={{ display: 'inline', marginRight: 4 }} />Open Positions</span>
          <span className="metric-val">0 Vacancies</span>
          <span className="metric-sub">All posts filled</span>
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
              {recentTransfers.length === 0 ? (
                <div style={{ padding: 16, color: '#94A3B8', fontSize: '0.82rem', textAlign: 'center' }}>No recent transfers recorded.</div>
              ) : (
                recentTransfers.map(t => (
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
                        {t.from} <ArrowRight size={10} color="#374151" /> {t.to} • {t.date}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      color: t.status === 'pending' ? '#60A5FA' : '#22C55E',
                      background: t.status === 'pending' ? 'rgba(96,165,250,0.1)' : 'rgba(34,197,94,0.1)',
                      border: `1px solid ${t.status === 'pending' ? 'rgba(96,165,250,0.25)' : 'rgba(34,197,94,0.25)'}`,
                    }}>{t.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div style={{ background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, padding: 20 }}>
          <div className="os-section-header">
            <span className="os-section-title">Administrative Task Queue</span>
            <span style={{ fontSize: '0.75rem', color: '#059669' }}>0 Pending</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <div style={{ padding: 16, color: '#94A3B8', fontSize: '0.82rem', textAlign: 'center' }}>All administrative tasks completed.</div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: 20, background: 'var(--os-card)', border: '1px solid var(--os-border)', borderRadius: 14, color: '#94A3B8', fontSize: '0.82rem', textAlign: 'center' }}>
            No administrative alerts at this time.
          </div>
        </div>
      )}
    </>
  );
}
