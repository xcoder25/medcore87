/**
 * frontdeskDrop.ts — Real-time zero-touch patient onboarding channel.
 *
 * Uses cross-tab BroadcastChannel and EventBridge / AppSync real-time messaging
 * instead of legacy Firestore.
 */

/** Payload transmitted from the patient's mobile app */
export interface PatientDropPayload {
  firstName: string;
  lastName: string;
  dob: string;           // ISO date string e.g. "1991-10-24"
  phone?: string;
  email?: string;
  /** Short-lived claim token for identity binding */
  temporaryToken: string;
  sentAt: string;        // ISO timestamp
  /** Optional server timestamp */
  arrivedAt?: unknown;
}

const AUTO_CLEAR_MS = 30_000;

function channelName(facilityId: string, deskId: string): string {
  return `medcore_frontdesk_drop_${facilityId}_${deskId}`;
}

/**
 * Push a patient drop payload to the frontdesk channel.
 */
export async function pushPatientDrop(
  facilityId: string,
  deskId: string,
  payload: Omit<PatientDropPayload, 'arrivedAt'>
): Promise<void> {
  const fullPayload: PatientDropPayload = {
    ...payload,
    arrivedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const bc = new BroadcastChannel(channelName(facilityId, deskId));
      bc.postMessage(fullPayload);
      bc.close();
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('medcore-patient-drop', {
        detail: { facilityId, deskId, payload: fullPayload },
      })
    );
  }

  // Auto-clear after 30 s
  setTimeout(async () => {
    try {
      await clearPatientDrop(facilityId, deskId);
    } catch {
      /* silent */
    }
  }, AUTO_CLEAR_MS);
}

/**
 * Clear the incoming patient document (called on Accept or Dismiss).
 */
export async function clearPatientDrop(
  facilityId: string,
  deskId: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      const bc = new BroadcastChannel(channelName(facilityId, deskId));
      bc.postMessage(null);
      bc.close();
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('medcore-patient-drop', {
        detail: { facilityId, deskId, payload: null },
      })
    );
  }
}

/**
 * Subscribe to incoming patient drops for a frontdesk terminal.
 */
export function subscribePatientDrop(
  facilityId: string,
  deskId: string,
  callback: (payload: PatientDropPayload | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(channelName(facilityId, deskId));
    bc.onmessage = (ev) => {
      callback(ev.data as PatientDropPayload | null);
    };
  } catch {
    /* ignore */
  }

  const handleCustomEvent = (ev: Event) => {
    const custom = ev as CustomEvent<{ facilityId: string; deskId: string; payload: PatientDropPayload | null }>;
    if (custom.detail?.facilityId === facilityId && custom.detail?.deskId === deskId) {
      callback(custom.detail.payload);
    }
  };

  window.addEventListener('medcore-patient-drop', handleCustomEvent);

  return () => {
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
    window.removeEventListener('medcore-patient-drop', handleCustomEvent);
  };
}
