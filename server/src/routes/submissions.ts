import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { GeminiGenerationError, generateAdvancedReading } from '../services/geminiService.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';

const router = Router();

// Create a new submission (requester portal)
router.post('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { question, category, horoscope, gender, country, occupation, additionalNotes } = req.body;
    const userId = req.userId;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const submission = await prisma.submission.create({
      data: {
        userId: userId!,
        question,
        category: category || null,
        horoscope: horoscope || null,
        gender: gender || null,
        country: country || null,
        occupation: occupation || null,
        additionalNotes: additionalNotes || null,
      },
      include: {
        reading: { include: { detectedCards: true } },
        user: { select: { id: true, email: true, name: true } },
        feedbacks: true,
      },
    });

    res.status(201).json(submission);
  } catch (error: any) {
    console.error('Create submission error:', error);
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

// Get all submissions for the authenticated user
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const submissions = await prisma.submission.findMany({
      where: { userId: userId! },
      include: {
        reading: { include: { detectedCards: true } },
        feedbacks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(submissions);
  } catch (error: any) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Get all submissions — admin only
router.get('/admin/all', verifyAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        reading: { include: { detectedCards: true } },
        user: { select: { id: true, email: true, name: true } },
        feedbacks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(submissions);
  } catch (error: any) {
    console.error('Get all submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Generate reading preview without saving — admin only
router.post('/admin/:id/generate', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { spreadImage, image, cards = [] } = req.body;

    const submission = await prisma.submission.findUnique({
      where: { id: parseInt(id) },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const horoscope = submission.horoscope || '';
    const question = submission.question || '';
    const manualCards = Array.isArray(cards) && cards.length > 0
      ? cards.map((c: any) => (typeof c === 'string' ? c : c.name))
      : [];

    const generated = await generateAdvancedReading(
      spreadImage || image,
      manualCards,
      question,
      horoscope
    );

    res.json(generated);
  } catch (error: any) {
    console.error('Generate preview error:', error);
    if (error instanceof GeminiGenerationError) {
      return res.status(error.status).json({ error: error.message, retryDelay: error.retryDelay });
    }
    res.status(500).json({ error: 'Failed to generate reading preview' });
  }
});

// Submit completed reading — admin only
router.put('/admin/:id', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { astrologyReading, tarotReading, harmonisedReading, detectedCardNames } = req.body;

    const submission = await prisma.submission.findUnique({
      where: { id: parseInt(id) },
      include: { reading: true },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.reading) {
      // Update existing reading
      await prisma.reading.update({
        where: { id: submission.reading.id },
        data: {
          astrologyReading: astrologyReading || null,
          tarotReading: tarotReading || null,
          harmonisedReading: harmonisedReading || null,
        },
      });

      if (Array.isArray(detectedCardNames) && detectedCardNames.length > 0) {
        await prisma.card.deleteMany({ where: { readingId: submission.reading.id } });
        await prisma.card.createMany({
          data: detectedCardNames.map((name: string, index: number) => ({
            readingId: submission.reading!.id,
            name,
            position: `Card ${index + 1}`,
          })),
        });
      }
    } else {
      // Create new reading
      const newReading = await prisma.reading.create({
        data: {
          submissionId: parseInt(id),
          astrologyReading: astrologyReading || null,
          tarotReading: tarotReading || null,
          harmonisedReading: harmonisedReading || null,
        },
      });

      if (Array.isArray(detectedCardNames) && detectedCardNames.length > 0) {
        await prisma.card.createMany({
          data: detectedCardNames.map((name: string, index: number) => ({
            readingId: newReading.id,
            name,
            position: `Card ${index + 1}`,
          })),
        });
      }
    }

    const finalSubmission = await prisma.submission.findUnique({
      where: { id: parseInt(id) },
      include: {
        reading: { include: { detectedCards: true } },
        user: { select: { id: true, email: true, name: true } },
        feedbacks: true,
      },
    });

    res.json(finalSubmission);
  } catch (error: any) {
    console.error('Submit reading error:', error);
    res.status(500).json({ error: 'Failed to submit reading' });
  }
});

// Get a single submission
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const submission = await prisma.submission.findUnique({
      where: { id: parseInt(id) },
      include: {
        reading: { include: { detectedCards: true } },
        feedbacks: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(submission);
  } catch (error: any) {
    console.error('Get submission error:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// Create or update feedback for a submission
router.post('/:id/feedback', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const submission = await prisma.submission.findUnique({ where: { id: parseInt(id) } });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const feedback = await prisma.feedback.upsert({
      where: { submissionId_userId: { submissionId: parseInt(id), userId: userId! } },
      update: { rating, comment },
      create: { submissionId: parseInt(id), userId: userId!, rating, comment },
    });

    res.json(feedback);
  } catch (error: any) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Get feedback for a submission
router.get('/:id/feedback', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const feedback = await prisma.feedback.findUnique({
      where: { submissionId_userId: { submissionId: parseInt(id), userId: userId! } },
    });

    res.json(feedback || null);
  } catch (error: any) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Delete feedback for a submission
router.delete('/:id/feedback', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const feedback = await prisma.feedback.findUnique({
      where: { submissionId_userId: { submissionId: parseInt(id), userId: userId! } },
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await prisma.feedback.delete({
      where: { submissionId_userId: { submissionId: parseInt(id), userId: userId! } },
    });

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error: any) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
