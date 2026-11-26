'use client';

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 15_000
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => {
    try {
      controller?.abort();
    } catch {
      /* ignore */
    }
  }, timeoutMs);
  try {
    return await fetch(url, {
      ...(init || {}),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } finally {
    clearTimeout(timer);
  }
}

export function isCameraBiometricSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
}

export type FaceLivenessPrompt = 'smile' | 'turn_left' | 'turn_right';

export interface BiometricStatusResult {
  ok: boolean;
  enrolled: boolean;
  faceEnrolled?: boolean;
  faceServiceAvailable?: boolean;
  enrolledAt?: string | null;
  faceEnrolledAt?: string | null;
  lastUsedAt?: string | null;
  error?: string;
}

export async function getStaffBiometricStatus(
  badgeId: string,
  facilityId: string
): Promise<BiometricStatusResult> {
  if (!badgeId) return { ok: false, enrolled: false, faceEnrolled: false };
  try {
    const res = await fetchWithTimeout(
      `/api/auth/biometric?badgeId=${encodeURIComponent(badgeId)}&facilityId=${encodeURIComponent(facilityId || 'IGH-EKT')}`,
      { cache: 'no-store' },
      10_000
    );
    const json = (await res.json().catch(() => ({}))) as BiometricStatusResult;
    const faceEnrolled = Boolean(json.faceEnrolled ?? json.enrolled);
    return {
      ok: Boolean(json.ok),
      enrolled: faceEnrolled,
      faceEnrolled,
      faceServiceAvailable: Boolean(json.faceServiceAvailable),
      enrolledAt: json.enrolledAt || null,
      faceEnrolledAt: json.faceEnrolledAt || null,
      lastUsedAt: json.lastUsedAt || null,
    };
  } catch {
    return { ok: false, enrolled: false, faceEnrolled: false };
  }
}

export async function enrollStaffFaceBiometric(params: {
  badgeId: string;
  facilityId: string;
  staffName: string;
  imageBase64: string;
  faceVector?: number[];
}): Promise<{ ok: boolean; enrolled?: boolean; enrolledAt?: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'face_enroll',
          badgeId: params.badgeId,
          facilityId: params.facilityId,
          staffName: params.staffName,
          imageBase64: params.imageBase64,
          ...(params.faceVector ? { faceVector: params.faceVector } : {}),
        }),
      },
      25_000
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      enrolled?: boolean;
      enrolledAt?: string;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || 'Could not enroll facial biometric.' };
    }
    return { ok: true, enrolled: true, enrolledAt: json.enrolledAt };
  } catch {
    return { ok: false, error: 'Network error while enrolling facial biometric.' };
  }
}

export async function requestFaceAuthChallenge(params: {
  badgeId: string;
  facilityId: string;
}): Promise<{
  ok: boolean;
  notEnrolled?: boolean;
  challengeToken?: string;
  prompt?: FaceLivenessPrompt;
  promptLabel?: string;
  livenessSessionId?: string | null;
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'face_challenge',
          badgeId: params.badgeId,
          facilityId: params.facilityId,
        }),
      },
      25_000
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      notEnrolled?: boolean;
      challengeToken?: string;
      prompt?: FaceLivenessPrompt;
      promptLabel?: string;
      livenessSessionId?: string | null;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.challengeToken || !json.prompt) {
      return {
        ok: false,
        notEnrolled: res.status === 404 || Boolean(json.notEnrolled),
        error: json.error || 'Could not start facial liveness challenge.',
      };
    }
    return {
      ok: true,
      challengeToken: json.challengeToken,
      prompt: json.prompt,
      promptLabel: json.promptLabel,
      livenessSessionId: json.livenessSessionId || null,
    };
  } catch {
    return { ok: false, error: 'Network error while starting facial verification.' };
  }
}

export async function verifyStaffFaceBiometric(params: {
  badgeId: string;
  facilityId: string;
  staffName?: string;
  challengeToken: string;
  neutralImageBase64: string;
  challengeImageBase64: string;
  neutralFaceVector?: number[];
  challengeFaceVector?: number[];
}): Promise<{ ok: boolean; verified?: boolean; notEnrolled?: boolean; similarity?: number; mfaToken?: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'face_verify',
          badgeId: params.badgeId,
          facilityId: params.facilityId,
          staffName: params.staffName,
          challengeToken: params.challengeToken,
          neutralImageBase64: params.neutralImageBase64,
          challengeImageBase64: params.challengeImageBase64,
          ...(params.neutralFaceVector ? { neutralFaceVector: params.neutralFaceVector } : {}),
          ...(params.challengeFaceVector ? { challengeFaceVector: params.challengeFaceVector } : {}),
        }),
      },
      25_000
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      verified?: boolean;
      notEnrolled?: boolean;
      similarity?: number;
      mfaToken?: string;
      error?: string;
    };
    if (!res.ok || !json.verified) {
      return {
        ok: false,
        verified: false,
        notEnrolled: res.status === 404 || Boolean(json.notEnrolled),
        error: json.error || 'Facial biometric verification did not match.',
      };
    }
    return {
      ok: true,
      verified: true,
      similarity: json.similarity,
      mfaToken: json.mfaToken,
    };
  } catch {
    return { ok: false, verified: false, error: 'Network error while verifying facial biometric.' };
  }
}

