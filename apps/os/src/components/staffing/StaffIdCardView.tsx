'use client';

/**
 * MedCore Hospital Staff ID Card — Dual-Side Security Credential.
 * Matches the navy-and-emerald official badge design with dynamic hospital logo,
 * two-tone hospital title, ECG divider, split badge ID pill, curved clearance wave,
 * and scannable back QR code.
 */
import React, { useMemo, useState } from 'react';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';
import { ScannableQrCode } from '../common/ScannableQrCode';
import { buildVerifyUrl } from '../../lib/qrPayload';
import { getAdminSettings } from '../../lib/adminSettingsStore';

const ACCESS_BAR: Record<
  StaffCardTemplate,
  { label: string; gradient: string }
> = {
  TPL_CLINICAL: {
    label: 'FULL ACCESS – CLINICAL',
    gradient: 'linear-gradient(90deg, #062C75 0%, #0284C7 48%, #00A86B 100%)',
  },
  TPL_CONSULTANT: {
    label: 'FULL ACCESS – CLINICAL',
    gradient: 'linear-gradient(90deg, #062C75 0%, #0369A1 48%, #059669 100%)',
  },
  TPL_EXEC: {
    label: 'FULL ACCESS – EXECUTIVE',
    gradient: 'linear-gradient(90deg, #0F172A 0%, #062C75 55%, #0D9488 100%)',
  },
  TPL_SUPPORT: {
    label: 'ACCESS – SUPPORT',
    gradient: 'linear-gradient(90deg, #062C75 0%, #0284C7 55%, #0D9488 100%)',
  },
  TPL_ICT: {
    label: 'ACCESS – ICT',
    gradient: 'linear-gradient(90deg, #0F172A 0%, #0284C7 60%, #10B981 100%)',
  },
  TPL_VISITOR: {
    label: 'TEMPORARY ACCESS',
    gradient: 'linear-gradient(90deg, #991B1B 0%, #DC2626 55%, #D97706 100%)',
  },
};

function formatDisplayDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function splitFacilityTitle(raw: string): { top: string; accent: string } {
  const clean = (raw || 'MEDCORE GENERAL HOSPITAL').replace(/,\s*.*$/, '').trim().toUpperCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { top: clean || 'HOSPITAL', accent: 'HOSPITAL' };
  const last = words[words.length - 1];
  const rest = words.slice(0, -1).join(' ');
  return { top: rest, accent: last };
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
  facilityLogoUrl?: string;
  facilityTagline?: string;
}

