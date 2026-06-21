import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';

const router = Router();

// Get user profile
router.get('/profile', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        preferences: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user preferences
router.get('/preferences', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.userId! },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId: req.userId! },
      });
    }

    res.json(preferences);
  } catch (error: any) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences
router.put('/preferences', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { theme, language } = req.body;

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.userId! },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId: req.userId!, theme, language },
      });
    } else {
      preferences = await prisma.userPreferences.update({
        where: { userId: req.userId! },
        data: { theme, language },
      });
    }

    res.json(preferences);
  } catch (error: any) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get user reading statistics
router.get('/stats', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const totalReadings = await prisma.submission.count({
      where: { userId: req.userId! },
    });

    const recentReadings = await prisma.submission.findMany({
      where: { userId: req.userId! },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, question: true, createdAt: true },
    });

    res.json({
      totalReadings,
      recentReadings,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
