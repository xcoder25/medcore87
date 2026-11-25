'use client';

import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  AlertTriangle,
  ScanLine,
  Upload,
} from 'lucide-react';
import {
  upsertPatient,
  generateHospitalNumber,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import { placeOrder, updateOrderStatus } from '../../lib/clinicalEventBus';
import type { DigitizedPaperRecord, DigitizedRecordKind } from '../../lib/fhirStub';

interface Props {
  facilityId: string;
  facilityName?: string;
  actorName?: string;
  onCommitted?: (summary: {
    patientName: string;
    hospitalNumber: string;
    fhirResourceCount: number;
  }) => void;
}

const SAMPLE_TEMPLATES: Record<DigitizedRecordKind, string> = {
  patient_folder:
    'Patient Name: Iniobong Bassey Ekpo\nFolder No: AKS-OLD-4421\nDOB: 1989-04-16\nSex: Female\nPhone: 08035129044\nLGA: Uyo\nAKSHIA ID: AKSHIA-UYO-77210\nBlood Group: O+\nGenotype: AS\nAllergies: Penicillin\nDiagnosis: Essential Hypertension, Mild Anaemia\nRx: Amlodipine 5mg OD; Ferrous Sulfate 200mg OD',
  handwritten_lab:
    'Patient Name: Ukemeobong Monday Udo\nFolder No: IGH-LAB-109\nSex: Male\nLGA: Eket\nHb: 6.2 g/dL\nWBC: 14.8 x10^9/L\nPlatelets: 42 x10^9/L\nMalaria RDT: Positive (+++)\nCreatinine: 118 umol/L\nDiagnosis: Severe Falciparum Malaria with Thrombocytopenia',
  ultrasound_report:
    'Patient Name: Ekaette Godwin Udoh\nFolder No: OB-2291\nSex: Female\nLGA: Ikot Ekpene\nObstetric Ultrasound Scan Report\nGA: 32 weeks\nFHR: 104 bpm\nPlacenta: Low-lying marginal placenta previa covering internal os\nImpression: Placenta previa with transient fetal bradycardia — urgent OB review advised',
  mixed_chart:
    'Patient Name: Nsikak Akpan Etuk\nFolder No: GEN-883\nDOB: 1974-09-12\nSex: Male\nPhone: 08064412239\nLGA: Oron\nFBS: 19.4 mmol/L\nK+: 5.4 mmol/L\nDiagnosis: Uncontrolled Type 2 Diabetes Mellitus\nRx: Metformin 500mg BD; Lisinopril 10mg OD',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected file'));
    reader.readAsDataURL(file);
  });
}

