import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { Calendar, Moon, Sparkles, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { API_URL } from '../config/api';
import { ReadingFeedback } from './ReadingFeedback';
import { toast } from 'sonner';

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
  const { user, token } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_URL}/submissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch readings');
        setSubmissions(await res.json());
      } catch (error: any) {
        toast.error(error.message || 'Failed to fetch readings');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [user]);

  const categoryColors: Record<string, string> = {
    relationships: 'bg-pink-900/30 text-pink-300 border-pink-700',
    career: 'bg-blue-900/30 text-blue-300 border-blue-700',
    health: 'bg-green-900/30 text-green-300 border-green-700',
    general: 'bg-purple-900/30 text-purple-300 border-purple-700',
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
          <Card className="tarot-card bg-purple-900/20 border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-purple-300">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-400">{submissions.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-green-900/20 border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-300">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-400">{completedCount}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-amber-900/20 border-amber-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-300">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-400">{pendingCount}</div>
            </CardContent>
          </Card>
          {pendingPaymentCount > 0 && (
            <Card className="tarot-card bg-purple-900/20 border-purple-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-purple-300">Pending Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-400">{pendingPaymentCount}</div>
              </CardContent>
            </Card>
          )}
        </div>

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
                                <Badge className="bg-purple-900/30 text-purple-300 border-purple-700 flex items-center gap-1.5">
                                  <span className="relative flex size-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                                    <span className="relative inline-flex size-2 rounded-full bg-purple-500" />
                                  </span>
                                  Pending payment confirmation
                                </Badge>
                              )}
                              {!isCompleted && !isPendingPayment && (
                                <Badge className="bg-indigo-900/30 text-indigo-300 border-indigo-700 flex items-center gap-1.5">
                                  <Moon className="size-3 shrink-0" />
                                  With your night reader
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
                          {isCompleted ? (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {submission.reading!.harmonisedReading}
                            </p>
                          ) : isPendingPayment ? (
                            <p className="text-sm text-muted-foreground">
                              Awaiting payment confirmation before your reading is activated.
                            </p>
                          ) : (
                            <div className="flex items-start gap-2 rounded-lg border border-indigo-800 bg-indigo-900/20 px-3 py-2.5">
                              <Moon className="size-4 text-indigo-400 mt-0.5 shrink-0" />
                              <p className="text-sm text-indigo-300">
                                Your cards are being read tonight — check back by morning.
                              </p>
                            </div>
                          )}
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
