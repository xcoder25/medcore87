'use client';

import React, { useRef, useState } from 'react';
import {
  Shield, AlertTriangle, QrCode, RefreshCw, Printer, Download,
  Sparkles, CheckCircle2, Lock, Eye, Zap, Radio, Phone, Activity
} from 'lucide-react';
import type { StatewideHealthCard } from '../../lib/stateHealthCardService';

interface Props {
  card: StatewideHealthCard;
  photoUrl?: string;
  onFlip?: () => void;
  showBackDefault?: boolean;
}

export const StatewideHealthCardRenderer: React.FC<Props> = ({
  card,
  photoUrl,
  onFlip,
  showBackDefault = false,
}) => {
  const [flipped, setFlipped] = useState(showBackDefault);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const toggleFlip = () => {
    setFlipped(!flipped);
    onFlip?.();
  };

  // High-Resolution CR80 Canvas Export (300 DPI: 1013 x 638 px)
  const handleExportCr80 = () => {
    setIsExporting(true);
    const canvas = document.createElement('canvas');
    canvas.width = 1013;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    // 1. Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1013, 638);
    bgGrad.addColorStop(0, '#052A20');
    bgGrad.addColorStop(0.35, '#083B2E');
    bgGrad.addColorStop(0.75, '#05231B');
    bgGrad.addColorStop(1, '#02130F');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1013, 638);

    // 2. Amber/gold ambient light beams
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 600);
    ctx.lineTo(800, 0);
    ctx.lineTo(860, 0);
    ctx.lineTo(0, 638);
    ctx.closePath();
    const beamGrad = ctx.createLinearGradient(0, 600, 800, 0);
    beamGrad.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
    beamGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.45)');
    beamGrad.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
    ctx.fillStyle = beamGrad;
    ctx.fill();
    ctx.restore();

    // 3. Header: ARISE logo text
    ctx.fillStyle = '#F97316';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('▲ ARISE', 45, 52);
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('HEALTH INITIATIVE', 45, 74);

    // 4. Header: M+ logo mark on right
    ctx.fillStyle = '#06B6D4';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('M+', 910, 56);
    ctx.fillStyle = '#10B981';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('MEDCORE OS', 860, 74);

    // 5. Card Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.fillText('DIGITAL HEALTH CARD', 45, 130);

    // Subtle divider
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(45, 145);
    ctx.lineTo(580, 145);
    ctx.stroke();

    // 6. Data fields
    const drawField = (label: string, val: string, yPos: number) => {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(label.toUpperCase(), 85, yPos);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillText(val, 85, yPos + 28);

      // Icon placeholder dot
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(60, yPos + 14, 8, 0, Math.PI * 2);
      ctx.fill();
    };

    drawField('Patient Full Name', card.fullName, 195);
    drawField('Unique Patient ID / MRN', card.shid, 280);
    drawField('Date of Birth', card.dob, 365);
    drawField('Gender', card.gender, 450);

    // 7. Bottom bar
    // Emergency Shield
    if (card.emergencyFlag) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(60, 560, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('+', 55, 566);
    } else {
      ctx.strokeStyle = '#14B8A6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(60, 560, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('ISSUE DATE', 120, 550);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(card.issueDate, 120, 574);

    ctx.fillText('|', 250, 574);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('EXPIRY DATE', 280, 550);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(card.expiryDate, 280, 574);

    // 8. Right Patient Photo Frame with glowing halo
    const avatarCenterX = 790;
    const avatarCenterY = 320;
    const avatarRadius = 130;

    // Outer amber glow
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#F97316';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner cyan ring
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Fill inner background
    ctx.fillStyle = '#062019';
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius - 4, 0, Math.PI * 2);
    ctx.fill();

    // Silhouette icon on canvas
    ctx.fillStyle = '#1E3A32';
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY - 20, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY + 110, 85, Math.PI, 0, false);
    ctx.fill();

    // 9. Download trigger
    const link = document.createElement('a');
    link.download = `CR80-HealthCard-${card.shid}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsExporting(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 540, margin: '0 auto' }}>
      {/* 3D Flip Card Container */}
      <div
        className="state-health-card-container"
        style={{
          perspective: 1200,
          cursor: 'pointer',
          borderRadius: 22,
          transition: 'transform 0.2s ease',
        }}
        onClick={toggleFlip}
        title="Click to flip card"
      >
        <div
          className="state-health-card-inner"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1.586 / 1', // Exact CR80 standard
            borderRadius: 20,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            boxShadow: '0 24px 60px -12px rgba(4, 35, 27, 0.55), 0 0 0 1px rgba(52, 211, 153, 0.2)',
          }}
        >
          {/* ═══════════════════════════════════════════════
              CARD FRONT: Exact match to ARISE Digital Health Card
              ═══════════════════════════════════════════════ */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #052A20 0%, #083B2E 35%, #05231B 75%, #02130F 100%)',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 28px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              boxSizing: 'border-box',
              userSelect: 'none',
            }}
          >
            {/* Dynamic Light Streaks / Lens Flare Overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `
                  radial-gradient(ellipse 65% 50% at 20% 85%, rgba(245, 158, 11, 0.25) 0%, transparent 60%),
                  linear-gradient(55deg, transparent 40%, rgba(249, 115, 22, 0.18) 50%, rgba(251, 191, 36, 0.22) 53%, transparent 62%),
                  linear-gradient(42deg, transparent 48%, rgba(245, 158, 11, 0.12) 52%, transparent 58%)
                `,
                pointerEvents: 'none',
              }}
            />

            {/* Subtle holographic sheen lines */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 10px)',
                pointerEvents: 'none',
              }}
            />

            {/* ── TOP HEADER: ARISE Logo (Left) + M+ Logo (Right) ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
              {/* Left: ARISE Logo & Wordmark */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Three Figures Symbol */}
                  <svg width="34" height="22" viewBox="0 0 48 30" fill="none">
                    <circle cx="24" cy="7" r="4.5" fill="#F97316" />
                    <path d="M16 26c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="10" cy="11" r="3.5" fill="#FBBF24" />
                    <path d="M3 27c0-3.5 2.8-6.5 7-6.5s6 3 6 6.5" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="38" cy="11" r="3.5" fill="#FBBF24" />
                    <path d="M32 27c0-3.5 2.8-6.5 6-6.5s7 3 7 6.5" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 18,
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    color: '#34D399',
                    marginTop: 2,
                    textShadow: '0 2px 10px rgba(52, 211, 153, 0.35)',
                  }}
                >
                  ARISE
                </span>
              </div>

              {/* Right: M+ Logo with Pulse Line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg width="44" height="32" viewBox="0 0 60 40" fill="none">
                    <defs>
                      <linearGradient id="mGrad" x1="0" y1="0" x2="60" y2="40" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#06B6D4" />
                        <stop offset="0.5" stopColor="#0EA5E9" />
                        <stop offset="1" stopColor="#10B981" />
                      </linearGradient>
                    </defs>
                    {/* Bold 3D Stylized M */}
                    <path
                      d="M8 34V10L24 24L40 10V34"
                      stroke="url(#mGrad)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Centered White Medical Plus (+) */}
                    <rect x="22" y="16" width="4" height="12" rx="2" fill="#FFFFFF" />
                    <rect x="18" y="20" width="12" height="4" rx="2" fill="#FFFFFF" />
                  </svg>
                </div>
                {/* Cyan EKG Pulse Line */}
                <svg width="48" height="10" viewBox="0 0 60 14" fill="none" style={{ marginTop: -2 }}>
                  <path
                    d="M0 7H20L25 1L30 13L35 4L40 9L45 7H60"
                    stroke="#06B6D4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* ── CARD TITLE & SEPARATOR ── */}
            <div style={{ position: 'relative', zIndex: 2, marginTop: -4 }}>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  letterSpacing: '0.03em',
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                }}
              >
                Digital Health Card
              </div>
              <div
                style={{
                  height: 1.5,
                  width: '62%',
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.7) 0%, rgba(52, 211, 153, 0.4) 70%, transparent 100%)',
                  marginTop: 6,
                }}
              />
            </div>

            {/* ── MIDDLE BODY: Patient Fields (Left) + Circular Avatar (Right) ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, margin: '2px 0' }}>
              {/* Left Column: Patient Demographic Pointers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {/* Row 1: Patient Full Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: '#F97316', display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Patient Full Name
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', marginTop: 1 }}>
                      {card.fullName || 'Alex Rivera'}
                    </div>
                  </div>
                </div>

                {/* Row 2: Unique Patient ID / MRN (SHID) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: '#F97316', display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="7" y1="8" x2="17" y2="8" />
                      <line x1="7" y1="12" x2="13" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Unique Patient ID / MRN
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'monospace', color: '#FFFFFF', letterSpacing: '0.04em', marginTop: 1 }}>
                      {card.shid}
                    </div>
                  </div>
                </div>

                {/* Row 3: Date of Birth */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: '#F97316', display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Date of Birth
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginTop: 1 }}>
                      {card.dob || '15 March 1992'}
                    </div>
                  </div>
                </div>

                {/* Row 4: Gender */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ color: '#F97316', display: 'flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <circle cx="12" cy="10" r="5" />
                      <path d="M12 15v7M9 19h6" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Gender
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginTop: 1 }}>
                      {card.gender}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Circular Photo with Radiant Orange Halo & Cyan Ring */}
              <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Glowing Outer Amber Ring */}
                <div
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    background: 'conic-gradient(from 180deg at 50% 50%, #F59E0B 0deg, #F97316 120deg, #EA580C 240deg, #F59E0B 360deg)',
                    boxShadow: '0 0 24px rgba(245, 158, 11, 0.45)',
                  }}
                />
                {/* Inner Cyan Border */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 1,
                    borderRadius: '50%',
                    background: '#041E17',
                    border: '3px solid #06B6D4',
                  }}
                />
                {/* Avatar Image or Styled Silhouette */}
                <div
                  style={{
                    position: 'relative',
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'radial-gradient(circle at 50% 40%, #134E3F 0%, #06231C 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt={card.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="68" height="68" viewBox="0 0 24 24" fill="#041E17">
                      <circle cx="12" cy="8" r="4.5" fill="#0A382C" />
                      <path d="M4 21c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5" fill="#0A382C" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* ── BOTTOM ROW: Emergency Flag + Issue/Expiry Dates + ECG Pulse ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 2,
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* Emergency Flag UI Indicator (Medical Shield with Cross) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  borderRadius: 10,
                  background: card.emergencyFlag ? 'rgba(239, 68, 68, 0.25)' : 'rgba(20, 184, 166, 0.15)',
                  border: card.emergencyFlag ? '1px solid #EF4444' : '1px solid #14B8A6',
                  boxShadow: card.emergencyFlag ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
                }}
                title={card.emergencyFlag ? `EMERGENCY ALERT: ${card.emergencyReasons.join(', ')}` : 'Zero critical conditions'}
              >
                <div style={{ color: card.emergencyFlag ? '#EF4444' : '#14B8A6' }}>
                  <Shield size={18} fill={card.emergencyFlag ? '#EF4444' : 'none'} />
                </div>
                {card.emergencyFlag && (
                  <span style={{ fontSize: 9.5, fontWeight: 900, color: '#FCA5A5', letterSpacing: '0.04em' }}>
                    EMERGENCY ALERT
                  </span>
                )}
              </div>

              {/* Dates */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Issue Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ color: '#F97316' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Issue Date</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF' }}>{card.issueDate}</div>
                  </div>
                </div>

                <div style={{ width: 1, height: 22, background: 'rgba(255, 255, 255, 0.15)' }} />

                {/* Expiry Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ color: '#F97316' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Expiry Date</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF' }}>{card.expiryDate}</div>
                  </div>
                </div>
              </div>

              {/* Right: Stylized Heartbeat Target Icon */}
              <div style={{ display: 'flex', alignItems: 'center', color: '#10B981' }}>
                <svg width="42" height="20" viewBox="0 0 54 24" fill="none">
                  <path
                    d="M2 12H14L18 3L23 21L28 8L32 15L36 12H44"
                    stroke="#14B8A6"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="48" cy="12" r="4.5" stroke="#F97316" strokeWidth="2" fill="none" />
                </svg>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════
              CARD BACK: Exact Match to SECURE IDENTITY TOKEN Specification
              ═══════════════════════════════════════════════ */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 20,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #041E17 0%, #062820 35%, #052A32 75%, #071F29 100%)',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 28px',
              transform: 'rotateY(180deg)',
              boxSizing: 'border-box',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              userSelect: 'none',
            }}
          >
            {/* Dynamic Gold Light Streaks / Lens Flare Rays across the back */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `
                  radial-gradient(ellipse 60% 45% at 85% 55%, rgba(245, 158, 11, 0.18) 0%, transparent 60%),
                  linear-gradient(42deg, transparent 40%, rgba(249, 115, 22, 0.22) 50%, rgba(251, 191, 36, 0.28) 54%, transparent 64%),
                  linear-gradient(55deg, transparent 48%, rgba(245, 158, 11, 0.15) 52%, transparent 60%)
                `,
                pointerEvents: 'none',
              }}
            />

            {/* ── TOP HEADER: SECURE IDENTITY TOKEN ── */}
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                }}
              >
                Secure Identity Token
              </div>
              <div
                style={{
                  height: 1.5,
                  width: '56%',
                  background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.7) 0%, rgba(52, 211, 153, 0.5) 80%, transparent 100%)',
                  margin: '6px 0 10px',
                }}
              />
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.01em' }}>
                {card.fullName} – {card.shid ? `+1 (555) 123-4567` : '+234 802 000 7842'}
              </div>
            </div>

            {/* ── MIDDLE BODY: Facility Info & Disclaimer (Left) + Large QR Code (Right) ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, position: 'relative', zIndex: 2 }}>
              {/* Left Column: Contact & Legal Disclaimer */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Facility Contact Info */}
                <div style={{ fontSize: 10, lineHeight: 1.45, color: '#E2E8F0' }}>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', marginBottom: 2 }}>Facility Contact Info:</div>
                  <div style={{ fontWeight: 700 }}>ARISE Medical Network</div>
                  <div style={{ color: '#CBD5E1' }}>1250 Health Avenue, Suite 400</div>
                  <div style={{ color: '#CBD5E1' }}>Phone: +1 (800) 555-ARISE</div>
                  <div style={{ color: '#38BDF8', fontWeight: 600 }}>www.arisemedical.com</div>
                </div>

                {/* Privacy & Legal Notice */}
                <div style={{ fontSize: 8.5, color: '#94A3B8', lineHeight: 1.4, maxWidth: 280, marginTop: 2 }}>
                  This card is non-transferable and contains no medical information. Authorized emergency personnel only may scan the QR code to access a restricted Emergency Summary. If found, please return to any ARISE facility or call the number above.
                </div>
              </div>

              {/* Right Column: Crisp White Patch with High-Density QR Code */}
              <div
                style={{
                  padding: 8,
                  background: '#FFFFFF',
                  borderRadius: 12,
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="114" height="114" viewBox="0 0 114 114" fill="#031A14">
                  {/* Outer corner finder patterns */}
                  <rect x="6" y="6" width="32" height="32" rx="4" fill="#031A14" />
                  <rect x="11" y="11" width="22" height="22" rx="2" fill="#FFFFFF" />
                  <rect x="16" y="16" width="12" height="12" rx="1" fill="#031A14" />

                  <rect x="76" y="6" width="32" height="32" rx="4" fill="#031A14" />
                  <rect x="81" y="11" width="22" height="22" rx="2" fill="#FFFFFF" />
                  <rect x="86" y="16" width="12" height="12" rx="1" fill="#031A14" />

                  <rect x="6" y="76" width="32" height="32" rx="4" fill="#031A14" />
                  <rect x="11" y="81" width="22" height="22" rx="2" fill="#FFFFFF" />
                  <rect x="16" y="86" width="12" height="12" rx="1" fill="#031A14" />

                  {/* High-density micro-data matrix dots */}
                  <rect x="44" y="10" width="6" height="6" />
                  <rect x="54" y="14" width="6" height="6" />
                  <rect x="64" y="8" width="6" height="6" />
                  <rect x="44" y="24" width="6" height="6" />
                  <rect x="56" y="28" width="6" height="6" />
                  <rect x="64" y="22" width="6" height="6" />

                  <rect x="10" y="44" width="6" height="6" />
                  <rect x="22" y="52" width="6" height="6" />
                  <rect x="32" y="46" width="6" height="6" />
                  <rect x="44" y="46" width="6" height="6" />
                  <rect x="54" y="52" width="6" height="6" />
                  <rect x="64" y="44" width="6" height="6" />
                  <rect x="76" y="48" width="6" height="6" />
                  <rect x="88" y="44" width="6" height="6" />
                  <rect x="98" y="52" width="6" height="6" />

                  <rect x="44" y="64" width="6" height="6" />
                  <rect x="54" y="70" width="6" height="6" />
                  <rect x="66" y="62" width="6" height="6" />
                  <rect x="44" y="82" width="6" height="6" />
                  <rect x="56" y="88" width="6" height="6" />
                  <rect x="66" y="80" width="6" height="6" />
                  <rect x="78" y="72" width="6" height="6" />
                  <rect x="90" y="80" width="6" height="6" />
                  <rect x="98" y="92" width="6" height="6" />
                  <rect x="76" y="94" width="6" height="6" />
                  <rect x="86" y="102" width="6" height="6" />
                </svg>
              </div>
            </div>

            {/* ── BOTTOM FOOTER: ARISE Logo (Left) + Gold 3D "M" Emblem (Right) ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 2, paddingTop: 4 }}>
              {/* Bottom Left: ARISE Medical Network Wordmark */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="8" r="4" fill="#F59E0B" />
                  <path d="M10 26c0-5 3.5-9 8-9s8 4 8 9" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                  <path d="M7 16L12 21" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M29 16L24 21" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', color: '#FFFFFF' }}>
                    ARISE
                  </div>
                  <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.09em', color: '#F59E0B', textTransform: 'uppercase' }}>
                    Medical Network
                  </div>
                </div>
              </div>

              {/* Bottom Right: Gold 3D Metallic "M" Logo */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="34" height="26" viewBox="0 0 44 32" fill="none">
                  <defs>
                    <linearGradient id="goldMGrad" x1="0" y1="0" x2="44" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#FDE68A" />
                      <stop offset="0.4" stopColor="#F59E0B" />
                      <stop offset="0.8" stopColor="#D97706" />
                      <stop offset="1" stopColor="#92400E" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M4 28V6L18 20L28 10L36 28"
                    stroke="url(#goldMGrad)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M26 12L38 28"
                    stroke="#B45309"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar Beneath Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          padding: '0 4px',
        }}
      >
        <button
          type="button"
          onClick={toggleFlip}
          className="os-ghost-btn"
          style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} /> Flip {flipped ? 'to Front' : 'to Back (QR / Security)'}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleExportCr80}
            disabled={isExporting}
            className="os-primary-btn"
            style={{
              fontSize: 12,
              padding: '7px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
            }}
          >
            <Download size={14} /> {isExporting ? 'Generating CR80…' : 'Export CR80 (300 DPI)'}
          </button>
        </div>
      </div>
    </div>
  );
};
