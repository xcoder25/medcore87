'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smile,
  X,
} from 'lucide-react';
import {
  enrollStaffFaceBiometric,
  requestFaceAuthChallenge,
  verifyStaffFaceBiometric,
  type FaceLivenessPrompt,
} from '../../lib/biometricAuth';

interface FaceBiometricCaptureModalProps {
  mode: 'enroll' | 'verify';
  isOpen: boolean;
  badgeId: string;
  facilityId: string;
  staffName: string;
  onClose: () => void;
  onEnrolled?: (info: { enrolledAt?: string }) => void;
  onVerified?: (info: { mfaToken?: string; similarity?: number }) => void;
}

export const FaceBiometricCaptureModal: React.FC<FaceBiometricCaptureModalProps> = ({
  mode,
  isOpen,
  badgeId,
  facilityId,
  staffName,
  onClose,
  onEnrolled,
  onVerified,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verify mode multi-step active liveness state
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<FaceLivenessPrompt | null>(null);
  const [promptLabel, setPromptLabel] = useState<string>('');
  const [neutralFrameB64, setNeutralFrameB64] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      for (const track of s.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const loadVerifyChallenge = useCallback(async () => {
    if (mode !== 'verify' || !badgeId) return;
    setErrorMsg(null);
    setNeutralFrameB64(null);
    setChallengeToken(null);
    const ch = await requestFaceAuthChallenge({ badgeId, facilityId });
    if (!ch.ok || !ch.challengeToken || !ch.prompt) {
      setErrorMsg(ch.error || 'Could not initialize facial verification challenge.');
      return;
    }
    setChallengeToken(ch.challengeToken);
    setPrompt(ch.prompt);
    setPromptLabel(ch.promptLabel || 'Follow the on-screen liveness instruction');
  }, [mode, badgeId, facilityId]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setErrorMsg(null);
      setSuccessMsg(null);
      setNeutralFrameB64(null);
      setChallengeToken(null);
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const start = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not available in this browser.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraError(
            'Camera permission was denied or no webcam was found. Enable camera access or use Email OTP.'
          );
        }
      }
    };

    void start();
    if (mode === 'verify') {
      void loadVerifyChallenge();
    }

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, mode, loadVerifyChallenge, stopCamera]);

  if (!isOpen) return null;

  const captureFrameBase64 = (): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setErrorMsg('Camera feed is still initializing. Wait a moment and try again.');
      return null;
    }
    const maxW = 480;
    const scale = Math.min(1, maxW / video.videoWidth);
    const w = Math.max(160, Math.round(video.videoWidth * scale));
    const h = Math.max(120, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleEnrollCapture = async () => {
    const frame = captureFrameBase64();
    if (!frame) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await enrollStaffFaceBiometric({
        badgeId,
        facilityId,
        staffName,
        imageBase64: frame,
      });
      if (!res.ok) {
        setErrorMsg(res.error || 'Could not enroll facial biometric.');
        return;
      }
      setSuccessMsg('Facial biometric profile enrolled.');
      stopCamera();
      window.setTimeout(() => {
        onEnrolled?.({ enrolledAt: res.enrolledAt });
      }, 450);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCaptureStep = async () => {
    const frame = captureFrameBase64();
    if (!frame) return;
    setErrorMsg(null);

    if (!neutralFrameB64) {
      setNeutralFrameB64(frame);
      return;
    }

    if (!challengeToken) {
      await loadVerifyChallenge();
      return;
    }

    setBusy(true);
    try {
      const res = await verifyStaffFaceBiometric({
        badgeId,
        facilityId,
        staffName,
        challengeToken,
        neutralImageBase64: neutralFrameB64,
        challengeImageBase64: frame,
      });
      if (!res.verified) {
        setErrorMsg(res.error || 'Facial verification did not match. Resetting scan…');
        setNeutralFrameB64(null);
        await loadVerifyChallenge();
        return;
      }
      setSuccessMsg(
        res.similarity
          ? `Facial identity confirmed (${res.similarity.toFixed(1)}% match)`
          : 'Facial identity confirmed'
      );
      stopCamera();
      window.setTimeout(() => {
        onVerified?.({ mfaToken: res.mfaToken, similarity: res.similarity });
      }, 400);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'enroll' ? 'Facial Biometric Enrollment' : 'Facial Biometric 2FA Verification'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100050,
        background: 'rgba(10, 20, 38, 0.84)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) handleClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#FFFFFF',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.42)',
          border: '1px solid #CBD5E1',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #065F46 100%)',
            color: '#FFFFFF',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'rgba(16, 185, 129, 0.22)',
                border: '1px solid rgba(110, 231, 183, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={19} color="#6EE7B7" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {mode === 'enroll' ? 'Enroll Facial Biometric' : 'Facial Biometric Verification'}
              </div>
              <div style={{ fontSize: 11.5, color: '#A7F3D0' }}>
                {staffName} · <span style={{ fontFamily: 'monospace' }}>{badgeId}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            aria-label="Close camera verification"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF',
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {successMsg ? (
            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
              <CheckCircle2 size={46} color="#059669" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 15.5, fontWeight: 800, color: '#065F46' }}>{successMsg}</div>
            </div>
          ) : (
            <>
              {/* Step / Instruction Pill */}
              {mode === 'enroll' ? (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    fontSize: 12,
                    color: '#166534',
                    fontWeight: 600,
                  }}
                >
                  Center your face inside the oval, look straight ahead with both eyes open, and remove tinted glasses.
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: neutralFrameB64 ? '#FEF3C7' : '#EFF6FF',
                    border: neutralFrameB64 ? '1.5px solid #F59E0B' : '1.5px solid #93C5FD',
                    color: neutralFrameB64 ? '#92400E' : '#1E3A8A',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {neutralFrameB64 ? <Smile size={18} color="#D97706" /> : <ShieldCheck size={18} color="#0284C7" />}
                  <span>
                    {neutralFrameB64
                      ? `Step 2 of 2 (Liveness): ${promptLabel || 'Perform liveness movement'}`
                      : 'Step 1 of 2: Look straight at the camera and capture your front view'}
                  </span>
                </div>
              )}

              {/* Camera Viewport */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: '#0F172A',
                  border: '2px solid #CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    display: cameraError ? 'none' : 'block',
                  }}
                />

                {/* Oval face alignment overlay */}
                {!cameraError && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '54%',
                        height: '76%',
                        borderRadius: '50%',
                        border: neutralFrameB64
                          ? '2.5px dashed rgba(251, 191, 36, 0.92)'
                          : '2.5px dashed rgba(52, 211, 153, 0.9)',
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.34)',
                      }}
                    />
                  </div>
                )}

                {!cameraReady && !cameraError && (
                  <div
                    style={{
                      position: 'absolute',
                      color: '#E2E8F0',
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Loader2 size={16} /> Starting secure camera…
                  </div>
                )}

                {cameraError && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#FCA5A5', fontSize: 12.5, fontWeight: 600 }}>
                    {cameraError}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                {mode === 'verify' && neutralFrameB64 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loadVerifyChallenge()}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#334155',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <RefreshCw size={14} /> Restart
                  </button>
                )}
                <button
                  type="button"
                  disabled={!cameraReady || Boolean(cameraError) || busy || (mode === 'verify' && !challengeToken && !neutralFrameB64)}
                  onClick={() => void (mode === 'enroll' ? handleEnrollCapture() : handleVerifyCaptureStep())}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: !cameraReady || busy ? '#94A3B8' : '#059669',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: !cameraReady || busy ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {busy ? <Loader2 size={16} /> : <Camera size={16} />}
                  <span>
                    {busy
                      ? mode === 'enroll'
                        ? 'Enrolling Face Profile…'
                        : 'Verifying Face & Liveness…'
                      : mode === 'enroll'
                      ? 'Capture & Enroll Face'
                      : neutralFrameB64
                      ? `Complete Liveness (${prompt === 'smile' ? 'Capture Smile' : 'Capture Turn'})`
                      : 'Capture Front View'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceBiometricCaptureModal;
