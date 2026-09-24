'use client';

import React, { useState } from 'react';
import {
  BedDouble, Users, AlertTriangle, Clock, Activity,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Stethoscope,
  Heart, Thermometer, Zap, ArrowUpRight, TrendingUp, Filter,
  Eye, Check, ChevronRight, X, UserPlus, PhoneCall, ShieldAlert
} from 'lucide-react';

interface Ward {
  name: string;
  code: string;
  category: 'critical' | 'inpatient' | 'maternal_child';
  beds: number;
  occupied: number;
  status: 'critical' | 'surge' | 'high' | 'normal';
  nurses: number;
  doctors: number;
  cleanBeds: number;
  bedList?: { id: string; name: string; patient?: string; status: 'occupied' | 'available' | 'cleaning' | 'isolation' }[];
}

const WARDS: Ward[] = [
  {
    name: 'Accident & Emergency',
    code: 'A&E',
    category: 'critical',
    beds: 32,
    occupied: 28,
    status: 'surge',
    nurses: 8,
    doctors: 4,
    cleanBeds: 4,
    bedList: [
      { id: 'AE-01', name: 'Resus 1', patient: 'Eno Effiong (STAT)', status: 'occupied' },
      { id: 'AE-02', name: 'Resus 2', patient: 'Anietie Bassey (Trauma)', status: 'occupied' },
      { id: 'AE-03', name: 'Triage Bay 3', patient: 'Emem Udo', status: 'occupied' },
      { id: 'AE-04', name: 'Triage Bay 4', status: 'available' },
      { id: 'AE-05', name: 'Holding 5', status: 'cleaning' },
      { id: 'AE-06', name: 'Isolation 1', patient: 'Kufre Okon (Lassa rule-out)', status: 'isolation' },
    ]
  },
  {
    name: 'Intensive Care Unit',
    code: 'ICU',
    category: 'critical',
    beds: 16,
    occupied: 14,
    status: 'critical',
    nurses: 8,
    doctors: 4,
    cleanBeds: 2,
    bedList: [
      { id: 'ICU-01', name: 'Bed 1 (Vent 1)', patient: 'Emeka Eze (Post-PCI)', status: 'occupied' },
      { id: 'ICU-02', name: 'Bed 2 (Vent 2)', patient: 'Imaobong Akpan', status: 'occupied' },
      { id: 'ICU-03', name: 'Bed 3', status: 'available' },
      { id: 'ICU-04', name: 'Bed 4', status: 'cleaning' },
    ]
  },
  {
    name: 'Male Medical Ward',
    code: 'MMW',
    category: 'inpatient',
    beds: 48,
    occupied: 43,
    status: 'high',
    nurses: 6,
    doctors: 2,
    cleanBeds: 5,
    bedList: [
      { id: 'MMW-01', name: 'Bed 01', patient: 'Nkemdirim Obi', status: 'occupied' },
      { id: 'MMW-02', name: 'Bed 02', patient: 'Iniobong Edet', status: 'occupied' },
      { id: 'MMW-03', name: 'Bed 03', status: 'available' },
    ]
  },
  {
    name: 'Female Medical Ward',
    code: 'FMW',
    category: 'inpatient',
    beds: 48,
    occupied: 39,
    status: 'normal',
    nurses: 6,
    doctors: 2,
    cleanBeds: 9,
    bedList: [
      { id: 'FMW-01', name: 'Bed 01', patient: 'Adaobi Nwosu', status: 'occupied' },
      { id: 'FMW-02', name: 'Bed 02', status: 'available' },
    ]
  },
  {
    name: 'Surgical Ward',
    code: 'SRG',
    category: 'inpatient',
    beds: 40,
    occupied: 35,
    status: 'high',
    nurses: 5,
    doctors: 3,
    cleanBeds: 5,
    bedList: [
      { id: 'SRG-01', name: 'Bed 01', patient: 'Usen Akpan (Pre-Op)', status: 'occupied' },
      { id: 'SRG-02', name: 'Bed 02', status: 'available' },
    ]
  },
  {
    name: 'Paediatric Ward',
    code: 'PED',
    category: 'maternal_child',
    beds: 36,
    occupied: 24,
    status: 'normal',
    nurses: 5,
    doctors: 2,
    cleanBeds: 12,
    bedList: [
      { id: 'PED-01', name: 'Cot 01', patient: 'Afiong Inyang (Age 3)', status: 'occupied' },
      { id: 'PED-02', name: 'Cot 02', status: 'available' },
    ]
  },
  {
    name: 'Obstetrics & Gynaecology',
    code: 'O&G',
    category: 'maternal_child',
    beds: 44,
    occupied: 32,
    status: 'normal',
    nurses: 7,
    doctors: 3,
    cleanBeds: 12,
    bedList: [
      { id: 'OG-01', name: 'Labour Bed 1', patient: 'Blessing Udoh (G3P2)', status: 'occupied' },
      { id: 'OG-02', name: 'Post-Natal 2', status: 'available' },
    ]
  },
  {
    name: 'Neonatal Intensive Care',
    code: 'NICU',
    category: 'maternal_child',
    beds: 20,
    occupied: 17,
    status: 'high',
    nurses: 6,
    doctors: 2,
    cleanBeds: 3,
    bedList: [
      { id: 'NICU-01', name: 'Incubator 1', patient: 'Baby of Udoh (32 wks)', status: 'occupied' },
      { id: 'NICU-02', name: 'Incubator 2', status: 'available' },
    ]
  },
  {
    name: 'Orthopaedic Ward',
    code: 'ORT',
    category: 'inpatient',
    beds: 30,
    occupied: 21,
    status: 'normal',
    nurses: 4,
    doctors: 2,
    cleanBeds: 9,
    bedList: [
      { id: 'ORT-01', name: 'Traction Bed 1', patient: 'Bassey Asuquo', status: 'occupied' },
      { id: 'ORT-02', name: 'Bed 2', status: 'available' },
    ]
  },
  {
    name: 'Isolation & Infectious',
    code: 'ISO',
    category: 'critical',
    beds: 14,
    occupied: 6,
    status: 'normal',
    nurses: 4,
    doctors: 1,
    cleanBeds: 8,
    bedList: [
      { id: 'ISO-01', name: 'Negative Pressure 1', patient: 'Isolation Patient A', status: 'isolation' },
      { id: 'ISO-02', name: 'Negative Pressure 2', status: 'available' },
    ]
  },
];

