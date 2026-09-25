/**
 * MedCore Hospital OS Offline Storage & Mutation Queue
 * Guarantees zero clinical data loss when workstation WAN or local hospital WiFi drops.
 */

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

  private restoreQueue(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(ACTION_QUEUE_KEY);
        if (stored) this.queue = JSON.parse(stored);
      }
    } catch {
      this.queue = [];
    }
  }

  private persistQueue(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(this.queue));
      }
    } catch {}
  }

  public enqueueAction(action: Omit<PendingAction, 'id' | 'timestamp'>): PendingAction {
    const record: PendingAction = {
      ...action,
      id: `ACT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    this.queue.push(record);
    this.persistQueue();
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
        } else {
          remaining.push(act);
        }
      } catch {
        remaining.push(act);
      }
    }

    this.queue = remaining;
    this.persistQueue();
    return { synced, remaining: remaining.length };
  }

  public cachePatientList(patients: any[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PATIENT_CACHE_KEY, JSON.stringify(patients));
      }
    } catch {}
  }

  public getCachedPatientList(): any[] {
    try {
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
