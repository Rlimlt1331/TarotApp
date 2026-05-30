import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { generateReading } from '../services/geminiService.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Middleware to verify JWT
const verifyToken = (req: AuthRequest, res: Response, next: Function) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Create a new reading with Gemini-generated interpretation
router.post('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { cards, title } = req.body;
    const userId = req.userId;

    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ error: 'Cards array is required' });
    }

    // Generate interpretation using Gemini
    const interpretation = await generateReading(cards, title);

    const reading = await prisma.reading.create({
      data: {
        userId: userId!,
        title: title || 'Untitled Reading',
        interpretation,
        cards: {
          create: cards.map((card: any) => ({
            name: card.name,
            position: card.position,
            meaning: card.meaning,
          })),
        },
      },
      include: {
        cards: true,
      },
    });

    res.status(201).json(reading);
  } catch (error: any) {
    console.error('Create reading error:', error);
    res.status(500).json({ error: 'Failed to create reading' });
  }
});

// Get all readings for user
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const readings = await prisma.reading.findMany({
      where: { userId: userId! },
      include: { cards: true, feedbacks: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(readings);
  } catch (error: any) {
    console.error('Get readings error:', error);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

// Get single reading
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const reading = await prisma.reading.findUnique({
      where: { id: parseInt(id) },
      include: { cards: true, feedbacks: true },
    });

    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    if (reading.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(reading);
  } catch (error: any) {
    console.error('Get reading error:', error);
    res.status(500).json({ error: 'Failed to fetch reading' });
  }
});

// Update reading
router.put('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, interpretation } = req.body;
    const userId = req.userId;

    const reading = await prisma.reading.findUnique({ where: { id: parseInt(id) } });
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    if (reading.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedReading = await prisma.reading.update({
      where: { id: parseInt(id) },
      data: { title, interpretation },
      include: { cards: true, feedbacks: true },
    });

    res.json(updatedReading);
  } catch (error: any) {
    console.error('Update reading error:', error);
    res.status(500).json({ error: 'Failed to update reading' });
  }
});

// Delete reading
router.delete('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const reading = await prisma.reading.findUnique({ where: { id: parseInt(id) } });
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    if (reading.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.reading.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Reading deleted successfully' });
  } catch (error: any) {
    console.error('Delete reading error:', error);
    res.status(500).json({ error: 'Failed to delete reading' });
  }
});

// Create or update feedback for a reading
router.post('/:id/feedback', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const reading = await prisma.reading.findUnique({ where: { id: parseInt(id) } });
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const feedback = await prisma.feedback.upsert({
      where: {
        readingId_userId: {
          readingId: parseInt(id),
          userId: userId!,
        },
      },
      update: { rating, comment },
      create: {
        readingId: parseInt(id),
        userId: userId!,
        rating,
        comment,
      },
    });

    res.json(feedback);
  } catch (error: any) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Get feedback for a reading
router.get('/:id/feedback', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const feedback = await prisma.feedback.findUnique({
      where: {
        readingId_userId: {
          readingId: parseInt(id),
          userId: userId!,
        },
      },
    });

    res.json(feedback || null);
  } catch (error: any) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Delete feedback
router.delete('/:id/feedback', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const feedback = await prisma.feedback.findUnique({
      where: {
        readingId_userId: {
          readingId: parseInt(id),
          userId: userId!,
        },
      },
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await prisma.feedback.delete({
      where: {
        readingId_userId: {
          readingId: parseInt(id),
          userId: userId!,
        },
      },
    });

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error: any) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Get all submissions (admin only)
router.get('/admin/submissions', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const readings = await prisma.reading.findMany({
      include: {
        cards: true,
        user: {
          select: { id: true, email: true, name: true },
        },
        feedbacks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(readings);
  } catch (error: any) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

export default router;
