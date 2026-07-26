import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index.js';
import { verifyToken, AuthRequest } from '../middleware/verifyToken.js';
import { sendMessage } from '../services/telegramService.js';

const router = Router();

const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── In-memory store for unauthenticated login requests ──────────────────────
// Maps requestToken → { loginToken (once ready), expiresAt }
// Fine for a single-instance server; survives typical Northflank deployments.
interface LoginRequest { loginToken?: string; expiresAt: number }
const loginRequests = new Map<string, LoginRequest>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginRequests) if (v.expiresAt < now) loginRequests.delete(k);
}, 5 * 60 * 1000);

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

    if (text.startsWith('/start loginreq_')) {
      // ── Unauthenticated login request initiated from the portal ──
      const requestToken = text.slice('/start loginreq_'.length).trim();
      const loginReq = loginRequests.get(requestToken);

      if (!loginReq || loginReq.expiresAt < Date.now()) {
        await sendMessage(chatId, '❌ This login link has expired. Please go back to the portal and try again.');
        return;
      }

      // Find or create user by Telegram chat ID
      let user = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } });
      if (!user) {
        user = await prisma.user.create({
          data: { name: senderName, telegramChatId: String(chatId) },
        });
      }

      // Issue a magic login token
      const loginToken = crypto.randomBytes(20).toString('hex');
      const expiry = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramLoginToken: loginToken, telegramLoginTokenExpiry: expiry },
      });

      // Surface the login token so the portal can poll for it
      loginRequests.set(requestToken, { ...loginReq, loginToken });

      const portalUrl = process.env.FRONTEND_URL || '';
      const loginUrl = portalUrl ? `${portalUrl}?tg_login=${loginToken}` : null;
      const lines = [
        `👋 Hi <b>${user.name || senderName}</b>! 🔮`,
        '',
        '✅ Identity confirmed. You can now log in to the portal.',
        '',
        loginUrl
          ? `🔗 <a href="${loginUrl}">Open Portal →</a> (valid 10 min)\n\nOr switch back to the portal tab and tap <b>I've opened the bot</b>.`
          : 'Switch back to the portal tab and tap <b>I\'ve opened the bot</b>.',
      ];
      await sendMessage(chatId, lines.join('\n'));

    } else if (text.startsWith('/start ')) {
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
      const existingUser = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } });
      const portalUrl = process.env.FRONTEND_URL || '';
      const loginToken = crypto.randomBytes(20).toString('hex');
      const expiry = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { telegramLoginToken: loginToken, telegramLoginTokenExpiry: expiry },
        });
        const loginUrl = portalUrl ? `${portalUrl}?tg_login=${loginToken}` : null;
        await sendMessage(chatId, [
          `👋 Welcome back, <b>${existingUser.name || senderName}</b>! 🔮`,
          '',
          loginUrl
            ? `Tap below to log in (valid 10 min):\n🔗 <a href="${loginUrl}">Open Portal →</a>`
            : 'Your account is linked. Open the portal and log in.',
        ].join('\n'));
      } else {
        const newUser = await prisma.user.create({
          data: { name: senderName, telegramChatId: String(chatId), telegramLoginToken: loginToken, telegramLoginTokenExpiry: expiry },
        });
        const loginUrl = portalUrl ? `${portalUrl}?tg_login=${loginToken}` : null;
        await sendMessage(chatId, [
          `✨ <b>Welcome to Mystic Tarot Portal, ${newUser.name}!</b> 🔮`,
          '',
          'Your account has been created using your Telegram identity.',
          '',
          loginUrl
            ? `Tap below to access the portal (valid 10 min):\n🔗 <a href="${loginUrl}">Open Portal →</a>`
            : 'Open the portal and use the Telegram login option to get started.',
        ].join('\n'));
      }

    } else {
      await sendMessage(chatId, '👋 Send /start to get a login link for the portal.');
    }
  } catch (err) {
    console.error('Telegram webhook handler error:', err);
  }
});

// ─── Public: initialise a login request (no auth required) ───────────────────
// Returns a bot deep link the user opens to prove their Telegram identity.
router.post('/login-init', async (_req: Request, res: Response) => {
  try {
    const requestToken = crypto.randomBytes(20).toString('hex');
    loginRequests.set(requestToken, { expiresAt: Date.now() + LOGIN_TOKEN_TTL_MS });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    const deepLink = botUsername
      ? `https://t.me/${botUsername}?start=loginreq_${requestToken}`
      : null;

    res.json({ requestToken, deepLink });
  } catch (err) {
    console.error('Login init error:', err);
    res.status(500).json({ error: 'Failed to initialize login' });
  }
});

// ─── Public: poll whether the bot has confirmed the login request ─────────────
router.get('/login-status', async (req: Request, res: Response) => {
  const { requestToken } = req.query;
  if (!requestToken || typeof requestToken !== 'string') {
    return res.status(400).json({ error: 'requestToken required' });
  }
  const entry = loginRequests.get(requestToken);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(410).json({ error: 'Login request expired' });
  }
  res.json({ ready: !!entry.loginToken, loginToken: entry.loginToken ?? null });
});

// ─── Generate a one-time link token (for linking existing account) ───────────
router.post('/link-token', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    await prisma.user.update({ where: { id: req.userId! }, data: { telegramLinkToken: token } });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    res.json({ token, deepLink: botUsername ? `https://t.me/${botUsername}?start=${token}` : null });
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
    res.json({ linked: !!user?.telegramChatId, notifyMode: user?.telegramNotifyMode ?? null });
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
    await prisma.user.update({ where: { id: req.userId! }, data: { telegramNotifyMode: notifyMode } });
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
