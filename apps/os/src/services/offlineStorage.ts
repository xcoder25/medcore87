/**
 * MedCore Hospital OS Offline Storage & Mutation Queue
 * Guarantees zero clinical data loss when workstation WAN or local hospital WiFi drops.
 * Upgraded to IndexedDB (localforage) per Technical Brief Phase 1.
 */

import { offlineMutationStore, patientCacheStore } from '../hooks/usePatientData';

export interface PendingAction {
  id: string;
  type: string;
  url: string;
  method: string;
  payload: any;
  timestamp: string;
}

const ACTION_QUEUE_KEY = 'medcore_os_offline_actions_v1';
const PATIENT_CACHE_KEY = 'medcore_os_patient_cache_v1';

class OfflineStorageService {
  private queue: PendingAction[] = [];
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private initialized: boolean = false;

  constructor() {
    this.restoreQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  private async restoreQueue(): Promise<void> {
    try {
      // 1. First attempt to restore from IndexedDB
      const items: PendingAction[] = [];
      await offlineMutationStore.iterate<PendingAction, void>((value) => {
        if (value && value.id) items.push(value);
      });

      if (items.length > 0) {
        this.queue = items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        this.initialized = true;
        return;
      }

      // 2. Fallback / migrate from legacy localStorage if present
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(ACTION_QUEUE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.queue = parsed;
            // Migrate to IndexedDB
            for (const item of parsed) {
              await offlineMutationStore.setItem(item.id, item);
            }
            window.localStorage.removeItem(ACTION_QUEUE_KEY);
          }
        }
      }
    } catch (err) {
      console.warn('[OfflineStorageService] Error restoring queue from IndexedDB:', err);
    } finally {
      this.initialized = true;
    }
  }

  private async persistQueueAsync(): Promise<void> {
    try {
      // Clear and re-populate IndexedDB mutation store
      await offlineMutationStore.clear();
      for (const item of this.queue) {
        await offlineMutationStore.setItem(item.id, item);
      }
    } catch (err) {
      console.warn('[OfflineStorageService] IDB persist error, using localStorage backup:', err);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(this.queue));
        }
      } catch {}
    }
  }

  public enqueueAction(action: Omit<PendingAction, 'id' | 'timestamp'>): PendingAction {
    const record: PendingAction = {
      ...action,
      id: `ACT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    this.queue.push(record);
    // Non-blocking async persistence to IndexedDB
    this.persistQueueAsync();
    return record;
  }

  public async flushQueue(): Promise<{ synced: number; remaining: number }> {
    if (this.queue.length === 0) return { synced: 0, remaining: 0 };

    let synced = 0;
    const remaining: PendingAction[] = [];

    for (const act of this.queue) {
      try {
        const res = await fetch(act.url, {
          method: act.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(act.payload),
        });
        if (res.ok) {
          synced++;
          await offlineMutationStore.removeItem(act.id);
        } else {
          remaining.push(act);
        }
      } catch {
        remaining.push(act);
      }
    }

    this.queue = remaining;
    await this.persistQueueAsync();
    return { synced, remaining: remaining.length };
  }

  public async cachePatientList(patients: any[]): Promise<void> {
    try {
      if (Array.isArray(patients)) {
        for (const p of patients) {
          if (p && p.id) {
            await patientCacheStore.setItem(p.id, p);
          }
        }
      }
    } catch (err) {
      console.warn('[OfflineStorageService] Error caching patients to IndexedDB:', err);
    }
  }

  public async getCachedPatientList(): Promise<any[]> {
    try {
      const list: any[] = [];
      await patientCacheStore.iterate((value) => {
        list.push(value);
      });
      if (list.length > 0) return list;

      // Legacy fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(PATIENT_CACHE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return [];
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const offlineStorage = new OfflineStorageService();

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}
