
'use client';

/**
 * Premium vertical staff ID card — portrait photo, holographic accent, dual sides.
 */
import React, { useMemo, useState } from 'react';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

const TEMPLATE_STYLE: Record<
  StaffCardTemplate,
  { stripe: string; accent: string; header: string; label: string }
> = {
  TPL_CLINICAL: {
    stripe: 'linear-gradient(180deg, #0052D4 0%, #00BFA5 100%)',
    accent: '#0052D4',
    header: 'linear-gradient(135deg, #0052D4 0%, #00A3BF 55%, #00BFA5 100%)',
    label: 'Clinical',
  },
  TPL_CONSULTANT: {
    stripe: 'linear-gradient(180deg, #0A2540 0%, #0052D4 100%)',
    accent: '#0A2540',
    header: 'linear-gradient(135deg, #0A2540 0%, #1E3A5F 50%, #0052D4 100%)',
    label: 'Consultant',
  },
  TPL_EXEC: {
    stripe: 'linear-gradient(180deg, #EA580C 0%, #F59E0B 100%)',
    accent: '#EA580C',
    header: 'linear-gradient(135deg, #C2410C 0%, #EA580C 50%, #F59E0B 100%)',
    label: 'Executive',
  },
  TPL_SUPPORT: {
    stripe: 'linear-gradient(180deg, #0284C7 0%, #00BFA5 100%)',
    accent: '#0284C7',
    header: 'linear-gradient(135deg, #0369A1 0%, #0284C7 50%, #00BFA5 100%)',
    label: 'Support',
  },
  TPL_ICT: {
    stripe: 'linear-gradient(180deg, #0F172A 0%, #00BFA5 100%)',
    accent: '#0F172A',
    header: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0D9488 100%)',
    label: 'ICT',
  },
  TPL_VISITOR: {
    stripe: 'linear-gradient(180deg, #DC2626 0%, #F97316 100%)',
    accent: '#DC2626',
    header: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 50%, #F97316 100%)',
    label: 'Temporary',
  },
};

function QrMatrix({ payload, size = 88 }: { payload: string; size?: number }) {
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

  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#fff',
        padding: 4,
        borderRadius: 8,
        boxSizing: 'border-box',
        boxShadow: '0 1px 4px rgba(15,23,42,0.12)',
      }}
      title={payload}
    >
      <svg width={size - 8} height={size - 8} viewBox={`0 0 ${cells.length} ${cells.length}`}>
        {cells.map((row, r) =>
          row.map((on, c) =>
            on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0A2540" /> : null
          )
        )}
      </svg>
    </div>
  );
}

interface Props {
  card: StaffCardRecord;
  compact?: boolean;
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
  const w = compact ? 252 : 300;
  const h = compact ? 400 : 480;
  const suffix =
    credentials || (card.title?.match(/\b(MD|RN|PharmD|BSc|MBBS|FWACS)\b/i)?.[0] ?? '');
  const issued = card.issuedAt?.slice(0, 10) || '—';
  const expires = card.expiresAt?.slice(0, 10) || '—';

