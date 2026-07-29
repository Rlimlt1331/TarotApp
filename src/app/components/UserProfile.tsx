import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ExternalLink, Send, Unlink, User } from 'lucide-react';

// ─── Telegram notification settings ──────────────────────────────────────────
type TelegramStatus = { linked: boolean; notifyMode: 'notify' | 'deliver' | null };
type LinkingState = 'idle' | 'pending' | 'verifying';

function TelegramSettings({ token }: { token: string }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [linking, setLinking] = useState<LinkingState>('idle');
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/telegram/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch {
      // silently ignore
    }
  };

  useEffect(() => { fetchStatus(); }, [token]);

  const handleLink = async () => {
    try {
      setLinking('pending');
      const res = await fetch(`${API_URL}/telegram/link-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate link');
      const data = await res.json();
      setDeepLink(data.deepLink || null);
    } catch {
      toast.error('Failed to generate Telegram link. Please try again.');
      setLinking('idle');
    }
  };

  const handleVerify = async () => {
    setLinking('verifying');
    await fetchStatus();
    setLinking('idle');
    if (status?.linked) {
      toast.success('Telegram connected!');
    } else {
      toast.error("Not connected yet — make sure you've opened the bot and sent the start command.");
    }
  };

  const handlePreference = async (mode: 'notify' | 'deliver') => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/telegram/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notifyMode: mode }),
      });
      if (!res.ok) throw new Error();
      setStatus((s) => s ? { ...s, notifyMode: mode } : s);
      toast.success('Preference saved');
    } catch {
      toast.error('Failed to save preference');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    try {
      const res = await fetch(`${API_URL}/telegram/unlink`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setStatus({ linked: false, notifyMode: null });
      setDeepLink(null);
      setLinking('idle');
      toast.success('Telegram unlinked');
    } catch {
      toast.error('Failed to unlink Telegram');
    }
  };

  if (!status) return null;

  return (
    <Card className="tarot-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4" />
          Telegram Notifications
        </CardTitle>
        <CardDescription>
          Get notified on Telegram when your reading is ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status.linked && linking === 'idle' && (
          <Button variant="outline" onClick={handleLink} className="w-full">
            <Send className="size-4 mr-2" />
            Link Telegram
          </Button>
        )}

        {!status.linked && linking === 'pending' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Step 1</span> — Tap the button below to open the bot in Telegram.
              <br />
              <span className="font-medium">Step 2</span> — Press <span className="font-mono bg-muted px-1 rounded">Start</span> in the chat. That's it!
            </p>
            {deepLink ? (
              <a href={deepLink} target="_blank" rel="noreferrer" className="block">
                <Button className="w-full">
                  <ExternalLink className="size-4 mr-2" />
                  Open Telegram Bot
                </Button>
              </a>
            ) : (
              <p className="text-sm text-amber-400">
                Bot username not configured — contact the portal administrator.
              </p>
            )}
            <Button variant="outline" onClick={handleVerify} className="w-full">
              {linking === 'verifying' ? 'Checking…' : "I've opened the bot — verify connection"}
            </Button>
          </div>
        )}

        {status.linked && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="size-4" />
              <span>Telegram connected</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">When your reading is ready, would you like to:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handlePreference('notify')}
                  className={`p-3 border-2 rounded-lg text-left transition-all text-sm ${
                    status.notifyMode === 'notify'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium block mb-0.5">Notify me</span>
                  <span className="text-xs text-muted-foreground">Receive a link to view in the portal</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handlePreference('deliver')}
                  className={`p-3 border-2 rounded-lg text-left transition-all text-sm ${
                    status.notifyMode === 'deliver'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium block mb-0.5">Send my reading</span>
                  <span className="text-xs text-muted-foreground">Receive the full reading on Telegram</span>
                </button>
              </div>
              {!status.notifyMode && (
                <p className="text-xs text-muted-foreground">Choose one to activate notifications.</p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              className="text-muted-foreground hover:text-destructive w-full"
            >
              <Unlink className="size-3 mr-2" />
              Unlink Telegram
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Profile page ─────────────────────────────────────────────────────────────
export function UserProfile({ onComplete }: { onComplete: () => void }) {
  const { user, token } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success('Profile saved');
      onComplete();
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6 mystical-gradient-subtle">
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onComplete} aria-label="Back">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your profile and notification preferences.</p>
          </div>
        </div>

        <Card className="tarot-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {user?.email && (
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={user.email} disabled className="bg-muted/30 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="pt-1">
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {token && <TelegramSettings token={token} />}
      </div>
    </div>
  );
}
