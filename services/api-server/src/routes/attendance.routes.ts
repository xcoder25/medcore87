/**
 * Staff attendance — live AI recognition / time-book only.
 * Does NOT accept or store video. Optional confidence + cameraId metadata only.
 */
import { Router, Request, Response } from 'express';
import { auditLedger } from '../security/auditLedger';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

export type AttendanceDirection = 'IN' | 'OUT';

export interface AttendanceEvent {
  id: string;
  facilityId: string;
  staffId?: string;
  badgeId?: string;
  staffName?: string;
  direction: AttendanceDirection;
  punchedAt: string;
  source: 'LIVE_AI' | 'MANUAL' | 'DEVICE';
  cameraId?: string;
  confidence?: number;
  note?: string;
}

/** In-memory until DATABASE_URL / Postgres pool is wired in production */
const events: AttendanceEvent[] = [];
const MAX_EVENTS = 50_000;

function pushEvent(e: AttendanceEvent) {
  events.push(e);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

/**
 * POST /api/v1/attendance/punch
 * Body: { facilityId, direction, badgeId?, staffId?, staffName?, cameraId?, confidence?, source?, note? }
 * Rejects any video/base64 payload intentionally.
 */
router.post('/punch', (req: Request, res: Response) => {
  const body = req.body || {};

  if (body.video || body.videoBase64 || body.recording || body.streamBlob) {
    return res.status(400).json({
      success: false,
      error: 'Video payloads are not accepted. Attendance AI must send punch metadata only (live feed is not stored).',
      code: 'VIDEO_NOT_ALLOWED',
    });
  }

  const facilityId = String(body.facilityId || '').trim();
  const direction = String(body.direction || '').toUpperCase();
  if (!facilityId || (direction !== 'IN' && direction !== 'OUT')) {
    return res.status(400).json({
      success: false,
      error: 'facilityId and direction (IN|OUT) are required',
    });
  }

  if (!body.badgeId && !body.staffId && !body.staffName) {
    return res.status(400).json({
      success: false,
      error: 'Provide badgeId, staffId, or staffName for the recognised staff member',
    });
  }

  const confidence =
    body.confidence != null ? Math.min(1, Math.max(0, Number(body.confidence))) : undefined;

  const event: AttendanceEvent = {
    id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    facilityId,
    staffId: body.staffId ? String(body.staffId) : undefined,
    badgeId: body.badgeId ? String(body.badgeId) : undefined,
    staffName: body.staffName ? String(body.staffName) : undefined,
    direction: direction as AttendanceDirection,
    punchedAt: body.punchedAt ? String(body.punchedAt) : new Date().toISOString(),
    source: (body.source as AttendanceEvent['source']) || 'LIVE_AI',
    cameraId: body.cameraId ? String(body.cameraId) : undefined,
    confidence,
    note: body.note ? String(body.note) : undefined,
  };

  pushEvent(event);

  auditLedger.logEvent({
    actorId: event.badgeId || event.staffId || 'ATTENDANCE-AI',
    actorName: event.staffName || 'Attendance',
    actorRole: 'SYSTEM',
    facilityId,
    action: 'ATTENDANCE_PUNCH',
    resourceType: 'ATTENDANCE',
    resourceId: event.id,
    reason: `${event.direction} via ${event.source}`,
  });

  syncEventBus.publish('ATTENDANCE_PUNCH', {
    ...event,
    message: `${event.staffName || event.badgeId || 'Staff'} clocked ${event.direction}`,
  });

  res.status(201).json({
    success: true,
    data: event,
    policy: 'Live feed only — event stored, video not retained in MedCore',
  });
});

/**
 * GET /api/v1/attendance/events?facilityId=&limit=
 */
router.get('/events', (req: Request, res: Response) => {
  const facilityId = req.query.facilityId ? String(req.query.facilityId) : null;
  const limit = Math.min(500, parseInt(String(req.query.limit || '100'), 10) || 100);
  let list = [...events].reverse();
  if (facilityId) list = list.filter((e) => e.facilityId === facilityId);
  res.json({ success: true, total: list.length, data: list.slice(0, limit) });
});

/**
 * GET /api/v1/attendance/today?facilityId=
 */
router.get('/today', (req: Request, res: Response) => {
  const facilityId = req.query.facilityId ? String(req.query.facilityId) : null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let list = events.filter((e) => new Date(e.punchedAt) >= start);
  if (facilityId) list = list.filter((e) => e.facilityId === facilityId);
  const ins = list.filter((e) => e.direction === 'IN').length;
  const outs = list.filter((e) => e.direction === 'OUT').length;
  res.json({
    success: true,
    data: {
      facilityId,
      date: start.toISOString().slice(0, 10),
      punches: list.length,
      clockIns: ins,
      clockOuts: outs,
      events: list.slice(-200),
    },
  });
});

/**
 * GET /api/v1/attendance/policy
 */
router.get('/policy', (_req: Request, res: Response) => {
  res.json({
    success: true,
    policy: {
      videoRetention: 'NONE',
      processing: 'LIVE_FEED_ONLY',
      storedFields: ['facilityId', 'staff/badge', 'direction', 'timestamp', 'cameraId', 'confidence'],
      rejectedPayloads: ['video', 'videoBase64', 'recording', 'streamBlob'],
      purpose: 'Staff recognition and time-book (attendance)',
      storageNote: 'Uses Postgres attendance_events within the 5TB AWS envelope — not CCTV archive',
    },
  });
});

export default router;
