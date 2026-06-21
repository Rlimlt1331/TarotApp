import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { Calendar, Sparkles, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { apiClient } from '../../lib/api-client';
import { ReadingFeedback } from './ReadingFeedback';
import { toast } from 'sonner';

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
  createdAt: string;
  reading: AgentReading | null;
}

export function MyReadings() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

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

  const categoryColors: Record<string, string> = {
    relationships: 'bg-pink-500/10 text-pink-700 border-pink-200',
    career: 'bg-blue-500/10 text-blue-700 border-blue-200',
    health: 'bg-green-500/10 text-green-700 border-green-200',
    general: 'bg-purple-500/10 text-purple-700 border-purple-200',
  };

  const completedCount = submissions.filter(s => s.reading !== null).length;
  const pendingCount = submissions.filter(s => s.reading === null).length;

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          {!isCompleted && (
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

                {selectedSubmission.reading?.tarotReading && (
                  <div>
                    <h3 className="font-medium mb-3">Tarot Reading:</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.reading.tarotReading}
                    </p>
                  </div>
                )}

                {selectedSubmission.reading?.astrologyReading && (
                  <div>
                    <h3 className="font-medium mb-3">Astrology Reading:</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.reading.astrologyReading}
                    </p>
                  </div>
                )}

                {selectedSubmission.reading?.harmonisedReading && (
                  <div>
                    <h3 className="font-medium mb-3">Harmonised Reading:</h3>
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
                  <ReadingFeedback submissionId={selectedSubmission.id} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
