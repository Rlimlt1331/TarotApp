import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { notifyReaderNewSubmission } from '../services/telegramService.js';

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

    const pendingTx = transactions.find((t) => t.type === 'pending_purchase');
    const hasPendingPurchase = !!pendingTx;
    const pendingPack = pendingTx ? GEM_PACKS.find((p) => p.id === pendingTx.referenceId) ?? null : null;

    res.json({
      gemBalance: user?.gemBalance ?? 0,
      freeReadingUsed: user?.freeReadingUsed ?? false,
      hasPendingPurchase,
      pendingPurchaseSGD: pendingPack?.priceSGD ?? null,
      transactions,
    });
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
// Records a pending_purchase transaction; admin fulfils via /admin/credit.
router.post('/purchase-request', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { packId } = req.body;
    const pack = GEM_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return res.status(400).json({ error: 'Invalid pack selected' });
    }

    // One pending_purchase per user at any time — always replace.
    // The frontend warns the user if they had previously clicked "Done — I've paid"
    // before changing their selection, but ultimately allows the overwrite since
    // there is no real-time PayNow integration to confirm payment.
    await prisma.gemTransaction.deleteMany({
      where: { userId: req.userId!, type: 'pending_purchase' },
    });

    const pendingTx = await prisma.gemTransaction.create({
      data: {
        userId: req.userId!,
        type: 'pending_purchase',
        amount: pack.totalGems,
        referenceId: packId,
      },
    });

    res.json({
      message: 'Purchase request received',
      pendingId: pendingTx.id,
      pack,
      instructions: `Please pay SGD ${pack.priceSGD} via PayNow. Screenshot your payment and send it to the admin for gem credit.`,
    });
  } catch (err) {
    console.error('Purchase request error:', err);
    res.status(500).json({ error: 'Failed to process purchase request' });
  }
});

// Admin: list all pending payment items
// Includes: (1) users who chose a gem pack (pending_purchase tx), and
// (2) users whose submission is queued with pendingPayment=true but haven't picked a pack yet.
router.get('/admin/pending', verifyAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Users who have explicitly initiated a purchase request
    const purchaseTxs = await prisma.gemTransaction.findMany({
      where: { type: 'pending_purchase' },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const usersWithRequest = new Set(purchaseTxs.map((t) => t.userId));

    // All pending-payment submission counts per user
    const pendingSubGroups = await prisma.submission.groupBy({
      by: ['userId'],
      where: { pendingPayment: true },
      _count: { id: true },
    });
    const pendingSubMap = Object.fromEntries(pendingSubGroups.map((r) => [r.userId, r._count.id]));

    // Users with queued submissions who haven't selected a pack yet — show so admin knows to chase payment
    const noPackUserIds = pendingSubGroups
      .map((r) => r.userId)
      .filter((uid) => !usersWithRequest.has(uid));

    const noPackUsers = noPackUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: noPackUserIds } },
          select: { id: true, email: true, name: true },
        })
      : [];

    const purchaseItems = purchaseTxs.map((t) => ({
      id: t.id as number | null,
      userId: t.userId,
      userName: t.user.name,
      userEmail: t.user.email,
      packId: t.referenceId as string | null,
      gems: t.amount,
      pack: GEM_PACKS.find((p) => p.id === t.referenceId) ?? null,
      requestedAt: t.createdAt as Date | null,
      pendingSubmissions: pendingSubMap[t.userId] ?? 0,
      hasPurchaseRequest: true,
    }));

    const noPackItems = noPackUsers.map((u) => ({
      id: null as number | null,
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      packId: null as string | null,
      gems: 0,
      pack: null,
      requestedAt: null as Date | null,
      pendingSubmissions: pendingSubMap[u.id] ?? 0,
      hasPurchaseRequest: false,
    }));

    res.json({ pending: [...purchaseItems, ...noPackItems] });
  } catch (err) {
    console.error('Pending purchases error:', err);
    res.status(500).json({ error: 'Failed to fetch pending purchases' });
  }
});

// Admin: credit gems after verifying PayNow payment
// pendingId: optional — if provided, deletes the pending_purchase record
router.post('/admin/credit', verifyAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, packId, pendingId, note } = req.body;
    const pack = GEM_PACKS.find((p) => p.id === packId);
    if (!pack || !userId) {
      return res.status(400).json({ error: 'userId and valid packId are required' });
    }

    // Find any pending-payment submissions for this user so we can activate them
    const pendingSubmissions = await prisma.submission.findMany({
      where: { userId, pendingPayment: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const gemCostForPending = pendingSubmissions.length * GEM_COST_PER_READING;
    const netGems = pack.totalGems - gemCostForPending;

    const [updatedUser] = await prisma.$transaction(async (tx) => {
      // Credit the full pack amount first
      const user = await tx.user.update({
        where: { id: userId },
        data: { gemBalance: { increment: pack.totalGems } },
        select: { id: true, gemBalance: true },
      });
      // Record the purchase
      await tx.gemTransaction.create({
        data: { userId, type: 'purchase', amount: pack.totalGems, referenceId: note || `paynow_${packId}` },
      });
      // Activate pending-payment submissions: deduct gems + clear flag
      for (const sub of pendingSubmissions) {
        await tx.submission.update({ where: { id: sub.id }, data: { pendingPayment: false } });
        await tx.gemTransaction.create({ data: { userId, type: 'reading_spend', amount: -GEM_COST_PER_READING } });
        await tx.user.update({ where: { id: userId }, data: { gemBalance: { decrement: GEM_COST_PER_READING } } });
      }
      return [user];
    });

    // Remove the pending_purchase record now that it's been fulfilled
    if (pendingId) {
      await prisma.gemTransaction.delete({ where: { id: pendingId } }).catch(() => {});
    }

    // Notify reader about newly activated submissions
    for (const sub of pendingSubmissions) {
      notifyReaderNewSubmission({
        id: sub.id,
        question: sub.question,
        category: sub.category,
        horoscope: sub.horoscope,
        user: { name: sub.user.name, email: sub.user.email },
      }).catch((err) => console.error('Telegram reader alert (on gem credit) failed:', err));
    }

    const activatedCount = pendingSubmissions.length;
    res.json({
      message: `Credited ${pack.totalGems} gems${activatedCount ? `, activated ${activatedCount} pending reading${activatedCount > 1 ? 's' : ''}` : ''}`,
      netGemsAdded: netGems,
      activatedSubmissions: activatedCount,
      user: updatedUser,
    });
  } catch (err) {
    console.error('Gem credit error:', err);
    res.status(500).json({ error: 'Failed to credit gems' });
  }
});

export default router;
