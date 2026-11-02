'use client';

import React, { useState } from 'react';
import {
  Eye, Save, Printer, CheckCircle2, RotateCcw,
  Sparkles, Glasses, FileText, ChevronRight
} from 'lucide-react';

export interface VisualAcuityReading {
  distanceUnaided: string;
  distanceWithGlasses: string;
  distancePinhole: string;
  near: string;
  iopMmHg: string;
  iopMethod: 'Goldmann' | 'Tonopen' | 'Non-contact Air' | 'Schiotz';
}

export interface EyeExamRecord {
  id: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  date: string;
  examiner: string;
  complaint: string;
  od: VisualAcuityReading; // Right Eye
  os: VisualAcuityReading; // Left Eye
  ou: { distance: string; near: string }; // Both Eyes
  anteriorOd: { lids: string; cornea: string; ac: string; iris: string; lens: string };
  anteriorOs: { lids: string; cornea: string; ac: string; iris: string; lens: string };
  fundusOd: { cdRatio: string; disc: string; macula: string; retina: string };
  fundusOs: { cdRatio: string; disc: string; macula: string; retina: string };
  diagnosis: string;
  refraction?: {
    odSphere: string; odCyl: string; odAxis: string; odAdd: string;
    osSphere: string; osCyl: string; osAxis: string; osAdd: string;
  };
  managementPlan: string;
  followUpWeeks?: number;
}

const SNELLEN_OPTIONS = [
  '6/6 (20/20) - Normal',
  '6/9 (20/30)',
  '6/12 (20/40)',
  '6/18 (20/60)',
  '6/24 (20/80)',
  '6/36 (20/120)',
  '6/60 (20/200)',
  '3/60 (Counting Fingers @ 3m)',
  '1/60 (Counting Fingers @ 1m)',
  'Hand Motion (HM)',
  'Light Perception (LP)',
  'No Light Perception (NLP)',
];

const NEAR_OPTIONS = ['N5 (Normal)', 'N6', 'N8', 'N10', 'N12', 'N18', 'N24', 'N36'];

const COMMON_DIAGNOSES = [
  'Refractive Error (Myopia / Hyperopia / Astigmatism)',
  'Presbyopia',
  'Senile / Traumatic Cataract',
  'Primary Open-Angle Glaucoma (POAG)',
  'Acute Angle-Closure Glaucoma',
  'Allergic / Vernal Keratoconjunctivitis',
  'Bacterial / Viral Conjunctivitis ("Apollo")',
  'Diabetic Retinopathy',
  'Hypertensive Retinopathy',
  'Pterygium / Pinguecula',
  'Corneal Abrasion / Ulcer',
];

interface Props {
  facilityId: string;
  patient?: { id: string; name?: string; firstName?: string; lastName?: string; hospitalNumber?: string } | null;
  examinerName?: string;
  onSave?: (exam: EyeExamRecord) => void;
}

