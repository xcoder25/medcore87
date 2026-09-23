import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { SyncTopic, EmitterApp, SyncEnvelope } from '@medcore/types';
import crypto from 'crypto';

export interface ConnectedClient {
  id: string;
  socket: WebSocket;
  app: EmitterApp;
  facilityId?: string;
  topics: Set<SyncTopic>;
  connectedAt: string;
}

export class SyncEventBus extends EventEmitter {
  private clients: Map<string, ConnectedClient> = new Map();
  private eventHistory: SyncEnvelope[] = [];
  private static readonly MAX_HISTORY = 200;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Initializes WebSocket Server attached to HTTP server
   */
  public attachWebSocketServer(wss: WebSocketServer): void {
    wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `CLI-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
      const connectedAt = new Date().toISOString();

      const client: ConnectedClient = {
        id: clientId,
        socket: ws,
        app: 'MEDCORE_OS', // default fallback until handshake
        topics: new Set<SyncTopic>([
          'PATIENT_REGISTERED',
          'PATIENT_ADMITTED',
          'BED_OCCUPIED',
          'VITALS_RECORDED',
          'MEDICATION_PRESCRIBED',
          'LAB_ORDERED',
          'BILL_GENERATED',
          'PAYMENT_RECEIVED',
          'WALLET_BALANCE_UPDATED',
          'TILL_SHIFT_OPENED',
          'TILL_SHIFT_CLOSED',
          'BREAK_GLASS_TRIGGERED',
          'EPIDEMIC_SURGE_ALERT',
        ]),
        connectedAt,
      };

      this.clients.set(clientId, client);

      // Send greeting & recent catch-up events
      const welcome: SyncEnvelope<{ clientId: string; message: string; activeClients: number }> = {
        eventId: `EVT-WELCOME-${clientId}`,
        topic: 'BILL_GENERATED', // innocuous topic
        emitterApp: 'API_SERVER',
        timestamp: connectedAt,
        payload: {
          clientId,
          message: 'Connected to MedCore Real-Time Sync Hub (M87 Core)',
          activeClients: this.clients.size,
        },
        traceId: crypto.randomUUID(),
      };
      ws.send(JSON.stringify(welcome));

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString('utf8'));
          if (msg.action === 'SUBSCRIBE') {
            if (msg.app) client.app = msg.app;
            if (msg.facilityId) client.facilityId = msg.facilityId;
            if (Array.isArray(msg.topics)) {
              client.topics = new Set<SyncTopic>(msg.topics);
            }
            ws.send(
              JSON.stringify({
                status: 'SUBSCRIBED',
                clientId,
                app: client.app,
                facilityId: client.facilityId,
                subscribedTopics: Array.from(client.topics),
              })
            );
          } else if (msg.action === 'PING') {
            ws.send(JSON.stringify({ status: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch {
          // ignore malformed payloads
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      ws.on('error', () => {
        this.clients.delete(clientId);
      });
    });
  }

  /**
   * Broadcasts a real-time event across the ecosystem to connected applications
   */
  public broadcast<T>(params: {
    topic: SyncTopic;
    facilityId?: string;
    emitterApp: EmitterApp;
    payload: T;
  }): SyncEnvelope<T> {
    const envelope: SyncEnvelope<T> = {
      eventId: `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      topic: params.topic,
      facilityId: params.facilityId,
      emitterApp: params.emitterApp,
      timestamp: new Date().toISOString(),
      payload: params.payload,
      traceId: crypto.randomUUID(),
    };

    // Store in historical replay buffer
    this.eventHistory.push(envelope as unknown as SyncEnvelope);
    if (this.eventHistory.length > SyncEventBus.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    // Emit in Node process
    this.emit(params.topic, envelope);

    // Send through WebSockets to matching clients
    const payloadStr = JSON.stringify(envelope);

    for (const [, client] of this.clients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        // Topic filter
        if (client.topics.size > 0 && !client.topics.has(params.topic)) {
          continue;
        }
        // Facility filter (if specified on both sides)
        if (params.facilityId && client.facilityId && params.facilityId !== client.facilityId) {
          // Allow MOH Admin to see all facilities
          if (client.app !== 'MEDCORE_ADMIN') {
            continue;
          }
        }

        try {
          client.socket.send(payloadStr);
        } catch {
          // Socket send failed
        }
      }
    }

    return envelope;
  }

  public getRecentEvents(limit = 50): SyncEnvelope[] {
    return this.eventHistory.slice().reverse().slice(0, limit);
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }

  public getConnectedClients(): Array<{ id: string; app: EmitterApp; facilityId?: string; connectedAt: string }> {
    return Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      app: c.app,
      facilityId: c.facilityId,
      connectedAt: c.connectedAt,
    }));
  }
}

export const syncEventBus = new SyncEventBus();