export interface FaceProbeClientResult {
  ok: boolean;
  faceDetected?: boolean;
  readyForNeutral?: boolean;
  livenessMatched?: boolean;
  guidance?: string;
  qualityScore?: number;
  pose?: { yaw: number; pitch: number; roll: number };
  smiling?: boolean;
  smileConfidence?: number;
  engine?: 'cloud_vision' | 'standard';
  error?: string;
}

export async function probeStaffFaceFrame(params: {
  badgeId: string;
  facilityId: string;
  stage: 'enroll' | 'neutral' | 'liveness';
  imageBase64: string;
  prompt?: FaceLivenessPrompt;
  neutralPoseYaw?: number;
  neutralSmileConfidence?: number;
  faceVector?: number[];
  neutralFaceVector?: number[];
}): Promise<FaceProbeClientResult> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'face_probe',
          badgeId: params.badgeId,
          facilityId: params.facilityId,
          stage: params.stage,
          imageBase64: params.imageBase64,
          ...(params.prompt ? { prompt: params.prompt } : {}),
          ...(typeof params.neutralPoseYaw === 'number' ? { neutralPoseYaw: params.neutralPoseYaw } : {}),
          ...(typeof params.neutralSmileConfidence === 'number'
            ? { neutralSmileConfidence: params.neutralSmileConfidence }
            : {}),
          ...(params.faceVector ? { faceVector: params.faceVector } : {}),
          ...(params.neutralFaceVector ? { neutralFaceVector: params.neutralFaceVector } : {}),
        }),
      },
      15_000
    );
    const json = (await res.json().catch(() => ({}))) as FaceProbeClientResult;
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || 'Camera scan frame could not be checked.' };
    }
    return json;
  } catch {
    return { ok: false, error: 'Network error during automatic camera scan.' };
  }
}

export interface LiveLivenessSessionStartResult {
  ok: boolean;
  available: boolean;
  notEnrolled?: boolean;
  sessionId?: string;
  region?: string;
  livenessToken?: string;
  error?: string;
}

export async function startLiveLivenessSession(params: {
  badgeId: string;
  facilityId: string;
  mode: 'enroll' | 'verify';
}): Promise<LiveLivenessSessionStartResult> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric/liveness/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      25_000
    );
    const json = (await res.json().catch(() => ({}))) as LiveLivenessSessionStartResult;
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        available: false,
        notEnrolled: res.status === 404 || Boolean(json.notEnrolled),
        error: json.error || 'Could not start live verification.',
      };
    }
    return {
      ok: true,
      available: Boolean(json.available && json.sessionId && json.region && json.livenessToken),
      sessionId: json.sessionId,
      region: json.region,
      livenessToken: json.livenessToken,
    };
  } catch {
    return { ok: false, available: false, error: 'Network error starting live verification.' };
  }
}

export async function completeLiveLivenessSession(params: {
  badgeId: string;
  facilityId: string;
  staffName: string;
  mode: 'enroll' | 'verify';
  sessionId: string;
  livenessToken: string;
}): Promise<{
  ok: boolean;
  notEnrolled?: boolean;
  enrolled?: boolean;
  enrolledAt?: string;
  verified?: boolean;
  similarity?: number;
  livenessConfidence?: number;
  mfaToken?: string;
  error?: string;
}> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric/liveness/results',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      25_000
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      notEnrolled?: boolean;
      enrolled?: boolean;
      enrolledAt?: string;
      verified?: boolean;
      similarity?: number;
      livenessConfidence?: number;
      mfaToken?: string;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        notEnrolled: res.status === 404 || Boolean(json.notEnrolled),
        error: json.error || 'Live facial verification did not pass.',
      };
    }
    return {
      ok: true,
      enrolled: json.enrolled,
      enrolledAt: json.enrolledAt,
      verified: json.verified,
      similarity: json.similarity,
      livenessConfidence: json.livenessConfidence,
      mfaToken: json.mfaToken,
    };
  } catch {
    return { ok: false, error: 'Network error evaluating live camera verification.' };
  }
}

export async function revokeStaffBiometric(
  badgeId: string,
  facilityId: string,
  target: 'all' | 'face' = 'all'
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      '/api/auth/biometric',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', badgeId, facilityId, target }),
      },
      15_000
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return Boolean(res.ok && json.ok);
  } catch {
    return false;
  }
}
