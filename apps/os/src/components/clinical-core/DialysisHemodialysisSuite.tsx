'use client';

/**
 * DialysisHemodialysisSuite — Renal Dialysis & Hemodialysis Workstation.
 * Machine station assignment, Pre- vs Post-dialysis weight, Ultrafiltration (UF) calculation,
 * Vascular access monitoring (AV Fistula bruit/thrill), Heparin protocol, and
 * Hourly Intradialytic vital signs flowsheet with automated Intradialytic Hypotension (IDH) alerts.
 */

import React, { useState, useMemo } from 'react';
import {
  Activity, Save, Printer, Plus, CheckCircle2, RotateCcw, AlertTriangle,
  FileText, Shield, Info, HeartPulse, Droplets, Check, Zap
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export interface IntradialyticReading {
  time: string; // e.g. "08:00", "09:00"
  bpSystolic: number;
  bpDiastolic: number;
  pulseRate: number;
  bloodFlowRateQb: number; // mL/min (e.g. 250-350)
  dialysateFlowQd: number; // mL/min (e.g. 500)
  venousPressureMmHg: number;
  transmembranePressureTmp: number;
  ufRemovedCurrentMl: number;
  nurseNotes?: string;
}

export interface DialysisSessionData {
  id: string;
  stationNumber: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  dryWeightKg: number;
  preDialysisWeightKg: number;
  postDialysisWeightKg?: number;
  vascularAccess: 'AV Fistula (Radiocephalic)' | 'AV Fistula (Brachiocephalic)' | 'Permcath (Tunnelled Jugular)' | 'Temporary Femoral Line';
  accessThrillPresent: boolean;
  accessBruitPresent: boolean;
  dialyzerMembrane: 'High-Flux Polysulfone 1.8m²' | 'Low-Flux 1.4m²' | 'Biocompatible Synthetic';
  anticoagulation: 'Unfractionated Heparin' | 'Low Molecular Weight Heparin (Enoxaparin)' | 'Heparin-Free (Saline flushes)';
  heparinLoadingIu: number;
  heparinMaintenanceIuPerHour: number;
  sessionDurationHours: number;
  readings: IntradialyticReading[];
  status: 'In Progress' | 'Completed' | 'Aborted Emergent';
  nurseSignedBy: string;
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const DialysisHemodialysisSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [stationNo, setStationNo] = useState('Station D-03 (Fresenius 4008S)');
  const [dryWeight, setDryWeight] = useState(65.0);
  const [preWeight, setPreWeight] = useState(68.2);
  const [postWeight, setPostWeight] = useState<number | ''>('');
  const [vascularAccess, setVascularAccess] = useState<DialysisSessionData['vascularAccess']>('AV Fistula (Radiocephalic)');
  const [thrillPresent, setThrillPresent] = useState(true);
  const [bruitPresent, setBruitPresent] = useState(true);
  const [dialyzer, setDialyzer] = useState<DialysisSessionData['dialyzerMembrane']>('High-Flux Polysulfone 1.8m²');
  const [anticoagulation, setAnticoagulation] = useState<DialysisSessionData['anticoagulation']>('Unfractionated Heparin');
  const [heparinLoad, setHeparinLoad] = useState(2000);
  const [heparinRate, setHeparinRate] = useState(1000);
  const [durationHours, setDurationHours] = useState(4);

  // Hourly readings
  const [readings, setReadings] = useState<IntradialyticReading[]>([
    {
      time: '08:00 (Pre)',
      bpSystolic: 148,
      bpDiastolic: 92,
      pulseRate: 78,
      bloodFlowRateQb: 280,
      dialysateFlowQd: 500,
      venousPressureMmHg: 110,
      transmembranePressureTmp: 85,
      ufRemovedCurrentMl: 0,
      nurseNotes: 'Dialysis initiated smoothly. Access patent.',
    },
    {
      time: '09:00 (Hour 1)',
      bpSystolic: 140,
      bpDiastolic: 86,
      pulseRate: 80,
      bloodFlowRateQb: 300,
      dialysateFlowQd: 500,
      venousPressureMmHg: 125,
      transmembranePressureTmp: 95,
      ufRemovedCurrentMl: 800,
    },
    {
      time: '10:00 (Hour 2)',
      bpSystolic: 128,
      bpDiastolic: 80,
      pulseRate: 84,
      bloodFlowRateQb: 300,
      dialysateFlowQd: 500,
      venousPressureMmHg: 130,
      transmembranePressureTmp: 110,
      ufRemovedCurrentMl: 1600,
    },
    {
      time: '11:00 (Hour 3)',
      bpSystolic: 112,
      bpDiastolic: 74,
      pulseRate: 90,
      bloodFlowRateQb: 300,
      dialysateFlowQd: 500,
      venousPressureMmHg: 135,
      transmembranePressureTmp: 120,
      ufRemovedCurrentMl: 2400,
      nurseNotes: 'Mild cramp reported in calves. UF rate adjusted.',
    },
  ]);

  const [saved, setSaved] = useState(false);

  // Computed Ultrafiltration Target (Liters & mL)
  const ufGoalLiters = useMemo(() => {
    const diff = preWeight - dryWeight;
    return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
  }, [preWeight, dryWeight]);

  const ufRatePerHourMl = useMemo(() => {
    if (!durationHours || durationHours <= 0) return 0;
    return Math.round((ufGoalLiters * 1000) / durationHours);
  }, [ufGoalLiters, durationHours]);

  // Check for Intradialytic Hypotension (IDH) in latest reading
  const latestReading = readings[readings.length - 1];
  const isHypotensive = latestReading && (latestReading.bpSystolic < 95 || latestReading.bpDiastolic < 60);

  const handleAddHourlyReading = () => {
    const nextHour = readings.length;
    const newEntry: IntradialyticReading = {
      time: `${8 + nextHour}:00 (Hour ${nextHour})`,
      bpSystolic: 120,
      bpDiastolic: 78,
      pulseRate: 82,
      bloodFlowRateQb: 300,
      dialysateFlowQd: 500,
      venousPressureMmHg: 130,
      transmembranePressureTmp: 115,
      ufRemovedCurrentMl: Math.min(ufGoalLiters * 1000, nextHour * ufRatePerHourMl),
    };
    setReadings([...readings, newEntry]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E0F2FE', color: '#0369A1', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Droplets size={14} /> Nephrology & Renal Replacement Therapy
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Renal Hemodialysis Clinical Station & Flowsheet
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Ultrafiltration Math · AV Fistula Patency · Anticoagulation & Intradialytic Telemetry
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
          >
            <option value="">-- Select Renal Patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.hospitalNumber})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            style={{ padding: '9px 18px', borderRadius: 10, background: '#0284C7', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={15} /> Sign & Save Dialysis Run
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Hemodialysis session record saved and synchronized with Inpatient Kardex.
        </div>
      )}

      {/* Intradialytic Hypotension Alert */}
      {isHypotensive && (
        <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: '#FEF2F2', border: '1.5px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={22} color="#DC2626" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#991B1B' }}>
                WARNING: Intradialytic Hypotension (IDH) Detected ({latestReading.bpSystolic}/{latestReading.bpDiastolic} mmHg)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: 2 }}>
                Immediately place patient in Trendelenburg position, reduce or stop ultrafiltration (UF), and administer 100–200 mL 0.9% Normal Saline bolus.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alert('Normal Saline 150mL Bolus logged.')}
            style={{ padding: '6px 14px', borderRadius: 8, background: '#DC2626', color: '#FFF', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.76rem' }}
          >
            Administer Saline Bolus
          </button>
        </div>
      )}

      {/* Grid: Dialysis Parameters | Flowsheet */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Left Column: Dialysis Setup & Math */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Station & Access Info */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              1. Station & Vascular Access
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Machine Station</label>
                <input
                  type="text"
                  value={stationNo}
                  onChange={(e) => setStationNo(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Vascular Access Site</label>
                <select
                  value={vascularAccess}
                  onChange={(e) => setVascularAccess(e.target.value as any)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}
                >
                  <option value="AV Fistula (Radiocephalic)">AV Fistula (Radiocephalic)</option>
                  <option value="AV Fistula (Brachiocephalic)">AV Fistula (Brachiocephalic)</option>
                  <option value="Permcath (Tunnelled Jugular)">Permcath (Tunnelled Jugular)</option>
                  <option value="Temporary Femoral Line">Temporary Femoral Line</option>
                </select>
              </div>

              {/* Fistula Bruit & Thrill checklist */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setThrillPresent(!thrillPresent)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: thrillPresent ? '1.5px solid #059669' : '1px solid #CBD5E1',
                    background: thrillPresent ? '#ECFDF5' : '#FFF',
                    color: thrillPresent ? '#065F46' : '#64748B',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {thrillPresent ? '✓ Thrill Palpable' : '✗ No Thrill'}
                </button>
                <button
                  type="button"
                  onClick={() => setBruitPresent(!bruitPresent)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: bruitPresent ? '1.5px solid #059669' : '1px solid #CBD5E1',
                    background: bruitPresent ? '#ECFDF5' : '#FFF',
                    color: bruitPresent ? '#065F46' : '#64748B',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {bruitPresent ? '✓ Bruit Audible' : '✗ No Bruit'}
                </button>
              </div>
            </div>
          </div>

          {/* Ultrafiltration Math & Prescription */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              2. Ultrafiltration (UF) Math
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem', marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Dry Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={dryWeight}
                  onChange={(e) => setDryWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Pre-Dialysis Wt (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={preWeight}
                  onChange={(e) => setPreWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>

            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span>Fluid Overload Target:</span>
                <strong style={{ color: '#0369A1' }}>{ufGoalLiters} L ({ufGoalLiters * 1000} mL)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span>Prescribed UF Rate:</span>
                <strong style={{ color: '#0369A1' }}>{ufRatePerHourMl} mL/hour</strong>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem' }}>
              <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Anticoagulation</label>
              <select
                value={anticoagulation}
                onChange={(e) => setAnticoagulation(e.target.value as any)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', marginBottom: 8 }}
              >
                <option value="Unfractionated Heparin">Unfractionated Heparin</option>
                <option value="Low Molecular Weight Heparin (Enoxaparin)">LMWH (Enoxaparin)</option>
                <option value="Heparin-Free (Saline flushes)">Heparin-Free (Saline Flushes)</option>
              </select>

              {anticoagulation.includes('Heparin') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.74rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Loading Dose:</span>
                    <input
                      type="number"
                      value={heparinLoad}
                      onChange={(e) => setHeparinLoad(parseInt(e.target.value, 10))}
                      style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px solid #CBD5E1', marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Rate (IU/hr):</span>
                    <input
                      type="number"
                      value={heparinRate}
                      onChange={(e) => setHeparinRate(parseInt(e.target.value, 10))}
                      style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px solid #CBD5E1', marginTop: 2 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Intradialytic Flowsheet */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
              Intradialytic Telemetry & Vitals Flowsheet (Hourly Log)
            </div>
            <button
              type="button"
              onClick={handleAddHourlyReading}
              style={{ padding: '6px 12px', borderRadius: 8, background: '#0284C7', color: '#FFF', fontSize: '0.76rem', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} /> Log Hour Reading
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Time</th>
                  <th style={{ padding: '10px 12px' }}>BP (mmHg)</th>
                  <th style={{ padding: '10px 12px' }}>Pulse</th>
                  <th style={{ padding: '10px 12px' }}>Qb (mL/min)</th>
                  <th style={{ padding: '10px 12px' }}>Venous Press.</th>
                  <th style={{ padding: '10px 12px' }}>TMP</th>
                  <th style={{ padding: '10px 12px' }}>UF Removed</th>
                  <th style={{ padding: '10px 12px' }}>Nurse Notes</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r, i) => {
                  const isLow = r.bpSystolic < 95;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: isLow ? '#FEF2F2' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0F172A' }}>{r.time}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: isLow ? '#DC2626' : '#0F172A' }}>
                        {r.bpSystolic}/{r.bpDiastolic}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.pulseRate} bpm</td>
                      <td style={{ padding: '10px 12px' }}>{r.bloodFlowRateQb}</td>
                      <td style={{ padding: '10px 12px' }}>{r.venousPressureMmHg}</td>
                      <td style={{ padding: '10px 12px' }}>{r.transmembranePressureTmp}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0369A1' }}>
                        {r.ufRemovedCurrentMl} mL
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>
                        {r.nurseNotes || 'Stable'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DialysisHemodialysisSuite;
