import fs from 'fs';
import path from 'path';
import { SyncEnvelope } from '@medcore/types';

export interface OutboxRecord {
  id: string;
  envelope: SyncEnvelope;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED';
  retryCount: number;
  lastAttemptAt?: string;
  createdAt: string;
}

export interface PersistentSnapshot<T = any> {
  version: number;
  savedAt: string;
  data: T;
  outbox: OutboxRecord[];
}

export class DiskPersistenceService {
  private dataDir: string;
  private filePath: string;
  private outbox: Map<string, OutboxRecord> = new Map();
  private isSaving = false;
  private pendingSave = false;

  constructor(customPath?: string) {
    this.dataDir = path.resolve(process.cwd(), 'data', 'persistence');
    this.filePath = customPath || path.join(this.dataDir, 'medcore_store.json');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[Persistence] Could not create data directory:', err);
    }
  }

  /**
   * Loads persisted snapshot from disk
   */
  public loadSnapshot<T>(): PersistentSnapshot<T> | null {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const snapshot: PersistentSnapshot<T> = JSON.parse(raw);
      if (snapshot.outbox && Array.isArray(snapshot.outbox)) {
        for (const record of snapshot.outbox) {
          this.outbox.set(record.id, record);
        }
      }
      console.log(`[Persistence] Loaded snapshot from disk (${snapshot.savedAt}). Outbox queue: ${this.outbox.size} events.`);
      return snapshot;
    } catch (err) {
      console.error('[Persistence] Error loading snapshot, starting fresh:', err);
      return null;
    }
  }

  /**
   * Persists data atomically to disk with write-ahead temp file
   */
  public saveSnapshot<T>(data: T): void {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }

    this.isSaving = true;
    try {
      this.ensureDirectory();
      const snapshot: PersistentSnapshot<T> = {
        version: 1,
        savedAt: new Date().toISOString(),
        data,
        outbox: Array.from(this.outbox.values()),
      };

      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[Persistence] Failed to write atomic snapshot:', err);
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        this.saveSnapshot(data);
      }
    }
  }

  /**
   * Transactional Outbox: records an event before or alongside broadcasting
   */
  public queueOutboxEvent(envelope: SyncEnvelope): OutboxRecord {
    const record: OutboxRecord = {
      id: envelope.eventId,
      envelope,
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.outbox.set(record.id, record);
    return record;
  }

  public markOutboxDispatched(eventId: string): void {
    const record = this.outbox.get(eventId);
    if (record) {
      record.status = 'DISPATCHED';
      record.lastAttemptAt = new Date().toISOString();
    }
  }

  public getPendingOutbox(): OutboxRecord[] {
    return Array.from(this.outbox.values()).filter((r) => r.status === 'PENDING');
  }

  public getAllOutbox(): OutboxRecord[] {
    return Array.from(this.outbox.values());
  }
}

export const persistenceService = new DiskPersistenceService();
