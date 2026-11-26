'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Camera,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smile,
  X,
} from 'lucide-react';
import {
  completeLiveLivenessSession,
  enrollStaffFaceBiometric,
  getStaffBiometricStatus,
  probeStaffFaceFrame,
  requestFaceAuthChallenge,
  startLiveLivenessSession,
  verifyStaffFaceBiometric,
  type FaceLivenessPrompt,
} from '../../lib/biometricAuth';

const LiveFaceLivenessDetector = dynamic(() => import('./LiveFaceLivenessDetector'), {
  ssr: false,
});

interface FaceBiometricCaptureModalProps {
  mode: 'enroll' | 'verify';
  isOpen: boolean;
  badgeId: string;
  facilityId: string;
  staffName: string;
  subtitleOverride?: string;
  enrollButtonLabel?: string;
  onSkipCameraUnavailable?: () => void;
  onNotEnrolled?: (reason?: string) => void;
  skipLabel?: string;
  onClose: () => void;
  onEnrolled?: (info: { enrolledAt?: string }) => void;
  onVerified?: (info: { mfaToken?: string; similarity?: number }) => void;
}

type ScanPhase =
  | 'starting'
  | 'scanning_front'
  | 'front_captured'
  | 'scanning_liveness'
  | 'submitting'
  | 'paused'
  | 'done';

const MAX_AUTO_PROBES = 40;
const MAX_FAIL_ATTEMPTS = 3;

function computeFaceOvalMetrics(canvas: HTMLCanvasElement): {
  vector?: number[];
  avgLuma: number;
} {
  try {
    const gridW = 16;
    const gridH = 16;
    const small = document.createElement('canvas');
    small.width = gridW;
    small.height = gridH;
    const sctx = small.getContext('2d');
    if (!sctx) return { avgLuma: 0.5 };
    const sx = Math.round(canvas.width * 0.23);
    const sy = Math.round(canvas.height * 0.12);
    const sw = Math.max(32, Math.round(canvas.width * 0.54));
    const sh = Math.max(32, Math.round(canvas.height * 0.76));
    sctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, gridW, gridH);
    const data = sctx.getImageData(0, 0, gridW, gridH).data;
    const raw: number[] = [];
    let lumaSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      raw.push(lum);
      lumaSum += lum;
    }
    const avgLuma = raw.length > 0 ? lumaSum / raw.length : 0;
    const mean = avgLuma;
    const centered = raw.map((v) => v - mean);
    const norm = Math.sqrt(centered.reduce((a, b) => a + b * b, 0));
    if (!Number.isFinite(norm) || norm < 1e-4) {
      return { avgLuma };
    }
    return {
      vector: centered.map((v) => Math.round((v / norm) * 10000) / 10000),
      avgLuma,
    };
  } catch {
    return { avgLuma: 0.5 };
  }
}

