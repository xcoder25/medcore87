'use client';

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
    const res = await fetch(
      `/api/auth/biometric?badgeId=${encodeURIComponent(badgeId)}&facilityId=${encodeURIComponent(facilityId || 'IGH-EKT')}`
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
    const res = await fetch('/api/auth/biometric', {
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
    });
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
  challengeToken?: string;
  prompt?: FaceLivenessPrompt;
  promptLabel?: string;
  livenessSessionId?: string | null;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'face_challenge',
        badgeId: params.badgeId,
        facilityId: params.facilityId,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      challengeToken?: string;
      prompt?: FaceLivenessPrompt;
      promptLabel?: string;
      livenessSessionId?: string | null;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.challengeToken || !json.prompt) {
      return { ok: false, error: json.error || 'Could not start facial liveness challenge.' };
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
}): Promise<{ ok: boolean; verified?: boolean; similarity?: number; mfaToken?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/biometric', {
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
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      verified?: boolean;
      similarity?: number;
      mfaToken?: string;
      error?: string;
    };
    if (!res.ok || !json.verified) {
      return { ok: false, verified: false, error: json.error || 'Facial biometric verification did not match.' };
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

export async function revokeStaffBiometric(
  badgeId: string,
  facilityId: string,
  target: 'all' | 'face' = 'all'
): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', badgeId, facilityId, target }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return Boolean(res.ok && json.ok);
  } catch {
    return false;
  }
}
