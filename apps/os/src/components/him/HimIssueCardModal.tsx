'use client';

import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Printer,
  CheckCircle2,
  X,
  AlertTriangle,
  Copy,
  RefreshCw,
} from 'lucide-react';
import type { FacilityPatient } from '../../lib/patientRegistryStore';
import {
  issueDigitalHealthCardForPatient,
  getOrCreateStateHealthCard,
  type StatewideHealthCard,
} from '../../lib/stateHealthCardService';
import { StatewideHealthCardRenderer } from '../patient-card/StatewideHealthCardRenderer';
import { SearchablePatientSelect } from '../common/SearchablePatientSelect';

interface Props {
  isOpen: boolean;
  patient?: FacilityPatient | null;
  facilityId: string;
  facilityName?: string;
  issuedBy?: string;
  onClose: () => void;
  onIssued?: (patient: FacilityPatient, card: StatewideHealthCard) => void;
}

export const HimIssueCardModal: React.FC<Props> = ({
  isOpen,
  patient: initialPatient,
  facilityId,
  facilityName = 'Akwa Ibom State Hospital',
  issuedBy = 'HIM Officer',
  onClose,
  onIssued,
}) => {
  const [selectedPatient, setSelectedPatient] = useState<FacilityPatient | null>(
    initialPatient || null
  );
  const [issuedCard, setIssuedCard] = useState<StatewideHealthCard | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setSelectedPatient(initialPatient || null);
    if (initialPatient && initialPatient.shid) {
      setIssuedCard(getOrCreateStateHealthCard(initialPatient));
    } else {
      setIssuedCard(null);
    }
  }, [initialPatient, isOpen]);

  if (!isOpen) return null;

  const handleIssue = () => {
    if (!selectedPatient) return;
    const res = issueDigitalHealthCardForPatient(
      selectedPatient,
      issuedBy,
      facilityName
    );
    setSelectedPatient(res.patient);
    setIssuedCard(res.card);
    onIssued?.(res.patient, res.card);
  };

  const fullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.middleName, selectedPatient.lastName]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
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
          maxWidth: 680,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: 18,
          border: '1px solid #CBD5E1',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(135deg, #064E3B 0%, #0D9488 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={20} />
            <div>
              <div style={{ fontSize: '0.96rem', fontWeight: 800 }}>
                HIM Digital Health Card Issuance
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                Issues statewide SHID credential + scannable /verify QR code
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.16)',
              border: 'none',
              borderRadius: 8,
              width: 30,
              height: 30,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Patient Picker (when no patient preselected or changing target) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              Patient Master Index (MPI) Record *
            </label>
            <SearchablePatientSelect
              facilityId={facilityId}
              value={selectedPatient?.id || ''}
              onChange={(p) => {
                setSelectedPatient(p || null);
                setIssuedCard(
                  p && p.shid ? getOrCreateStateHealthCard(p) : null
                );
              }}
              placeholder="Search patient by name, folder number, or SHID..."
            />
          </div>

          {selectedPatient && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0F172A' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 2 }}>
                  Folder: <strong style={{ fontFamily: 'monospace' }}>{selectedPatient.hospitalNumber}</strong> ·{' '}
                  {selectedPatient.sex} · DOB: {selectedPatient.dob || '—'} · Phone:{' '}
                  {selectedPatient.phone || '—'}
                </div>
                <div style={{ fontSize: '0.74rem', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: selectedPatient.shid ? '#ECFDF5' : '#FEF3C7',
                      color: selectedPatient.shid ? '#065F46' : '#92400E',
                      fontWeight: 700,
                    }}
                  >
                    {selectedPatient.shid
                      ? `SHID: ${selectedPatient.shid}`
                      : 'Pending SHID Assignment'}
                  </span>
                  {selectedPatient.cardIssuedAt && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: '#EFF6FF',
                        color: '#1E40AF',
                        fontWeight: 700,
                      }}
                    >
                      Issued {new Date(selectedPatient.cardIssuedAt).toLocaleDateString('en-GB')} by{' '}
                      {selectedPatient.cardIssuedBy || 'HIM'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleIssue}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                }}
              >
                {selectedPatient.shid ? <RefreshCw size={14} /> : <ShieldCheck size={14} />}
                {selectedPatient.shid ? 'Re-Issue & Sync Card' : 'Issue Digital Health Card'}
              </button>
            </div>
          )}

          {!selectedPatient && (
            <div
              style={{
                padding: 18,
                borderRadius: 12,
                border: '1px dashed #CBD5E1',
                background: '#F8FAFC',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: '#64748B',
              }}
            >
              <AlertTriangle size={18} style={{ margin: '0 auto 6px', color: '#D97706' }} />
              Select a verified MPI patient above to issue their official Digital Health Card.
            </div>
          )}

          {issuedCard && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  fontSize: '0.76rem',
                  color: '#065F46',
                  fontWeight: 700,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={15} /> Card ACTIVE · {issuedCard.shid} · Valid until{' '}
                  {issuedCard.expiryDate}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(issuedCard.hieGatewayUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 9px',
                      borderRadius: 6,
                      border: '1px solid #6EE7B7',
                      background: '#FFFFFF',
                      color: '#047857',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={12} /> {copiedUrl ? 'Copied!' : 'Copy Verify URL'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 9px',
                      borderRadius: 6,
                      border: '1px solid #6EE7B7',
                      background: '#FFFFFF',
                      color: '#047857',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Printer size={12} /> Print Card
                  </button>
                </div>
              </div>

              <StatewideHealthCardRenderer card={issuedCard} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HimIssueCardModal;