export const OphthalmologySuite: React.FC<Props> = ({
  facilityId,
  patient,
  examinerName = 'Dr. Eye Specialist',
  onSave,
}) => {
  const patientDisplayName = patient
    ? (patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.hospitalNumber || 'Selected Patient')
    : 'Walk-in Eye Clinic Patient';

  const [activeTab, setActiveTab] = useState<'acuity' | 'anterior' | 'fundus' | 'refraction' | 'plan'>('acuity');
  const [complaint, setComplaint] = useState('Blurring of distant vision, bilateral eye itching and glare at night.');
  
  // Right Eye (OD)
  const [odDistance, setOdDistance] = useState('6/12 (20/40)');
  const [odPinhole, setOdPinhole] = useState('6/6 (20/20) - Normal');
  const [odWithGlasses, setOdWithGlasses] = useState('6/9 (20/30)');
  const [odNear, setOdNear] = useState('N6');
  const [odIop, setOdIop] = useState('15');
  const [odIopMethod, setOdIopMethod] = useState<'Goldmann' | 'Tonopen' | 'Non-contact Air' | 'Schiotz'>('Goldmann');

  // Left Eye (OS)
  const [osDistance, setOsDistance] = useState('6/18 (20/60)');
  const [osPinhole, setOsPinhole] = useState('6/9 (20/30)');
  const [osWithGlasses, setOsWithGlasses] = useState('6/12 (20/40)');
  const [osNear, setOsNear] = useState('N8');
  const [osIop, setOsIop] = useState('16');
  const [osIopMethod, setOsIopMethod] = useState<'Goldmann' | 'Tonopen' | 'Non-contact Air' | 'Schiotz'>('Goldmann');

  // Slit Lamp / Anterior
  const [corneaOd, setCorneaOd] = useState('Clear, smooth, no infiltrates');
  const [corneaOs, setCorneaOs] = useState('Clear, smooth, no infiltrates');
  const [lensOd, setLensOd] = useState('Clear, no nuclear sclerosis');
  const [lensOs, setLensOs] = useState('Early cortical lens opacities (Grade 1)');
  const [acDepth, setAcDepth] = useState('Deep and quiet, Van Herick Grade 4');

  // Fundus / Posterior
  const [cdRatioOd, setCdRatioOd] = useState('0.3 (Normal)');
  const [cdRatioOs, setCdRatioOs] = useState('0.4 (Physiological cup)');
  const [maculaSummary, setMaculaSummary] = useState('Normal foveal reflex bilaterally, no edema or drusen');
  const [retinaSummary, setRetinaSummary] = useState('Retina flat 360 degrees, normal A:V ratio 2:3');

  // Refraction / Glasses
  const [odSph, setOdSph] = useState('-1.25');
  const [odCyl, setOdCyl] = useState('-0.50');
  const [odAxis, setOdAxis] = useState('90');
  const [odAdd, setOdAdd] = useState('+1.75');
  const [osSph, setOsSph] = useState('-1.75');
  const [osCyl, setOsCyl] = useState('-0.75');
  const [osAxis, setOsAxis] = useState('85');
  const [osAdd, setOsAdd] = useState('+1.75');

  // Diagnosis & Plan
  const [diagnosis, setDiagnosis] = useState('Simple Myopic Astigmatism with Early Presbyopia (Bilateral)');
  const [managementPlan, setManagementPlan] = useState('1. Prescribed progressive bifocal lenses with anti-reflective coating.\n2. Preserved artificial tears (Olopatadine + Carboxymethylcellulose) twice daily PRN.\n3. Annual glaucoma review with visual fields.');
  const [followUpWeeks, setFollowUpWeeks] = useState(52);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveExam = () => {
    const exam: EyeExamRecord = {
      id: `EYE-${Date.now()}`,
      patientId: patient?.id || 'WALK-IN',
      patientName: patientDisplayName,
      facilityId,
      date: new Date().toISOString(),
      examiner: examinerName,
      complaint,
      od: {
        distanceUnaided: odDistance,
        distanceWithGlasses: odWithGlasses,
        distancePinhole: odPinhole,
        near: odNear,
        iopMmHg: odIop,
        iopMethod: odIopMethod,
      },
      os: {
        distanceUnaided: osDistance,
        distanceWithGlasses: osWithGlasses,
        distancePinhole: osPinhole,
        near: osNear,
        iopMmHg: osIop,
        iopMethod: osIopMethod,
      },
      ou: {
        distance: odDistance.split(' ')[0] + ' / ' + osDistance.split(' ')[0],
        near: odNear,
      },
      anteriorOd: { lids: 'Normal', cornea: corneaOd, ac: acDepth, iris: 'Reactive', lens: lensOd },
      anteriorOs: { lids: 'Normal', cornea: corneaOs, ac: acDepth, iris: 'Reactive', lens: lensOs },
      fundusOd: { cdRatio: cdRatioOd, disc: 'Pink, well-demarcated', macula: maculaSummary, retina: retinaSummary },
      fundusOs: { cdRatio: cdRatioOs, disc: 'Pink, well-demarcated', macula: maculaSummary, retina: retinaSummary },
      diagnosis,
      refraction: {
        odSphere: odSph, odCyl: odCyl, odAxis: odAxis, odAdd: odAdd,
        osSphere: osSph, osCyl: osCyl, osAxis: osAxis, osAdd: osAdd,
      },
      managementPlan,
      followUpWeeks,
    };

    onSave?.(exam);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Eye size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
              Ophthalmology & Visual Acuity Specialty Suite
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span>Patient: <strong style={{ color: '#0F172A' }}>{patientDisplayName}</strong></span>
              <span>•</span>
              <span>Examiner: {examinerName}</span>
              <span>•</span>
              <span style={{ color: '#0284C7', fontWeight: 600 }}>{facilityId}</span>
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
            onClick={handleSaveExam}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg, #0284C7 0%, #00BFA5 100%)', color: '#0A2540', fontSize: '0.84rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 10px rgba(2,132,199,0.25)' }}
          >
            <Save size={15} /> Save Consultation
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: '0.84rem', marginBottom: 16 }}>
          <CheckCircle2 size={18} color="#16A34A" />
          <span>Eye examination and refraction saved successfully to patient master record.</span>
        </div>
      )}

      {/* Specialty Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #F1F5F9', paddingBottom: 12, marginBottom: 18, overflowX: 'auto' }}>
        {[
          { id: 'acuity', label: '1. Visual Acuity & IOP (Tonometry)' },
          { id: 'anterior', label: '2. Slit Lamp & Anterior Segment' },
          { id: 'fundus', label: '3. Posterior & Fundoscopy Grid' },
          { id: 'refraction', label: '4. Refraction & Optical Prescription' },
          { id: 'plan', label: '5. Diagnosis & Treatment Plan' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === t.id ? '#0284C7' : '#F8FAFC',
              color: activeTab === t.id ? '#FFFFFF' : '#475569',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: VISUAL ACUITY & TONOMETRY */}
      {activeTab === 'acuity' && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Ophthalmic Chief Complaint & History
            </label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* RIGHT EYE (OD) */}
            <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0369A1' }}>OD (Oculus Dexter / Right Eye)</span>
                <span style={{ fontSize: '0.72rem', background: '#E0F2FE', color: '#0369A1', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Right</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Distance Unaided (Snellen):</label>
                  <select value={odDistance} onChange={(e) => setOdDistance(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    {SNELLEN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Pinhole Acuity (PH):</label>
                  <select value={odPinhole} onChange={(e) => setOdPinhole(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    {SNELLEN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Near Acuity:</label>
                  <select value={odNear} onChange={(e) => setOdNear(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    {NEAR_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>IOP (mmHg):</label>
                    <input type="number" value={odIop} onChange={(e) => setOdIop(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Method:</label>
                    <select value={odIopMethod} onChange={(e) => setOdIopMethod(e.target.value as any)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                      <option value="Goldmann">Goldmann (Applanation)</option>
                      <option value="Tonopen">Tonopen</option>
                      <option value="Non-contact Air">Non-contact (Air puff)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* LEFT EYE (OS) */}
            <div style={{ padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0D9488' }}>OS (Oculus Sinister / Left Eye)</span>
                <span style={{ fontSize: '0.72rem', background: '#CCFBF1', color: '#0F766E', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Left</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Distance Unaided (Snellen):</label>
                  <select value={osDistance} onChange={(e) => setOsDistance(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    {SNELLEN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Pinhole Acuity (PH):</label>
                  <select value={osPinhole} onChange={(e) => setOsPinhole(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    {SNELLEN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Near Acuity:</label>
                  <select value={osNear} onChange={(e) => setOsNear(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    {NEAR_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>IOP (mmHg):</label>
                    <input type="number" value={osIop} onChange={(e) => setOsIop(e.target.value)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Method:</label>
                    <select value={osIopMethod} onChange={(e) => setOsIopMethod(e.target.value as any)} style={{ width: '100%', marginTop: 2, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                      <option value="Goldmann">Goldmann (Applanation)</option>
                      <option value="Tonopen">Tonopen</option>
                      <option value="Non-contact Air">Non-contact (Air puff)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SLIT LAMP & ANTERIOR SEGMENT */}
      {activeTab === 'anterior' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#0369A1' }}>OD (Right Eye) Anterior Findings</h4>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Cornea:</label>
              <input value={corneaOd} onChange={(e) => setCorneaOd(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Crystalline Lens / Cataract grading:</label>
              <input value={lensOd} onChange={(e) => setLensOd(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#0D9488' }}>OS (Left Eye) Anterior Findings</h4>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Cornea:</label>
              <input value={corneaOs} onChange={(e) => setCorneaOs(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Crystalline Lens / Cataract grading:</label>
              <input value={lensOs} onChange={(e) => setLensOs(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Anterior Chamber Depth (Van Herick angle estimate):</label>
            <input value={acDepth} onChange={(e) => setAcDepth(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
          </div>
        </div>
      )}

      {/* TAB 3: POSTERIOR & FUNDUSCOPY */}
      {activeTab === 'fundus' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#0369A1' }}>OD Optic Disc & Cup:</h4>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Cup-to-Disc (C:D) Ratio:</label>
              <input value={cdRatioOd} onChange={(e) => setCdRatioOd(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#0D9488' }}>OS Optic Disc & Cup:</h4>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Cup-to-Disc (C:D) Ratio:</label>
              <input value={cdRatioOs} onChange={(e) => setCdRatioOs(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Macula & Fovea discovery:</label>
            <input value={maculaSummary} onChange={(e) => setMaculaSummary(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569' }}>Peripheral Retina & Vasculature:</label>
            <input value={retinaSummary} onChange={(e) => setRetinaSummary(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.82rem' }} />
          </div>
        </div>
      )}

      {/* TAB 4: REFRACTION & GLASSES PRESCRIPTION */}
      {activeTab === 'refraction' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Glasses size={20} color="#0284C7" />
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>Subjective Manifest Refraction & Spectacle Rx</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'center', color: '#334155' }}>
                <th style={{ padding: 8, border: '1px solid #CBD5E1' }}>Eye</th>
                <th style={{ padding: 8, border: '1px solid #CBD5E1' }}>Sphere (DS)</th>
                <th style={{ padding: 8, border: '1px solid #CBD5E1' }}>Cylinder (DC)</th>
                <th style={{ padding: 8, border: '1px solid #CBD5E1' }}>Axis (°)</th>
                <th style={{ padding: 8, border: '1px solid #CBD5E1' }}>Near Add</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, border: '1px solid #CBD5E1', fontWeight: 800, color: '#0369A1', textAlign: 'center' }}>OD (Right)</td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={odSph} onChange={(e) => setOdSph(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={odCyl} onChange={(e) => setOdCyl(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={odAxis} onChange={(e) => setOdAxis(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={odAdd} onChange={(e) => setOdAdd(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
              </tr>
              <tr>
                <td style={{ padding: 8, border: '1px solid #CBD5E1', fontWeight: 800, color: '#0D9488', textAlign: 'center' }}>OS (Left)</td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={osSph} onChange={(e) => setOsSph(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={osCyl} onChange={(e) => setOsCyl(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={osAxis} onChange={(e) => setOsAxis(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
                <td style={{ padding: 4, border: '1px solid #CBD5E1' }}><input value={osAdd} onChange={(e) => setOsAdd(e.target.value)} style={{ width: '100%', textAlign: 'center', border: 'none' }} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: DIAGNOSIS & MANAGEMENT */}
      {activeTab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Ophthalmic Clinical Diagnosis:
            </label>
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {COMMON_DIAGNOSES.slice(0, 5).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiagnosis(d)}
                  style={{ border: '1px solid #BAE6FD', background: '#F0F9FF', color: '#0369A1', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}
                >
                  + {d.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Treatment & Management Plan:
            </label>
            <textarea
              value={managementPlan}
              onChange={(e) => setManagementPlan(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>Recommended Follow-up:</span>
            <select
              value={followUpWeeks}
              onChange={(e) => setFollowUpWeeks(Number(e.target.value))}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
            >
              <option value={1}>1 week (Acute/Ulcer)</option>
              <option value={4}>4 weeks (Post-op/Glaucoma)</option>
              <option value={12}>3 months</option>
              <option value={26}>6 months</option>
              <option value={52}>1 year (Routine Refraction)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
export default OphthalmologySuite;

