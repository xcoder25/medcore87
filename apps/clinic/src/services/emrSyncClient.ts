import { Platform } from 'react-native';
import { offlineSyncManager } from './offlineSync';
import {
  EMR_URL_STORAGE_KEY,
  getStoredItem,
  initNativeStorage,
  removeStoredItem,
  setStoredItem,
} from './nativeStorage';

export const DEFAULT_EMR_API_URL = 'https://medcore87-os.vercel.app';

let cachedEmrUrl = '';

export async function hydrateEmrBaseUrl(): Promise<string> {
  await initNativeStorage();
  const stored = getStoredItem(EMR_URL_STORAGE_KEY);
  if (stored && stored.trim()) {
    cachedEmrUrl = stored.trim().replace(/\/+$/, '');
  }
  return getEmrBaseUrl();
}

export function getEmrBaseUrl(): string {
  if (cachedEmrUrl) return cachedEmrUrl;
  try {
    const stored = getStoredItem(EMR_URL_STORAGE_KEY);
    if (stored && stored.trim()) {
      cachedEmrUrl = stored.trim().replace(/\/+$/, '');
      return cachedEmrUrl;
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
  return DEFAULT_EMR_API_URL;
}

export function setEmrBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  cachedEmrUrl = clean;
  try {
    if (clean) setStoredItem(EMR_URL_STORAGE_KEY, clean);
    else removeStoredItem(EMR_URL_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      (window as unknown as { __MEDCORE_OS_URL?: string }).__MEDCORE_OS_URL = clean;
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
        error:
          json.accountFound === false
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

export async function requestAdminEmailOtp(params: {
  facilityId: string;
  badgeId: string;
  staffName: string;
  email?: string;
}): Promise<{
  ok: boolean;
  sent: boolean;
  maskedEmail?: string;
  devPreviewCode?: string;
  error?: string;
}> {
  const base = getEmrBaseUrl();
  if (!base) {
    return { ok: false, sent: false, error: 'EMR server offline.' };
  }
  try {
    const res = await fetch(`${base}/api/auth/mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_otp', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      sent?: boolean;
      maskedEmail?: string;
      devPreviewCode?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return { ok: false, sent: false, error: json.message || json.error || 'Could not send Email OTP.' };
    }
    return {
      ok: true,
      sent: Boolean(json.sent || json.devPreviewCode),
      maskedEmail: json.maskedEmail,
      devPreviewCode: json.devPreviewCode,
    };
  } catch {
    return { ok: false, sent: false, error: 'Network error sending Admin OTP.' };
  }
}

export async function verifyAdminEmailOtp(params: {
  facilityId: string;
  badgeId: string;
  code: string;
}): Promise<{ ok: boolean; verified: boolean; mfaToken?: string; error?: string }> {
  const base = getEmrBaseUrl();
  if (!base) return { ok: false, verified: false, error: 'EMR server offline.' };
  try {
    const res = await fetch(`${base}/api/auth/mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_otp', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      verified?: boolean;
      mfaToken?: string;
      message?: string;
      error?: string;
    };
    return {
      ok: Boolean(res.ok && json.ok),
      verified: Boolean(json.verified),
      mfaToken: json.mfaToken,
      error: json.message || json.error,
    };
  } catch {
    return { ok: false, verified: false, error: 'Could not verify Admin OTP.' };
  }
}

export async function verifyAdminOfflineCode(params: {
  facilityId: string;
  badgeId: string;
  code: string;
}): Promise<{ ok: boolean; verified: boolean; mfaToken?: string; error?: string }> {
  const base = getEmrBaseUrl();
  if (!base) {
    return { ok: true, verified: params.code.trim().length === 6 };
  }
  try {
    const res = await fetch(`${base}/api/auth/mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_code', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      verified?: boolean;
      mfaToken?: string;
      error?: string;
    };
    return {
      ok: Boolean(res.ok && json.ok),
      verified: Boolean(json.verified),
      mfaToken: json.mfaToken,
      error: json.error,
    };
  } catch {
    return { ok: false, verified: false, error: 'Network error verifying offline code.' };
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
  offlineSyncManager.setAuthToken(sessionToken);
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

export async function fetchFacilityState<T = unknown>(
  facilityId: string,
  key: string,
  sessionToken?: string
): Promise<{ ok: boolean; value: T | null }> {
  const base = getEmrBaseUrl();
  if (!base || !sessionToken) return { ok: false, value: null };
  try {
    const res = await fetch(
      `${base}/api/facility/sync?facilityId=${encodeURIComponent(facilityId)}&key=${encodeURIComponent(key)}`,
      { headers: authHeaders(sessionToken) }
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: Record<string, T> };
    return { ok: Boolean(res.ok && json.ok), value: json.data ? (json.data[key] ?? null) : null };
  } catch {
    return { ok: false, value: null };
  }
}

export async function saveFacilityState(
  facilityId: string,
  key: string,
  value: unknown,
  sessionToken?: string
): Promise<{ ok: boolean; synced: boolean }> {
  const base = getEmrBaseUrl();
  const endpoint = base ? `${base}/api/facility/sync` : '/api/facility/sync';
  const body = { facilityId, key, value };
  offlineSyncManager.setAuthToken(sessionToken);
  if (base && sessionToken) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(sessionToken),
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, synced: true };
    } catch {
      /* queue below */
    }
  }
  await offlineSyncManager.executeWithOfflineQueue(endpoint, 'POST', body);
  return { ok: true, synced: false };
}

export async function pushEmrFacilityBroadcast(
  facilityId: string,
  message: string,
  actor: string,
  sessionToken?: string
): Promise<{ synced: boolean }> {
  const res = await saveFacilityState(
    facilityId,
    'medcore_mobile_admin_broadcast_v1',
    { message, actor, sentAt: new Date().toISOString() },
    sessionToken
  );
  return { synced: res.synced };
}

export async function submitClinicalOrder(
  facilityId: string,
  order: Record<string, unknown>,
  sessionToken?: string
): Promise<{ ok: boolean; synced: boolean }> {
  const base = getEmrBaseUrl();
  const existing = await fetchFacilityState<any[]>(facilityId, 'medcore_os_clinical_orders_v1', sessionToken);
  const current = Array.isArray(existing.value) ? existing.value : [];
  const nextList = [order, ...current].slice(0, 200);
  const saved = await saveFacilityState(facilityId, 'medcore_os_clinical_orders_v1', nextList, sessionToken);
  if (base && sessionToken) {
    try {
      await fetch(`${base}/api/events/publish`, {
        method: 'POST',
        headers: authHeaders(sessionToken),
        body: JSON.stringify({
          topic: 'CLINICAL_ORDER_PLACED',
          facilityId,
          priority: order.priority === 'stat' ? 'CRITICAL' : 'INFO',
          payload: order,
        }),
      });
    } catch {
      /* optional notification */
    }
  }
  return { ok: saved.ok, synced: saved.synced };
}

export async function generateAmbientSoap(params: {
  facilityId: string;
  transcript: string;
  patientName?: string;
  vitalsSummary?: string;
  sessionToken?: string;
}): Promise<{ ok: boolean; draft?: any; error?: string }> {
  const base = getEmrBaseUrl();
  if (!base || !params.sessionToken) {
    return { ok: false, error: 'Sign in with live EMR connection for M87 AI Scribe.' };
  }
  try {
    const res = await fetch(`${base}/api/ai/scribe`, {
      method: 'POST',
      headers: authHeaders(params.sessionToken),
      body: JSON.stringify({
        facilityId: params.facilityId,
        transcript: params.transcript,
        patientName: params.patientName,
        vitalsSummary: params.vitalsSummary,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; draft?: any; error?: string };
    return { ok: Boolean(res.ok && json.ok), draft: json.draft, error: json.error };
  } catch {
    return { ok: false, error: 'Failed to reach /api/ai/scribe.' };
  }
}

export async function transcribeClinicalAudio(params: {
  audioBase64: string;
  mimeType: string;
  roleHint?: string;
  sessionToken?: string;
}): Promise<{ ok: boolean; transcript?: string; error?: string }> {
  const base = getEmrBaseUrl();
  if (!base || !params.sessionToken) {
    return { ok: false, error: 'Live EMR session required for voice transcription.' };
  }
  try {
    const res = await fetch(`${base}/api/ai/transcribe`, {
      method: 'POST',
      headers: authHeaders(params.sessionToken),
      body: JSON.stringify({
        audioBase64: params.audioBase64,
        mimeType: params.mimeType,
        roleHint: params.roleHint || 'clinician',
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; transcript?: string; error?: string };
    return { ok: Boolean(res.ok && json.ok), transcript: json.transcript, error: json.error };
  } catch {
    return { ok: false, error: 'Failed to reach /api/ai/transcribe.' };
  }
}

export async function analyzeClinicalVision(params: {
  imageBase64: string;
  mimeType: string;
  facilityId: string;
  mode: 'clinical' | 'scan_form';
  sessionToken?: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  const base = getEmrBaseUrl();
  if (!base || !params.sessionToken) {
    return { ok: false, error: 'Live EMR session required for Vision AI.' };
  }
  const path = params.mode === 'scan_form' ? '/api/ai/scan-form' : '/api/ai/vision-clinical';
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: authHeaders(params.sessionToken),
      body: JSON.stringify({
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        facilityId: params.facilityId,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    return { ok: Boolean(res.ok && json.ok !== false), data: json, error: json.error };
  } catch {
    return { ok: false, error: 'Failed to reach Vision AI endpoint.' };
  }
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

export async function requestPatientOtp(params: {
  identifier: string;
  facilityId: string;
}): Promise<{ ok: boolean; maskedTarget?: string; devPreviewCode?: string; error?: string }> {
  const base = getEmrBaseUrl();
  if (!base) return { ok: false, error: 'EMR server not configured.' };
  try {
    const res = await fetch(`${base}/api/care/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request_patient_otp', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      maskedTarget?: string;
      devPreviewCode?: string;
      error?: string;
    };
    return {
      ok: Boolean(res.ok && json.ok),
      maskedTarget: json.maskedTarget,
      devPreviewCode: json.devPreviewCode,
      error: json.error,
    };
  } catch {
    return { ok: false, error: 'Unable to reach Care OTP endpoint.' };
  }
}

export async function verifyPatientOtp(params: {
  identifier: string;
  code: string;
  facilityId: string;
  facilityName: string;
}): Promise<{
  ok: boolean;
  verified: boolean;
  patient?: {
    patientId: string;
    shid: string;
    fullName: string;
    phone?: string;
    email?: string;
    facilityId: string;
    facilityName: string;
  };
  error?: string;
}> {
  const base = getEmrBaseUrl();
  if (!base) return { ok: false, verified: false, error: 'EMR server not configured.' };
  try {
    const res = await fetch(`${base}/api/care/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_patient_otp', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    return {
      ok: Boolean(res.ok && json.ok),
      verified: Boolean(json.verified),
      patient: json.patient,
      error: json.error,
    };
  } catch {
    return { ok: false, verified: false, error: 'Failed to verify OTP.' };
  }
}

export async function fetchPatientCareSync(params: {
  shid?: string;
  phone?: string;
  facilityId: string;
}) {
  const emptyRecords = { labs: [] as any[], prescriptions: [] as any[], vitals: [] as any[], summaries: [] as any[] };
  const base = getEmrBaseUrl();
  if (!base || (!params.shid && !params.phone)) {
    return { ok: false, appointments: [] as any[], reminders: [] as any[], akshiaCoverage: null as any, records: emptyRecords, bills: [] as any[] };
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
      records?: typeof emptyRecords;
      bills?: any[];
    };
    return {
      ok: Boolean(res.ok && json.ok),
      appointments: Array.isArray(json.appointments) ? json.appointments : [],
      reminders: Array.isArray(json.reminders) ? json.reminders : [],
      akshiaCoverage: json.akshiaCoverage || null,
      records: json.records || emptyRecords,
      bills: Array.isArray(json.bills) ? json.bills : [],
    };
  } catch {
    return { ok: false, appointments: [] as any[], reminders: [] as any[], akshiaCoverage: null as any, records: emptyRecords, bills: [] as any[] };
  }
}

export async function sendPatientTriage(params: {
  facilityId: string;
  message: string;
  patientName?: string;
  shid?: string;
  phone?: string;
}): Promise<{
  ok: boolean;
  urgency?: string;
  reply?: string;
  recommendedDepartment?: string;
  redFlags?: string[];
  error?: string;
}> {
  const base = getEmrBaseUrl();
  if (!base) {
    return {
      ok: true,
      urgency: 'routine',
      reply: 'Offline mode: please monitor symptoms closely. Visit the nearest hospital emergency unit immediately if chest pain, difficulty breathing, severe bleeding, or high fever develops.',
      recommendedDepartment: 'General Outpatient (GOPD)',
    };
  }
  try {
    const res = await fetch(`${base}/api/care/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'patient_triage', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    return {
      ok: Boolean(res.ok && json.ok),
      urgency: json.urgency,
      reply: json.reply,
      recommendedDepartment: json.recommendedDepartment,
      redFlags: json.redFlags,
      error: json.error,
    };
  } catch {
    return { ok: false, error: 'Triage service temporarily unreachable.' };
  }
}

export async function initPatientPayment(params: {
  facilityId: string;
  amountNgn: number;
  invoiceRef?: string;
  email?: string;
  shid?: string;
  patientName?: string;
}): Promise<{
  ok: boolean;
  mode?: 'paystack' | 'bank_transfer_mandate';
  reference?: string;
  authorizationUrl?: string;
  instructions?: string;
  error?: string;
}> {
  const base = getEmrBaseUrl();
  if (!base) {
    return {
      ok: true,
      mode: 'bank_transfer_mandate',
      reference: params.invoiceRef || `MCR-OFF-${Date.now().toString(36).toUpperCase()}`,
      instructions: `Pay NGN ${params.amountNgn.toLocaleString()} at Cashiers Desk when back online.`,
    };
  }
  try {
    const res = await fetch(`${base}/api/care/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init_patient_payment', ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    return {
      ok: Boolean(res.ok && json.ok),
      mode: json.mode,
      reference: json.reference,
      authorizationUrl: json.authorizationUrl,
      instructions: json.instructions,
      error: json.error,
    };
  } catch {
    return { ok: false, error: 'Payment initialization failed.' };
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
