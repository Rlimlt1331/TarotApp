import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

interface AuthRequest extends Request {
  userId?: number;
}

function signToken(userId: number, email: string | null): string {
  return jwt.sign({ userId, email: email ?? '' }, JWT_SECRET, { expiresIn: '7d' });
}

// Signup
router.post('/signup', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const token = signToken(user.id, user.email);

    res.status(201).json({
      user,
      token,
      message: 'Account created successfully',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Use a constant-time comparison path regardless of whether user exists,
    // to prevent user enumeration via response timing.
    const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    const passwordToCheck = user?.password ?? DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordToCheck);

    if (!user || !isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.password) {
      // Telegram-only account — still return a generic auth error to avoid enumeration
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user.id, user.email);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
      message: 'Login successful',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Telegram magic-link login — exchanges a short-lived token for a JWT
router.post('/telegram-login', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const user = await prisma.user.findUnique({ where: { telegramLoginToken: token } });

    if (!user || !user.telegramLoginTokenExpiry || user.telegramLoginTokenExpiry < new Date()) {
      return res.status(401).json({ error: 'Login link has expired or is invalid. Send /start to the bot to get a new one.' });
    }

    // Consume the token immediately (one-time use)
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramLoginToken: null, telegramLoginTokenExpiry: null },
    });

    const jwtToken = signToken(user.id, user.email);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: jwtToken,
      message: 'Logged in via Telegram',
    });
  } catch (error: any) {
    console.error('Telegram login error:', error);
    res.status(500).json({ error: 'Telegram login failed' });
  }
});

// Verify token
router.get('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ user, valid: true });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
