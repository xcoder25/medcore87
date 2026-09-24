'use client';
import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Users, BedDouble, Clock, Activity } from 'lucide-react';

const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const ADMISSIONS = [412, 438, 456, 401, 489, 521, 467];
const DISCHARGES = [398, 421, 441, 388, 471, 509, 452];
const AE_WAIT = [24, 26, 22, 28, 31, 27, 28];

const DEPARTMENT_KPIs = [
  { dept: 'Accident & Emergency', patientsToday: 34, avgWait: '28 min', satisfactory: '78%', change: +3.2 },
  { dept: 'Male Medical Ward', patientsToday: 43, avgWait: '—', satisfactory: '84%', change: +1.1 },
  { dept: 'Surgical Ward', patientsToday: 12, avgWait: '46 min', satisfactory: '91%', change: +0.4 },
  { dept: 'Paediatric Ward', patientsToday: 24, avgWait: '—', satisfactory: '88%', change: -2.1 },
  { dept: 'O&G Ward', patientsToday: 18, avgWait: '—', satisfactory: '93%', change: +5.3 },
  { dept: 'ICU', patientsToday: 14, avgWait: '—', satisfactory: '95%', change: +0.8 },
  { dept: 'Pharmacy', patientsToday: 142, avgWait: '19 min', satisfactory: '79%', change: -3.5 },
];

interface BarProps { values: number[]; labels: string[]; color: string; max?: number }

const SimpleBar: React.FC<BarProps> = ({ values, labels, color, max }) => {
  const m = max || Math.max(...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, padding: '0 4px' }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
          <div style={{ fontSize: '0.65rem', color: '#64748B' }}>{v}</div>
          <div style={{ width: '100%', height: `${(v / m) * 100}%`, background: color, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
          <div style={{ fontSize: '0.65rem', color: '#64748B' }}>{labels[i]}</div>
        </div>
      ))}
    </div>
  );
};

export const PerformanceAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | '3month'>('month');

  const latestAdmissions = ADMISSIONS[ADMISSIONS.length - 1];
  const prevAdmissions = ADMISSIONS[ADMISSIONS.length - 2];
  const admChange = (((latestAdmissions - prevAdmissions) / prevAdmissions) * 100).toFixed(1);

  return (
    <div className="os-module-layout">

      <div className="os-metrics-ribbon">
        <div className="metric-box">
          <span className="metric-label"><Activity size={13} style={{ display: 'inline', marginRight: 4 }} />Admissions (Sep)</span>
          <span className="metric-val">{latestAdmissions}</span>
          <span className="metric-sub" style={{ color: Number(admChange) >= 0 ? '#22C55E' : '#EF4444' }}>
            {Number(admChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(admChange))}% vs Aug
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label"><BedDouble size={13} style={{ display: 'inline', marginRight: 4 }} />Bed Occupancy</span>
          <span className="metric-val">92.6%</span>
          <span className="metric-sub">482 of 520 beds occupied</span>
        </div>
        <div className="metric-box alert-yellow">
          <span className="metric-label"><Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Avg A&E Wait</span>
          <span className="metric-val">28 min</span>
          <span className="metric-sub">Target: &lt;20 min</span>
        </div>
        <div className="metric-box alert-green">
          <span className="metric-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Avg Patient Satisfaction</span>
          <span className="metric-val">86%</span>
          <span className="metric-sub">Based on discharge surveys</span>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="os-card" style={{ padding: 20 }}>
          <div className="os-section-header" style={{ marginBottom: 16 }}>
            <span className="os-section-title"><TrendingUp size={14} style={{ display: 'inline', marginRight: 6 }} />Monthly Admissions</span>
          </div>
          <SimpleBar values={ADMISSIONS} labels={MONTHS} color="var(--ak-orange)" />
        </div>

        <div className="os-card" style={{ padding: 20 }}>
          <div className="os-section-header" style={{ marginBottom: 16 }}>
            <span className="os-section-title"><Clock size={14} style={{ display: 'inline', marginRight: 6 }} />A&E Average Wait (min)</span>
          </div>
          <SimpleBar values={AE_WAIT} labels={MONTHS} color="var(--ak-green)" max={40} />
        </div>
      </div>

      {/* Department KPI Table */}
      <div>
        <div className="os-section-header">
          <span className="os-section-title"><BarChart3 size={14} style={{ display: 'inline', marginRight: 6 }} />Department Clinical Performance Report</span>
        </div>
        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Department / Ward</th>
                <th>Patients Today</th>
                <th>Avg Wait</th>
                <th>Satisfaction Score</th>
                <th>Month-on-Month</th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENT_KPIs.map(row => (
                <tr key={row.dept}>
                  <td style={{ fontWeight: 600, color: '#0A2540' }}>{row.dept}</td>
                  <td style={{ color: '#CBD5E1' }}>{row.patientsToday}</td>
                  <td style={{ color: '#94A3B8', fontFamily: 'var(--os-font-mono)', fontSize: '0.82rem' }}>{row.avgWait}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#FFFFFF', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ width: row.satisfactory, height: '100%', background: 'linear-gradient(90deg, var(--ak-green), var(--ak-orange))', borderRadius: 9999 }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0A2540' }}>{row.satisfactory}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {row.change >= 0 ? <TrendingUp size={14} style={{ color: '#22C55E' }} /> : <TrendingDown size={14} style={{ color: '#EF4444' }} />}
                      <span style={{ color: row.change >= 0 ? '#22C55E' : '#EF4444', fontSize: '0.85rem', fontWeight: 600 }}>
                        {row.change >= 0 ? '+' : ''}{row.change}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
