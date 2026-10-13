'use client';

/**
 * First-time-use guide for each role — multi-step, dismissible, remembered per badge+role.
 */

import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  SkipForward,
  BookOpen,
  Compass,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  getRoleGuide,
  markRoleGuideSeen,
  type RoleGuide,
} from '../../lib/roleFirstRunGuide';
import { inferRoleKey } from '../../lib/staffCardStore';

interface Props {
  session: UserSession;
  onComplete: (opts?: { openModule?: string }) => void;
}

export const RoleFirstRunGuide: React.FC<Props> = ({ session, onComplete }) => {
  const roleKey = useMemo(
    () => inferRoleKey(session.roleKey || session.role || session.title, session.badgeId),
    [session]
  );
  const guide: RoleGuide = useMemo(() => getRoleGuide(roleKey), [roleKey]);
  const [step, setStep] = useState(0);
  const total = guide.steps.length;
  const current = guide.steps[step];
  const isLast = step >= total - 1;
  const firstName = (session.name || 'Colleague').split(' ')[0];

  const finish = (openModule?: string) => {
    markRoleGuideSeen(session.badgeId || session.id || '', roleKey);
    onComplete({ openModule: openModule || current?.module });
  };

  const skipAll = () => {
    markRoleGuideSeen(session.badgeId || session.id || '', roleKey);
    onComplete({});
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(1200px 600px at 10% -10%, ${guide.accentSoft}, transparent), linear-gradient(165deg, #0B1220 0%, #111827 45%, #0F172A 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 28px 18px',
            background: `linear-gradient(135deg, ${guide.accent} 0%, ${guide.accent}dd 100%)`,
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  opacity: 0.9,
                  marginBottom: 8,
                }}
              >
                <BookOpen size={14} /> First-time guide · {guide.roleLabel}
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Welcome, {firstName}
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.92, maxWidth: 480, lineHeight: 1.45 }}>
                {guide.tagline}
              </p>
            </div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Compass size={24} />
            </div>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
            {guide.steps.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 99,
                  background: i <= step ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.25)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
            Step {step + 1} of {total}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 28px 12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: guide.accentSoft,
              color: guide.accent,
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            <Sparkles size={12} /> How to use your desk
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {current.title}
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#334155' }}>{current.body}</p>
          {current.tip && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 12,
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: 13,
                color: '#92400E',
                lineHeight: 1.45,
              }}
            >
              <strong>Tip:</strong> {current.tip}
            </div>
          )}

          {/* Step list preview */}
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {guide.steps.map((s, i) => (
              <div
                key={s.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: i === step ? guide.accentSoft : 'transparent',
                  opacity: i < step ? 0.55 : 1,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: i < step ? '#10B981' : i === step ? guide.accent : '#E2E8F0',
                    color: i <= step ? '#fff' : '#64748B',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {i < step ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: i === step ? 700 : 500,
                    color: i === step ? '#0F172A' : '#64748B',
                  }}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderTop: '1px solid #F1F5F9',
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={skipAll}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 4px',
            }}
          >
            <SkipForward size={14} /> Skip guide
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                style={{
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  color: '#334155',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                style={{
                  border: 'none',
                  background: guide.accent,
                  color: '#fff',
                  borderRadius: 12,
                  padding: '10px 18px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: `0 8px 20px ${guide.accent}44`,
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finish(current?.module)}
                style={{
                  border: 'none',
                  background: guide.accent,
                  color: '#fff',
                  borderRadius: 12,
                  padding: '10px 18px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: `0 8px 20px ${guide.accent}44`,
                }}
              >
                Start working <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '0 28px 18px', fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
          {session.facility || session.hospitalId || 'Facility'} · {session.badgeId || 'Staff'} · shown once
        </div>
      </div>
    </div>
  );
};

export default RoleFirstRunGuide;
