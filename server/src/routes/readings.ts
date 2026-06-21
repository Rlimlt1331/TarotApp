import { Router, Response } from 'express';
import { GeminiGenerationError, generateAdvancedReading } from '../services/geminiService.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';

// NOTE: The database-backed reading/feedback endpoints that previously lived here
// have moved to ./submissions.ts following the schema restructure (Submission ->
// Reading -> Card). Only the stateless draft-generation endpoint remains, since the
// old handlers referenced fields that no longer exist on the Reading model.
const router = Router();

// Generate advanced reading draft without saving
router.post('/generate-draft', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { image, cards = [], question, horoscope } = req.body;

    if (!question || !horoscope) {
      return res.status(400).json({ error: 'Question and horoscope are required' });
    }

    if (!Array.isArray(cards) && !image) {
      return res.status(400).json({ error: 'Provide selected cards or an uploaded image' });
    }

    const advancedReading = await generateAdvancedReading(image, cards, question, horoscope);
    res.json(advancedReading);
  } catch (error: any) {
    console.error('Generate draft error:', error);
    if (error instanceof GeminiGenerationError) {
      return res.status(error.status).json({
        error: error.message,
        retryDelay: error.retryDelay,
      });
    }
    res.status(500).json({ error: 'Failed to generate reading draft' });
  }
});

export default router;
