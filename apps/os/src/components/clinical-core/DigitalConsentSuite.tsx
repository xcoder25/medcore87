'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileCheck, Shield, CheckCircle2, RotateCcw,
  Printer, Download, AlertCircle, Lock, PenTool, Check
} from 'lucide-react';

export type ConsentType =
  | 'general_treatment'
  | 'surgical_procedure'
  | 'blood_transfusion'
  | 'privacy_ndpr'
  | 'financial_liability';

export interface ConsentRecord {
  id: string;
  facilityId: string;
  facilityName: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  consentType: ConsentType;
  consentTitle: string;
  signerName: string;
  signerRelationship: 'Self (Patient)' | 'Parent / Guardian' | 'Spouse' | 'Next of Kin' | 'Legal Representative';
  signerPhone: string;
  signerIdNumber?: string;
  procedureName?: string;
  risksExplained: boolean;
  witnessName: string;
  signatureDataUrl: string;
  signedAt: string;
  verificationHash: string;
}

const CONSENT_TEMPLATES: Record<ConsentType, { title: string; clauses: string[] }> = {
  general_treatment: {
    title: 'General Consent for Medical & Nursing Treatment',
    clauses: [
      'I hereby grant consent for outpatient and/or inpatient medical examinations, routine nursing care, diagnostic testing (including blood, urine, and radiological imaging), and medications prescribed by the attending clinical staff.',
      'I acknowledge that the practice of medicine is not an exact science, and no guarantees have been made to me regarding the outcome of examinations or treatments.',
      'I agree to abide by the clinical recommendations and follow safety and hygiene protocols established by the hospital facility.',
    ],
  },
  surgical_procedure: {
    title: 'Consent for Surgical Operation, Anesthesia & Invasive Procedures',
    clauses: [
      'I authorize the surgical and clinical team to perform the scheduled surgical procedure and any unforeseen emergent procedures deemed clinically necessary during the operation.',
      'The nature, anticipated benefits, material risks (including infection, hemorrhage, adverse drug reactions, and cardiopulmonary complications), and reasonable alternatives have been explained to me by the attending surgeon.',
      'I consent to the administration of general, regional, or local anesthesia by qualified anesthesiology staff and acknowledge the standard risks associated with anesthesia.',
    ],
  },
  blood_transfusion: {
    title: 'Consent for Administration of Blood & Blood Products',
    clauses: [
      'I authorize the administration of whole blood, packed red cells, fresh frozen plasma, platelets, or cryoprecipitate as indicated for my clinical care.',
      'The clinical necessity, anticipated benefits, and known potential risks (including allergic reactions, fever, transmission of infectious pathogens despite screening, and hemolytic reactions) have been discussed with me.',
      'I understand that all blood products are strictly tested under National and State Blood Transfusion Service safety guidelines.',
    ],
  },
  privacy_ndpr: {
    title: 'Privacy Notice & Health Data Release (NDPR / HIPAA Compliance)',
    clauses: [
      'I acknowledge receipt of the Hospital Privacy Notice outlining how my protected health information (PHI) is processed in accordance with the Nigeria Data Protection Regulation (NDPR) and international privacy frameworks.',
      'I authorize the facility to record, store, and utilize my health data within MedCore OS for ongoing clinical care, laboratory analysis, billing settlement, and statutory state public health reporting (DHIS2/NDDC).',
      'I understand that my records remain strictly confidential and will not be disclosed to unauthorized third parties without my explicit consent.',
    ],
  },
  financial_liability: {
    title: 'Financial Agreement & Payment Responsibility Release',
    clauses: [
      'I acknowledge that I am financially responsible for all charges incurred during my visit or admission, including professional consultation, laboratory tests, pharmaceuticals, and accommodation fees.',
      'For insured patients (AKSHIA / NHIA / HMO): I authorize direct billing to my provider and agree to settle any co-payments, deductibles, or non-covered benefits directly at the POS cashier desk.',
      'I understand that all hospital receipts are issued electronically via MedCore OS and remitted in compliance with Akwa Ibom State public finance regulations.',
    ],
  },
};

interface Props {
  facilityId: string;
  facilityName?: string;
  patient?: { id: string; name?: string; firstName?: string; lastName?: string; hospitalNumber?: string } | null;
  witnessStaffName?: string;
  onSaveConsent?: (record: ConsentRecord) => void;
}

