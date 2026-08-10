import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

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

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
    }

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

// ─── Reader management (admin only) ─────────────────────────────────────────

// List all readers
router.get('/admin/readers', verifyAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const readers = await prisma.user.findMany({
      where: { role: 'reader' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: { select: { assignedReadings: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ readers });
  } catch (error: any) {
    console.error('List readers error:', error);
    res.status(500).json({ error: 'Failed to fetch readers' });
  }
});

// Create a reader account
router.post('/admin/readers', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const reader = await prisma.user.create({
      data: { name: name.trim(), email: email.trim().toLowerCase(), password: hashedPassword, role: 'reader' },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    res.status(201).json(reader);
  } catch (error: any) {
    console.error('Create reader error:', error);
    res.status(500).json({ error: 'Failed to create reader' });
  }
});

// Remove a reader (demote to requester — preserves their completed readings)
router.delete('/admin/readers/:id', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const readerId = parseInt(req.params.id);

    const reader = await prisma.user.findUnique({ where: { id: readerId } });
    if (!reader || reader.role !== 'reader') {
      return res.status(404).json({ error: 'Reader not found' });
    }

    // Unassign all their pending submissions so admin can reassign
    await prisma.submission.updateMany({
      where: { assignedReaderId: readerId, reading: null },
      data: { assignedReaderId: null },
    });

    await prisma.user.update({
      where: { id: readerId },
      data: { role: 'requester' },
    });

    res.json({ message: 'Reader removed' });
  } catch (error: any) {
    console.error('Remove reader error:', error);
    res.status(500).json({ error: 'Failed to remove reader' });
  }
});

export default router;
