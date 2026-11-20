'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import SearchablePatientSelect, { formatPatientName } from './SearchablePatientSelect';
import {
  listPatients,
  subscribePatients,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import {
  verifyPatientExists,
  verifyPatientExistsAsync,
  type PatientVerificationResult,
} from '../../lib/patientVerification';

export interface VerifiedPatientFieldProps {
  facilityId: string;
  value?: FacilityPatient | null;
  selectedPatientId?: string | null;
  initialName?: string;
  initialHospitalNumber?: string;
  onSelect: (patient: FacilityPatient | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  dark?: boolean;
  error?: string | null;
  compact?: boolean;
}

export const VerifiedPatientField: React.FC<VerifiedPatientFieldProps> = ({
  facilityId,
  value,
  selectedPatientId,
  initialName,
  initialHospitalNumber,
  onSelect,
  label,
  placeholder = 'Type patient name, hospital no. (e.g. IGH-PT-...), or NIN…',
  required = false,
  optional = false,
  disabled = false,
  dark = false,
  error = null,
  compact = false,
}) => {
  const [internalPatient, setInternalPatient] = useState<FacilityPatient | null>(value || null);
  const [verifRes, setVerifRes] = useState<PatientVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const activePatient = value !== undefined ? value : internalPatient;

  // Keep synced with store if an ID was selected externally
  useEffect(() => {
    const syncById = () => {
      if (selectedPatientId && !activePatient) {
        const hit = listPatients(facilityId).find(
          (p) => p.id === selectedPatientId || p.hospitalNumber === selectedPatientId
        );
        if (hit) {
          setInternalPatient(hit);
          onSelect(hit);
        }
      }
    };
    syncById();
    return subscribePatients(syncById);
  }, [facilityId, selectedPatientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-verify initialHospitalNumber / initialName / selectedPatientId
  useEffect(() => {
    if (activePatient) return;
    if (!selectedPatientId && !initialHospitalNumber && !initialName) return;

    let cancelled = false;
    const local = verifyPatientExists(facilityId, {
      patientId: selectedPatientId || undefined,
      hospitalNumber: initialHospitalNumber || undefined,
      patientName: initialName || undefined,
    });
    setVerifRes(local);
    if (local.valid && local.patient) {
      setInternalPatient(local.patient);
      onSelect(local.patient);
      return;
    }

    setVerifying(true);
    void verifyPatientExistsAsync(facilityId, {
      patientId: selectedPatientId || undefined,
      hospitalNumber: initialHospitalNumber || undefined,
      patientName: initialName || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setVerifRes(res);
        if (res.valid && res.patient) {
          setInternalPatient(res.patient);
          onSelect(res.patient);
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facilityId, selectedPatientId, initialHospitalNumber, initialName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (p: FacilityPatient | null) => {
    setInternalPatient(p);
    setVerifRes(
      p
        ? { valid: true, status: 'verified', patient: p, matchedBy: 'hospitalNumber' }
        : { valid: false, status: 'empty' }
    );
    onSelect(p);
  };

  const labelColor = dark ? '#CBD5E1' : '#334155';
  const subColor = dark ? '#94A3B8' : '#64748B';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6, width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: labelColor,
            }}
          >
            {label} {required ? '*' : optional ? '(Optional)' : ''}
          </label>
          {verifying && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0284C7' }}>
              Verifying registry…
            </span>
          )}
        </div>
      )}

      <SearchablePatientSelect
        facilityId={facilityId}
        selectedPatient={activePatient}
        value={activePatient?.id || null}
        onChange={handleChange}
        onVerificationChange={setVerifRes}
        placeholder={placeholder}
        required={required && !activePatient}
        disabled={disabled}
        dark={dark}
        showVerificationBadge={false}
      />

      {activePatient ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: compact ? '5px 9px' : '7px 11px',
            borderRadius: 9,
            background: dark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
            border: dark ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid #A7F3D0',
            fontSize: 11.5,
            color: dark ? '#6EE7B7' : '#065F46',
            fontWeight: 700,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={13} />
            Verified: {formatPatientName(activePatient)}
          </span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
            {activePatient.hospitalNumber}
            {activePatient.sex ? ` · ${activePatient.sex}` : ''}
            {activePatient.phone ? ` · ${activePatient.phone}` : ''}
          </span>
        </div>
      ) : (error || (verifRes && !verifRes.valid && verifRes.error)) ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '7px 10px',
            borderRadius: 9,
            background: dark ? 'rgba(220, 38, 38, 0.16)' : '#FEF2F2',
            border: dark ? '1px solid rgba(248, 113, 113, 0.35)' : '1px solid #FECACA',
            fontSize: 11.5,
            fontWeight: 600,
            color: dark ? '#FCA5A5' : '#B91C1C',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error || verifRes?.error}</span>
        </div>
      ) : !compact ? (
        <div style={{ fontSize: 10.5, color: subColor }}>
          Must match an existing patient or Hospital No. in this facility&apos;s registry.
        </div>
      ) : null}
    </div>
  );
};

export default VerifiedPatientField;
