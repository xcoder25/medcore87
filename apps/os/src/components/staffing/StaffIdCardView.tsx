'use client';

/**
 * Arise MedCore staff ID card — exact dual-side design:
 * Front: logo + circular gold-ring photo + identity + access bar
 * Back: QR + security notice + emergency contacts + wave footer
 */
import React, { useMemo, useState } from 'react';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

const ACCESS_BAR: Record<
  StaffCardTemplate,
  { label: string; gradient: string }
> = {
  TPL_CLINICAL: {
    label: 'FULL ACCESS – CLINICAL',
    gradient: 'linear-gradient(90deg, #0EA5E9 0%, #14B8A6 55%, #10B981 100%)',
  },
  TPL_CONSULTANT: {
    label: 'FULL ACCESS – CLINICAL',
    gradient: 'linear-gradient(90deg, #0369A1 0%, #0D9488 55%, #059669 100%)',
  },
  TPL_EXEC: {
    label: 'FULL ACCESS – EXECUTIVE',
    gradient: 'linear-gradient(90deg, #EA580C 0%, #F59E0B 100%)',
  },
  TPL_SUPPORT: {
    label: 'ACCESS – SUPPORT',
    gradient: 'linear-gradient(90deg, #0284C7 0%, #00BFA5 100%)',
  },
  TPL_ICT: {
    label: 'ACCESS – ICT',
    gradient: 'linear-gradient(90deg, #0F172A 0%, #0D9488 100%)',
  },
  TPL_VISITOR: {
    label: 'TEMPORARY ACCESS',
    gradient: 'linear-gradient(90deg, #DC2626 0%, #F97316 100%)',
  },
};

/** Stylized Arise MedCore mark (M + people) matching the printed card */
function AriseLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="amcM" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="0.55" stopColor="#0284C7" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="amcPeople" x1="24" y1="4" x2="48" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>
      {/* M stroke */}
      <path
        d="M6 38V12l9 16 9-16v26"
        stroke="url(#amcM)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* People cluster */}
      <circle cx="36" cy="12" r="4.2" fill="url(#amcPeople)" />
      <path d="M30 24c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5v2.5H30V24z" fill="url(#amcPeople)" />
      <circle cx="42" cy="14" r="3.2" fill="#FB923C" opacity="0.95" />
      <path d="M39 23c0-2.4 1.8-4 3.8-4 2 0 3.7 1.6 3.7 4v1.8H39V23z" fill="#FB923C" opacity="0.95" />
    </svg>
  );
}

function QrMatrix({ payload, size = 120 }: { payload: string; size?: number }) {
  const cells = useMemo(() => {
    const n = 21;
    const grid: boolean[][] = [];
    let h = 0;
    for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) >>> 0;
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) {
        const border = r < 1 || c < 1 || r > n - 2 || c > n - 2;
        const finder =
          (r < 6 && c < 6) || (r < 6 && c > n - 7) || (r > n - 7 && c < 6);
        const timing = r === 6 || c === 6;
        const bit = ((h >> ((r * c + r + c + r * 3) % 16)) & 1) === 1;
        row.push(border || finder || timing || bit);
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
        padding: 8,
        borderRadius: 12,
        boxSizing: 'border-box',
        border: '1.5px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
      }}
      title={payload}
    >
      <svg width={size - 16} height={size - 16} viewBox={`0 0 ${cells.length} ${cells.length}`}>
        {cells.map((row, r) =>
          row.map((on, c) =>
            on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0F172A" /> : null
          )
        )}
      </svg>
    </div>
  );
}

function formatDisplayDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  card: StaffCardRecord;
  compact?: boolean;
  bloodGroup?: string;
  emergencyContact?: string;
  credentials?: string;
  facilityPhone?: string;
  facilityEmail?: string;
  facilityWeb?: string;
}

