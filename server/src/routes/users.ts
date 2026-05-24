import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

interface AuthRequest extends Request {
  userId?: number;
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
    const totalReadings = await prisma.reading.count({
      where: { userId: req.userId! },
    });

    const recentReadings = await prisma.reading.findMany({
      where: { userId: req.userId! },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true },
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