export const OnboardingFhirDigitizerPanel: React.FC<Props> = ({
  facilityId,
  facilityName = 'Akwa Ibom Health Facility',
  actorName = 'Onboarding Admin',
  onCommitted,
}) => {
  const [recordKind, setRecordKind] = useState<DigitizedRecordKind>('patient_folder');
  const [textFallback, setTextFallback] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    mode: string;
    extraction: DigitizedPaperRecord;
    fhirBundle: Record<string, unknown> & { entry?: unknown[] };
    prescriptionSafety?: { safe?: boolean; alerts?: Array<{ title: string; detail: string; level: string }> } | null;
  } | null>(null);
  const [showFhirJson, setShowFhirJson] = useState(false);
  const [committedList, setCommittedList] = useState<
    Array<{ patientName: string; hospitalNumber: string; resources: number }>
  >([]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError('Scan file must be under 10 MB.');
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setImageBase64(b64);
      setMimeType(file.type || 'image/jpeg');
      setFileName(file.name);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Could not read scan.');
    }
  };

  const runDigitize = async () => {
    if (!imageBase64 && !textFallback.trim()) {
      setError('Upload/capture a paper folder, lab sheet, or ultrasound report — or load a sample template below.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/digitize-fhir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64 || undefined,
          mimeType: mimeType || undefined,
          textFallback: textFallback.trim() || undefined,
          recordKind,
          facilityId,
          sourceLabel: fileName || `Onboarding ${recordKind.replace(/_/g, ' ')}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Digitization failed.');
        return;
      }
      setResult({
        mode: json.mode || 'vision_ocr',
        extraction: json.extraction,
        fhirBundle: json.fhirBundle,
        prescriptionSafety: json.prescriptionSafety || null,
      });
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Network error while digitizing record.');
    } finally {
      setBusy(false);
    }
  };

  const commitToEmr = () => {
    if (!result) return;
    const demo = result.extraction.patientDemographics;
    const hospNo = demo.hospitalNumber || generateHospitalNumber(facilityId);
    const patientId = `pat-onb-${hospNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const fullName = `${demo.firstName || 'Legacy'} ${demo.lastName || 'Patient'}`.trim();

    const patientRecord: FacilityPatient = {
      id: patientId,
      hospitalNumber: hospNo,
      nhiaNumber: demo.nhiaNumber,
      firstName: demo.firstName || 'Legacy',
      lastName: demo.lastName || 'Patient',
      dob: demo.dob || '1990-01-01',
      sex: demo.sex || 'Other',
      phone: demo.phone || '',
      lga: demo.lga || 'Uyo',
      state: 'Akwa Ibom',
      bloodGroup: demo.bloodGroup,
      genotype: demo.genotype,
      allergies: demo.allergies || [],
      chronicConditions: demo.chronicConditions || [],
      currentMedications: result.extraction.medications.map((m) => m.name),
      facilityId,
      facilityName,
      status: 'active',
      registeredAt: new Date().toISOString(),
    };

    upsertPatient(patientRecord);

    if (result.extraction.labObservations.length > 0 || result.extraction.ultrasoundFindings) {
      const summaryParts: string[] = [];
      if (result.extraction.labObservations.length > 0) {
        summaryParts.push(
          `Digitized Labs: ${result.extraction.labObservations
            .map((o) => `${o.testName} ${o.value}${o.unit ? ` ${o.unit}` : ''}${o.flag ? ` [${o.flag.toUpperCase()}]` : ''}`)
            .join('; ')}`
        );
      }
      if (result.extraction.ultrasoundFindings) {
        summaryParts.push(`Ultrasound Impression: ${result.extraction.ultrasoundFindings.impression}`);
      }
      const order = placeOrder({
        facilityId,
        patientId,
        patientName: fullName,
        hospitalNumber: hospNo,
        type: 'procedure',
        code: 'FHIR-OCR-IMPORT',
        name: `Legacy Paper ${result.extraction.recordKind.replace(/_/g, ' ')} Import`,
        priority: result.extraction.panicAlerts.length > 0 ? 'stat' : 'routine',
        orderedBy: actorName,
      });
      updateOrderStatus(order.id, 'resulted', {
        resultSummary: summaryParts.join(' | '),
        resultedBy: actorName,
      });
    }

    const resourceCount = Array.isArray(result.fhirBundle?.entry) ? result.fhirBundle.entry.length : 1;
    setCommittedList((prev) => [{ patientName: fullName, hospitalNumber: hospNo, resources: resourceCount }, ...prev]);
    onCommitted?.({ patientName: fullName, hospitalNumber: hospNo, fhirResourceCount: resourceCount });
  };

  const downloadFhirBundle = () => {
    if (!result?.fhirBundle || typeof window === 'undefined') return;
    const blob = new Blob([JSON.stringify(result.fhirBundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-r4-onboard-${result.extraction.patientDemographics.hospitalNumber || 'record'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 12,
          padding: 14,
          fontSize: '0.8rem',
          color: '#0369A1',
        }}
      >
        <strong>Automated Paper-to-FHIR R4 Onboarding Digitizer</strong>
        <div style={{ marginTop: 4, color: '#0C4A6E', lineHeight: 1.45 }}>
          Scan existing paper patient folders, handwritten laboratory slips, or external ultrasound reports into structured HL7 FHIR R4 Bundles during hospital migration. You can also skip this step and digitize folders anytime later from Records.
        </div>
      </div>

      {/* Record Kind Selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['patient_folder', 'Paper Patient Folder'],
            ['handwritten_lab', 'Handwritten Lab Result'],
            ['ultrasound_report', 'External Ultrasound Report'],
            ['mixed_chart', 'Mixed Clinical Chart'],
          ] as Array<[DigitizedRecordKind, string]>
        ).map(([k, label]) => {
          const active = recordKind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setRecordKind(k)}
              style={{
                padding: '7px 12px',
                borderRadius: 9,
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: active ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
                background: active ? '#E0F2FE' : '#FFFFFF',
                color: active ? '#0369A1' : '#475569',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Scan Upload + Text/OCR Fallback */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div style={{ border: '1px dashed #94A3B8', borderRadius: 12, padding: 14, background: '#F8FAFC' }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0F172A', marginBottom: 8 }}>
            1. Capture Camera Photo or Upload Scan (Image / PDF)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Upload size={14} />
              <span>Upload Scan / PDF</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                background: '#0284C7',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Camera size={14} />
              <span>Camera Scan</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {fileName && (
            <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#047857', fontWeight: 700 }}>
              Attached: {fileName}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, background: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0F172A' }}>
              2. Clerk Notes / Typed Transcript (Optional)
            </span>
            <button
              type="button"
              onClick={() => setTextFallback(SAMPLE_TEMPLATES[recordKind])}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#334155',
              }}
            >
              Load Sample {recordKind.replace(/_/g, ' ')}
            </button>
          </div>
          <textarea
            value={textFallback}
            onChange={(e) => setTextFallback(e.target.value)}
            rows={4}
            placeholder="Optional: paste transcribed paper folder notes, lab figures, or ultrasound impression..."
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: '0.78rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={runDigitize}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: '#059669',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <ScanLine size={16} />
          <span>{busy ? 'Digitizing into HL7 FHIR R4…' : 'Scan & Convert to HL7 FHIR R4'}</span>
        </button>
        {result && (
          <button
            type="button"
            onClick={commitToEmr}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#0F172A',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 size={16} />
            <span>Commit Patient &amp; FHIR Records to EMR</span>
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Structured Digitization Output */}
      {result && (
        <div style={{ border: '1px solid #CBD5E1', borderRadius: 12, padding: 14, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} color="#0284C7" />
              <span>
                {result.extraction.patientDemographics.firstName} {result.extraction.patientDemographics.lastName}
                {result.extraction.patientDemographics.hospitalNumber ? ` · ${result.extraction.patientDemographics.hospitalNumber}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#ECFDF5', color: '#047857' }}>
                FHIR R4 Bundle ({Array.isArray(result.fhirBundle?.entry) ? result.fhirBundle.entry.length : 0} resources)
              </span>
              <button
                type="button"
                onClick={() => setShowFhirJson((v) => !v)}
                style={{ padding: '4px 9px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <FileCode2 size={13} />
                <span>{showFhirJson ? 'Hide FHIR JSON' : 'Inspect FHIR R4 JSON'}</span>
              </button>
              <button
                type="button"
                onClick={downloadFhirBundle}
                style={{ padding: '4px 9px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Download size={13} />
                <span>Export Bundle</span>
              </button>
            </div>
          </div>

          {result.extraction.panicAlerts.length > 0 && (
            <div style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <AlertTriangle size={14} /> Critical Clinical Panic Alerts Detected
              </div>
              {result.extraction.panicAlerts.map((p, idx) => (
                <div key={idx}>• {p}</div>
              ))}
            </div>
          )}

          {result.extraction.labObservations.length > 0 && (
            <div style={{ fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>Extracted Laboratory Observations</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 6 }}>
                {result.extraction.labObservations.map((obs, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: obs.flag === 'critical' ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                      background: obs.flag === 'critical' ? '#FEF2F2' : '#F8FAFC',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{obs.testName}</div>
                    <div style={{ color: obs.flag === 'critical' ? '#B91C1C' : '#0369A1', fontWeight: 800 }}>
                      {obs.value} {obs.unit || ''} {obs.flag ? `(${obs.flag.toUpperCase()})` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.extraction.ultrasoundFindings && (
            <div style={{ fontSize: '0.76rem', background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 3 }}>
                {result.extraction.ultrasoundFindings.modality}
              </div>
              <div style={{ color: '#334155' }}>
                {result.extraction.ultrasoundFindings.impression}
              </div>
            </div>
          )}

          {showFhirJson && (
            <pre
              style={{
                maxHeight: 220,
                overflow: 'auto',
                background: '#0F172A',
                color: '#E2E8F0',
                padding: 12,
                borderRadius: 8,
                fontSize: '0.7rem',
                margin: 0,
              }}
            >
              {JSON.stringify(result.fhirBundle, null, 2)}
            </pre>
          )}
        </div>
      )}

      {committedList.length > 0 && (
        <div style={{ padding: 10, borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: '0.76rem', color: '#065F46' }}>
          <strong>Committed During Facility Onboarding ({committedList.length}):</strong>{' '}
          {committedList.map((c) => `${c.patientName} (${c.hospitalNumber}, ${c.resources} FHIR resources)`).join(' · ')}
        </div>
      )}
    </div>
  );
};
