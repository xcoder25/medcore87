/**
 * MedCore Client-Side Asynchronous Local Data Layer (IndexedDB via localforage)
 * Follows Technical Brief: Hybrid Offline-First Sync Architecture (Section 2.A)
 *
 * Guarantees:
 * 1. Non-blocking asynchronous I/O (no main-thread UI stutters during chart updates).
 * 2. Bypasses 5MB localStorage cap for high-density clinical records.
 * 3. Prevents Next.js SSR hydration mismatches by strictly reading cache in useEffect.
 */

import { useEffect, useState, useCallback } from 'react';
import localforage from 'localforage';

// Configure dedicated patient cache instance
export const patientCacheStore = localforage.createInstance({
  name: 'EMR_Client_Cache',
  storeName: 'patients',
  description: 'MedCore high-density offline clinical patient records'
});

export const offlineMutationStore = localforage.createInstance({
  name: 'EMR_Client_Cache',
  storeName: 'pending_mutations',
  description: 'MedCore offline mutation transaction queue for sync and blackout recovery'
});

export interface PatientRecord {
  id: string;
  mrn?: string;
  name?: string;
  status?: string;
  ward?: string;
  vitals?: Record<string, any>;
  chartNotes?: any[];
  prescriptions?: any[];
  labOrders?: any[];
  updatedAt?: string;
  is_conflict?: boolean;
  conflictDetails?: any;
  [key: string]: any;
}

export function usePatientData(patientId: string | null | undefined) {
  const [data, setData] = useState<PatientRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(patientId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!patientId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const targetId: string = patientId;
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const offlineCachedRecord = await patientCacheStore.getItem<PatientRecord>(targetId);
        if (isMounted) {
          if (offlineCachedRecord) {
            setData(offlineCachedRecord);
          }
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn(`[usePatientData] Error retrieving patient ${targetId} from IndexedDB:`, err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [patientId]);

  const updateCachedPatient = useCallback(
    async (updater: Partial<PatientRecord> | ((prev: PatientRecord | null) => PatientRecord)) => {
      if (!patientId) return;
      const targetId: string = patientId;
      try {
        const current = (await patientCacheStore.getItem<PatientRecord>(targetId)) || data;
        const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater, id: targetId };
        await patientCacheStore.setItem(targetId, updated);
        setData(updated);
        return updated;
      } catch (err) {
        console.error(`[usePatientData] Failed to write cache for ${targetId}:`, err);
        throw err;
      }
    },
    [patientId, data]
  );

  return { data, isLoading, error, updateCachedPatient };
}
