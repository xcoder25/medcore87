import { Platform } from 'react-native';
import { offlineSyncManager } from './offlineSync';

const EMR_URL_STORAGE_KEY = 'medcore_mobile_emr_url_v1';

export function getEmrBaseUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(EMR_URL_STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    }
    const procEnv = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env;
    const envUrl = procEnv?.EXPO_PUBLIC_OS_URL || procEnv?.NEXT_PUBLIC_OS_URL;
    if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      const winUrl = (window as unknown as { __MEDCORE_OS_URL?: string }).__MEDCORE_OS_URL;
      if (winUrl && winUrl.trim()) return winUrl.trim().replace(/\/+$/, '');
      if (Platform.OS === 'web' && window.location?.hostname === 'localhost') {
        return 'http://localhost:3003';
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

export function setEmrBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  try {
    if (typeof window !== 'undefined') {
      (window as unknown as { __MEDCORE_OS_URL?: string }).__MEDCORE_OS_URL = clean;
      if (window.localStorage) {
        if (clean) window.localStorage.setItem(EMR_URL_STORAGE_KEY, clean);
        else window.localStorage.removeItem(EMR_URL_STORAGE_KEY);
      }
    }
  } catch {
    /* ignore */
  }
}

function authHeaders(sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

export interface EmrVerifiedStaff {
  badgeId: string;
  name: string;
  role: string;
  roleKey: string;
  title: string;
  department: string;
  facilityId: string;
  clearanceLevel: number;
  email?: string;
}

export async function verifyEmrStaffLogin(params: {
  facilityId: string;
  identifier: string;
  pin: string;
}): Promise<{
  ok: boolean;
  verified: boolean;
  sessionToken?: string;
  staff?: EmrVerifiedStaff;
  networkOffline?: boolean;
  error?: string;
}> {
  const base = getEmrBaseUrl();
  if (!base) {
    return {
      ok: false,
      verified: false,
      networkOffline: true,
      error: 'EMR server URL is not configured for this device.',
    };
  }
  const cleanId = params.identifier.trim();
  const isEmail = cleanId.includes('@');
  try {
    const res = await fetch(`${base}/api/auth/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facilityId: params.facilityId,
        ...(isEmail ? { email: cleanId.toLowerCase() } : { badgeId: cleanId.toUpperCase() }),
        pin: params.pin.trim(),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      verified?: boolean;
      accountFound?: boolean;
      sessionToken?: string;
      staff?: EmrVerifiedStaff;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        verified: false,
        networkOffline: res.status >= 500,
        error: json.message || json.error || `Server returned ${res.status}`,
      };
    }
    if (!json.verified) {
      return {
        ok: true,
        verified: false,
        error: json.accountFound === false
          ? 'EMR account not found for this facility.'
          : 'Incorrect Staff ID / Email or 6-digit PIN.',
      };
    }
    return {
      ok: true,
      verified: true,
      sessionToken: json.sessionToken,
      staff: json.staff,
    };
  } catch {
    return {
      ok: false,
      verified: false,
      networkOffline: true,
      error: 'Cannot reach MedCore EMR server.',
    };
  }
}

export async function fetchEmrPatients(facilityId: string, sessionToken?: string) {
  const base = getEmrBaseUrl();
  if (!base || !sessionToken) return { ok: false, patients: [] as any[] };
  try {
    const res = await fetch(
      `${base}/api/patients?facilityId=${encodeURIComponent(facilityId)}&limit=60`,
      { headers: authHeaders(sessionToken) }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; patients?: any[] };
    return { ok: Boolean(res.ok && json.ok), patients: Array.isArray(json.patients) ? json.patients : [] };
  } catch {
    return { ok: false, patients: [] as any[] };
  }
}

export async function fetchEmrStaff(facilityId: string, sessionToken?: string) {
  const base = getEmrBaseUrl();
  if (!base || !sessionToken) return { ok: false, staff: [] as any[] };
  try {
    const res = await fetch(
      `${base}/api/staff?facilityId=${encodeURIComponent(facilityId)}`,
      { headers: authHeaders(sessionToken) }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; staff?: any[] };
    return { ok: Boolean(res.ok && json.ok), staff: Array.isArray(json.staff) ? json.staff : [] };
  } catch {
    return { ok: false, staff: [] as any[] };
  }
}

export async function enrolEmrStaff(
  payload: Record<string, unknown>,
  sessionToken?: string
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  const base = getEmrBaseUrl();
  const endpoint = base ? `${base}/api/staff/create` : '/api/staff/create';
  if (base && sessionToken) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(sessionToken),
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (res.ok && (json.success || json.ok)) {
        return { ok: true, synced: true };
      }
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, synced: false, error: json.message || json.error || `Rejected (${res.status})` };
      }
    } catch {
      /* fall through to offline queue */
    }
  }
  await offlineSyncManager.executeWithOfflineQueue(endpoint, 'POST', payload);
  return { ok: true, synced: false };
}

export async function pushEmrFacilityBroadcast(
  facilityId: string,
  message: string,
  actor: string,
  sessionToken?: string
): Promise<{ synced: boolean }> {
  const base = getEmrBaseUrl();
  const endpoint = base ? `${base}/api/facility/sync` : '/api/facility/sync';
  const body = {
    facilityId,
    key: 'medcore_mobile_admin_broadcast_v1',
    value: { message, actor, sentAt: new Date().toISOString() },
  };
  if (base && sessionToken) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(sessionToken),
        body: JSON.stringify(body),
      });
      if (res.ok) return { synced: true };
    } catch {
      /* queue below */
    }
  }
  await offlineSyncManager.executeWithOfflineQueue(endpoint, 'POST', body);
  return { synced: false };
}

export function subscribeEmrFacilityStream(
  facilityId: string,
  sessionToken: string | undefined,
  onStatus: (state: 'live' | 'syncing' | 'offline') => void,
  onUpdate: () => void
): () => void {
  const base = getEmrBaseUrl();
  if (!base || !sessionToken) {
    onStatus('offline');
    return () => {};
  }

  onStatus('syncing');
  const timer = setInterval(() => {
    onUpdate();
  }, 15_000);

  let es: EventSource | null = null;
  if (typeof EventSource !== 'undefined') {
    try {
      es = new EventSource(`${base}/api/facility/stream?facilityId=${encodeURIComponent(facilityId)}`);
      es.onopen = () => onStatus('live');
      es.onmessage = () => {
        onStatus('live');
        onUpdate();
      };
      es.onerror = () => onStatus('syncing');
    } catch {
      onStatus('live');
    }
  } else {
    onStatus('live');
  }

  return () => {
    clearInterval(timer);
    try {
      es?.close();
    } catch {
      /* ignore */
    }
  };
}

export async function registerPatientWithEmr(params: {
  fullName: string;
  phone?: string;
  email?: string;
  facilityId: string;
  facilityName: string;
}): Promise<{
  ok: boolean;
  emrSynced: boolean;
  patientId: string;
  shid: string;
  error?: string;
}> {
  const base = getEmrBaseUrl();
  const fallbackId = `PAT-${params.facilityId.slice(-3)}-${Date.now().toString(36).toUpperCase()}`;
  const fallbackShid = `SHID-AKS-${Date.now().toString().slice(-6)}`;
  if (!base) {
    return { ok: true, emrSynced: false, patientId: fallbackId, shid: fallbackShid };
  }
  try {
    const res = await fetch(`${base}/api/care/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register_patient',
        fullName: params.fullName,
        phone: params.phone,
        email: params.email,
        facilityId: params.facilityId,
        facilityName: params.facilityName,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      patient?: { patientId: string; shid: string };
      error?: string;
    };
    if (!res.ok || !json.ok || !json.patient) {
      if (res.status >= 400 && res.status < 500) {
        return {
          ok: false,
          emrSynced: false,
          patientId: fallbackId,
          shid: fallbackShid,
          error: json.error || 'Could not complete sign-up.',
        };
      }
      return { ok: true, emrSynced: false, patientId: fallbackId, shid: fallbackShid };
    }
    return {
      ok: true,
      emrSynced: true,
      patientId: json.patient.patientId,
      shid: json.patient.shid,
    };
  } catch {
    return { ok: true, emrSynced: false, patientId: fallbackId, shid: fallbackShid };
  }
}

export async function fetchPatientCareSync(params: {
  shid?: string;
  phone?: string;
  facilityId: string;
}) {
  const base = getEmrBaseUrl();
  if (!base || (!params.shid && !params.phone)) {
    return { ok: false, appointments: [] as any[], reminders: [] as any[], akshiaCoverage: null as any };
  }
  try {
    const q = new URLSearchParams({
      facilityId: params.facilityId,
      ...(params.shid ? { shid: params.shid } : {}),
      ...(params.phone ? { phone: params.phone } : {}),
    });
    const res = await fetch(`${base}/api/care/sync?${q.toString()}`);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      appointments?: any[];
      reminders?: any[];
      akshiaCoverage?: any;
    };
    return {
      ok: Boolean(res.ok && json.ok),
      appointments: Array.isArray(json.appointments) ? json.appointments : [],
      reminders: Array.isArray(json.reminders) ? json.reminders : [],
      akshiaCoverage: json.akshiaCoverage || null,
    };
  } catch {
    return { ok: false, appointments: [] as any[], reminders: [] as any[], akshiaCoverage: null as any };
  }
}

export async function bookPatientAppointmentWithEmr(params: {
  facilityId: string;
  facilityName: string;
  patientName: string;
  shid?: string;
  phone?: string;
  department: string;
  preferredSlot: string;
}) {
  const base = getEmrBaseUrl();
  const endpoint = base ? `${base}/api/care/sync` : '/api/care/sync';
  const payload = { ...params, source: 'care_mobile_app' as const };
  if (base) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; booking?: any };
      if (res.ok && json.ok) return { ok: true, synced: true, booking: json.booking };
    } catch {
      /* queue below */
    }
  }
  await offlineSyncManager.executeWithOfflineQueue(endpoint, 'POST', payload);
  return { ok: true, synced: false, booking: null };
}
