'use client';

/**
 * CssdSterileSupplySuite — Central Sterile Supply Department (CSSD).
 * Autoclave batch sterilization cycles, Chemical & Biological Indicator spore tests,
 * Surgical instrument tray assembly, and Sterile Barcode Tracking with expiry dates.
 */

import React, { useState } from 'react';
import {
  Package, Plus, CheckCircle2, AlertTriangle, ShieldCheck,
  RefreshCw, Printer, Clock, Check, Barcode
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';

export interface AutoclaveCycle {
  id: string;
  batchNumber: string;
  autoclaveMachineId: string;
  cycleType: '134°C Porous Load' | '121°C Gravity' | 'Flash / Rapid';
  temperatureC: number;
  pressureBar: number;
  holdTimeMinutes: number;
  startTime: string;
  operator: string;
  chemicalIndicatorPassed: boolean;
  biologicalSporeTestPassed: boolean;
  status: 'In Progress' | 'Passed & Certified' | 'Failed / Aborted';
}

export interface SterileTray {
  id: string;
  trayBarcode: string;
  trayName: string;
  departmentTarget: 'Main Theatre Suite' | 'Labour Ward / Maternity' | 'A&E Resus' | 'Minor Surgery OPD';
  sterilizedAt: string;
  expiresAt: string;
  batchNumber: string;
  inspectedBy: string;
  status: 'Sterile & Available' | 'Dispatched / In Use' | 'Expired / Reprocess Required';
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const CssdSterileSupplySuite: React.FC<Props> = ({ session, onNavigate }) => {
  const [cycles, setCycles] = useState<AutoclaveCycle[]>([
    {
      id: 'CYC-101',
      batchNumber: 'CSSD-2026-B089',
      autoclaveMachineId: 'Getinge Autoclave #01 (Chamber A)',
      cycleType: '134°C Porous Load',
      temperatureC: 134.5,
      pressureBar: 2.15,
      holdTimeMinutes: 7,
      startTime: '08:30',
      operator: session?.name || 'Sgt. Ubong Akpan (CSSD Lead)',
      chemicalIndicatorPassed: true,
      biologicalSporeTestPassed: true,
      status: 'Passed & Certified',
    },
    {
      id: 'CYC-102',
      batchNumber: 'CSSD-2026-B090',
      autoclaveMachineId: 'Tuttnauer Benchtop #02 (OPD)',
      cycleType: '121°C Gravity',
      temperatureC: 121.2,
      pressureBar: 1.15,
      holdTimeMinutes: 20,
      startTime: '10:15',
      operator: 'Sister Mary Effiong',
      chemicalIndicatorPassed: true,
      biologicalSporeTestPassed: true,
      status: 'Passed & Certified',
    },
  ]);

  const [trays, setTrays] = useState<SterileTray[]>([
    {
      id: 'TRY-01',
      trayBarcode: 'TRY-CS-0041',
      trayName: 'Major Caesarean Section Instrument Pack',
      departmentTarget: 'Labour Ward / Maternity',
      sterilizedAt: '2026-11-12',
      expiresAt: '2026-12-12',
      batchNumber: 'CSSD-2026-B089',
      inspectedBy: 'Nurse Inemesit Bassey',
      status: 'Sterile & Available',
    },
    {
      id: 'TRY-02',
      trayBarcode: 'TRY-LAP-0019',
      trayName: 'Major Exploratory Laparotomy Tray Set',
      departmentTarget: 'Main Theatre Suite',
      sterilizedAt: '2026-11-12',
      expiresAt: '2026-12-12',
      batchNumber: 'CSSD-2026-B089',
      inspectedBy: 'Sgt. Ubong Akpan',
      status: 'Sterile & Available',
    },
    {
      id: 'TRY-03',
      trayBarcode: 'TRY-ORTH-0082',
      trayName: 'Large Bone Fracture Fixation Plating Set',
      departmentTarget: 'Main Theatre Suite',
      sterilizedAt: '2026-10-10',
      expiresAt: '2026-11-10',
      batchNumber: 'CSSD-2026-B062',
      inspectedBy: 'Sister Mary Effiong',
      status: 'Expired / Reprocess Required',
    },
  ]);

  const [activeTab, setActiveTab] = useState<'trays' | 'cycles'>('trays');
  const [newTrayName, setNewTrayName] = useState('General Surgical Suture Set');
  const [newTrayTarget, setNewTrayTarget] = useState<SterileTray['departmentTarget']>('Main Theatre Suite');

  const handlePackNewTray = () => {
    const today = new Date();
    const expiry = new Date();
    expiry.setDate(today.getDate() + 30); // 30 day shelf-life

    const newTr: SterileTray = {
      id: `TRY-${Date.now()}`,
      trayBarcode: `TRY-SET-${Math.floor(1000 + Math.random() * 9000)}`,
      trayName: newTrayName,
      departmentTarget: newTrayTarget,
      sterilizedAt: today.toISOString().split('T')[0],
      expiresAt: expiry.toISOString().split('T')[0],
      batchNumber: cycles[0]?.batchNumber || 'CSSD-2026-B090',
      inspectedBy: session?.name || 'Duty CSSD Officer',
      status: 'Sterile & Available',
    };
    setTrays([newTr, ...trays]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EFF6FF', color: '#0369A1', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <ShieldCheck size={14} /> Hospital Sterilization & Infection Control
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            CSSD Sterile Supply & Instrument Tray Tracking
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Autoclave Sterilization Runs · Biological Spore Verification · 30-Day Barcode Tracking
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setActiveTab('trays')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'trays' ? '2px solid #0284C7' : '1px solid #E2E8F0',
              background: activeTab === 'trays' ? '#E0F2FE' : '#FFF',
              color: activeTab === 'trays' ? '#0369A1' : '#475569',
            }}
          >
            Sterile Trays ({trays.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cycles')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'cycles' ? '2px solid #0284C7' : '1px solid #E2E8F0',
              background: activeTab === 'cycles' ? '#E0F2FE' : '#FFF',
              color: activeTab === 'cycles' ? '#0369A1' : '#475569',
            }}
          >
            Autoclave Machine Batches ({cycles.length})
          </button>
        </div>
      </div>

      {activeTab === 'trays' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          {/* Trays List */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 14 }}>
              Surgical Instrument Sets in Circulation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trays.map((t) => (
                <div key={t.id} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 800, color: '#0369A1', background: '#E0F2FE', padding: '2px 6px', borderRadius: 4 }}>
                        {t.trayBarcode}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Batch: {t.batchNumber}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>{t.trayName}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 3 }}>
                      Target: <strong>{t.departmentTarget}</strong> · Sterilized: {t.sterilizedAt} · Expiry: <strong>{t.expiresAt}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: t.status === 'Sterile & Available' ? '#ECFDF5' : t.status === 'Dispatched / In Use' ? '#EFF6FF' : '#FEE2E2',
                        color: t.status === 'Sterile & Available' ? '#065F46' : t.status === 'Dispatched / In Use' ? '#1D4ED8' : '#DC2626',
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Assembly & Label Printing */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              Assemble & Print Sterile Barcode
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Instrument Tray Description</label>
                <input
                  type="text"
                  value={newTrayName}
                  onChange={(e) => setNewTrayName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Destination Unit</label>
                <select
                  value={newTrayTarget}
                  onChange={(e) => setNewTrayTarget(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF' }}
                >
                  <option value="Main Theatre Suite">Main Theatre Suite</option>
                  <option value="Labour Ward / Maternity">Labour Ward / Maternity</option>
                  <option value="A&E Resus">A&E Resus</option>
                  <option value="Minor Surgery OPD">Minor Surgery OPD</option>
                </select>
              </div>

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                <Barcode size={48} style={{ margin: '0 auto', color: '#0F172A' }} />
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                  Barcode auto-computes 30-day sterile shelf life
                </div>
              </div>

              <button
                type="button"
                onClick={handlePackNewTray}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0284C7',
                  color: '#FFF',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Plus size={16} /> Seal & Register Sterile Pack
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Autoclave Batches */
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 14 }}>
            Autoclave Sterilizer Physical Run Logs
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cycles.map((cyc) => (
              <div key={cyc.id} style={{ padding: 16, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>{cyc.batchNumber}</span>
                    <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 6, background: '#E0F2FE', color: '#0369A1', fontWeight: 700 }}>
                      {cyc.cycleType}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                    Machine: <strong>{cyc.autoclaveMachineId}</strong> · Peak Temp: {cyc.temperatureC}°C · Pressure: {cyc.pressureBar} bar · Hold Time: {cyc.holdTimeMinutes} mins
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                    Operator: {cyc.operator} · Started: {cyc.startTime}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'right', fontSize: '0.74rem' }}>
                    <div style={{ color: cyc.chemicalIndicatorPassed ? '#059669' : '#DC2626', fontWeight: 700 }}>
                      Chemical Strips: {cyc.chemicalIndicatorPassed ? 'PASSED' : 'FAILED'}
                    </div>
                    <div style={{ color: cyc.biologicalSporeTestPassed ? '#059669' : '#DC2626', fontWeight: 700, marginTop: 2 }}>
                      Spore Test (B. atrophaeus): {cyc.biologicalSporeTestPassed ? 'NEGATIVE (PASSED)' : 'POSITIVE'}
                    </div>
                  </div>
                  <span style={{ padding: '6px 12px', borderRadius: 8, background: '#ECFDF5', color: '#065F46', fontWeight: 800, fontSize: '0.76rem' }}>
                    {cyc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CssdSterileSupplySuite;

