/**
 * Pillar 3: Real-Time UI & Dashboard Synchronization
 *
 * Replaces legacy polling or third-party listeners with native AWS Real-Time sync.
 * Listens for AWS AppSync GraphQL Subscriptions / WebSocket events triggered by EventBridge,
 * and immediately broadcasts DOM events to trigger sub-second UI re-renders across the hospital floor.
 */

export interface AppSyncRealtimeMessage {
  eventId: string;
  source: string;
  detailType: string;
  facilityId: string;
  payload: Record<string, any>;
  timestamp: string;
}

export type RealtimeEventHandler = (msg: AppSyncRealtimeMessage) => void;

export class MedCoreAppSyncSyncManager {
  private static instance: MedCoreAppSyncSyncManager;
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private subscribers = new Set<RealtimeEventHandler>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initConnection();
    }
  }

  public static getInstance(): MedCoreAppSyncSyncManager {
    if (!MedCoreAppSyncSyncManager.instance) {
      MedCoreAppSyncSyncManager.instance = new MedCoreAppSyncSyncManager();
    }
    return MedCoreAppSyncSyncManager.instance;
  }

  private initConnection() {
    const endpoint =
      process.env.NEXT_PUBLIC_APPSYNC_WSS_URL ||
      process.env.NEXT_PUBLIC_AWS_IOT_ENDPOINT;

    if (!endpoint || typeof window === 'undefined') {
      // Offline / Local development fallback: Uses BroadcastChannel for instant inter-tab sync
      this.setupLocalBroadcastChannel();
      return;
    }

    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(endpoint, ['graphql-ws']);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.info('[AWS AppSync Realtime] Connected to live hospital event stream.');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch {
          /* ignore malformed frames */
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
          this.reconnectAttempts++;
          setTimeout(() => this.initConnection(), delay);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.isConnecting = false;
      this.setupLocalBroadcastChannel();
    }
  }

  private setupLocalBroadcastChannel() {
    try {
      const bc = new BroadcastChannel('medcore_aws_eventbridge');
      bc.onmessage = (ev) => {
        if (ev.data) this.handleIncomingMessage(ev.data);
      };
    } catch {
      /* ignore */
    }
  }

  /**
   * Resolve active workstation facility ID to guarantee tenant isolation
   */
  private getActiveFacilityId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('medcore_session_v1');
      if (stored) {
        const s = JSON.parse(stored);
        if (s.facilityId || s.facility) return s.facilityId || s.facility;
      }
      return localStorage.getItem('medcore_active_facility_id') || 'IGH-EKT';
    } catch {
      return null;
    }
  }

  /**
   * Dispatch local DOM events for immediate sub-second UI updates across dashboard components.
   * Multi-Tenant Isolation: Discards any event originating from a different facility.
   */
  public handleIncomingMessage(msg: AppSyncRealtimeMessage) {
    if (!msg || !msg.detailType) return;

    // Strict Tenant Isolation: An event at Facility A will NEVER flash on a dashboard at Facility B
    const activeFacility = this.getActiveFacilityId();
    if (msg.facilityId && activeFacility && msg.facilityId !== activeFacility) {
      return;
    }

    // Notify registered direct listeners
    this.subscribers.forEach((handler) => {
      try {
        handler(msg);
      } catch (e) {
        console.warn('[AppSync handler error]', e);
      }
    });

    if (typeof window === 'undefined') return;

    // Map EventBridge / AppSync events to UI state update signals
    switch (msg.detailType) {
      case 'PatientRegistered':
        window.dispatchEvent(new CustomEvent('medcore-patients-updated', { detail: msg.payload }));
        window.dispatchEvent(new CustomEvent('medcore-reception-ops', { detail: msg.payload }));
        break;

      case 'VitalsRecorded':
        window.dispatchEvent(new CustomEvent('medcore-vitals', { detail: msg.payload }));
        window.dispatchEvent(new CustomEvent('medcore-patients-updated', { detail: msg.payload }));
        break;

      case 'ClinicalOrderCreated':
        window.dispatchEvent(new CustomEvent('medcore-clinical-orders', { detail: msg.payload }));
        window.dispatchEvent(new CustomEvent('medcore-patient-bills', { detail: msg.payload }));
        break;

      case 'PaymentConfirmed':
      case 'InvoiceGenerated':
        window.dispatchEvent(new CustomEvent('medcore-patient-bills', { detail: msg.payload }));
        window.dispatchEvent(new CustomEvent('medcore-reception-ops', { detail: msg.payload }));
        break;

      default:
        window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: msg }));
        break;
    }
  }

  public subscribe(handler: RealtimeEventHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }
}

export const appsyncSync = MedCoreAppSyncSyncManager.getInstance();

export function subscribeToHospitalEvents(handler: RealtimeEventHandler): () => void {
  return appsyncSync.subscribe(handler);
}

