/**
 * MedCore Offline Edge Sync Engine
 * Caches active ward charts and queues authenticated mutations across Web + Native iOS/Android.
 */
import { AppState, type NativeEventSubscription } from 'react-native';
import {
  OFFLINE_QUEUE_KEY,
  getStoredItem,
  setStoredItem,
} from './nativeStorage';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  createdAt: string;
  retryCount: number;
}

const STORAGE_KEY_CACHE = 'medcore_offline_chart_cache_v1';

class OfflineSyncManager {
  private queue: QueuedMutation[] = [];
  private isOnline = true;
  private isSyncing = false;
  private authToken: string | undefined;
  private listeners: Set<(isOnline: boolean, queueCount: number) => void> = new Set();
  private appStateSub: NativeEventSubscription | null = null;

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    try {
      this.appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          this.isOnline = true;
          void this.drainQueue();
        }
      });
    } catch {
      /* ignore in non-RN test environments */
    }
  }

  public setAuthToken(token?: string) {
    this.authToken = token || undefined;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.notify();
    if (online) {
      void this.drainQueue();
    }
  }

  public loadQueue() {
    try {
      const raw = getStoredItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.queue = parsed;
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      setStoredItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      /* ignore */
    }
    this.notify();
  }

  public subscribe(cb: (isOnline: boolean, queueCount: number) => void) {
    this.listeners.add(cb);
    cb(this.isOnline, this.queue.length);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      l(this.isOnline, this.queue.length);
    }
  }

  public getStatus() {
    return {
      isOnline: this.isOnline,
      pendingCount: this.queue.length,
      queue: this.queue,
    };
  }

  public async executeWithOfflineQueue<T>(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' = 'POST',
    body: any
  ): Promise<{ success: boolean; data?: T; queued?: boolean }> {
    if (!this.isOnline) {
      const item: QueuedMutation = {
        id: `MUT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        endpoint,
        method,
        body,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      this.queue.push(item);
      this.saveQueue();
      return { success: true, queued: true };
    }

    try {
      const res = await fetch(endpoint, {
        method,
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return { success: true, data, queued: false };
    } catch {
      const item: QueuedMutation = {
        id: `MUT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        endpoint,
        method,
        body,
        createdAt: new Date().toISOString(),
        retryCount: 1,
      };
      this.queue.push(item);
      this.saveQueue();
      return { success: true, queued: true };
    }
  }

  public async drainQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || this.queue.length === 0) return { synced: 0, failed: 0 };
    this.isSyncing = true;

    let synced = 0;
    let failed = 0;
    const remaining: QueuedMutation[] = [];

    for (const item of this.queue) {
      try {
        const res = await fetch(item.endpoint, {
          method: item.method,
          headers: this.buildHeaders(),
          body: JSON.stringify(item.body),
        });

        if (res.ok) {
          synced++;
        } else {
          item.retryCount++;
          remaining.push(item);
          failed++;
        }
      } catch {
        item.retryCount++;
        remaining.push(item);
        failed++;
      }
    }

    this.queue = remaining;
    this.saveQueue();
    this.isSyncing = false;
    return { synced, failed };
  }

  public cacheChartData(key: string, data: any) {
    try {
      setStoredItem(
        `${STORAGE_KEY_CACHE}_${key}`,
        JSON.stringify({
          cachedAt: new Date().toISOString(),
          data,
        })
      );
    } catch {
      /* ignore */
    }
  }

  public getCachedChartData<T>(key: string): T | null {
    try {
      const raw = getStoredItem(`${STORAGE_KEY_CACHE}_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.data as T;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  public dispose() {
    this.appStateSub?.remove();
  }
}

export const offlineSyncManager = new OfflineSyncManager();
