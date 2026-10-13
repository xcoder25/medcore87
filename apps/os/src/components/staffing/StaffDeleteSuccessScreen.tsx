'use client';

/**
 * Full success screen after staff delete — card, Auth, force-logout confirmed.
 */

import React from 'react';
import { CheckCircle2, ShieldOff, IdCard, LogOut, X } from 'lucide-react';

export type StaffDeleteSuccessInfo = {
  name: string;
  badgeId: string;
  authDeleted?: boolean;
  authNote?: string;
};

interface Props {
  info: StaffDeleteSuccessInfo;
  onClose: () => void;
}

export const StaffDeleteSuccessScreen: React.FC<Props> = ({ info, onClose }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Staff deleted successfully"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 28px 64px rgba(0,0,0,0.28)',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #10B981 55%, #34D399 100%)',
            padding: '28px 24px 22px',
            color: '#fff',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              border: 'none',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <CheckCircle2 size={36} strokeWidth={2.2} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
            Staff removed
          </div>
          <h2 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Successfully deleted
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.95, lineHeight: 1.45 }}>
            <strong>{info.name}</strong> can no longer access this hospital.
          </p>
        </div>

        <div style={{ padding: '20px 22px 8px' }}>
          <div
            style={{
              background: '#F8FAFC',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              padding: '12px 14px',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Staff ID
            </div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: 16, color: '#0F172A', marginTop: 4 }}>
              {info.badgeId}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: IdCard, label: 'ID card & access removed', ok: true },
              {
                icon: ShieldOff,
                label: info.authDeleted
                  ? 'Firebase Auth deleted — login will show “user does not exist”'
                  : 'Auth cleanup attempted (check service account if still able to sign in)',
                ok: !!info.authDeleted,
              },
              { icon: LogOut, label: 'Any open session is force-logged out', ok: true },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: '#334155',
                  lineHeight: 1.4,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: row.ok ? '#ECFDF5' : '#FFFBEB',
                    color: row.ok ? '#059669' : '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <row.icon size={15} />
                </div>
                <span style={{ paddingTop: 4 }}>{row.label}</span>
              </div>
            ))}
          </div>

          {info.authNote && !info.authDeleted && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 12px',
                borderRadius: 10,
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: 12,
                color: '#92400E',
                lineHeight: 1.45,
              }}
            >
              {info.authNote}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 22px 22px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 12,
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #059669, #10B981)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(16,185,129,0.35)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffDeleteSuccessScreen;