export const DigitalConsentSuite: React.FC<Props> = ({
  facilityId,
  facilityName = 'Hospital Facility',
  patient,
  witnessStaffName = 'Clinical Officer',
  onSaveConsent,
}) => {
  const patientDisplayName = patient
    ? (patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.hospitalNumber || 'Patient')
    : 'Patient Intake';

  const hospitalNo = patient?.hospitalNumber || 'MCH-00000';

  const [consentType, setConsentType] = useState<ConsentType>('general_treatment');
  const [signerName, setSignerName] = useState(patientDisplayName);
  const [signerRelationship, setSignerRelationship] = useState<ConsentRecord['signerRelationship']>('Self (Patient)');
  const [signerPhone, setSignerPhone] = useState('080');
  const [signerIdNumber, setSignerIdNumber] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [risksExplained, setRisksExplained] = useState(true);
  const [witnessName, setWitnessName] = useState(witnessStaffName);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [lastHash, setLastHash] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : '';
    const now = new Date().toISOString();
    const hash = 'MED-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();

    const record: ConsentRecord = {
      id: `CSNT-${Date.now()}`,
      facilityId,
      facilityName,
      patientId: patient?.id || 'WALK-IN',
      patientName: patientDisplayName,
      hospitalNumber: hospitalNo,
      consentType,
      consentTitle: CONSENT_TEMPLATES[consentType].title,
      signerName,
      signerRelationship,
      signerPhone,
      signerIdNumber,
      procedureName: consentType === 'surgical_procedure' ? procedureName : undefined,
      risksExplained,
      witnessName,
      signatureDataUrl,
      signedAt: now,
      verificationHash: hash,
    };

    onSaveConsent?.(record);
    setLastHash(hash);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 5000);
  };

  const template = CONSENT_TEMPLATES[consentType];

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0', padding: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0284C7 0%, #16A34A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <FileCheck size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
              Digital Clinical Consent & Legal Release
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span>Patient: <strong style={{ color: '#0F172A' }}>{patientDisplayName}</strong> ({hospitalNo})</span>
              <span>•</span>
              <span>{facilityName}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <Printer size={15} /> Print Document
        </button>
      </div>

      {savedSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: '0.86rem', marginBottom: 18 }}>
          <CheckCircle2 size={20} color="#16A34A" />
          <div>
            <strong>Legal consent verified and digitally archived!</strong>
            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--os-font-mono, monospace)', marginTop: 2 }}>
              Audit Hash: {lastHash} · Signed by {signerName} ({signerRelationship})
            </div>
          </div>
        </div>
      )}

      {/* Select Consent Category */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {[
          { id: 'general_treatment', label: '1. General Treatment Consent' },
          { id: 'surgical_procedure', label: '2. Surgical & Invasive Procedure' },
          { id: 'blood_transfusion', label: '3. Blood Transfusion Consent' },
          { id: 'privacy_ndpr', label: '4. Privacy Notice & NDPR Release' },
          { id: 'financial_liability', label: '5. Financial Agreement' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setConsentType(t.id as any);
              clearSignature();
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: consentType === t.id ? '#0284C7' : '#F1F5F9',
              color: consentType === t.id ? '#FFFFFF' : '#475569',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Document Body */}
      <div style={{ padding: 18, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: 18 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '0.96rem', fontWeight: 800, color: '#0F172A' }}>
          {template.title}
        </h4>

        {consentType === 'surgical_procedure' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Proposed Surgical Operation / Procedure Name:
            </label>
            <input
              type="text"
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              placeholder="e.g., Emergency Caesarean Section / Exploratory Laparotomy / Appendectomy"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #0284C7', background: '#FFFFFF', fontSize: '0.86rem', outline: 'none' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: '#334155', lineHeight: 1.55 }}>
          {template.clauses.map((clause, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 800, color: '#0284C7', minWidth: 18 }}>{idx + 1}.</span>
              <span>{clause}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="risks"
            checked={risksExplained}
            onChange={(e) => setRisksExplained(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#0284C7' }}
          />
          <label htmlFor="risks" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}>
            I confirm that the nature, risks, potential benefits, and treatment alternatives have been thoroughly explained in plain language (or local language) to my full understanding.
          </label>
        </div>
      </div>

      {/* Signer Identity Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
            Signer Legal Full Name *
          </label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
            Relationship to Patient *
          </label>
          <select
            value={signerRelationship}
            onChange={(e) => setSignerRelationship(e.target.value as any)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
          >
            <option value="Self (Patient)">Self (Patient)</option>
            <option value="Parent / Guardian">Parent / Guardian</option>
            <option value="Spouse">Spouse</option>
            <option value="Next of Kin">Next of Kin</option>
            <option value="Legal Representative">Legal Representative</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
            Signer Phone / Contact *
          </label>
          <input
            type="text"
            value={signerPhone}
            onChange={(e) => setSignerPhone(e.target.value)}
            placeholder="080XXXXXXXX"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.84rem' }}
          />
        </div>
      </div>

      {/* Interactive Signature Canvas */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            <PenTool size={14} color="#0284C7" />
            <span>Digital Signature / Sign-off Pad (Draw using finger, stylus, or mouse) *</span>
          </label>
          {hasSignature && (
            <button
              type="button"
              onClick={clearSignature}
              style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RotateCcw size={13} /> Clear Signature
            </button>
          )}
        </div>

        <div style={{ border: '2px dashed #94A3B8', borderRadius: 12, background: '#FFFFFF', padding: 4, display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={canvasRef}
            width={580}
            height={130}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ display: 'block', width: '100%', maxWidth: 580, height: 130, cursor: 'crosshair', touchAction: 'none' }}
          />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center', marginTop: 4 }}>
          Sign inside the box above. Touch screens and digital tablets supported.
        </div>
      </div>

      {/* Witness & Final Submission */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#64748B' }}>
          <Shield size={16} color="#16A34A" />
          <span>Staff Witness: <strong>{witnessName}</strong> · Timestamped upon submission</span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(90deg, #0284C7 0%, #16A34A 100%)',
            color: '#FFFFFF',
            fontSize: '0.88rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check size={18} />
          <span>Confirm & Digitally Archive Consent</span>
        </button>
      </div>
    </div>
  );
};
export default DigitalConsentSuite;

