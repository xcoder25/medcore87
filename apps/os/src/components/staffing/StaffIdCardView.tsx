'use client';

import React from 'react';
import type { StaffCardRecord, StaffCardTemplate } from '@medcore/types';

const TEMPLATE_STYLE: Record<
  StaffCardTemplate,
  { stripe: string; chip: string; label: string }
> = {
  TPL_CLINICAL: {
    stripe: 'linear-gradient(90deg, #0066FF, #00D4A8)',
    chip: '#0066FF',
    label: 'Clinical',
  },
  TPL_CONSULTANT: {
    stripe: 'linear-gradient(90deg, #0A2540, #0066FF)',
    chip: '#0A2540',
    label: 'Consultant',
  },
  TPL_EXEC: {
    stripe: 'linear-gradient(90deg, #EA580C, #F59E0B)',
    chip: '#EA580C',
    label: 'Executive',
  },
  TPL_SUPPORT: {
    stripe: 'linear-gradient(90deg, #475569, #94A3B8)',
    chip: '#64748B',
    label: 'Support',
  },
  TPL_ICT: {
    stripe: 'linear-gradient(90deg, #0F172A, #00D4A8)',
    chip: '#0F172A',
    label: 'ICT',
  },
  TPL_VISITOR: {
    stripe: 'linear-gradient(90deg, #DC2626, #F97316)',
    chip: '#DC2626',
    label: 'Temporary',
  },
};

interface Props {
  card: StaffCardRecord;
  /** Compact for side panels */
  compact?: boolean;
}

export const StaffIdCardView: React.FC<Props> = ({ card, compact }) => {
  const tpl = TEMPLATE_STYLE[card.templateKey] || TEMPLATE_STYLE.TPL_CLINICAL;
  const statusColor =
    card.status === 'ACTIVE' ? '#16A34A' : card.status === 'SUSPENDED' ? '#EA580C' : '#EF4444';

  return (
    <div
      style={{
        width: compact ? '100%' : 360,
        maxWidth: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#0B1220',
        color: '#F8FAFC',
        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.35)',
        border: '1px solid rgba(148,163,184,0.2)',
        fontFamily: 'var(--os-font, Inter, system-ui, sans-serif)',
      }}
    >
      <div style={{ height: 6, background: tpl.stripe }} />
      <div style={{ padding: compact ? 14 : 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#94A3B8', textTransform: 'uppercase' }}>
              Hospital OS · Staff ID
            </div>
            <div style={{ fontSize: compact ? 15 : 17, fontWeight: 800, marginTop: 4 }}>{card.fullName}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{card.title}</div>
          </div>
          <div
            style={{
              width: compact ? 44 : 52,
              height: compact ? 44 : 52,
              borderRadius: 12,
              background: tpl.stripe,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: compact ? 14 : 16,
            }}
          >
            {card.initials}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            fontFamily: 'var(--os-font-mono, ui-monospace, monospace)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#5EEAD4',
          }}
        >
          {card.badgeId}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, fontSize: 11 }}>
          <div>
            <div style={{ color: '#64748B' }}>Department</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{card.department}</div>
          </div>
          <div>
            <div style={{ color: '#64748B' }}>Facility</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{card.facilityName}</div>
          </div>
          <div>
            <div style={{ color: '#64748B' }}>Clearance</div>
            <div style={{ marginTop: 2 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: `${tpl.chip}33`,
                  color: '#E2E8F0',
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                {card.clearanceLabel}
              </span>
            </div>
          </div>
          <div>
            <div style={{ color: '#64748B' }}>Status</div>
            <div style={{ fontWeight: 700, marginTop: 2, color: statusColor }}>{card.status}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.4 }}>
            <div>Template · {tpl.label}</div>
            <div>Valid until {card.expiresAt}</div>
            <div style={{ marginTop: 4 }}>Auth-linked · same ID on Clinic app</div>
          </div>
          {/* QR placeholder — payload is card.qrPayload; render lib optional */}
          <div
            title={card.qrPayload}
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              background: '#F8FAFC',
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 800,
              textAlign: 'center',
              padding: 4,
              lineHeight: 1.2,
            }}
          >
            QR
            <br />
            AUTH
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffIdCardView;
