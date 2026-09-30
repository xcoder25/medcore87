'use client';

/**
 * Complete vertical staff ID card — front + back (hospital standard layout).
 */
import React, { useMemo, useState } from 'react';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

const TEMPLATE_STYLE: Record<
  StaffCardTemplate,
  { stripe: string; accent: string; label: string }
> = {
  TPL_CLINICAL: {
    stripe: 'linear-gradient(180deg, #0052D4 0%, #00BFA5 100%)',
    accent: '#0052D4',
    label: 'Clinical',
  },
  TPL_CONSULTANT: {
    stripe: 'linear-gradient(180deg, #0A2540 0%, #0052D4 100%)',
    accent: '#0A2540',
    label: 'Consultant',
  },
  TPL_EXEC: {
    stripe: 'linear-gradient(180deg, #EA580C 0%, #F59E0B 100%)',
    accent: '#EA580C',
    label: 'Executive',
  },
  TPL_SUPPORT: {
    stripe: 'linear-gradient(180deg, #475569 0%, #94A3B8 100%)',
    accent: '#64748B',
    label: 'Support',
  },
  TPL_ICT: {
    stripe: 'linear-gradient(180deg, #0F172A 0%, #00BFA5 100%)',
    accent: '#0F172A',
    label: 'ICT',
  },
  TPL_VISITOR: {
    stripe: 'linear-gradient(180deg, #DC2626 0%, #F97316 100%)',
    accent: '#DC2626',
    label: 'Temporary',
  },
};

