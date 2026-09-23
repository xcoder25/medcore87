'use client';

import React, { useState } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Flame,
  Trash2, ShieldCheck, FileText, User
} from 'lucide-react';
import type { SafetyIncidentReport } from '@medcore/types';

const INITIAL_INCIDENTS: SafetyIncidentReport[] = [
  { id: 'INC-2026-014', incidentType: 'Needlestick', department: 'Accident & Emergency (Triage)', severity: 'Moderate', reportedAt: 'Today 07:15', reporterRole: 'Nurse Intern', status: 'containment_active' },
  { id: 'INC-2026-015', incidentType: 'Chemical Spill', department: 'Central Pathology Laboratory', severity: 'Minor', reportedAt: 'Yesterday 16:40', reporterRole: 'Lab Scientist', status: 'resolved' },
  { id: 'INC-2026-016', incidentType: 'Patient Fall', department: 'Geriatric / Female Medical Ward', severity: 'Minor', reportedAt: 'Yesterday 21:10', reporterRole: 'Staff Nurse', status: 'resolved' },
  { id: 'INC-2026-017', incidentType: 'Equipment Failure', department: 'Operating Theatre 1', severity: 'Near Miss', reportedAt: 'Today 08:05', reporterRole: 'Scrub Nurse', status: 'open_investigation' },
];

export const EnvironmentalSafetySuite: React.FC = () => {
  const [incidents, setIncidents] = useState<SafetyIncidentReport[]>(INITIAL_INCIDENTS);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Infection Control (IPC) Score</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>98.4%</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>WHO Compliant</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Hand Hygiene Compliance: 94%</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Biohazard Waste Disposed</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>340 kg</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Autoclaved / Incinerated</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Yellow/Red Bags Segregated 100%</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Active Safety Incidents</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>2 Active</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>Under Investigation</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Needlestick PEP Protocol Active</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Fire Safety System</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>100% Ready</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Certified</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Smoke Detectors & Sprinklers Armed</span>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            Hospital Clinical Safety & Environmental Incident Register
          </span>
          <button
            type="button"
            className="os-action-btn-primary"
            style={{ fontSize: '0.72rem', padding: '6px 12px' }}
            onClick={() => alert('New clinical safety report form initiated.')}
          >
            <ShieldAlert size={12} /> Log New Safety Incident
          </button>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Classification</th>
                <th>Department</th>
                <th>Severity</th>
                <th>Reported By</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <tr key={inc.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.74rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>
                    {inc.id}
                  </td>
                  <td style={{ fontWeight: 700, color: '#0A2540' }}>{inc.incidentType}</td>
                  <td>{inc.department}</td>
                  <td>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: inc.severity === 'Major' ? '#DC2626' : inc.severity === 'Moderate' ? 'rgba(234,88,12,0.2)' : 'rgba(59,130,246,0.2)',
                      color: inc.severity === 'Major' ? '#FFF' : inc.severity === 'Moderate' ? 'var(--ak-orange-light)' : '#60A5FA',
                    }}>
                      {inc.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--os-text-muted)' }}>{inc.reporterRole}</td>
                  <td style={{ fontSize: '0.74rem', color: 'var(--os-text-dim)' }}>{inc.reportedAt}</td>
                  <td>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: inc.status === 'resolved' ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.15)',
                      color: inc.status === 'resolved' ? '#34D399' : '#F87171',
                    }}>
                      {inc.status.replace('_', ' ').toUpperCase()}
                    </span>
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
