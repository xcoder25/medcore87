'use client';

/**
 * Power-Outage-Resilient Form Draft Store (`formDraftStore.ts`).
 *
 * Never uses `localStorage`.
 * Auto-saves in-progress forms every 400ms to:
 *  1. Cloud (`/api/drafts` — Aurora PostgreSQL `form_drafts` + Server Vault)
 *  2. On-Prem LAN Hub (`/api/v1/sync/facility/:facilityId` under `draft::formType::draftId`)
 *  3. Emergency `navigator.sendBeacon('/api/drafts')` on `pagehide` / `beforeunload` / power loss
 *
 * When a workstation restarts after a power outage, `useFormDraft` fetches the saved
 * draft from Cloud or On-Prem and offers a one-click restoration banner (or auto-restores).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { pushFacilityData, isLanApiEligible } from './hospitalSync';

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'restored' | 'error';

export interface FormDraftEnvelope<T = unknown> {
  facilityId: string;
  formType: string;
  draftId: string;
  staffBadge?: string;
  step?: number;
  payload: T;
  updatedAt: string;
  expiresAt?: string;
}

// Session-RAM cache for instant tab switches within the same session
const ramDraftCache = new Map<string, FormDraftEnvelope>();

function draftCacheKey(facilityId: string, formType: string, draftId: string): string {
  return `${facilityId || 'DEFAULT'}::${formType}::${draftId || 'default'}`;
}

/**
 * Immediately save a form draft to Cloud (`/api/drafts`) and On-Prem LAN Hub.
 */
export async function saveDraft<T>(opts: {
  facilityId: string;
  formType: string;
  draftId?: string;
  staffBadge?: string;
  step?: number;
  data: T;
}): Promise<FormDraftEnvelope<T> | null> {
  if (typeof window === 'undefined') return null;
  const facilityId = (opts.facilityId || 'DEFAULT').trim();
  const formType = opts.formType.trim();
  const draftId = (opts.draftId || opts.staffBadge || 'default').trim();
  const nowIso = new Date().toISOString();

  const envelope: FormDraftEnvelope<T> = {
    facilityId,
    formType,
    draftId,
    staffBadge: opts.staffBadge,
    step: opts.step ?? 1,
    payload: opts.data,
    updatedAt: nowIso,
  };

  ramDraftCache.set(draftCacheKey(facilityId, formType, draftId), envelope);

  // 1) Save to Cloud (/api/drafts)
  const cloudPromise = fetch('/api/drafts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  }).catch(() => null);

  // 2) Save to On-Prem LAN Hub in parallel if available
  const premKey = `draft:${formType}:${draftId}`;
  const premPromise = isLanApiEligible()
    ? pushFacilityData(facilityId, { [premKey]: envelope }).catch(() => false)
    : Promise.resolve(false);

  await Promise.all([cloudPromise, premPromise]);
  return envelope;
}

/**
 * Load a saved draft from Cloud (`/api/drafts`) or session RAM.
 */
export async function loadDraft<T>(
  facilityId: string,
  formType: string,
  draftId = 'default'
): Promise<FormDraftEnvelope<T> | null> {
  if (typeof window === 'undefined') return null;
  const fid = (facilityId || 'DEFAULT').trim();
  const did = (draftId || 'default').trim();
  const ck = draftCacheKey(fid, formType, did);

  try {
    const qs = new URLSearchParams({
      facilityId: fid,
      formType,
      draftId: did,
    });
    const res = await fetch(`/api/drafts?${qs.toString()}`);
    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; draft?: FormDraftEnvelope<T> | null };
      if (json.draft && json.draft.payload) {
        ramDraftCache.set(ck, json.draft);
        return json.draft;
      }
    }
  } catch {
    /* network offline — check RAM cache */
  }

  const cached = ramDraftCache.get(ck) as FormDraftEnvelope<T> | undefined;
  return cached ?? null;
}

/**
 * Clear a form draft after successful submission or explicit reset.
 */
export async function clearDraft(
  facilityId: string,
  formType: string,
  draftId = 'default'
): Promise<void> {
  if (typeof window === 'undefined') return;
  const fid = (facilityId || 'DEFAULT').trim();
  const did = (draftId || 'default').trim();
  ramDraftCache.delete(draftCacheKey(fid, formType, did));

  try {
    const qs = new URLSearchParams({
      facilityId: fid,
      formType,
      draftId: did,
    });
    await fetch(`/api/drafts?${qs.toString()}`, { method: 'DELETE' });
  } catch {
    /* ignore */
  }

  if (isLanApiEligible()) {
    const premKey = `draft:${formType}:${did}`;
    void pushFacilityData(fid, { [premKey]: null }).catch(() => {});
  }
}