/** Simple QR-like matrix from payload (no external lib) */
function QrMatrix({ payload, size = 96 }: { payload: string; size?: number }) {
  const cells = useMemo(() => {
    const n = 17;
    const grid: boolean[][] = [];
    let h = 0;
    for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) >>> 0;
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) {
        const border = r < 2 || c < 2 || r > n - 3 || c > n - 3;
        const finder =
          (r < 5 && c < 5) || (r < 5 && c > n - 6) || (r > n - 6 && c < 5);
        const bit = ((h >> ((r * c + r + c) % 16)) & 1) === 1;
        row.push(border || finder || bit);
      }
      grid.push(row);
    }
    return grid;
  }, [payload]);

  const cell = size / cells.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#fff',
        padding: 4,
        borderRadius: 6,
        boxSizing: 'border-box',
      }}
      title={payload}
    >
      <svg width={size - 8} height={size - 8} viewBox={`0 0 ${cells.length} ${cells.length}`}>
        {cells.map((row, r) =>
          row.map((on, c) =>
            on ? (
              <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0A2540" />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

interface Props {
  card: StaffCardRecord;
  compact?: boolean;
  /** Optional extras not always on base record */
  bloodGroup?: string;
  emergencyContact?: string;
  credentials?: string;
}

export const StaffIdCardView: React.FC<Props> = ({
  card,
  compact,
  bloodGroup = '—',
  emergencyContact = 'Hospital Security / HR',
  credentials,
}) => {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const tpl = TEMPLATE_STYLE[card.templateKey] || TEMPLATE_STYLE.TPL_CLINICAL;
  const statusColor =
    card.status === 'ACTIVE' ? '#16A34A' : card.status === 'SUSPENDED' ? '#EA580C' : '#EF4444';
  const w = compact ? 240 : 280;
  const h = compact ? 380 : 440;
  const suffix = credentials || (card.title?.match(/\b(MD|RN|PharmD|BSc|MBBS|FWACS)\b/i)?.[0] ?? '');

  const shell: React.CSSProperties = {
    width: w,
    height: h,
    maxWidth: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#FFFFFF',
    color: '#0A2540',
    boxShadow: '0 16px 48px rgba(15, 23, 42, 0.22)',
    border: '1px solid #E2E8F0',
    fontFamily: 'var(--os-font, Inter, system-ui, sans-serif)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={shell}>
        {/* Vertical accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 6,
            background: tpl.stripe,
          }}
        />

        {side === 'front' ? (
          <>
            {/* Header branding */}
            <div
              style={{
                padding: '14px 14px 10px 18px',
                background: 'linear-gradient(135deg, #E0F2FE 0%, #F0F9FF 55%, #ECFDF5 100%)',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <img
                src="/medcore-logo.png"
                alt=""
                width={36}
                height={36}
                style={{ objectFit: 'contain', borderRadius: 8 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: '#0052D4',
                    textTransform: 'uppercase',
                  }}
                >
                  MedCore · Hospital OS
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#0A2540',
                    lineHeight: 1.25,
                    marginTop: 2,
                  }}
                >
                  {card.facilityName}
                </div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: `${tpl.accent}18`,
                  color: tpl.accent,
                  whiteSpace: 'nowrap',
                }}
              >
                {tpl.label}
              </span>
            </div>

            {/* Photo */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 16px 8px' }}>
              <div
                style={{
                  width: compact ? 88 : 108,
                  height: compact ? 108 : 132,
                  borderRadius: 12,
                  border: `3px solid ${tpl.accent}`,
                  background: card.photoUrl
                    ? `center/cover url(${card.photoUrl})`
                    : 'linear-gradient(160deg, #F1F5F9, #E2E8F0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: compact ? 28 : 36,
                  fontWeight: 800,
                  color: tpl.accent,
                  boxShadow: '0 8px 20px rgba(0,82,212,0.12)',
                }}
              >
                {!card.photoUrl && card.initials}
              </div>
            </div>

            {/* Name & role */}
            <div style={{ textAlign: 'center', padding: '4px 16px 10px' }}>
              <div style={{ fontSize: compact ? 15 : 17, fontWeight: 800, lineHeight: 1.25 }}>
                {card.fullName}
                {suffix ? (
                  <span style={{ fontWeight: 600, color: '#64748B', fontSize: '0.9em' }}>
                    {', '}
                    {suffix}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: tpl.accent, marginTop: 4 }}>
                {card.title || card.role}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{card.department}</div>
            </div>

            {/* ID + validity */}
            <div style={{ padding: '0 16px 12px', flex: 1 }}>
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em' }}>
                  STAFF ID NUMBER
                </div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 800,
                    fontSize: 14,
                    marginTop: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  {card.badgeId}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginTop: 10,
                    fontSize: 10,
                  }}
                >
                  <div>
                    <div style={{ color: '#94A3B8', fontWeight: 600 }}>Issued</div>
                    <div style={{ fontWeight: 700 }}>{card.issuedAt?.slice(0, 10) || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94A3B8', fontWeight: 600 }}>Expires</div>
                    <div style={{ fontWeight: 700 }}>{card.expiresAt || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer status */}
            <div
              style={{
                marginTop: 'auto',
                padding: '10px 16px 12px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 10,
              }}
            >
              <span style={{ fontWeight: 700, color: statusColor }}>{card.status}</span>
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>{card.clearanceLabel}</span>
            </div>
          </>
        ) : (
          <>
            {/* Back header */}
            <div
              style={{
                padding: '12px 16px 12px 18px',
                background: tpl.stripe,
                color: '#fff',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.9 }}>
                REVERSE · SECURITY
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{card.facilityName}</div>
            </div>

            <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <QrMatrix payload={card.qrPayload || card.badgeId} size={compact ? 84 : 100} />
                <div style={{ flex: 1, fontSize: 10, color: '#475569', lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 800, color: '#0A2540', marginBottom: 4 }}>Access & auth</div>
                  Scan QR for system login verification. Badge ID is the same key on Hospital OS and Clinic.
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: 700,
                      fontSize: 11,
                      color: '#0A2540',
                    }}
                  >
                    {card.badgeId}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 11,
                }}
              >
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '8px 10px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700 }}>BLOOD GROUP</div>
                  <div style={{ fontWeight: 800, marginTop: 2 }}>{bloodGroup}</div>
                </div>
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 10,
                    padding: '8px 10px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700 }}>EMERGENCY</div>
                  <div style={{ fontWeight: 700, marginTop: 2, fontSize: 10 }}>{emergencyContact}</div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 9,
                  color: '#64748B',
                  lineHeight: 1.5,
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: 10,
                  padding: '8px 10px',
                }}
              >
                <strong style={{ color: '#92400E' }}>If found:</strong> Return to hospital security or
                reception. Unauthorized use is prohibited. Property of {card.facilityName}.
              </div>

              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700, marginBottom: 6 }}>
                  AUTHORIZED SIGNATURE
                </div>
                <div
                  style={{
                    borderBottom: '1.5px solid #CBD5E1',
                    height: 28,
                    marginBottom: 4,
                  }}
                />
                <div style={{ fontSize: 9, color: '#94A3B8' }}>
                  Hospital Administrator / HR · Hologram strip reserved
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="os-ghost-btn"
          onClick={() => setSide('front')}
          style={{
            fontSize: 12,
            borderColor: side === 'front' ? '#0052D4' : undefined,
            color: side === 'front' ? '#0052D4' : undefined,
          }}
        >
          Front
        </button>
        <button
          type="button"
          className="os-ghost-btn"
          onClick={() => setSide('back')}
          style={{
            fontSize: 12,
            borderColor: side === 'back' ? '#0052D4' : undefined,
            color: side === 'back' ? '#0052D4' : undefined,
          }}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default StaffIdCardView;
