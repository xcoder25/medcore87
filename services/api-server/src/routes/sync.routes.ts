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
