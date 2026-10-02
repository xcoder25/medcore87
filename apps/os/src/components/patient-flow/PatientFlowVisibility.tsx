'use client';

/**
 * Patient Flow Visibility — realtime from reception visits + patient registry.
 * No demo patients. Empty until check-ins / registrations exist.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Users, ArrowRight, Search, RefreshCw } from 'lucide-react';
import { listPatients, subscribePatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { todayVisits, subscribeReceptionOps, type ReceptionVisit } from '../../lib/receptionOpsStore';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';

type FlowStage = 'triage' | 'assessment' | 'admitted' | 'transfer' | 'discharged' | 'waiting';

interface FlowRow {
  id: string;
  name: string;
  age: string;
  sex: string;
  stage: FlowStage;
  priority: 'red' | 'yellow' | 'green';
  complaint: string;
  time: string;
  ward?: string;
  doctor?: string;
  nhiaStatus: 'covered' | 'self-pay' | 'pending';
  hospitalNumber: string;
}

const STAGES: { key: FlowStage; label: string; color: string }[] = [
  { key: 'waiting', label: 'Waiting / Triage', color: '#F59E0B' },
  { key: 'assessment', label: 'With provider', color: '#3B82F6' },
  { key: 'admitted', label: 'In progress', color: '#8B5CF6' },
  { key: 'transfer', label: 'Transfer', color: '#EF4444' },
  { key: 'discharged', label: 'Completed', color: '#22C55E' },
];

const PRIORITY_META = {
  red: { label: 'Urgent', color: '#EF4444' },
  yellow: { label: 'Semi-urgent', color: '#F59E0B' },
  green: { label: 'Routine', color: '#22C55E' },
};

const NHIA_META = {
  covered: { label: 'Insured', color: '#22C55E' },
  'self-pay': { label: 'Self-pay', color: '#94A3B8' },
  pending: { label: 'Pending', color: '#F59E0B' },
};

function mapVisitStatus(s: ReceptionVisit['status']): FlowStage {
  if (s === 'waiting' || s === 'called') return 'waiting';
  if (s === 'with_provider') return 'assessment';
  if (s === 'completed') return 'discharged';
  if (s === 'cancelled' || s === 'no_show') return 'transfer';
  return 'waiting';
}

function ageFromDob(dob?: string): string {
  if (!dob) return '—';
  try {
    const y = new Date(dob).getFullYear();
    const age = new Date().getFullYear() - y;
    return age > 0 && age < 120 ? String(age) : '—';
  } catch {
    return '—';
  }
}

function nhiaFromPatient(p?: FacilityPatient): FlowRow['nhiaStatus'] {
  if (!p) return 'pending';
  if (!p.insuranceProvider || p.insuranceProvider === 'NONE') return 'self-pay';
  if (p.insuranceId || p.nhiaNumber) return 'covered';
  return 'pending';
}

function buildRows(facilityId: string): FlowRow[] {
  const visits = todayVisits(facilityId);
  const patients = listPatients(facilityId);
  const byId = new Map(patients.map((p) => [p.id, p]));

  return visits.map((v) => {
    const p = byId.get(v.patientId);
    const priority: FlowRow['priority'] =
      v.visitType === 'emergency' ? 'red' : v.visitType === 'appointment' ? 'green' : 'yellow';
    return {
      id: v.id,
      name: v.patientName,
      age: ageFromDob(p?.dob),
      sex: p?.sex === 'Male' ? 'M' : p?.sex === 'Female' ? 'F' : '—',
      stage: mapVisitStatus(v.status),
      priority,
      complaint: v.reason || v.department || '—',
      time: v.checkedInAt.slice(11, 16),
      ward: v.department,
      doctor: v.doctor,
      nhiaStatus: nhiaFromPatient(p),
      hospitalNumber: v.hospitalNumber,
    };
  });
}

export const PatientFlowVisibility: React.FC = () => {
  const facilityId =
    (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<FlowStage | 'all'>('all');
  const [rows, setRows] = useState<FlowRow[]>([]);
  const [tick, setTick] = useState(0);

  const reload = () => {
    setRows(buildRows(facilityId));
    setTick((t) => t + 1);
  };

  useEffect(() => {
    reload();
    const u1 = subscribeReceptionOps(reload);
    const u2 = subscribePatients(reload);
    const onReset = () => reload();
    window.addEventListener('medcore-data-reset', onReset);
    return () => {
      u1();
      u2();
      window.removeEventListener('medcore-data-reset', onReset);
    };
  }, [facilityId]);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      const matchStage = stageFilter === 'all' || p.stage === stageFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.hospitalNumber.toLowerCase().includes(q);
      return matchStage && matchSearch;
    });
  }, [rows, search, stageFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
            Patient Flow Visibility
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Live from today&apos;s check-ins — no demo patients. Register and check in patients to populate this board.
          </p>
        </div>
        <button
          type="button"
          className="os-ghost-btn mc-btn-live"
          onClick={reload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {STAGES.map((stage, i) => {
          const count = rows.filter((p) => p.stage === stage.key).length;
          const active = stageFilter === stage.key;
          return (
            <React.Fragment key={stage.key}>
              <button
                type="button"
                onClick={() => setStageFilter(active ? 'all' : stage.key)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: active ? `${stage.color}18` : '#fff',
                  border: `1px solid ${active ? stage.color : '#E2E8F0'}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: stage.color }}>{stage.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{count}</div>
              </button>
              {i < STAGES.length - 1 && (
                <ArrowRight size={16} color="#CBD5E1" style={{ flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="os-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input
            className="os-search-input"
            placeholder="Search patient name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="os-ghost-btn"
          onClick={() => setStageFilter('all')}
          style={{ fontWeight: 600 }}
        >
          All stages
        </button>
      </div>

      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th>Visit / ID</th>
              <th>Name</th>
              <th>Age/Sex</th>
              <th>Priority</th>
              <th>Dept / note</th>
              <th>Stage</th>
              <th>Ward/Doctor</th>
              <th>Insurance</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                  <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>No patients in flow</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Check-ins from Reception appear here in realtime.
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const stage = STAGES.find((s) => s.key === p.stage) || STAGES[0];
              const pMeta = PRIORITY_META[p.priority];
              const nhia = NHIA_META[p.nhiaStatus];
              return (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#94A3B8' }}>
                    {p.hospitalNumber}
                  </td>
                  <td style={{ fontWeight: 600, color: '#0A2540' }}>{p.name}</td>
                  <td style={{ color: '#94A3B8' }}>
                    {p.age}y {p.sex}
                  </td>
                  <td>
                    <span
                      style={{
                        background: `${pMeta.color}20`,
                        color: pMeta.color,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 9999,
                      }}
                    >
                      {pMeta.label}
                    </span>
                  </td>
                  <td style={{ color: '#64748B', fontSize: '0.83rem', maxWidth: 180 }}>{p.complaint}</td>
                  <td>
                    <span
                      style={{
                        background: `${stage.color}20`,
                        color: stage.color,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 9999,
                      }}
                    >
                      {stage.label}
                    </span>
                  </td>
                  <td style={{ color: '#94A3B8', fontSize: '0.82rem' }}>{p.ward || p.doctor || '—'}</td>
                  <td>
                    <span style={{ color: nhia.color, fontSize: '0.78rem', fontWeight: 600 }}>{nhia.label}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.8rem', color: '#64748B' }}>
                    {p.time}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8' }}>
        Updated live · {rows.length} visit{rows.length === 1 ? '' : 's'} today · rev {tick}
      </div>
    </div>
  );
};

export default PatientFlowVisibility;