const ACTIVE_ALERTS = [
  { id: 'ALT-001', time: '09:14', ward: 'ICU', type: 'critical', msg: 'Patient in Bed 7 — Cardiac monitor alarming, BP 85/50, MAP 61' },
  { id: 'ALT-002', time: '09:08', ward: 'A&E', type: 'warning', msg: 'Triage queue at 14 patients — ESI-2 surge threshold exceeded' },
  { id: 'ALT-003', time: '08:52', ward: 'NICU', type: 'warning', msg: 'Incubator temperature variance in Bay 3 — Biomedical engineering alerted' },
  { id: 'ALT-004', time: '08:30', ward: 'Pharmacy', type: 'info', msg: 'Injectable Artesunate stock below 20% — auto-replenishment triggered' },
];

const RECENT_ADMISSIONS = [
  { id: 'ADM-4881', name: 'Eno Effiong', time: '09:10', ward: 'A&E', reason: 'Acute severe abdominal pain', status: 'In Triage', badge: 'STAT' },
  { id: 'ADM-4880', name: 'Nkemdirim Obi', time: '08:55', ward: 'Male Medical', reason: 'Hypertensive crisis (210/120)', status: 'Admitted', badge: 'Urgent' },
  { id: 'ADM-4879', name: 'Blessing Udoh', time: '08:40', ward: 'O&G', reason: 'Active Labour — G3P2 4cm', status: 'Labour Ward', badge: 'Active' },
  { id: 'ADM-4878', name: 'Usen Akpan', time: '08:22', ward: 'Surgical', reason: 'Acute appendicitis — scheduled for theatre', status: 'Pre-Op', badge: 'Surgical' },
  { id: 'ADM-4877', name: 'Afiong Inyang', time: '07:58', ward: 'Paediatric', reason: 'Severe malaria + hyperpyrexia (under 5)', status: 'Admitted', badge: 'Priority' },
];

