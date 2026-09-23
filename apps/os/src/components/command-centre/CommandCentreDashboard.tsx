'use client';
import React, { useState } from 'react';
import {
  BedDouble, Users, AlertTriangle, Clock, Activity,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Stethoscope,
  Heart, Thermometer, Zap
} from 'lucide-react';

const WARDS = [
  { name: 'Accident & Emergency', code: 'A&E', beds: 32, occupied: 28, status: 'surge', nurses: 8, doctors: 4 },
  { name: 'Male Medical Ward', code: 'MMW', beds: 48, occupied: 43, status: 'high', nurses: 6, doctors: 2 },
  { name: 'Female Medical Ward', code: 'FMW', beds: 48, occupied: 39, status: 'normal', nurses: 6, doctors: 2 },
  { name: 'Surgical Ward', code: 'SRG', beds: 40, occupied: 35, status: 'high', nurses: 5, doctors: 3 },
  { name: 'Intensive Care Unit', code: 'ICU', beds: 16, occupied: 14, status: 'critical', nurses: 8, doctors: 4 },
  { name: 'Paediatric Ward', code: 'PED', beds: 36, occupied: 24, status: 'normal', nurses: 5, doctors: 2 },
  { name: 'Obstetrics & Gynaecology', code: 'O&G', beds: 44, occupied: 32, status: 'normal', nurses: 7, doctors: 3 },
  { name: 'Neonatal Intensive Care', code: 'NICU', beds: 20, occupied: 17, status: 'high', nurses: 6, doctors: 2 },
  { name: 'Orthopaedic Ward', code: 'ORT', beds: 30, occupied: 21, status: 'normal', nurses: 4, doctors: 2 },
  { name: 'Isolation & Infectious', code: 'ISO', beds: 14, occupied: 6, status: 'normal', nurses: 4, doctors: 1 },
];

const ACTIVE_ALERTS = [
  { id: 'ALT-001', time: '09:14', ward: 'ICU', type: 'critical', msg: 'Patient in Bed 7 — Cardiac monitor alarming, BP 85/50' },
  { id: 'ALT-002', time: '09:08', ward: 'A&E', type: 'warning', msg: 'Triage queue at 14 patients — surge threshold exceeded' },
  { id: 'ALT-003', time: '08:52', ward: 'NICU', type: 'warning', msg: 'Incubator temperature variance in Bay 3 — maintenance alerted' },
  { id: 'ALT-004', time: '08:30', ward: 'Pharmacy', type: 'info', msg: 'Insulin stock below 20% — procurement order raised' },
];

const RECENT_ADMISSIONS = [
  { id: 'ADM-4881', name: 'Eno Effiong', time: '09:10', ward: 'A&E', reason: 'Acute abdominal pain', status: 'In Triage' },
  { id: 'ADM-4880', name: 'Nkemdirim Obi', time: '08:55', ward: 'Male Medical', reason: 'Hypertensive crisis', status: 'Admitted' },
  { id: 'ADM-4879', name: 'Blessing Udoh', time: '08:40', ward: 'O&G', reason: 'Labour — G3P2', status: 'Labour Ward' },
  { id: 'ADM-4878', name: 'Usen Akpan', time: '08:22', ward: 'Surgical', reason: 'Appendicitis — pre-op', status: 'Pre-Op' },
  { id: 'ADM-4877', name: 'Afiong Inyang', time: '07:58', ward: 'Paediatric', reason: 'Severe malaria — under 5', status: 'Admitted' },
];

const statusColor = (s: string) => {
  if (s === 'critical') return '#EF4444';
  if (s === 'surge') return '#F59E0B';
  if (s === 'high') return '#FB923C';
  return '#22C55E';
};

const statusLabel = (s: string) => {
  if (s === 'critical') return 'CRITICAL';
  if (s === 'surge') return 'SURGE';
  if (s === 'high') return 'HIGH';
  return 'NORMAL';
};

