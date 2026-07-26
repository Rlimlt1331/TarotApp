import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';
import { sendMessage } from '../services/telegramService.js';

const router = Router();

const LOGIN_TOKEN_TTL_MINUTES = 10;

// ─── Telegram bot webhook (public — called by Telegram servers) ──────────────
router.post('/webhook', async (req: Request, res: Response) => {
  res.json({ ok: true });

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const message = req.body?.message;
    if (!message?.text) return;

    const chatId: number = message.chat.id;
    const text: string = message.text.trim();
    const senderName: string = message.from?.first_name || message.from?.username || 'there';

    if (text.startsWith('/start ')) {
      // ── Deep link: linking an existing portal account to Telegram ──
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
        `✅ <b>Telegram connected!</b>\n\nHi ${user.name || user.email || senderName}! 🔮\n\nYou'll receive reading notifications here. Visit the portal to choose whether you'd like a notification or your full reading delivered directly.`
      );
    } else if (text === '/start') {
      // ── Plain /start: auto-register or send magic login link ──
      const existingUser = await prisma.user.findFirst({
        where: { telegramChatId: String(chatId) },
      });

      const portalUrl = process.env.FRONTEND_URL || '';
      const loginToken = crypto.randomBytes(20).toString('hex');
      const expiry = new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60 * 1000);

      if (existingUser) {
        // User already registered — issue a magic login link
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { telegramLoginToken: loginToken, telegramLoginTokenExpiry: expiry },
        });

        const loginUrl = portalUrl ? `${portalUrl}?tg_login=${loginToken}` : null;
        const lines = [
          `👋 Welcome back, <b>${existingUser.name || senderName}</b>! 🔮`,
          '',
          loginUrl
            ? `Tap the link below to log in (valid for ${LOGIN_TOKEN_TTL_MINUTES} min):\n🔗 <a href="${loginUrl}">Open Portal →</a>`
            : 'Your account is linked. Open the portal and log in.',
        ];
        await sendMessage(chatId, lines.join('\n'));
      } else {
        // New user — create account automatically using Telegram identity
        const newUser = await prisma.user.create({
          data: {
            name: senderName,
            telegramChatId: String(chatId),
            telegramLoginToken: loginToken,
            telegramLoginTokenExpiry: expiry,
          },
        });

        const loginUrl = portalUrl ? `${portalUrl}?tg_login=${loginToken}` : null;
        const lines = [
          `✨ <b>Welcome to Mystic Tarot Portal, ${newUser.name}!</b> 🔮`,
          '',
          'Your account has been created using your Telegram identity.',
          '',
          loginUrl
            ? `Tap the link below to access the portal (valid for ${LOGIN_TOKEN_TTL_MINUTES} min):\n🔗 <a href="${loginUrl}">Open Portal →</a>`
            : 'Open the portal and use the Telegram login option to get started.',
        ];
        await sendMessage(chatId, lines.join('\n'));
      }
    } else {
      await sendMessage(chatId, '👋 Send /start to get a login link for the portal.');
    }
  } catch (err) {
    console.error('Telegram webhook handler error:', err);
  }
});

// ─── Generate a one-time link token (for linking existing account) ───────────
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