export const CommandCentreDashboard: React.FC = () => {
  const [selectedWardCode, setSelectedWardCode] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'critical' | 'inpatient' | 'maternal_child'>('all');
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const totalBeds = WARDS.reduce((a, w) => a + w.beds, 0);
  const totalOccupied = WARDS.reduce((a, w) => a + w.occupied, 0);
  const occupancyPct = Math.round((totalOccupied / totalBeds) * 100);

  const filteredWards = WARDS.filter(w => {
    if (filterCategory === 'all') return true;
    return w.category === filterCategory;
  });

  const selectedWard = WARDS.find(w => w.code === selectedWardCode);

  const getStatusColor = (s: Ward['status']) => {
    switch (s) {
      case 'critical': return { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', bar: '#DC2626' };
      case 'surge': return { bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C', bar: '#EA580C' };
      case 'high': return { bg: '#FEFCE8', border: '#FEF08A', text: '#CA8A04', bar: '#EAB308' };
      default: return { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669', bar: '#10B981' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Premium KPI Strip — MedCore blue/teal + Arise orange/green ── */}
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">
              <BedDouble size={14} style={{ color: '#0066FF' }} />
              Hospital Bed Occupancy
            </span>
            <span className="figma-chip chip-blue" style={{ fontSize: '0.66rem' }}>
              <TrendingUp size={11} /> +3.2% Today
            </span>
          </div>
          <span className="metric-val">
            {totalOccupied} <span style={{ fontSize: '1.05rem', color: '#94A3B8', fontWeight: 500 }}>/ {totalBeds}</span>
          </span>
          <div className="os-progress-track">
            <div
              className={`os-progress-fill${occupancyPct > 90 ? ' danger' : ''}`}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
          <span className="metric-sub">
            <span className="pulse-dot-green" />
            <strong>{occupancyPct}% Capacity</strong> · {totalBeds - totalOccupied} beds available
          </span>
        </div>

        <div className="metric-box alert-yellow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">
              <Clock size={14} style={{ color: '#EA580C' }} />
              A&E Triage Wait Time
            </span>
            <span className="figma-chip chip-amber" style={{ fontSize: '0.66rem' }}>
              Surge Protocol
            </span>
          </div>
          <span className="metric-val">28 <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#94A3B8' }}>mins</span></span>
          <div className="os-progress-track">
            <div className="os-progress-fill warn" style={{ width: '68%' }} />
          </div>
          <span className="metric-sub">
            <Users size={12} /> 14 in queue · 4 ESI-2 immediate
          </span>
        </div>

        <div className="metric-box alert-red">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">
              <AlertTriangle size={14} style={{ color: '#DC2626' }} />
              Active Clinical Alerts
            </span>
            <span className="figma-chip chip-rose" style={{ fontSize: '0.66rem' }}>
              <span className="pulse-dot-red" /> 1 STAT
            </span>
          </div>
          <span className="metric-val">{ACTIVE_ALERTS.length - dismissedAlerts.length} <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#94A3B8' }}>open</span></span>
          <div className="os-progress-track">
            <div className="os-progress-fill danger" style={{ width: '35%' }} />
          </div>
          <span className="metric-sub">
            1 critical cardiac · 2 telemetry thresholds
          </span>
        </div>

        <div className="metric-box alert-green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">
              <Users size={14} style={{ color: '#16A34A' }} />
              Hospital Staff on Duty
            </span>
            <span className="figma-chip chip-green" style={{ fontSize: '0.66rem' }}>
              100% Shift Fill
            </span>
          </div>
          <span className="metric-val">186 <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#94A3B8' }}>staff</span></span>
          <div className="os-progress-track">
            <div className="os-progress-fill safe" style={{ width: '92%' }} />
          </div>
          <span className="metric-sub">
            34 doctors · 112 nurses · 40 support
          </span>
        </div>
      </div>


      {/* ── Main Operations Workspace Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'start' }}>

        {/* Left Column: Live Ward Directory & Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 800,
                fontFamily: 'var(--os-font-heading)',
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Activity size={18} style={{ color: '#0052D4' }} />
                Ward Capacity & Real-Time Census Matrix
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                Ibom Specialist Hospital, Uyo • Real-time patient-to-nurse and bed occupancy visibility
              </p>
            </div>

            {/* Segmented Filter Control */}
            <div className="os-segmented-control">
              <button
                type="button"
                className={`os-segmented-btn ${filterCategory === 'all' ? 'active' : ''}`}
                onClick={() => setFilterCategory('all')}
              >
                All Wards ({WARDS.length})
              </button>
              <button
                type="button"
                className={`os-segmented-btn ${filterCategory === 'critical' ? 'active' : ''}`}
                onClick={() => setFilterCategory('critical')}
              >
                Critical Care (3)
              </button>
              <button
                type="button"
                className={`os-segmented-btn ${filterCategory === 'inpatient' ? 'active' : ''}`}
                onClick={() => setFilterCategory('inpatient')}
              >
                Inpatient Wards (4)
              </button>
              <button
                type="button"
                className={`os-segmented-btn ${filterCategory === 'maternal_child' ? 'active' : ''}`}
                onClick={() => setFilterCategory('maternal_child')}
              >
                Maternal & Child (3)
              </button>
            </div>
          </div>

          {/* Ward Grid Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
            {filteredWards.map((ward) => {
              const pct = Math.round((ward.occupied / ward.beds) * 100);
              const colorInfo = getStatusColor(ward.status);
              const isSelected = selectedWardCode === ward.code;

              return (
                <div
                  key={ward.code}
                  className="os-card"
                  onClick={() => setSelectedWardCode(isSelected ? null : ward.code)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? '#0052D4' : undefined,
                    boxShadow: isSelected ? '0 0 0 2px #0052D4, 0 8px 24px rgba(0, 82, 212, 0.12)' : undefined,
                    background: isSelected ? '#F8FAFF' : '#FFFFFF',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {ward.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: '#0052D4', background: 'rgba(0, 82, 212, 0.08)', padding: '1px 6px', borderRadius: 4 }}>
                          {ward.code}
                        </span>
                        <span>{ward.beds - ward.occupied} beds free</span>
                      </div>
                    </div>

                    <span
                      style={{
                        background: colorInfo.bg,
                        border: `1px solid ${colorInfo.border}`,
                        color: colorInfo.text,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 9999,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                      }}
                    >
                      {ward.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--os-font-heading)' }}>
                      {ward.occupied}
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94A3B8' }}> / {ward.beds} beds</span>
                    </div>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: colorInfo.text }}>
                      {pct}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div style={{ width: '100%', height: 6, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden', marginBottom: 14 }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: colorInfo.bar,
                        borderRadius: 9999,
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>

                  {/* Ward Personnel & Clean Bed Chips */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: '1px solid #F1F5F9',
                    fontSize: '0.74rem',
                    color: '#64748B'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Stethoscope size={13} style={{ color: '#0052D4' }} /> {ward.doctors} Docs
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Heart size={13} style={{ color: '#00BFA5' }} /> {ward.nurses} Nurses
                    </span>
                    <span style={{
                      fontWeight: 600,
                      color: isSelected ? '#0052D4' : '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}>
                      Inspect <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Selected Ward Detail Drawer */}
          {selectedWard && (
            <div
              className="os-card"
              style={{
                marginTop: 8,
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                border: '1.5px solid #0052D4',
                animation: 'fadeUp 0.25s ease-out'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: '#0052D4',
                      color: '#FFF',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}>
                      {selectedWard.code}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--os-font-heading)' }}>
                      {selectedWard.name} — Live Bed Matrix & Patient Roster
                    </h3>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
                    Showing real-time bed occupation, cleaning turn-around, and telemetry assignment
                  </p>
                </div>
                <button
                  type="button"
                  className="os-ghost-btn"
                  style={{ padding: 6 }}
                  onClick={() => setSelectedWardCode(null)}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Bed Matrix Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {selectedWard.bedList?.map((bed) => {
                  let statusBg = '#EFF6FF';
                  let statusBorder = '#BFDBFE';
                  let statusText = '#1D4ED8';
                  let statusDot = 'pulse-dot-blue';

                  if (bed.status === 'available') {
                    statusBg = '#ECFDF5';
                    statusBorder = '#A7F3D0';
                    statusText = '#047857';
                    statusDot = 'pulse-dot-green';
                  } else if (bed.status === 'cleaning') {
                    statusBg = '#FFFBEB';
                    statusBorder = '#FDE68A';
                    statusText = '#B45309';
                    statusDot = 'pulse-dot-amber';
                  } else if (bed.status === 'isolation') {
                    statusBg = '#FEF2F2';
                    statusBorder = '#FECACA';
                    statusText = '#B91C1C';
                    statusDot = 'pulse-dot-red';
                  }

                  return (
                    <div
                      key={bed.id}
                      style={{
                        background: '#FFFFFF',
                        border: `1px solid ${statusBorder}`,
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0F172A' }}>{bed.name}</span>
                        <span style={{
                          background: statusBg,
                          color: statusText,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 9999,
                          textTransform: 'uppercase'
                        }}>
                          {bed.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: bed.patient ? '#334155' : '#94A3B8', fontWeight: bed.patient ? 600 : 400 }}>
                        {bed.patient ? bed.patient : 'Ready for admission'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Alerts & Recent Admissions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Active Clinical Alerts Card */}
          <div className="os-card" style={{ padding: 18 }}>
            <div className="os-section-header" style={{ marginBottom: 12 }}>
              <span className="os-section-title">
                <AlertTriangle size={15} style={{ color: '#DC2626' }} />
                Clinical Alerts
              </span>
              <span className="figma-chip chip-rose" style={{ fontSize: '0.64rem' }}>
                {ACTIVE_ALERTS.length - dismissedAlerts.length} Active
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ACTIVE_ALERTS.filter(a => !dismissedAlerts.includes(a.id)).map(alert => (
                <div
                  key={alert.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: alert.type === 'critical' ? 'rgba(239, 68, 68, 0.05)' : '#F8FAFC',
                    borderLeft: `4px solid ${alert.type === 'critical' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#0052D4'}`,
                    borderTop: '1px solid #E2E8F0',
                    borderRight: '1px solid #E2E8F0',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A' }}>
                      {alert.ward} • <span style={{ fontFamily: 'var(--os-font-mono)', color: '#64748B' }}>{alert.time}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.7rem'
                      }}
                      title="Acknowledge alert"
                    >
                      <Check size={14} /> Ack
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', lineHeight: 1.45 }}>
                    {alert.msg}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Admissions Stream */}
          <div className="os-card" style={{ padding: 18 }}>
            <div className="os-section-header" style={{ marginBottom: 12 }}>
              <span className="os-section-title">
                <CheckCircle2 size={15} style={{ color: '#059669' }} />
                Recent Admissions
              </span>
              <span className="figma-chip chip-green" style={{ fontSize: '0.64rem' }}>
                Live Stream
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RECENT_ADMISSIONS.map(adm => (
                <div
                  key={adm.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0F172A' }}>{adm.name}</span>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(0, 82, 212, 0.08)',
                        color: '#0052D4'
                      }}>
                        {adm.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                      {adm.ward} • {adm.reason}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--os-font-mono)', color: '#94A3B8' }}>{adm.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