export interface UseFormDraftOptions<T> {
  facilityId: string;
  formType: string;
  draftId?: string;
  staffBadge?: string;
  step?: number;
  data: T;
  /** Return true only when the form has meaningful user input worth saving as a draft */
  isDirty: (data: T) => boolean;
  /** Called when user clicks "Resume Draft" or when autoRestore is enabled */
  onRestore: (payload: T, step?: number) => void;
  /** Debounce interval in ms (default 450ms) */
  debounceMs?: number;
}

export interface UseFormDraftResult<T> {
  status: DraftSaveStatus;
  lastSavedAt: string | null;
  restorableDraft: FormDraftEnvelope<T> | null;
  applyRestoredDraft: () => void;
  discardRestoredDraft: () => Promise<void>;
  saveDraftNow: () => Promise<void>;
  clearCurrentDraft: () => Promise<void>;
}

/**
 * React hook that continuously auto-saves form state to Cloud & On-Prem
 * and restores unfinished drafts after a power outage or browser restart.
 */
export function useFormDraft<T>(opts: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const {
    facilityId,
    formType,
    draftId = opts.staffBadge || 'default',
    staffBadge,
    step = 1,
    data,
    isDirty,
    onRestore,
    debounceMs = 450,
  } = opts;

  const [status, setStatus] = useState<DraftSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [restorableDraft, setRestorableDraft] = useState<FormDraftEnvelope<T> | null>(null);

  const latestDataRef = useRef<T>(data);
  const latestStepRef = useRef<number>(step);
  const dirtyRef = useRef<boolean>(false);
  const suppressSaveRef = useRef<boolean>(false);

  latestDataRef.current = data;
  latestStepRef.current = step;
  dirtyRef.current = isDirty(data);

  // 1) Check Cloud & On-Prem for an existing unfinished draft on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existing = await loadDraft<T>(facilityId, formType, draftId);
      if (cancelled || !existing || !existing.payload) return;
      if (isDirty(existing.payload)) {
        setRestorableDraft(existing);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, formType, draftId]);

  // 2) Debounced auto-save to Cloud + On-Prem whenever form data or step changes
  useEffect(() => {
    if (suppressSaveRef.current) {
      suppressSaveRef.current = false;
      return;
    }
    if (!isDirty(data)) return;

    setStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const res = await saveDraft({
          facilityId,
          formType,
          draftId,
          staffBadge,
          step,
          data,
        });
        if (res) {
          setStatus('saved');
          setLastSavedAt(res.updatedAt);
          // Once user is actively saving new changes, hide old restore prompt
          setRestorableDraft(null);
        }
      } catch {
        setStatus('error');
      }
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, formType, draftId, staffBadge, step, JSON.stringify(data)]);

  // 3) Emergency power-cut / tab-close beacon flush
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flushBeacon = () => {
      if (!dirtyRef.current) return;
      try {
        const payload = JSON.stringify({
          facilityId,
          formType,
          draftId,
          staffBadge,
          step: latestStepRef.current,
          payload: latestDataRef.current,
        });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/drafts', blob);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pagehide', flushBeacon);
    window.addEventListener('beforeunload', flushBeacon);
    return () => {
      window.removeEventListener('pagehide', flushBeacon);
      window.removeEventListener('beforeunload', flushBeacon);
    };
  }, [facilityId, formType, draftId, staffBadge]);

  const applyRestoredDraft = useCallback(() => {
    if (!restorableDraft) return;
    suppressSaveRef.current = true;
    onRestore(restorableDraft.payload, restorableDraft.step);
    setLastSavedAt(restorableDraft.updatedAt);
    setStatus('restored');
    setRestorableDraft(null);
  }, [restorableDraft, onRestore]);

  const discardRestoredDraft = useCallback(async () => {
    setRestorableDraft(null);
    await clearDraft(facilityId, formType, draftId);
    setStatus('idle');
    setLastSavedAt(null);
  }, [facilityId, formType, draftId]);

  const saveDraftNow = useCallback(async () => {
    setStatus('saving');
    const res = await saveDraft({
      facilityId,
      formType,
      draftId,
      staffBadge,
      step: latestStepRef.current,
      data: latestDataRef.current,
    });
    if (res) {
      setStatus('saved');
      setLastSavedAt(res.updatedAt);
      setRestorableDraft(null);
    }
  }, [facilityId, formType, draftId, staffBadge]);

  const clearCurrentDraft = useCallback(async () => {
    suppressSaveRef.current = true;
    setRestorableDraft(null);
    setStatus('idle');
    setLastSavedAt(null);
    await clearDraft(facilityId, formType, draftId);
  }, [facilityId, formType, draftId]);

  return {
    status,
    lastSavedAt,
    restorableDraft,
    applyRestoredDraft,
    discardRestoredDraft,
    saveDraftNow,
    clearCurrentDraft,
  };
}
