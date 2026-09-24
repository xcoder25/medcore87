import { Router, Request, Response } from 'express';
import { syncEventBus } from '../sync/eventBus';

const router = Router();

// ─── In-Memory Theatre Store ─────────────────────────────────────────────────

export interface TheatreCase {
  id: string;
  patientId: string;
  patientName: string;
  facilityId: string;
  surgeonId: string;
  surgeonName: string;
  anaesthesiologistId?: string;
  anaesthesiologistName?: string;
  procedure: string;
  theatreRoom: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'SCHEDULED' | 'PREP' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
  priority: 'ELECTIVE' | 'URGENT' | 'EMERGENCY';
  notes?: string;
  whoChecklistSigned?: boolean;
  actualStart?: string;
  actualEnd?: string;
  createdAt: string;
}

const theatreCases: Map<string, TheatreCase> = new Map();

// Seed a demo case
const seedCase: TheatreCase = {
  id: 'OT-2026-001',
  patientId: 'PAT-849201',
  patientName: 'Amina Bello',
  facilityId: 'FAC-001',
  surgeonId: 'DOC-102',
  surgeonName: 'Dr. Kelechi Nwachukwu (General Surgeon)',
  anaesthesiologistName: 'Dr. Blessing Oduya',
  procedure: 'Laparoscopic Cholecystectomy',
  theatreRoom: 'Theatre 2',
  scheduledStart: new Date(Date.now() + 3600000 * 2).toISOString(),
  scheduledEnd:   new Date(Date.now() + 3600000 * 4).toISOString(),
  status: 'SCHEDULED',
  priority: 'ELECTIVE',
  whoChecklistSigned: false,
  createdAt: new Date().toISOString(),
};
theatreCases.set(seedCase.id, seedCase);

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/theatre
 * Get all theatre cases — optionally filter by date or status
 */
router.get('/', (req: Request, res: Response) => {
  const { facilityId, status, date } = req.query;
  let cases = Array.from(theatreCases.values());

  if (facilityId) cases = cases.filter(c => c.facilityId === facilityId);
  if (status)     cases = cases.filter(c => c.status === status);
  if (date) {
    const d = String(date);
    cases = cases.filter(c => c.scheduledStart.startsWith(d));
  }

  // Sort by scheduled start time
  cases.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  res.json({ success: true, total: cases.length, data: cases });
});

/**
 * POST /api/v1/theatre
 * Book a new theatre case
 */
router.post('/', (req: Request, res: Response) => {
  const {
    patientId, patientName, facilityId, surgeonId, surgeonName,
    anaesthesiologistId, anaesthesiologistName, procedure,
    theatreRoom, scheduledStart, scheduledEnd, priority, notes,
  } = req.body;

  if (!patientId || !procedure || !scheduledStart || !surgeonName) {
    return res.status(400).json({ success: false, error: 'patientId, procedure, scheduledStart, surgeonName required' });
  }

  const id = `OT-${new Date().getFullYear()}-${String(theatreCases.size + 1).padStart(3, '0')}`;

  const newCase: TheatreCase = {
    id,
    patientId,
    patientName: patientName || 'Unknown',
    facilityId: facilityId || 'FAC-001',
    surgeonId: surgeonId || 'DOC-DEFAULT',
    surgeonName,
    anaesthesiologistId,
    anaesthesiologistName,
    procedure,
    theatreRoom: theatreRoom || 'Theatre 1',
    scheduledStart,
    scheduledEnd: scheduledEnd || new Date(new Date(scheduledStart).getTime() + 7200000).toISOString(),
    status: 'SCHEDULED',
    priority: priority || 'ELECTIVE',
    notes,
    whoChecklistSigned: false,
    createdAt: new Date().toISOString(),
  };

  theatreCases.set(id, newCase);

  syncEventBus.broadcast({
    topic: 'THEATRE_BOOKED',
    facilityId: newCase.facilityId,
    emitterApp: 'API_SERVER',
    payload: {
      caseId: id,
      patientName: newCase.patientName,
      procedure: newCase.procedure,
      surgeonName: newCase.surgeonName,
      theatreRoom: newCase.theatreRoom,
      scheduledStart: newCase.scheduledStart,
      priority: newCase.priority,
    },
  });

  res.status(201).json({ success: true, message: `Theatre case booked: ${procedure}`, data: newCase });
});

/**
 * PATCH /api/v1/theatre/:id/status
 * Update theatre case status — broadcasts schedule change or case events
 */
router.patch('/:id/status', (req: Request, res: Response) => {
  const theatreCase = theatreCases.get(String(req.params.id));
  if (!theatreCase) return res.status(404).json({ success: false, error: 'Theatre case not found' });

  const { status, notes } = req.body;
  if (!status) return res.status(400).json({ success: false, error: 'status is required' });

  const prevStatus = theatreCase.status;
  theatreCase.status = status;
  if (notes) theatreCase.notes = notes;
  if (status === 'IN_PROGRESS') theatreCase.actualStart = new Date().toISOString();
  if (status === 'COMPLETED')   theatreCase.actualEnd   = new Date().toISOString();

  const topic = status === 'IN_PROGRESS' ? 'THEATRE_CASE_STARTED'
    : status === 'COMPLETED'             ? 'THEATRE_CASE_COMPLETED'
    : 'THEATRE_SCHEDULE_CHANGE';

  syncEventBus.broadcast({
    topic,
    facilityId: theatreCase.facilityId,
    emitterApp: 'API_SERVER',
    payload: {
      caseId: theatreCase.id,
      patientName: theatreCase.patientName,
      procedure: theatreCase.procedure,
      surgeonName: theatreCase.surgeonName,
      prevStatus,
      newStatus: status,
      theatreRoom: theatreCase.theatreRoom,
      timestamp: new Date().toISOString(),
    },
  });

  res.json({ success: true, message: `Theatre case ${req.params.id} → ${status}`, data: theatreCase });
});

/**
 * PATCH /api/v1/theatre/:id/who-checklist
 * Mark WHO Surgical Safety Checklist as signed
 */
router.patch('/:id/who-checklist', (req: Request, res: Response) => {
  const theatreCase = theatreCases.get(String(req.params.id));
  if (!theatreCase) return res.status(404).json({ success: false, error: 'Theatre case not found' });

  theatreCase.whoChecklistSigned = true;

  res.json({ success: true, message: 'WHO Surgical Safety Checklist signed', data: theatreCase });
});

/**
 * GET /api/v1/theatre/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const theatreCase = theatreCases.get(String(req.params.id));
  if (!theatreCase) return res.status(404).json({ success: false, error: 'Theatre case not found' });
  res.json({ success: true, data: theatreCase });
});

export default router;
