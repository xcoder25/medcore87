'use client';

import React, { useState } from 'react';
import {
  Camera,
  FileUp,
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  ClipboardPlus,
  FlaskConical,
} from 'lucide-react';
import type {
  ClinicalVisionDocumentType,
  VisionClinicalExtraction,
} from '../../app/api/ai/vision-clinical/route';
import { getPatient } from '../../lib/patientRegistryStore';
import { placeOrder, updateOrderStatus } from '../../lib/clinicalEventBus';
import { evaluateResultForCritical } from '../../lib/clinicalIntelligenceEngine';
import { appendAudit } from '../../lib/auditLogStore';

interface Props {
  open: boolean;
  facilityId: string;
  patientId?: string;
  patientName?: string;
  hospitalNumber?: string;
  doctorName?: string;
  doctorBadge?: string;
  onClose: () => void;
  onInsertToChart: (formattedSummary: string) => void;
}

export const ClinicalVisionScannerModal: React.FC<Props> = ({
  open,
  facilityId,
  patientId,
  patientName,
  hospitalNumber,
  doctorName,
  doctorBadge,
  onClose,
  onInsertToChart,
}) => {
  const [docType, setDocType] = useState<ClinicalVisionDocumentType>('lab_report');
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [textFallback, setTextFallback] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<VisionClinicalExtraction | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewDataUrl(String(reader.result || ''));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const runScan = async () => {
    if (!previewDataUrl && !textFallback.trim()) {
      setError('Upload or capture a document photo/PDF, or paste document text below.');
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const pt = patientId ? getPatient(patientId) : undefined;
      const res = await fetch('/api/ai/vision-clinical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: previewDataUrl || undefined,
          mimeType,
          textFallback: textFallback.trim() || undefined,
          documentType: docType,
          patientContext: pt
            ? {
                allergies: pt.allergies,
                otherDrugs: pt.currentMedications,
                dob: pt.dob,
                sex: pt.sex,
                chronicConditions: pt.chronicConditions,
                genotype: pt.genotype,
              }
            : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        extraction?: VisionClinicalExtraction;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.extraction) {
        setError(json.error || 'Could not extract structured findings.');
        return;
      }
      setExtraction(json.extraction);
    } catch (err) {
      setError((err as Error)?.message || 'Vision scan failed');
    } finally {
      setBusy(false);
    }
  };

  const insertFindingsIntoSoap = () => {
    if (!extraction) return;
    const lines: string[] = [
      `[${extraction.documentType.replace(/_/g, ' ').toUpperCase()} SCAN]: ${extraction.documentSummary}`,
    ];
    if (extraction.extractedLabValues.length > 0) {
      lines.push(
        'Labs: ' +
          extraction.extractedLabValues
            .map((l) => `${l.testName}: ${l.value} ${l.unit} (${l.flag})`)
            .join('; ')
      );
    }
    if (extraction.extractedMedications.length > 0) {
      lines.push(
        'Meds noted: ' +
          extraction.extractedMedications.map((m) => `${m.name} ${m.dosage}`).join('; ')
      );
    }
    if (extraction.extractedDiagnoses.length > 0) {
      lines.push(`Diagnoses mentioned: ${extraction.extractedDiagnoses.join(', ')}`);
    }
    onInsertToChart(lines.join('\n'));
    setStatusMsg('Inserted findings into consultation note.');
  };

  const logLabsToChart = () => {
    if (!extraction || !extraction.extractedLabValues.length || !patientId) {
      setStatusMsg('Select an active patient with extracted lab values first.');
      return;
    }
    const summaryText = extraction.extractedLabValues
      .map((l) => `${l.testName} ${l.value} ${l.unit} [${l.flag}]`)
      .join(' · ');
    const order = placeOrder({
      facilityId,
      patientId,
      patientName: patientName || 'Active Patient',
      hospitalNumber: hospitalNumber || patientId,
      type: 'procedure',
      code: 'EXT-LAB-SCAN',
      name: 'External Lab Scan Import',
      orderedBy: doctorName || 'Clinician',
      orderedByBadge: doctorBadge,
      priority: extraction.panicFlags.length > 0 ? 'stat' : 'routine',
      notes: 'Imported & verified from external paper lab printout',
    });
    const updated = updateOrderStatus(order.id, 'resulted', {
      resultSummary: summaryText,
      resultedBy: doctorName || 'Clinician Verified',
    });
    if (updated) {
      evaluateResultForCritical(updated);
    }
    appendAudit({
      facilityId,
      actor: doctorName || 'Clinician',
      actorBadge: doctorBadge,
      action: 'external_lab_vision_import',
      entity: 'order',
      entityId: order.id,
      detail: `Imported ${extraction.extractedLabValues.length} external lab values (${summaryText.slice(0, 120)})`,
    });
    setStatusMsg('External lab results recorded into patient chart & safety radar.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clinical Document Vision Scanner"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 740,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: 18,
          border: '1px solid #E2E8F0',
          padding: 20,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>
              Clinical Vision Scanner (External Labs, Referrals, Scripts &amp; ECG)
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {patientName ? `${patientName} (${hospitalNumber || patientId}) · ` : ''}
              Extracts structured results and cross-checks Drug Safety Guard automatically
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: '#F1F5F9', borderRadius: 8, padding: 6, cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { id: 'lab_report', label: 'Paper Lab Printout' },
            { id: 'referral_letter', label: 'Referral Letter' },
            { id: 'prescription', label: 'Outside Prescription' },
            { id: 'ecg_radiology', label: 'ECG / Radiology' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDocType(t.id as ClinicalVisionDocumentType)}
              style={{
                padding: '6px 12px',
                borderRadius: 9,
                border: docType === t.id ? '1px solid #0284C7' : '1px solid #E2E8F0',
                background: docType === t.id ? '#EFF6FF' : '#FFFFFF',
                color: docType === t.id ? '#0369A1' : '#475569',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 10,
              background: '#0F172A',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Camera size={14} /> Snap Photo
            <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 10,
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              color: '#0F172A',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileUp size={14} /> Upload Image / PDF
            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runScan()}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(90deg, #0284C7, #7C3AED)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 12,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? <Loader2 size={14} /> : <FlaskConical size={14} />}
            {busy ? 'Analyzing Document…' : 'Analyze Document'}
          </button>
        </div>

        <textarea
          rows={3}
          value={textFallback}
          onChange={(e) => setTextFallback(e.target.value)}
          placeholder="Optional OCR hint or paste external lab/referral text directly (also works offline)…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 10,
            border: '1px solid #CBD5E1',
            fontSize: 12.5,
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <div style={{ padding: 10, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {statusMsg && (
          <div style={{ padding: 10, borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            ✓ {statusMsg}
          </div>
        )}

        {extraction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{extraction.documentSummary}</div>

            {extraction.panicFlags.length > 0 && (
              <div style={{ padding: 10, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12, fontWeight: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} /> Panic Lab Values Detected
                </div>
                {extraction.panicFlags.map((pf, i) => (
                  <div key={i}>• {pf}</div>
                ))}
              </div>
            )}

            {extraction.extractedLabValues.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Extracted Lab Results
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {extraction.extractedLabValues.map((l, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11.5,
                        padding: '4px 9px',
                        borderRadius: 8,
                        background: l.flag === 'CRITICAL' ? '#FEE2E2' : l.flag === 'ABNORMAL' ? '#FEF3C7' : '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: l.flag === 'CRITICAL' ? '#991B1B' : '#0F172A',
                        fontWeight: 700,
                      }}
                    >
                      {l.testName}: {l.value} {l.unit} ({l.flag})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {extraction.extractedMedications.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  Extracted Medications (Safety Guard Checked)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {extraction.extractedMedications.map((m, i) => {
                    const hs = (m.safetyReport?.hardStopCount || 0) > 0;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: hs ? '#FEF2F2' : '#FFFFFF',
                          border: `1px solid ${hs ? '#FECACA' : '#CBD5E1'}`,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>{m.name} · {m.dosage}</span>
                          {hs ? (
                            <span style={{ color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <ShieldAlert size={13} /> HARD STOP
                            </span>
                          ) : (
                            <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Checked
                            </span>
                          )}
                        </div>
                        {m.safetyReport?.alerts.filter((a) => a.level !== 'info')[0] && (
                          <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>
                            {m.safetyReport.alerts.filter((a) => a.level !== 'info')[0].title}:{' '}
                            {m.safetyReport.alerts.filter((a) => a.level !== 'info')[0].detail}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>
              {extraction.clinicianDisclaimer}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={insertFindingsIntoSoap}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#0284C7',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ClipboardPlus size={14} /> Insert into SOAP Note
              </button>
              {extraction.extractedLabValues.length > 0 && patientId && (
                <button
                  type="button"
                  onClick={logLabsToChart}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    border: '1px solid #059669',
                    background: '#ECFDF5',
                    color: '#065F46',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Log Extracted Labs to Chart
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicalVisionScannerModal;
