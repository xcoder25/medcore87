'use client';

/**
 * Epic/Cerner-style sticky patient identity banner.
 * Always-visible demographics + allergies to reduce wrong-patient errors.
 */
import React from 'react';
import { AlertTriangle, User, Droplets, Phone } from 'lucide-react';
import type { FacilityPatient } from '../../lib/patientRegistryStore';

interface Props {
  patient: FacilityPatient;
  encounterLabel?: string;
  compact?: boolean;
  onOpen360?: () => void;
}

function ageFromDob(dob?: string): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

export const PatientChartBanner: React.FC<Props> = ({
  patient,
  encounterLabel,
  compact,
  onOpen360,
}) => {
  const allergies = patient.allergies?.filter(Boolean) || [];
  const hasAllergy = allergies.length > 0;

  return (
    <div
      className="mc-patient-banner"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compact ? 10 : 16,
        padding: compact ? '10px 14px' : '12px 16px',
        borderRadius: 14,
        border: hasAllergy ? '1px solid #FECACA' : '1px solid #E2E8F0',
        background: hasAllergy
          ? 'linear-gradient(90deg, #FEF2F2 0%, #FFFFFF 40%)'
          : 'linear-gradient(90deg, #F8FAFC 0%, #FFFFFF 50%)',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}
    >
      <div
        style={{
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #0052D4, #0D9488)',
          color: '#fff',
          fontWeight: 800,
          fontSize: compact ? 14 : 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {(patient.firstName?.[0] || '') + (patient.lastName?.[0] || '')}
      </div>

      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: compact ? 15 : 17, color: '#0F172A' }}>
            {patient.firstName} {patient.middleName} {patient.lastName}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {patient.hospitalNumber}
          </span>
          {encounterLabel && (
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{encounterLabel}</span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 4,
            fontSize: 12,
            color: '#475569',
          }}
        >
          <span>
            <User size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {patient.sex} · {ageFromDob(patient.dob)}
          </span>
          {(patient.bloodGroup || patient.genotype) && (
            <span>
              <Droplets size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {patient.bloodGroup || '—'} / {patient.genotype || '—'}
            </span>
          )}
          {patient.phone && (
            <span>
              <Phone size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {patient.phone}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {hasAllergy ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              background: '#FEE2E2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontWeight: 700,
              fontSize: 12,
              maxWidth: 280,
            }}
            title={allergies.join(', ')}
          >
            <AlertTriangle size={14} />
            ALLERGY: {allergies.slice(0, 3).join(', ')}
            {allergies.length > 3 ? '…' : ''}
          </div>
        ) : (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#065F46',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            NKDA / no allergies on file
          </div>
        )}
        {onOpen360 && (
          <button
            type="button"
            onClick={onOpen360}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #E2E8F0',
              background: '#fff',
              fontWeight: 700,
              fontSize: 12,
              color: '#0052D4',
              cursor: 'pointer',
            }}
          >
            Open 360°
          </button>
        )}
      </div>
    </div>
  );
};

export default PatientChartBanner;
