'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Clock,
  FileBadge2,
  Search,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import {
  maskIdentifier,
  parseScannedEmrQr,
  verifyQrToken,
  type DecodedEmrQr,
} from '@/lib/qrPayload';

const KIND_LABELS: Record<string, string> = {
  card: 'Akwa Ibom State Digital Health Card',
  staff: 'Verified Healthcare Staff Credential',
  cert: 'Official Clinical Certificate',
  discharge: 'Hospital Discharge Summary Seal',
  triage: 'Clinical Triage & Check-In Token',
  passport: 'FHIR Portable Health Record Seal',
  receipt: 'Verified Hospital Payment Receipt',
  rx: 'Verified Electronic Prescription',
  unknown: 'EMR Credential',
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('t') || '';
  const [manualInput, setManualInput] = useState(initialToken);

  const activeToken = (manualInput || initialToken).trim();
  const [hashInput, setHashInput] = useState('');
  const [merkleResult, setMerkleResult] = useState<{
    checked: boolean;
    verified: boolean;
    network?: string;
    merkleRoot?: string;
    txHash?: string | null;
    message?: string;
  } | null>(null);

  const checkMerkleInclusion = async () => {
    const cleanHash = hashInput.trim().toLowerCase();
    if (!cleanHash) return;
    try {
      const res = await fetch(`/api/audit/anchor?hash=${encodeURIComponent(cleanHash)}`);
      const json = await res.json();
      setMerkleResult({
        checked: true,
        verified: Boolean(json.verified),
        network: json.anchor?.network,
        merkleRoot: json.anchor?.merkleRoot,
        txHash: json.anchor?.externalTxHash,
        message: json.message,
      });
    } catch {
      setMerkleResult({ checked: true, verified: false, message: 'Unable to query Merkle proof endpoint offline.' });
    }
  };

  const verification = useMemo(() => {
    if (!activeToken) return null;
    // Try strict token first, then flexible EMR QR parser
    const direct = verifyQrToken(activeToken);
    if (direct.payload) {
      return {
        mode: 'token' as const,
        valid: direct.valid,
        expired: direct.expired,
        payload: direct.payload,
        decoded: null as DecodedEmrQr | null,
      };
    }
    const parsed = parseScannedEmrQr(activeToken);
    return {
      mode: 'parsed' as const,
      valid: parsed.tokenValid && Boolean(parsed.id),
      expired: parsed.expired,
      payload: parsed.payload || null,
      decoded: parsed,
    };
  }, [activeToken]);

  const kind =
    verification?.payload?.k || verification?.decoded?.kind || 'unknown';
  const kindTitle = KIND_LABELS[kind] || KIND_LABELS.unknown;

  const isHealthy = Boolean(
    verification && verification.valid && !verification.expired
  );
  const isExpired = Boolean(verification?.expired);

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top right, #ECFDF5 0%, #F8FAFC 50%, #F1F5F9 100%)',
        padding: '32px 16px',
        fontFamily:
          'var(--font-sans, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif)',
        color: '#0F172A',
      }}
    >
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#065F46',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#064E3B' }}>
                Akwa Ibom MedCore EMR
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>
                Public QR Credential Verification Registry
              </div>
            </div>
          </div>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '0.75rem',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} /> EMR Portal
          </Link>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Status Banner */}
          <div
            style={{
              padding: '20px 24px',
              background: !verification
                ? '#0F172A'
                : isHealthy
                  ? 'linear-gradient(135deg, #065F46 0%, #059669 100%)'
                  : isExpired
                    ? 'linear-gradient(135deg, #92400E 0%, #D97706 100%)'
                    : 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)',
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!verification ? (
                <Search size={26} />
              ) : isHealthy ? (
                <CheckCircle2 size={28} />
              ) : (
                <ShieldAlert size={28} />
              )}
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    opacity: 0.9,
                  }}
                >
                  {!verification
                    ? 'Awaiting Credential Token'
                    : isHealthy
                      ? 'Authentic EMR Credential'
                      : isExpired
                        ? 'Credential Expired'
                        : 'Verification Warning / Tampered'}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 2 }}>
                  {!verification ? 'Verify a MedCore QR Credential' : kindTitle}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {verification && (
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  background: '#F8FAFC',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: 8,
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                    Credential Reference
                  </span>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: '#0F172A',
                    }}
                  >
                    {maskIdentifier(verification.payload?.id || verification.decoded?.id)}
                  </span>
                </div>

                {(verification.payload?.mrn || verification.decoded?.hospitalNo) && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                      Hospital Registry No.
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: '#334155',
                      }}
                    >
                      {maskIdentifier(
                        verification.payload?.mrn || verification.decoded?.hospitalNo
                      )}
                    </span>
                  </div>
                )}

                {(verification.payload?.fn ||
                  verification.payload?.f ||
                  verification.decoded?.facilityName ||
                  verification.decoded?.facilityId) && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748B',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Building2 size={13} /> Issuing Facility
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#0F172A',
                        textAlign: 'right',
                      }}
                    >
                      {verification.payload?.fn ||
                        verification.decoded?.facilityName ||
                        verification.payload?.f ||
                        verification.decoded?.facilityId}
                    </span>
                  </div>
                )}

                {verification.payload?.sub && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748B',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <FileBadge2 size={13} /> Classification
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                      {verification.payload.sub}
                    </span>
                  </div>
                )}

                {verification.payload?.k === 'staff' && verification.payload.holder && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                      Practitioner Badge
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                      {verification.payload.holder}
                    </span>
                  </div>
                )}

                {verification.payload?.iss && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748B',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Clock size={13} /> Issued Date
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                      {verification.payload.iss}
                    </span>
                  </div>
                )}

                {verification.payload?.exp && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid #E2E8F0',
                      paddingBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                      Valid Until
                    </span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isExpired ? '#B45309' : '#065F46',
                      }}
                    >
                      {verification.payload.exp}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                    Integrity Check
                  </span>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: isHealthy ? '#059669' : '#DC2626',
                    }}
                  >
                    {verification.valid
                      ? `VERIFIED (${verification.payload?.sig || 'CHECKSUM-OK'})`
                      : 'SIGNATURE MISMATCH'}
                  </span>
                </div>
              </div>
            )}

            {/* Audit Ledger Merkle-Root Inclusion Verifier */}
            <div style={{ padding: 14, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
                Cryptographic Audit Merkle-Root Proof Verifier (Zero PHI)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="Paste SHA-256 audit rowHash to verify Merkle inclusion..."
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.76rem', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => void checkMerkleInclusion()}
                  style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#065F46', color: '#FFFFFF', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Verify Proof
                </button>
              </div>
              {merkleResult && (
                <div style={{ marginTop: 8, fontSize: '0.74rem', fontWeight: 700, color: merkleResult.verified ? '#065F46' : '#B45309' }}>
                  {merkleResult.verified
                    ? `MERKLE INCLUSION VERIFIED (${merkleResult.network || 'sealed_local'}) · Root: ${String(merkleResult.merkleRoot || '').slice(0, 18)}…`
                    : merkleResult.message || 'Hash not included in latest sealed Merkle anchor.'}
                </div>
              )}
            </div>

            {/* Zero-PHI Privacy Notice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 10,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                fontSize: '0.74rem',
                lineHeight: 1.5,
                color: '#1E3A8A',
              }}
            >
              <Lock size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Zero-PHI Public Verification:</strong> Protected health information
                (patient full name, phone number, address, and clinical notes) is never exposed on
                public QR verification screens. Authorised hospital staff can scan this QR code
                inside the MedCore EMR console to open the linked encounter.
              </div>
            </div>

            {/* Manual Lookup Box */}
            <div style={{ paddingTop: 4 }}>
              <label
                htmlFor="qr-manual-verify"
                style={{
                  display: 'block',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: 6,
                }}
              >
                Verify Another QR Token or Credential Code
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="qr-manual-verify"
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste scanned /verify?t=... link, SHID-..., CERT-..., or MRN"
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.78rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 48, textAlign: 'center', fontFamily: 'sans-serif' }}>
          Verifying EMR credential...
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
