import { Router, Request, Response } from 'express';
import { selfLearningAI } from '../ai/selfLearningEngine';

const router = Router();

/**
 * POST /api/v1/ai/chat
 * Executive query and reasoning endpoint
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { query, history } = req.body;

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  try {
    const response = await selfLearningAI.processQuery(query, history || []);
    res.json({
      success: true,
      data: response,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/ai/execute-action
 * Executes an autonomous administrative action proposed by the AI
 */
router.post('/execute-action', (req: Request, res: Response) => {
  const { action } = req.body;

  if (!action || !action.actionId || !action.type) {
    return res.status(400).json({ success: false, error: 'Valid action payload is required' });
  }

  try {
    const result = selfLearningAI.executeAction(action);
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/ai/feedback
 * Records user feedback (positive, negative, or correction) to refine self-learning memory
 */
router.post('/feedback', (req: Request, res: Response) => {
  const { interactionId, query, response, actionProposed, userRating, userCorrectionText } = req.body;

  if (!query || !userRating) {
    return res.status(400).json({ success: false, error: 'query and userRating are required' });
  }

  try {
    const result = selfLearningAI.recordFeedback({
      interactionId: interactionId || `INT-${Date.now()}`,
      query,
      response: response || '',
      actionProposed,
      userRating,
      userCorrectionText,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Feedback assimilated into self-learning memory engine.',
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/ai/learning-stats
 * Retrieves active heuristics, accuracy, and automation telemetry
 */
router.get('/learning-stats', (req: Request, res: Response) => {
  const stats = selfLearningAI.getLearningStats();
  res.json({
    success: true,
    data: stats,
  });
});


/**
 * POST /api/v1/ai/soap-assist
 * Phase 4 — Ambient / structured SOAP draft (HITL — never auto-commits to chart)
 */
router.post('/soap-assist', (req: Request, res: Response) => {
  const { transcript, patientName, chiefComplaint, vitalsSummary } = req.body || {};
  const text = String(transcript || chiefComplaint || '').trim();
  if (!text) {
    return res.status(400).json({ success: false, error: 'transcript or chiefComplaint required' });
  }

  const soap = {
    subjective: text.slice(0, 500),
    objective: vitalsSummary || 'Vitals not provided — record at bedside before signing.',
    assessment: `Provisional assessment pending clinician review${patientName ? ` for ${patientName}` : ''}.`,
    plan: [
      'Confirm history and examination findings',
      'Order indicated labs / imaging',
      'Review allergies and current medications',
      'Safety-net advice and follow-up',
    ],
    warnings: [
      'M87 draft only — must be reviewed and signed by licensed clinician',
      'Not a diagnosis; does not replace clinical judgment',
    ],
    model: 'm87-soap-assist-v1',
    hitlRequired: true,
    generatedAt: new Date().toISOString(),
  };

  res.json({ success: true, data: soap, requiresApproval: true });
});

/**
 * POST /api/v1/ai/propose-clinical-action
 * Proposes action; execution only after explicit approve endpoint
 */
router.post('/propose-clinical-action', (req: Request, res: Response) => {
  const { type, patientId, summary, severity } = req.body || {};
  if (!type || !summary) {
    return res.status(400).json({ success: false, error: 'type and summary required' });
  }
  const proposal = {
    proposalId: `PROP-${Date.now()}`,
    type,
    patientId,
    summary,
    severity: severity || 'ROUTINE',
    status: 'AWAITING_HUMAN_APPROVAL',
    createdAt: new Date().toISOString(),
  };
  res.status(201).json({ success: true, data: proposal, hitl: true });
});

/**
 * POST /api/v1/ai/approve-action
 * Human-in-the-loop gate for AI-proposed operational/clinical actions
 */
router.post('/approve-action', (req: Request, res: Response) => {
  const { proposalId, approvedBy, decision, note } = req.body || {};
  if (!proposalId || !approvedBy || !decision) {
    return res.status(400).json({ success: false, error: 'proposalId, approvedBy, decision required' });
  }
  if (!['APPROVE', 'REJECT'].includes(String(decision).toUpperCase())) {
    return res.status(400).json({ success: false, error: 'decision must be APPROVE or REJECT' });
  }
  res.json({
    success: true,
    data: {
      proposalId,
      decision: String(decision).toUpperCase(),
      approvedBy,
      note,
      decidedAt: new Date().toISOString(),
      message:
        String(decision).toUpperCase() === 'APPROVE'
          ? 'Action authorized by human clinician/administrator'
          : 'Action dismissed — no automatic execution',
    },
  });
});

export default router;

