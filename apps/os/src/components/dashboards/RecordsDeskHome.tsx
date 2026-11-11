'use client';

/**
 * Intelligent Health Information Management (HIM) desk for Records Officers.
 * Live MPI, folder quality, admissions without bed, NHIA gaps, chart retrieval — not clinical prescribe.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  FileText,
  CreditCard,
  BedDouble,
  ShieldCheck,
  Bell,
  Brain,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Search,
  FolderOpen,
  Activity,
  Sparkles,
  Edit,
  UserCheck,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, subscribePatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { todayVisits, subscribeReceptionOps } from '../../lib/receptionOpsStore';
import { listBeds, subscribeBeds, ensureDefaultBeds } from '../../lib/bedBoardStore';
import {
  listNotifications,
  notificationSummary,
  subscribeNotifications,
} from '../../lib/notificationEngine';
import { InBasketPanel } from '../clinical-core/InBasketPanel';
import { himSummary, subscribeHim } from '../../lib/himStore';
import { EditPatientModal } from '../records/EditPatientModal';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

function isIncompleteMpi(p: FacilityPatient): boolean {
  const missing =
    !p.hospitalNumber ||
    !p.firstName ||
    !p.lastName ||
    !p.dob ||
    !p.phone ||
    !p.sex;
  return missing;
}

function isNhiaGap(p: FacilityPatient): boolean {
  const hasIns =
    !!(p.nhiaNumber || p.insuranceId || p.insuranceProvider);
  // Flag if marked insurance category but no number, or no NHIA at all for adult folders
  if ((p.category || '').toLowerCase().includes('nhia') || (p.category || '').toLowerCase().includes('hmo')) {
    return !p.nhiaNumber && !p.insuranceId;
  }
  return false;
}

export const RecordsDeskHome: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session.hospitalId || session.facility || 'IGH-EKT';
  const firstName = (session.name || 'Records').split(' ')[0];
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const [editingPatient, setEditingPatient] = useState<FacilityPatient | null>(null);
  const [mpiSearch, setMpiSearch] = useState('');

  useEffect(() => {
    try {
      ensureDefaultBeds(facilityId);
    } catch {
      /* ignore */
    }
    const u1 = subscribePatients(reload);
    const u2 = subscribeReceptionOps(reload);
    const u3 = subscribeBeds(reload);
    const u4 = subscribeNotifications(reload);
    const u5 = subscribeHim(reload);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [facilityId, reload]);

  const patients = useMemo(() => listPatients(facilityId), [facilityId, tick]);
  const visits = useMemo(() => todayVisits(facilityId), [facilityId, tick]);
  const beds = useMemo(() => {
    try {
      return listBeds(facilityId);
    } catch {
      return [];
    }
  }, [facilityId, tick]);
  const him = useMemo(() => himSummary(facilityId), [facilityId, tick]);
  const notifSum = useMemo(
    () => notificationSummary(facilityId),
    [facilityId, tick]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const registeredToday = patients.filter((p) => (p.registeredAt || '').startsWith(todayStr));
  const incomplete = patients.filter(isIncompleteMpi);
  const nhiaGaps = patients.filter(isNhiaGap);
  const activeVisits = visits.filter(
    (v) => v.status !== 'completed' && v.status !== 'cancelled'
  );
  const occupiedBeds = beds.filter((b) => b.status === 'occupied' || b.patientId);
  const freeBeds = beds.filter((b) => b.status === 'available' || (!b.patientId && b.status !== 'occupied'));

  const searchedPatients = useMemo(() => {
    const q = mpiSearch.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          (p.middleName || '').toLowerCase().includes(q) ||
          p.hospitalNumber.toLowerCase().includes(q) ||
          (p.phone || '').includes(q) ||
          (p.nin || '').includes(q)
      )
      .slice(0, 10);
  }, [patients, mpiSearch]);

  const intelligence = useMemo(() => {
    const tips: { level: 'critical' | 'warn' | 'info'; title: string; detail: string; go?: string }[] = [];
    if (incomplete.length > 0) {
      tips.push({
        level: 'warn',
        title: `${incomplete.length} incomplete MPI folder${incomplete.length > 1 ? 's' : ''}`,
        detail: 'Missing demographics block chart retrieval and NHIA claims. Complete before coding.',
        go: 'patient-card',
      });
    }
    if (nhiaGaps.length > 0) {
      tips.push({
        level: 'critical',
        title: `${nhiaGaps.length} insurance folder${nhiaGaps.length > 1 ? 's' : ''} without NHIA/HMO ID`,
        detail: 'Eligibility cannot be verified — update Digital Health Card.',
        go: 'claims',
      });
    }
    if (activeVisits.length > freeBeds.length && freeBeds.length === 0 && activeVisits.length > 3) {
      tips.push({
        level: 'warn',
        title: 'High transit load · limited free beds',
        detail: `${activeVisits.length} open visits · ${freeBeds.length} free beds on board.`,
        go: 'beds',
      });
    }
    if (registeredToday.length === 0 && patients.length === 0) {
      tips.push({
        level: 'info',
        title: 'MPI is empty for this facility',
        detail: 'Start with Digital Health Card / FHIR enrolment for the first patient folder.',
        go: 'patient-card',
      });
    }
    if (him.defOpen > 0) {
      tips.push({
        level: 'warn',
        title: `${him.defOpen} open chart deficiency item(s)`,
        detail: 'Clear unsigned notes and missing summaries before chart complete.',
        go: 'him-deficiency',
      });
    }
    if (him.roiOpen > 0) {
      tips.push({
        level: 'info',
        title: `${him.roiOpen} ROI request(s) in progress`,
        detail: 'Authorization and disclosure tracking on the ROI queue.',
        go: 'him-roi',
      });
    }
    if (him.chartHold > 0) {
      tips.push({
        level: 'critical',
        title: `${him.chartHold} chart(s) on HIM review or bill-hold`,
        detail: 'Complete documentation before revenue cycle drop.',
        go: 'him-chart',
      });
    }
    if (tips.length === 0) {
      tips.push({
        level: 'info',
        title: 'Records desk healthy',
        detail: 'No critical HIM gaps detected. Continue chart retrieval and bed census support.',
      });
    }
    return tips.slice(0, 5);
  }, [incomplete.length, nhiaGaps.length, activeVisits.length, freeBeds.length, registeredToday.length, patients.length, him.defOpen, him.roiOpen, him.chartHold]);

  const kpis = [
    {
      label: 'MPI on file',
      value: patients.length,
      sub: 'Active folders',
      color: '#2563EB',
      icon: Users,
    },
    {
      label: 'Registered today',
      value: registeredToday.length,
      sub: 'New folders',
      color: '#059669',
      icon: FolderOpen,
    },
    {
      label: 'Incomplete MPI',
      value: incomplete.length,
      sub: 'Needs demographics',
      color: incomplete.length ? '#D97706' : '#64748B',
      icon: AlertTriangle,
    },
    {
      label: 'Open transit',
      value: activeVisits.length,
      sub: 'Visits today',
      color: '#7C3AED',
      icon: RefreshCw,
    },
    {
      label: 'Beds free / occ',
      value: `${freeBeds.length}/${occupiedBeds.length}`,
      sub: 'Census support',
      color: '#0891B2',
      icon: BedDouble,
    },
    {
      label: 'Inbox',
      value: notifSum.total,
      sub: 'Role-scoped',
      color: notifSum.total ? '#DC2626' : '#64748B',
      icon: Bell,
    },
  ];

  const actions = [
    { label: 'MPI / Health card', desc: 'Register & FHIR', go: 'patient-card', primary: true, icon: CreditCard },
    { label: 'Chart retrieval', desc: 'View only EMR', go: 'emr', icon: FileText },
    { label: 'Patient transit', desc: 'Admissions flow', go: 'patient-flow', icon: RefreshCw },
    { label: 'Bed board', desc: 'Occupancy', go: 'beds', icon: BedDouble },
    { label: 'NHIA eligibility', desc: 'Insurance', go: 'claims', icon: ShieldCheck },
    { label: 'Celestia HIM', desc: 'Coding assist', go: 'm87-ai', icon: Brain },
    { label: 'HIM workqueues', desc: 'Epic-style queues', go: 'him', icon: FileText },
    { label: 'Deficiency', desc: 'Unsigned / incomplete', go: 'him-deficiency', icon: AlertTriangle },
    { label: 'ROI', desc: 'Release of info', go: 'him-roi', icon: ShieldCheck },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* QUICK ACTIONS COMES FIRST (Hero removed) */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: '16px 18px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>Health Records Quick Actions</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>MPI, chart retrieval, transit &amp; bed census tools</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#ECFDF5',
                color: '#059669',
                border: '1px solid #A7F3D0',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
              HIM Live
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.go}
                type="button"
                onClick={() => onNavigate(a.go)}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 12,
                  border: a.primary ? '1.5px solid #0D9488' : '1px solid #E2E8F0',
                  background: a.primary ? '#F0FDFA' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={18} color={a.primary ? '#0D9488' : '#64748B'} />
                <div style={{ fontWeight: 800, fontSize: 12, marginTop: 6, color: '#0F172A' }}>{a.label}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{a.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: 14,
                borderLeft: `4px solid ${k.color}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748B',
                  textTransform: 'uppercase',
                }}
              >
                <Icon size={13} color={k.color} />
                {k.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Intelligence feed */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid #F1F5F9',
            fontWeight: 800,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Activity size={16} color="#0D9488" />
          HIM intelligence
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>
            Live · facility-scoped
          </span>
        </div>
        {intelligence.map((tip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => tip.go && onNavigate(tip.go)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              border: 'none',
              borderBottom: '1px solid #F1F5F9',
              background: tip.level === 'critical' ? '#FEF2F2' : tip.level === 'warn' ? '#FFFBEB' : '#fff',
              cursor: tip.go ? 'pointer' : 'default',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            {tip.level === 'critical' ? (
              <AlertTriangle size={16} color="#DC2626" style={{ marginTop: 2 }} />
            ) : tip.level === 'warn' ? (
              <AlertTriangle size={16} color="#D97706" style={{ marginTop: 2 }} />
            ) : (
              <CheckCircle2 size={16} color="#059669" style={{ marginTop: 2 }} />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{tip.title}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{tip.detail}</div>
            </div>
          </button>
        ))}
      </div>

      {/* HIM Master Patient Index Quick Demographics Search */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={15} color="#0D9488" />
            HIM Demographics Search &amp; Update
          </div>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            HIM officers can edit demographics, address, NIN, NHIA &amp; emergency contacts
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={mpiSearch}
            onChange={(e) => setMpiSearch(e.target.value)}
            placeholder="Search patient by name, folder number, phone, or NIN to edit demographics..."
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              outline: 'none',
              background: '#F8FAFC',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {mpiSearch.trim() && (
          <div style={{ marginTop: 10, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            {searchedPatients.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: '#94A3B8' }}>
                No patient matching "{mpiSearch}"
              </div>
            ) : (
              searchedPatients.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid #F1F5F9',
                    background: '#fff',
                    gap: 12,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>
                      {p.firstName} {p.middleName ? p.middleName + ' ' : ''}{p.lastName}
                    </strong>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Folder: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.hospitalNumber}</span> · {p.sex || '—'} · DOB: {p.dob || '—'} · Tel: {p.phone || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPatient(p)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: '#F0FDF4',
                      color: '#047857',
                      border: '1px solid #A7F3D0',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Edit size={13} />
                    Edit Demographics
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 12,
        }}
      >
        {/* Incomplete folders */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #F1F5F9',
              fontWeight: 800,
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Incomplete folders</span>
            <button
              type="button"
              onClick={() => onNavigate('patient-card')}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#0284C7',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Open MPI →
            </button>
          </div>
          {incomplete.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              All folders have core demographics
            </div>
          ) : (
            incomplete.slice(0, 8).map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: '1px solid #F1F5F9',
                  background: '#fff',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {p.firstName} {p.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: '#D97706' }}>
                    {p.hospitalNumber || 'No folder #'} · missing core fields
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPatient(p)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#FFFBEB',
                    color: '#B45309',
                    border: '1px solid #FDE68A',
                    borderRadius: 7,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Edit size={12} />
                  Edit
                </button>
              </div>
            ))
          )}
        </div>

        {/* Today registrations */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #F1F5F9',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Registered today
          </div>
          {registeredToday.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No new folders today
            </div>
          ) : (
            registeredToday.slice(0, 8).map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: '1px solid #F1F5F9',
                  fontSize: 13,
                  gap: 10,
                }}
              >
                <div>
                  <strong>
                    {p.firstName} {p.lastName}
                  </strong>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{p.hospitalNumber}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPatient(p)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#F0FDFA',
                    color: '#0D9488',
                    border: '1px solid #99F6E4',
                    borderRadius: 7,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Edit size={12} />
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Role inbox — records scoped */}
      <InBasketPanel
        facilityId={facilityId}
        roleKey="records"
        staffName={session.name}
        onNavigate={onNavigate}
        limit={8}
      />

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          fontSize: 12,
          color: '#64748B',
        }}
      >
        <Search size={14} />
        Search patients from the top bar · Celestia can help with folder completeness and coding queries
        <button
          type="button"
          onClick={() => onNavigate('m87-ai')}
          style={{
            marginLeft: 'auto',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '6px 12px',
            background: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            color: '#4F46E5',
          }}
        >
          Open Celestia
        </button>
      </div>

      {/* Edit Patient Demographics Modal */}
      <EditPatientModal
        patient={editingPatient}
        isOpen={Boolean(editingPatient)}
        onClose={() => setEditingPatient(null)}
        onSaved={() => reload()}
      />
    </div>
  );
};

export default RecordsDeskHome;
