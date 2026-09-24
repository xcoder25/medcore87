/**
 * MedCore Offline Edge Sync Engine
 * Caches active ward charts and queues mutations when WAN / local network is down.
 */

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  createdAt: string;
  retryCount: number;
}

const STORAGE_KEY_QUEUE = 'medcore_offline_mutation_queue_v1';
const STORAGE_KEY_CACHE = 'medcore_offline_chart_cache_v1';

class OfflineSyncManager {
  private queue: QueuedMutation[] = [];
  private isOnline = true;
  private isSyncing = false;
  private listeners: Set<(isOnline: boolean, queueCount: number) => void> = new Set();

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      this.isOnline = navigator.onLine;
    }
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.notify();
    if (online) {
      this.drainQueue();
    }
  }

  private loadQueue() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY_QUEUE);
        if (raw) this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.queue));
      }
    } catch {}
    this.notify();
  }

  public subscribe(cb: (isOnline: boolean, queueCount: number) => void) {
    this.listeners.add(cb);
    cb(this.isOnline, this.queue.length);
    return () => this.listeners.delete(cb);
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

  /**
   * Enqueues an action to be executed immediately or when WAN is restored
   */
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return { success: true, data, queued: false };
    } catch (err) {
      // Network failed during call — enqueue for offline replay
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

  /**
   * Drains and syncs all queued mutations in order
   */
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
          headers: { 'Content-Type': 'application/json' },
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

  // Local chart caching
  public cacheChartData(key: string, data: any) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`${STORAGE_KEY_CACHE}_${key}`, JSON.stringify({
          cachedAt: new Date().toISOString(),
          data,
        }));
      }
    } catch {}
  }

  public getCachedChartData<T>(key: string): T | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`${STORAGE_KEY_CACHE}_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.data as T;
        }
      }
    } catch {}
    return null;
  }
}

export const offlineSyncManager = new OfflineSyncManager();
