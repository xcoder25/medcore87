import { Router, Request, Response } from 'express';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

/**
 * GET /api/v1/sync/status
 * View real-time synchronization hub health & connected client telemetry
 */
router.get('/status', (req: Request, res: Response) => {
  const activeCount = syncEventBus.getActiveClientCount();
  const clients = syncEventBus.getConnectedClients();
  const recentEvents = syncEventBus.getRecentEvents(10);

  res.json({
    success: true,
    data: {
      hubStatus: 'ONLINE_ACTIVE',
      wsEndpoint: '/ws',
      activeClientsCount: activeCount,
      connectedClients: clients,
      recentEventCount: recentEvents.length,
      recentEvents,
    },
  });
});

/**
 * GET /api/v1/sync/history
 * Replay or view event bus history
 */
router.get('/history', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const events = syncEventBus.getRecentEvents(limit);
  res.json({ success: true, total: events.length, data: events });
});

/**
 * POST /api/v1/sync/broadcast
 * Dispatches an event across the real-time bus
 */
router.post('/broadcast', (req: Request, res: Response) => {
  const { topic, facilityId, emitterApp, payload } = req.body;

  if (!topic || !emitterApp || !payload) {
    return res.status(400).json({ success: false, error: 'topic, emitterApp, and payload are required' });
  }

  const envelope = syncEventBus.broadcast({
    topic,
    facilityId,
    emitterApp,
    payload,
  });

  res.json({
    success: true,
    message: `Event ${topic} broadcasted to all connected clients.`,
    data: envelope,
  });
});

export default router;

/**
 * In-memory facility shared store (LAN pilot).
 * All workstations at the same hospital read/write the same blob via this API.
 * For production, replace with Postgres/Redis; for offline LAN, one PC runs api-server.
 */
const facilityStore = new Map<string, { updatedAt: string; data: Record<string, unknown> }>();

/**
 * GET /api/v1/sync/facility/:facilityId
 * Shared hospital snapshot for offline-first multi-workstation sync
 */
router.get('/facility/:facilityId', (req: Request, res: Response) => {
  const facilityId = String(req.params.facilityId || 'default');
  const row = facilityStore.get(facilityId);
  if (!row) {
    return res.json({
      success: true,
      data: { facilityId, updatedAt: null, data: {} },
    });
  }
  res.json({
    success: true,
    data: { facilityId, updatedAt: row.updatedAt, data: row.data },
  });
});

/**
 * PUT /api/v1/sync/facility/:facilityId
 * Merge/replace hospital shared keys (staff, transfers, access, activity, cards, bills)
 */
router.put('/facility/:facilityId', (req: Request, res: Response) => {
  const facilityId = String(req.params.facilityId || 'default');
  const incoming = (req.body && req.body.data) || req.body || {};
  const prev = facilityStore.get(facilityId)?.data || {};
  const merged = { ...prev, ...incoming };
  const updatedAt = new Date().toISOString();
  facilityStore.set(facilityId, { updatedAt, data: merged });

  // Notify WS clients that facility data changed
  try {
    syncEventBus.broadcast({
      topic: 'FACILITY_DATA_SYNC',
      facilityId,
      emitterApp: 'API_SERVER',
      payload: { keys: Object.keys(incoming), updatedAt },
    });
  } catch {
    /* optional */
  }

  res.json({
    success: true,
    data: { facilityId, updatedAt, keys: Object.keys(merged) },
  });
});
