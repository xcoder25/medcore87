'use client';

import React, { useState } from 'react';
import {
  ShieldCheck, Lock, Key, Eye, EyeOff, CheckCircle2,
  AlertCircle, X, User
} from 'lucide-react';
import type { UserSession } from './AuthScreen';
import { getPlatformAdmin } from './AuthScreen';
import { firebaseChangePassword, firebaseChangeBadgePin } from '../../lib/firebase';
import { updateStaffPin } from '../../lib/staffCardStore';

interface ChangeCredentialsModalProps {
  session: UserSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export const ChangeCredentialsModal: React.FC<ChangeCredentialsModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'password' | 'pin'>('password');

  // Password Tab State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // PIN Tab State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'None', color: '#94A3B8' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score: 1, label: 'Fair (Min 6 chars)', color: '#F59E0B' };
    if (score <= 3) return { score: 2, label: 'Good', color: '#0284C7' };
    return { score: 3, label: 'Strong', color: '#10B981' };
  };

  const strength = getPasswordStrength(newPassword);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword.trim()) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const email = session.id?.includes('@')
        ? session.id
        : (getPlatformAdmin().email);

      const effectiveAdmin = getPlatformAdmin();
      let updated = false;

      // 1. Try Firebase Auth update if online
      if (typeof navigator === 'undefined' || navigator.onLine) {
        const res = await firebaseChangePassword(email, currentPassword, newPassword);
        if (res.success) {
          updated = true;
        } else if (res.error?.includes('Current password is incorrect')) {
          setErrorMessage(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Handle platform bootstrap admin or local offline override
      const isPlatformAdmin =
        currentPassword === effectiveAdmin.password ||
        (session.roleKey === 'hospital_admin' && currentPassword === effectiveAdmin.password);

      if (isPlatformAdmin || updated) {
        const nextAdmin = { ...effectiveAdmin, password: newPassword };
        localStorage.setItem('medcore_platform_admin_override', JSON.stringify(nextAdmin));
        updated = true;
      }

      if (!updated) {
        setErrorMessage('Current password is incorrect or network is unavailable.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Password successfully updated! Use your new password on your next login.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) onSuccess('Login password successfully updated.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2500);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const badgeId = session.badgeId || session.id;
    if (!badgeId) {
      setErrorMessage('Staff ID not found on active session.');
      return;
    }
    if (!currentPin.trim()) {
      setErrorMessage('Please enter your current PIN.');
      return;
    }
    if (!/^\d{4,8}$/.test(newPin.trim())) {
      setErrorMessage('New PIN must be between 4 and 8 digits (numeric only).');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMessage('New PINs do not match.');
      return;
    }
    if (currentPin === newPin) {
      setErrorMessage('New PIN must be different from current PIN.');
      return;
    }

    setIsSubmitting(true);

    try {
      const effectiveHospital = session.hospitalId || 'IGH-EKT';

      // 1. Try Firebase Auth update for badge account if online
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          await firebaseChangeBadgePin(badgeId, currentPin, newPin);
        } catch {
          // Continue to local update
        }
      }

      // 2. Update PIN across ID cards, staff registry, access control
      const storeUpdated = updateStaffPin(badgeId, newPin.trim(), effectiveHospital);

      if (session) {
        session.token = `PIN-${Date.now().toString(36)}`;
        try {
          localStorage.setItem('medcore_os_session', JSON.stringify(session));
        } catch {}
      }

      setSuccessMessage('Staff Security PIN updated successfully!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      if (onSuccess) onSuccess('Staff Security PIN updated successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2500);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to update PIN.');
    } finally {
      setIsSubmitting(false);
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
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            padding: '20px 24px',
            color: '#FFFFFF',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(2, 132, 199, 0.2)',
                  border: '1px solid rgba(2, 132, 199, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38BDF8',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                  Manage Security Credentials
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                  Hospital OS Authentication & Access Security
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
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
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* User Profile Summary Tag */}
          <div
            style={{
              marginTop: 16,
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={15} color="#38BDF8" />
              <span style={{ fontWeight: 700, color: '#F1F5F9' }}>{session.name}</span>
              <span style={{ color: '#94A3B8' }}>•</span>
              <span style={{ color: '#38BDF8', fontWeight: 600 }}>{session.role?.split('/')[0]}</span>
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                background: 'rgba(2, 132, 199, 0.25)',
                color: '#7DD3FC',
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              {session.badgeId || 'ID: ADMIN'}
            </span>
          </div>
        </div>

        {/* Tab Selection */}
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
            onClick={() => {
              setActiveTab('password');
              setErrorMessage(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'password' ? '#0284C7' : '#64748B',
              borderBottom: activeTab === 'password' ? '2.5px solid #0284C7' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Lock size={16} />
            <span>Login Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('pin');
              setErrorMessage(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'pin' ? '#0284C7' : '#64748B',
              borderBottom: activeTab === 'pin' ? '2.5px solid #0284C7' : '2.5px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Key size={16} />
            <span>Staff ID / PIN</span>
          </button>
        </div>

        {/* Feedback alerts */}
        <div style={{ padding: '0 24px' }}>
          {errorMessage && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                borderRadius: 10,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                borderRadius: 10,
                background: '#ECFDF5',
                border: '1px solid #6EE7B7',
                color: '#047857',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Forms Container */}
        <div style={{ padding: '20px 24px 28px' }}>
          {activeTab === 'password' ? (
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.45 }}>
                Used for email-based workstation sign-in ({getPlatformAdmin().email}).
              </p>

              {/* Current Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    New Password
                  </label>
                  {newPassword && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: strength.color }}>
                      Strength: {strength.label}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Visual strength bar */}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: strength.score >= 1 ? strength.color : '#E2E8F0' }} />
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: strength.score >= 2 ? strength.color : '#E2E8F0' }} />
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: strength.score >= 3 ? strength.color : '#E2E8F0' }} />
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 10,
                    border: 'none',
                    background: isSubmitting ? '#94A3B8' : '#0284C7',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  {isSubmitting ? 'Updating Password...' : 'Save New Password'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#64748B', lineHeight: 1.45 }}>
                Used for Staff ID sign-in ({session.badgeId || 'Badge ID'}), clinical digital signatures, and e-prescriptions.
              </p>

              {/* Current PIN */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Current Staff PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPin ? 'text' : 'password'}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="Enter current 4–8 digit PIN"
                    maxLength={8}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      letterSpacing: '0.2em',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showCurrentPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New PIN */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  New Security PIN (4–8 numeric digits)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    maxLength={8}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      letterSpacing: '0.2em',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New PIN */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  maxLength={8}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    letterSpacing: '0.2em',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 10,
                    border: 'none',
                    background: isSubmitting ? '#94A3B8' : '#0284C7',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  {isSubmitting ? 'Updating PIN...' : 'Save New PIN'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
