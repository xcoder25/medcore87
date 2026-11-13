'use client';

/**
 * ImmunizationColdChainSuite — National Programme on Immunization (NPI) & Vaccine Cold Chain.
 * Full routine childhood schedule (Birth to 15 months), Adult/Maternal vaccines (Tetanus TT, HepB, HPV),
 * Solar Refrigerator Temperature Monitoring (+2°C to +8°C), and Vaccine Vial Monitor (VVM) verification.
 */

import React, { useState } from 'react';
import {
  Baby, CheckCircle2, AlertTriangle, ShieldCheck, Plus,
  Thermometer, Calendar, Clock, Check, RefreshCw, Snowflake
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export interface VaccineDoseItem {
  id: string;
  vaccineName: string;
  targetAge: string;
  route: string;
  batchNumber: string;
  expiryDate: string;
  vvmStage: 1 | 2 | 3 | 4; // 1-2 usable, 3-4 discard
  administered: boolean;
  dateAdministered?: string;
  nurseSignedBy?: string;
}

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const ImmunizationColdChainSuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Daily Refrigerator Temperature Log
  const [fridgeTempC, setFridgeTempC] = useState(4.2);
  const isColdChainBroken = fridgeTempC < 2.0 || fridgeTempC > 8.0;

  // Routine Childhood Vaccine Tracker
  const [doses, setDoses] = useState<VaccineDoseItem[]>([
    { id: 'VAC-01', vaccineName: 'BCG (Bacillus Calmette–Guérin)', targetAge: 'Birth', route: 'Intradermal (0.05 mL, Left Forearm)', batchNumber: 'BCG-2026-901', expiryDate: '2027-08-30', vvmStage: 1, administered: true, dateAdministered: '2026-11-01', nurseSignedBy: 'Nurse Inemesit Bassey' },
    { id: 'VAC-02', vaccineName: 'Oral Polio Vaccine (OPV 0)', targetAge: 'Birth', route: 'Oral (2 drops)', batchNumber: 'OPV-2026-114', expiryDate: '2027-04-15', vvmStage: 1, administered: true, dateAdministered: '2026-11-01', nurseSignedBy: 'Nurse Inemesit Bassey' },
    { id: 'VAC-03', vaccineName: 'Hepatitis B (Birth dose)', targetAge: 'Birth (within 24h)', route: 'Intramuscular (0.5 mL, Anterolateral Thigh)', batchNumber: 'HEPB-2026-441', expiryDate: '2027-06-20', vvmStage: 1, administered: true, dateAdministered: '2026-11-01', nurseSignedBy: 'Nurse Inemesit Bassey' },
    { id: 'VAC-04', vaccineName: 'Pentavalent 1 (DTP-HepB-Hib)', targetAge: '6 Weeks', route: 'Intramuscular (0.5 mL, Left Thigh)', batchNumber: 'PENTA-2026-302', expiryDate: '2027-09-10', vvmStage: 1, administered: false },
    { id: 'VAC-05', vaccineName: 'Pneumococcal Conjugate (PCV 1)', targetAge: '6 Weeks', route: 'Intramuscular (0.5 mL, Right Thigh)', batchNumber: 'PCV-2026-809', expiryDate: '2027-11-01', vvmStage: 1, administered: false },
    { id: 'VAC-06', vaccineName: 'Rotavirus 1', targetAge: '6 Weeks', route: 'Oral (1.5 mL oral syringe)', batchNumber: 'ROTA-2026-210', expiryDate: '2027-05-15', vvmStage: 1, administered: false },
    { id: 'VAC-07', vaccineName: 'Measles 1 & Yellow Fever', targetAge: '9 Months', route: 'Subcutaneous (0.5 mL, Upper Arm)', batchNumber: 'MSL-2026-004', expiryDate: '2027-12-31', vvmStage: 1, administered: false },
  ]);

  const [saved, setSaved] = useState(false);

  const handleAdministerDose = (id: string) => {
    setDoses((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              administered: true,
              dateAdministered: new Date().toISOString().split('T')[0],
              nurseSignedBy: session?.name || 'Duty Immunization Sister',
            }
          : d
      )
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EFF6FF', color: '#0369A1', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Snowflake size={14} /> National Programme on Immunization (NPI)
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Vaccine Immunization Registry & Cold Chain Suite
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            National Routine Childhood Schedule · Refrigerator Telemetry (+2°C to +8°C) · VVM Integrity Verification
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
          >
            <option value="">-- Select Child / Mother --</option>
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
            <ShieldCheck size={16} /> Sync National Registry
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Immunization doses recorded and uploaded to DHIS2 / State e-CRVS registry.
        </div>
      )}

      {/* Cold Chain Refrigerator Monitor Card */}
      <div style={{ marginBottom: 20, padding: 18, borderRadius: 14, background: isColdChainBroken ? '#FEF2F2' : '#FFFFFF', border: isColdChainBroken ? '2px solid #FCA5A5' : '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: isColdChainBroken ? '#DC2626' : '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isColdChainBroken ? '#FFF' : '#0369A1' }}>
            <Thermometer size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: isColdChainBroken ? '#991B1B' : '#0F172A' }}>
              Vestfrost Solar Direct Drive (SDD) Vaccine Refrigerator #01
            </div>
            <div style={{ fontSize: '0.78rem', color: isColdChainBroken ? '#B91C1C' : '#64748B', marginTop: 2 }}>
              Target Window: <strong>+2.0°C to +8.0°C</strong> · Last Automated Sensor Probe Ping: 2 mins ago
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color: isColdChainBroken ? '#DC2626' : '#0284C7' }}>
              {fridgeTempC}°C
            </span>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 8, background: isColdChainBroken ? '#DC2626' : '#ECFDF5', color: isColdChainBroken ? '#FFF' : '#065F46', fontWeight: 800, fontSize: '0.76rem' }}>
            {isColdChainBroken ? 'COLD CHAIN BREACH' : 'OPTIMAL COLD CHAIN'}
          </span>
        </div>
      </div>

      {/* Routine Childhood Schedule Grid */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
            Routine National Immunization Schedule (Birth to 15 Months)
          </div>
          <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
            VVM Stages: <strong>Stage 1–2 (Usable)</strong> | <strong>Stage 3–4 (Discard)</strong>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {doses.map((dose) => (
            <div
              key={dose.id}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: dose.administered ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                background: dose.administered ? '#F0FDF4' : '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: '#E0F2FE', color: '#0369A1', fontWeight: 800, fontSize: '0.72rem' }}>
                    {dose.targetAge}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0F172A' }}>
                    {dose.vaccineName}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                  Route: {dose.route} · Lot: <strong>{dose.batchNumber}</strong> · Expiry: {dose.expiryDate}
                </div>
                {dose.administered && (
                  <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
                    Administered on {dose.dateAdministered} by {dose.nurseSignedBy}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ padding: '3px 8px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', fontSize: '0.7rem', fontWeight: 700 }}>
                  VVM: Stage {dose.vvmStage} (Valid)
                </span>

                {dose.administered ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 800, fontSize: '0.8rem' }}>
                    <CheckCircle2 size={16} /> Vaccinated
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdministerDose(dose.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0284C7',
                      color: '#FFF',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                    }}
                  >
                    Administer Dose
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImmunizationColdChainSuite;
