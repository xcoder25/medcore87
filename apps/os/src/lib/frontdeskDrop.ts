/**
 * frontdeskDrop.ts — Firestore-backed zero-touch patient onboarding channel.
 *
 * A patient uses the MedCore mobile app to push their profile to a specific
 * frontdesk terminal.  The frontdesk OS subscribes in real-time via Firestore
 * onSnapshot and shows an animated slide-in notification for the clinician to
 * accept or dismiss.
 *
 * Document path:
 *   facilities/{facilityId}/frontdesk/{deskId}/incoming_patient
 *
 * The document is auto-cleared 30 s after arrival to prevent stale alerts.
 */

import { getFirestore } from './firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

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
  /** Optional server timestamp (set by Firestore on write) */
  arrivedAt?: unknown;
}

const COLLECTION = 'facilities';
const SUBCOLLECTION = 'frontdesk';
const DOC_ID = 'incoming_patient';
const AUTO_CLEAR_MS = 30_000;

function dropDocRef(facilityId: string, deskId: string) {
  const db = getFirestore();
  return doc(db, COLLECTION, facilityId, SUBCOLLECTION, deskId, 'drops', DOC_ID);
}

/**
 * Push a patient drop payload to the frontdesk channel.
 * Called from the patient-app side (or for testing / demo purposes).
 */
export async function pushPatientDrop(
  facilityId: string,
  deskId: string,
  payload: Omit<PatientDropPayload, 'arrivedAt'>
): Promise<void> {
  const ref = dropDocRef(facilityId, deskId);
  await setDoc(ref, {
    ...payload,
    arrivedAt: serverTimestamp(),
  });

  // Auto-clear after 30 s so stale notifications never persist
  setTimeout(async () => {
    try {
      await deleteDoc(ref);
    } catch {
      // silent — document may already be cleared by Accept
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
  try {
    await deleteDoc(dropDocRef(facilityId, deskId));
  } catch {
    // silent
  }
}

/**
 * Subscribe to incoming patient drops for a frontdesk terminal.
 * @returns Firestore unsubscribe function
 */
export function subscribePatientDrop(
  facilityId: string,
  deskId: string,
  callback: (payload: PatientDropPayload | null) => void
): Unsubscribe {
  const ref = dropDocRef(facilityId, deskId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as PatientDropPayload);
      } else {
        callback(null);
      }
    },
    () => {
      // Firestore offline / permission error — silently ignore
      callback(null);
    }
  );
}

