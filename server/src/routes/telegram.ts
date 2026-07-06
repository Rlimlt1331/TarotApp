import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';
import { sendMessage } from '../services/telegramService.js';

const router = Router();

// ─── Telegram bot webhook (public — called by Telegram servers) ──────────────
// Register this URL with Telegram via:
//   POST https://api.telegram.org/bot{TOKEN}/setWebhook
//   Body: { "url": "https://your-server/api/telegram/webhook" }
router.post('/webhook', async (req: Request, res: Response) => {
  // Always return 200 immediately so Telegram doesn't retry.
  res.json({ ok: true });

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const message = req.body?.message;
    if (!message?.text) return;

    const chatId: number = message.chat.id;
    const text: string = message.text.trim();

    if (text.startsWith('/start ')) {
      const linkToken = text.slice(7).trim();
      const user = await prisma.user.findUnique({ where: { telegramLinkToken: linkToken } });

      if (!user) {
        await sendMessage(chatId, '❌ This link has expired or is invalid. Please generate a new one from the portal.');
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: String(chatId), telegramLinkToken: null },
      });

      await sendMessage(
        chatId,
        `✅ <b>Telegram connected!</b>\n\nHi ${user.name || user.email}! 🔮\n\nYou'll receive reading notifications here. Visit the portal to choose whether you'd like a notification or your full reading delivered directly.`
      );
    } else if (text === '/start') {
      await sendMessage(
        chatId,
        '🔮 <b>Mystic Tarot Portal</b>\n\nTo link your account, click the <b>Link Telegram</b> button in the portal and follow the instructions there.'
      );
    } else {
      await sendMessage(chatId, '👋 Use the portal to request and manage your tarot readings.');
    }
  } catch (err) {
    console.error('Telegram webhook handler error:', err);
  }
});

// ─── Generate a one-time link token ─────────────────────────────────────────
router.post('/link-token', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');

    await prisma.user.update({
      where: { id: req.userId! },
      data: { telegramLinkToken: token },
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    res.json({
      token,
      deepLink: botUsername ? `https://t.me/${botUsername}?start=${token}` : null,
    });
  } catch (err) {
    console.error('Link token error:', err);
    res.status(500).json({ error: 'Failed to generate link token' });
  }
});

// ─── Get current Telegram status ─────────────────────────────────────────────
router.get('/status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { telegramChatId: true, telegramNotifyMode: true },
    });
    res.json({
      linked: !!user?.telegramChatId,
      notifyMode: user?.telegramNotifyMode ?? null,
    });
  } catch (err) {
    console.error('Telegram status error:', err);
    res.status(500).json({ error: 'Failed to fetch Telegram status' });
  }
});

// ─── Update notification preference ──────────────────────────────────────────
router.put('/preferences', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { notifyMode } = req.body;
    if (!['notify', 'deliver'].includes(notifyMode)) {
      return res.status(400).json({ error: 'notifyMode must be "notify" or "deliver"' });
    }

    await prisma.user.update({
      where: { id: req.userId! },
      data: { telegramNotifyMode: notifyMode },
    });
    res.json({ notifyMode });
  } catch (err) {
    console.error('Telegram preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ─── Unlink Telegram ──────────────────────────────────────────────────────────
router.delete('/unlink', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { telegramChatId: null, telegramNotifyMode: null, telegramLinkToken: null },
    });
    res.json({ message: 'Telegram unlinked successfully' });
  } catch (err) {
    console.error('Telegram unlink error:', err);
    res.status(500).json({ error: 'Failed to unlink Telegram' });
  }
});

export default router;