export const CommandCentreDashboard: React.FC = () => {
  const [selectedWard, setSelectedWard] = useState<string | null>(null);

  const totalBeds = WARDS.reduce((a, w) => a + w.beds, 0);
  const totalOccupied = WARDS.reduce((a, w) => a + w.occupied, 0);
  const occupancyPct = Math.round((totalOccupied / totalBeds) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI Strip */}
      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><BedDouble size={13} style={{ display: 'inline', marginRight: 4 }} />Total Inpatient Beds</span>
          <span className="metric-val">{totalOccupied} / {totalBeds}</span>
          <span className="metric-sub">{occupancyPct}% Occupancy • {totalBeds - totalOccupied} Available</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />A&E Average Wait</span>
          <span className="metric-val">28 min</span>
          <span className="metric-sub">14 Patients in Triage Queue</span>
        </div>
        <div className="metric-box alert-red">
          <span className="metric-label"><AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />Active Clinical Alerts</span>
          <span className="metric-val">{ACTIVE_ALERTS.length}</span>
          <span className="metric-sub">1 Critical • 2 Warning • 1 Advisory</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Staff On Duty</span>
          <span className="metric-val">186</span>
          <span className="metric-sub">34 Doctors • 112 Nurses • 40 Support</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Ward Grid */}
        <div>
          <div className="os-section-header">
            <span className="os-section-title"><Activity size={15} style={{ display: 'inline', marginRight: 6 }} />Live Ward Status — Ibom Specialist Hospital</span>
            <button className="os-ghost-btn"><RefreshCw size={13} /> Refresh</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {WARDS.map((ward) => {
              const pct = Math.round((ward.occupied / ward.beds) * 100);
              const color = statusColor(ward.status);
              const isSelected = selectedWard === ward.code;
              return (
                <div
                  key={ward.code}
                  className="os-card"
                  onClick={() => setSelectedWard(isSelected ? null : ward.code)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? color : undefined,
                    background: isSelected ? `rgba(${ward.status === 'critical' ? '239,68,68' : ward.status === 'surge' ? '245,158,11' : '21,128,61'},0.07)` : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0A2540' }}>{ward.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>{ward.code}</div>
                    </div>
                    <span style={{
                      background: `${color}20`,
                      color,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      border: `1px solid ${color}50`,
                    }}>{statusLabel(ward.status)}</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0A2540', marginBottom: 4 }}>
                    {ward.occupied}<span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748B' }}> / {ward.beds}</span>
                  </div>
                  <div style={{ width: '100%', height: 5, background: '#FFFFFF', borderRadius: 9999, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#94A3B8' }}>
                    <span><Stethoscope size={11} style={{ display: 'inline', marginRight: 3 }} />{ward.doctors} Doctors</span>
                    <span><Heart size={11} style={{ display: 'inline', marginRight: 3 }} />{ward.nurses} Nurses</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active Alerts */}
          <div>
            <div className="os-section-header">
              <span className="os-section-title"><AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />Clinical Alerts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACTIVE_ALERTS.map(alert => (
                <div key={alert.id} className="os-card" style={{ padding: '10px 14px', borderLeft: `3px solid ${alert.type === 'critical' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94A3B8' }}>{alert.ward} • {alert.time}</span>
                    <span style={{ fontSize: '0.68rem', color: alert.type === 'critical' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#60A5FA', fontWeight: 700 }}>
                      {alert.type.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#CBD5E1', lineHeight: 1.4 }}>{alert.msg}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Admissions */}
          <div>
            <div className="os-section-header">
              <span className="os-section-title"><CheckCircle2 size={14} style={{ display: 'inline', marginRight: 6 }} />Recent Admissions</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {RECENT_ADMISSIONS.map(adm => (
                <div key={adm.id} className="os-card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#0A2540' }}>{adm.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{adm.reason}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: '#22C55E', fontWeight: 600 }}>{adm.status}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{adm.time}</div>
                    </div>
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
