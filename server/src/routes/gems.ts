import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';

const router = Router();

export const GEM_COST_PER_READING = 20;
export const GEM_RATING_BONUS = 10;

export const GEM_PACKS = [
  { id: 'pack_10', priceSGD: 10, baseGems: 20, bonusGems: 0, totalGems: 20 },
  { id: 'pack_20', priceSGD: 20, baseGems: 40, bonusGems: 5, totalGems: 45 },
  { id: 'pack_50', priceSGD: 50, baseGems: 100, bonusGems: 20, totalGems: 120, popular: true },
  { id: 'pack_80', priceSGD: 80, baseGems: 160, bonusGems: 40, totalGems: 200 },
];

// Get gem balance and recent transactions
router.get('/balance', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { gemBalance: true, freeReadingUsed: true },
    });

    const transactions = await prisma.gemTransaction.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ gemBalance: user?.gemBalance ?? 0, freeReadingUsed: user?.freeReadingUsed ?? false, transactions });
  } catch (err) {
    console.error('Gem balance error:', err);
    res.status(500).json({ error: 'Failed to fetch gem balance' });
  }
});

// List available gem packs
router.get('/packs', (_req, res: Response) => {
  res.json({ packs: GEM_PACKS });
});

// Request a gem pack purchase (PayNow — manual fulfilment)
// The user signals intent; an admin confirms payment and credits gems via /admin/credit.
router.post('/purchase-request', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { packId } = req.body;
    const pack = GEM_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return res.status(400).json({ error: 'Invalid pack selected' });
    }

    res.json({
      message: 'Purchase request received',
      pack,
      instructions: `Please pay SGD ${pack.priceSGD} via PayNow. Screenshot your payment and send it to the admin for gem credit.`,
    });
  } catch (err) {
    console.error('Purchase request error:', err);
    res.status(500).json({ error: 'Failed to process purchase request' });
  }
});

// Admin: manually credit gems after verifying PayNow payment
router.post('/admin/credit', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    // Must be admin
    const adminUser = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
    if (adminUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { userId, packId, note } = req.body;
    const pack = GEM_PACKS.find((p) => p.id === packId);
    if (!pack || !userId) {
      return res.status(400).json({ error: 'userId and valid packId are required' });
    }

    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { gemBalance: { increment: pack.totalGems } },
        select: { id: true, gemBalance: true },
      }),
      prisma.gemTransaction.create({
        data: {
          userId,
          type: 'purchase',
          amount: pack.totalGems,
          referenceId: note || `paynow_${packId}`,
        },
      }),
    ]);

    res.json({ message: `Credited ${pack.totalGems} gems`, user: updatedUser, transaction });
  } catch (err) {
    console.error('Gem credit error:', err);
    res.status(500).json({ error: 'Failed to credit gems' });
  }
});

export default router;
