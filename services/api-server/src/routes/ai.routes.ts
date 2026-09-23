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

export default router;
