'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Fingerprint,
  X,
} from 'lucide-react';
import type { UserSession } from './AuthScreen';
import type { AdminFacilitySettings } from '../../lib/adminSettingsStore';
import { listStaffCards } from '../../lib/staffCardStore';
import { appendAudit } from '../../lib/auditLogStore';
import {
  getStaffBiometricStatus,
  verifyStaffBiometric,
  isBiometricSupported,
} from '../../lib/biometricAuth';

function normBadge(b: string): string {
  return String(b || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Deterministic 6-digit rotating 5-minute workstation MFA fallback code
 * (for offline clinics without internet/email delivery).
 */
export function getStaffMfaTotpCode(
  _badgeId: string,
  facilityId: string,
  offsetSteps = 0
): string {
  const windowStep = Math.floor(Date.now() / (5 * 60 * 1000)) + offsetSteps;
  const seed = `MEDCORE-MFA:${facilityId || 'IGH-EKT'}:${windowStep}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 1_000_000).padStart(6, '0');
}

interface StaffEmailOtpModalProps {
  session: UserSession;
  settings: AdminFacilitySettings;
  onVerified: (verifiedSession: UserSession) => void;
  onCancel: () => void;
}

export const StaffEmailOtpModal: React.FC<StaffEmailOtpModalProps> = ({
  session,
  settings,
  onVerified,
  onCancel,
}) => {
  const badge = normBadge(session.badgeId || session.id || '');
  const facilityId = session.hospitalId || 'IGH-EKT';
  const expiryMinutes = Math.max(2, Math.min(15, Number(settings.otpExpiryMinutes) || 5));
  const allowOfflineBackup = settings.allowMfaBackupCodeFallback !== false;

  const resolvedEmail = useMemo(() => {
    if (session.email && session.email.includes('@')) return session.email;
    try {
      const hit = listStaffCards().find((c) => normBadge(c.badgeId) === badge) as
        | { email?: string }
        | undefined;
      if (hit?.email && hit.email.includes('@')) return hit.email;
    } catch {
      /* ignore */
    }
    return '';
  }, [session.email, badge]);

  const [tab, setTab] = useState<'email_otp' | 'backup_code'>('email_otp');
  const [sending, setSending] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [backupInput, setBackupInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [deliveryChannel, setDeliveryChannel] = useState<string>('');
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(expiryMinutes * 60);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioDevice, setBioDevice] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    if (!badge || !isBiometricSupported()) return;
    void getStaffBiometricStatus(badge, facilityId).then((st) => {
      setBioEnrolled(st.enrolled);
      setBioDevice(st.deviceLabel || null);
    });
  }, [badge, facilityId]);

  const handleBiometricVerify = async () => {
    setErrorMsg(null);
    setBioBusy(true);
    try {
      const res = await verifyStaffBiometric({
        badgeId: badge,
        facilityId,
        staffName: session.name,
      });
      if (!res.verified) {
        setErrorMsg(res.error || 'Biometric verification failed. Use Email OTP instead.');
        return;
      }
      appendAudit({
        facilityId,
        actor: session.name,
        actorBadge: badge,
        category: 'access',
        severity: 'normal',
        action: 'STAFF_2FA_BIOMETRIC_VERIFIED',
        entity: 'staff_auth',
        entityId: badge,
        detail: `Staff WebAuthn biometric 2FA verified (${bioDevice || 'Platform Passkey'})`,
      });
      setVerifiedSuccess(true);
      window.setTimeout(() => {
        onVerified({
          ...session,
          token: res.mfaToken || session.token,
          authMethod: `${session.authMethod} + Biometric 2FA`,
        });
      }, 350);
    } finally {
      setBioBusy(false);
    }
  };

  const initialSentRef = useRef(false);

  const sendOtp = useCallback(async () => {
    setSending(true);
    setErrorMsg(null);
    setDevPreviewCode(null);

    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          facilityId,
          badgeId: badge,
          staffName: session.name,
          email: resolvedEmail || undefined,
          expiryMinutes,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        sent?: boolean;
        channel?: string;
        maskedEmail?: string;
        expiresInSeconds?: number;
        devPreviewCode?: string;
        deliveryError?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.message ||
            data.error ||
            'Could not send OTP to your staff email. Use Offline Admin Code if available.'
        );
        setSending(false);
        return;
      }

      setMaskedEmail(data.maskedEmail || resolvedEmail || 'staff email');
      setDeliveryChannel(data.channel || '');
      setSecondsLeft(data.expiresInSeconds || expiryMinutes * 60);
      setResendCooldown(30);
      if (data.devPreviewCode) {
        setDevPreviewCode(data.devPreviewCode);
      }
      if (data.deliveryError) {
        setErrorMsg(`Email gateway warning: ${data.deliveryError}`);
      }

      appendAudit({
        facilityId,
        actor: session.name,
        actorBadge: badge,
        category: 'access',
        severity: 'normal',
        action: 'STAFF_2FA_EMAIL_OTP_SENT',
        entity: 'staff_auth',
        entityId: badge,
        detail: `Auto-generated 6-digit login OTP dispatched to ${data.maskedEmail || 'staff email'} (${data.channel || 'server'})`,
      });
    } catch {
      setErrorMsg('Network unreachable while sending Email OTP. Switch to Offline Admin Code if enabled.');
    } finally {
      setSending(false);
    }
  }, [facilityId, badge, session.name, resolvedEmail, expiryMinutes]);

  useEffect(() => {
    if (initialSentRef.current) return;
    initialSentRef.current = true;
    void sendOtp();
  }, [sendOtp]);

  useEffect(() => {
    const iv = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(iv);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = otpInput.replace(/\D/g, '').trim();
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit OTP sent to your staff email.');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          facilityId,
          badgeId: badge,
          code: clean,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        verified?: boolean;
        mfaToken?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.verified) {
        setErrorMsg(data.message || data.error || 'Invalid or expired Email OTP.');
        appendAudit({
          facilityId,
          actor: session.name,
          actorBadge: badge,
          category: 'access',
          severity: 'critical',
          action: 'STAFF_2FA_EMAIL_OTP_FAILED',
          entity: 'staff_auth',
          entityId: badge,
          detail: `Failed Email OTP attempt at login (${data.error || 'INVALID_OTP'})`,
        });
        setVerifying(false);
        return;
      }

      appendAudit({
        facilityId,
        actor: session.name,
        actorBadge: badge,
        category: 'access',
        severity: 'normal',
        action: 'STAFF_2FA_EMAIL_OTP_VERIFIED',
        entity: 'staff_auth',
        entityId: badge,
        detail: `Staff Email OTP 2FA verified (${maskedEmail || 'work email'})`,
      });

      setVerifiedSuccess(true);
      window.setTimeout(() => {
        onVerified({
          ...session,
          token: data.mfaToken || session.token,
          authMethod: `${session.authMethod} + Email OTP`,
        });
      }, 400);
    } catch {
      setErrorMsg('Failed to verify Email OTP due to network error.');
      setVerifying(false);
    }
  };

  const handleVerifyBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!allowOfflineBackup) {
      setErrorMsg('Hospital Admin policy requires Email OTP verification.');
      return;
    }

    const clean = backupInput.replace(/\D/g, '').trim();
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit Offline Workstation MFA code.');
      return;
    }

    const validCurrent = getStaffMfaTotpCode(badge, facilityId, 0);
    const validPrev = getStaffMfaTotpCode(badge, facilityId, -1);

    if (clean !== validCurrent && clean !== validPrev) {
      setErrorMsg('Invalid or expired 6-digit MFA code. Request current workstation code from Hospital Admin.');
      appendAudit({
        facilityId,
        actor: session.name,
        actorBadge: badge,
        category: 'access',
        severity: 'critical',
        action: 'STAFF_2FA_CODE_FAILED',
        entity: 'staff_auth',
        entityId: badge,
        detail: 'Incorrect 6-digit offline 2FA backup code entered at login',
      });
      return;
    }

    let serverToken: string | undefined;
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_code', facilityId, badgeId: badge, code: clean }),
      });
      const j = (await res.json().catch(() => null)) as { mfaToken?: string } | null;
      if (j?.mfaToken) serverToken = j.mfaToken;
    } catch {
      /* offline */
    }

    appendAudit({
      facilityId,
      actor: session.name,
      actorBadge: badge,
      category: 'access',
      severity: 'normal',
      action: 'STAFF_2FA_CODE_VERIFIED',
      entity: 'staff_auth',
      entityId: badge,
      detail: 'Workstation 6-digit offline MFA backup code verified',
    });

    setVerifiedSuccess(true);
    window.setTimeout(() => {
      onVerified({
        ...session,
        token: serverToken || session.token,
        authMethod: `${session.authMethod} + MFA Code`,
      });
    }, 350);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Staff Two-Factor Email OTP Verification"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(10, 25, 47, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
            color: '#FFFFFF',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.25)',
                border: '1px solid rgba(147, 197, 253, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} color="#93C5FD" />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800 }}>Staff 2FA Email OTP Verification</div>
              <div style={{ fontSize: 12, color: '#BFDBFE' }}>
                {session.name} · <span style={{ fontFamily: 'monospace' }}>{badge}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel login"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode Tabs */}
        {allowOfflineBackup && (
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC',
              padding: '6px 14px 0',
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTab('email_otp');
                setErrorMsg(null);
              }}
              style={{
                padding: '9px 14px',
                border: 'none',
                borderBottom: tab === 'email_otp' ? '2.5px solid #0284C7' : '2.5px solid transparent',
                background: 'transparent',
                color: tab === 'email_otp' ? '#0284C7' : '#64748B',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Mail size={14} /> Email OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('backup_code');
                setErrorMsg(null);
              }}
              style={{
                padding: '9px 14px',
                border: 'none',
                borderBottom: tab === 'backup_code' ? '2.5px solid #0284C7' : '2.5px solid transparent',
                background: 'transparent',
                color: tab === 'backup_code' ? '#0284C7' : '#64748B',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <KeyRound size={14} /> Offline Admin Code
            </button>
          </div>
        )}

        <div style={{ padding: 22 }}>
          {verifiedSuccess ? (
            <div style={{ textAlign: 'center', padding: '18px 8px' }}>
              <CheckCircle2 size={44} color="#059669" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#065F46' }}>
                2FA Verified — Unlocking MedCore OS
              </div>
            </div>
          ) : (
            <>
              {bioEnrolled && isBiometricSupported() && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #ECFDF5 0%, #EFF6FF 100%)',
                    border: '1.5px solid #6EE7B7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>
                      Fast Biometric 2FA Ready
                    </div>
                    <div style={{ fontSize: 11.5, color: '#047857' }}>
                      {bioDevice || 'Fingerprint / Face ID / Windows Hello Passkey'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={bioBusy}
                    onClick={() => void handleBiometricVerify()}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#059669',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: bioBusy ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Fingerprint size={16} />
                    {bioBusy ? 'Verifying…' : 'Verify with Fingerprint / Face ID'}
                  </button>
                </div>
              )}
          {tab === 'email_otp' ? (
            <form onSubmit={handleVerifyEmailOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  fontSize: 12.5,
                  color: '#1E3A8A',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Mail size={18} color="#0284C7" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  {sending ? (
                    <span>Auto-generating and sending 6-digit OTP to your staff email…</span>
                  ) : (
                    <span>
                      A 6-digit login OTP was automatically sent to{' '}
                      <strong>{maskedEmail || 'your staff email'}</strong>.
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11.5, color: '#475569' }}>
                    <Clock size={12} /> Expires in <strong>{formatTimer(secondsLeft)}</strong>
                  </div>
                </div>
              </div>

              {devPreviewCode && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span>
                    Email delivery service is not yet configured. Temporary OTP:
                  </span>
                  <code style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.16em' }}>{devPreviewCode}</code>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Enter 6-Digit Email OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  minLength={6}
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '0.35em',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  disabled={sending || resendCooldown > 0}
                  onClick={() => void sendOtp()}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: sending || resendCooldown > 0 ? '#94A3B8' : '#0F172A',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: sending || resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <RefreshCw size={13} className={sending ? 'animate-spin' : ''} />
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
                </button>

                <button
                  type="submit"
                  disabled={verifying || otpInput.length !== 6}
                  style={{
                    flex: 1,
                    padding: '11px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: otpInput.length === 6 ? '#0284C7' : '#94A3B8',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: otpInput.length === 6 && !verifying ? 'pointer' : 'not-allowed',
                  }}
                >
                  {verifying ? 'Verifying OTP…' : 'Verify OTP & Sign In'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyBackupCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: 12.5,
                  color: '#475569',
                }}
              >
                Use this only on offline/LAN workstations where email is unavailable. Request the rotating 5-minute 6-digit code from your Hospital Administrator.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  6-Digit Offline Admin MFA Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  minLength={6}
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  value={backupInput}
                  onChange={(e) => setBackupInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #CBD5E1',
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '0.35em',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={backupInput.length !== 6}
                style={{
                  padding: '11px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: backupInput.length === 6 ? '#0F172A' : '#94A3B8',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: backupInput.length === 6 ? 'pointer' : 'not-allowed',
                }}
              >
                Verify Offline Code
              </button>
            </form>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffEmailOtpModal;
