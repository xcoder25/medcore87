'use client';

import React, { useState, useMemo } from 'react';
import {
  Droplets, Plus, AlertTriangle, CheckCircle2,
  Download, Printer, RefreshCw, Clock, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export interface FluidEntry {
  id: string;
  time: string; // e.g. "08:00"
  // Intake (mL)
  oralMl: number;
  ivInfusionMl: number;
  ivFluidType?: string; // e.g. "Normal Saline"
  bloodMl: number;
  feedMl: number;
  // Output (mL)
  urineMl: number;
  ngTubeMl: number;
  drain1Ml: number;
  drain2Ml: number;
  vomitMl: number;
  stoolMl: number;
  notes?: string;
  nurseName: string;
}

interface Props {
  facilityId: string;
  patient?: { id: string; name?: string; firstName?: string; lastName?: string; hospitalNumber?: string; weightKg?: number } | null;
  onSave?: (entries: FluidEntry[]) => void;
}

export const FluidBalanceSuite: React.FC<Props> = ({
  facilityId,
  patient,
  onSave,
}) => {
  const patientDisplayName = patient
    ? (patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.hospitalNumber || 'Patient')
    : 'Inpatient Ward Patient';

  const patientWeight = Number(patient?.weightKg) || 70;

  // Initial demo shift entries
  const [entries, setEntries] = useState<FluidEntry[]>([
    {
      id: 'FB-1', time: '08:00',
      oralMl: 250, ivInfusionMl: 500, ivFluidType: 'Normal Saline 0.9%', bloodMl: 0, feedMl: 0,
      urineMl: 320, ngTubeMl: 0, drain1Ml: 40, drain2Ml: 0, vomitMl: 0, stoolMl: 0,
      notes: 'Morning medications taken with water. IV NS running at 100mL/hr.',
      nurseName: 'Nurse Grace',
    },
    {
      id: 'FB-2', time: '10:00',
      oralMl: 150, ivInfusionMl: 200, ivFluidType: 'Normal Saline 0.9%', bloodMl: 0, feedMl: 0,
      urineMl: 210, ngTubeMl: 0, drain1Ml: 25, drain2Ml: 0, vomitMl: 0, stoolMl: 0,
      notes: 'Urine clear straw-colored.',
      nurseName: 'Nurse Grace',
    },
    {
      id: 'FB-3', time: '12:00',
      oralMl: 300, ivInfusionMl: 200, ivFluidType: 'Dextrose Saline 5%', bloodMl: 0, feedMl: 0,
      urineMl: 280, ngTubeMl: 0, drain1Ml: 15, drain2Ml: 0, vomitMl: 0, stoolMl: 0,
      notes: 'Lunch broth and water.',
      nurseName: 'Nurse Grace',
    },
    {
      id: 'FB-4', time: '14:00',
      oralMl: 200, ivInfusionMl: 200, ivFluidType: 'Dextrose Saline 5%', bloodMl: 0, feedMl: 0,
      urineMl: 190, ngTubeMl: 0, drain1Ml: 10, drain2Ml: 0, vomitMl: 0, stoolMl: 0,
      notes: 'Shift handover to afternoon team.',
      nurseName: 'Nurse Ubong',
    },
  ]);

  // Modal / Quick Entry state
  const [showAddModal, setShowAddModal] = useState(false);
  const [time, setTime] = useState('16:00');
  const [oralMl, setOralMl] = useState('');
  const [ivMl, setIvMl] = useState('200');
  const [ivType, setIvType] = useState('Normal Saline 0.9%');
  const [bloodMl, setBloodMl] = useState('');
  const [feedMl, setFeedMl] = useState('');
  const [urineMl, setUrineMl] = useState('180');
  const [ngMl, setNgMl] = useState('');
  const [drain1Ml, setDrain1Ml] = useState('10');
  const [drain2Ml, setDrain2Ml] = useState('');
  const [vomitMl, setVomitMl] = useState('');
  const [notes, setNotes] = useState('');
  const [nurseName, setNurseName] = useState('Nurse on Duty');

  // Calculations
  const totals = useMemo(() => {
    let inTotal = 0;
    let outTotal = 0;
    let totalUrine = 0;

    for (const e of entries) {
      const rowIn = e.oralMl + e.ivInfusionMl + e.bloodMl + e.feedMl;
      const rowOut = e.urineMl + e.ngTubeMl + e.drain1Ml + e.drain2Ml + e.vomitMl + e.stoolMl;
      inTotal += rowIn;
      outTotal += rowOut;
      totalUrine += e.urineMl;
    }

    const net = inTotal - outTotal;
    const hoursRecorded = Math.max(entries.length * 2, 1);
    const urineRatePerHour = totalUrine / hoursRecorded;
    const urinePerKgPerHr = urineRatePerHour / patientWeight;

    return {
      inTotal,
      outTotal,
      net,
      totalUrine,
      urinePerKgPerHr: Math.round(urinePerKgPerHr * 100) / 100,
      hoursRecorded,
    };
  }, [entries, patientWeight]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: FluidEntry = {
      id: `FB-${Date.now()}`,
      time,
      oralMl: Number(oralMl) || 0,
      ivInfusionMl: Number(ivMl) || 0,
      ivFluidType: ivType,
      bloodMl: Number(bloodMl) || 0,
      feedMl: Number(feedMl) || 0,
      urineMl: Number(urineMl) || 0,
      ngTubeMl: Number(ngMl) || 0,
      drain1Ml: Number(drain1Ml) || 0,
      drain2Ml: Number(drain2Ml) || 0,
      vomitMl: Number(vomitMl) || 0,
      stoolMl: 0,
      notes,
      nurseName,
    };

    const next = [...entries, newEntry];
    setEntries(next);
    onSave?.(next);
    setShowAddModal(false);
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0284C7 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Droplets size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
              Nursing Fluid Balance & Intake/Output (I/O) Flowsheet
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span>Patient: <strong style={{ color: '#0F172A' }}>{patientDisplayName}</strong></span>
              <span>•</span>
              <span>Weight: {patientWeight} kg</span>
              <span>•</span>
              <span style={{ color: '#0284C7', fontWeight: 600 }}>24-Hour Inpatient Monitoring</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <Printer size={15} /> Print Chart
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg, #0284C7 0%, #00BFA5 100%)', color: '#0A2540', fontSize: '0.84rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 10px rgba(2,132,199,0.25)' }}
          >
            <Plus size={16} /> Log Fluid Entry
          </button>
        </div>
      </div>

      {/* KPI Cards: Intake, Output, Net Balance, Urine Output Rate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Total Intake */}
        <div style={{ padding: 14, borderRadius: 12, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0369A1', fontSize: '0.78rem', fontWeight: 700 }}>
            <span>Total Intake</span>
            <ArrowDownRight size={16} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0284C7', marginTop: 4 }}>
            {totals.inTotal.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>mL</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>Oral + IV + Blood + Feeds</div>
        </div>

        {/* Total Output */}
        <div style={{ padding: 14, borderRadius: 12, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#C2410C', fontSize: '0.78rem', fontWeight: 700 }}>
            <span>Total Output</span>
            <ArrowUpRight size={16} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EA580C', marginTop: 4 }}>
            {totals.outTotal.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>mL</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>Urine + Drains + NG + Vomit</div>
        </div>

        {/* Net Fluid Balance */}
        <div style={{ padding: 14, borderRadius: 12, background: totals.net >= 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${totals.net >= 0 ? '#BBF7D0' : '#FECACA'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: totals.net >= 0 ? '#166534' : '#991B1B', fontSize: '0.78rem', fontWeight: 700 }}>
            <span>Net Balance</span>
            <span>{totals.net >= 0 ? '+ Positive' : '- Deficit'}</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: totals.net >= 0 ? '#16A34A' : '#DC2626', marginTop: 4 }}>
            {totals.net >= 0 ? `+${totals.net.toLocaleString()}` : totals.net.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>mL</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>Intake minus Output</div>
        </div>

        {/* Urine Output Rate */}
        <div style={{ padding: 14, borderRadius: 12, background: totals.urinePerKgPerHr >= 0.5 ? '#F8FAFC' : '#FEF2F2', border: `1px solid ${totals.urinePerKgPerHr >= 0.5 ? '#E2E8F0' : '#FCA5A5'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: totals.urinePerKgPerHr >= 0.5 ? '#334155' : '#B91C1C', fontSize: '0.78rem', fontWeight: 700 }}>
            <span>Urine Rate</span>
            {totals.urinePerKgPerHr < 0.5 && <AlertTriangle size={15} color="#DC2626" />}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: totals.urinePerKgPerHr >= 0.5 ? '#0F172A' : '#DC2626', marginTop: 4 }}>
            {totals.urinePerKgPerHr} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>mL/kg/h</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: totals.urinePerKgPerHr >= 0.5 ? '#16A34A' : '#DC2626', marginTop: 2, fontWeight: 600 }}>
            {totals.urinePerKgPerHr >= 0.5 ? 'Adequate Renal Output' : 'Oliguria Warning (<0.5)'}
          </div>
        </div>
      </div>

      {/* Clinical Alert Banners */}
      {totals.net > 2000 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.82rem', marginBottom: 16 }}>
          <AlertTriangle size={17} color="#DC2626" />
          <span><strong>Fluid Overload Alert:</strong> Cumulative net balance is positive &gt; +2,000 mL. Assess patient for pulmonary crackles, pedal edema, or jugular venous distension. Consider reducing IV maintenance rate.</span>
        </div>
      )}

      {/* Fluid Balance Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
              <th style={{ padding: '10px 8px', borderRight: '1px solid #334155' }}>Time</th>
              <th colSpan={3} style={{ padding: '10px 8px', background: '#0369A1', borderRight: '1px solid #334155' }}>Intake (mL)</th>
              <th colSpan={3} style={{ padding: '10px 8px', background: '#C2410C', borderRight: '1px solid #334155' }}>Output (mL)</th>
              <th style={{ padding: '10px 8px', borderRight: '1px solid #334155' }}>Row Net</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Notes & Nurse</th>
            </tr>
            <tr style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.74rem' }}>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>Hour</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>Oral</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>IV Infusion</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>Blood/Feed</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>Urine</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>Drains</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>NG/Vomit</th>
              <th style={{ padding: 6, borderRight: '1px solid #E2E8F0' }}>+/- Balance</th>
              <th style={{ padding: 6, textAlign: 'left' }}>Clinical Observations</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((r, i) => {
              const rowIn = r.oralMl + r.ivInfusionMl + r.bloodMl + r.feedMl;
              const rowOut = r.urineMl + r.drain1Ml + r.drain2Ml + r.ngTubeMl + r.vomitMl;
              const rowNet = rowIn - rowOut;

              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 800, color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>{r.time}</td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0' }}>{r.oralMl || '-'}</td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0' }}>
                    <strong>{r.ivInfusionMl}</strong>
                    {r.ivFluidType && <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{r.ivFluidType}</div>}
                  </td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0' }}>{r.bloodMl || r.feedMl || '-'}</td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0', fontWeight: 700, color: '#C2410C' }}>{r.urineMl}</td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0' }}>{r.drain1Ml + r.drain2Ml || '-'}</td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0' }}>{r.ngTubeMl + r.vomitMl || '-'}</td>
                  <td style={{ padding: '8px 6px', borderRight: '1px solid #E2E8F0', fontWeight: 800, color: rowNet >= 0 ? '#16A34A' : '#DC2626' }}>
                    {rowNet >= 0 ? `+${rowNet}` : rowNet}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.75rem', color: '#475569' }}>
                    <div>{r.notes || 'Routine check'}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{r.nurseName}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#0F172A', color: '#FFFFFF', fontWeight: 800 }}>
              <td style={{ padding: 10, borderRight: '1px solid #334155' }}>TOTALS</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155' }}>{entries.reduce((a, b) => a + b.oralMl, 0)}</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155' }}>{entries.reduce((a, b) => a + b.ivInfusionMl, 0)}</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155' }}>{entries.reduce((a, b) => a + b.bloodMl + b.feedMl, 0)}</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155', color: '#FDBA74' }}>{totals.totalUrine}</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155' }}>{entries.reduce((a, b) => a + b.drain1Ml + b.drain2Ml, 0)}</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155' }}>{entries.reduce((a, b) => a + b.ngTubeMl + b.vomitMl, 0)}</td>
              <td style={{ padding: 10, borderRight: '1px solid #334155', color: totals.net >= 0 ? '#4ADE80' : '#F87171' }}>
                {totals.net >= 0 ? `+${totals.net}` : totals.net} mL
              </td>
              <td style={{ padding: 10, textAlign: 'left', fontSize: '0.72rem', color: '#94A3B8' }}>
                Cumulative Shift Summary
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 500, background: '#FFFFFF', borderRadius: 16, padding: 22, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              Log Nursing Fluid Intake & Output (mL)
            </h4>

            <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Time of Observation</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Nurse Name / Initials</label>
                  <input value={nurseName} onChange={(e) => setNurseName(e.target.value)} required style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.84rem' }} />
                </div>
              </div>

              {/* Intake fields */}
              <div style={{ padding: 10, borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0369A1', marginBottom: 6 }}>INTAKE (mL)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#475569' }}>Oral Fluids (mL):</label>
                    <input type="number" value={oralMl} onChange={(e) => setOralMl(e.target.value)} placeholder="0" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#475569' }}>IV Infusion (mL):</label>
                    <input type="number" value={ivMl} onChange={(e) => setIvMl(e.target.value)} placeholder="0" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                </div>
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: '0.72rem', color: '#475569' }}>IV Fluid Type:</label>
                  <input value={ivType} onChange={(e) => setIvType(e.target.value)} placeholder="e.g. Normal Saline / Ringers" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }} />
                </div>
              </div>

              {/* Output fields */}
              <div style={{ padding: 10, borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#C2410C', marginBottom: 6 }}>OUTPUT (mL)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#475569' }}>Urine (mL):</label>
                    <input type="number" value={urineMl} onChange={(e) => setUrineMl(e.target.value)} placeholder="0" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#475569' }}>Drain (mL):</label>
                    <input type="number" value={drain1Ml} onChange={(e) => setDrain1Ml(e.target.value)} placeholder="0" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#475569' }}>NG / Vomit (mL):</label>
                    <input type="number" value={vomitMl} onChange={(e) => setVomitMl(e.target.value)} placeholder="0" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Observations & Patient Condition</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Infusing well, urine clear yellow" style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', fontSize: '0.82rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ flex: 2, padding: 8, borderRadius: 8, border: 'none', background: '#0284C7', color: '#fff', fontSize: '0.84rem', fontWeight: 800, cursor: 'pointer' }}>
                  Record to Balance Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default FluidBalanceSuite;

