'use client';

import React, { useMemo, useState } from 'react';
import {
  X, User, Building2, ShieldCheck, Key, LogOut, Clock,
  CreditCard, CheckCircle2, Copy, Check, Shield, Briefcase
} from 'lucide-react';
import type { UserSession } from './AuthScreen';
import { StaffIdCardView } from '../staffing/StaffIdCardView';
import { getStaffCard, listStaffCards } from '../../lib/staffCardStore';
import type { StaffCardRecord } from '@medcore/types';

interface UserProfileModalProps {
  session: UserSession;
  isOpen: boolean;
  onClose: () => void;
  onOpenCredentials?: () => void;
  onLogout?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  session,
  isOpen,
  onClose,
  onOpenCredentials,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'card'>('profile');
  const [copiedBadge, setCopiedBadge] = useState(false);

  // Compute staff card for ID Card tab
  const card = useMemo<StaffCardRecord | null>(() => {
    if (!session) return null;
    const badge = (session.badgeId || '').trim().toUpperCase();
    if (badge) {
      const hit = getStaffCard(badge);
      if (hit) return hit;
    }
    const name = (session.name || '').trim().toLowerCase();
    if (name) {
      const all = listStaffCards();
      const byName = all.find((c) => c.fullName.toLowerCase() === name);
      if (byName) return byName;
    }

    const parts = (session.name || 'Staff').trim().split(/\s+/);
    const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    return {
      badgeId: session.badgeId || 'MEDCORE-STAFF',
      fullName: session.name || 'Staff Member',
      role: session.role || 'Hospital Staff',
      roleKey: session.roleKey || 'clinical',
      title: session.title || session.role || 'Staff Member',
      department: session.department || 'Clinical Operations',
      facilityId: session.hospitalId || 'FAC-01',
      facilityName: session.facility || session.hospitalId || 'Akwa Ibom State Hospital',
      clearanceLevel: session.clearanceLevel || 2,
      clearanceLabel: session.clearanceLabel || 'Clinical Staff Access',
      templateKey: session.roleKey === 'admin' ? 'TPL_EXEC' : 'TPL_CLINICAL',
      status: 'ACTIVE',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 365 * 864e5).toISOString().slice(0, 10),
      initials,
      qrPayload: JSON.stringify({ v: 1, badgeId: session.badgeId, facilityId: session.hospitalId }),
    };
  }, [session]);

  if (!isOpen || !session) return null;

  const initials =
    session.avatarInitials ||
    session.name
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    'ST';

  const handleCopyBadge = () => {
    if (session.badgeId) {
      navigator.clipboard?.writeText(session.badgeId);
      setCopiedBadge(true);
      setTimeout(() => setCopiedBadge(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Hero */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            padding: '24px 24px 20px',
            color: '#FFFFFF',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Avatar circle */}
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  border: '2.5px solid #38BDF8',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  letterSpacing: '0.05em',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                {initials}
                <div
                  title="Active On-Duty"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: '#10B981',
                    border: '2.5px solid #0F172A',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
                    {session.name || 'Staff Member'}
                  </h2>
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.18)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38BDF8',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {(session.role || session.title || 'STAFF').split('/')[0]}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#94A3B8', fontSize: '0.82rem' }}>
                  <Briefcase size={14} color="#7DD3FC" />
                  <span>{session.title || session.role || 'Hospital Staff'}</span>
                  <span>•</span>
                  <span>{session.department || 'Operations'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                cursor: 'pointer',
              }}
              title="Close Profile"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick badge tag row */}
          <div
            style={{
              marginTop: 16,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#CBD5E1' }}>
              <Building2 size={14} color="#38BDF8" />
              <span>{session.facility || session.hospitalId || 'Facility Registry'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#94A3B8' }}>Badge:</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#7DD3FC',
                  background: 'rgba(2, 132, 199, 0.25)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                {session.badgeId || 'ID: UNASSIGNED'}
              </span>
              {session.badgeId && (
                <button
                  type="button"
                  onClick={handleCopyBadge}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedBadge ? '#34D399' : '#94A3B8',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Copy Badge ID"
                >
                  {copiedBadge ? <Check size={13} /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            padding: '4px 20px 0',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'profile' ? '#0284C7' : '#64748B',
              borderBottom: activeTab === 'profile' ? '2.5px solid #0284C7' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
          >
            <User size={15} />
            <span>Profile & Permissions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'card' ? '#0284C7' : '#64748B',
              borderBottom: activeTab === 'card' ? '2.5px solid #0284C7' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
          >
            <CreditCard size={15} />
            <span>Official Staff ID Card</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activeTab === 'profile' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Clearance & Security Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0284C7', fontSize: '0.75rem', fontWeight: 700 }}>
                    <ShieldCheck size={15} />
                    <span>SECURITY CLEARANCE</span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                    Level {session.clearanceLevel || 2}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>
                    {session.clearanceLabel || 'Standard Clinical Access'}
                  </div>
                </div>

                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontSize: '0.75rem', fontWeight: 700 }}>
                    <Clock size={15} />
                    <span>ACTIVE SESSION</span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                    {session.authMethod || 'Staff Badge + PIN'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2 }}>
                    Verified Hospital Terminal
                  </div>
                </div>
              </div>

              {/* Granted Permissions List */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', letterSpacing: '0.03em' }}>
                    ROLE CAPABILITIES & PERMISSIONS
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                    {session.permissions?.length || 0} active
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {session.permissions && session.permissions.length > 0 ? (
                    session.permissions.map((perm, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          color: '#0369A1',
                          background: '#F0F9FF',
                          border: '1px solid #BAE6FD',
                          padding: '3px 8px',
                          borderRadius: 6,
                        }}
                      >
                        <CheckCircle2 size={11} color="#0284C7" />
                        {perm.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                      Standard clinical role permissions active.
                    </span>
                  )}
                </div>
              </div>

              {/* Account Quick Actions banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
                  border: '1px solid #A7F3D0',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065F46' }}>
                    Need to update your security PIN or password?
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: 2 }}>
                    Use the dedicated Key icon in the header or the button below.
                  </div>
                </div>
                {onOpenCredentials && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCredentials();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#047857',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Key size={13} />
                    <span>Security PIN</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '0.82rem', color: '#64748B', textAlign: 'center' }}>
                Tap or hover on card to flip between Front (Photo ID) and Back (QR & Security Barcode).
              </div>
              {card && <StaffIdCardView card={card} />}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {onLogout ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: '1px solid #FECACA',
                color: '#DC2626',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          ) : <div />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onOpenCredentials && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCredentials();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#0284C7',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Key size={14} />
                <span>Change Password & PIN</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#0F172A',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: 10,
                padding: '8px 18px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
