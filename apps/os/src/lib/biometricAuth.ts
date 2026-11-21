'use client';

function b64uToUint8(b64u: string): Uint8Array {
  const pad = '='.repeat((4 - (b64u.length % 4)) % 4);
  const b64 = (b64u + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bufToB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function isBiometricSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function'
  );
}

export function isCameraBiometricSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
}

export type FaceLivenessPrompt = 'smile' | 'turn_left' | 'turn_right';

export interface BiometricStatusResult {
  ok: boolean;
  enrolled: boolean;
  passkeyEnrolled?: boolean;
  faceEnrolled?: boolean;
  faceServiceAvailable?: boolean;
  deviceLabel?: string | null;
  enrolledAt?: string | null;
  faceEnrolledAt?: string | null;
  lastUsedAt?: string | null;
  error?: string;
}

export async function getStaffBiometricStatus(
  badgeId: string,
  facilityId: string
): Promise<BiometricStatusResult> {
  if (!badgeId) return { ok: false, enrolled: false, passkeyEnrolled: false, faceEnrolled: false };
  try {
    const res = await fetch(
      `/api/auth/biometric?badgeId=${encodeURIComponent(badgeId)}&facilityId=${encodeURIComponent(facilityId || 'IGH-EKT')}`
    );
    const json = (await res.json().catch(() => ({}))) as BiometricStatusResult;
    const passkeyEnrolled = Boolean(json.passkeyEnrolled ?? json.enrolled);
    const faceEnrolled = Boolean(json.faceEnrolled);
    return {
      ok: Boolean(json.ok),
      enrolled: Boolean(json.enrolled || passkeyEnrolled || faceEnrolled),
      passkeyEnrolled,
      faceEnrolled,
      faceServiceAvailable: Boolean(json.faceServiceAvailable),
      deviceLabel: json.deviceLabel || null,
      enrolledAt: json.enrolledAt || null,
      faceEnrolledAt: json.faceEnrolledAt || null,
      lastUsedAt: json.lastUsedAt || null,
    };
  } catch {
    return { ok: false, enrolled: false, passkeyEnrolled: false, faceEnrolled: false };
  }
}

export async function enrollStaffBiometric(params: {
  badgeId: string;
  facilityId: string;
  staffName: string;
  deviceLabel?: string;
}): Promise<{ ok: boolean; deviceLabel?: string; error?: string }> {
  if (!isBiometricSupported()) {
    return { ok: false, error: 'This browser or device does not support platform biometrics (WebAuthn).' };
  }
  try {
    const optRes = await fetch('/api/auth/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register_options',
        badgeId: params.badgeId,
        facilityId: params.facilityId,
        staffName: params.staffName,
      }),
    });
    const optJson = (await optRes.json().catch(() => ({}))) as {
      ok?: boolean;
      challenge?: string;
      challengeToken?: string;
      user?: { id: string; name: string; displayName: string };
      error?: string;
    };
    if (!optRes.ok || !optJson.ok || !optJson.challenge || !optJson.challengeToken || !optJson.user) {
      return { ok: false, error: optJson.error || 'Could not initialize biometric registration.' };
    }

    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'MedCore Hospital OS' },
        user: {
          id: b64uToUint8(optJson.user.id) as unknown as BufferSource,
          name: optJson.user.name,
          displayName: optJson.user.displayName,
        },
        challenge: b64uToUint8(optJson.challenge) as unknown as BufferSource,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!cred) return { ok: false, error: 'Biometric prompt was cancelled.' };
    const response = cred.response as AuthenticatorAttestationResponse;
    const spkiBuf = response.getPublicKey?.();
    if (!spkiBuf) {
      return { ok: false, error: 'Browser did not expose SPKI public key for verification.' };
    }

    const verifyRes = await fetch('/api/auth/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register_verify',
        badgeId: params.badgeId,
        facilityId: params.facilityId,
        staffName: params.staffName,
        challengeToken: optJson.challengeToken,
        credentialId: cred.id,
        publicKeySpkiB64: bufToB64(spkiBuf),
        clientDataJSON: bufToB64u(response.clientDataJSON),
        alg: response.getPublicKeyAlgorithm?.() ?? -7,
        deviceLabel: params.deviceLabel || `${navigator.platform || 'Device'} Biometric`,
      }),
    });
    const verifyJson = (await verifyRes.json().catch(() => ({}))) as {
      ok?: boolean;
      enrolled?: boolean;
      deviceLabel?: string;
      error?: string;
    };
    if (!verifyRes.ok || !verifyJson.ok) {
      return { ok: false, error: verifyJson.error || 'Failed to save biometric passkey.' };
    }
    return { ok: true, deviceLabel: verifyJson.deviceLabel };
  } catch (err) {
    const msg = (err as Error)?.message || '';
    if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('notallowed')) {
      return { ok: false, error: 'Biometric verification was cancelled or timed out.' };
    }
    return { ok: false, error: msg || 'Failed to enroll biometric passkey.' };
  }
}

export async function verifyStaffBiometric(params: {
  badgeId: string;
  facilityId: string;
  staffName?: string;
}): Promise<{ ok: boolean; verified?: boolean; mfaToken?: string; error?: string }> {
  if (!isBiometricSupported()) {
    return { ok: false, error: 'Platform biometrics are not supported on this device.' };
  }
  try {
    const optRes = await fetch('/api/auth/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'auth_options',
        badgeId: params.badgeId,
        facilityId: params.facilityId,
      }),
    });
    const optJson = (await optRes.json().catch(() => ({}))) as {
      ok?: boolean;
      challenge?: string;
      challengeToken?: string;
      credentialId?: string;
      error?: string;
    };
    if (!optRes.ok || !optJson.ok || !optJson.challenge || !optJson.challengeToken || !optJson.credentialId) {
      return { ok: false, error: optJson.error || 'Biometric passkey not found on server.' };
    }

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: b64uToUint8(optJson.challenge) as unknown as BufferSource,
        allowCredentials: [
          {
            type: 'public-key',
            id: b64uToUint8(optJson.credentialId) as unknown as BufferSource,
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return { ok: false, error: 'Biometric verification cancelled.' };
    const resp = assertion.response as AuthenticatorAssertionResponse;

    const verRes = await fetch('/api/auth/biometric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'auth_verify',
        badgeId: params.badgeId,
        facilityId: params.facilityId,
        staffName: params.staffName,
        challengeToken: optJson.challengeToken,
        credentialId: assertion.id,
        authenticatorData: bufToB64u(resp.authenticatorData),
        clientDataJSON: bufToB64u(resp.clientDataJSON),
        signature: bufToB64u(resp.signature),
      }),
    });
    const verJson = (await verRes.json().catch(() => ({}))) as {
      ok?: boolean;
      verified?: boolean;
      mfaToken?: string;
      error?: string;
    };
    if (!verRes.ok || !verJson.verified) {
      return { ok: false, verified: false, error: verJson.error || 'Biometric signature verification failed.' };
    }
    return { ok: true, verified: true, mfaToken: verJson.mfaToken };
  } catch (err) {
    const msg = (err as Error)?.message || '';
    return { ok: false, verified: false, error: msg || 'Biometric verification cancelled.' };
  }
}

export async function enrollStaffFaceBiometric(params: {
  badgeId: string;
  facilityId: string;
  staffName: string;
  imageBase64: string;
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
  target: 'all' | 'passkey' | 'face' = 'all'
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
