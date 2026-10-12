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
      {/* Hero */}
      <div
        style={{
          borderRadius: 16,
          padding: '20px 22px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 55%, #0D9488 140%)',
          color: '#fff',
          boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.85 }}>Welcome back, {firstName}</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: 24, fontWeight: 800 }}>Health records command</h2>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.9, maxWidth: 560 }}>
          Intelligent HIM desk — MPI quality, folder integrity, transit & bed census. No prescribing;
          chart retrieval is view-only.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16,185,129,0.25)',
              border: '1px solid rgba(52,211,153,0.5)',
            }}
          >
            Systems online
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
            }}
          >
            Records · L2 HIM
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(99,102,241,0.35)',
            }}
          >
            <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
            Super-intelligence layer
          </span>
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

      {/* Quick actions */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: '#0F172A' }}>
          Quick actions · records role
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
                  padding: 14,
                  borderRadius: 14,
                  border: a.primary ? '1.5px solid #0D9488' : '1px solid #E2E8F0',
                  background: a.primary ? '#F0FDFA' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <Icon size={18} color={a.primary ? '#0D9488' : '#64748B'} />
                <div style={{ fontWeight: 800, fontSize: 13, marginTop: 8, color: '#0F172A' }}>{a.label}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{a.desc}</div>
              </button>
            );
          })}
        </div>
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
              <button
                key={p.id}
                type="button"
                onClick={() => onNavigate('patient-card')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: '1px solid #F1F5F9',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {p.firstName} {p.lastName}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {p.hospitalNumber || 'No folder #'} · missing core fields
                </div>
              </button>
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
                  padding: '10px 14px',
                  borderBottom: '1px solid #F1F5F9',
                  fontSize: 13,
                }}
              >
                <strong>
                  {p.firstName} {p.lastName}
                </strong>
                <div style={{ fontSize: 11, color: '#64748B' }}>{p.hospitalNumber}</div>
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
    </div>
  );
};

export default RecordsDeskHome;