export const StaffIdCardView: React.FC<Props> = ({
  card,
  compact,
  emergencyContact,
  credentials,
  facilityPhone = '+234 809 555 0180',
  facilityEmail = 'info@medcore.ng',
  facilityWeb = 'www.medcore.ng',
  facilityLogoUrl,
  facilityTagline,
}) => {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const access = ACCESS_BAR[card.templateKey] || ACCESS_BAR.TPL_CLINICAL;
  const w = compact ? 266 : 326;
  const h = compact ? 430 : 518;
  const issued = formatDisplayDate(card.issuedAt);
  const expires = formatDisplayDate(card.expiresAt);

  const adminMeta = useMemo(() => {
    try {
      return getAdminSettings(card.facilityId);
    } catch {
      return null;
    }
  }, [card.facilityId]);

  const resolvedLogoUrl = facilityLogoUrl || adminMeta?.logoUrl || '';
  const resolvedFacilityRaw =
    adminMeta?.displayName || card.facilityName || 'IMMANUEL GENERAL HOSPITAL';
  const facilityParts = splitFacilityTitle(resolvedFacilityRaw);
  const facilityUpper = resolvedFacilityRaw.replace(/,\s*.*$/, '').toUpperCase();
  const mottoLines = (facilityTagline || 'Better Health.\nBrighter Tomorrow.').split('\n');

  const titleLine = card.title || card.role || 'Medical Officer';
  const deptLine = card.department || 'Clinical Services';
  const staffQrUrl = useMemo(() => {
    if (card.qrPayload && card.qrPayload.includes('/verify?t=')) {
      return card.qrPayload;
    }
    return buildVerifyUrl({
      k: 'staff',
      id: card.badgeId,
      fn: resolvedFacilityRaw,
      sub: titleLine,
      holder: card.fullName,
      iss: card.issuedAt ? card.issuedAt.slice(0, 10) : undefined,
      exp: card.expiresAt ? card.expiresAt.slice(0, 10) : undefined,
      st: 'ACTIVE',
    });
  }, [card, resolvedFacilityRaw, titleLine]);

  const displayName = credentials && !card.fullName.includes(credentials)
    ? card.fullName
    : card.fullName;

  const accessText = card.clearanceLabel
    ? card.clearanceLabel.toUpperCase().includes('ACCESS')
      ? card.clearanceLabel.toUpperCase()
      : access.label
    : access.label;

  const shell: React.CSSProperties = {
    width: w,
    height: h,
    maxWidth: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    background: 'linear-gradient(160deg, #FFFFFF 0%, #F4F9FF 55%, #E7F2FE 100%)',
    color: '#0C275B',
    boxShadow:
      '0 1px 0 rgba(255,255,255,0.85) inset, 0 20px 44px rgba(12, 39, 91, 0.18), 0 4px 12px rgba(2, 132, 199, 0.08)',
    border: '1px solid #DCE7F5',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const photoDiameter = compact ? 114 : 138;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={shell}>
        {/* Ambient background swooshes, medical crosses, top-left wave & subtle hospital illustration */}
        <svg
          aria-hidden="true"
          viewBox="0 0 326 518"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <defs>
            <linearGradient id="mcBadgeCornerTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#04225B" />
              <stop offset="65%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#00A86B" />
            </linearGradient>
            <linearGradient id="mcBadgeSwoosh" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          {/* Top-left accent ribbon */}
          <path d="M0 0 L86 0 C54 14 28 38 0 68 Z" fill="url(#mcBadgeCornerTop)" />
          <path d="M0 68 C22 44 46 22 76 6 L64 0 C34 18 14 38 0 56 Z" fill="#FFFFFF" opacity="0.72" />
          {/* Soft translucent swooshes */}
          <path d="M0 92 Q90 60 190 120 T326 95 L326 230 Q210 190 95 235 T0 200 Z" fill="url(#mcBadgeSwoosh)" />
          <path d="M120 355 Q230 270 326 300 L326 420 Q235 395 120 420 Z" fill="#93C5FD" opacity="0.22" />
          {/* Left faded cross */}
          <g fill="#DBEAFE" opacity="0.75" transform="translate(18, 178)">
            <rect x="8" y="0" width="7" height="23" rx="1.5" />
            <rect x="0" y="8" width="23" height="7" rx="1.5" />
          </g>
          <g fill="#DBEAFE" opacity="0.65" transform="translate(46, 136)">
            <rect x="11" y="0" width="10" height="32" rx="2" />
            <rect x="0" y="11" width="32" height="10" rx="2" />
          </g>
          {/* Right faded cross cluster */}
          <g fill="#DBEAFE" opacity="0.7" transform="translate(242, 134)">
            <rect x="16" y="0" width="14" height="46" rx="3" />
            <rect x="0" y="16" width="46" height="14" rx="3" />
          </g>
          <g fill="#DBEAFE" opacity="0.6" transform="translate(278, 184)">
            <rect x="9" y="0" width="8" height="26" rx="2" />
            <rect x="0" y="9" width="26" height="8" rx="2" />
          </g>
          {/* Faint hospital building silhouette on lower right */}
          <g transform="translate(222, 336)" opacity="0.14" fill="#1E3A8A">
            <rect x="26" y="12" width="72" height="60" rx="2" />
            <rect x="6" y="28" width="24" height="44" rx="1.5" />
            <rect x="54" y="4" width="16" height="8" rx="1" />
            <g fill="#FFFFFF" opacity="0.85">
              <rect x="33" y="20" width="9" height="8" />
              <rect x="47" y="20" width="9" height="8" />
              <rect x="61" y="20" width="9" height="8" />
              <rect x="75" y="20" width="9" height="8" />
              <rect x="33" y="34" width="9" height="8" />
              <rect x="47" y="34" width="9" height="8" />
              <rect x="61" y="34" width="9" height="8" />
              <rect x="75" y="34" width="9" height="8" />
            </g>
          </g>
        </svg>

        {side === 'front' ? (
          <>
            {/* Top 3-column Header: Logo Box | Hospital Name | Motto + Green Swoosh */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: compact ? 6 : 8,
                padding: compact ? '16px 12px 6px' : '20px 14px 8px',
              }}
            >
              {/* Logo container */}
              <div
                style={{
                  width: compact ? 42 : 48,
                  height: compact ? 42 : 48,
                  borderRadius: 9,
                  border: resolvedLogoUrl ? '1.5px solid #BFDBFE' : '1.5px dashed #334155',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  padding: resolvedLogoUrl ? 2 : 3,
                }}
              >
                {resolvedLogoUrl ? (
                  <img
                    src={resolvedLogoUrl}
                    alt="Hospital Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <>
                    <svg width={compact ? 18 : 20} height={compact ? 14 : 16} viewBox="0 0 24 18" fill="none" aria-hidden>
                      <rect x="1.5" y="1.5" width="21" height="15" rx="2" stroke="#1E3A8A" strokeWidth="1.6" />
                      <circle cx="8" cy="6.5" r="1.6" fill="#0284C7" />
                      <path d="M3.5 14l5-4.8 3.6 3.2 3.2-3 5.2 4.6" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: 6.2, fontWeight: 800, color: '#1E293B', lineHeight: 1.05, textAlign: 'center', marginTop: 2 }}>
                      HOSPITAL<br />LOGO
                    </span>
                  </>
                )}
              </div>

              <div style={{ width: 1, height: 34, background: '#94A3B8', opacity: 0.45, flexShrink: 0 }} />

              {/* Hospital Two-Tone Name */}
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.08 }}>
                <div
                  style={{
                    fontSize: compact ? 9.5 : 11,
                    fontWeight: 900,
                    color: '#0C275B',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={facilityUpper}
                >
                  {facilityParts.top}
                </div>
                <div
                  style={{
                    fontSize: compact ? 11.5 : 13.5,
                    fontWeight: 900,
                    color: '#0E8F6A',
                    letterSpacing: '0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {facilityParts.accent}
                </div>
              </div>

              <div style={{ width: 1, height: 30, background: '#CBD5E1', flexShrink: 0 }} />

              {/* Motto with green underline curve */}
              <div style={{ flexShrink: 0, textAlign: 'left', maxWidth: compact ? 74 : 88 }}>
                <div
                  style={{
                    fontSize: compact ? 7 : 8,
                    fontWeight: 700,
                    fontStyle: 'italic',
                    color: '#0C275B',
                    lineHeight: 1.15,
                  }}
                >
                  {mottoLines[0]}
                  {mottoLines[1] && (
                    <>
                      <br />
                      {mottoLines[1]}
                    </>
                  )}
                </div>
                <svg width="100%" height="5" viewBox="0 0 80 5" preserveAspectRatio="none" aria-hidden style={{ display: 'block', marginTop: 2 }}>
                  <path d="M1 3.8 Q42 0.2 79 2.2 Q42 3.4 1 4.4 Z" fill="#10B981" />
                </svg>
              </div>
            </div>

            {/* Centered Circular Portrait with Blue-to-Emerald Gradient Ring */}
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
                  width: photoDiameter,
                  height: photoDiameter,
                  borderRadius: '50%',
                  padding: 4.5,
                  background: 'linear-gradient(135deg, #003E9C 0%, #0EA5E9 48%, #00A86B 100%)',
                  boxShadow: '0 8px 24px rgba(12, 39, 91, 0.16)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#EAF2FA',
                    border: '3.5px solid #FFFFFF',
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
                    <svg width={photoDiameter * 0.68} height={photoDiameter * 0.68} viewBox="0 0 80 80" fill="none" aria-hidden>
                      <circle cx="40" cy="27" r="15" fill="#0B2E67" />
                      <path d="M12 69c2.5-15.5 14-23.5 28-23.5s25.5 8 28 23.5" fill="#0B2E67" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Name, Role Pill, ECG Line divider, Department, Split ID Pill */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '4px 16px 0',
              }}
            >
              <div
                style={{
                  fontSize: compact ? 18 : 22,
                  fontWeight: 900,
                  color: '#0C275B',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
              >
                {displayName}
              </div>

              {/* Sky-blue Role Pill */}
              <div
                style={{
                  marginTop: 6,
                  background: '#DCEBFA',
                  color: '#0C275B',
                  fontSize: compact ? 11 : 12.5,
                  fontWeight: 700,
                  padding: '4px 14px',
                  borderRadius: 999,
                  maxWidth: '94%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {titleLine}
              </div>

              {/* ECG Heartbeat Divider */}
              <div
                style={{
                  marginTop: compact ? 6 : 8,
                  width: '82%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ flex: 1, height: 1.5, background: '#93C5FD' }} />
                <svg width="42" height="16" viewBox="0 0 42 16" fill="none" aria-hidden>
                  <path
                    d="M1 9 H11 L14 6 L17.5 14 L21.5 1.5 L25 12.5 L27.5 9 H41"
                    stroke="#0F9D6E"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div style={{ flex: 1, height: 1.5, background: '#93C5FD' }} />
              </div>

              {/* Department */}
              <div
                style={{
                  marginTop: compact ? 3 : 4,
                  fontSize: compact ? 12 : 13.5,
                  fontWeight: 800,
                  color: '#0C275B',
                }}
              >
                {deptLine}
              </div>

              {/* Split Badge ID Pill */}
              <div
                style={{
                  marginTop: compact ? 8 : 10,
                  display: 'inline-flex',
                  alignItems: 'stretch',
                  borderRadius: 999,
                  border: '1.5px solid #0C275B',
                  overflow: 'hidden',
                  background: '#FFFFFF',
                  boxShadow: '0 2px 6px rgba(12, 39, 91, 0.08)',
                }}
              >
                <div
                  style={{
                    background: '#082D6B',
                    color: '#FFFFFF',
                    padding: compact ? '4px 10px' : '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="12" viewBox="0 0 20 14" fill="none" aria-hidden>
                    <rect x="1" y="1" width="18" height="12" rx="2" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="6.2" cy="5.8" r="1.8" fill="#FFFFFF" />
                    <path d="M3.5 10.6c.6-1.5 1.7-2.2 2.7-2.2s2.1.7 2.7 2.2" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
                    <line x1="11" y1="5" x2="16.5" y2="5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1="11" y1="8.2" x2="15" y2="8.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div
                  style={{
                    padding: compact ? '4px 12px' : '5px 14px',
                    fontSize: compact ? 11 : 12.5,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ color: '#0C275B' }}>ID:</span>
                  <span style={{ color: '#0F9D6E' }}>{card.badgeId}</span>
                </div>
              </div>

              {(card.practicingLicenseNo || card.civilServiceId) && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: compact ? 8.5 : 9.5,
                    fontWeight: 700,
                    color: '#0369A1',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  {[
                    card.regulatoryBody && card.regulatoryBody !== 'NONE' && card.practicingLicenseNo
                      ? `${card.regulatoryBody}: ${card.practicingLicenseNo}`
                      : card.practicingLicenseNo || '',
                    card.civilServiceId ? `GOV: ${card.civilServiceId}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>

            {/* Curved Navy-to-Emerald Clearance Banner */}
            <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto' }}>
              <svg
                aria-hidden="true"
                viewBox="0 0 326 68"
                preserveAspectRatio="none"
                style={{ width: '100%', height: compact ? 52 : 60, display: 'block' }}
              >
                <defs>
                  <linearGradient id="mcAccessWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#042562" />
                    <stop offset="48%" stopColor="#0284C7" />
                    <stop offset="100%" stopColor="#00A86B" />
                  </linearGradient>
                </defs>
                <path d="M0 10 C86 24 218 -4 326 14 L326 52 C226 66 104 42 0 58 Z" fill="url(#mcAccessWave)" />
                <path d="M0 12 C86 26 218 -2 326 16" stroke="#7DD3FC" strokeWidth="2.5" fill="none" opacity="0.65" />
                <path d="M0 58 C104 42 226 66 326 52 L326 68 L0 68 Z" fill="#FFFFFF" />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '0 14px 4px',
                  color: '#FFFFFF',
                }}
              >
                <svg width={compact ? 18 : 20} height={compact ? 20 : 22} viewBox="0 0 24 26" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                  <path
                    d="M12 1.5L21 5v6.8c0 5.6-3.9 10.6-9 12.2C6.9 22.4 3 17.4 3 11.8V5l9-3.5z"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <rect x="8.8" y="11" width="6.4" height="5" rx="1" fill="#FFFFFF" />
                  <path d="M10.2 11V9.5a1.8 1.8 0 113.6 0V11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div style={{ width: 1.5, height: 18, background: 'rgba(255,255,255,0.65)' }} />
                <span
                  style={{
                    fontSize: compact ? 10.5 : 12,
                    fontWeight: 900,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }}
                >
                  {accessText}
                </span>
              </div>
            </div>

            {/* Footer Dates + Bottom-Right Wave Accent */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                padding: compact ? '6px 12px 12px' : '7px 14px 14px',
                fontSize: compact ? 9.5 : 10.5,
                fontWeight: 700,
                color: '#0C275B',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <rect x="2" y="3" width="12" height="11" rx="2" stroke="#0C275B" strokeWidth="1.5" />
                  <line x1="2" y1="6.5" x2="14" y2="6.5" stroke="#0C275B" strokeWidth="1.4" />
                  <line x1="5" y1="1.5" x2="5" y2="4" stroke="#0C275B" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="11" y1="1.5" x2="11" y2="4" stroke="#0C275B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>Issued: {issued}</span>
              </span>
              <span style={{ width: 1, height: 14, background: '#CBD5E1' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="6.5" stroke="#0F9D6E" strokeWidth="1.6" />
                  <path d="M5 8.2l2 2 4-4" stroke="#0F9D6E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Valid until: {expires}</span>
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 120 20"
                preserveAspectRatio="none"
                style={{ position: 'absolute', right: 0, bottom: 0, width: 120, height: 16, pointerEvents: 'none' }}
              >
                <defs>
                  <linearGradient id="mcBadgeCornerBot" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0284C7" />
                    <stop offset="100%" stopColor="#00A86B" />
                  </linearGradient>
                </defs>
                <path d="M0 20 C42 18 84 8 120 0 L120 20 Z" fill="url(#mcBadgeCornerBot)" />
              </svg>
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
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  color: '#0C275B',
                  textTransform: 'uppercase',
                }}
              >
                {facilityUpper}
              </div>
            </div>

            {/* QR */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
                padding: '8px 0 14px',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  padding: 8,
                  borderRadius: 12,
                  border: '1.5px solid #BFDBFE',
                  boxShadow: '0 4px 12px rgba(12, 39, 91, 0.08)',
                }}
              >
                <ScannableQrCode
                  value={staffQrUrl}
                  size={compact ? 94 : 118}
                  level="M"
                  fgColor="#0C275B"
                  bgColor="#FFFFFF"
                  quietZone={4}
                  ariaLabel={`Staff verification QR for ${card.badgeId}`}
                />
              </div>
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
                  color: '#0C275B',
                  marginBottom: 8,
                }}
              >
                SECURITY NOTICE
              </div>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: '#334155',
                  fontWeight: 500,
                }}
              >
                This credential is the official property of {resolvedFacilityRaw}.
                If found, return to Hospital Security Desk or call the contact line below.
                Unauthorized reproduction or transfer is strictly prohibited.
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
                color: '#1E293B',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0284C7', fontSize: 13 }}>☎</span>
                <span>Security Desk: {emergencyContact || adminMeta?.emergencyPhone || adminMeta?.phone || facilityPhone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0284C7', fontSize: 13 }}>✉</span>
                <span>{facilityEmail}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#0F9D6E', fontSize: 13 }}>🌐</span>
                <span>{facilityWeb}</span>
              </div>
            </div>

            {/* Navy-to-Emerald wave footer */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: 'auto',
                height: 26,
                background: 'linear-gradient(90deg, #062C75 0%, #0284C7 52%, #00A86B 100%)',
                clipPath:
                  'polygon(0 42%, 12% 28%, 26% 45%, 42% 22%, 58% 44%, 74% 24%, 88% 38%, 100% 20%, 100% 100%, 0 100%)',
              }}
            />
            <div
              style={{
                height: 8,
                background: 'linear-gradient(90deg, #062C75 0%, #0284C7 50%, #00A86B 100%)',
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
          border: '1px solid #CBD5E1',
          background: '#fff',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          color: '#0C275B',
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