  const shell: React.CSSProperties = {
    width: w,
    height: h,
    maxWidth: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    background: '#FFFFFF',
    color: '#0A2540',
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.5) inset, 0 20px 50px rgba(15, 23, 42, 0.22), 0 8px 16px rgba(0, 82, 212, 0.08)',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    fontFamily: 'var(--os-font, Inter, system-ui, sans-serif)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={shell}>
        {/* Holographic edge */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 20,
            boxShadow: `inset 0 0 0 1px ${tpl.accent}22`,
            zIndex: 4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            background: tpl.stripe,
            zIndex: 5,
          }}
        />

        {side === 'front' ? (
          <>
            {/* Brand header */}
            <div
              style={{
                padding: '16px 16px 18px 18px',
                background: tpl.header,
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: -20,
                  top: -30,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <img
                    src="/medcore-logo.png"
                    alt=""
                    width={28}
                    height={28}
                    style={{ objectFit: 'contain' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      opacity: 0.9,
                    }}
                  >
                    MedCore · Staff ID
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1.25,
                      marginTop: 2,
                      textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                  >
                    {card.facilityName}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '5px 9px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.22)',
                    backdropFilter: 'blur(4px)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tpl.label}
                </span>
              </div>
            </div>

            {/* Photo + identity */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '18px 16px 12px',
                background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 40%)',
              }}
            >
              <div
                style={{
                  width: compact ? 112 : 132,
                  height: compact ? 112 : 132,
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: `3px solid ${tpl.accent}`,
                  boxShadow: `0 8px 24px ${tpl.accent}33, 0 0 0 4px ${tpl.accent}14`,
                  background: 'linear-gradient(145deg, #E0F2FE, #ECFDF5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {card.photoUrl ? (
                  <img
                    src={card.photoUrl}
                    alt={card.fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: compact ? 36 : 42,
                      fontWeight: 800,
                      color: tpl.accent,
                      fontFamily: 'var(--os-font-heading, Outfit, sans-serif)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {card.initials}
                  </span>
                )}
                {/* Status chip on photo */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 6,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: card.status === 'ACTIVE' ? '#16A34A' : '#EF4444',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 14,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--os-font-heading, Outfit, sans-serif)',
                    fontSize: compact ? 16 : 18,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#0A2540',
                    lineHeight: 1.2,
                  }}
                >
                  {card.fullName}
                  {suffix ? (
                    <span style={{ color: tpl.accent, fontWeight: 700 }}>
                      {', '}
                      {suffix}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    fontWeight: 700,
                    color: tpl.accent,
                  }}
                >
                  {card.title || card.role}
                </div>
                <div style={{ marginTop: 2, fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                  {card.department}
                </div>
              </div>

              {/* Badge chip */}
              <div
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #F1F5F9 0%, #EFF6FF 100%)',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                    }}
                  >
                    Badge ID
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--os-font-mono, monospace)',
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#0052D4',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {card.badgeId}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                    }}
                  >
                    Clearance
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0A2540' }}>
                    {card.clearanceLabel}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: '#64748B',
                  fontWeight: 600,
                }}
              >
                <span>Issued {issued}</span>
                <span>Valid until {expires}</span>
              </div>
            </div>

            {/* Footer strip */}
            <div
              style={{
                padding: '8px 14px',
                background: tpl.header,
                color: 'rgba(255,255,255,0.95)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            >
              Property of {card.facilityName.split(',')[0]} · Return if found
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                padding: '14px 16px',
                background: tpl.header,
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Security &amp; access
            </div>
            <div
              style={{
                flex: 1,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <QrMatrix payload={card.qrPayload || card.badgeId} size={compact ? 80 : 96} />
                <div style={{ flex: 1, fontSize: 11, lineHeight: 1.45, color: '#475569' }}>
                  <div style={{ fontWeight: 800, color: '#0A2540', marginBottom: 4 }}>Scan for access</div>
                  Door control, time &amp; attendance, and system login via badge + PIN.
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: 'var(--os-font-mono, monospace)',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#0052D4',
                    }}
                  >
                    {card.badgeId}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                <div>
                  <strong>Blood group:</strong> {bloodGroup}
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Emergency:</strong> {emergencyContact}
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Department:</strong> {card.department}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.45 }}>
                If found, return to hospital administration or security. Unauthorized use is prohibited.
              </div>
              <div
                style={{
                  marginTop: 'auto',
                  borderTop: '1px dashed #CBD5E1',
                  paddingTop: 10,
                  fontSize: 10,
                  color: '#94A3B8',
                }}
              >
                Authorized signature / hologram zone
                <div
                  style={{
                    marginTop: 8,
                    height: 28,
                    borderBottom: '1px solid #94A3B8',
                    width: '70%',
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        className="os-ghost-btn"
        style={{ fontSize: 12 }}
        onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
      >
        Flip to {side === 'front' ? 'back' : 'front'}
      </button>
    </div>
  );
};

export default StaffIdCardView;