export const StaffIdCardView: React.FC<Props> = ({
  card,
  compact,
  emergencyContact,
  credentials,
  facilityPhone = '+234 809 555 0180',
  facilityEmail = 'info@arisemedcore.ng',
  facilityWeb = 'www.arisemedcore.ng',
}) => {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const access = ACCESS_BAR[card.templateKey] || ACCESS_BAR.TPL_CLINICAL;
  const w = compact ? 260 : 320;
  const h = compact ? 420 : 510;
  const issued = formatDisplayDate(card.issuedAt);
  const expires = formatDisplayDate(card.expiresAt);
  const facility =
    (card.facilityName || 'ARISE MEDCORE HOSPITAL').replace(/,\s*.*$/, '').toUpperCase() ||
    'ARISE MEDCORE HOSPITAL';
  const titleLine = card.title || card.role || 'Staff';
  const deptLine = card.department || 'Clinical Services';
  const displayName = card.fullName.startsWith('Dr') || card.fullName.startsWith('Prof')
    ? card.fullName
    : credentials
      ? `${card.fullName}`
      : card.fullName;

  const shell: React.CSSProperties = {
    width: w,
    height: h,
    maxWidth: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#FFFFFF',
    color: '#0A2540',
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 40px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(14, 165, 233, 0.08)',
    border: '1px solid #E8EEF5',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={shell}>
        {/* Soft medical cross watermark */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.04,
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Cpath fill=\'%230284C7\' d=\'M36 12h8v24h24v8H44v24h-8V44H12v-8h24z\'/%3E%3C/svg%3E")',
            backgroundSize: '72px 72px',
            zIndex: 0,
          }}
        />

        {side === 'front' ? (
          <>
            {/* Brand row */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: compact ? '16px 16px 8px' : '20px 20px 10px',
              }}
            >
              <AriseLogo size={compact ? 32 : 40} />
              <div style={{ lineHeight: 1.15 }}>
                <div
                  style={{
                    fontSize: compact ? 13 : 15,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    color: '#0B3A7A',
                  }}
                >
                  {facility.includes('ARISE') ? (
                    <>
                      ARISE <span style={{ color: '#0369A1' }}>MEDCORE</span>
                    </>
                  ) : (
                    facility.split(' ').slice(0, 2).join(' ')
                  )}
                </div>
                <div
                  style={{
                    fontSize: compact ? 12 : 13,
                    fontWeight: 700,
                    background: 'linear-gradient(90deg, #0D9488, #10B981)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '0.04em',
                  }}
                >
                  HOSPITAL
                </div>
              </div>
            </div>

            {/* Circular portrait with gold ring */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
                padding: compact ? '6px 0 4px' : '8px 0 6px',
              }}
            >
              <div
                style={{
                  width: compact ? 118 : 148,
                  height: compact ? 118 : 148,
                  borderRadius: '50%',
                  padding: 4,
                  background:
                    'linear-gradient(145deg, #FDE68A 0%, #F59E0B 40%, #D97706 100%)',
                  boxShadow:
                    '0 0 0 3px rgba(251,191,36,0.25), 0 12px 28px rgba(217,119,6,0.28)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'linear-gradient(145deg, #E0F2FE, #ECFDF5)',
                    border: '3px solid #fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                        fontSize: compact ? 36 : 44,
                        fontWeight: 800,
                        color: '#0369A1',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {card.initials}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Identity block */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '6px 18px 0',
              }}
            >
              <div
                style={{
                  fontSize: compact ? 17 : 20,
                  fontWeight: 800,
                  color: '#0B3A7A',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: compact ? 13 : 14,
                  fontWeight: 700,
                  color: '#0D9488',
                }}
              >
                {titleLine}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: compact ? 12 : 13,
                  fontWeight: 600,
                  color: '#059669',
                }}
              >
                {deptLine}
              </div>

              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#F59E0B',
                  margin: '12px 0 10px',
                  boxShadow: '0 0 0 3px rgba(245,158,11,0.2)',
                }}
              />

              <div
                style={{
                  fontSize: compact ? 12 : 13,
                  fontWeight: 800,
                  color: '#EA580C',
                  letterSpacing: '0.04em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                ID: {card.badgeId}
              </div>
            </div>

            {/* Access bar */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                margin: '14px 0 0',
                padding: compact ? '10px 12px' : '12px 16px',
                background: access.gradient,
                color: '#fff',
                fontSize: compact ? 11 : 12,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textAlign: 'center',
                textTransform: 'uppercase',
                textShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            >
              {card.clearanceLabel
                ? card.clearanceLabel.toUpperCase().includes('ACCESS')
                  ? card.clearanceLabel.toUpperCase()
                  : access.label
                : access.label}
            </div>

            {/* Validity footer */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '10px 16px 14px',
                fontSize: 10,
                fontWeight: 600,
                color: '#64748B',
                textAlign: 'center',
                background: '#fff',
              }}
            >
              Issued: {issued}
              <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
              Valid until: {expires}
            </div>
          </>
        ) : (
          <>
            {/* Back — facility name */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding: compact ? '22px 16px 8px' : '28px 20px 12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: compact ? 13 : 15,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: '#0B3A7A',
                  textTransform: 'uppercase',
                }}
              >
                {facility}
              </div>
            </div>

            {/* QR */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
                padding: '8px 0 16px',
              }}
            >
              <QrMatrix payload={card.qrPayload || card.badgeId} size={compact ? 108 : 132} />
            </div>

            {/* Security notice */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '0 22px',
                textAlign: 'center',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#0B3A7A',
                  marginBottom: 8,
                }}
              >
                SECURITY NOTICE:
              </div>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: '#475569',
                  fontWeight: 500,
                }}
              >
                This card is the property of {facility.includes('ARISE') ? 'Arise MedCore Hospital' : card.facilityName}.
                If found, please return to the nearest security desk or call the number below.
                Unauthorized use is prohibited.
              </div>

              {/* People icon */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <svg width="44" height="28" viewBox="0 0 44 28" fill="none" aria-hidden>
                  <circle cx="14" cy="8" r="5" fill="#FB923C" />
                  <path d="M5 24c0-5 4-8 9-8s9 3 9 8v2H5v-2z" fill="#FB923C" />
                  <circle cx="28" cy="7" r="4.5" fill="#F59E0B" />
                  <path d="M21 24c0-4.5 3.2-7 7-7s7 2.5 7 7v2H21v-2z" fill="#F59E0B" />
                  <circle cx="36" cy="9" r="3.8" fill="#FBBF24" />
                  <path d="M31 24c0-3.5 2.5-5.5 5.5-5.5S42 20.5 42 24v2h-11v-2z" fill="#FBBF24" />
                </svg>
              </div>
            </div>

            {/* Contact row */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '10px 18px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 11,
                color: '#334155',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0EA5E9', fontSize: 13 }}>☎</span>
                <span>Emergency Contact: {emergencyContact || facilityPhone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0EA5E9', fontSize: 13 }}>✉</span>
                <span>{facilityEmail}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0EA5E9', fontSize: 13 }}>🌐</span>
                <span>{facilityWeb}</span>
              </div>
            </div>

            {/* Wave footer */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: 'auto',
                height: 28,
                background:
                  'linear-gradient(90deg, #0369A1 0%, #0EA5E9 35%, #14B8A6 70%, #F59E0B 100%)',
                clipPath:
                  'polygon(0 40%, 8% 30%, 18% 45%, 30% 25%, 42% 50%, 55% 20%, 68% 42%, 80% 28%, 90% 40%, 100% 22%, 100% 100%, 0 100%)',
              }}
            />
            <div
              style={{
                height: 10,
                background: 'linear-gradient(90deg, #0284C7, #0EA5E9 40%, #F97316)',
              }}
            />
          </>
        )}
      </div>

      {/* Flip control */}
      <button
        type="button"
        onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
        style={{
          border: '1px solid #E2E8F0',
          background: '#fff',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          color: '#0B3A7A',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
        }}
      >
        {side === 'front' ? 'Show back · QR & security' : 'Show front · Photo ID'}
      </button>
    </div>
  );
};

export default StaffIdCardView;
