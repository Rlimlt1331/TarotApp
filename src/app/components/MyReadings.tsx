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

interface BackendReading {
  id: number;
  title: string;
  interpretation: string;
  createdAt: string;
  cards: Array<{
    id: number;
    name: string;
    position: string;
  }>;
}

export function MyReadings() {
  const { user } = useAuth();
  const [readings, setReadings] = useState<BackendReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReading, setSelectedReading] = useState<BackendReading | null>(null);

  useEffect(() => {
    const fetchReadings = async () => {
      if (!user) return;
      try {
        const data = await apiClient.getReadings();
        setReadings(data);
      } catch (error: any) {
        toast.error(error.message || 'Failed to fetch readings');
      } finally {
        setLoading(false);
      }
    };

    fetchReadings();
  }, [user]);

  const categoryColors: Record<string, string> = {
    relationships: 'bg-pink-500/10 text-pink-700 border-pink-200',
    career: 'bg-blue-500/10 text-blue-700 border-blue-200',
    health: 'bg-green-500/10 text-green-700 border-green-200',
    general: 'bg-purple-500/10 text-purple-700 border-purple-200',
  };

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
              <div className="text-4xl font-bold text-purple-600">{readings.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900 dark:text-green-100">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{readings.length}</div>
            </CardContent>
          </Card>
          <Card className="tarot-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-900 dark:text-amber-100">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-600">0</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl">Completed Readings</h2>
          {readings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No completed readings yet</p>
              </CardContent>
            </Card>
          ) : (
            readings.map((reading) => {
              const categoryCard = reading.cards.find(c => c.position === 'Category');
              const category = categoryCard ? categoryCard.name : 'general';
              const selectedCards = reading.cards.filter(c => !['Category', 'Horoscope', 'Country', 'Gender', 'Occupation', 'Additional Notes'].includes(c.position));

              return (
                <Card key={reading.id} className="tarot-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="size-5" />
                          {reading.title || 'Tarot Reading'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-4" />
                            {format(new Date(reading.createdAt), 'MMM dd, yyyy')}
                          </span>
                          <Badge className={categoryColors[category] || categoryColors.general}>
                            {category}
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedCards.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Cards Drawn:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCards.map((card) => (
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
                        {reading.interpretation}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setSelectedReading(reading)}
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

      <Dialog open={!!selectedReading} onOpenChange={() => setSelectedReading(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedReading && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Your Tarot Reading
                </DialogTitle>
                <DialogDescription>
                  Generated on {format(new Date(selectedReading.createdAt), 'MMMM dd, yyyy')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {selectedReading.cards.filter(c => !['Category', 'Horoscope', 'Country', 'Gender', 'Occupation', 'Additional Notes'].includes(c.position)).length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Cards Drawn:</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedReading.cards
                        .filter(c => !['Category', 'Horoscope', 'Country', 'Gender', 'Occupation', 'Additional Notes'].includes(c.position))
                        .map((card, idx) => (
                          <Badge key={card.id} variant="secondary" className="text-sm">
                            {idx + 1}. {card.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-3">Your Reading:</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedReading.interpretation}
                  </p>
                </div>

                <ReadingFeedback readingId={selectedReading.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
