import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { usePendingSubmission } from '../context/PendingSubmissionContext';
import { toast } from 'sonner';
import { Send, ExternalLink, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../config/api';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TgLoginStep = 'idle' | 'pending' | 'checking';

export const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const [tgStep, setTgStep] = useState<TgLoginStep>('idle');
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgRequestToken, setTgRequestToken] = useState<string | null>(null);
  const [tgChecking, setTgChecking] = useState(false);

  const { login, signup, loginWithTelegramToken } = useAuth();
  const { pendingSubmission } = usePendingSubmission();

  const resetTg = () => { setTgStep('idle'); setTgDeepLink(null); setTgRequestToken(null); };

  const handleClose = (o: boolean) => { if (!o) resetTg(); onOpenChange(o); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Logged in successfully!');
      } else {
        await signup(email, password, name);
        toast.success('Account created successfully!');
      }
      if (pendingSubmission) toast.success('Your reading request is ready to be submitted!');
      onOpenChange(false);
      setEmail(''); setPassword(''); setName('');
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramInit = async () => {
    try {
      const res = await fetch(`${API_URL}/telegram/login-init`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTgDeepLink(data.deepLink ?? null);
      setTgRequestToken(data.requestToken);
      setTgStep('pending');
    } catch {
      toast.error('Could not start Telegram login. Please try again.');
    }
  };

  const handleTelegramVerify = async () => {
    if (!tgRequestToken) return;
    setTgChecking(true);
    try {
      const res = await fetch(`${API_URL}/telegram/login-status?requestToken=${tgRequestToken}`);
      if (res.status === 410) {
        toast.error('Login link expired. Please start again.');
        resetTg();
        return;
      }
      const data = await res.json();
      if (data.ready && data.loginToken) {
        await loginWithTelegramToken(data.loginToken);
        toast.success('Logged in via Telegram!');
        if (pendingSubmission) toast.success('Your reading request is ready to be submitted!');
        onOpenChange(false);
        resetTg();
      } else {
        toast.error(
          "Not confirmed yet. Make sure you opened the bot and pressed Start. If you don't have Telegram, use the email login above.",
          { duration: 6000 }
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'Could not verify. Please try again.');
    } finally {
      setTgChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'login' ? 'Login' : 'Sign Up'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (mode === 'login' ? 'Logging in…' : 'Signing up…') : mode === 'login' ? 'Login' : 'Sign Up'}
          </Button>
        </form>

        <div className="text-center text-sm">
          {mode === 'login' ? (
            <>Don't have an account?{' '}<button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">Sign up</button></>
          ) : (
            <>Already have an account?{' '}<button type="button" onClick={() => setMode('login')} className="text-primary hover:underline font-medium">Login</button></>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* ── Telegram login — same pattern as TelegramSettings in MyReadings ── */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Send className="size-4 text-blue-500" />
            Login with Telegram
          </div>

          {tgStep === 'idle' && (
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={handleTelegramInit}>
                <Send className="size-4 mr-2 text-blue-500" />
                Continue with Telegram
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Requires a free{' '}
                <a href="https://telegram.org" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                  Telegram
                </a>{' '}
                account. Don't have one? Use email login above.
              </p>
            </div>
          )}

          {tgStep === 'pending' && (
            <div className="space-y-3">
              {tgDeepLink ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Step 1</span> — Tap the button below to open the bot in Telegram.
                    <br />
                    <span className="font-medium">Step 2</span> — Press{' '}
                    <span className="font-mono bg-muted px-1 rounded">Start</span> in the chat.
                    <br />
                    <span className="font-medium">Step 3</span> — Come back here and tap <em>I've opened the bot</em>.
                  </p>
                  <a href={tgDeepLink} target="_blank" rel="noreferrer" className="block">
                    <Button className="w-full">
                      <ExternalLink className="size-4 mr-2" />
                      Open Telegram Bot
                    </Button>
                  </a>
                  <Button variant="outline" className="w-full" onClick={handleTelegramVerify} disabled={tgChecking}>
                    {tgChecking ? 'Checking…' : <><CheckCircle2 className="size-4 mr-2" />I've opened the bot — verify login</>}
                  </Button>
                  <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Don't have Telegram?</p>
                    <p>
                      Telegram is a free messaging app.{' '}
                      <a href="https://telegram.org/dl" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                        Download it here
                      </a>
                      , create an account, then come back and try again.
                    </p>
                    <p>
                      Prefer not to use Telegram?{' '}
                      <button
                        type="button"
                        onClick={resetTg}
                        className="underline hover:text-foreground font-medium"
                      >
                        Sign up with email instead
                      </button>
                      .
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-md bg-amber-900/30 border border-amber-700 px-3 py-3 text-sm space-y-1">
                  <p className="font-medium text-amber-300">Telegram login is not available right now.</p>
                  <p className="text-amber-400">
                    The bot hasn't been configured yet. Please{' '}
                    <button
                      type="button"
                      onClick={resetTg}
                      className="underline font-medium hover:text-amber-300"
                    >
                      sign up or log in with email
                    </button>{' '}
                    instead.
                  </p>
                </div>
              )}
              {tgDeepLink && (
                <button type="button" onClick={resetTg} className="text-xs text-muted-foreground hover:underline w-full text-center">
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
