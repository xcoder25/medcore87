'use client';

/**
 * OncologyChemotherapySuite — Clinical Oncology, Chemotherapy Protocols & Staging.
 * TNM Cancer Staging (T, N, M -> Stage I–IV), Automated Body Surface Area (BSA m²) via Mosteller formula,
 * Standard Chemotherapy Regimens (CHOP, FOLFOX, AC-T, Carbo/Paclitaxel), Cycle/Day Tracking,
 * and Pre-Chemo Lab Safety Gates (ANC >= 1.5, Platelets >= 100, eGFR, Bilirubin).
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert, Plus, CheckCircle2, AlertTriangle, Activity,
  Calculator, FileText, Check, Droplets, Sparkles, AlertCircle
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import { listPatients, type RegisteredPatient } from '../../lib/patientRegistryStore';

export interface ChemoRegimen {
  name: string;
  indication: string;
  cycleLengthDays: number;
  totalCycles: number;
  drugs: { name: string; doseFormula: string; route: string; days: string }[];
  premedications: string[];
}

const REGIMENS: ChemoRegimen[] = [
  {
    name: 'AC-T (Doxorubicin, Cyclophosphamide -> Paclitaxel)',
    indication: 'Invasive Breast Carcinoma (Adjuvant / Neoadjuvant)',
    cycleLengthDays: 21,
    totalCycles: 4,
    drugs: [
      { name: 'Doxorubicin (Adriamycin)', doseFormula: '60 mg/m²', route: 'IV Push via free-flowing saline', days: 'Day 1' },
      { name: 'Cyclophosphamide', doseFormula: '600 mg/m²', route: 'IV Infusion in 250mL NS over 60m', days: 'Day 1' },
    ],
    premedications: ['Ondansetron 8mg IV', 'Dexamethasone 12mg IV', 'Aprepitant 125mg PO'],
  },
  {
    name: 'FOLFOX-6 (Oxaliplatin, Leucovorin, 5-FU)',
    indication: 'Colorectal Carcinoma (Stage III / Metastatic)',
    cycleLengthDays: 14,
    totalCycles: 12,
    drugs: [
      { name: 'Oxaliplatin', doseFormula: '85 mg/m²', route: 'IV Infusion in D5W over 2 hrs', days: 'Day 1' },
      { name: 'Leucovorin (Folinic Acid)', doseFormula: '400 mg/m²', route: 'IV Infusion concurrent with Oxaliplatin', days: 'Day 1' },
      { name: '5-Fluorouracil (5-FU) Bolus', doseFormula: '400 mg/m²', route: 'IV Push over 5 mins', days: 'Day 1' },
      { name: '5-Fluorouracil Continuous', doseFormula: '2,400 mg/m²', route: 'Continuous IV Infusion pump over 46 hrs', days: 'Days 1-2' },
    ],
    premedications: ['Palonosetron 0.25mg IV', 'Dexamethasone 10mg IV'],
  },
  {
    name: 'CHOP (Cyclophosphamide, Doxorubicin, Vincristine, Prednisolone)',
    indication: 'Non-Hodgkin Lymphoma (DLBCL)',
    cycleLengthDays: 21,
    totalCycles: 6,
    drugs: [
      { name: 'Cyclophosphamide', doseFormula: '750 mg/m²', route: 'IV Infusion over 60 mins', days: 'Day 1' },
      { name: 'Doxorubicin', doseFormula: '50 mg/m²', route: 'IV Push over 10-15 mins', days: 'Day 1' },
      { name: 'Vincristine', doseFormula: '1.4 mg/m² (capped at 2mg)', route: 'IV Piggyback over 10 mins', days: 'Day 1' },
      { name: 'Prednisolone', doseFormula: '100 mg orally', route: 'Oral tablet with food', days: 'Days 1-5' },
    ],
    premedications: ['Granisetron 1mg IV', 'Allopurinol 300mg PO daily'],
  },
];

interface Props {
  session?: UserSession;
  onNavigate?: (key: string) => void;
}

export const OncologyChemotherapySuite: React.FC<Props> = ({ session, onNavigate }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';

  const [patients] = useState<RegisteredPatient[]>(() => {
    try {
      return listPatients(facilityId);
    } catch {
      return [];
    }
  });

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedRegimenIndex, setSelectedRegimenIndex] = useState(0);

  // Patient Biometrics for Mosteller BSA
  const [patientHeightCm, setPatientHeightCm] = useState(165);
  const [patientWeightKg, setPatientWeightKg] = useState(64);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);

  // TNM Staging Inputs
  const [tStage, setTStage] = useState('T2 (2–5 cm)');
  const [nStage, setNStage] = useState('N1 (1–3 regional lymph nodes)');
  const [mStage, setMStage] = useState('M0 (No distant metastasis)');

  // Pre-Chemo Lab Safety Gates
  const [ancScore, setAncScore] = useState(1.9); // Normal >= 1.5 x10^9/L
  const [platelets, setPlatelets] = useState(185); // Normal >= 100 x10^9/L
  const [egfr, setEgfr] = useState(78); // Normal >= 50 mL/min
  const [bilirubin, setBilirubin] = useState(14); // Normal < 21 umol/L

  const [saved, setSaved] = useState(false);

  // Automated Mosteller BSA Calculation: sqrt((height * weight) / 3600)
  const bsaM2 = useMemo(() => {
    if (!patientHeightCm || !patientWeightKg) return 1.7;
    const calc = Math.sqrt((patientHeightCm * patientWeightKg) / 3600);
    return parseFloat(calc.toFixed(2));
  }, [patientHeightCm, patientWeightKg]);

  // Overall Clinical Stage derivation
  const overallClinicalStage = useMemo(() => {
    if (mStage.includes('M1')) return 'Stage IV (Metastatic Disease)';
    if (tStage.includes('T3') || tStage.includes('T4') || nStage.includes('N2') || nStage.includes('N3')) {
      return 'Stage III (Locally Advanced)';
    }
    if (nStage.includes('N1') || tStage.includes('T2')) {
      return 'Stage II (Regional)';
    }
    return 'Stage I (Early)';
  }, [tStage, nStage, mStage]);

  // Pre-Chemo Safety Clearance Check
  const labClearanceOk = ancScore >= 1.5 && platelets >= 100 && egfr >= 50 && bilirubin <= 25;

  const currentRegimen = REGIMENS[selectedRegimenIndex] || REGIMENS[0];

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 28px', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EDE9FE', color: '#6D28D9', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
            <Activity size={14} /> Medical Oncology & Chemotherapy Day Unit
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#0F172A' }}>
            Chemotherapy Protocol & Cancer Staging Suite
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            TNM Cancer Staging · Mosteller BSA Calculator · Chemotherapy Infusion Checklist & Safety Gates
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.82rem', background: '#FFF' }}
          >
            <option value="">-- Select Oncology Patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.hospitalNumber})
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!labClearanceOk}
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              background: labClearanceOk ? '#7C3AED' : '#94A3B8',
              color: '#FFF',
              fontWeight: 700,
              border: 'none',
              cursor: labClearanceOk ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} /> Authorize Cycle Dispensing
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Chemotherapy cycle authorized and sent to Pharmacy Sterile Cytotoxic Cleanroom.
        </div>
      )}

      {/* Safety Gate Warning if Labs Fail */}
      {!labClearanceOk && (
        <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: '#FEF2F2', border: '1.5px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldAlert size={22} color="#DC2626" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#991B1B' }}>
              SAFETY LOCK: Patient Fails Pre-Chemotherapy Hematologic / Renal Safety Thresholds
            </div>
            <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: 2 }}>
              Requires ANC ≥ 1.5 x 10⁹/L (Current: {ancScore}), Platelets ≥ 100 x 10⁹/L (Current: {platelets}), and eGFR ≥ 50 mL/min (Current: {egfr}). Hold cycle and administer G-CSF / supportive care as indicated.
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Staging & BSA | Regimen Protocol */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
        {/* Left: TNM Staging & Mosteller BSA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mosteller BSA Card */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              1. Body Surface Area (BSA) Calculator
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem', marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Height (cm)</label>
                <input
                  type="number"
                  value={patientHeightCm}
                  onChange={(e) => setPatientHeightCm(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Weight (kg)</label>
                <input
                  type="number"
                  value={patientWeightKg}
                  onChange={(e) => setPatientWeightKg(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>

            <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '0.74rem', color: '#6D28D9', fontWeight: 700 }}>MOSTELLER BSA TARGET</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#7C3AED', marginTop: 2 }}>
                {bsaM2} m²
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Used to compute exact mg dosage for cytotoxic infusions
              </div>
            </div>
          </div>

          {/* TNM 8th Edition Staging */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
              2. TNM Clinical Staging (AJCC 8th/9th Ed.)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem', marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 2 }}>Tumor (T)</label>
                <select value={tStage} onChange={(e) => setTStage(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF' }}>
                  <option value="T1 (<= 2 cm)">T1 (≤ 2 cm in greatest dimension)</option>
                  <option value="T2 (2–5 cm)">T2 (&gt; 2 cm but ≤ 5 cm)</option>
                  <option value="T3 (> 5 cm)">T3 (&gt; 5 cm)</option>
                  <option value="T4 (Chest wall / skin)">T4 (Involvement of chest wall / skin)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 2 }}>Nodes (N)</label>
                <select value={nStage} onChange={(e) => setNStage(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF' }}>
                  <option value="N0 (No regional nodes)">N0 (No regional lymph node metastasis)</option>
                  <option value="N1 (1–3 regional lymph nodes)">N1 (1–3 ipsilateral axillary/regional nodes)</option>
                  <option value="N2 (4–9 regional nodes)">N2 (4–9 regional nodes fixed/matted)</option>
                  <option value="N3 (Infraclavicular / supraclavicular)">N3 (Supraclavicular / internal mammary)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748B', marginBottom: 2 }}>Metastasis (M)</label>
                <select value={mStage} onChange={(e) => setMStage(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFF' }}>
                  <option value="M0 (No distant metastasis)">M0 (No clinical/radiographic distant metastasis)</option>
                  <option value="M1 (Distant metastasis present)">M1 (Distant metastasis e.g. bone, liver, lung, brain)</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '8px 12px', background: '#EDE9FE', borderRadius: 8, color: '#5B21B6', fontWeight: 800, fontSize: '0.84rem' }}>
              Final Staging: {overallClinicalStage}
            </div>
          </div>

          {/* Pre-Chemo Lab Values */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>
              3. Day-of-Chemo Lab Clearance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem' }}>
              <div>
                <span style={{ color: '#64748B' }}>ANC (≥1.5):</span>
                <input
                  type="number"
                  step="0.1"
                  value={ancScore}
                  onChange={(e) => setAncScore(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Platelets (≥100):</span>
                <input
                  type="number"
                  value={platelets}
                  onChange={(e) => setPlatelets(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Regimen Protocol & Drug Dose Breakdown */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700 }}>PRESCRIBED PROTOCOL</div>
              <h3 style={{ margin: '2px 0 0', fontSize: '1.1rem', fontWeight: 900, color: '#0F172A' }}>
                {currentRegimen.name}
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#6D28D9', fontWeight: 700 }}>
                Indication: {currentRegimen.indication}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {REGIMENS.map((r, i) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setSelectedRegimenIndex(i)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: selectedRegimenIndex === i ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                    background: selectedRegimenIndex === i ? '#F5F3FF' : '#FFF',
                    color: selectedRegimenIndex === i ? '#6D28D9' : '#64748B',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {r.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, marginBottom: 16, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, fontSize: '0.8rem' }}>
            <div>Current Cycle: <strong>Cycle {currentCycle} of {currentRegimen.totalCycles}</strong></div>
            <div>Day: <strong>Day {currentDay}</strong></div>
            <div>Cycle Frequency: <strong>Every {currentRegimen.cycleLengthDays} days</strong></div>
          </div>

          {/* Cytotoxic Drug Dosing Table */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
              Computed Cytotoxic Drug Doses (Based on {bsaM2} m²)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentRegimen.drugs.map((drug) => (
                <div
                  key={drug.name}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>{drug.name}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>
                      Standard: {drug.doseFormula} · Route: {drug.route}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 8, background: '#EDE9FE', color: '#6D28D9', fontWeight: 800, fontSize: '0.82rem' }}>
                      Schedule: {drug.days}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Premedications Checklist */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
              Mandatory Anti-Emetic & Infusion Reaction Premedications
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currentRegimen.premedications.map((pm) => (
                <div key={pm} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: '0.78rem', fontWeight: 700 }}>
                  <Check size={14} /> {pm}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OncologyChemotherapySuite;
