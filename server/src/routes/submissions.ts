import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { GeminiGenerationError, generateAdvancedReading, generateReadingAnalysis } from '../services/geminiService.js';
import { notifyReaderNewSubmission, notifyRequesterReadingReady } from '../services/telegramService.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';
import { GEM_COST_PER_READING, GEM_RATING_BONUS } from './gems.js';

const router = Router();

// Create a new submission (requester portal)
router.post('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { question, category, horoscope, gender, country, occupation, additionalNotes } = req.body;
    const userId = req.userId!;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gemBalance: true, freeReadingUsed: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isFreeReading = !user.freeReadingUsed;
    const hasEnoughGems = user.gemBalance >= GEM_COST_PER_READING;

    if (!isFreeReading && !hasEnoughGems) {
      return res.status(402).json({
        error: 'Insufficient Tarot Gems',
        gemBalance: user.gemBalance,
        required: GEM_COST_PER_READING,
      });
    }

    // Deduct gems or mark free reading used — atomically with submission creation
    const [submission] = await prisma.$transaction(async (tx) => {
      if (isFreeReading) {
        await tx.user.update({
          where: { id: userId },
          data: { freeReadingUsed: true },
        });
        await tx.gemTransaction.create({
          data: { userId, type: 'free_reading', amount: 0 },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { gemBalance: { decrement: GEM_COST_PER_READING } },
        });
        await tx.gemTransaction.create({
          data: { userId, type: 'reading_spend', amount: -GEM_COST_PER_READING },
        });
      }

      const sub = await tx.submission.create({
        data: {
          userId,
          question,
          category: category || null,
          horoscope: horoscope || null,
          gender: gender || null,
          country: country || null,
          occupation: occupation || null,
          additionalNotes: additionalNotes || null,
          isFreeReading,
        },
        include: {
          reading: { include: { detectedCards: true } },
          user: { select: { id: true, email: true, name: true } },
          feedbacks: true,
        },
      });
      return [sub];
    });

    notifyReaderNewSubmission({
      id: submission.id,
      question: submission.question,
      category: submission.category,
      horoscope: submission.horoscope,
      user: { name: submission.user.name, email: submission.user.email },
    }).catch((err) => console.error('Telegram reader alert failed:', err));

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

// Detect cards from image only — admin only
router.post('/admin/:id/detect-cards', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { spreadImage } = req.body;

    if (!spreadImage) {
      return res.status(400).json({ error: 'spreadImage is required' });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: parseInt(id) },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const analysis = await generateReadingAnalysis([], submission.question || '', spreadImage);

    res.json({
      detectedCards: analysis.detectedCards.map((c) => ({
        name: c.name,
        orientation: c.orientation || 'upright',
        position: c.position,
        confidence: c.confidence,
      })),
    });
  } catch (error: any) {
    console.error('Detect cards error:', error);
    if (error instanceof GeminiGenerationError) {
      return res.status(error.status).json({ error: error.message, retryDelay: error.retryDelay });
    }
    res.status(500).json({ error: 'Failed to detect cards' });
  }
});

// Generate reading preview without saving — admin only
// Accepts either:
//   confirmedCards: [{name, orientation}]  — pre-confirmed cards (skips vision re-detection)
//   spreadImage + cards                    — legacy: image-based detection or manual card names
router.post('/admin/:id/generate', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { spreadImage, image, cards = [], confirmedCards } = req.body;

    const submission = await prisma.submission.findUnique({
      where: { id: parseInt(id) },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const horoscope = submission.horoscope || '';
    const question = submission.question || '';

    // If caller passed pre-confirmed cards with orientation, use them and skip vision.
    const hasConfirmed = Array.isArray(confirmedCards) && confirmedCards.length > 0;
    const manualCards = hasConfirmed
      ? confirmedCards
      : Array.isArray(cards) && cards.length > 0
        ? cards.map((c: any) => (typeof c === 'string' ? c : c.name))
        : [];

    const generated = await generateAdvancedReading(
      hasConfirmed ? undefined : (spreadImage || image),
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
    const { astrologyReading, tarotReading, harmonisedReading, detectedCards: detectedCardObjects } = req.body;

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

      if (Array.isArray(detectedCardObjects) && detectedCardObjects.length > 0) {
        await prisma.card.deleteMany({ where: { readingId: submission.reading.id } });
        await prisma.card.createMany({
          data: detectedCardObjects.map((card: { name: string; orientation?: string }, index: number) => ({
            readingId: submission.reading!.id,
            name: card.name,
            position: `Card ${index + 1}`,
            orientation: card.orientation || null,
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

      if (Array.isArray(detectedCardObjects) && detectedCardObjects.length > 0) {
        await prisma.card.createMany({
          data: detectedCardObjects.map((card: { name: string; orientation?: string }, index: number) => ({
            readingId: newReading.id,
            name: card.name,
            position: `Card ${index + 1}`,
            orientation: card.orientation || null,
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

    // Fire-and-forget: notify the requester via Telegram if they've linked their account.
    if (finalSubmission) {
      prisma.user.findUnique({
        where: { id: finalSubmission.userId },
        select: { telegramChatId: true, telegramNotifyMode: true },
      }).then((requester) => {
        if (requester?.telegramChatId && requester?.telegramNotifyMode) {
          notifyRequesterReadingReady(
            requester.telegramChatId,
            finalSubmission.question,
            requester.telegramNotifyMode as 'notify' | 'deliver',
            finalSubmission.reading?.harmonisedReading
          ).catch((err) => console.error('Telegram requester notification failed:', err));
        }
      }).catch((err) => console.error('Telegram requester lookup failed:', err));
    }

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
    const userId = req.userId!;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const submission = await prisma.submission.findUnique({ where: { id: parseInt(id) } });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const existing = await prisma.feedback.findUnique({
      where: { submissionId_userId: { submissionId: parseInt(id), userId } },
    });

    let gemBonusAwarded = false;

    const feedback = await prisma.$transaction(async (tx) => {
      const saved = await tx.feedback.upsert({
        where: { submissionId_userId: { submissionId: parseInt(id), userId } },
        update: { rating, comment },
        create: { submissionId: parseInt(id), userId, rating, comment },
      });

      // Award bonus once per reading if rating >= 4 and not yet claimed
      const eligibleForBonus = rating >= 4 && !existing?.ratingBonusClaimed && !saved.ratingBonusClaimed;
      if (eligibleForBonus) {
        await tx.feedback.update({
          where: { id: saved.id },
          data: { ratingBonusClaimed: true },
        });
        await tx.user.update({
          where: { id: userId },
          data: { gemBalance: { increment: GEM_RATING_BONUS } },
        });
        await tx.gemTransaction.create({
          data: {
            userId,
            type: 'rating_bonus',
            amount: GEM_RATING_BONUS,
            referenceId: String(id),
          },
        });
        gemBonusAwarded = true;
      }

      return tx.feedback.findUnique({ where: { id: saved.id } });
    });

    res.json({ feedback, gemBonusAwarded, bonusAmount: gemBonusAwarded ? GEM_RATING_BONUS : 0 });
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
