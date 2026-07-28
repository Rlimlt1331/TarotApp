import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { format } from 'date-fns';
import { Calendar, CheckCircle2, Clock, ExternalLink, Gem, Send, Sparkles, Star, Unlink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { apiClient } from '../../lib/api-client';
import { ReadingFeedback } from './ReadingFeedback';
import { toast } from 'sonner';

// ─── Telegram settings types ──────────────────────────────────────────────────
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
              <p className="text-sm text-amber-600">
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
            <div className="flex items-center gap-2 text-sm text-green-600">
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

// ─── Gem history ──────────────────────────────────────────────────────────────
interface GemTransaction {
  id: number;
  type: string;
  amount: number;
  referenceId: string | null;
  createdAt: string;
}

const PACK_LABELS: Record<string, { priceSGD: number }> = {
  pack_10: { priceSGD: 10 },
  pack_20: { priceSGD: 20 },
  pack_50: { priceSGD: 50 },
  pack_80: { priceSGD: 80 },
};

function resolvePackPrice(referenceId: string | null): number | null {
  if (!referenceId) return null;
  const packId = referenceId.replace('paynow_', '');
  return PACK_LABELS[packId]?.priceSGD ?? null;
}

function txLabel(type: string): string {
  switch (type) {
    case 'purchase': return 'Gems purchased';
    case 'pending_purchase': return 'Pending payment verification';
    case 'reading_spend': return 'Reading submitted';
    case 'rating_bonus': return 'Rating bonus';
    default: return type;
  }
}

// ─── Submission types ─────────────────────────────────────────────────────────
interface DetectedCard {
  id: number;
  name: string;
  position: string | null;
  orientation: string | null;
}

interface AgentReading {
  id: number;
  astrologyReading: string | null;
  tarotReading: string | null;
  harmonisedReading: string | null;
  detectedCards: DetectedCard[];
}

interface Submission {
  id: number;
  question: string;
  category: string | null;
  horoscope: string | null;
  gender: string | null;
  country: string | null;
  occupation: string | null;
  additionalNotes: string | null;
  pendingPayment: boolean;
  createdAt: string;
  reading: AgentReading | null;
}

export function MyReadings() {
  const { user, token, gemBalance, freeReadingUsed } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [view, setView] = useState<'readings' | 'history'>('readings');
  const [transactions, setTransactions] = useState<GemTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!user) return;
      try {
        const data = await apiClient.getSubmissions();
        setSubmissions(data);
      } catch (error: any) {
        toast.error(error.message || 'Failed to fetch readings');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [user]);

  useEffect(() => {
    if (!token) return;
    setTransactionsLoading(true);
    fetch(`${API_URL}/gems/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => {})
      .finally(() => setTransactionsLoading(false));
  }, [token]);

  const categoryColors: Record<string, string> = {
    relationships: 'bg-pink-500/10 text-pink-700 border-pink-200',
    career: 'bg-blue-500/10 text-blue-700 border-blue-200',
    health: 'bg-green-500/10 text-green-700 border-green-200',
    general: 'bg-purple-500/10 text-purple-700 border-purple-200',
  };

  const completedCount = submissions.filter(s => s.reading !== null).length;
  const pendingCount = submissions.filter(s => s.reading === null && !s.pendingPayment).length;
  const pendingPaymentCount = submissions.filter(s => s.pendingPayment).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 mystical-gradient-subtle">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4 py-8">
          <h1 className="text-5xl flex items-center justify-center gap-3 gradient-text">
            <Star className="size-10 sparkle text-purple-600" />
            My Readings
          </h1>
          <p className="text-lg text-muted-foreground">
            View your tarot reading history and insights
          </p>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-1 gap-4 ${pendingPaymentCount > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <Card className="tarot-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-purple-900 dark:text-purple-100">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-600">{submissions.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900 dark:text-green-100">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{completedCount}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-900 dark:text-amber-100">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-600">{pendingCount}</div>
            </CardContent>
          </Card>
          {pendingPaymentCount > 0 && (
            <Card className="tarot-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-purple-900 dark:text-purple-100">Pending Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-600">{pendingPaymentCount}</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tab bar */}
        <div className="border-b border-border">
          <div className="flex">
            <button
              onClick={() => setView('readings')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                view === 'readings'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              My Readings
            </button>
            <button
              onClick={() => setView('history')}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                view === 'history'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Gem className="size-3.5" />
              Gem History
            </button>
          </div>
        </div>

        {/* My Readings tab */}
        {view === 'readings' && (
          <div className="space-y-6">
            {token && <TelegramSettings token={token} />}

            <div className="space-y-4">
              <h2 className="text-2xl">Your Readings</h2>
              {submissions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No readings yet</p>
                  </CardContent>
                </Card>
              ) : (
                submissions.map((submission) => {
                  const category = submission.category || 'general';
                  const isCompleted = submission.reading !== null;
                  const isPendingPayment = submission.pendingPayment;

                  return (
                    <Card key={submission.id} className="tarot-card">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              <Sparkles className="size-5" />
                              {submission.question}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <Calendar className="size-4" />
                                {format(new Date(submission.createdAt), 'MMM dd, yyyy')}
                              </span>
                              <Badge className={categoryColors[category] || categoryColors.general}>
                                {category}
                              </Badge>
                              {isPendingPayment && (
                                <Badge className="bg-purple-500/10 text-purple-700 border-purple-200 flex items-center gap-1.5">
                                  <span className="relative flex size-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                                    <span className="relative inline-flex size-2 rounded-full bg-purple-500" />
                                  </span>
                                  Pending payment confirmation
                                </Badge>
                              )}
                              {!isCompleted && !isPendingPayment && (
                                <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 flex items-center gap-1.5">
                                  <span className="relative flex size-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                                  </span>
                                  Reading in progress
                                </Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {isCompleted && submission.reading!.detectedCards.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Cards Detected:</p>
                            <div className="flex flex-wrap gap-2">
                              {submission.reading!.detectedCards.map((card) => (
                                <Badge key={card.id} variant="outline">
                                  {card.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-medium mb-2">Reading Summary:</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {submission.reading?.harmonisedReading || 'Your reading is being prepared by the reader. Check back soon.'}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => setSelectedSubmission(submission)}
                          className="w-full"
                        >
                          View Full Reading
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Gem History tab */}
        {view === 'history' && (
          <div className="space-y-4">
            {/* Balance summary */}
            <Card className="tarot-card">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gem className="size-5 text-purple-400" />
                    <span className="font-medium">Current Balance</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-400">
                    {freeReadingUsed ? `${gemBalance} Gems` : 'Free reading available'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Transaction list */}
            {transactionsLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
              </div>
            ) : transactions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gem className="size-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No gem transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const isCredit = tx.amount > 0;
                  const isPending = tx.type === 'pending_purchase';
                  const packPrice = resolvePackPrice(tx.referenceId);

                  return (
                    <Card key={tx.id} className="tarot-card">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                              isPending
                                ? 'bg-amber-900/30'
                                : isCredit
                                  ? 'bg-green-900/30'
                                  : 'bg-purple-900/30'
                            }`}>
                              {isPending
                                ? <Clock className="size-4 text-amber-400" />
                                : <Gem className={`size-4 ${isCredit ? 'text-green-400' : 'text-purple-400'}`} />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{txLabel(tx.type)}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}
                                </span>
                                {packPrice != null && (
                                  <span className="text-xs text-muted-foreground">· SGD {packPrice}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ${
                            isPending
                              ? 'text-amber-400'
                              : isCredit
                                ? 'text-green-400'
                                : 'text-muted-foreground'
                          }`}>
                            {isPending
                              ? `${tx.amount} Gems (pending)`
                              : isCredit
                                ? `+${tx.amount} Gems`
                                : `${tx.amount} Gems`
                            }
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Your Tarot Reading
                </DialogTitle>
                <DialogDescription>
                  Submitted on {format(new Date(selectedSubmission.createdAt), 'MMMM dd, yyyy')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {selectedSubmission.reading?.detectedCards && selectedSubmission.reading.detectedCards.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Cards Detected:</h3>
                    <div className="space-y-2">
                      {selectedSubmission.reading.detectedCards.map((card, idx) => (
                        <div key={card.id} className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{idx + 1}</Badge>
                          <span className="text-sm font-medium">{card.name}</span>
                          {card.orientation && (
                            <Badge variant={card.orientation === 'upright' ? 'default' : 'outline'} className="text-xs">
                              {card.orientation}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSubmission.reading?.harmonisedReading && (
                  <div>
                    <h3 className="font-medium mb-3">Your Reading:</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.reading.harmonisedReading}
                    </p>
                  </div>
                )}

                {!selectedSubmission.reading && (
                  <p className="text-sm text-muted-foreground">
                    Your reading is being prepared by the reader. Check back soon.
                  </p>
                )}

                {selectedSubmission.reading && (
                  <ReadingFeedback submissionId={selectedSubmission.id} onClose={() => setSelectedSubmission(null)} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