function vectorCosine(a?: number[], b?: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export const FaceBiometricCaptureModal: React.FC<FaceBiometricCaptureModalProps> = ({
  mode,
  isOpen,
  badgeId,
  facilityId,
  staffName,
  subtitleOverride,
  enrollButtonLabel,
  onSkipCameraUnavailable,
  onNotEnrolled,
  skipLabel,
  onClose,
  onEnrolled,
  onVerified,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const scanPhaseRef = useRef<ScanPhase>('starting');
  const prevVecRef = useRef<number[] | undefined>(undefined);
  const stableCountRef = useRef(0);
  const probeCountRef = useRef(0);
  const failAttemptsRef = useRef(0);
  const neutralDataRef = useRef<{
    frame: string;
    vector?: number[];
    poseYaw: number;
    smileConfidence: number;
  } | null>(null);
  const challengeRef = useRef<{
    token: string;
    prompt: FaceLivenessPrompt;
    promptLabel: string;
  } | null>(null);
  const notEnrolledHandledRef = useRef(false);
  const callbacksRef = useRef({
    onNotEnrolled,
    onSkipCameraUnavailable,
    onClose,
    onEnrolled,
    onVerified,
  });
  callbacksRef.current = {
    onNotEnrolled,
    onSkipCameraUnavailable,
    onClose,
    onEnrolled,
    onVerified,
  };

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [scanPhase, setScanPhase] = useState<ScanPhase>('starting');
  const [liveGuidance, setLiveGuidance] = useState<string>(
    'Position your face inside the oval — scanning automatically…'
  );
  const [ringProgress, setRingProgress] = useState<number>(0);

  // Cloud 3D Live Liveness streaming state (auto-falls back to hands-free auto_scan)
  const [livenessMode, setLivenessMode] = useState<'checking' | 'streaming' | 'auto_scan'>('checking');
  const [liveSession, setLiveSession] = useState<{
    sessionId: string;
    region: string;
    livenessToken: string;
  } | null>(null);

  // Verify mode active liveness UI state
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<FaceLivenessPrompt>('smile');
  const [promptLabel, setPromptLabel] = useState<string>('');
  const [neutralFrameB64, setNeutralFrameB64] = useState<string | null>(null);

  const updatePhase = useCallback((next: ScanPhase) => {
    scanPhaseRef.current = next;
    if (mountedRef.current) {
      setScanPhase(next);
    }
  }, []);

  const clearLoopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    clearLoopTimer();
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
  }, [clearLoopTimer]);

  const triggerNotEnrolled = useCallback((reason?: string) => {
    if (notEnrolledHandledRef.current) return;
    notEnrolledHandledRef.current = true;
    stopCamera();
    setLiveSession(null);
    updatePhase('paused');
    const fallback = callbacksRef.current.onNotEnrolled || callbacksRef.current.onSkipCameraUnavailable;
    fallback?.(reason || 'No facial biometric is enrolled for this account.');
  }, [stopCamera, updatePhase]);

  const handleLiveFallback = useCallback(() => {
    setLiveSession(null);
    setLivenessMode('auto_scan');
  }, []);

  const loadVerifyChallenge = useCallback(async () => {
    if (mode !== 'verify' || !badgeId) return false;
    setErrorMsg(null);
    neutralDataRef.current = null;
    setNeutralFrameB64(null);
    challengeRef.current = null;
    setChallengeToken(null);
    const ch = await requestFaceAuthChallenge({ badgeId, facilityId });
    if (!mountedRef.current) return false;
    if (!ch.ok || !ch.challengeToken || !ch.prompt) {
      if (ch.notEnrolled) {
        triggerNotEnrolled(ch.error || 'No facial biometric is enrolled for this account.');
        return false;
      }
      setErrorMsg(ch.error || 'Could not initialize facial verification challenge.');
      updatePhase('paused');
      return false;
    }
    const label = ch.promptLabel || 'Follow the on-screen liveness instruction';
    challengeRef.current = {
      token: ch.challengeToken,
      prompt: ch.prompt,
      promptLabel: label,
    };
    setChallengeToken(ch.challengeToken);
    setPrompt(ch.prompt);
    setPromptLabel(label);
    return true;
  }, [mode, badgeId, facilityId, triggerNotEnrolled, updatePhase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      notEnrolledHandledRef.current = false;
      stopCamera();
      inFlightRef.current = false;
      prevVecRef.current = undefined;
      stableCountRef.current = 0;
      probeCountRef.current = 0;
      failAttemptsRef.current = 0;
      neutralDataRef.current = null;
      challengeRef.current = null;
      setBusy(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      setNeutralFrameB64(null);
      setChallengeToken(null);
      setRingProgress(0);
      setLiveSession(null);
      setLivenessMode('checking');
      setLiveGuidance('Position your face inside the oval — scanning automatically…');
      updatePhase('starting');
      return;
    }

    let cancelled = false;
    notEnrolledHandledRef.current = false;
    setCameraError(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    failAttemptsRef.current = 0;
    setLiveSession(null);
    setLivenessMode('checking');

    const initSession = async () => {
      if (mode === 'verify') {
        const preflight = await Promise.race([
          getStaffBiometricStatus(badgeId, facilityId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6_000)),
        ]);
        if (cancelled) return;
        if (!preflight?.ok || !preflight.faceEnrolled) {
          triggerNotEnrolled(
            !preflight || preflight.ok === false
              ? 'Could not confirm Face ID enrollment for this account — switched to verification code.'
              : 'Face ID is not enrolled for this account — switched to verification code.'
          );
          return;
        }
      }
      const live = await startLiveLivenessSession({ badgeId, facilityId, mode });
      if (cancelled) return;
      if (mode === 'verify' && live.notEnrolled) {
        triggerNotEnrolled(live.error || 'No facial biometric is enrolled for this account.');
        return;
      }
      if (live.ok && live.available && live.sessionId && live.region && live.livenessToken) {
        setLiveSession({
          sessionId: live.sessionId,
          region: live.region,
          livenessToken: live.livenessToken,
        });
        setLivenessMode('streaming');
        return;
      }
      setLiveSession(null);
      setLivenessMode('auto_scan');
    };

    void initSession();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, badgeId, facilityId, stopCamera, triggerNotEnrolled, updatePhase]);

  useEffect(() => {
    if (!isOpen || livenessMode !== 'auto_scan' || notEnrolledHandledRef.current) {
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setRingProgress(8);
    probeCountRef.current = 0;
    stableCountRef.current = 0;
    prevVecRef.current = undefined;
    neutralDataRef.current = null;
    setLiveGuidance(
      mode === 'enroll'
        ? 'Center your face inside the oval — enrolling automatically…'
        : 'Look straight at the camera — automatic scan starting…'
    );
    updatePhase('scanning_front');

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

    const boot = async () => {
      if (mode === 'verify') {
        const ok = await loadVerifyChallenge();
        if (!ok || cancelled || notEnrolledHandledRef.current) return;
      }
      await start();
    };
    void boot();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, livenessMode, mode, loadVerifyChallenge, stopCamera, updatePhase]);

  const captureFrame = useCallback((): {
    frame: string;
    vector?: number[];
    avgLuma: number;
  } | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
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
    const metrics = computeFaceOvalMetrics(canvas);
    return {
      frame: canvas.toDataURL('image/jpeg', 0.85),
      vector: metrics.vector,
      avgLuma: metrics.avgLuma,
    };
  }, []);

  // Hands-free automatic scan loop (active when falling back to auto_scan mode)
  const autoScanEnabled =
    isOpen &&
    livenessMode === 'auto_scan' &&
    cameraReady &&
    !cameraError &&
    !successMsg &&
    scanPhase !== 'paused' &&
    scanPhase !== 'done' &&
    (mode === 'enroll' || Boolean(challengeToken));

  const handleLiveAnalysisComplete = useCallback(async () => {
    if (!liveSession) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await completeLiveLivenessSession({
        badgeId,
        facilityId,
        staffName,
        mode,
        sessionId: liveSession.sessionId,
        livenessToken: liveSession.livenessToken,
      });
      if (!mountedRef.current) return;

      if (!res.ok) {
        if (mode === 'verify' && res.notEnrolled) {
          triggerNotEnrolled(res.error || 'No facial biometric is enrolled for this account.');
          return;
        }
        failAttemptsRef.current += 1;
        setErrorMsg(res.error || 'Live camera anti-spoofing check did not pass.');
        if (failAttemptsRef.current < MAX_FAIL_ATTEMPTS) {
          const next = await startLiveLivenessSession({ badgeId, facilityId, mode });
          if (mountedRef.current && mode === 'verify' && next.notEnrolled) {
            triggerNotEnrolled(next.error || 'No facial biometric is enrolled for this account.');
            return;
          }
          if (
            mountedRef.current &&
            next.ok &&
            next.available &&
            next.sessionId &&
            next.region &&
            next.livenessToken
          ) {
            setLiveSession({
              sessionId: next.sessionId,
              region: next.region,
              livenessToken: next.livenessToken,
            });
            return;
          }
        }
        setLiveSession(null);
        setLivenessMode('auto_scan');
        return;
      }

      setLiveSession(null);
      updatePhase('done');
      if (mode === 'enroll') {
        setSuccessMsg('Facial biometric profile enrolled.');
        window.setTimeout(() => {
          if (mountedRef.current) {
            callbacksRef.current.onEnrolled?.({ enrolledAt: res.enrolledAt });
          }
        }, 450);
      } else {
        setSuccessMsg(
          res.similarity
            ? `Facial identity confirmed (${res.similarity.toFixed(1)}% match)`
            : 'Facial identity confirmed'
        );
        window.setTimeout(() => {
          if (mountedRef.current) {
            callbacksRef.current.onVerified?.({ mfaToken: res.mfaToken, similarity: res.similarity });
          }
        }, 400);
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }, [liveSession, badgeId, facilityId, staffName, mode, triggerNotEnrolled, updatePhase]);

  useEffect(() => {
    if (!autoScanEnabled) {
      clearLoopTimer();
      return;
    }

    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (cancelled || !mountedRef.current) return;
      clearLoopTimer();
      timerRef.current = window.setTimeout(() => {
        void runTick();
      }, delayMs);
    };

    const runTick = async () => {
      if (
        cancelled ||
        !mountedRef.current ||
        scanPhaseRef.current === 'paused' ||
        scanPhaseRef.current === 'done'
      ) {
        return;
      }

      if (inFlightRef.current) {
        scheduleNext(250);
        return;
      }

      if (probeCountRef.current >= MAX_AUTO_PROBES) {
        updatePhase('paused');
        setLiveGuidance('Automatic scan paused after inactivity. Click Resume when ready.');
        return;
      }

      const cap = captureFrame();
      if (!cap) {
        scheduleNext(450);
        return;
      }

      if (cap.avgLuma < 0.08) {
        stableCountRef.current = 0;
        prevVecRef.current = undefined;
        setLiveGuidance('Camera view is too dark — move to brighter lighting.');
        scheduleNext(650);
        return;
      }

      // ── ENROLL MODE (single clean front capture -> automatic enroll) ────
      if (mode === 'enroll') {
        if (cap.vector && prevVecRef.current) {
          const stability = vectorCosine(prevVecRef.current, cap.vector);
          stableCountRef.current = stability >= 0.88 ? stableCountRef.current + 1 : 0;
        } else {
          stableCountRef.current = prevVecRef.current ? 1 : 0;
        }
        prevVecRef.current = cap.vector;

        if (cap.vector && stableCountRef.current < 1) {
          setLiveGuidance('Hold steady inside the oval…');
          setRingProgress((p) => Math.max(p, 16));
          scheduleNext(520);
          return;
        }

        inFlightRef.current = true;
        probeCountRef.current += 1;
        try {
          const probe = await probeStaffFaceFrame({
            badgeId,
            facilityId,
            stage: 'enroll',
            imageBase64: cap.frame,
            faceVector: cap.vector,
          });
          if (cancelled || !mountedRef.current) return;

          if (!probe.ok) {
            failAttemptsRef.current += 1;
            setErrorMsg(probe.error || 'Could not evaluate camera frame.');
            if (failAttemptsRef.current >= MAX_FAIL_ATTEMPTS) {
              updatePhase('paused');
              setLiveGuidance('Automatic scan paused. Check connection and click Resume.');
              return;
            }
            scheduleNext(1200);
            return;
          }

          if (probe.guidance) setLiveGuidance(probe.guidance);

          if (!probe.readyForNeutral) {
            setRingProgress(probe.faceDetected ? 44 : 18);
            scheduleNext(650);
            return;
          }

          // Aligned! Immediately enroll using this exact validated frame.
          updatePhase('submitting');
          setBusy(true);
          setErrorMsg(null);
          setRingProgress(88);
          setLiveGuidance(enrollButtonLabel || 'Face aligned — enrolling Face ID…');

          const res = await enrollStaffFaceBiometric({
            badgeId,
            facilityId,
            staffName,
            imageBase64: cap.frame,
            faceVector: cap.vector,
          });
          if (cancelled || !mountedRef.current) return;

          setBusy(false);
          if (!res.ok) {
            failAttemptsRef.current += 1;
            setErrorMsg(res.error || 'Could not enroll facial biometric.');
            if (failAttemptsRef.current >= MAX_FAIL_ATTEMPTS) {
              updatePhase('paused');
              setRingProgress(0);
              setLiveGuidance('Enrollment paused. Adjust lighting and click Resume.');
              return;
            }
            updatePhase('scanning_front');
            stableCountRef.current = 0;
            setRingProgress(24);
            scheduleNext(1400);
            return;
          }

          failAttemptsRef.current = 0;
          setRingProgress(100);
          updatePhase('done');
          setSuccessMsg('Facial biometric profile enrolled.');
          stopCamera();
          window.setTimeout(() => {
            if (mountedRef.current) {
              callbacksRef.current.onEnrolled?.({ enrolledAt: res.enrolledAt });
            }
          }, 450);
        } finally {
          inFlightRef.current = false;
        }
        return;
      }

      // ── VERIFY MODE (Step 1 Front -> automatic Step 2 Liveness) ────────
      const ch = challengeRef.current;
      if (!ch?.token) {
        scheduleNext(350);
        return;
      }

      if (!neutralDataRef.current) {
        if (cap.vector && prevVecRef.current) {
          const stability = vectorCosine(prevVecRef.current, cap.vector);
          stableCountRef.current = stability >= 0.88 ? stableCountRef.current + 1 : 0;
        } else {
          stableCountRef.current = prevVecRef.current ? 1 : 0;
        }
        prevVecRef.current = cap.vector;

        if (cap.vector && stableCountRef.current < 1) {
          setLiveGuidance('Hold steady inside the oval…');
          setRingProgress((p) => Math.max(p, 14));
          scheduleNext(520);
          return;
        }

        inFlightRef.current = true;
        probeCountRef.current += 1;
        try {
          const probe = await probeStaffFaceFrame({
            badgeId,
            facilityId,
            stage: 'neutral',
            imageBase64: cap.frame,
            faceVector: cap.vector,
          });
          if (cancelled || !mountedRef.current) return;

          if (!probe.ok) {
            failAttemptsRef.current += 1;
            setErrorMsg(probe.error || 'Could not evaluate camera frame.');
            if (failAttemptsRef.current >= MAX_FAIL_ATTEMPTS) {
              updatePhase('paused');
              return;
            }
            scheduleNext(1200);
            return;
          }

          if (probe.guidance) setLiveGuidance(probe.guidance);

          if (!probe.readyForNeutral) {
            setRingProgress(probe.faceDetected ? 32 : 14);
            scheduleNext(650);
            return;
          }

          // Front view validated! Save neutral frame and automatically transition to liveness.
          neutralDataRef.current = {
            frame: cap.frame,
            vector: cap.vector,
            poseYaw: Number(probe.pose?.yaw ?? 0),
            smileConfidence: Number(probe.smileConfidence ?? 0),
          };
          setNeutralFrameB64(cap.frame);
          updatePhase('front_captured');
          setRingProgress(55);
          setLiveGuidance(`Front view captured! Now: ${ch.promptLabel}`);

          window.setTimeout(() => {
            if (!cancelled && mountedRef.current && scanPhaseRef.current === 'front_captured') {
              updatePhase('scanning_liveness');
              scheduleNext(350);
            }
          }, 650);
        } finally {
          inFlightRef.current = false;
        }
        return;
      }

      // Step 2: automatic active liveness scan & verification
      if (scanPhaseRef.current === 'front_captured') {
        scheduleNext(300);
        return;
      }

      inFlightRef.current = true;
      probeCountRef.current += 1;
      try {
        const neutral = neutralDataRef.current;
        const probe = await probeStaffFaceFrame({
          badgeId,
          facilityId,
          stage: 'liveness',
          prompt: ch.prompt,
          imageBase64: cap.frame,
          faceVector: cap.vector,
          neutralFaceVector: neutral.vector,
          neutralPoseYaw: neutral.poseYaw,
          neutralSmileConfidence: neutral.smileConfidence,
        });
        if (cancelled || !mountedRef.current) return;

        if (!probe.ok) {
          failAttemptsRef.current += 1;
          setErrorMsg(probe.error || 'Liveness frame check failed.');
          if (failAttemptsRef.current >= MAX_FAIL_ATTEMPTS) {
            updatePhase('paused');
            return;
          }
          scheduleNext(1200);
          return;
        }

        if (!probe.livenessMatched) {
          setRingProgress(68);
          setLiveGuidance(probe.guidance || ch.promptLabel);
          scheduleNext(600);
          return;
        }

        // Liveness confirmed! Immediately verify identity with exact neutral + liveness frames.
        updatePhase('submitting');
        setBusy(true);
        setErrorMsg(null);
        setRingProgress(90);
        setLiveGuidance('Liveness confirmed — verifying identity…');

        const res = await verifyStaffFaceBiometric({
          badgeId,
          facilityId,
          staffName,
          challengeToken: ch.token,
          neutralImageBase64: neutral.frame,
          challengeImageBase64: cap.frame,
          neutralFaceVector: neutral.vector,
          challengeFaceVector: cap.vector,
        });
        if (cancelled || !mountedRef.current) return;

        setBusy(false);
        if (res.notEnrolled) {
          triggerNotEnrolled(res.error || 'No facial biometric is enrolled for this account.');
          return;
        }
        if (!res.verified) {
          failAttemptsRef.current += 1;
          setErrorMsg(res.error || 'Facial verification did not match. Resetting scan…');
          neutralDataRef.current = null;
          setNeutralFrameB64(null);
          stableCountRef.current = 0;
          await loadVerifyChallenge();
          if (failAttemptsRef.current >= MAX_FAIL_ATTEMPTS) {
            updatePhase('paused');
            setRingProgress(0);
            setLiveGuidance('Verification paused after 3 attempts. Click Resume to retry.');
            return;
          }
          updatePhase('scanning_front');
          setRingProgress(14);
          scheduleNext(1500);
          return;
        }

        failAttemptsRef.current = 0;
        setRingProgress(100);
        updatePhase('done');
        setSuccessMsg(
          res.similarity
            ? `Facial identity confirmed (${res.similarity.toFixed(1)}% match)`
            : 'Facial identity confirmed'
        );
        stopCamera();
        window.setTimeout(() => {
          if (mountedRef.current) {
            callbacksRef.current.onVerified?.({ mfaToken: res.mfaToken, similarity: res.similarity });
          }
        }, 400);
      } finally {
        inFlightRef.current = false;
      }
    };

    scheduleNext(500);

    return () => {
      cancelled = true;
      clearLoopTimer();
    };
  }, [
    autoScanEnabled,
    badgeId,
    facilityId,
    staffName,
    mode,
    enrollButtonLabel,
    captureFrame,
    clearLoopTimer,
    loadVerifyChallenge,
    stopCamera,
    triggerNotEnrolled,
    updatePhase,
  ]);

  if (!isOpen) return null;

  const handleResumeScan = async () => {
    setErrorMsg(null);
    probeCountRef.current = 0;
    failAttemptsRef.current = 0;
    stableCountRef.current = 0;
    prevVecRef.current = undefined;
    neutralDataRef.current = null;
    setNeutralFrameB64(null);
    setRingProgress(12);
    if (mode === 'verify') {
      const ok = await loadVerifyChallenge();
      if (!ok) return;
    }
    setLiveGuidance(
      mode === 'enroll'
        ? 'Center your face inside the oval — enrolling automatically…'
        : 'Look straight at the camera — scanning automatically…'
    );
    updatePhase('scanning_front');
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const strokeColor =
    scanPhase === 'submitting' || scanPhase === 'done'
      ? '#10B981'
      : neutralFrameB64
      ? '#F59E0B'
      : '#34D399';
  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, ringProgress)) / 100);

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
      <style>{`
        @keyframes medcoreFaceSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
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
                {mode === 'enroll' ? 'Automatic Face ID Enrollment' : 'Automatic Face ID Verification'}
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
          ) : livenessMode === 'checking' ? (
            <div style={{ textAlign: 'center', padding: '32px 12px', color: '#334155', fontSize: 13, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Loader2 size={26} color="#059669" style={{ animation: 'medcoreFaceSpin 1s linear infinite' }} />
              <span>
                {mode === 'verify'
                  ? 'Confirming Face ID enrollment & camera check…'
                  : 'Preparing secure live camera check…'}
              </span>
            </div>
          ) : livenessMode === 'streaming' && liveSession ? (
            <>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#EFF6FF',
                  border: '1.5px solid #93C5FD',
                  color: '#1E3A8A',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ShieldCheck size={17} color="#0284C7" style={{ flexShrink: 0 }} />
                <span>
                  {busy
                    ? 'Finalizing anti-spoofing & identity match…'
                    : subtitleOverride || 'Center your face inside the oval — live anti-spoofing verification starts automatically.'}
                </span>
              </div>

              {busy ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', color: '#065F46', fontSize: 13.5, fontWeight: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={30} color="#059669" style={{ animation: 'medcoreFaceSpin 1s linear infinite' }} />
                  <span>Confirming live facial identity…</span>
                </div>
              ) : (
                <LiveFaceLivenessDetector
                  sessionId={liveSession.sessionId}
                  region={liveSession.region}
                  livenessToken={liveSession.livenessToken}
                  onAnalysisComplete={handleLiveAnalysisComplete}
                  onFallback={handleLiveFallback}
                />
              )}

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

              {onSkipCameraUnavailable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSkipCameraUnavailable}
                  style={{
                    alignSelf: 'center',
                    padding: '4px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#64748B',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {skipLabel || 'Continue Without Face ID'}
                </button>
              )}
            </>
          ) : (
            <>
              {/* Step / Instruction Banner */}
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ShieldCheck size={17} color="#059669" style={{ flexShrink: 0 }} />
                  <span>
                    {subtitleOverride ||
                      'Hands-free capture: center your face inside the oval with both eyes open.'}
                  </span>
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
                  {neutralFrameB64 ? (
                    <Smile size={18} color="#D97706" style={{ flexShrink: 0 }} />
                  ) : (
                    <ShieldCheck size={18} color="#0284C7" style={{ flexShrink: 0 }} />
                  )}
                  <span>
                    {neutralFrameB64
                      ? `Step 2 of 2 (Auto-Detecting): ${promptLabel || 'Perform liveness movement'}`
                      : 'Step 1 of 2 (Hands-Free): Look straight at the camera'}
                  </span>
                </div>
              )}

              {/* Camera Viewport with Progress Ring */}
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

                {/* Oval face alignment & progress ring overlay */}
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
                        position: 'relative',
                        width: '54%',
                        height: '76%',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.36)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        style={{ width: '100%', height: '100%', overflow: 'visible' }}
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke="rgba(255,255,255,0.28)"
                          strokeWidth="2.2"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          transform="rotate(-90 50 50)"
                          style={{ transition: 'stroke-dashoffset 280ms ease, stroke 200ms ease' }}
                        />
                      </svg>
                    </div>
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
                    <Loader2 size={16} style={{ animation: 'medcoreFaceSpin 1s linear infinite' }} /> Starting secure camera…
                  </div>
                )}

                {cameraError && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#FCA5A5', fontSize: 12.5, fontWeight: 600 }}>
                    <div>{cameraError}</div>
                    {onSkipCameraUnavailable && (
                      <button
                        type="button"
                        onClick={onSkipCameraUnavailable}
                        style={{
                          marginTop: 12,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.28)',
                          background: 'rgba(255,255,255,0.12)',
                          color: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {skipLabel || 'Continue Without Face ID (No Camera)'}
                      </button>
                    )}
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

              {/* Automatic Live Status Bar (no manual clicks required) */}
              {!cameraError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    style={{
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: scanPhase === 'submitting' ? '#ECFDF5' : '#F8FAFC',
                      color: scanPhase === 'submitting' ? '#065F46' : '#0F172A',
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {scanPhase !== 'paused' && (
                        <Loader2
                          size={16}
                          color={scanPhase === 'submitting' ? '#059669' : '#0284C7'}
                          style={{
                            flexShrink: 0,
                            animation: 'medcoreFaceSpin 1s linear infinite',
                          }}
                        />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {liveGuidance}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: scanPhase === 'paused' ? '#D97706' : '#059669',
                        flexShrink: 0,
                      }}
                    >
                      {scanPhase === 'paused'
                        ? 'Paused'
                        : scanPhase === 'submitting'
                        ? 'Verifying'
                        : 'Auto-Scan'}
                    </span>
                  </div>

                  {scanPhase === 'paused' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      {mode === 'verify' && neutralFrameB64 && (
                        <button
                          type="button"
                          onClick={() => void handleResumeScan()}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: 'pointer',
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
                        onClick={() => void handleResumeScan()}
                        style={{
                          flex: 1,
                          padding: '11px 16px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#059669',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 13.5,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <Play size={15} />
                        <span>Resume Automatic Scan</span>
                      </button>
                    </div>
                  )}

                  {onSkipCameraUnavailable && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onSkipCameraUnavailable}
                      style={{
                        alignSelf: 'center',
                        padding: '4px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: '#64748B',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      {skipLabel || 'Continue Without Face ID'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceBiometricCaptureModal;
